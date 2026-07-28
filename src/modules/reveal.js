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
   the caller can fall back to whatever it already did to the whole line.

   `min` is what "worth splitting" means, and it is 2 everywhere on the page
   for a reason: a one word block gains nothing from a per word cascade, and
   the whole-block mask it keeps instead is the cheaper path. The hero passes 1
   since v0.4.6, because its headline broke into two lines and the second one
   is a single word: without a word box that line would sit out the permanent
   swell (which rides .rv-w) while the line above it moved. */
export function splitWords(el, min = 2) {
  const words = el.textContent.split(' ');
  if (words.length < min) return null;
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
   SCRUBBED TEXT (v0.4.4) IS GONE AT v0.4.5, on the user's word: "can you fix
   this like text being cut off, its a weird animation u added, remove it bcz
   its bad", against a screenshot of the Clothing zone title with its lower
   third sheared away.

   WHY IT CUT TEXT OFF, because the mechanism is the lesson and not the taste
   call. A masked line reveals by sliding out from behind its own bottom edge,
   so at any point before it finishes, the part still below that edge is
   CLIPPED — that is the whole effect. A one shot class runs that slide to
   completion on its own 1s clock no matter what the reader does, so the clipped
   state exists for under a second and nobody ever sees it parked. A SCRUB ties
   the same slide to scroll position, which means stopping mid band is not a
   pause, it is a resting state: the heading simply stays half cut for as long
   as the reader sits there, and a phone reader who thumbs down a little and
   reads is exactly the case that parks it. Single word headings are worst hit
   (`Clothing`, `Fitness`, `Services`) because v0.3.8's word split declines to
   split them, so they keep the whole-block mask and the whole word disappears
   into it rather than a per word offset.

   THE GENERAL RULE THIS LEAVES BEHIND: never scrub an animation whose
   intermediate frames hide content. Scrub things that are still legible at
   every point of their travel (the pictures, the rails, the divider sweep, the
   drift) and let anything CLIPPING run on its own clock.

   Removed with it, all of it a v0.4.4 addition and none of it older: the
   TEXT_BAND / scrubText pair, the `motion-scrub` handover on <html> (the
   matching block in reveal.css went too), the journey's matchMedia entry
   vector, the sponsor CTA kid walk, and the `data-drift` container parallax.
   Text is back to the once only `.is-in` class that ran from v0.3.6 to v0.4.3,
   which is still the entire look and still lives in reveal.css. Do not rebuild
   the scrub without a fresh brief, and if a brief ever asks for text tied to
   the scroll again, move something that does not clip.
   ------------------------------------------------------------------ */

export function initReveal(scroll) {
  const reveals = document.querySelectorAll('[data-reveal]');
  const rules = document.querySelectorAll('[data-rule]');
  const rails = document.querySelectorAll('[data-rail]');

  if (scroll.reduced) {
    reveals.forEach((el) => el.classList.add('is-in'));
    rails.forEach((el) => el.classList.add('is-drawn'));
    /* The v0.5.0 section title underlines resolve here rather than in the CSS,
       and that is the difference between covering one reduced motion signal and
       covering both: `?reduced-motion` is a root CLASS and never matches the
       prefers-reduced-motion media query, so a rule that leans on the query
       alone leaves the QA path staring at three undrawn hairlines. `.is-drawn`
       already means exactly "your rest transform is scaleX(0), resolve it", so
       this reuses it rather than inventing a second way to say the same thing. */
    document.querySelectorAll('[data-title-rule]').forEach((el) => el.classList.add('is-drawn'));
    // the sweeps are a thread of light with nothing behind them but the
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

  /* 1. Text, once only. One class, and reveal.css is the entire look including
        the per element stagger. Everything that used to be scrubbed here went
        at v0.4.5 (see the header comment); the class based path underneath it
        never left, which is why the removal was a deletion rather than a
        rebuild. */
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

  /* 4. Hero departure — GONE ENTIRELY AT v0.4.5, and this is the second half
        of a removal that started at v0.4.0, so it is worth one paragraph
        rather than a silent deletion.

        What it was: the hero copy lifted 64px and faded to opacity 0.12 on a
        scrub from `top top` to `bottom top`, i.e. the headline and everything
        under it dissolved as you left the section. The card left with it until
        v0.4.0 (travelling and shrinking since v0.3.6, turning in 3D since
        v0.3.8, through a .hero-card__drift wrapper that existed purely to keep
        this off the elements heroCard.js owns). The user's word both times was
        the same, a year apart in version numbers and a day apart in fact:
        2026-07-26 "there is a weird animation for the card, I dont want that
        when I scroll", and 2026-07-27 "there is weird effect of like fading
        away when I scroll, remove it". The hero now simply scrolls away.

        THE TRAP THE CARD HALF LEFT BEHIND, which is the part that must not be
        lost with the code: that tween faded a wrapper that was an ancestor of
        .hero-card__tilt, which then declared transform-style: preserve-3d.
        Opacity below 1 is a grouping property, so the browser stopped keeping
        the 3D subtree in one plane and composited the card's layers
        separately. On a phone the background mesh read straight through the
        card's white face and its maroon band, measured mid scroll at 0.505 and
        0.558: not a fade, a glass sheet. Worse on a phone for a layout reason
        and not a GPU one, since the hero stacks there and the card sat low
        enough that scrolling it into view had already begun fading it. The 3D
        went with the tilt at v0.4.4, so the trap is retired, but any future
        exit still has to fade something that is not an ancestor of a
        preserve-3d subtree.

        Nothing replaces this. The headline's own permanent swell (v0.4.5,
        sections.css) is unrelated to scroll and lives on .rv-w's `translate`,
        so there is no scrub left anywhere in the hero. */

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

    /* The leaving half gained an x and a rotation at v0.5.0 (§ item 2 and item
       8 of the exit brief). It lands HERE, inside the timeline that already
       owns this element's transform, rather than as a second tween: `transform`
       on a journey frame is spoken for by this scrub and `translate` by the
       constant float in reveal.css, so a third owner would have had nowhere
       left to stand. The direction comes off the markup and matches the way the
       copy beside it leaves, so a card shears apart as it goes. */
    if (el.dataset.imgIo !== 'in') {
      const away = el.dataset.imgExit === 'left' ? -1 : 1;
      tl.to(
        el,
        { x: 58 * away, y: -40, rotation: 1.6 * away, scale: 0.95, opacity: 0.55, duration: 0.35 },
        0.65,
      );
    }
  });

  /* 6. THE EXIT SYSTEM (v0.5.0, user brief: "texts going side ways to
        disappear when I scroll past them, fades, more animations").

        WHY THIS IS NOT THE v0.4.4 SCRUBBED TEXT COMING BACK, because that was
        removed on the user's word and the distinction is the only thing keeping
        this honest. That system scrubbed a masked ARRIVAL, and a masked reveal
        works by sliding a line out from behind its own bottom edge, so every
        state before it finishes is a CLIPPED state and parking mid band parked a
        heading half cut. This moves a whole, unclipped block sideways and fades
        it: at every point of its travel the text is complete, merely offset and
        translucent, which is exactly the "still legible at every point" test
        that reveal.js's own header comment leaves behind as the rule. Nothing
        here touches .rv-mask, .rv-w or any element that clips.

        It is also only ever pointed at blocks that have ALREADY left the top of
        the screen — see the two start regimes below — so it never dissolves
        something a reader could still be reading. */
  initExits();

  /* 7. Section heads drift (v0.5.0). The intro block of the perk field and of
        the journey travels against the page as it crosses, so the eyebrow,
        title and note read as a plane behind the section rather than as part of
        the same sheet as the bubbles or the timeline.

        `y` here and `x` from the exit above are two tweens on ONE element, and
        that is fine where a GSAP tween plus a CSS transition would not be: GSAP
        keeps a per element transform cache and each tween writes its own
        component into it, so x and y compose. The hazard this file keeps
        warning about is two OWNERS (CSS and GSAP) on one property, not two
        tweens on two components. */
  document.querySelectorAll('[data-head-drift]').forEach((el) =>
    gsap.fromTo(
      el,
      { y: 26 },
      {
        y: -26,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.5 },
      },
    ),
  );

  /* 8. Zone label lag (v0.5.0). The five perk category labels hold back against
        their own zone, so a label lingers beside its sponsors instead of
        travelling with them. Small on purpose: it ends 20px BELOW its layout
        seat, which is the edge nearest the bubble canvas, and by then its exit
        above has already taken it most of the way out. */
  document.querySelectorAll('[data-lag]').forEach((el) =>
    gsap.fromTo(
      el,
      { y: -20 },
      {
        y: 20,
        ease: 'none',
        scrollTrigger: {
          trigger: el.closest('.perk-zone') || el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.5,
        },
      },
    ),
  );

  /* 9. Section title underline (v0.5.0). A thread of accent draws out from under
        each section title as the title arrives, the same gesture the section's
        own top hairline makes, one element down.

        `clamp()` IS THE RIGHT TOOL FOR AN ARRIVAL AND THE WRONG ONE FOR AN EXIT,
        which is worth stating once since both are in this file now. It pulls a
        range that runs off the end of the document back inside it, so a rule
        near the page bottom still finishes drawing (the v0.4.4 footer lesson).
        Do that to an exit and it would finish DISSOLVING early, while the block
        is still on screen, which is why the exits below get a measured guard
        instead. */
  document.querySelectorAll('[data-title-rule]').forEach((el) =>
    gsap.fromTo(
      el,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'clamp(top 94%)', end: 'clamp(top 64%)', scrub: 0.45 },
      },
    ),
  );

  /* 10. The Join card lands (v0.5.0). The drawn path ends on this one block, so
         it is the one block that grows into place rather than merely arriving:
         a scrub from 0.9 across its entry band, clamped so it can always finish.
         It lands on .journey-node__card--join, which nothing else transforms —
         journey.js's magnetic pull is on the button inside it. */
  const joinCard = document.querySelector('.journey-node__card--join');
  if (joinCard)
    gsap.fromTo(
      joinCard,
      { scale: 0.9 },
      {
        scale: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: joinCard,
          start: 'clamp(top 92%)',
          end: 'clamp(top 48%)',
          scrub: 0.5,
        },
      },
    );
}

