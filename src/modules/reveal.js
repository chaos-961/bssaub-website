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

/* Word split (v0.3.8). Rewrites one text-only element into one .rv-w box per
   word so a heading can lift as type instead of as a slab. Exported because
   heroCard.js splits the hero headline too, and a second copy of this in that
   file is a second place for the &nbsp; rule below to be got wrong.

   Splitting on a plain space and nothing else is the load bearing detail: \s
   would also match the &nbsp; in "Become a sponsor", and breaking there would
   throw away the non-breaking the copy explicitly asked for. The separating
   spaces go back as real text nodes, so textContent is unchanged character
   for character and a screen reader still reads one continuous phrase.

   Returns the word boxes, or null when there was nothing worth splitting, so
   the caller can fall back to whatever it already did to the whole line. */
export function splitWords(el) {
  const words = el.textContent.split(' ');
  if (words.length < 2) return null;
  el.textContent = '';
  return words.map((word, w) => {
    if (w) el.append(' ');
    const outer = document.createElement('span');
    outer.className = 'rv-w';
    outer.style.setProperty('--w', w);
    const inner = document.createElement('span');
    inner.textContent = word;
    outer.append(inner);
    el.append(outer);
    return inner;
  });
}

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

  /* 0. Word split (v0.3.8). Every masked heading on the site, including the
        journey's own .jline titles, lifts word by word rather than as a slab.
        reveal.css owns the whole look; this only builds the boxes, and tags
        the MASK so it can hand its clipping job down to them: on a heading
        that wraps to two lines the outer mask's bottom edge is a whole line
        below the words on line one and would hide nothing at all.

        A single word gains nothing from this and keeps the block lift. */
  document.querySelectorAll('.rv-mask > span, .jline__inner').forEach((el) => {
    if (splitWords(el)) el.parentElement.classList.add('is-split');
  });

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

  /* 4. Hero departure — THE COPY ONLY since v0.4.0.

        The card used to leave on this same scrub, travelling further and
        shrinking (v0.3.6) and turning in 3D (v0.3.8), through a
        .hero-card__drift wrapper that existed purely to keep this off the
        elements heroCard.js owns. All of that is gone on the user's word
        (2026-07-26: "there is a weird animation for the card, I dont want
        that when I scroll", plus a report of transparency artifacts on a
        phone), and the wrapper element went with it.

        WHY IT LOOKED BROKEN, because this is the trap to avoid if a card
        exit is ever wanted again: the tween faded the wrapper to opacity
        0.16, and that wrapper is an ancestor of .hero-card__tilt, which
        declares transform-style: preserve-3d. Opacity below 1 is a grouping
        property, so the browser can no longer keep the 3D subtree in one
        plane and composites the card's layers separately. On a phone the
        result was the background mesh reading straight through the card's
        white face and its maroon band, measured mid scroll at 0.505 and 0.558
        — a card you can see the page through, which is not a fade, it is a
        glass sheet. On a phone it was worse than on a desktop for a reason
        that has nothing to do with the GPU: the hero stacks, so the card sits
        low enough that scrolling it into view had ALREADY started fading it.

        Any future exit has to fade something that is not an ancestor of the
        preserve-3d subtree, or drop the 3D entirely. */
  if (hero) {
    const copy = hero.querySelector('.hero__copy');
    if (copy)
      gsap.to(copy, {
        y: -64,
        opacity: 0.12,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 },
      });
  }

  /* 5. Picture in and out (v0.4.0, user brief: the images should animate
        dynamically with the scroll, in AND out, plus a constant simple one,
        all optimised).

        ONE timeline per picture, scrubbed across its whole pass through the
        viewport, two halves: it rises and resolves on the way in, then sinks
        and softens on the way out. `ease: 'none'` on both, because the scroll
        position IS the easing — a curve on top of a scrub only makes the
        picture lag the finger.

        WHERE IT LANDS IS THE CAREFUL PART. On the journey this drives the
        FRAME (`.journey-node__media`), never the `<img>` inside it, because
        journey.js already owns that image's transform for the 1.12 crop scale
        and the ±5% parallax. Frame and picture moving at different rates is
        the depth you actually see; two owners on one transform is the bug this
        codebase keeps not having.

        Unlike the masked headings above (once only, the v0.1.x lesson), these
        are deliberately reversible. That lesson was about CONTENT vanishing;
        a picture breathing as it leaves the screen takes nothing away. */
  document.querySelectorAll('[data-img-io]').forEach((el) => {
    /* `data-img-io="in"` arrives and then STAYS, no leaving half.
       That is not a taste option, it is for anything the page cannot actually
       scroll past. The out half is written against `bottom top`, i.e. the
       picture having fully cleared the top of the screen, and the last content
       block on the page never gets there: only the footer is below it. The
       agency badge measured **0.849 opacity stranded at maximum scroll on a
       phone** with the full treatment, which is a logo left permanently dimmed
       rather than an animation. Anything added near the page end wants this. */
    const tl = gsap
      .timeline({
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.55,
          /* The constant float is CSS, and this is what keeps it from running
             forever off screen (§ GPU floor). Free: the trigger already
             exists, so gating costs one class toggle instead of a second
             IntersectionObserver per picture. */
          onToggle: ({ isActive }) => el.classList.toggle('is-near', isActive),
        },
        defaults: { ease: 'none' },
      })
      /* Absolute positions, not a two key sequence: the gap between 0.35 and
         0.65 is a HOLD, and it is the whole difference between a picture that
         arrives, sits still to be looked at, and then leaves, and one that is
         only ever fully resolved for the single instant it crosses the middle
         of the screen. */
      .fromTo(
        el,
        { y: 40, scale: 0.95, opacity: 0.55 },
        { y: 0, scale: 1, opacity: 1, duration: 0.35 },
        0,
      )
      /* Pads the timeline to a TOTAL of 1, and it is load bearing, not
         decoration. A scrub maps the trigger's 0..1 onto the timeline's total
         duration, so without this the "in" variant's arrival would stretch to
         fill the entire pass and the picture would only finish arriving as it
         left the top of the screen. Measured: the badge went from 1.0 to 0.804
         at maximum scroll purely from dropping the leaving half. Both variants
         run to 1, so 0.35 means the same moment in either. */
      .to({}, { duration: 0.65 }, 0.35);

    if (el.dataset.imgIo !== 'in')
      tl.to(el, { y: -40, scale: 0.95, opacity: 0.55, duration: 0.35 }, 0.65);
  });
}
