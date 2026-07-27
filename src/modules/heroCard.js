// Hero membership card (§6.3).
//
// THE CARD IS FLAT SINCE v0.4.4, AND THAT IS A USER CALL, NOT AN OVERSIGHT
// (2026-07-27: "make sure there is no tilt for the 3d card in the hero ... and
// on mobile ... there is no tilt and its straight, I felt it was tilting
// backwards"). Everything that rotated the card is gone: the pointer tilt, the
// press-and-swivel touch path (v0.3.9), and the gyro path.
//
// The gyro is worth naming, because it is almost certainly the "tilting
// backwards" that was reported. It read `(beta - 40) / 32`, i.e. it assumed a
// phone held at 40 degrees and treated anything steeper as a downward look, so
// a phone held upright pinned rotationX at roughly -9 degrees and simply STAYED
// there. Not a wobble, a permanent lean. Do not reintroduce any of this without
// a fresh brief, and if a card tilt is ever wanted again, gyro tilt needs a
// calibrated rest angle rather than a constant.
//
// What is left: the entrance the preloader hands off to, a slow idle drift, a
// glare that follows a fine pointer (a light on a flat card, not a rotation),
// and a small scale on press so a phone still gets an answer when it touches
// the card. No 3D anywhere, which also permanently retires the v0.4.0 class of
// bug (an opacity above a preserve-3d subtree letting the background read
// through the card).
import gsap from 'gsap';
import { splitWords } from './reveal.js';

