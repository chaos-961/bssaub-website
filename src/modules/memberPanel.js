/* ------------------------------------------------------------------
   The membership half of the account page (v0.4.8, user brief: when a
   member is signed in, show the card with their name on it if the admin
   has subscribed them, and hide it the moment there is literally nothing
   left on the subscription).

   THE GATE IS THE MILLISECOND, NOT THE DAY, and that is the user's own
   line. isActive() is a strict `expiresAt > now`, so a membership with
   forty seconds on it still shows the card and the same membership one
   tick later does not. A timer re-reads the clock so the flip happens on
   an open page rather than waiting for a reload: it wakes at whichever is
   sooner, a minute from now or the exact instant of expiry, so the count
   is never more than a minute stale and the last wake lands ON the
   expiry rather than after it.

   VISIBILITYCHANGE IS PART OF THAT, not a nicety. A background tab has
   its timers coarsened and can have them held entirely, so a tab left
   open across an expiry would come back still showing the card. Re-
   checking on the way back in costs one comparison and closes it.

   WHY THE NAME IS AN SVG OVER THE ARTWORK, same as the hero card
   (cardName.js, which has the full write up): the card face is one baked
   663x473 raster and the NAME blank sits at fixed IMAGE pixels, so a
   viewBox of exactly those pixels makes the alignment a construction
   rather than a per breakpoint tuning job. This one differs from the hero
   in two ways only. It is at inset 0, because this card carries no
   border. And it FITS the text, because the hero prints first names off a
   list whose widest member uses 47% of the rule while this prints whatever
   a real person typed at registration, and a name that overruns the rule
   is the one way this could look broken.
   ------------------------------------------------------------------ */
import { formatDate, formatLeft, isActive, msLeft } from '../data/membership.js';

/* Image space, measured off card-front.webp — see cardName.js. */
const NAME_SIZE = 19.5; // cap height 14.04, matching the printed NAME label
const NAME_MIN = 12; // below this the print stops reading as the card's own
const NAME_W = 190; // the rule runs x 263..461; leave a hair at each end

const TICK_MS = 60000;

export function initMemberPanel(root) {
  const wrap = root.querySelector('[data-member]');
  if (!wrap) return null;

  const card = wrap.querySelector('[data-member-card]');
  const cardName = wrap.querySelector('[data-member-cardname]');
  const state = wrap.querySelector('[data-member-state]');
  const note = wrap.querySelector('[data-member-note]');
  const join = root.querySelector('[data-member-join]');

  let record = null;
  let timer = 0;

  const setState = (text, tone = '') => {
    if (!state) return;
    state.textContent = text || '';
    state.dataset.tone = tone;
  };

  const setNote = (text) => {
    if (note) note.textContent = text || '';
  };

  /* Shrink to fit, then squeeze as a last resort. SVG text width is linear in
     font size, so one measurement gives the exact size that fits and the
     second check only ever fires at the NAME_MIN floor, where textLength takes
     over. getComputedTextLength needs the element RENDERED, which is why every
     caller unhides the card before this runs. */
  const fitName = (value) => {
    if (!cardName) return;
    cardName.textContent = value;
    cardName.removeAttribute('textLength');
    cardName.removeAttribute('lengthAdjust');
    cardName.setAttribute('font-size', String(NAME_SIZE));
    if (!value) return;
    let width = cardName.getComputedTextLength();
    if (!width || width <= NAME_W) return;
    const size = Math.max(NAME_MIN, NAME_SIZE * (NAME_W / width));
    cardName.setAttribute('font-size', String(size));
    width = cardName.getComputedTextLength();
    if (width > NAME_W) {
      cardName.setAttribute('textLength', String(NAME_W));
      cardName.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    }
  };

  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };

  const paint = () => {
    stop();
    if (!record) return;

    const live = isActive(record.expiresAt);
    if (card) card.hidden = !live;
    if (join) join.hidden = live;

    if (live) {
      setState(formatLeft(record.expiresAt), 'ok');
      setNote(`Your membership runs until ${formatDate(record.expiresAt)}.`);
      /* Wake at the expiry itself when it is closer than the tick, so the card
         goes at the instant it runs out and not up to a minute afterwards. */
      timer = window.setTimeout(paint, Math.min(TICK_MS, msLeft(record.expiresAt)));
      return;
    }

    setState('No active membership', '');
    setNote(
      record.expiresAt
        ? 'Your membership has run out. It shows up here again as soon as it is renewed.'
        : 'Nothing is active on this account yet. Your membership shows up here once it is set up for you.',
    );
  };

  /* Fonts land after this module first runs, and a name measured against
     Georgia is not the name Instrument Sans will draw. One refit when the real
     face is ready; `optional` catch is for browsers without the API. */
  document.fonts?.ready?.then(() => {
    if (record && card && !card.hidden) fitName(record.name);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && record) paint();
  });

  return {
    /* Called before Firestore answers. The card stays hidden: showing it and
       taking it away again is worse than a beat of honesty. */
    pending() {
      record = null;
      stop();
      if (card) card.hidden = true;
      if (join) join.hidden = true;
      setState('Checking your membership.', '');
      setNote('');
    },

    show(next) {
      record = next;
      /* Unhide BEFORE fitting: getComputedTextLength returns 0 inside
         display:none, which would silently skip the fit and let a long name
         run off the rule. paint() sets the final hidden state a line later. */
      if (card && isActive(next.expiresAt)) card.hidden = false;
      fitName(next.name);
      paint();
    },

    /* Firestore unreachable, or rules refusing. The page must still be a
       signed in account page, so this reports and hides rather than breaking:
       claiming a membership we could not read would be worse than saying so. */
    fail() {
      record = null;
      stop();
      if (card) card.hidden = true;
      if (join) join.hidden = false;
      setState('Your membership could not be checked right now.', 'error');
      setNote('Try again in a moment.');
    },

    clear() {
      record = null;
      stop();
      if (card) card.hidden = true;
      if (join) join.hidden = true;
      if (cardName) cardName.textContent = '';
      setState('', '');
      setNote('');
    },
  };
}
