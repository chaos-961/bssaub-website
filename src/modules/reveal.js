/* ------------------------------------------------------------------
   Scroll motion system (v0.3.6, user brief: a set of scroll driven
   animations that feel expensive, behave identically on desktop and on a
   phone, and stay cheap).

   THE SHAPE OF THIS FILE IS THE POINT. The JS budget had ~5.5KB gz of head
   room left (94.4 of 100 at v0.3.5), so nothing here re-implements in
   JavaScript what CSS already does for free:

     - ONE SHOT reveals are a single class. Everything about how they look,
       including the per element stagger, is CSS (`--i` on the child, one
       transition-delay calc in reveal.css). JS adds `.is-in` and leaves.
     - SCRUBBED work is the only thing that needs a frame loop, so it is the
       only thing GSAP drives here, and every one of them animates exactly
       one composited property on one element.

   Everything obeys the § GPU floor: transform and opacity only, no filter
   on anything scrubbed, no viewport spanning blend or backdrop layer, and
   nothing that loops forever. Reduced motion resolves every element to its
   finished state and creates no triggers at all.
   ------------------------------------------------------------------ */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initReveal(scroll) {
  const reveals = document.querySelectorAll('[data-reveal]');
  const rules = document.querySelectorAll('[data-rule]');
  const rails = document.querySelectorAll('[data-rail]');
  const hero = document.querySelector('.hero');

  if (scroll.reduced) {
    reveals.forEach((el) => el.classList.add('is-in'));
    rails.forEach((el) => el.classList.add('is-drawn'));
    // the rules are a sweep of light with nothing behind them but the
    // section's own hairline, so at rest they simply stay invisible
    return;
  }

  /* 1. Masked lift + rise. Section eyebrows, titles and notes climb out from
        behind their own edge, staggered by `--i`. Once only: a heading that
        has arrived can never leave again (the v0.1.x journey lesson). */
  reveals.forEach((el) =>
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => el.classList.add('is-in'),
    }),
  );

  /* 2. Divider sweep. A thread of accent light opens outward from the centre
        of a section's top hairline as you cross it, then dims and leaves the
        plain rule behind. Two keys on one timeline so the fade trails the
        opening rather than running with it. */
  rules.forEach((el) => {
    const host = el.parentElement;
    gsap
      .timeline({
        scrollTrigger: { trigger: host, start: 'top 97%', end: 'top 45%', scrub: 0.4 },
      })
      .fromTo(el, { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 1, ease: 'none', duration: 0.5 })
      .to(el, { opacity: 0, ease: 'none', duration: 0.5 });
  });

  /* 3. Zone rails. Each perk zone's hairline draws downward across the whole
        time that zone is passing, so the line is literally being written as
        you read the sponsors beside it. The accent sits at the gradient's
        bottom (see perk-field.css), which puts the bright ink at the draw
        front for free, with no second animated property. */
  rails.forEach((el) =>
    gsap.fromTo(
      el,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top 76%', end: 'bottom 84%', scrub: 0.45 },
      },
    ),
  );

  /* 4. Hero departure. The copy and the card leave at different rates and
        settle at different depths, so scrolling out of the hero reads as a
        camera pulling back rather than a page sliding up.

        The card writes to .hero-card__drift, a wrapper that exists purely so
        this never shares an element with heroCard.js: that module owns the
        entrance (on .hero-card) and the infinite idle float (on
        .hero-card__floater), and a scrub tween landing on either would fight
        it every frame. Three modules, three elements, one transform each. */
  if (hero) {
    const copy = hero.querySelector('.hero__copy');
    const drift = hero.querySelector('.hero-card__drift');
    if (copy || drift) {
      const tl = gsap.timeline({
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 },
      });
      if (copy) tl.to(copy, { y: -64, opacity: 0.12, ease: 'none' }, 0);
      // the card travels further and shrinks: nearer to the eye, so it exits
      // faster, which is the whole illusion
      if (drift) tl.to(drift, { y: -142, scale: 0.84, rotation: -3.4, opacity: 0.16, ease: 'none' }, 0);
    }
  }
}