export function initHeroCard(scroll) {
  const root = document.querySelector('[data-hero-card]');
  if (!root) return { enter: () => {} };

  // Reduced motion: static card, no idle, no entrance (§7).
  if (scroll.reduced) {
    return { enter: () => {} };
  }

  const floater = root.querySelector('.hero-card__floater');
  // .hero-card__tilt keeps its name: it is still the card face wrapper that
  // the name overlay and the glare are positioned against. It no longer
  // rotates, and it no longer opens a 3D context.
  const face = root.querySelector('.hero-card__tilt');
  const glare = root.querySelector('.hero-card__glare');

  let entered = false;

  const glareOpacity = gsap.quickTo(glare, 'opacity', { duration: 0.5, ease: 'power2.out' });
  const glareX = gsap.quickSetter(glare, '--gx', '%');
  const glareY = gsap.quickSetter(glare, '--gy', '%');

  const fine = window.matchMedia('(pointer: fine)').matches;

  // Pointer position inside the card, normalised to [-1, 1] on both axes.
  const pointAt = (e) => {
    const r = root.getBoundingClientRect();
    return [
      gsap.utils.clamp(-1, 1, ((e.clientX - r.left) / r.width) * 2 - 1),
      gsap.utils.clamp(-1, 1, ((e.clientY - r.top) / r.height) * 2 - 1),
    ];
  };

  /* The glare is a highlight that travels across a STILL card. It moves one
     gradient centre and one opacity, both composited, and it is gated to a
     fine pointer because a finger has no hover state to light. */
  const light = (nx, ny) => {
    glareX(50 + nx * 34);
    glareY(50 + ny * 34);
    glareOpacity(Math.min(1, Math.hypot(nx, ny)) * 0.42);
  };

  /* A plain tween, NOT a quickTo, and the reason is worth keeping from v0.3.9:
     quickTo moves a value through tween.resetTo(), which looks the property up
     by its exact name in the tween's own PropTween list, and CSSPlugin expands
     the `scale` shorthand into scaleX and scaleY — so a quickTo on 'scale'
     builds a live tween that reads as active and moves nothing (measured:
     scale pinned at 1.0000 for the whole press). A tween per press is the
     right cost anyway: it fires on a human pressing the card, not sixty times
     a second. */
  const pressScale = (v) =>
    gsap.to(face, { scale: v, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  let pressed = false;

  const release = () => {
    if (!pressed) return;
    pressed = false;
    pressScale(1);
  };

  root.addEventListener('pointerdown', () => {
    if (!entered) return;
    pressed = true;
    pressScale(0.975);
  });
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  if (fine) {
    root.addEventListener('pointermove', (e) => {
      if (!entered) return;
      light(...pointAt(e));
    });
    root.addEventListener('pointerleave', () => glareOpacity(0));
  }

  // The idle float is an infinite timeline, so it never stops on its own: it
  // used to keep animating (and keep the card + its blurred drop shadow layer
  // recompositing every frame) for the whole session, including deep down the
  // page where the hero is thousands of px away. v0.2.9 parks it whenever the
  // hero leaves the viewport and resumes on the way back.
  //
  // The 0.8 degree sway this carried until v0.4.4 went with the tilt: "straight"
  // was the ask, and a card that is never rotated by anything is the only
  // version of that which cannot be argued with. It drifts, it does not lean.
  const startIdle = () => {
    const tl = gsap
      .timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } })
      .to(floater, { y: -11, duration: 3.4 }, 0)
      .to(floater, { x: 5, duration: 5.2 }, 0);

    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) tl.play();
        else tl.pause();
      },
      { rootMargin: '120px 0px' },
    ).observe(root);
  };

  /* The headline's permanent swell (v0.4.5) is entirely CSS; the only thing
     this owns is WHEN it is allowed to run, and both gates matter.

     It starts on the entrance timeline's completion, not on load, because
     until then GSAP is writing the words in and a second motion underneath
     that reads as a stumble rather than as a swell. It parks whenever the
     headline is off screen, because §GPU floor rule 2 is that nothing loops
     forever out of sight, and a headline at the top of a page thousands of px
     tall is out of sight for most of a session.

     Dropping and re-adding the class restarts the cycle rather than resuming
     its phase, which is free and invisible: the only moment it can happen is
     one where nobody is looking at the element. */
  const liveHeadline = () => {
    const headline = document.querySelector('.hero__headline');
    if (!headline) return;
    headline.classList.add('is-alive');
    if (!('IntersectionObserver' in window)) return;
    new IntersectionObserver(
      ([entry]) => headline.classList.toggle('is-alive', entry.isIntersecting),
      { rootMargin: '120px 0px' },
    ).observe(headline);
  };

  /* orchestrated entrance — one timeline, fired as the preloader wipes (§6.1→§6.3) */
  const enter = () => {
    if (entered) return;
    /* v0.3.8: the headline arrives word by word instead of as two slabs.
       Each .line keeps its own mask and its own place in the timeline; the
       split just subdivides what travels inside it, so the shape of the
       entrance is unchanged and only its grain is finer.

       GSAP owns these outright: sections.css scopes the .rv-w transition off
       inside .hero__headline, because a CSS transition on an element GSAP
       writes every frame is the classic two-owners bug, and this file's whole
       structure exists to avoid exactly that. Falling back to the line
       elements themselves keeps a one word headline working. */
    const lines = [...document.querySelectorAll('.hero__headline .line__inner')].flatMap((line) => {
      const words = splitWords(line);
      // same handover the masked headings make: once the words carry their own
      // clip they carry their own descender allowance too, and .line keeping
      // its copy of it measured 6px of extra headline height on a phone
      if (words) line.parentElement.classList.add('is-split');
      return words || [line];
    });
    const eyebrow = document.querySelector('.hero__eyebrow');
    const soft = ['.hero__sub', '.hero__ctas', '.hero__facts']
      .map((s) => document.querySelector(s))
      .filter(Boolean);

    gsap.set(lines, { yPercent: 112 });
    gsap.set([eyebrow, ...soft], { autoAlpha: 0, y: 16 });
    // no `rotation` in the from state since v0.4.4: the card arrives square and
    // stays square, which is the whole point of the pass
    gsap.set(root, { autoAlpha: 0, y: 54, scale: 0.96 });

    gsap
      .timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          entered = true;
          startIdle();
          liveHeadline();
        },
      })
      .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.05)
      // stagger tightened from 0.1 with the v0.3.8 word split: five boxes on
      // the old per line spacing would have run half a second long and left
      // the last word arriving after the card had settled
      .to(lines, { yPercent: 0, duration: 0.9, stagger: 0.055 }, 0.1)
      // 0.14 not 0.22: the card is the LCP element and its paint clock starts
      // at first nonzero opacity — still fully behind the curtain either way
      .to(root, { autoAlpha: 1, y: 0, scale: 1, duration: 1.15 }, 0.14)
      .to(soft, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.42);
  };

  return { enter };
}
