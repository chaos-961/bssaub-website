// Agency credit (Nerve Media section): a one shot reveal, plus a light that
// follows the cursor across the plaque and a tilt toward it.
//
// THIS MODULE WRITES FOUR CUSTOM PROPERTIES AND NOTHING ELSE. The tilt, the
// lift, the glow's position, and every transition on them live in
// agency-credit.css, so there is no tween object and no ticker here, and the
// lockup's transform has exactly one owner. That is the same shape as the
// rest of the v0.3.6 motion system: JS is a thin driver, CSS is the look.
//
// --px/--py are the pointer normalised 0..1 across the box. --pw/--ph are the
// box itself, cached, so the per move path reads no layout at all — the
// forced synchronous layout an unguarded getBoundingClientRect would cause on
// every move is the ocean mesh lesson, and it applies to a pointer handler
// just as much as to a ticker.
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initAgencyCredit(scroll) {
  const root = document.querySelector('[data-agency-credit]');
  if (!root) return;

  if (scroll.reduced) {
    root.classList.add('is-in');
  } else {
    ScrollTrigger.create({
      trigger: root,
      start: 'top 80%',
      once: true,
      onEnter: () => root.classList.add('is-in'),
    });
  }

  const lockup = root.querySelector('[data-agency-lockup]');
  if (!lockup || scroll.reduced) return;
  // a coarse pointer has no cursor to follow, and a tap would fire this once
  // on the way to opening the link. The CSS defaults leave the plaque square.
  if (!window.matchMedia('(pointer: fine)').matches) return;

  let box = null;

  const measure = () => {
    box = lockup.getBoundingClientRect();
    lockup.style.setProperty('--pw', `${box.width}px`);
    lockup.style.setProperty('--ph', `${box.height}px`);
  };

  const track = (e) => {
    if (!box) measure();
    lockup.style.setProperty('--px', ((e.clientX - box.left) / box.width).toFixed(3));
    lockup.style.setProperty('--py', ((e.clientY - box.top) / box.height).toFixed(3));
  };

  /* The cached box is in viewport space, so scrolling under a resting cursor
     invalidates it. Dropping it costs one assignment and defers the single
     layout read to the next move, which is strictly cheaper than measuring on
     every move forever. Both listeners are attached only while the pointer is
     actually on the plaque, so the idle page carries none of this. */
  const invalidate = () => {
    box = null;
  };

  lockup.addEventListener('pointerenter', (e) => {
    measure();
    track(e);
    window.addEventListener('scroll', invalidate, { passive: true });
    window.addEventListener('resize', invalidate, { passive: true });
  });

  lockup.addEventListener('pointermove', track);

  lockup.addEventListener('pointerleave', () => {
    window.removeEventListener('scroll', invalidate);
    window.removeEventListener('resize', invalidate);
    box = null;
    // back to dead centre, which is 0deg on both axes: the plaque eases square
    // on the same transition that carried it, rather than snapping.
    lockup.style.setProperty('--px', '0.5');
    lockup.style.setProperty('--py', '0.5');
  });
}
