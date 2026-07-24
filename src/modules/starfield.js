// ---------------------------------------------------------------------------
// Generative starfield + constellation tracing background (§ sky brief).
//
// One fixed <canvas> between the paper grain (z -2) and the page (z 0): a
// seeded night sky of stars in DOCUMENT space, projected each frame by
// subtracting scrollY. Clusters of stars are wired into constellations that
// trace themselves like a pen as they scroll into view; a pool of hidden
// drawings (BSS, AUB, and simple figures) is camouflaged into the field and
// only resolves once traced.
//
// Zero runtime deps: its own rAF loop and PRNG, no GSAP, no Lenis. It reads
// scroll.reduced when handed the scroll api but also detects reduced motion
// on its own so it stays framework agnostic. initStarfield(config) returns a
// small handle: { begin, regenerate, seed, destroy }.
//
// The whole layer is a dirty-flag loop: it only repaints while something is
// animating (pop-in, twinkle, tracing, fades) or the scroll moved, and it
// parks itself entirely when the tab is hidden.
// ---------------------------------------------------------------------------
import DRAWINGS from '../data/drawings.js';

// -- config -----------------------------------------------------------------
// Every knob the brief asks to expose, with the defaults chosen below. See the
// summary this module logs at the end of initStarfield for the reasoning.
const DEFAULTS = {
  seed: null, // null = fresh crypto seed each load; a number forces a sky
  starColor: '237, 233, 224', // #EDE9E0 warm off white, one hue at many alphas
  starDensity: 11000, // px² of document per star (desktop)
  tierRatios: { bright: 0.07, medium: 0.25 }, // dim = the remainder
  twinkle: { enabled: true, amplitude: 0.15, periodMs: [3000, 7000], maxAnimated: 80, frameMs: 50 },
  popIn: { enabled: true, durationMs: 2100, starMs: 450 },
  constellationsPerViewport: [1, 2],
  clusterRadiusPx: [250, 400],
  clusterSize: [4, 8],
  segMinPx: 30,
  segMaxPx: 220,
  traceSpeedMs: 160, // per segment, random constellations
  drawingTraceSpeedMs: 200, // per segment, drawings (more deliberate, §7)
  traceStarPauseMs: 90,
  traceGapMs: 250, // gap between queued traces
  traceOpacity: 0.5, // warm-white line alpha on the dark ground; 0.35 read too faint in practice
  traceBow: 0.02, // quadratic control offset as a fraction of segment length
  starGapPx: 5, // gap where a line meets a star glow (§5)
  retraceOnReenter: false,
  fadeOutMs: 400,
  fadeInMs: 450,
  reenterRetraceAfterMs: 60000, // off screen longer than this = 2x re-trace
  drawings: DRAWINGS,
  randomDrawingCount: [2, 4], // besides the always-show letter groups
  chaosDefault: 0.35,
  drawingSizePx: [240, 380],
  drawingMinVGapPx: 600,
  excludeSelectors: ['.hero__headline'],
  mobile: { breakpoint: 768, densityMultiplier: 0.55, twinkle: false, popScale: 0.7 },
  respectReducedMotion: true,
};

// one level of nesting is all the config has, so a shallow-with-objects merge
function mergeConfig(base, over) {
  const out = { ...base };
  if (!over) return out;
  for (const k of Object.keys(over)) {
    const v = over[k];
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...base[k], ...v } : v;
  }
  return out;
}

// -- seeded PRNG (mulberry32) ------------------------------------------------
// Every random draw in the module comes from one seed, so ?skySeed=N replays a
// sky exactly and each fresh load differs. generate() re-seeds from the same
// number, which is why a resize rebuild lands the identical topology.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rangeOf = (rng, lo, hi) => lo + (hi - lo) * rng();
const intOf = (rng, lo, hi) => Math.floor(lo + (hi - lo + 1) * rng());
function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// -- easing ------------------------------------------------------------------
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); // 0 -> ~1.15 -> 1
}
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// -- geometry helpers --------------------------------------------------------
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// proper segment intersection (used to reject self-crossing constellation paths)
function segmentsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  return o1 !== o2 && o3 !== o4;
}

