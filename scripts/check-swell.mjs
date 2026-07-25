/* ------------------------------------------------------------------
   Proves the ocean swell is safe to ship at its current amplitude.

   "It should not look weird" is a verifiable property, not a matter of
   taste. A displaced triangle mesh fails in exactly one way: a facet turns
   inside out (its signed area flips sign) or collapses so far that it reads
   as a crease. When that starts happening the background stops looking like
   water and starts looking like static, and it happens suddenly, so eyeing
   it in a browser at one instant proves nothing.

   This walks the ACTUAL shipped lattice through a long sweep of animation
   time, at both the desktop amplitude and the capped mobile amplitude, and
   reports:
     - inverted facets (must be zero)
     - the smallest area any facet ever shrinks to, as a fraction of rest
     - peak vertex displacement, against the overscan margin that has to
       cover it or a gap opens at the screen edge

   Everything it measures comes from src/lib/mesh.js — the same SWELL table
   the vertex shader is generated from — so this cannot pass while the
   shipped shader does something else.

   Run: node scripts/check-swell.mjs
   ------------------------------------------------------------------ */
import {
  MESH,
  AMP,
  AMP_SCALE_MAX,
  OVERSCAN,
  SWELL,
  buildGeometry,
  swellAt,
} from '../src/lib/mesh.js';

const SPAN_S = 240; // seconds of animation time to sweep
const HZ = 15; // the field is smooth and slow; 15Hz resolves its extremes

const CELL = MESH.W / MESH.COLS;
const MARGIN = (MESH.W * (OVERSCAN - 1)) / 2; // mesh units of overscan a side

const area = (a, b, c) =>
  ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;

function sweep(amp) {
  const { triangles } = buildGeometry();
  const rest = triangles.map((t) => area(t.v[0], t.v[1], t.v[2]));

  let inverted = 0;
  let minRatio = Infinity;
  let peakAxis = 0;
  let peakDist = 0;
  const p = [
    [0, 0],
    [0, 0],
    [0, 0],
  ];

  for (let s = 0; s <= SPAN_S * HZ; s++) {
    const t = s / HZ;
    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i];
      for (let k = 0; k < 3; k++) {
        const [x, y] = tri.v[k];
        const [dx, dy] = swellAt(x, y, t);
        const ox = dx * amp;
        const oy = dy * amp;
        p[k][0] = x + ox;
        p[k][1] = y + oy;
        const ax = Math.max(Math.abs(ox), Math.abs(oy));
        if (ax > peakAxis) peakAxis = ax;
        const d = Math.hypot(ox, oy);
        if (d > peakDist) peakDist = d;
      }
      const a = area(p[0], p[1], p[2]);
      if (Math.sign(a) !== Math.sign(rest[i])) inverted++;
      const ratio = Math.abs(a) / Math.abs(rest[i]);
      if (ratio < minRatio) minRatio = ratio;
    }
  }
  return { inverted, minRatio, peakAxis, peakDist };
}

/* The analytic worst case per axis: every term at its crest at once. The
   sweep finds what actually happens; overscan has to survive what COULD. */
const bound = (terms) => terms.reduce((s, [g]) => s + Math.abs(g), 0);
const worstAxisGain = Math.max(bound(SWELL.X), bound(SWELL.Y));

console.log(`  cell ${CELL} units, overscan margin ${MARGIN.toFixed(0)} units a side`);
console.log(`  worst case per axis: ${(worstAxisGain * AMP * AMP_SCALE_MAX).toFixed(1)} units\n`);

const cases = [
  ['desktop', AMP, 1],
  ['mobile cap', AMP * AMP_SCALE_MAX, AMP_SCALE_MAX],
];

const failures = [];
for (const [label, amp, scale] of cases) {
  const r = sweep(amp);
  const pct = ((r.peakDist / CELL) * 100).toFixed(1);
  console.log(`  ${label} (amp x${scale}, ${amp.toFixed(2)} units)`);
  console.log(`    inverted facets ....... ${r.inverted}`);
  console.log(`    smallest facet area ... ${r.minRatio.toFixed(3)} of rest`);
  console.log(`    peak displacement ..... ${r.peakDist.toFixed(1)} units (${pct}% of a cell)`);
  console.log(`    peak per axis ......... ${r.peakAxis.toFixed(1)} units\n`);

  if (r.inverted > 0) failures.push(`${label}: ${r.inverted} inverted facets`);
  /* 0.5 of rest area is the point at which a facet reads as a crease rather
     than a tilted plane. Well clear of it is the goal, not just clear of
     zero. */
  if (r.minRatio < 0.5) failures.push(`${label}: facet shrinks to ${r.minRatio.toFixed(3)} of rest`);
}

if (worstAxisGain * AMP * AMP_SCALE_MAX > MARGIN) {
  failures.push(
    `overscan margin ${MARGIN.toFixed(0)} cannot cover a ` +
      `${(worstAxisGain * AMP * AMP_SCALE_MAX).toFixed(1)} unit displacement: raise OVERSCAN`
  );
}

if (failures.length) {
  console.error(`  FAILS:\n    ${failures.join('\n    ')}`);
  process.exit(1);
}
console.log('  swell ok');
