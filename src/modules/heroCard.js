// Hero membership card (§6.3): CSS 3D tilt + glare driven by the pointer on
// fine-pointer devices, gyro tilt on mobiles that deliver events without a
// permission prompt (iOS 13+ needs a gesture flow, so it keeps the idle
// float), and a slow idle float/sway so the card never sits dead.
// Also owns the orchestrated hero entrance the preloader hands off to.
import gsap from 'gsap';

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

  if (window.matchMedia('(pointer: fine)').matches) {
    root.addEventListener('pointermove', (e) => {
      if (!entered) return;
      const r = root.getBoundingClientRect();
      const nx = gsap.utils.clamp(-1, 1, ((e.clientX - r.left) / r.width) * 2 - 1);
      const ny = gsap.utils.clamp(-1, 1, ((e.clientY - r.top) / r.height) * 2 - 1);
      applyTilt(nx, ny);
    });
    root.addEventListener('pointerleave', resetTilt);
  } else if (
    window.DeviceOrientationEvent &&
    typeof DeviceOrientationEvent.requestPermission !== 'function'
  ) {
    window.addEventListener(
      'deviceorientation',
      (e) => {
        if (!entered || e.gamma == null || e.beta == null) return;
        const nx = gsap.utils.clamp(-1, 1, e.gamma / 28);
        const ny = gsap.utils.clamp(-1, 1, (e.beta - 40) / 32);
        applyTilt(nx, ny, 0.8);
      },
      { passive: true },
    );
  }

  const startIdle = () => {
    gsap
      .timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } })
      .to(floater, { y: -11, duration: 3.4 }, 0)
      .to(floater, { rotation: 0.8, duration: 4.6 }, 0)
      .to(floater, { x: 5, duration: 5.2 }, 0);
  };

  /* orchestrated entrance — one timeline, fired as the preloader wipes (§6.1→§6.3) */
  const enter = () => {
    if (entered) return;
    const lines = document.querySelectorAll('.hero__headline .line__inner');
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
      .to(lines, { yPercent: 0, duration: 0.9, stagger: 0.1 }, 0.1)
      // 0.14 not 0.22: the card is the LCP element and its paint clock starts
      // at first nonzero opacity — still fully behind the curtain either way
      .to(root, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 1.15 }, 0.14)
      .to(soft, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.42);
  };

  return { enter };
}
