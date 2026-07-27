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

/* ------------------------------------------------------------------
   SCRUBBED TEXT (v0.4.4, user report: "there are not enough animations for
   the text and its not dynamic to the scroll and its just bad so fix it all
   on all devices and make sure its sync to the mobile too").

   What changed: text used to arrive on a CSS transition that a one shot class
   fired. It looked identical every time and it had no relationship to the
   scroll at all — you crossed a line and 0.95s of animation played on its own
   clock while you kept moving. Now every text block is SCRUBBED across its own
   entry band, so the words are literally being pulled up by the finger or the
   wheel, and stopping halfway leaves them halfway.

   WHY THIS IS NOT THE v0.1.x DISAPPEARING CARD. That lesson (headings must be
   once only) was about content keyed to the journey's DRAW FRONT, which lagged
   the scroll and hid cards sitting in the middle of the screen. These triggers
   are keyed to each block's OWN position, so a block is fully resolved from the
   moment its top passes 56% of the viewport and stays that way for the rest of
   its pass. The only way to un-reveal one is to put it back down near the
   bottom edge of the screen, which is where it came from.

   IT IS THE SAME ON A PHONE BY CONSTRUCTION. Every number here is a fraction
   of the viewport, there is no width query anywhere in this file, and the
   scrub is deliberately short (0.3s) so it tracks a finger rather than
   floating after it the way a long smoothing does on a flick.

   COST. GSAP owns transform and opacity on these elements now, so reveal.css
   hands both over under `html.motion-scrub` — a CSS transition on a property
   GSAP writes every frame is two owners on one element and reads as lag. Only
   timelines whose trigger is in range tick; the rest are inert bookkeeping.

   `clamp()` IS LOAD BEARING AND IT IS NOT DECORATION. A block near the page
   end may never reach 56% of the viewport: measured at 1280x600, the footer's
   top sits at 202px at MAXIMUM scroll against the 336px this band asks for, so
   without the clamp its three columns would be stuck at opacity 0 with no way
   to finish — an invisible footer on any short, wide window. ScrollTrigger's
   clamp prefix pulls a range that runs off the end of the document back inside
   it, so every block completes wherever it sits. This is the same failure the
   v0.4.0 picture pass hit from the other direction, where the agency badge
   stranded at 0.849 opacity; that one was solved by dropping the leaving half,
   and this is the general tool for it.
   ------------------------------------------------------------------ */
const TEXT_BAND = { start: 'clamp(top 92%)', end: 'clamp(top 56%)', scrub: 0.3 };

/* One text block → one scrubbed timeline.

   A mask hands its motion to its words when reveal.js has split it, which is
   why nothing here ever animates a `.rv-mask` itself: the outer box gave up
   its clip to the word boxes at v0.3.8 and animating both would double the
   travel. Words move on yPercent inside their own clip (no opacity needed,
   the clip IS the reveal); everything else rises and fades.

   The stagger is capped at 0.45 of the timeline so a heading with twelve words
   still finishes inside the band instead of trailing out the bottom of it. No
   padding to a fixed total on purpose: a scrub maps the trigger's 0..1 onto
   whatever the total is, so every block, long or short, completes at exactly
   the same point on screen and only its internal grain differs. */
