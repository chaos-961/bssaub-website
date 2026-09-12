/* The admin shell. Identical on every site: it owns the gate, the top bar, the
 * tab strip and the footer, and it owns nothing else. What goes inside a tab is
 * the site's own business and arrives from the adapter named in data-boot on
 * <body>.
 *
 * NOTHING IS REMEMBERED. No storage is written here, no cookie is set here, and
 * signing out RELOADS the page rather than tearing it down, so a second visit
 * starts from an empty document with no way to tell a first one happened.
 * Opening /admin always asks for the password. The one thing an adapter must
 * match is that promise: if it signs into a back end that would restore itself,
 * asking for in-memory persistence is the adapter's job.
 *
 * THE PASSWORD DECIDES THE DOOR. signIn() either resolves, and the dashboard
 * opens, or it throws. A back end that is merely unreachable must RESOLVE and
 * say so inside the dashboard: a console that refused to open on a network blip
 * is indistinguishable, from the outside, from a wrong password. That is also
 * why a failure after signIn() has resolved never blames the password: it
 * reports itself instead, and the difference is the `opened` flag below.
 *
 * The adapter is an ES module with:
 *
 *   signIn(password, ui) -> session      throw for a refused password
 *   mount(api, session)                  fill the tabs
 *   signOut(session)                     optional, best effort
 *
 * and it is imported only after the first submit, so the sign-in screen costs
 * one HTML file and nothing else.
 */
/* The shell proper. `loadAdapter` resolves to the site's adapter module; it is
 * called on the first submit and not before, which is what keeps the sign-in
 * screen to one HTML file. */
