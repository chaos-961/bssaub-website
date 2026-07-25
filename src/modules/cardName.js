/* Hero card NAME blank (v0.3.9, user brief: the card should type a random
   Lebanese first name onto its NAME line, hold it, backspace it away and type
   the next one, forever, aligned perfectly at every width including a phone).

   WHY THIS IS AN SVG AND NOT A POSITIONED SPAN. The card face is one baked
   663x473 raster, so the blank line sits at fixed IMAGE pixels (measured off
   the asset: rule y=426, x=263..461; the NAME label's caps run y=409..422). An
   inline <svg viewBox="0 0 663 473"> laid over the image's content box gives a
   coordinate system that IS those image pixels at every rendered size, so the
   alignment is exact by construction rather than by a percentage that has to
   be re-tuned per breakpoint. Nothing here measures the card, nothing here
   listens for resize, and there is no breakpoint anywhere in this file: the
   phone and the desktop run one path.

   preserveAspectRatio="none" is deliberate (see sections.css): it maps the
   viewBox corner to corner onto the same box the <img> stretches into, so the
   two agree through subpixel rounding instead of drifting apart from it.

   Cost: no frame loop, no animation frame at all. This is a chained setTimeout
   writing one text node, plus one getBBox per typed character to seat the
   caret (~16 reads a second at the worst, and never inside a ticker, which is
   the § GPU floor rule that actually bites). Parked whenever the hero is off
   screen or the tab is hidden, which also stops the caret blink, the one thing
   here that would otherwise loop forever. */
import { FIRST_NAMES } from '../data/names.js';

/* image space, measured off card-front.webp — see the header */
const CENTER_X = 362; // midpoint of the rule, x 263..461
const CARET_W = 1.7;
const CARET_GAP = 1.6;

const TYPE_MS = 62; // per character going on
const ERASE_MS = 34; // backspace runs faster than typing, as it does in life
const HOLD_MS = 2500; // the user's 2.5s, measured from the last letter landing
const GAP_MS = 220; // beat on the empty line before the next name starts
const WAKE_MS = 160; // settling beat when the card scrolls back into view

export function initCardName(scroll) {
  const text = document.querySelector('[data-card-name]');
  if (!text) return;
  const caret = document.querySelector('[data-card-caret]');
  const svg = text.ownerSVGElement;

  /* A shuffled bag, not Math.random per pick. Picking at random out of 100
     lands on the name you just watched about once every ten changes, and a
     repeat is the one thing a visitor watching a loop will notice. A bag shows
     all 100 before any of them can come back. */
  let bag = [];
  let shown = '';
  let target = '';

  const draw = () => {
    if (!bag.length) {
      bag = FIRST_NAMES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // a fresh bag must not open on the name still leaving the card
      const last = bag.length - 1;
      if (bag[last] === shown) [bag[0], bag[last]] = [bag[last], bag[0]];
    }
    return bag.pop();
  };

  const render = (s) => {
    text.textContent = s;
    if (!caret) return;
    /* text-anchor is middle, so the string re-centres on the rule as it grows
       and the caret has to be measured rather than accumulated. getBBox is the
       exact answer including side bearings; an empty <text> has no box worth
       trusting, hence the fallback to the anchor itself. */
    const box = s && text.getBBox();
    caret.setAttribute('x', box ? box.x + box.width + CARET_GAP : CENTER_X - CARET_W / 2);
  };

  if (scroll.reduced) {
    /* Reduced motion gets a filled in card, not a blank one: the name is the
       content here and only the typing was the animation (§7). */
    caret?.remove();
    render(draw());
    return;
  }

  /* One pending step at a time, held in `next` so a pause resumes exactly
     where it stopped instead of restarting the name. It always points at the
     step that has NOT run yet, because every step's last act is to schedule
     the one after it, on every branch. */
  let next = null;
  let timer = 0;
  let awake = false;
  let onScreen = true;

  const at = (fn, ms) => {
    next = fn;
    if (awake) timer = setTimeout(fn, ms);
  };

  function type() {
    if (shown.length < target.length) {
      svg.classList.add('is-typing'); // solid caret while keys are landing
      render((shown = target.slice(0, shown.length + 1)));
      at(type, TYPE_MS);
    } else {
      svg.classList.remove('is-typing'); // and blinking again while it rests
      at(erase, HOLD_MS);
    }
  }

  function erase() {
    svg.classList.add('is-typing');
    if (shown.length) {
      render((shown = shown.slice(0, -1)));
      at(erase, ERASE_MS);
    } else {
      target = draw();
      at(type, GAP_MS);
    }
  }

  const setAwake = (on) => {
    if (on === awake) return;
    awake = on;
    svg.classList.toggle('is-awake', on);
    if (on) timer = setTimeout(next, WAKE_MS);
    else clearTimeout(timer);
  };

  render('');
  target = draw();
  next = type;

  document.addEventListener('visibilitychange', () => setAwake(onScreen && !document.hidden));

  if ('IntersectionObserver' in window) {
    onScreen = false;
    new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        setAwake(onScreen && !document.hidden);
      },
      { rootMargin: '120px 0px' },
    ).observe(svg.closest('.hero-card') || svg);
  } else {
    setAwake(!document.hidden);
  }
}
