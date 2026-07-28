/* Encrypted admin dashboard code (v0.4.8).

   Like its markup, this file is never served. It is encrypted into
   public/admin-payload.json and reaches the browser only as an AES-GCM
   ciphertext that the admin password decrypts. src/admin.js turns the
   decrypted text into a module and calls the default export below.

   IT IS A PLAIN MODULE WITH NO IMPORTS, AND IT HAS TO STAY THAT WAY.
   It is loaded from a blob URL at runtime, long after Rollup has finished,
   so there is no bundler to resolve a bare specifier like 'gsap' and no
   import map to fall back on. Anything this needs arrives through the `api`
   argument. That is a real constraint on what belongs here, and it is also
   why the api object is the seam to widen when the admin grows — which
   v0.4.8 is the first version to actually do. `api.membership` is the date
   arithmetic (src/data/membership.js, shared with the account page so both
   screens agree on what "days left" means) and `api.members` is the
   database, every call chaining off a sign in that may still be in flight.

   EVERY STRING FROM A MEMBER IS WRITTEN WITH textContent, into a node the
   <template> already declared. Names and email addresses here are whatever
   someone typed into a public registration form, which makes them the one
   genuinely hostile input on this page. There is no innerHTML in this file
   and no string concatenated into markup.

   THE ROW IS THE SOURCE OF TRUTH BETWEEN CLICKS. Each result keeps its own
   record and updates it locally after a write, so pressing "Add 1 month"
   four times adds four months rather than four copies of the first answer,
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
  if (!form || !input || !list || !template) return () => {};

  /* uid to { record, el, busy }. The map is what lets a click on any button
     find the row it belongs to without the DOM carrying the record itself. */
  const rows = new Map();
  let busy = false;

  const setStatus = (message, tone = '') => {
    if (!status) return;
    status.textContent = message || '';
    status.dataset.tone = message ? tone : '';
  };

  const setBusy = (value) => {
    busy = value;
    input.disabled = value;
    if (go) go.disabled = value;
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
       compound. api.membership.extend is what decides where a month is added
       FROM: now for a lapsed member, their existing expiry for a live one. */
    const next = api.membership.extend(entry.record.expiresAt, months);
    try {
      await api.members.setExpiry(entry.record.uid, next);
      entry.record = { ...entry.record, expiresAt: next };
      paint(entry);
      setStatus(
        months > 0
          ? `${name} now has ${plural(api.membership.daysLeft(next), 'day', 'days')}.`
          : `A month came off ${name}.`,
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
    else shift(entry, act === 'add' ? 1 : -1);
  });

  /* --- searching -------------------------------------------------------- */

  const render = (found) => {
    rows.clear();
    list.replaceChildren();
    const frame = document.createDocumentFragment();
    for (const record of found) {
      const el = template.content.firstElementChild.cloneNode(true);
      el.dataset.uid = record.uid;
      const entry = { record, el, busy: false };
      paint(entry);
      rows.set(record.uid, entry);
      frame.appendChild(el);
    }
    list.appendChild(frame);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const term = input.value.trim();
    if (!term) {
      setStatus('Type a name or an email address first.', 'error');
      input.focus({ preventScroll: true });
      return;
    }

    setBusy(true);
    setStatus('Searching.');
    try {
      const { rows: found, capped } = await api.members.search(term);
      render(found);
      if (!found.length) {
        setStatus('Nobody matches that. A member appears here once they have signed in at least once.');
      } else if (capped) {
        /* Said out loud rather than silently trimmed: a search that hides
           someone is the one failure nobody would notice. */
        setStatus(`Showing ${plural(found.length, 'member', 'members')}. There may be more, so narrow the search.`, 'ok');
      } else {
        setStatus(`${plural(found.length, 'member', 'members')} found.`, 'ok');
      }
    } catch (error) {
      render([]);
      setStatus('The search failed. Check the connection and try again.', 'error');
      if (error) console.warn('Member search failed', error.code || error);
    } finally {
      setBusy(false);
    }
  });

  /* --- waiting on the sign in ------------------------------------------- */

  /* The dashboard is already open at this point (src/admin.js does not await
     the connection), so this is the only thing that has to wait. Failure here
     is an OPERATOR problem, not a wrong password: the payload has already
     decrypted, so the password was right and what went wrong is the Firebase
     account or the rules. The message says so rather than blaming the typing. */
  setBusy(true);
  setStatus('Connecting.');
  api.members
    .ready()
    .then(() => {
      setBusy(false);
      setStatus('');
      input.focus({ preventScroll: true });
    })
    .catch((error) => {
      /* Deliberately says nothing about what is behind this page (user
         instruction, v0.4.9: nothing about the backend belongs in the site,
         and "the site" includes the screens only the admin ever sees). The
         diagnosis an operator would actually need goes to the console
         instead, which is a devtools panel and not a page. */
      setStatus('Could not reach the members list. Try again in a moment.', 'error');
      if (error) console.warn('Members connection failed', error.code || error);
    });

  return () => {};
}