function adminShell(loadAdapter) {
  "use strict";

  /* frame-ancestors is ignored when a CSP is delivered in a <meta>, and a
     static host cannot send the header, so the bust is the real protection:
     an admin inside somebody else's frame is shown nothing at all. */
  if (window.top !== window.self) {
    document.documentElement.replaceChildren(document.createElement("head"), document.createElement("body"));
    try { window.top.location = window.self.location; } catch (e) { /* cross origin: blank is enough */ }
    return;
  }

  var doc = document;
  var body = doc.body;
  var $ = function (id) { return doc.getElementById(id); };

  var gate = $("gate");
  var card = $("card");
  var app = $("app");
  var form = $("f");
  var pass = $("password");
  var eye = $("eye");
  var go = $("go");
  var bar = $("bar");
  var msg = $("msg");
  var tabsEl = $("tabs");
  var panelsEl = $("panels");
  var signout = $("signout");
  if (!gate || !app || !form || !pass || !go || !tabsEl || !panelsEl) return;

  var VERSION = body.getAttribute("data-version") || "";
  var IDLE_MS = Number(body.getAttribute("data-idle") || 15) * 60000;

  /* Why the last session ended, as a code rather than prose: it travels in the
     address bar, and prose there is percent-encoded noise. */
  var REASONS = { out: "Signed out.", idle: "Locked after fifteen quiet minutes." };

  var fails = 0;
  var session = null;
  var adapter = null;
  var idleTimer = 0;
  /* A dashboard with unsaved work puts its question here. It is asked ONLY for
     a pressed Sign out, never for the idle lock: a lock that could be refused
     by a page nobody is sitting at is not a lock. */
  var askFirst = null;

  /* ------------------------------------------------------------ the eye */

  function reveal(on) {
    pass.type = on ? "text" : "password";
    eye.setAttribute("aria-pressed", String(on));
    eye.setAttribute("aria-label", on ? "Hide password" : "Show password");
    $("eye-on").hidden = on;
    $("eye-off").hidden = !on;
  }
  if (eye) {
    eye.addEventListener("click", function () {
      reveal(pass.type === "password");
      /* Put the caret back where it was. Changing input.type sends it to the
         end in every engine, which loses the place mid-word. */
      var at = pass.value.length;
      pass.focus();
      try { pass.setSelectionRange(at, at); } catch (e) { /* only type=text allows it */ }
    });
  }

  /* ------------------------------------------------------ gate feedback */

  var ui = {
    say: function (text, kind) {
      if (!msg) return;
      if (!text) { msg.hidden = true; msg.textContent = ""; return; }
      msg.className = "adm-msg " + (kind || "bad");
      msg.textContent = text;
      msg.hidden = false;
    },
    /* busy(false) to release; busy(true, label, percent) to hold. The bar is
       the only thing that says a slow key derivation is still running. */
    busy: function (on, label, pct) {
      go.disabled = !!on;
      pass.readOnly = !!on;
      go.textContent = on ? (label || go.dataset.idle) : go.dataset.idle;
      if (bar) bar.style.width = on ? (pct || 55) + "%" : "0";
    },
  };

  function refuse(text) {
    fails += 1;
    ui.say(text, "bad");
    pass.value = "";
    reveal(false);
    ui.busy(false);
    if (card) {
      card.classList.remove("adm-is-wrong");
      void card.offsetWidth;
      card.classList.add("adm-is-wrong");
    }
    pass.focus();
  }

  /* --------------------------------------------------------- the chrome */

  var panels = Object.create(null);
  var buttons = Object.create(null);
  var listeners = [];
  var current = "";

  function select(id) {
    if (!panels[id] || current === id) return;
    current = id;
    for (var key in panels) {
      var on = key === id;
      panels[key].hidden = !on;
      buttons[key].setAttribute("aria-selected", String(on));
      buttons[key].tabIndex = on ? 0 : -1;
    }
    for (var i = 0; i < listeners.length; i += 1) listeners[i](id);
  }

  var api = {
    /* [{ id, label }] in the order they appear. The first is the one that
       opens, and on every site the first one is Overview. */
    tabs: function (defs) {
      tabsEl.replaceChildren();
      panelsEl.replaceChildren();
      panels = Object.create(null);
      buttons = Object.create(null);
      current = "";
      defs.forEach(function (def, i) {
        var b = doc.createElement("button");
        b.type = "button";
        b.className = "adm-tab";
        b.setAttribute("role", "tab");
        b.id = "tab-" + def.id;
        b.setAttribute("aria-controls", "panel-" + def.id);
        b.setAttribute("aria-selected", "false");
        b.tabIndex = -1;
        b.append(doc.createTextNode(def.label));
        var n = doc.createElement("span");
        n.className = "adm-tab__n";
        n.hidden = true;
        b.appendChild(n);
        b.addEventListener("click", function () { select(def.id); });
        tabsEl.appendChild(b);

        var p = doc.createElement("section");
        p.className = "adm-panel";
        p.id = "panel-" + def.id;
        p.setAttribute("role", "tabpanel");
        p.setAttribute("aria-labelledby", "tab-" + def.id);
        p.hidden = true;
        panelsEl.appendChild(p);

        buttons[def.id] = b;
        panels[def.id] = p;
        if (i === 0) select(def.id);
      });
      return panels;
    },
    panel: function (id) { return panels[id] || null; },
    select: select,
    /* A count beside a tab's name, or null to take it away. */
    count: function (id, n) {
      var b = buttons[id];
      if (!b) return;
      var el = b.querySelector(".adm-tab__n");
      if (n === null || n === undefined || n === "") { el.hidden = true; el.textContent = ""; return; }
      el.textContent = String(n);
      el.hidden = false;
    },
    /* Registering tells you the tab you are already on. A dashboard that hangs
       work off a tab change registers AFTER the first tab is selected, and the
       template draws the strip before the dashboard's code has even run, so
       without this the opening tab is the one tab whose work never happens. */
    onTab: function (fn) {
      listeners.push(fn);
      if (current) fn(current);
    },
    version: function (v) {
      var el = $("version");
      if (el) el.textContent = v ? (/^v/i.test(v) ? String(v) : "v" + v) : "";
    },
    /* The right half of the footer: a dashboard with a connection to lose puts
       its own indicator here, so it is on screen whichever tab is open. */
    status: function () { return $("status"); },
    /* fn() -> boolean or a promise of one. False keeps the session open. */
    beforeSignOut: function (fn) { askFirst = fn; },
    /* Back to the gate. Always a reload: see the header. */
    lock: function (code) { end(code || "idle"); },
    ui: ui,
  };

  /* Arrow keys walk the strip, which is what role="tablist" promises. */
  tabsEl.addEventListener("keydown", function (e) {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].indexOf(e.key) < 0) return;
    var ids = Object.keys(panels);
    if (!ids.length) return;
    var at = ids.indexOf(current);
    var next =
      e.key === "Home" ? 0 :
      e.key === "End" ? ids.length - 1 :
      e.key === "ArrowLeft" ? (at - 1 + ids.length) % ids.length :
      (at + 1) % ids.length;
    e.preventDefault();
    select(ids[next]);
    buttons[ids[next]].focus();
  });

  /* ------------------------------------------------------------- unlock */

  function open() {
    gate.hidden = true;
    app.hidden = false;
    body.classList.add("adm-is-open");
    window.scrollTo(0, 0);
    bump();
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(function (ev) {
      window.addEventListener(ev, bump, { passive: true });
    });
  }

  function bump() {
    clearTimeout(idleTimer);
    if (!IDLE_MS) return;
    idleTimer = setTimeout(function () { end("idle"); }, IDLE_MS);
  }

  /* One way out, used by the button and by the idle timer alike. */
  function end(code) {
    clearTimeout(idleTimer);
    try { if (adapter && adapter.signOut) adapter.signOut(session); } catch (e) { /* going anyway */ }
    session = null;
    location.replace(location.pathname + location.search + (code ? "#" + code : ""));
    location.reload();
  }

  api.version(VERSION);

  if (signout) {
    signout.addEventListener("click", function () {
      if (!askFirst) { end("out"); return; }
      signout.disabled = true;
      Promise.resolve(askFirst()).then(function (ok) {
        signout.disabled = false;
        if (ok !== false) end("out");
      }, function () {
        signout.disabled = false;
        end("out");
      });
    });
  }

  /* The reason the last session ended, said once and then wiped from the
     address bar so a refresh does not repeat it. */
  if (location.hash.length > 1) {
    var said = REASONS[location.hash.slice(1)];
    if (said) ui.say(said, "good");
    history.replaceState(null, "", location.pathname + location.search);
  }

  /* ------------------------------------------------------------- submit */

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var password = pass.value;
    if (!password || go.disabled) return;
    ui.say("");
    ui.busy(true, "Checking…", 55);

    /* The only thing a guess costs is time, and the cost grows. */
    var delay = Math.min(fails * 800, 4000);
    var opened = false;

    setTimeout(function () {
      loadAdapter().then(function (mod) {
        adapter = mod;
        return mod.signIn(password, ui);
      }).then(function (s) {
        opened = true;
        session = s;
        fails = 0;
        pass.value = "";
        reveal(false);
        ui.say("");
        ui.busy(true, "Opening…", 88);
        return adapter.mount(api, session);
      }).then(function () {
        open();
        ui.busy(false);
      }).catch(function (err) {
        if (opened) {
          /* The password was right and the shell broke. Say that, rather than
             sending the owner back to try a password that already worked. */
          gate.hidden = true;
          app.hidden = false;
          api.tabs([{ id: "error", label: "Admin" }]);
          var p = api.panel("error");
          var h = doc.createElement("p");
          h.className = "msg bad";
          h.textContent = "Signed in, but the dashboard did not open: " +
            ((err && err.message) || "unknown error") + ". Sign out and try again.";
          p.appendChild(h);
          ui.busy(false);
          return;
        }
        var why = (err && err.reason) || "";
        refuse(
          why === "payload" ? "The dashboard is missing. Rebuild the admin payload." :
          why === "offline" ? "No connection. Try again." :
          why === "throttle" ? "Too many attempts. Wait a minute and try again." :
          why === "crypto" ? "This browser cannot open the admin page." :
          "That is not the password."
        );
      });
    }, delay);
  });

  if (!window.crypto || !window.crypto.subtle) {
    ui.say("This browser cannot open the admin page.", "bad");
    go.disabled = true;
  } else {
    pass.focus();
  }
}

export { adminShell as start };