function scrubText(block, { trigger = block, kids = null, axis = 'y', dist = 24, sign = 1 } = {}) {
  const bits = [];
  const fromMask = (el) => {
    const words = el.querySelectorAll('.rv-w > span');
    if (words.length) return words.forEach((w) => bits.push({ el: w, word: true }));
    const span = el.firstElementChild;
    if (span) bits.push({ el: span, word: true });
  };

  if (kids) {
    block.querySelectorAll(kids).forEach((el) => {
      // a child that holds a masked line (a journey title, the sponsor CTA
      // heading) lets the words carry it and does not move as a slab
      const mask = el.querySelector('.rv-mask, .jline');
      if (mask) fromMask(mask);
      // The Join CTA is the one child whose transform belongs to somebody
      // else: journey.js drives x and y on it for the magnetic pull. It
      // arrives on opacity alone, because two owners on one transform is
      // exactly the bug this file's shape exists to avoid.
      else bits.push({ el, word: false, still: el.hasAttribute('data-journey-cta') });
    });
  } else {
    block.querySelectorAll('.rv-mask, .rv-up').forEach((el) => {
      if (el.classList.contains('rv-mask')) fromMask(el);
      else bits.push({ el, word: false });
    });
  }

  if (!bits.length) return;

  const tl = gsap.timeline({
    scrollTrigger: { trigger, start: TEXT_BAND.start, end: TEXT_BAND.end, scrub: TEXT_BAND.scrub },
    defaults: { ease: 'none' },
  });
  bits.forEach((b, i) => {
    const at = Math.min(i * 0.05, 0.45);
    if (b.word) tl.fromTo(b.el, { yPercent: 115 }, { yPercent: 0, duration: 0.55 }, at);
    else if (b.still) tl.fromTo(b.el, { opacity: 0 }, { opacity: 1, duration: 0.55 }, at);
    else
      tl.fromTo(
        b.el,
        { [axis]: dist * sign, opacity: 0 },
        { [axis]: 0, opacity: 1, duration: 0.55 },
        at,
      );
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

  /* 1. Text, scrubbed (v0.4.4 — see the header comment). The class goes on
        <html> BEFORE any timeline is built, so the CSS transitions are off the
        moment GSAP writes its first from-state and the two can never overlap.

        The once only `.is-in` triggers stay underneath, and they are not
        vestigial: they still drive everything in these blocks that is NOT
        text (the agency plate, the journey frames), and they are the safety
        net for any reveal element a future edit adds outside a block this
        function walks — GSAP's inline styles win wherever both apply. */
  document.documentElement.classList.add('motion-scrub');

  reveals.forEach((el) => {
    scrubText(el);
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => el.classList.add('is-in'),
    });
  });

  /* 1a. The two blocks that describe their motion through their CHILDREN
         rather than through reveal classes. Both had a bespoke rest state and
         stagger in their own stylesheet long before the .rv-* primitives
         existed, so rather than rewrite their markup the selector is named
         here and reveal.css hands the rest state over under `motion-scrub`. */
  document
    .querySelectorAll('.sponsor-cta__inner')
    .forEach((block) => scrubText(block, { kids: ':scope > *', axis: 'y', dist: 20 }));

  /* The journey is the one block whose ENTRY VECTOR is a layout decision and
     not a taste one, which is why it is the only thing in this file that knows
     a breakpoint exists. On desktop the copy sits beside its picture and slides
     in from its own side, alternating with the layout; on a phone the card is
     stacked, and journey.css has entered that copy vertically since v0.1.x
     because a sideways slide on a full width column reads as a wobble.

     gsap.matchMedia rather than one matchMedia read: it reverts the timelines
     it built and rebuilds the other set when the query flips, so a window
     dragged across 60rem gets the right vector instead of the one that
     happened to be true at load. */
  const journeyText = (axis, dist) => () =>
    document.querySelectorAll('.journey-node__content').forEach((block) => {
      const node = block.closest('[data-node]');
      const even = node && [...node.parentElement.children].indexOf(node) % 2 === 1;
      scrubText(block, { kids: ':scope > *', axis, dist, sign: even ? -1 : 1 });
    });
  const mm = gsap.matchMedia();
  mm.add('(min-width: 60rem)', journeyText('x', 30));
  mm.add('(max-width: 59.99rem)', journeyText('y', 26));

  /* 1b. Slow drift, so a block keeps answering the scroll after it has
         arrived instead of parking dead. It lands on the CONTAINER while the
         arrival above lands on its children, which is why the two compose
         instead of fighting: one transform, one owner, per element. ±18px is
         small enough that it never reads as a second animation, only as the
         text sitting on a slightly different plane from the section around
         it. */
  document.querySelectorAll('[data-drift]').forEach((el) =>
    gsap.fromTo(
      el,
      { y: 18 },
      {
        y: -18,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
      },
    ),
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
