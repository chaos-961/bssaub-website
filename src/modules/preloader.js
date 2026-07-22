// Honest preloader (§6.1): progress tracks real asset readiness — both display
// fonts plus the hero card art (sponsor bubbles join the manifest in Phase 3).
// Floor ~400ms so it never flashes; hard cap ~4s so a bad network never gates
// entry — whatever is still loading finishes quietly behind the page.
import gsap from 'gsap';

const FLOOR = 400;
const CAP = 4000;

export function initPreloader({ scroll, onComplete }) {
  const el = document.querySelector('[data-preloader]');
  const bar = el ? el.querySelector('[data-preloader-bar]') : null;
  if (!el) {
    onComplete();
    return;
  }

  const started = performance.now();
  scroll.lenis?.stop();
  document.documentElement.classList.add('u-scroll-lock');

  const jobs = [
    document.fonts.load('600 1rem "Fraunces Variable"'),
    document.fonts.load('400 1rem "Instrument Sans Variable"'),
  ];

  // every [data-preload] image: hero card art + all sponsor bubbles (§6.1) —
  // bubbles exist by now because perkField builds its DOM before this runs
  document.querySelectorAll('img[data-preload]').forEach((img) => {
    const loaded = img.complete
      ? Promise.resolve()
      : new Promise((res) => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        });
    jobs.push(loaded.then(() => img.decode().catch(() => {})));
  });

  // the bar moves via CSS transition — no ticker dependency
  let done = 0;
  const setBar = (p) => {
    if (bar) bar.style.transform = `scaleX(${p})`;
  };
  setBar(0.05);
  jobs.forEach((job) =>
    job.then(() => {
      done += 1;
      setBar(0.05 + 0.95 * (done / jobs.length));
    }),
  );

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    setBar(1);

    const release = () => {
      el.remove();
      document.documentElement.classList.remove('u-scroll-lock');
      scroll.lenis?.start();
    };

    if (scroll.reduced) {
      // simple fade (§6.1)
      el.style.transition = 'opacity 0.25s ease-out';
      el.style.opacity = '0';
      onComplete();
      setTimeout(release, 280);
    } else {
      // curtain wipes upward; hero entrance fires as it lifts
      onComplete();
      gsap.to(el, {
        yPercent: -100,
        duration: 0.85,
        ease: 'power3.inOut',
        delay: 0.12,
        onComplete: release,
      });
    }
  };

  Promise.all(jobs).then(() => {
    const wait = Math.max(0, FLOOR - (performance.now() - started));
    setTimeout(finish, wait);
  });
  setTimeout(finish, CAP);
}
