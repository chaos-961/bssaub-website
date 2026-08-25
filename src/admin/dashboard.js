/* Encrypted admin dashboard code (v0.5.6).

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
  if (home) home.href = api.homeUrl;

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

  const setStatus = (message, tone = '') => {
    if (!status) return;
    status.textContent = message || '';
    status.dataset.tone = message ? tone : '';
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
      await api.members.setExpiry(entry.record.uid, next);
      entry.record = { ...entry.record, expiresAt: next };
      paint(entry);
      /* THE ROW STAYS PUT even when this has just moved it out of the filter
         being looked at, and that is deliberate: the admin pressed the button
         to see what it did, and a row that vanishes on being subscribed hides
         its own result. Dropping `counted` is the whole correction needed:
         the page it sits on is unchanged, only the total can have moved, and
         the next page turn re-asks for it. */
      if (view) view.counted = false;
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
      await api.members.remove(entry.record.uid);
      rows.delete(entry.record.uid);
      entry.el.remove();
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

  const loadPage = async (target) => {
    if (!view) view = { now: Date.now(), cursors: [null], page: 0, total: 0, counted: false };
    const token = ++seq;
    mode = 'browse';
    setBusy(true);
    paintPager();
    showGhosts();
    setStatus('Loading members.');

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
      view.total = total;
      view.counted = true;
      view.page = from + result.chunk;

      render(result.rows);
      paintPager();
      setStatus(
        result.rows.length
          ? `${plural(total, 'member', 'members')} · page ${view.page + 1} of ${pageCount()}.`
          : emptyLine(),
        result.rows.length ? 'ok' : '',
      );
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
    mode = 'search';
    setBusy(true);
    paintPager();
    showGhosts();
    setStatus('Searching.');
    try {
      const { rows: found, capped } = await api.members.search(term);
      if (token !== seq) return;
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
    /* A fresh view, so the pinned instant and the count are both current again
       after however long the search was on screen. */
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
  setStatus('Loading members.');
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
