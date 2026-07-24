/* ------------------------------------------------------------------
   The low poly mesh — geometry, palette, and the contrast gate.
   SHARED, on purpose, by two consumers that must never drift apart:

     - scripts/generate-bg-mesh.mjs (Node) writes the committed
       src/assets/bg/mesh.svg. That file is the no JS / reduced motion /
       no WebGL fallback, and it is what paints before the bundle lands.
     - src/modules/oceanMesh.js builds its WebGL vertex buffers from the
       SAME lattice, so the animation's rest state is pixel for pixel the
       static SVG. If these diverged you would see the background jump
       when the canvas fades in.

   Everything here is pure and deterministic: same base colour in, byte
   identical output. No Date, no Math.random.
   ------------------------------------------------------------------ */

/* The deep corner of the ramp. This one value IS the background colour:
   the whole mesh is a gradient from near white to this.
   It MUST stay equal to PALETTE_CYCLE[0]: the static SVG is the animation's
   rest state, and the canvas opens on cycleBase(0). If they drift apart the
   background visibly shifts colour as the canvas fades in. */
export const DEFAULT_BASE = [235, 206, 217]; // #ebced9

/* The near white the ramp starts from (top left of the mesh). */
export const TOP = [254, 252, 253];

/* The slow colour drift (v0.3.2). Three deep stops in the same rose family,
   held at near equal luminance so the page breathes hue rather than
   brightness — a background that visibly lightens and darkens reads as a
   fault, and it would also swing the text contrast. The cycle is ~96s, far
   below the threshold where motion draws the eye.
   All three are contrast checked; see readability() and the build gate. */
export const PALETTE_CYCLE = [
  [235, 206, 217], // rose (the shipped still, and DEFAULT_BASE)
  [228, 208, 220], // cooler mauve
  [237, 206, 207], // warmer blush
];

export const MESH = {
  W: 1400, // square so `cover` crops gently in BOTH orientations
  H: 1400,
  COLS: 20,
  ROWS: 20,
  JITTER: 0.38, // lattice wander, as a fraction of a cell
  SCATTER: 0.045, // per facet lightness scatter — what makes it read faceted
  SEED: 0x8b1532,
};

/* Where each gradient stop sits along the ramp (t) and how far it has
   travelled from TOP toward the base colour (mix). */