// -- star sprites ------------------------------------------------------------
// Each tier's glow is baked ONCE to an offscreen canvas at device resolution
// (§5 performance rule: never shadowBlur per star per frame). Per-star radius
// variety comes from scaling the sprite at drawImage time; per-star opacity
// from globalAlpha. Bright stars get a second variant with a faint 4-point
// flare. Colour is the single warm off-white at full alpha; alpha is modulated
// at draw.
function makeSprite(dpr, color, coreR, glowR, flare) {
  const cssSize = glowR * 2;
  const px = Math.ceil(cssSize * dpr);
  const cv = document.createElement('canvas');
  cv.width = px;
  cv.height = px;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const c = glowR; // centre in css px

  if (glowR > coreR * 1.7) {
    const grad = g.createRadialGradient(c, c, 0, c, c, glowR);
    grad.addColorStop(0, `rgba(${color}, 0.85)`);
    grad.addColorStop(0.35, `rgba(${color}, 0.3)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, cssSize, cssSize);
  }
  if (flare) {
    g.strokeStyle = `rgba(${color}, 0.28)`;
    g.lineWidth = 0.7;
    g.lineCap = 'round';
    const len = glowR * 0.92;
    g.beginPath();
    g.moveTo(c - len, c);
    g.lineTo(c + len, c);
    g.moveTo(c, c - len);
    g.lineTo(c, c + len);
    g.stroke();
  }
  // solid core with a hair of feather so dim stars still read on the grain
  const core = g.createRadialGradient(c, c, 0, c, c, coreR * 1.5);
  core.addColorStop(0, `rgba(${color}, 1)`);
  core.addColorStop(0.6, `rgba(${color}, 1)`);
  core.addColorStop(1, `rgba(${color}, 0)`);
  g.fillStyle = core;
  g.beginPath();
  g.arc(c, c, coreR * 1.5, 0, Math.PI * 2);
  g.fill();

  return { canvas: cv, cssSize, refR: coreR };
}

// -- the module --------------------------------------------------------------
export function initStarfield(userConfig = {}) {
  const cfg = mergeConfig(DEFAULTS, userConfig);
  const params = new URLSearchParams(window.location.search);

  // Authoring tool takes over the screen entirely; the field never runs beside
  // it. Lazy import so the editor is a separate chunk that normal loads never
  // fetch (§7 authoring tool).
  if (params.get('skyEditor') === '1') {
    import('./skyEditor.js').then((m) => m.initSkyEditor(cfg)).catch(() => {});
    return { begin() {}, regenerate() {}, destroy() {}, seed: null };
  }

  const reduced =
    cfg.respectReducedMotion &&
    (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      params.has('reduced-motion') ||
      userConfig.reduced === true);

  const isMobile = window.matchMedia(`(max-width: ${cfg.mobile.breakpoint}px)`).matches;
  const twinkleOn = cfg.twinkle.enabled && !reduced && !(isMobile && !cfg.mobile.twinkle);

  // seed: forced by ?skySeed, else config, else fresh from crypto
  const forced = params.get('skySeed');
  let seed =
    forced != null && forced !== ''
      ? Number(forced) >>> 0
      : cfg.seed != null
        ? cfg.seed >>> 0
        : crypto.getRandomValues(new Uint32Array(1))[0];

  // -- canvas + DPR ----------------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.className = 'starfield-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  let dpr = 1;
  let vw = 0;
  let vh = 0;
  let sprites = null;

  function buildSprites() {
    const col = cfg.starColor;
    sprites = {
      dpr,
      tiers: [
        makeSprite(dpr, col, 0.65, 1.3, false), // dim: barely a halo
        makeSprite(dpr, col, 1.2, 4.2, false), // medium
        makeSprite(dpr, col, 2.0, 8.5, false), // bright
      ],
      brightFlare: makeSprite(dpr, col, 2.0, 8.5, true),
    };
  }

  function sizeCanvas() {
    // cap at 2: soft glows and hairline constellation lines stay crisp, while
    // the backing store on 3x phones shrinks ~55%, which is the biggest single
    // fill-rate saving for mobile
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = document.documentElement.clientWidth;
    vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = `${vw}px`;
    canvas.style.height = `${vh}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in css px, crisp on retina
  }

  // -- generation state ------------------------------------------------------
  let stars = [];
  let constellations = [];
  let pageW = 0;
  let pageH = 0;
  let popOrigin = { x: 0, y: 0 };

  function pageHeight() {
    // full scrollable height; content can grow after fonts/images, so this is
    // re-read on every regenerate
    return Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
      window.innerHeight,
    );
  }

  function exclusionRects() {
    const rects = [];
    for (const sel of cfg.excludeSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && r.height) {
          rects.push({
            x: r.left - 24,
            y: r.top + window.scrollY - 24,
            w: r.width + 48,
            h: r.height + 48,
          });
        }
      });
    }
    return rects;
  }

  const boxesOverlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ---- field: jittered grid so there are no clumps or voids (§3) -----------
  function makeField(rng) {
    const density = cfg.starDensity / (isMobile ? cfg.mobile.densityMultiplier : 1);
    const cell = Math.sqrt(density);
    const cols = Math.max(1, Math.ceil(pageW / cell));
    const rows = Math.max(1, Math.ceil(pageH / cell));
    const out = [];
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        // one star per cell, jittered inside it: even coverage, organic look
        const x = (gx + 0.15 + rng() * 0.7) * cell;
        const y = (gy + 0.15 + rng() * 0.7) * cell;
        if (x > pageW || y > pageH) continue;
        out.push(makeStar(rng, x, y));
      }
    }
    return out;
  }

  function makeStar(rng, x, y, forceTier) {
    const t = forceTier != null ? forceTier : rng();
    let tier;
    let r;
    let baseAlpha;
    if (forceTier != null) {
      tier = forceTier;
    } else if (t < cfg.tierRatios.bright) {
      tier = 2;
    } else if (t < cfg.tierRatios.bright + cfg.tierRatios.medium) {
      tier = 1;
    } else {
      tier = 0;
    }
    if (tier === 2) {
      r = rangeOf(rng, 1.6, 2.4);
      baseAlpha = rangeOf(rng, 0.82, 1);
    } else if (tier === 1) {
      r = rangeOf(rng, 1.0, 1.4);
      baseAlpha = rangeOf(rng, 0.62, 0.86);
    } else {
      r = rangeOf(rng, 0.4, 0.9);
      baseAlpha = rangeOf(rng, 0.25, 0.5);
    }
    return {
      x,
      y,
      r,
      tier,
      baseAlpha,
      flare: tier === 2 && rng() < 0.5,
      // twinkle only on medium/bright, phase/period seeded (draw caps the count)
      twinkle: twinkleOn && tier >= 1,
      tphase: rng() * Math.PI * 2,
      tperiod: rangeOf(rng, cfg.twinkle.periodMs[0], cfg.twinkle.periodMs[1]),
      delay: 0, // pop-in stagger, filled after layout
      pulse: 0, // timestamp of a trace pulse, 0 = none
      consumed: false, // reserved by a drawing, kept out of random forming
    };
  }

  // ---- drawings: place, jitter, inject, thin the field around them (§7) ----
  function placeDrawings(rng, field, excl) {
    const pool = cfg.drawings || [];
    const always = pool.filter((d) => d.alwaysShow);
    const rest = pool.filter((d) => !d.alwaysShow);
    const nExtra = intOf(rng, cfg.randomDrawingCount[0], cfg.randomDrawingCount[1]);
    const chosen = [...always, ...shuffled(rng, rest).slice(0, nExtra)];

    const margin = Math.min(80, pageW * 0.06);
    const placedBoxes = [];
    const cons = [];

    for (const d of chosen) {
      // native aspect from the point bounding box, so nothing is squashed
      let minX = 1;
      let minY = 1;
      let maxX = 0;
      let maxY = 0;
      for (const [px, py] of d.points) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      const spanX = Math.max(1e-3, maxX - minX);
      const spanY = Math.max(1e-3, maxY - minY);
      const longest = rangeOf(rng, cfg.drawingSizePx[0], cfg.drawingSizePx[1]);
      const w = spanX >= spanY ? longest : longest * (spanX / spanY);
      const h = spanY >= spanX ? longest : longest * (spanY / spanX);

      // BSS/AUB bias toward zones a reader actually reaches (§7): upper 60%.
      const yFloor = Math.min(vh * 0.45, pageH - h - margin);
      const yTopCap = d.alwaysShow ? Math.min(pageH * 0.6, pageH - h - margin) : pageH * 0.95 - h;
      let box = null;
      for (let attempt = 0; attempt < 140 && !box; attempt++) {
        const relaxGap = attempt > 90; // long pages fit the gap, short ones relax
        const x = rangeOf(rng, margin, Math.max(margin, pageW - w - margin));
        const y = rangeOf(rng, Math.max(vh * 0.3, yFloor), Math.max(yFloor + 1, yTopCap));
        const cand = { x, y, w, h };
        if (excl.some((e) => boxesOverlap(cand, e))) continue;
        const cy = y + h / 2;
        const tooClose =
          !relaxGap && placedBoxes.some((p) => Math.abs(cy - (p.y + p.h / 2)) < cfg.drawingMinVGapPx);
        if (tooClose) continue;
        box = cand;
      }
      if (!box) {
        console.warn(`[starfield] no placement for drawing "${d.id}" — skipped`);
        continue;
      }
      placedBoxes.push(box);

      // jitter the POINT DATA first, then build stars AND edges from the same
      // jittered coords, so the stars and the trace always agree (§7 critical).
      const chaos = (d.chaos != null ? d.chaos : cfg.chaosDefault) * 14;
      const conStars = d.points.map(([px, py]) => {
        const u = (px - minX) / spanX;
        const v = (py - minY) / spanY;
        const jx = (rng() * 2 - 1) * chaos;
        const jy = (rng() * 2 - 1) * chaos;
        const s = makeStar(rng, box.x + u * w + jx, box.y + v * h + jy, rng() < 0.32 ? 2 : 1);
        s.consumed = true;
        return s;
      });

      // thin field stars inside the box so noise doesn't pollute the shape
      for (const s of conStars) {
        for (const f of field) {
          if (!f.dead && Math.abs(f.x - s.x) < 18 && Math.abs(f.y - s.y) < 18) {
            if (dist(f.x, f.y, s.x, s.y) < 18) f.dead = true;
          }
        }
      }

      cons.push(buildConstellation(rng, conStars, d.edges, true, d.id));
    }
    return cons;
  }

  // ---- random constellations from leftover field stars (§5) ----------------
  function formConstellations(rng, field) {
    const cand = field.filter((s) => !s.dead && !s.consumed && s.tier >= 1);
    // spatial hash for neighbour lookups, cell = the largest cluster radius
    const cell = cfg.clusterRadiusPx[1];
    const grid = new Map();
    const key = (cx, cy) => `${cx},${cy}`;
    for (const s of cand) {
      const k = key(Math.floor(s.x / cell), Math.floor(s.y / cell));
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(s);
    }
    const near = (s, radius) => {
      const out = [];
      const cx = Math.floor(s.x / cell);
      const cy = Math.floor(s.y / cell);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = grid.get(key(cx + dx, cy + dy));
          if (!bucket) continue;
          for (const o of bucket) {
            if (o !== s && !o.used && dist(s.x, s.y, o.x, o.y) <= radius) out.push(o);
          }
        }
      }
      return out;
    };

    const cons = [];
    const bands = Math.max(1, Math.ceil(pageH / vh));
    for (let b = 0; b < bands; b++) {
      const y0 = b * vh;
      const y1 = (b + 1) * vh;
      const bandSeeds = shuffled(
        rng,
        cand.filter((s) => !s.used && s.y >= y0 && s.y < y1),
      );
      const want = intOf(rng, cfg.constellationsPerViewport[0], cfg.constellationsPerViewport[1]);
      let made = 0;
      let si = 0;
      while (made < want && si < bandSeeds.length) {
        const seed0 = bandSeeds[si++];
        if (seed0.used) continue;
        const radius = rangeOf(rng, cfg.clusterRadiusPx[0], cfg.clusterRadiusPx[1]);
        const target = intOf(rng, cfg.clusterSize[0], cfg.clusterSize[1]);
        const pool = near(seed0, radius).sort(
          (a, z) => dist(seed0.x, seed0.y, a.x, a.y) - dist(seed0.x, seed0.y, z.x, z.y),
        );
        const cluster = [seed0, ...pool.slice(0, target - 1)];
        if (cluster.length < 4) continue;

        const ordered = greedyPath(cluster);
        if (!validPath(ordered)) continue;

        ordered.forEach((s) => {
          s.used = true;
          s.consumed = true;
        });
        const edges = [];
        for (let i = 1; i < ordered.length; i++) edges.push([i - 1, i]);
        // occasional branch, the way real constellations fork (§5)
        if (rng() < 0.28 && ordered.length >= 4) {
          const mid = 1 + Math.floor(rng() * (ordered.length - 2));
          const extra = near(ordered[mid], radius * 0.7).find((o) => !o.used);
          if (extra) {
            const d0 = dist(ordered[mid].x, ordered[mid].y, extra.x, extra.y);
            if (d0 >= cfg.segMinPx && d0 <= cfg.segMaxPx) {
              extra.used = true;
              extra.consumed = true;
              ordered.push(extra);
              edges.push([mid, ordered.length - 1]);
            }
          }
        }
        cons.push(buildConstellation(rng, ordered, edges, false));
        made++;
      }
    }
    return cons;
  }

  // nearest-neighbour ordering from the left-most star
  function greedyPath(cluster) {
    const remaining = cluster.slice();
    remaining.sort((a, b) => a.x - b.x);
    const path = [remaining.shift()];
    while (remaining.length) {
      const last = path[path.length - 1];
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d0 = dist(last.x, last.y, remaining[i].x, remaining[i].y);
        if (d0 < bd) {
          bd = d0;
          bi = i;
        }
      }
      path.push(remaining.splice(bi, 1)[0]);
    }
    return path;
  }

  // reject bad segment lengths, self-crossings, and near-collinear paths (§5)
  function validPath(path) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < path.length; i++) {
      const d0 = dist(path[i - 1].x, path[i - 1].y, path[i].x, path[i].y);
      if (d0 < cfg.segMinPx || d0 > cfg.segMaxPx) return false;
    }
    for (const p of path) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    // degenerate if the whole shape hugs a line: require real 2D spread
    if (Math.min(maxX - minX, maxY - minY) < cfg.segMinPx * 0.5) return false;
    const segs = [];
    for (let i = 1; i < path.length; i++) segs.push([path[i - 1], path[i]]);
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 2; j < segs.length; j++) {
        if (i === 0 && j === segs.length - 1) continue; // shared endpoints only
        if (segmentsCross(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) return false;
      }
    }
    return true;
  }

  function buildConstellation(rng, conStars, edges, isDrawing, id) {
    const glowPad = 12;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of conStars) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    }
    const segMs = isDrawing ? cfg.drawingTraceSpeedMs : cfg.traceSpeedMs;
    // per-edge duration with a ±15% human wobble, plus a deterministic bow sign
    const durs = edges.map(() => segMs * (1 + (rng() * 2 - 1) * 0.15));
    const bows = edges.map(() => (rng() < 0.5 ? 1 : -1));
    return {
      id: id || null,
      isDrawing,
      stars: conStars,
      edges,
      durs,
      bows,
      bbox: { minX: minX - glowPad, minY: minY - glowPad, maxX: maxX + glowPad, maxY: maxY + glowPad },
      // lifecycle
      traced: false,
      tracing: false,
      queued: false,
      lineAlpha: 0,
      targetAlpha: 0,
      visible: false,
      wasOffscreen: false,
      offAt: 0,
      // active-trace runtime
      edgeIndex: 0,
      phase: 'draw',
      timer: 0,
      speedFactor: 1,
    };
  }

  // -- full deterministic build ----------------------------------------------
  function generate() {
    pageW = document.documentElement.clientWidth;
    pageH = pageHeight();
    const rng = mulberry32(seed);
    const excl = exclusionRects();

    const field = makeField(rng);
    const drawingCons = placeDrawings(rng, field, excl);
    const alive = field.filter((s) => !s.dead);
    const randomCons = formConstellations(rng, alive);

    stars = alive.filter((s) => !s.dead).concat(drawingCons.flatMap((c) => c.stars));
    constellations = [...drawingCons, ...randomCons];
    // ascending y so the draw loop binary-searches the visible slice instead of
    // walking every star each frame (bounds per-frame cost to what's on screen,
    // regardless of how tall the page gets); constellations keep object refs so
    // reordering this array is safe
    stars.sort((a, b) => a.y - b.y);

    // pop-in stagger radiates outward from a seeded origin in the first screen,
    // so the sky "comes into existence" in a wave rather than as TV static (§4)
    popOrigin = { x: rangeOf(rng, pageW * 0.2, pageW * 0.8), y: rangeOf(rng, vh * 0.2, vh * 0.7) };
    const maxR = Math.hypot(pageW, vh) * 1.1;
    const popDur = isMobile ? cfg.popIn.durationMs * cfg.mobile.popScale : cfg.popIn.durationMs;
    for (const s of stars) {
      const d0 = dist(s.x, s.y, popOrigin.x, popOrigin.y);
      s.delay = clamp01(d0 / maxR) * popDur * 0.78;
    }
  }

  // -- trace queue -------------------------------------------------------------
  let queue = [];
  let active = null;
  let nextTraceAt = 0;
  let traceAllowedAt = 0; // hero waits until pop-in has landed
  let lastPulseAt = -1;

  function enqueue(con) {
    if (con.queued || con.tracing || con === active) return;
    con.queued = true;
    queue.push(con);
  }

  function startTrace(con) {
    active = con; // THE pen: advanceTrace only steps `active`, so this must be set
    con.tracing = true;
    con.queued = false;
    con.edgeIndex = 0;
    con.phase = 'draw';
    con.timer = 0;
    con.lineAlpha = 1;
    con.stars[con.edges[0][0]].pulse = performance.now();
    lastPulseAt = performance.now();
  }

  function finishTrace(con, now) {
    con.tracing = false;
    con.traced = true;
    con.lineAlpha = 1;
    con.targetAlpha = con.visible ? 1 : 0;
    con.speedFactor = 1;
    if (!con.visible) {
      con.wasOffscreen = true;
      con.offAt = now;
    }
    active = null;
    nextTraceAt = now + cfg.traceGapMs;
  }

  // advance the one active trace; return true while it still needs frames
  function advanceTrace(now, dt) {
    if (!active) return false;
    const con = active;
    if (!con.visible) {
      // scrolled off mid-trace: finish instantly and silently (§6)
      con.edgeIndex = con.edges.length;
      finishTrace(con, now);
      return true;
    }
    const dur = con.durs[con.edgeIndex] * con.speedFactor;
    con.timer += dt;
    if (con.phase === 'draw') {
      if (con.timer >= dur) {
        con.stars[con.edges[con.edgeIndex][1]].pulse = now; // pulse the reached star
        lastPulseAt = now;
        con.phase = 'pause';
        con.timer = 0;
      }
    } else {
      if (con.timer >= cfg.traceStarPauseMs * con.speedFactor) {
        con.edgeIndex++;
        con.timer = 0;
        con.phase = 'draw';
        if (con.edgeIndex >= con.edges.length) {
          finishTrace(con, now);
          return true;
        }
      }
    }
    return true;
  }

  // -- scroll-driven lifecycle -------------------------------------------------
  function updateLifecycle(now, scrollY) {
    const vTop = scrollY;
    const vBot = scrollY + vh;
    for (const con of constellations) {
      const { minY, maxY } = con.bbox;
      const overlap = Math.max(0, Math.min(maxY, vBot) - Math.max(minY, vTop));
      const frac = overlap / Math.max(1, maxY - minY);
      con.visible = frac > 0;
      const enough = frac >= 0.4;

      if (reduced) {
        // motion stripped: no pen, just an instant fade of the finished lines
        if (enough) con.traced = true;
        if (con.traced) con.targetAlpha = con.visible ? 1 : 0;
        continue;
      }

      if (!con.traced) {
        if (enough && now >= traceAllowedAt) enqueue(con);
        continue;
      }
      if (con.tracing || con.queued) continue;

      if (con.visible) {
        if (con.wasOffscreen) {
          con.wasOffscreen = false;
          const away = now - con.offAt;
          const retrace = cfg.retraceOnReenter || away > cfg.reenterRetraceAfterMs;
          if (retrace) {
            // don't spam the full pen on every re-entry; only when opted in or
            // long gone, and then at 2x for the long-gone case (§6)
            con.speedFactor = cfg.retraceOnReenter ? 1 : 0.5;
            con.lineAlpha = 0;
            enqueue(con);
          } else {
            con.targetAlpha = 1; // gentle fade back in (§6)
          }
        } else {
          con.targetAlpha = 1;
        }
      } else {
        if (!con.wasOffscreen) {
          con.wasOffscreen = true;
          con.offAt = now;
        }
        con.targetAlpha = 0;
      }
    }
  }

  function stepFades(dt) {
    let animating = false;
    for (const con of constellations) {
      if (con.tracing) continue;
      if (con.lineAlpha === con.targetAlpha) continue;
      const ms = con.targetAlpha > con.lineAlpha ? (reduced ? 200 : cfg.fadeInMs) : reduced ? 200 : cfg.fadeOutMs;
      const step = dt / ms;
      if (con.lineAlpha < con.targetAlpha) con.lineAlpha = Math.min(con.targetAlpha, con.lineAlpha + step);
      else con.lineAlpha = Math.max(con.targetAlpha, con.lineAlpha - step);
      animating = true;
    }
    return animating;
  }

  // -- rendering ---------------------------------------------------------------
  let popStartAt = -1;
  let popEndAt = -1;

  function drawStar(s, now, scrollY, popActive, twinkleBudget) {
    const sy = s.y - scrollY;
    if (sy < -220 || sy > vh + 220) return twinkleBudget; // cull + 200px margin
    let scale = 1;
    let alpha = s.baseAlpha;

    if (popActive) {
      const t = (now - popStartAt - s.delay) / (isMobile ? cfg.popIn.starMs * 0.8 : cfg.popIn.starMs);
      if (t <= 0) return twinkleBudget; // hasn't bloomed yet
      if (t < 1) {
        scale = Math.max(0, easeOutBack(t));
        alpha *= clamp01(t * 1.4);
      }
    }
    if (s.twinkle && twinkleBudget > 0) {
      const w = Math.sin((now / s.tperiod) * Math.PI * 2 + s.tphase);
      alpha *= 1 + w * cfg.twinkle.amplitude;
      twinkleBudget--;
    }
    if (s.pulse) {
      const pt = (now - s.pulse) / 300;
      if (pt >= 1) s.pulse = 0;
      else {
        const b = Math.sin(pt * Math.PI); // 1 -> 1.5 -> 1
        scale *= 1 + 0.5 * b;
        alpha = Math.min(1, alpha * (1 + 0.6 * b));
      }
    }

    const sprite = s.flare ? sprites.brightFlare : sprites.tiers[s.tier];
    const size = sprite.cssSize * (s.r / sprite.refR) * scale;
    if (size <= 0) return twinkleBudget;
    ctx.globalAlpha = clamp01(alpha);
    ctx.drawImage(sprite.canvas, s.x - size / 2, sy - size / 2, size, size);
    return twinkleBudget;
  }

  function drawEdge(con, ei, t, scrollY) {
    const e = con.edges[ei];
    const A = con.stars[e[0]];
    const B = con.stars[e[1]];
    const ax = A.x;
    const ay = A.y - scrollY;
    const bx = B.x;
    const by = B.y - scrollY;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len;
    const uy = (by - ay) / len;
    // leave a small gap so the line touches the glow, not the core (§5)
    const gap = Math.min(cfg.starGapPx, len * 0.3);
    const a2x = ax + ux * gap;
    const a2y = ay + uy * gap;
    const b2x = bx - ux * gap;
    const b2y = by - uy * gap;
    // faint hand-traced bow: one quadratic control offset off the midpoint
    const sign = con.bows[ei] || 1;
    const cxp = (a2x + b2x) / 2 - uy * len * cfg.traceBow * sign;
    const cyp = (a2y + b2y) / 2 + ux * len * cfg.traceBow * sign;
    const steps = Math.max(2, Math.ceil(10 * t));
    ctx.moveTo(a2x, a2y);
    for (let i = 1; i <= steps; i++) {
      const u = (i / steps) * t;
      const mu = 1 - u;
      const x = mu * mu * a2x + 2 * mu * u * cxp + u * u * b2x;
      const y = mu * mu * a2y + 2 * mu * u * cyp + u * u * b2y;
      ctx.lineTo(x, y);
    }
  }

  function drawConstellation(con, scrollY) {
    if (!con.tracing && con.lineAlpha <= 0.002) return;
    const alpha = con.tracing ? 1 : con.lineAlpha;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = `rgba(${cfg.starColor}, ${(cfg.traceOpacity * alpha).toFixed(3)})`;
    ctx.lineWidth = 1; // 1 css px, crisp on retina; the 0.75 hairline read too faint
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const upto = con.tracing ? con.edgeIndex : con.edges.length;
    ctx.beginPath();
    for (let i = 0; i < upto; i++) drawEdge(con, i, 1, scrollY);
    if (con.tracing && con.edgeIndex < con.edges.length) {
      const t = con.phase === 'pause' ? 1 : easeInOut(clamp01(con.timer / (con.durs[con.edgeIndex] * con.speedFactor)));
      drawEdge(con, con.edgeIndex, t, scrollY);
    }
    ctx.stroke();
  }

  // first star at or below `top` (stars are sorted ascending y) — lets the draw
  // loop skip everything above the viewport without walking the whole array
  function firstVisibleStar(top) {
    let lo = 0;
    let hi = stars.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (stars[mid].y < top) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // -- the loop ----------------------------------------------------------------
  let running = false;
  let raf = 0;
  let lastFrame = 0;
  let lastScrollY = -1;
  let lastDraw = 0;

  function frame(nowIn) {
    const now = nowIn || performance.now();
    const dt = Math.min(50, now - lastFrame); // clamp after a stall/tab-return
    lastFrame = now;
    const scrollY = window.scrollY;
    const scrolled = scrollY !== lastScrollY;
    lastScrollY = scrollY;

    const popActive = popStartAt >= 0 && !reduced && now < popEndAt;

    updateLifecycle(now, scrollY);

    // queue → active, respecting the 250ms gap and the hero delay
    if (!active && queue.length && now >= nextTraceAt && now >= traceAllowedAt) {
      const next = queue.shift();
      if (next.visible || !next.traced) startTrace(next);
      else next.queued = false;
    }
    const tracing = advanceTrace(now, dt);
    const fading = stepFades(dt);
    const pulsing = lastPulseAt >= 0 && now - lastPulseAt < 320;

    const busy = popActive || tracing || queue.length > 0 || fading || scrolled || pulsing;
    // twinkle keeps the loop alive but is throttled to ~30fps when it is the
    // only thing moving, so idle desktop cost stays low; mobile has it off
    const twinkleOnly = twinkleOn && !busy;
    if (twinkleOnly && now - lastDraw < cfg.twinkle.frameMs) {
      raf = requestAnimationFrame(frame);
      return;
    }

    // paint — only the on-screen slice of stars, found by binary search
    ctx.clearRect(0, 0, vw, vh);
    if (sprites) {
      let budget = cfg.twinkle.maxAnimated;
      const bottom = scrollY + vh + 220;
      for (let i = firstVisibleStar(scrollY - 220); i < stars.length; i++) {
        if (stars[i].y > bottom) break;
        budget = drawStar(stars[i], now, scrollY, popActive, budget);
      }
      for (let i = 0; i < constellations.length; i++) drawConstellation(constellations[i], scrollY);
    }
    ctx.globalAlpha = 1;
    lastDraw = now;

    if (busy || twinkleOn) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false; // truly idle: park until an event wakes us
    }
  }

  function wake() {
    if (running || document.hidden) return;
    running = true;
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // -- resize / visibility -----------------------------------------------------
  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const prevDpr = dpr;
      sizeCanvas();
      if (dpr !== prevDpr) buildSprites();
      // regenerate deterministically from the same seed at the new size, then
      // mark whatever is on screen as already traced so a resize never spams
      // the pen (§ resize). Stars are present (no pop-in replay).
      generate();
      const scrollY = window.scrollY;
      for (const con of constellations) {
        const overlap =
          Math.max(0, Math.min(con.bbox.maxY, scrollY + vh) - Math.max(con.bbox.minY, scrollY));
        con.visible = overlap > 0;
        if (con.visible) {
          con.traced = true;
          con.lineAlpha = reduced ? 1 : 0;
          con.targetAlpha = 1;
        }
      }
      queue = [];
      active = null;
      wake();
    }, 200);
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      running = false;
    } else {
      wake();
    }
  }

  // -- public: begin -----------------------------------------------------------
  // Called once the preloader curtain lifts, in step with the hero entrance.
  let begun = false;
  function begin() {
    if (begun) return;
    begun = true;
    canvas.classList.add('is-visible');

    if (reduced) {
      // static sky, instant fades, no pop-in and no pen (§4/§9)
      traceAllowedAt = 0;
      updateLifecycle(performance.now(), window.scrollY);
      wake();
      return;
    }

    popStartAt = performance.now();
    const popDur = isMobile ? cfg.popIn.durationMs * cfg.mobile.popScale : cfg.popIn.durationMs;
    popEndAt = popStartAt + popDur + (isMobile ? cfg.popIn.starMs * 0.8 : cfg.popIn.starMs);
    // stars bloom, a beat of stillness, then the hero trace begins (§6)
    traceAllowedAt = popEndAt + 300;

    // hero auto-trace: enqueue the constellations that own the first screen,
    // top to bottom, right after the field lands. No scrolling required.
    const heroCons = constellations
      .filter((c) => c.bbox.minY < vh && c.bbox.maxY > 0)
      .sort((a, b) => a.bbox.minY - b.bbox.minY);
    setTimeout(() => {
      for (const c of heroCons) if (!c.traced) enqueue(c);
      wake();
    }, traceAllowedAt - performance.now());

    wake();
  }

  function regenerate(newSeed) {
    if (newSeed != null) seed = newSeed >>> 0;
    generate();
    queue = [];
    active = null;
    wake();
  }

  function destroy() {
    cancelAnimationFrame(raf);
    running = false;
    window.removeEventListener('resize', onResize);
    window.removeEventListener('scroll', wake);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.remove();
  }

  // -- boot --------------------------------------------------------------------
  sizeCanvas();
  buildSprites();
  generate();
  // final metrics only settle after the display font swaps and images reserve
  // their boxes; rebuild against them, same seed so the sky is unchanged in feel
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      const h = pageHeight();
      if (Math.abs(h - pageH) > 40) {
        generate();
        wake();
      }
    });
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('scroll', wake, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);

  if (import.meta.env.DEV) {
    console.info(
      `[starfield] seed ${seed} · ${stars.length} stars · ${constellations.length} constellations` +
        ` · reduced ${reduced} · mobile ${isMobile}`,
    );
  }

  return {
    begin,
    regenerate,
    destroy,
    get seed() {
      return seed;
    },
  };
}

export default initStarfield;