/* Sideways travel of an exiting block, in px. Deliberately modest: the block is
   already off the top of the screen while this runs, so the job is to make it
   read as LEAVING, not to move it anywhere in particular. */
const EXIT_X = 90;

/* Document space bottom of an element, in scroll units. offsetTop rather than
   getBoundingClientRect, because half of these elements are carrying a live
   transform from the very tweens being audited and a rect would fold that in.
   Same reason perkField.js measures its section from document offsets. */
function docBottom(el) {
  let y = el.offsetHeight;
  for (let n = el; n; n = n.offsetParent) y += n.offsetTop;
  return y;
}

function initExits() {
  const exits = [];

  document.querySelectorAll('[data-exit]').forEach((el) => {
    const away = el.dataset.exit === 'left' ? -1 : 1;
    const st = gsap.fromTo(
      el,
      { x: 0, opacity: 1 },
      {
        x: EXIT_X * away,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          /* TWO REGIMES, AND THEY AGREE AT THE BOUNDARY RATHER THAN STEPPING.
             A short block is governed by its top ("you have scrolled it up
             under the nav"); a tall one has to be governed by its bottom, or a
             500px block would start dissolving with its lower half still in the
             middle of the screen, which is the v0.4.5 complaint wearing a
             different hat. The threshold is 0.32vh because that is exactly the
             height at which `top 8%` puts a block's bottom at 40% — so a
             heading that grows a line and crosses the threshold does not jump,
             the two formulas hand over continuously. Re-evaluated on every
             refresh, so a font swap or a rotated phone re-picks. */
          start: () =>
            el.offsetHeight > window.innerHeight * 0.32 ? 'bottom 40%' : 'top 8%',
          end: 'bottom top',
          scrub: 0.4,
        },
      },
    ).scrollTrigger;
    exits.push({ el, st, off: null });
  });

  if (!exits.length) return;

  /* THE STRAND GUARD, which is the v0.4.0 agency badge lesson turned into
     something the system checks for itself instead of something the next person
     has to remember.

     An exit ends at `bottom top`, i.e. the block's bottom clearing the top of
     the screen. A block near the end of the document may never get there, and a
     scrub that cannot reach its end parks FOREVER at whatever fraction it
     reached: not an animation, a paragraph left permanently at 40% opacity and
     40px to the left. Nothing in the markup says which blocks those are. It
     depends on the viewport height and on how much content happens to sit
     below them, so it changes when the window is resized, when the sub gains a
     line, and when somebody adds a section. So it is measured on every refresh
     rather than decided once by whoever wrote the attribute.

     Disabled triggers are left out of the global refresh, so the audit reads
     geometry directly rather than the trigger's own stale `end`. */
  const audit = () => {
    const max = ScrollTrigger.maxScroll(window);
    exits.forEach((e) => {
      const off = docBottom(e.el) > max - 1;
      if (off === e.off) return;
      e.off = off;
      if (off) {
        e.st.disable(false, true);
        gsap.set(e.el, { x: 0, opacity: 1 });
      } else {
        e.st.enable(false, false);
        e.st.refresh();
      }
    });
  };

  ScrollTrigger.addEventListener('refresh', audit);
  audit();
}