const STOPS = [
  { t: 0.0, mix: 0.0 },
  { t: 0.36, mix: 0.3 },
  { t: 0.72, mix: 0.6 },
  { t: 1.0, mix: 1.0 },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

// mulberry32 — small, fast, seeded. Determinism is the requirement.
function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hex = (rgb) =>
  '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

export function parseHex(str) {
  const m = String(str).trim().replace(/^#/, '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

export const mixRgb = (a, b, t) => [0, 1, 2].map((j) => lerp(a[j], b[j], t));

/** Deep stop for a point in the drift cycle (0..1), wrapping smoothly. */
export function cycleBase(phase) {
  const n = PALETTE_CYCLE.length;
  const p = ((phase % 1) + 1) % 1;
  const scaled = p * n;
  const i = Math.floor(scaled);
  // smoothstep the crossfade so there is no crease as one stop hands to the next
  const k = scaled - i;
  const eased = k * k * (3 - 2 * k);
  return mixRgb(PALETTE_CYCLE[i % n], PALETTE_CYCLE[(i + 1) % n], eased);
}

/* ---- contrast, the gate on any colour choice ----------------------
   Body copy (--ink-soft) sits directly on this background on every page,
   so the palette is capped by the DARKEST FACET, which is darker than the
   base colour: SCATTER pushes individual triangles below their sampled
   value. Worst case, computed analytically.
   ------------------------------------------------------------------ */
export const INK = [34, 18, 25];
export const INK_SOFT = [95, 74, 84];
export const ACCENT = [136, 21, 50];

export function luminance([r, g, b]) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function darkestFacet(base) {
  return base.map((v) => clamp(v - MESH.SCATTER * 255, 0, 255));
}

export function readability(base) {
  const worst = darkestFacet(base);
  return {
    worst,
    worstHex: hex(worst),
    inkSoft: contrast(worst, INK_SOFT),
    ink: contrast(worst, INK),
    accent: contrast(worst, ACCENT),
    passes: contrast(worst, INK_SOFT) >= 4.5,
  };
}

/** Worst readability across the WHOLE drift cycle, sampled finely.
    The animated background must pass at every instant, not just at rest. */
export function readabilityAcrossCycle(steps = 240) {
  let worst = null;
  for (let i = 0; i < steps; i++) {
    const r = readability(cycleBase(i / steps));
    if (!worst || r.inkSoft < worst.inkSoft) worst = { ...r, phase: i / steps };
  }
  return worst;
}

/** The four ramp stop colours for a base. */
export function rampStops(base) {
  return STOPS.map((s) => ({ t: s.t, c: mixRgb(TOP, base, s.mix) }));
}

export function sampleGradient(stops, t) {
  t = clamp(t, 0, 1);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i];
    const b = stops[i + 1];
    if (t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return [0, 1, 2].map((j) => lerp(a.c[j], b.c[j], k));
    }
  }
  return stops[stops.length - 1].c.slice();
}

/* ---- geometry -----------------------------------------------------
   One pass, one PRNG, consumed in a fixed order: all lattice jitter
   first, then one scatter value per facet. Both consumers call this, so
   the static SVG and the animated buffers are the same mesh.
   ------------------------------------------------------------------ */
let cached = null;

export function buildGeometry() {
  if (cached) return cached;
  const { W, H, COLS, ROWS, JITTER, SCATTER, SEED } = MESH;
  const rand = mulberry32(SEED);

  /* Lattice, each point jittered off its seat. Edge points stay pinned on
     their axis so the mesh reaches the canvas edge exactly. (The animated
     path additionally overscans, so displaced edges never expose a gap.) */
  const pts = [];
  for (let r = 0; r <= ROWS; r++) {
    const row = [];
    for (let c = 0; c <= COLS; c++) {
      const cw = W / COLS;
      const ch = H / ROWS;
      let x = c * cw;
      let y = r * ch;
      if (c > 0 && c < COLS) x += (rand() * 2 - 1) * cw * JITTER;
      if (r > 0 && r < ROWS) y += (rand() * 2 - 1) * ch * JITTER;
      row.push([x, y]);
    }
    pts.push(row);
  }

  const raw = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tl = pts[r][c];
      const tr = pts[r][c + 1];
      const bl = pts[r + 1][c];
      const br = pts[r + 1][c + 1];
      // alternate the split so the mesh has no visible diagonal grain
      const flip = (r + c) % 2 === 0;
      const quad = flip
        ? [
            [tl, tr, br],
            [tl, br, bl],
          ]
        : [
            [tl, tr, bl],
            [tr, br, bl],
          ];
      for (const t of quad) raw.push(t);
    }
  }

  const triangles = raw.map((t) => {
    const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
    return { v: t, cx, cy, scatter: (rand() * 2 - 1) * SCATTER };
  });

  cached = { points: pts, triangles };
  return cached;
}

/** Diagonal ramp position for a point: light top left, deepest bottom right. */
export const gradientT = (x, y) => (x / MESH.W + y / MESH.H) / 2;

/** The static SVG: a base colour in, the mesh markup out. */
export function buildMeshSvg(base = DEFAULT_BASE) {
  const { W, H } = MESH;
  const stops = rampStops(base);
  const { triangles } = buildGeometry();

  const paths = triangles.map((tri) => {
    const c = sampleGradient(stops, gradientT(tri.cx, tri.cy));
    const fill = c.map((v) => v + tri.scatter * 255);
    const d = tri.v.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L');
    return `<path d="M${d}Z" fill="${hex(fill)}"/>`;
  });

  /* The backing rect is the same ramp the facets are sampled from, so the
     1px antialiasing seams between triangles reveal a near identical colour
     instead of white. Cheaper and more robust than stroking every triangle. */
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${stops
    .map((s) => `<stop offset="${s.t}" stop-color="${hex(s.c)}"/>`)
    .join('')}</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<g>${paths.join('')}</g>
</svg>
`;
}
