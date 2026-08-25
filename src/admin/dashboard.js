/* Encrypted admin dashboard code (v0.5.7).

   Like its markup, this file is never served. It is encrypted into
   public/admin-payload.json and reaches the browser only as an AES-GCM
   ciphertext that the admin password decrypts. src/admin.js turns the
   decrypted text into a module and calls the default export below.

   IT IS A PLAIN MODULE WITH NO IMPORTS, AND IT HAS TO STAY THAT WAY.
   It is loaded from a blob URL at runtime, long after Rollup has finished,
   so there is no bundler to resolve a bare specifier like 'gsap' and no
   import map to fall back on. Anything this needs arrives through the `api`
   argument. That is a real constraint on what belongs here, and it is also
   why the api object is the seam to widen when the admin grows.
   `api.membership` is the date arithmetic (src/data/membership.js, shared
   with the account page so both screens agree on what "days left" means)
   and `api.members` is the database, every call chaining off a sign in that
   may still be in flight.

   WHAT v0.5.6 CHANGED, and the one idea the rest of it follows from.
   Until now a member existed on this page only if you could already name
   them: the list was empty until a search filled it. It BROWSES now, which
   means there are two modes here rather than one, and most of the structure
   below is about keeping them apart. Browse walks the collection a page at a
   time on a cursor and knows how many pages there are. Search is the v0.4.8
   behaviour untouched: one query, capped at fifty, no pages. The filter
   reaches both, but by two different routes and for the reason given at
   filterOf() near the bottom.

   READS ARE THE BUDGET, because this project lives inside Firebase's free
   tier and this is the one screen whose cost grows with the membership.
   Four things hold it down and each is load bearing. The page count comes
   from an aggregation, which Firestore bills at ONE read per thousand rows
   matched rather than one per row. A page is one cursor query that reads
   exactly the fifty rows it is about to show. That count is asked once per
   view and then held, because turning a page cannot change it. And a page
   already visited is reached again on the cursor kept from that visit, so
   going back costs the same as going forward and never re-walks anything.
   Only a jump ahead of the furthest page walked pays for the ground it
   steps over, once, and it hands back every cursor in between so that
   ground can never be bought twice.

   SINCE v0.5.7 THE ROWS THEMSELVES ARE KEPT and a page already seen costs
   nothing at all, vouched for by a revision marker that is one read for
   the whole cache. That is the fifth and largest of those levers and it
   has its own write up at THE CACHE below.

   EVERY STRING FROM A MEMBER IS WRITTEN WITH textContent, into a node the
   <template> already declared. Names and email addresses here are whatever
   someone typed into a public registration form, which makes them the one
   genuinely hostile input on this page. There is no innerHTML in this file
   and no string concatenated into markup.

   THE ROW IS THE SOURCE OF TRUTH BETWEEN CLICKS. Each result keeps its own
   record and updates it locally after a write, so pressing "Add 1 year"
   four times adds four years rather than four copies of the first answer,
   without paying a read per press.

   Returns a teardown. The mount's own DOM is destroyed on lock, so listeners
   ON IT die with it; the return value is for anything attached to document,
   window or a timer. Nothing here needs one, which is itself deliberate:
   every listener below is delegated onto the mount's own subtree. */
