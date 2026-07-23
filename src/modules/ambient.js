// Ambient background (v0.0.4): scroll-reactive dust + a whisper of sea
// shimmer — moonlight-on-water streaks for a campus above the Mediterranean.
// One fixed canvas behind all content. §7 rule: everything outside the Perk
// Field stays quiet, so this layer whispers — tiny sizes, single-digit
// alphas, slow clocks. The dust inherits a fraction of Lenis velocity, which
// echoes the field's scroll-physics site-wide at 1% intensity.
// Reduced motion: never initialized (static ground, zero canvas work).
import gsap from 'gsap';

const COUNT = {
  dust: { d: 48, m: 26 },
  streaks: { d: 4, m: 3 },
};

const rnd = (a, b) => a + Math.random() * (b - a);

export function initAmbient(scroll) {
  if (scroll.reduced) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'ambient';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const mobile = () => window.matchMedia('(max-width: 47.99rem)').matches;
  let W = 0;
  let H = 0;
  let dust = [];
  let streaks = [];

  function spawnMote(scattered) {
    const depth = rnd(0.35, 1); // 1 = close: bigger, brighter, streams faster
    return {
      x: rnd(0, W),
      y: scattered ? rnd(0, H) : 0, // caller re-seats edge entries
      r: 0.6 + depth * 1.3,
      depth,
      rose: Math.random() < 0.3, // a third carry the accent tint
      a: rnd(0.05, 0.16) * (0.5 + depth * 0.5),
      drift: rnd(0, Math.PI * 2),
      driftSpeed: rnd(0.00018, 0.00045),
      rise: rnd(0.02, 0.085), // px/frame upward bias — dust in a light shaft
      tw: rnd(0, Math.PI * 2),
      twSpeed: rnd(0.0006, 0.0016),
    };
  }

  function spawnStreak(scattered) {
    const w = rnd(200, 420);
    return {
      x: scattered ? rnd(-w, W) : -w,
      dir: Math.random() < 0.5 ? 1 : -1,
      y: rnd(H * 0.12, H * 0.92),
      w,
      speed: rnd(0.12, 0.3), // px/frame — a crossing takes ~a minute
      a: rnd(0.02, 0.045),
      bob: rnd(0, Math.PI * 2),
      bobSpeed: rnd(0.00025, 0.0006),
      breathe: rnd(0, Math.PI * 2),
    };
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const m = mobile();
    dust = Array.from({ length: m ? COUNT.dust.m : COUNT.dust.d }, () => spawnMote(true));
    streaks = Array.from({ length: m ? COUNT.streaks.m : COUNT.streaks.d }, () => spawnStreak(true));
  }

  let lenisVel = 0;
  scroll.lenis?.on('scroll', ({ velocity }) => {
    lenisVel = velocity;
  });

  function step(dt) {
    const f = dt / 16.7; // normalize to a 60fps frame
    const sv = lenisVel;
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    // dust: slow wander + upward bias; scrolling streams it past the viewport
    for (const p of dust) {
      p.drift += p.driftSpeed * dt;
      p.tw += p.twSpeed * dt;
      p.x += Math.cos(p.drift) * 0.12 * p.depth * f;
      p.y += (-p.rise - sv * 0.055 * p.depth) * f;
      if (p.y < -8) {
        Object.assign(p, spawnMote(false));
        p.y = H + 6;
      } else if (p.y > H + 10) {
        Object.assign(p, spawnMote(false));
        p.y = -6;
      }
      if (p.x < -8) p.x = W + 6;
      else if (p.x > W + 8) p.x = -6;
      const a = p.a * (0.55 + 0.45 * Math.sin(p.tw));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.rose
        ? `rgba(225, 139, 161, ${a.toFixed(3)})`
        : `rgba(244, 239, 235, ${a.toFixed(3)})`;
      ctx.fill();
    }

    // sea shimmer: a few slow horizontal light streaks
    for (const s of streaks) {
      s.x += s.dir * s.speed * f;
      s.bob += s.bobSpeed * dt;
      s.breathe += 0.0004 * dt;
      if (s.dir > 0 && s.x > W + 40) Object.assign(s, spawnStreak(false), { dir: 1, x: -s.w });
      else if (s.dir < 0 && s.x + s.w < -40) Object.assign(s, spawnStreak(false), { dir: -1, x: W + 40 });
      const y = s.y + Math.sin(s.bob) * 6 - sv * 0.02;
      const a = s.a * (0.6 + 0.4 * Math.sin(s.breathe));
      const g = ctx.createLinearGradient(s.x, 0, s.x + s.w, 0);
      g.addColorStop(0, 'rgba(225, 139, 161, 0)');
      g.addColorStop(0.5, `rgba(225, 139, 161, ${a.toFixed(3)})`);
      g.addColorStop(1, 'rgba(225, 139, 161, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(s.x, y - 1, s.w, 2);
      ctx.globalAlpha = 0.3; // soft halo around the bright core
      ctx.fillRect(s.x, y - 4, s.w, 8);
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'source-over';
    lenisVel *= 0.9;
  }

  gsap.ticker.add((t, dt) => {
    if (document.hidden) return;
    step(Math.min(dt, 100));
  });

  let resizeId;
  window.addEventListener('resize', () => {
    clearTimeout(resizeId);
    resizeId = setTimeout(size, 250);
  });
  size();

  return {
    canvas,
    step,
    get dust() {
      return dust;
    },
    get streaks() {
      return streaks;
    },
    setVel(v) {
      lenisVel = v; // QA hook — deterministic scroll-coupling checks
    },
  };
}
