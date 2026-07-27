// Honest preloader (§6.1): progress tracks real asset readiness — both display
// fonts plus every [data-preload] image, which since v0.4.6 means the FIRST
// SCREEN and nothing else (the hero card art and the nav lockup).
// Floor ~400ms so it never flashes; hard cap ~4s so a bad network never gates
// entry — whatever is still loading finishes quietly behind the page.
//
// The 25 sponsor bubbles left this manifest at v0.4.6 and the reasoning is the
// point, because "wait for everything" reads as the careful option and was not:
// 159KB of artwork for section FOUR was holding the curtain shut over a hero
// that had been fully painted for a second, on the exact page whose whole job
// is to get a student to the membership card. It was also 25 requests competing
// for bandwidth with the card art and the fonts inside the one window where
// contention is most expensive, which is the same measurement that keeps font
// preloads off this page (see vite.config.js).
//
// Nothing regressed by dropping them, because the field learned to wait for
// itself: a bubble now holds its arrival until its own photo is complete
// (perkField.js), so a coin that used to be guaranteed-loaded-but-early is now
// guaranteed-loaded-when-it-inflates. The old guarantee was softer than it
// looked anyway — the 4s cap could always let a visitor in mid download.
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

  // every [data-preload] image: the hero card art and the nav lockup (§6.1)
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