export default function mount(root, api) {
  const home = root.querySelector('[data-admin-home]');
  if (home) {
    home.href = api.homeUrl;
    /* Leaving for the site takes the cached member list with it. sessionStorage
       belongs to the TAB and not to this page, so a cache left behind here
       would outlive the admin and sit in the same store the site is now using,
       with nothing left running to clear it: the gate's wipe timer dies with
       the page that set it. Sign out already goes through lock(), which clears
       it; this is the other way out of the console that the page itself
       offers. What is left after both is a tab the admin navigated away from
       by hand, which is bounded by closing it. */
    home.addEventListener('click', () => api.cache?.clear());
  }

  root.querySelector('[data-admin-signout]')?.addEventListener('click', () => {
    api.lock('Signed out.');
  });

  const form = root.querySelector('[data-admin-search]');
  const input = root.querySelector('[data-admin-query]');
  const go = root.querySelector('[data-admin-go]');
  const list = root.querySelector('[data-admin-results]');
  const status = root.querySelector('[data-admin-console-status]');
  const template = root.querySelector('[data-admin-row]');
  const ghost = root.querySelector('[data-admin-skeleton]');
  const filters = root.querySelector('[data-admin-filter]');
  const pager = root.querySelector('[data-admin-pager]');
  const numbers = root.querySelector('[data-admin-pager-numbers]');
  if (!form || !input || !list || !template) return () => {};

  const PAGE = api.members.pageSize || 50;

  /* Enough placeholder rows to fill a screen and no more. Fifty would match a
     full page exactly and would also be six hundred nodes built and thrown
     away for something that is on screen for under a second. */
  const GHOSTS = 8;

  /* THE CEILING ON WHAT ONE CLICK CAN COST, in pages. A jump ahead of the
     furthest page walked has to read the ground it steps over, because
     Firestore bills skipped rows whether you walk them or window them, so
     without a cap the price of a single click grows with the collection: at
     five thousand members, "last page" would be one query for five thousand
     reads, which is a tenth of the free daily allowance spent on one
     mis-click. Capped, no click can ever cost more than this many pages.

     Landing short is already handled and needs no extra code: the query
     returns what it reached, `chunk` reports which page that was, and the
     pager repaints there, so a further target simply takes a second click
     that is now cheap because the first one cached every cursor it crossed.
     At the five hundred members this is built for the cap never engages,
     since the whole collection is nine pages. */
  const MAX_SPAN = 10;

  /* A YEAR, since v0.5.6 (user call, replacing the month this shipped with).
     The arithmetic underneath still counts in calendar months and this hands
     it twelve of them, which is what makes a leap year land on the right date
     rather than a day early: addMonths() moves the month and keeps the day, so
     29 February plus twelve months resolves to 28 February, not 1 March. */
  const YEAR = 12;

  /* ------------------------------------------------------------------
     THE CACHE (v0.5.7, user brief: fewer reads, with a version so an
     updated page comes back from Firebase rather than being trusted).

     THE ONE IDEA. Every page this console shows is fifty document reads,
     and until now it paid them again for every page turn, every filter
     change and every reload, so an admin looking through the membership
     could spend several hundred reads to look at the same rows twice.
     The rows are now kept (src/admin.js owns the storage and says why it
     is sessionStorage), and ONE read of the revision marker vouches for
     all of them at once: a page served from the cache costs nothing, and
     the marker itself is asked for at most twice a minute.

     WHY A MARKER RATHER THAN A TIMER. A timer can only trade freshness
     for reads: however short it is, there is a window where this screen
     is confidently wrong, and however long it is, most of the reads are
     still paid for nothing. The marker changes when, and only when, a
     member record does, so the cache is exact rather than probable, and
     a quiet afternoon costs one read no matter how much browsing happens
     in it. Any write bumps it: this console's own (src/admin.js folds
     the bump into setExpiry and remove so one can never ship without it)
     and the account page's, so a member registering shows up here too.

     WHAT A LOCAL WRITE DOES, and it is the part worth reading twice. The
     tab that made a write already knows the new value of the row, so
     throwing the whole cache away would be paying to be told something
     it just said. It adopts the marker it caused instead and corrects
     the one row in place. That is only sound because of what the
     orderings are: the All view orders by NAME, so moving an expiry
     cannot move a member within it and cannot change how many there are,
     while Subscribed and Unsubscribed order by the very field that
     changed, so the row can have moved page or left the view outright
     and those are dropped. A delete drops everything, because removing a
     row moves every page boundary behind it.

     WHAT IS DELIBERATELY NOT CACHED: the cursors. A Firestore cursor is
     a document snapshot and does not survive being written to storage,
     and the value based form needs a tiebreak on the document id to be
     exact, which a duplicate name would otherwise silently skip past.
     Losing a member out of a listing is the one failure nobody notices
     (§ no silent caps), so it is not a trade worth making for a saving
     that is already there: a page whose rows are cached is served
     without a cursor at all, and a page that has never been visited
     costs exactly what it costs today. The cache is upside on a revisit
     and neutral on a first visit, never a regression.
     ------------------------------------------------------------------ */

  /* How long a confirmed marker is trusted before it is re-read. Half a
     minute keeps a page turn at one read instead of fifty while keeping this
     screen honest about a change made somewhere else. */
  const REV_TTL_MS = 30000;

  /* How long an entry may be served when the marker cannot be READ at all,
     which is the state on the day this deploys, before the new rules are
     published. Nothing can be vouched for then, so the cache falls back to
     being merely recent, and one minute is short enough that the only writer
     who could have gone unnoticed is one on another machine. */
  const BLIND_TTL_MS = 60000;

  /* A filtered view's rows were selected against ONE instant pinned when the
     view was built, so its pages cannot be reused forever: a membership that
     lapsed since would still be sitting in Subscribed. The row itself would
     read correctly (paint() asks the live clock, not the pinned one), so this
     bounds a wrong BUCKET rather than a wrong date. The All view does not
     range over the clock at all and is not bound by this. */
  const VIEW_TTL_MS = 900000;

  const CACHE_PAGES = 12; // per view, oldest dropped first
  const CACHE_SEARCHES = 8;

  const blank = () => ({ rev: null, views: {}, searches: {} });

  let cache = api.cache?.read() || null;
  if (cache && !(cache.views && cache.searches)) cache = null; // an older shape
  let revAt = 0; // when cache.rev was last confirmed against the server
  let confirmed = false; // the last check reached the marker at all

  const saveCache = () => {
    if (cache) api.cache?.write(cache);
    else api.cache?.clear();
  };

  const dropCache = (rev) => {
    cache = blank();
    cache.rev = rev ?? null;
    saveCache();
  };

  /* An entry may be served if the marker vouches for it, or, when the marker
     could not be reached, if it is merely recent. */
  const usable = (entry) => !!entry && (confirmed || Date.now() - entry.at < BLIND_TTL_MS);

  /* Leaves `cache` safe to WRITE into either way, so a miss still fills it.
     The boolean is only about whether it may be READ from. */
  const vouch = async () => {
    if (Date.now() - revAt < REV_TTL_MS) return !!cache;
    let current = null;
    try {
      current = await api.members.revision();
    } catch {
      current = null;
    }
    revAt = Date.now();
    if (current === null) {
      // unreadable: keep what is held, but every entry now ages out fast
      confirmed = false;
      if (!cache) cache = blank();
      return true;
    }
    confirmed = true;
    if (!cache || cache.rev !== current) {
      dropCache(current);
      return false;
    }
    return true;
  };

  const cachedPage = (want, now, page) => {
    const store = cache?.views?.[want];
    if (!store || typeof store.total !== 'number' || !usable(store)) return null;
    if (want !== 'all' && (store.now !== now || Date.now() - store.now > VIEW_TTL_MS)) return null;
    const entry = store.pages?.[page];
    if (!usable(entry)) return null;
    return { total: store.total, rows: entry.rows };
  };

  const trim = (bag, max) => {
    const keys = Object.keys(bag);
    if (keys.length <= max) return;
    keys
      .sort((a, b) => bag[a].at - bag[b].at)
      .slice(0, keys.length - max)
      .forEach((key) => delete bag[key]);
  };

  const keepPage = (want, now, page, total, found) => {
    if (!cache) return;
    const at = Date.now();
    /* The All view is merged across pinned instants because it does not use
       one; a filtered view starts over whenever its instant does, since its
       old pages were cut from a different question. */
    const store =
      cache.views[want] && (want === 'all' || cache.views[want].now === now)
        ? cache.views[want]
        : { now, pages: {} };
    store.now = now;
    store.total = total;
    store.at = at;
    store.pages[page] = { at, rows: found };
    trim(store.pages, CACHE_PAGES);
    cache.views[want] = store;
    saveCache();
  };

  const keepSearch = (term, found, capped) => {
    if (!cache) return;
    cache.searches[term] = { at: Date.now(), rows: found, capped };
    trim(cache.searches, CACHE_SEARCHES);
    saveCache();
  };

  /* One row changed and its new value is already known here, so every copy of
     it the cache holds is corrected rather than thrown away. */
  const patch = (uid, expiresAt) => {
    const fix = (list) => {
      const found = list?.find((record) => record.uid === uid);
      if (found) found.expiresAt = expiresAt;
    };
    Object.values(cache?.views?.all?.pages || {}).forEach((entry) => fix(entry.rows));
    Object.values(cache?.searches || {}).forEach((entry) => fix(entry.rows));
  };

  /* `expiresAt` null means the member was deleted. */
  const afterWrite = (rev, uid, expiresAt) => {
    if (!rev) {
      /* The bump did not land, so this tab can no longer tell anyone else's
         writes from its own and has nothing worth keeping. */
      dropCache(null);
      revAt = 0;
      confirmed = false;
      return;
    }
    if (!cache) cache = blank();
    cache.rev = rev;
    revAt = Date.now();
    confirmed = true;
    if (expiresAt === null) {
      cache.views = {};
      cache.searches = {};
    } else {
      delete cache.views.live;
      delete cache.views.off;
      patch(uid, expiresAt);
    }
    saveCache();
  };

  /* uid to { record, el, busy }. The map is what lets a click on any button
     find the row it belongs to without the DOM carrying the record itself. */
  const rows = new Map();
  let busy = false;
  let filter = 'all';
  let mode = 'browse';

  /* The browse state, rebuilt whenever the filter changes because the filter
     is part of the query its cursors were cut from. `now` is pinned when the
     view is built and reused by its count and by every one of its pages, so
     the two can never answer different questions: without it a membership
     lapsing mid session would quietly shuffle rows between pages under the
     admin's fingers. */
  let view = null;

  /* The raw, UNFILTERED search results, kept so that changing the filter while
     a search is on screen costs nothing at all. */
  let searchRows = [];
  let searchCapped = false;

  /* Two quick clicks on two page numbers race, and the slower answer must not
     land on top of the faster one. Every load takes a ticket and checks it
     before it paints anything. */
  let seq = 0;

  /* The status line is a popup at the top of the page that takes itself away
     again (v0.5.8, user call). It used to be a paragraph sitting above the
     rows, which meant "A year came off Mohammad Tabbara." stayed on screen
     until the next action replaced it, reading as a state of the page rather
     than as the receipt for a button press.

     WHAT MUST NOT BECOME A TOAST IS PROGRESS. "Loading members." and
     "Searching." describe something still happening, so a timer that cleared
     them would claim the work had finished; they pass `sticky` and stay until
     the answer replaces them. Everything else is a result and goes.

     `hidden` rather than a class, because base.css makes that a hard
     display:none and auth.css keys the entrance animation to display, so each
     new message replays it from zero with nothing to reset (the v0.4.4
     pattern, which is why neither page has class plumbing for its motion). */
  let statusTimer = 0;
  const STATUS_MS = 4000;

  const setStatus = (message, tone = '', sticky = false) => {
    if (!status) return;
    window.clearTimeout(statusTimer);
    statusTimer = 0;
    status.textContent = message || '';
    status.dataset.tone = message ? tone : '';
    status.hidden = !message;
    if (!message || sticky) return;
    statusTimer = window.setTimeout(() => {
      status.hidden = true;
      status.textContent = '';
      status.dataset.tone = '';
    }, STATUS_MS);
  };

  const setBusy = (value) => {
    busy = value;
    input.disabled = value;
    if (go) go.disabled = value;
    filters?.querySelectorAll('button').forEach((button) => {
      button.disabled = value;
    });
    pager?.querySelectorAll('button').forEach((button) => {
      button.disabled = value;
    });
  };

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* --- one row ---------------------------------------------------------- */

  const paint = (entry) => {
    const { record, el } = entry;
    el.querySelector('[data-row-name]').textContent = record.name || 'No name on file';
    el.querySelector('[data-row-email]').textContent = record.email || '';

    const state = el.querySelector('[data-row-state]');
    const live = api.membership.isActive(record.expiresAt);
    state.textContent = live
      ? `${api.membership.formatLeft(record.expiresAt)} · until ${api.membership.formatDate(record.expiresAt)}`
      : record.expiresAt
        ? `Expired on ${api.membership.formatDate(record.expiresAt)}`
        : 'Not subscribed';
    state.dataset.tone = live ? 'ok' : 'off';
  };

  const setRowBusy = (entry, value) => {
    entry.busy = value;
    entry.el.classList.toggle('is-busy', value);
    entry.el.querySelectorAll('button').forEach((button) => {
      button.disabled = value;
    });
  };

  const askDelete = (entry, asking) => {
    entry.el.querySelector('[data-row-actions]').hidden = asking;
    entry.el.querySelector('[data-row-confirm]').hidden = !asking;
    if (asking) entry.el.querySelector('[data-act="cancel"]')?.focus({ preventScroll: true });
  };

  /* --- the two writes --------------------------------------------------- */

  const shift = async (entry, months) => {
    if (entry.busy) return;
    setRowBusy(entry, true);
    const name = entry.record.name || 'That member';
    /* Computed from the row's own current value, so consecutive presses
       compound. api.membership.extend is what decides where the time is added
       FROM: now for a lapsed member, their existing expiry for a live one. */
    const next = api.membership.extend(entry.record.expiresAt, months);
    try {
      const rev = await api.members.setExpiry(entry.record.uid, next);
      entry.record = { ...entry.record, expiresAt: next };
      paint(entry);
      afterWrite(rev, entry.record.uid, next);
      /* THE ROW STAYS PUT even when this has just moved it out of the filter
         being looked at, and that is deliberate: the admin pressed the button
         to see what it did, and a row that vanishes on being subscribed hides
         its own result.

         The All view counts MEMBERS and this moved nobody in or out of the
         collection, so its total still stands and re-asking for it would be a
         read spent to be told the same number. The filtered views count by the
         field that just changed, so theirs does not: the next page turn
         re-asks and the pager corrects itself. */
      if (view && filter !== 'all') view.counted = false;
      setStatus(
        months > 0
          ? `${name} now has ${plural(api.membership.daysLeft(next), 'day', 'days')}.`
          : `A year came off ${name}.`,
        'ok',
      );
    } catch (error) {
      // the row is untouched on screen, which is correct: the write failed
      setStatus('That change did not save. Check the connection and try again.', 'error');
      if (error) console.warn('Member write failed', error.code || error);
    } finally {
      setRowBusy(entry, false);
    }
  };

  const remove = async (entry) => {
    if (entry.busy) return;
    setRowBusy(entry, true);
    const name = entry.record.name || 'That member';
    try {
      const rev = await api.members.remove(entry.record.uid);
      rows.delete(entry.record.uid);
      entry.el.remove();
      /* Nothing cached survives a delete: every page boundary behind the row
         moves up by one and every count is one out. */
      afterWrite(rev, entry.record.uid, null);
      if (view) {
        /* Corrected locally so the pager is right immediately, and `counted`
           dropped anyway so the next page turn confirms it from the server
           rather than trusting this arithmetic indefinitely. */
        view.total = Math.max(0, view.total - 1);
        view.counted = false;
        paintPager();
      }
      setStatus(`${name} was deleted.`, 'ok');
    } catch (error) {
      setRowBusy(entry, false);
      askDelete(entry, false);
      setStatus('That record was not deleted. Check the connection and try again.', 'error');
      if (error) console.warn('Member delete failed', error.code || error);
    }
  };

  /* One delegated listener for every button in every row, which is what keeps
     rendering a result free of listener bookkeeping and makes a removed row
     leave nothing behind. */
  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const entry = rows.get(button.closest('.admin-row')?.dataset.uid);
    if (!entry || entry.busy) return;
    const act = button.dataset.act;
    if (act === 'ask') askDelete(entry, true);
    else if (act === 'cancel') askDelete(entry, false);
    else if (act === 'delete') remove(entry);
    else shift(entry, act === 'add' ? YEAR : -YEAR);
  });

  /* --- painting a list -------------------------------------------------- */

  const render = (found) => {
    rows.clear();
    const frame = document.createDocumentFragment();
    for (const record of found) {
      const el = template.content.firstElementChild.cloneNode(true);
      el.dataset.uid = record.uid;
      const entry = { record, el, busy: false };
      paint(entry);
      rows.set(record.uid, entry);
      frame.appendChild(el);
    }
    list.replaceChildren(frame);
  };

  /* Placeholder rows, which exist for one reason: this list is now the whole
     page, so without them the console is a heading over nothing for as long as
     the round trip takes, and empty reads as broken rather than as loading.
     They are the real row's own skeleton, same grid and same padding, so the
     swap is a fill rather than a jolt. */
  const showGhosts = () => {
    if (!ghost) return;
    rows.clear();
    const frame = document.createDocumentFragment();
    for (let i = 0; i < GHOSTS; i += 1) {
      const el = ghost.content.firstElementChild.cloneNode(true);
      el.style.setProperty('--i', String(i));
      frame.appendChild(el);
    }
    list.replaceChildren(frame);
  };

  /* --- the pager -------------------------------------------------------- */

  /* EVERY PAGE IS A BUTTON UNTIL THERE ARE MORE THAN TEN OF THEM, and that
     threshold is the point of this function rather than a tidy default. Ten
     pages is five hundred members, which is the size this admin is actually
     being built for, so in practice the pager shows the lot and any page is
     one click. Windowing early is what makes a pager annoying: first, last and
     the current page with one neighbour was the first cut here, and on nine
     pages it left page five reachable only by walking to it, which is worse
     than the Next button it was meant to improve on.

     Past ten it has to window, and it keeps a run of five around the current
     page plus the two ends, so the reachable set is always wide enough to aim
     with. Beyond that the honest answer is the search field, not a longer row
     of numbers. */
  const pageList = (current, count) => {
    if (count <= 10) return Array.from({ length: count }, (_, i) => i);
    const wanted = [0, current - 2, current - 1, current, current + 1, current + 2, count - 1]
      .filter((n) => n >= 0 && n < count)
      .sort((a, b) => a - b);
    const out = [];
    let last = -1;
    for (const n of wanted) {
      if (n === last) continue;
      if (last >= 0 && n - last > 1) out.push('gap');
      out.push(n);
      last = n;
    }
    return out;
  };

  const pageCount = () => Math.max(1, Math.ceil((view?.total || 0) / PAGE));

  function paintPager() {
    if (!pager || !numbers) return;
    const pages = pageCount();
    /* Hidden outright on a search (there are no pages to turn) and on a single
       page (a pager with one button in it is furniture). base.css makes
       [hidden] a hard display:none, which this element needs since it declares
       display:flex. The v0.4.3 lesson, still paying for itself. */
    pager.hidden = mode !== 'browse' || !view || pages <= 1;
    if (pager.hidden) return;

    const prev = pager.querySelector('[data-page="prev"]');
    const next = pager.querySelector('[data-page="next"]');
    if (prev) prev.disabled = busy || view.page <= 0;
    if (next) next.disabled = busy || view.page >= pages - 1;

    const frame = document.createDocumentFragment();
    for (const slot of pageList(view.page, pages)) {
      if (slot === 'gap') {
        const gap = document.createElement('span');
        gap.className = 'admin-pager__gap';
        gap.textContent = '…';
        frame.appendChild(gap);
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-pager__num';
      button.dataset.page = String(slot);
      button.textContent = String(slot + 1);
      button.disabled = busy;
      if (slot === view.page) {
        /* Marked, not disabled. A disabled button leaves the tab order, so
           keyboard focus would fall through the page you are standing on. The
           click handler ignores it instead, which costs nothing. */
        button.setAttribute('aria-current', 'page');
        button.classList.add('is-current');
      }
      frame.appendChild(button);
    }
    numbers.replaceChildren(frame);
  }

  /* --- browsing --------------------------------------------------------- */

  const emptyLine = () =>
    filter === 'live'
      ? 'No member has a running subscription right now.'
      : filter === 'off'
        ? 'Every member has a running subscription.'
        : 'No members yet. Somebody appears here once they have signed in at least once.';

  /* A filtered view adopts the instant its cached pages were cut at, so a page
     restored from storage and a page fetched later in the same view are
     answers to the same question rather than two. Past the view TTL it takes a
     fresh instant, which is what retires the old pages. The All view does not
     range over the clock, so it simply takes now. */
  const newView = (want) => {
    const store = cache?.views?.[want];
    const now =
      want !== 'all' && store && Date.now() - store.now <= VIEW_TTL_MS ? store.now : Date.now();
    return { now, cursors: [null], page: 0, total: 0, counted: false };
  };

  const settle = (target, total, found) => {
    view.total = total;
    view.counted = true;
    view.page = target;
    render(found);
    paintPager();
    setStatus(
      found.length
        ? `${plural(total, 'member', 'members')} · page ${view.page + 1} of ${pageCount()}.`
        : emptyLine(),
      found.length ? 'ok' : '',
    );
  };

  const loadPage = async (target) => {
    if (!view) view = newView(filter);
    const token = ++seq;
    mode = 'browse';
    setBusy(true);
    paintPager();

    /* The fast path: the marker was confirmed moments ago, so this page can be
       answered with no round trip at all and no placeholder rows in between.
       Turning pages inside half a minute costs literally nothing. */
    if (Date.now() - revAt < REV_TTL_MS) {
      const held = cachedPage(filter, view.now, target);
      if (held) {
        settle(target, held.total, held.rows);
        setBusy(false);
        paintPager();
        return;
      }
    }

    showGhosts();
    setStatus('Loading members.', '', true);

    /* One read, and it either vouches for every page in the cache or empties
       it. Either way the fetch below is skipped whenever the answer is
       already here, which is what turns fifty reads into one. */
    const held = (await vouch()) ? cachedPage(filter, view.now, target) : null;
    if (token !== seq) return;
    if (held) {
      settle(target, held.total, held.rows);
      setBusy(false);
      paintPager();
      return;
    }

    /* The nearest cursor at or before the page asked for. Next, previous and
       anything already visited are all exact: span 1, fifty rows read, fifty
       rows shown. Only a jump ahead of the furthest page walked has a span
       above 1, and it pays for the rows it steps over exactly once, because
       the marks that come back fill in every cursor behind it. */
    const from = Math.max(0, Math.min(target, view.cursors.length - 1));
    const span = Math.min(MAX_SPAN, Math.max(1, target - from + 1));

    try {
      /* Fired together rather than in sequence, so on the one load that does
         need a count it costs a read and no waiting at all.

         The count is asked ONCE per view and then held, because turning a page
         cannot change how many members match and re-asking would be a read
         spent to be told the same number. `counted` is dropped back to false
         by the two things that CAN change it, a year added or taken off (which
         can move somebody between Subscribed and Unsubscribed) and a delete,
         so the next page turn re-asks and the pager corrects itself without a
         refresh button ever needing to exist. */
      const [total, result] = await Promise.all([
        view.counted ? Promise.resolve(view.total) : api.members.count(filter, view.now),
        api.members.page(filter, view.now, view.cursors[from], span),
      ]);
      if (token !== seq) return;

      result.marks.forEach((mark, i) => {
        view.cursors[from + i + 1] = mark;
      });
      settle(from + result.chunk, total, result.rows);
      keepPage(filter, view.now, view.page, total, result.rows);
    } catch (error) {
      if (token !== seq) return;
      render([]);
      view = null;
      paintPager();
      setStatus('The member list did not load. Check the connection and try again.', 'error');
      if (error) console.warn('Member browse failed', error.code || error);
    } finally {
      if (token === seq) {
        setBusy(false);
        paintPager();
      }
    }
  };

  pager?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-page]');
    if (!button || busy || !view) return;
    const where = button.dataset.page;
    const pages = pageCount();
    const target =
      where === 'prev' ? view.page - 1 : where === 'next' ? view.page + 1 : Number(where);
    if (!Number.isInteger(target) || target < 0 || target >= pages || target === view.page) return;
    loadPage(target);
  });

  /* --- searching -------------------------------------------------------- */

  /* THE FILTER REACHES SEARCH RESULTS BY A DIFFERENT ROUTE, and the reason is
     the index, not laziness. Browsing filters inside the query, because there
     it can order by the same field it ranges over, which needs only a single
     field index and so returns full pages with nothing to set up. A search
     cannot do that: it is already an array-contains on the name index or a
     range on email, and pairing either with a range on expiresAt is a
     composite index, which is exactly the console step this whole feature is
     built to avoid. A search returns at most fifty rows and they are already
     in memory, so narrowing them here is free, instant, and costs no read at
     all when the filter is changed with results on screen. */
  const filterOf = (found) => {
    if (filter === 'all') return found;
    const live = filter === 'live';
    return found.filter((record) => api.membership.isActive(record.expiresAt) === live);
  };

  const paintSearch = () => {
    const shown = filterOf(searchRows);
    render(shown);
    paintPager();
    if (!searchRows.length) {
      setStatus(
        'Nobody matches that. A member appears here once they have signed in at least once.',
      );
    } else if (!shown.length) {
      setStatus(
        filter === 'live'
          ? 'Matches found, but none of them has a running subscription.'
          : 'Matches found, and every one of them has a running subscription.',
      );
    } else if (searchCapped) {
      /* Said out loud rather than silently trimmed: a search that hides
         someone is the one failure nobody would notice. */
      setStatus(
        `Showing ${plural(shown.length, 'member', 'members')}. There may be more, so narrow the search.`,
        'ok',
      );
    } else {
      setStatus(`${plural(shown.length, 'member', 'members')} found.`, 'ok');
    }
  };

  const runSearch = async (term) => {
    const token = ++seq;
    /* Cached under the typed term rather than the query key membership.js
       derives from it, because two terms sharing a first word are narrowed
       differently and would answer for each other. */
    const key = term.toLowerCase();
    mode = 'search';
    setBusy(true);
    paintPager();

    /* Looking the same person up twice is the shape of this screen's use: find
       them, subscribe them, look again to check. The second look is free. */
    if (Date.now() - revAt < REV_TTL_MS) {
      const held = cache?.searches?.[key];
      if (usable(held)) {
        searchRows = held.rows;
        searchCapped = held.capped;
        paintSearch();
        setBusy(false);
        return;
      }
    }

    showGhosts();
    setStatus('Searching.', '', true);
    try {
      const vouched = await vouch();
      if (token !== seq) return;
      const held = vouched ? cache?.searches?.[key] : null;
      let found;
      let capped;
      if (usable(held)) {
        ({ rows: found, capped } = held);
      } else {
        ({ rows: found, capped } = await api.members.search(term));
        if (token !== seq) return;
        keepSearch(key, found, capped);
      }
      searchRows = found;
      searchCapped = capped;
      paintSearch();
    } catch (error) {
      if (token !== seq) return;
      searchRows = [];
      searchCapped = false;
      render([]);
      setStatus('The search failed. Check the connection and try again.', 'error');
      if (error) console.warn('Member search failed', error.code || error);
    } finally {
      if (token === seq) setBusy(false);
    }
  };

  function backToBrowse() {
    searchRows = [];
    searchCapped = false;
    /* A fresh view, so the pinned instant is current again after however long
       the search was on screen. newView() decides whether that means a new
       instant or the one the cached pages were cut at. */
    view = null;
    loadPage(0);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (busy) return;
    const term = input.value.trim();
    /* An empty search goes back to the full list rather than scolding, which
       is the only sensible answer now that there IS a full list to go back
       to. It is also where the field's own native clear cross lands. */
    if (!term) return backToBrowse();
    runSearch(term);
  });

  /* type="search" fires this when the browser's own clear cross is pressed,
     which a submit listener never sees. */
  input.addEventListener('search', () => {
    if (!busy && !input.value.trim() && mode === 'search') backToBrowse();
  });

  /* --- the filter ------------------------------------------------------- */

  filters?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button || busy) return;
    const next = button.dataset.filter;
    if (next === filter) return;
    filter = next;
    filters.querySelectorAll('[data-filter]').forEach((option) => {
      option.setAttribute('aria-pressed', String(option.dataset.filter === filter));
    });
    /* Search results are already in memory, so this is a repaint and not a
       query. Browsing has to start a new view, since the filter is part of the
       query the cursors were cut from and they mean nothing under another. */
    if (mode === 'search') paintSearch();
    else {
      view = null;
      loadPage(0);
    }
  });

  /* --- waiting on the sign in ------------------------------------------- */

  /* The dashboard is already open at this point (src/admin.js does not await
     the connection), so this is the only thing that has to wait. The
     placeholder rows go up first and stay up through the sign in AND through
     the first page load behind it, so the wait reads as one thing arriving
     rather than two.

     Failure here is an OPERATOR problem, not a wrong password: the payload has
     already decrypted, so the password was right and what went wrong is the
     Firebase account or the rules. The message says so rather than blaming the
     typing. */
  setBusy(true);
  showGhosts();
  setStatus('Loading members.', '', true);
  api.members
    .ready()
    .then(() => {
      loadPage(0);
      input.focus({ preventScroll: true });
    })
    .catch((error) => {
      /* Deliberately says nothing about what is behind this page (user
         instruction, v0.4.9: nothing about the backend belongs in the site,
         and "the site" includes the screens only the admin ever sees). The
         diagnosis an operator would actually need goes to the console
         instead, which is a devtools panel and not a page. */
      render([]);
      setBusy(false);
      setStatus('Could not reach the members list. Try again in a moment.', 'error');
      if (error) console.warn('Members connection failed', error.code || error);
    });

  return () => {};
}
