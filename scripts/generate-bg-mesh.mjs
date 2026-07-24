/* ------------------------------------------------------------------
   Writes src/assets/bg/mesh.svg — the low poly triangle mesh that is the
   site background since v0.3.1 (user brief: replicate a faceted gradient
   mesh, in this site's palette, sitewide).

   The geometry and palette maths live in src/lib/mesh.js, SHARED with the
   animated layer (src/modules/oceanMesh.js) so the still this writes is
   exactly the animation's rest state. This file is just the writer.

   Why a generated static SVG and not a canvas:
   - Rasterized once and cached. No JS, no rAF, no per frame work, which is
     the whole point of the "don't eat GPU/CPU" half of the brief.
   - Vector, so it is exact at any DPR and any viewport. No 2x/3x assets.
   - Deterministic: the PRNG is seeded, so rebuilding produces a byte
     identical file and the design never silently drifts.

   It lives in src/ and NOT public/ on purpose: site-bg.css references it
   with a relative url(), so Vite resolves it, hashes it for caching, and
   rewrites the path against `base`. A public/ file would have to be
   referenced as /bssaub-website/... from CSS, which hardcodes the Pages
   base and would break on the custom domain flip.

   Run: node scripts/generate-bg-mesh.mjs [#hex]
   With no argument it writes the shipped DEFAULT_BASE.
   ------------------------------------------------------------------ */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  buildMeshSvg,
  readability,
  parseHex,
  hex,
  DEFAULT_BASE,
  PALETTE_CYCLE,
  MESH,
  cycleBase,
  darkestFacet,
  contrast,
  INK_SOFT,
} from '../src/lib/mesh.js';

/* The animated path (oceanMesh.js) darkens each fragment by up to 2% with its
   screen space dither, and it walks the whole PALETTE_CYCLE rather than
   sitting on one base. Both have to be inside the contrast budget, so the
   gate below checks the worst instant of the cycle, dither included, not
   just the still that this script writes. */
const SHADER_DITHER = 0.02;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '../src/assets/bg/mesh.svg');

const arg = process.argv[2];
const base = arg ? parseHex(arg) : DEFAULT_BASE;
if (arg && !base) {
  console.error(`not a hex colour: ${arg}`);
  process.exit(1);
}

const r = readability(base);
console.log(`  base ${hex(base)}, darkest facet ${r.worstHex}`);
console.log(`  still: ink-soft ${r.inkSoft.toFixed(2)}:1, ink ${r.ink.toFixed(2)}:1`);

/* Worst instant of the animated cycle, dither included. */
let cyc = null;
for (let i = 0; i < 480; i++) {
  const b = cycleBase(i / 480);
  const px = darkestFacet(b).map((v) => v * (1 - SHADER_DITHER));
  const cs = contrast(px, INK_SOFT);
  if (!cyc || cs < cyc.cs) cyc = { cs, b, px };
}
console.log(`  animated worst: ink-soft ${cyc.cs.toFixed(2)}:1 at base ${hex(cyc.b)}`);

if (DEFAULT_BASE.some((v, i) => v !== PALETTE_CYCLE[0][i])) {
  console.error('\n  DEFAULT_BASE and PALETTE_CYCLE[0] differ.');
  console.error('  The static SVG is the animation rest state; they must match or');
  console.error('  the background shifts colour as the canvas fades in.');
  process.exit(1);
}

/* The gate, checked BEFORE writing: body copy sits directly on this
   background on every page, so a colour that fails here is not shippable
   however good it looks. Bailing before the write means a bad hex can never
   leave a broken asset on disk for someone to commit by accident. */
const failures = [];
if (!r.passes) failures.push(`still at ${r.inkSoft.toFixed(2)}:1`);
if (cyc.cs < 4.5) failures.push(`animated cycle at ${cyc.cs.toFixed(2)}:1`);
if (failures.length) {
  console.error(`\n  FAILS AA for --ink-soft body copy (needs 4.5:1): ${failures.join(', ')}.`);
  console.error('  Nothing written. Lighten the colour and run again.');
  process.exit(1);
}

const svg = buildMeshSvg(base);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg, 'utf8');

const facets = MESH.COLS * MESH.ROWS * 2;
console.log(`  AA ok`);
console.log(
  `wrote ${OUT} (${facets} facets, ${(Buffer.byteLength(svg) / 1024).toFixed(1)} KB raw)`
);
