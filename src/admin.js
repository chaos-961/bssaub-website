/* ------------------------------------------------------------------
   Admin gate (v0.4.2, user brief: the same thing pavialeb.com has, for
   this site, with nothing behind it yet but a way out).

   THE SHAPE, AND WHY IT IS THIS SHAPE.
   There is no server here. Everything this page ships is readable by
   anyone who opens devtools, so a gate that COMPARES a password (in
   plaintext, or hashed, it makes no difference) protects nothing: the
   thing it guards was in the bundle all along, and the comparison is one
   breakpoint away from being stepped over. So the dashboard is not
   guarded, it is ENCRYPTED. public/admin-payload.json is AES-256-GCM
   ciphertext; the password is the key material, not an answer to check
   against. Wrong password means the decrypt fails its authentication tag,
   which is the only "wrong password" signal in this file. There is no
   branch to patch, no constant to read, and nothing to leak.

   WHAT THIS DOES NOT CLAIM. It does not turn a 9 character password into
   a strong secret. Anyone can fetch the payload and grind candidates
   offline; PBKDF2 at 600k iterations makes that cost real but not
   prohibitive at this length. Hence: nothing sensitive belongs in the
   payload until the longer password lands, and any future backend must
   enforce its OWN rules server side rather than trusting that this gate
   was passed. That is the honest security boundary and it is written here
   so nobody has to guess at it later.

   DEFENCES THAT ARE NOT THE ENCRYPTION.
   - Frame bust. This is a meta tag CSP (GitHub Pages cannot set headers),
     and frame-ancestors is ignored in meta by spec, so the anti
     clickjacking job falls to the check at the top of boot().
   - Idle lock, which tears the dashboard down and drops it from memory.
   - A growing delay per failed attempt. It is not a security control
     (an attacker attacks the file, not this form), it just makes pointing
     a script at the form itself pointless.
   - The password field is cleared on every outcome, success or failure,
     and the derived key is never stored: it goes out of scope with the
     unlock call.

   THE MEMBERS CONNECTION (v0.4.8), which changes what this page is.
   Until now the payload was the whole story: decrypt it and there was
   nothing behind it. Now the dashboard reads and writes real member
   records, and Firestore only ever answers to a Firebase identity, so the
   gate signs in to a dedicated admin account whose ADDRESS travels inside
   the ciphertext and whose PASSWORD is the same one that just decrypted
   it. One secret, typed once, doing both jobs.

   That is a deliberate trade and it moves the boundary. A cracked payload
   used to be worth some markup; it is now worth write access to the
   members collection, which is exactly why the honest note above about
   password length stopped being theoretical. The mitigation is length,
   and it is the user's to apply.

   THE RULES ARE THE AUTHORITY, NOT THIS PAGE. Firestore checks the signed
   in address on every read and write, so patching this file, skipping the
   gate, or forging an unlock buys nothing: without the Firebase session
   the collection is closed. That is the opposite of the usual static site
   admin, where the client is the only thing standing in the way.

   Three things keep the session itself small. It runs on a NAMED Firebase
   app, so it cannot touch the member session the account page keeps in
   this same origin's IndexedDB (the auth store is keyed by app name). It
   uses inMemoryPersistence, so nothing about it is ever written to disk
   and closing the tab is a sign out. And the idle lock signs it out and
   deletes the app, so a locked admin is a signed out one.

   The connection is started but NOT awaited at unlock, so a slow round
   trip cannot hold the dashboard shut; the search area waits on it.
   ------------------------------------------------------------------ */
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/instrument-sans';

import './styles/tokens.css';
import './styles/base.css';
import './styles/site-bg.css';
import './styles/auth.css';

import { initOceanMesh } from './modules/oceanMesh.js';
import { firebaseConfig } from './data/firebase.js';
/* Statically imported although a LOCKED page can use none of it. These are
   pure functions with no dependencies of their own, and the alternative (a
   fourth dynamic chunk) would leave the dashboard unable to do arithmetic
   until a network round trip finished, to save a few hundred bytes on a page
   exactly one person ever opens. */
import {
  MEMBERS,
  daysLeft,
  extend,
  formatDate,
  formatLeft,
  isActive,
  matchesTerm,
  memberFrom,
  queryKeyFor,
} from './data/membership.js';

/* Must match scripts/build-admin-payload.mjs byte for byte. */
const KDF_PREFIX = 'bss-admin:';
const AAD = 'bss-admin:v1';

const WARN_SECONDS = 60;
const THROTTLE_STEP_MS = 900;
const THROTTLE_MAX_MS = 4500;

