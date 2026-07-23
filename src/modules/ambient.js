// Ambient background (v0.0.5): aurora wine blobs + scroll-reactive dust + sea
// shimmer. One fixed canvas behind all content, over the static CSS washes and
// under the film grain (base.css). The dust inherits a fraction of Lenis
// velocity, echoing the Perk Field's scroll physics site-wide; the blobs give
// the ground slow breathing color so the page never sits flat.
// Reduced motion: never initialized — the CSS washes + grain still carry depth.
import gsap from 'gsap';

const COUNT = {
  blobs: { d: 3, m: 2 },
  dust: { d: 60, m: 30 },
  streaks: { d: 5, m: 3 },
};

const rnd = (a, b) => a + Math.random() * (b - a);

export function initAmbient(scroll) {
  if (scroll.reduced) return null;

  const canvas = document.createElement('canvas');
  canvas.className = 'ambient';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  // aurora blobs render at 1/8 resolution and scale up — they are pure soft
  // gradients, so the upsample is invisible and the fill cost drops ~98%
  const blobCanvas = document.createElement('canvas');
  const bctx = blobCanvas.getContext('2d');

  const mobile = () => window.matchMedia('(max-width: 47.99rem)').matches;
  let W = 0;
  let H = 0;
  let blobs = [];
  let dust = [];
  let streaks = [];

  function spawnBlob(i) {
    const rose = i === 1; // one blob leans rose, the rest deep wine
    return {
      px: rnd(0.15, 0.85),
      py: rnd(0.2, 0.8),
      rx: rnd(0.1, 0.2),
      ry: rnd(0.12, 0.24),
      w1: rnd(0.00006, 0.00012) * (Math.random() < 0.5 ? 1 : -1), // ~1–3 min orbits
      w2: rnd(0.00005, 0.0001) * (Math.random() < 0.5 ? 1 : -1),
      p1: rnd(0, Math.PI * 2),
      p2: rnd(0, Math.PI * 2),
      r: rnd(0.38, 0.55), // fraction of the viewport's larger side
      a: rose ? rnd(0.045, 0.06) : rnd(0.07, 0.1),
      rose,
      breathe: rnd(0, Math.PI * 2),
      breatheSpeed: rnd(0.00008, 0.00016),
    };
  }

  function spawnMote(scattered) {
    const depth = rnd(0.35, 1); // 1 = close: bigger, brighter, streams faster
    return {
      x: rnd(0, W),
      y: scattered ? rnd(0, H) : 0, // caller re-seats edge entries
      r: 0.7 + depth * 1.5,
      depth,
      rose: Math.random() < 0.35, // a third carry the accent tint
      a: rnd(0.07, 0.2) * (0.5 + depth * 0.5),
      drift: rnd(0, Math.PI * 2),
      driftSpeed: rnd(0.00018, 0.00045),
      rise: rnd(0.02, 0.09), // px/frame upward bias — dust in a light shaft
      tw: rnd(0, Math.PI * 2),
      twSpeed: rnd(0.0006, 0.0016),
    };
  }

  function spawnStreak(scattered) {
    const w = rnd(220, 460);
    return {
      x: scattered ? rnd(-w, W) : -w,
      dir: Math.random() < 0.5 ? 1 : -1,
      y: rnd(H * 0.12, H * 0.92),
      w,
      speed: rnd(0.14, 0.34), // px/frame — a crossing takes ~a minute
      a: rnd(0.03, 0.06),
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
    blobCanvas.width = Math.max(2, W >> 3);
    blobCanvas.height = Math.max(2, H >> 3);
    const m = mobile();
    blobs = Array.from({ length: m ? COUNT.blobs.m : COUNT.blobs.d }, (_, i) => spawnBlob(i));
    dust = Array.from({ length: m ? COUNT.dust.m : COUNT.dust.d }, () => spawnMote(true));
    streaks = Array.from({ length: m ? COUNT.streaks.m : COUNT.streaks.d }, () => spawnStreak(true));
  }

  let lenisVel = 0;
  scroll.lenis?.on('scroll', ({ velocity }) => {
    lenisVel = velocity;
  });

  let t = 0;
  function step(dt) {
    t += dt;
    const f = dt / 16.7; // normalize to a 60fps frame
    const sv = lenisVel;
    ctx.clearRect(0, 0, W, H);

    // aurora blobs — drawn small, upsampled soft
    const bw = blobCanvas.width;
    const bh = blobCanvas.height;
    bctx.clearRect(0, 0, bw, bh);
    bctx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const cx = (b.px + Math.sin(t * b.w1 + b.p1) * b.rx) * bw;
      const cy = (b.py + Math.cos(t * b.w2 + b.p2) * b.ry) * bh;
      const R = b.r * Math.max(bw, bh);
      const a = b.a * (0.72 + 0.28 * Math.sin(t * b.breatheSpeed + b.breathe));
      const g = bctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      if (b.rose) {
        g.addColorStop(0, `rgba(225, 139, 161, ${a.toFixed(3)})`);
        g.addColorStop(0.55, `rgba(163, 26, 60, ${(a * 0.5).toFixed(3)})`);
      } else {
        g.addColorStop(0, `rgba(136, 21, 50, ${a.toFixed(3)})`);
        g.addColorStop(0.55, `rgba(77, 12, 29, ${(a * 0.55).toFixed(3)})`);
      }
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, bw, bh);
    }
    bctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(blobCanvas, 0, 0, W, H);

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

  gsap.ticker.add((time, dt) => {
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
    get blobs() {
      return blobs;
    },
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
