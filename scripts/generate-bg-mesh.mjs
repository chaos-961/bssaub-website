/* ------------------------------------------------------------------
   Generates src/assets/bg/mesh.svg — the low poly triangle mesh that
   is the site background since v0.3.1 (user brief: replicate a faceted
   gradient mesh, in this site's palette, sitewide).

   It lives in src/ and NOT public/ on purpose: site-bg.css references it
   with a relative url(), so Vite resolves it, hashes it for caching, and
   rewrites the path against `base`. A public/ file would have to be
   referenced as /bssaub-website/... from CSS, which hardcodes the Pages
   base and would break on the custom domain flip.

   Why a generated static SVG and not a canvas:
   - It is rasterized once and cached. No JS, no rAF, no per frame work,
     which is the whole point of the "don't eat GPU/CPU" half of the brief.
   - Vector, so it is exact at any DPR and any viewport. No 2x/3x assets.
   - Deterministic: the PRNG is seeded, so rebuilding produces a byte
     identical file and the design never silently drifts (same reasoning as
     the index hashed journey wander).

   Run: node scripts/generate-bg-mesh.mjs
   ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/assets/bg/mesh.svg');

/* Square-ish canvas so `background-size: cover` crops gently in BOTH
   orientations. A landscape source would have to crop ~60% of its width on a
   portrait phone, which blows the facets up to twice the intended size. */
const W = 1400;
const H = 1400;
const COLS = 20;
const ROWS = 20;

/* How far a lattice point may wander from its grid seat, as a fraction of the
   cell. Too low reads as a quilt of near identical triangles, too high makes
   slivers that look like glass shards. 0.38 keeps the irregular, organic
   facet shapes of the reference without degenerate triangles. */
const JITTER = 0.38;

/* Per facet lightness scatter. This is what actually makes it read as faceted
   rather than as a smooth gradient: neighbouring triangles sampled from the
   same gradient point must still differ slightly. In 0..1 of a full step. */
const FACET_SCATTER = 0.045;

// mulberry32 — small, fast, seeded. Determinism is the requirement here.
function mulberry32(seed) {
  return function rand() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0x8b1532); // the brand maroon, because why not

/* ---- palette ------------------------------------------------------
   The site's rose/maroon family, held LIGHT on purpose. Body copy uses
   --ink-soft #5f4a54 and sits directly on this background across every page,
   so the DEEPEST FACET, not the deepest stop, is what AA is measured against.
   Those differ: FACET_SCATTER pushes individual triangles below their sampled
   gradient colour, so the stop has to be light enough that stop-minus-scatter
   still clears 4.5:1.

   Measured, not estimated: the first cut used a #e2bfcd deep stop with 0.055
   scatter, which put the darkest rendered facet at rgb(217,183,196) and
   --ink-soft at 4.44:1 — under the floor. Lightening the deep stop and easing
   the scatter brings the worst facet back over 4.7:1 with margin to spare.
   The check is re-run against the RENDERED file, so retuning here means
   re-running it; do not trust the stop values alone.
   ------------------------------------------------------------------ */
const STOPS = [
  { t: 0.0, c: [254, 252, 253] }, // near white, warm
  { t: 0.36, c: [248, 236, 241] }, // blush
  { t: 0.72, c: [242, 221, 229] }, // pale rose
  { t: 1.0, c: [233, 201, 213] }, // dusty rose, the deep corner
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

function sampleGradient(t) {
  t = clamp(t, 0, 1);
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (t <= b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return [0, 1, 2].map((j) => lerp(a.c[j], b.c[j], k));
    }
  }
  return STOPS[STOPS.length - 1].c.slice();
}

const hex = (rgb) =>
  '#' + rgb.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

/* Lattice: (COLS+1) x (ROWS+1) points, each jittered off its seat. Edge points
   are pinned on their axis so the mesh reaches the canvas edge with no gap —
   a gap there would show the backing rect as a hard seam once `cover` crops. */
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

/* The diagonal the gradient runs along, matching the reference: light at top
   left, deepest at bottom right. Normalised so t spans 0..1 across the canvas
   corner to corner. */
const gradientT = (x, y) => (x / W + y / H) / 2;

const tris = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const tl = pts[r][c];
    const tr = pts[r][c + 1];
    const bl = pts[r + 1][c];
    const br = pts[r + 1][c + 1];
    // alternate the split direction so the mesh has no visible diagonal grain
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
    for (const t of quad) tris.push(t);
  }
}

const paths = tris.map((t) => {
  const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
  const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
  const base = sampleGradient(gradientT(cx, cy));
  // scatter this facet around the sampled colour, scaled by the palette's own
  // span so the jitter stays proportional to the gradient it rides
  const k = (rand() * 2 - 1) * FACET_SCATTER;
  const c = base.map((v) => v + k * 255);
  const d = t.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L');
  return `<path d="M${d}Z" fill="${hex(c)}"/>`;
});

/* The backing rect is the same gradient the facets are sampled from, so the
   1px antialiasing seams between triangles reveal a near identical colour
   instead of white. Cheaper and more robust than stroking every triangle. */
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">${STOPS.map(
  (s) => `<stop offset="${s.t}" stop-color="${hex(s.c)}"/>`
).join('')}</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<g>${paths.join('')}</g>
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, 'utf8');

console.log(`wrote ${OUT}`);
console.log(`  ${tris.length} facets, ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB raw`);