/* Pulled deliberately high and REPORTED when it bites (the dashboard prints a
   line when it does). The client side filter below narrows an array-contains
   hit further, so a low cap here would silently drop rows the admin is
   entitled to see, and a search that quietly hides someone is worse than one
   that says it stopped counting. */
const SEARCH_LIMIT = 50;

const encoder = new TextEncoder();
const bytes = (base64) => Uint8Array.from(atob(base64 || ''), (c) => c.charCodeAt(0));

/* The exclusive upper bound of a prefix range: the same string with its last
   code unit bumped by one. The usual Firestore idiom appends U+F8FF instead,
   and it is avoided here on purpose. That character is in a private use block,
   so it renders as NOTHING in an editor and in a diff, which makes it a byte a
   future edit can delete without anyone seeing it happen; and it is only an
   upper bound for text that sorts below it, so an address holding any higher
   character would fall outside its own prefix range. Incrementing is exact and
   visible. */
const afterPrefix = (value) =>
  value.slice(0, -1) + String.fromCharCode(value.charCodeAt(value.length - 1) + 1);

/* ------------------------------------------------------------------
   The members connection. Every Firebase call on this page lives inside
   this function, which is only ever reached with a password that has
   already decrypted the payload.
   ------------------------------------------------------------------ */
async function connect(email, password) {
  const [{ initializeApp, deleteApp }, authSdk, dbSdk] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore/lite'),
  ]);

  /* A NAMED app, which is the part that keeps this off the member session.
     Firebase keys its auth store by app name, so the default app's entry (the
     one account.html writes, on this same GitHub Pages origin) is a different
     key entirely and is neither read nor overwritten here. */
  const app = initializeApp(firebaseConfig, 'bss-admin');
  const auth = authSdk.getAuth(app);
  await authSdk.setPersistence(auth, authSdk.inMemoryPersistence);
  await authSdk.signInWithEmailAndPassword(auth, email, password);

  /* firestore/lite rather than the full SDK: this dashboard runs a handful of
     one shot queries and writes, and the realtime channel, the offline cache
     and the local query engine that come with the full build would all be dead
     weight sitting behind a password gate. */
  const db = dbSdk.getFirestore(app);
  const readRows = (snap) => snap.docs.map((entry) => memberFrom(entry.id, entry.data()));

  return {
    /* ONE query and NO composite index, which is what lets this work the
       moment the rules are pasted in with no console index step. A name search
       hits the prefix array membership.js builds and is then narrowed here for
       exactness; an address search runs a range on the email field. Both are
       single field indexes, and Firestore maintains those automatically. */
    async search(term) {
      const clean = String(term || '').trim();
      if (!clean) return { rows: [], capped: false };

      if (clean.includes('@')) {
        const needle = clean.toLowerCase();
        const snap = await dbSdk.getDocs(
          dbSdk.query(
            dbSdk.collection(db, MEMBERS),
            dbSdk.orderBy('email'),
            dbSdk.startAt(needle),
            dbSdk.endBefore(afterPrefix(needle)),
            dbSdk.limit(SEARCH_LIMIT),
          ),
        );
        return { rows: readRows(snap), capped: snap.docs.length >= SEARCH_LIMIT };
      }

      const key = queryKeyFor(clean);
      if (!key) return { rows: [], capped: false };
      const snap = await dbSdk.getDocs(
        dbSdk.query(
          dbSdk.collection(db, MEMBERS),
          dbSdk.where('searchKeys', 'array-contains', key),
          dbSdk.limit(SEARCH_LIMIT),
        ),
      );
      const found = readRows(snap)
        .filter((row) => matchesTerm(row.name, clean))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { rows: found, capped: snap.docs.length >= SEARCH_LIMIT };
    },

    setExpiry(uid, expiresAt) {
      return dbSdk.updateDoc(dbSdk.doc(db, MEMBERS, uid), { expiresAt });
    },

    remove(uid) {
      return dbSdk.deleteDoc(dbSdk.doc(db, MEMBERS, uid));
    },

    async close() {
      try {
        await authSdk.signOut(auth);
      } finally {
        await deleteApp(app);
      }
    },
  };
}

