// Hero membership card (§6.3): CSS 3D tilt + glare driven by the pointer on
// fine-pointer devices, gyro tilt on mobiles that deliver events without a
// permission prompt (iOS 13+ needs a gesture flow, so it keeps the idle
// float), and a slow idle float/sway so the card never sits dead.
// Also owns the orchestrated hero entrance the preloader hands off to.
import gsap from 'gsap';
import { splitWords } from './reveal.js';

const TILT_MAX = 12; // degrees (§6.3 clamp)

export function initHeroCard(scroll) {
  const root = document.querySelector('[data-hero-card]');
  if (!root) return { enter: () => {} };

  // Reduced motion: static card, no tilt, no idle, no entrance (§7).
  if (scroll.reduced) {
    return { enter: () => {} };
  }

  const floater = root.querySelector('.hero-card__floater');
  const tilt = root.querySelector('.hero-card__tilt');
  const glare = root.querySelector('.hero-card__glare');
  const shadow = root.querySelector('.hero-card__shadow');

  let entered = false;

  gsap.set(tilt, { transformPerspective: 950 });

  // transform/opacity only — zero layout thrash
  const rx = gsap.quickTo(tilt, 'rotationX', { duration: 0.7, ease: 'power3.out' });
  const ry = gsap.quickTo(tilt, 'rotationY', { duration: 0.7, ease: 'power3.out' });
  const glareOpacity = gsap.quickTo(glare, 'opacity', { duration: 0.5, ease: 'power2.out' });
  const glareX = gsap.quickSetter(glare, '--gx', '%');
  const glareY = gsap.quickSetter(glare, '--gy', '%');
  const shadowX = gsap.quickSetter(shadow, '--sx', 'px');
  const shadowY = gsap.quickSetter(shadow, '--sy', 'px');

  // nx/ny ∈ [-1, 1]
  const applyTilt = (nx, ny, strength = 1) => {
    rx(-ny * TILT_MAX * strength);
    ry(nx * TILT_MAX * strength);
    glareX(50 + nx * 34);
    glareY(50 + ny * 34);
    glareOpacity(Math.min(1, Math.hypot(nx, ny)) * 0.5 * strength);
    // shadow shifts opposite the tilt (§6.3)
    shadowX(-nx * 18 * strength);
    shadowY(ny * 8 * strength);
  };

  const resetTilt = () => {
    rx(0);
    ry(0);
    glareOpacity(0);
    shadowX(0);
    shadowY(0);
  };

  const fine = window.matchMedia('(pointer: fine)').matches;

  /* Pointer position inside the card, normalised to [-1, 1] on both axes.
     Shared by the hover path and the press path since v0.3.9 — one reading of
     the geometry, so the two can never disagree about where the finger is. */
  const pointAt = (e) => {
    const r = root.getBoundingClientRect();
    return [
      gsap.utils.clamp(-1, 1, ((e.clientX - r.left) / r.width) * 2 - 1),
      gsap.utils.clamp(-1, 1, ((e.clientY - r.top) / r.height) * 2 - 1),
    ];
  };

  /* PRESS TO TILT (v0.3.9, user brief: make the card interactable on mobile
     too, when I press on it). A coarse pointer had nothing before this: the
     hover path below is gated behind `pointer: fine` and the gyro path behind
     a device that hands out orientation without a permission prompt, which
     iOS has not done since 13. So a phone got a flat rectangle.

     Now a press tilts the card toward the finger and holds it there, and
     sliding sideways swivels it. Sliding UP or DOWN deliberately does not:
     `touch-action: pan-y` in sections.css leaves vertical gestures to the
     browser so the page still scrolls straight through the hero, and the
     browser answers by firing pointercancel, which lands on the same release
     handler and eases the card back to rest. That is the correct outcome, not
     a compromise — a card that fought the scroll would be a trap.

     Pointer capture is taken on coarse only, so the desktop path stays bit for
     bit what it was; on touch it is what keeps the swivel alive when the
     finger slides off the card's edge mid drag. */
  /* A plain tween, NOT a quickTo like the two above it. quickTo drives a value
     through tween.resetTo(), which looks the property up by its exact name in
     the tween's own PropTween list, and CSSPlugin expands the `scale` shorthand
     into scaleX and scaleY — so a quickTo on 'scale' builds a live tween that
     reads as active and moves nothing (measured: scale pinned at 1.0000 for
     the whole press). rotationX and rotationY are registered under those exact
     names, which is why they work.
     A tween per press is the right cost anyway: this fires on a human pressing
     the card, not sixty times a second like the tilt does. */
  const pressScale = (v) =>
    gsap.to(tilt, { scale: v, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
  let pressed = false;

  const release = () => {
    if (!pressed) return;
    pressed = false;
    pressScale(1);
    if (!fine) resetTilt();
  };

  root.addEventListener('pointerdown', (e) => {
    if (!entered) return;
    pressed = true;
    pressScale(0.975);
    applyTilt(...pointAt(e));
    if (!fine) root.setPointerCapture(e.pointerId);
  });
  root.addEventListener('pointerup', release);
  root.addEventListener('pointercancel', release);

  /* One move handler for both paths: a fine pointer tracks on hover, a coarse
     one only while it is pressed. */
  root.addEventListener('pointermove', (e) => {
    if (!entered || (!fine && !pressed)) return;
    applyTilt(...pointAt(e));
  });

  if (fine) {
    root.addEventListener('pointerleave', resetTilt);
  } else if (
    window.DeviceOrientationEvent &&
    typeof DeviceOrientationEvent.requestPermission !== 'function'
  ) {
    window.addEventListener(
      'deviceorientation',
      (e) => {
        // a finger on the card outranks the tilt of the phone holding it
        if (!entered || pressed || e.gamma == null || e.beta == null) return;
        const nx = gsap.utils.clamp(-1, 1, e.gamma / 28);
        const ny = gsap.utils.clamp(-1, 1, (e.beta - 40) / 32);
        applyTilt(nx, ny, 0.8);
      },
      { passive: true },
    );
  }

  // The idle float is an infinite timeline, so it never stops on its own: it
  // used to keep animating (and keep the card + its blurred drop shadow layer
  // recompositing every frame) for the whole session, including deep down the
  // page where the hero is thousands of px away. v0.2.9 parks it whenever the
  // hero leaves the viewport and resumes on the way back.
  const startIdle = () => {
    const tl = gsap
      .timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } })
      .to(floater, { y: -11, duration: 3.4 }, 0)
      .to(floater, { rotation: 0.8, duration: 4.6 }, 0)
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
    gsap.set(root, { autoAlpha: 0, y: 54, scale: 0.96, rotation: 1.5 });

    gsap
      .timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          entered = true;
          startIdle();
        },
      })
      .to(eyebrow, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.05)
      // stagger tightened from 0.1 with the v0.3.8 word split: five boxes on
      // the old per line spacing would have run half a second long and left
      // the last word arriving after the card had settled
      .to(lines, { yPercent: 0, duration: 0.9, stagger: 0.055 }, 0.1)
      // 0.14 not 0.22: the card is the LCP element and its paint clock starts
      // at first nonzero opacity — still fully behind the curtain either way
      .to(root, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 1.15 }, 0.14)
      .to(soft, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.42);
  };

  return { enter };
}