function boot() {
  document.documentElement.classList.add('js');

  const root = document.querySelector('[data-admin]');
  if (!root) return;

  const gate = root.querySelector('[data-admin-gate]');
  const mount = root.querySelector('[data-admin-mount]');
  const form = root.querySelector('[data-admin-form]');
  const input = root.querySelector('#admin-pass');
  const submit = root.querySelector('[data-admin-submit]');
  const status = root.querySelector('[data-admin-status]');

  let payload = null;
  let failures = 0;
  let busy = false;
  let unlocked = false;
  let teardown = null;
  let connection = null; // Promise of the members connection while unlocked
  let idleTimer = 0;
  let warnTimer = 0;
  let warnTick = 0;

  const setStatus = (message, tone = 'info') => {
    status.textContent = message || '';
    status.dataset.tone = message ? tone : '';
  };

  const setBusy = (value) => {
    busy = value;
    root.classList.toggle('is-busy', value);
    if (submit) submit.disabled = value || !payload;
    if (input) input.disabled = value;
  };

  const resetField = () => {
    if (!input) return;
    input.value = '';
    if (input.type === 'text') {
      input.type = 'password';
      const toggle = root.querySelector('[data-admin-reveal]');
      if (toggle) {
        toggle.textContent = 'Show';
        toggle.setAttribute('aria-pressed', 'false');
        toggle.setAttribute('aria-label', 'Show password');
      }
    }
  };

  /* --- idle lock -------------------------------------------------------- */

  const clearWarning = () => {
    if (warnTick) {
      window.clearInterval(warnTick);
      warnTick = 0;
    }
    root.querySelector('.admin-warn')?.remove();
  };

  /* The idle warning is appended to the unlocked stage and styled as a fixed
     pill (auth.css), not laid out in flow: since v0.4.3 that stage is a bare
     background with a button row, so there is no panel for it to sit inside. */
  const showWarning = () => {
    if (!unlocked || root.querySelector('.admin-warn')) return;
    let left = WARN_SECONDS;
    const strip = document.createElement('div');
    strip.className = 'admin-warn';
    strip.setAttribute('role', 'alert');
    const label = document.createElement('span');
    label.textContent = `Locking in ${left}s for inactivity.`;
    const stay = document.createElement('button');
    stay.type = 'button';
    stay.className = 'auth__link';
    stay.textContent = 'Stay unlocked';
    stay.addEventListener('click', resetIdle);
    strip.append(label, stay);
    mount.appendChild(strip);
    warnTick = window.setInterval(() => {
      left -= 1;
      label.textContent = `Locking in ${Math.max(0, left)}s for inactivity.`;
      if (left <= 0) {
        window.clearInterval(warnTick);
        warnTick = 0;
      }
    }, 1000);
  };

  function resetIdle() {
    window.clearTimeout(idleTimer);
    window.clearTimeout(warnTimer);
    clearWarning();
    if (!unlocked) return;
    const minutes = Number(payload?.lockAfterMinutes) || 15;
    const total = minutes * 60 * 1000;
    warnTimer = window.setTimeout(showWarning, Math.max(0, total - WARN_SECONDS * 1000));
    idleTimer = window.setTimeout(() => lock('Locked after inactivity. Enter the password again.'), total);
  }

  ['click', 'keydown', 'pointermove', 'scroll', 'touchstart'].forEach((name) => {
    window.addEventListener(name, () => unlocked && resetIdle(), { passive: true });
  });

  /* --- unlock / lock ---------------------------------------------------- */

  function lock(message = '') {
    unlocked = false;
    // release anything the dashboard attached outside its own subtree BEFORE
    // the subtree goes, so nothing keeps firing into a removed tree
    try {
      teardown?.();
    } catch {
      /* a broken teardown must not block the lock */
    }
    teardown = null;
    /* Locking signs the admin OUT of Firebase, it does not merely hide the
       dashboard. Anything less would leave an idle machine holding a session
       that can write every member record, which is the whole thing the idle
       lock exists to prevent. Detached deliberately: a network hiccup on the
       way out must not stop the lock, and the app is deleted either way. */
    const closing = connection;
    connection = null;
    closing?.then((members) => members.close()).catch(() => {});
    window.clearTimeout(idleTimer);
    window.clearTimeout(warnTimer);
    clearWarning();
    mount.hidden = true;
    mount.replaceChildren();
    gate.hidden = false;
    resetField();
    setBusy(false);
    setStatus(message, 'info');
    input?.focus({ preventScroll: true });
  }

  async function decrypt(password) {
    const material = await crypto.subtle.importKey(
      'raw',
      encoder.encode(KDF_PREFIX + password),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: bytes(payload.salt),
        iterations: Number(payload.iterations) || 600000,
      },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bytes(payload.iv), additionalData: encoder.encode(AAD) },
      key,
      bytes(payload.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  async function open(dashboard, password) {
    /* innerHTML with a decrypted string, which normally would be the worst
       line in the file. It is safe HERE for a specific reason, not a vague
       one: AES-GCM is authenticated encryption, so this string is bit for bit
       what the encryptor put in, or the decrypt above already threw. An
       attacker who can rewrite the payload cannot make it decrypt, and one who
       can rewrite the served JS does not need this line. */
    mount.innerHTML = dashboard.html;

    /* Started here, where the password is still in scope, and NOT awaited: the
       dashboard opens on the next line either way and its search area waits on
       this promise itself. Awaiting would put a sign in round trip between the
       correct password and the page appearing, for no gain.

       The password's last use is this call. It was never in a module variable
       and it is not in one now: it lives in this function's arguments and in
       the async closure below until sign in resolves, and nowhere else. */
    connection = connect(dashboard.adminEmail, password);
    // the dashboard reports the failure; this only stops an unhandled rejection
    connection.catch(() => {});

    /* The dashboard's CODE runs as a real module from a blob URL rather than
       an inline <script>, which is what lets the built CSP stay
       script-src 'self' blob: with no 'unsafe-inline'. @vite-ignore stops
       Rollup trying to resolve a runtime string at build time. */
    const url = URL.createObjectURL(new Blob([dashboard.code], { type: 'text/javascript' }));
    try {
      const module = await import(/* @vite-ignore */ url);
      /* `api` is the seam this file has always described as the one to widen
         when the admin grows, and v0.4.8 is the first time it has. The
         dashboard is a blob module with no bundler behind it, so it can import
         nothing: the maths comes through `membership` and the database through
         `members`, both as plain functions it can call. Each members call
         chains off the connection promise, so the dashboard never has to know
         whether sign in has landed yet. */
      const live = (run) => (...args) => connection.then((members) => run(members, ...args));
      teardown =
        module.default?.(mount, {
          lock,
          lockAfterMinutes: Number(payload.lockAfterMinutes) || 15,
          // the dashboard cannot read import.meta.env from a blob module, so
          // the Vite base is handed in; it is what "View site" navigates to
          homeUrl: import.meta.env.BASE_URL,
          membership: { daysLeft, extend, formatDate, formatLeft, isActive },
          members: {
            ready: () => connection.then(() => true),
            search: live((members, term) => members.search(term)),
            setExpiry: live((members, uid, ms) => members.setExpiry(uid, ms)),
            remove: live((members, uid) => members.remove(uid)),
          },
        }) || null;
    } finally {
      URL.revokeObjectURL(url);
    }

    gate.hidden = true;
    mount.hidden = false;
    unlocked = true;
    resetIdle();
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || !payload) return;
    const password = input.value;
    if (!password) return setStatus('Enter the admin password.', 'error');

    setBusy(true);
    setStatus('Unlocking.', 'info');

    const wait = Math.min(failures * THROTTLE_STEP_MS, THROTTLE_MAX_MS);
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));

    try {
      const dashboard = await decrypt(password);
      if (!dashboard?.html || !dashboard?.code) throw new Error('payload shape');
      failures = 0;
      resetField();
      setStatus('');
      await open(dashboard, password);
    } catch (error) {
      failures += 1;
      resetField();
      // Every failure reads the same from out here. The only thing that can
      // reach this branch for a real operator is a wrong password.
      setStatus('Incorrect password.', 'error');
      if (import.meta.env.DEV) console.warn('Unlock failed', error);
      input?.focus({ preventScroll: true });
    } finally {
      setBusy(false);
    }
  });

  root.querySelector('[data-admin-reveal]')?.addEventListener('click', (event) => {
    const toggle = event.currentTarget;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    toggle.textContent = reveal ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(reveal));
    toggle.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
    input.focus({ preventScroll: true });
  });

  document.querySelectorAll('[data-home-link]').forEach((a) => {
    a.href = import.meta.env.BASE_URL;
  });

  /* --- load the payload ------------------------------------------------- */

  setBusy(false);

  if (!window.isSecureContext || !window.crypto?.subtle) {
    // WebCrypto only exists in a secure context. localhost counts; plain http
    // on a LAN address does not, which is the case that actually bites.
    setStatus('This page needs a secure connection (https) to decrypt.', 'error');
    return;
  }

  fetch(`${import.meta.env.BASE_URL}admin-payload.json`, { cache: 'no-cache' })
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then((data) => {
      payload = data;
      setBusy(false);
      setStatus('');
      input?.focus({ preventScroll: true });
    })
    .catch((error) => {
      console.error('Admin payload unavailable', error);
      setStatus('The admin payload could not be loaded.', 'error');
    });
}

/* Clickjacking guard. A meta CSP cannot express frame-ancestors, so if this
   page is ever framed the defence has to be here: refuse to render, and try to
   break out. The break out throws on a cross origin top, which is exactly the
   case worth defending against, so the display none is the part that has to
   work on its own. */
if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try {
    window.top.location = window.self.location.href;
  } catch {
    /* cross origin parent: nothing more to do, the page stays blank */
  }
} else {
  initOceanMesh();
  boot();
}
