/* Re-encode the shipped rasters, with a measured quality gate (v0.4.6).
 *
 * Every image here is already a WebP, so the win is not "convert to a modern
 * format", it is that the originals were encoded at whatever the exporter's
 * default was and never re-measured. This walks a ladder of encoder settings
 * per file, decodes each candidate back to pixels, and keeps the SMALLEST one
 * that still measures visually identical to what ships today.
 *
 * The gate is PSNR against the CURRENT asset, not against some pristine
 * master, which is the right question: "does this look like what we ship?".
 * 40dB is the usual visually-lossless floor for photographs; the floors below
 * sit well above it because a second lossy pass compounds with the first, and
 * because a flat logo shows ringing long before a photograph does. A file that
 * cannot meet its floor is LEFT ALONE — the script never trades quality for
 * bytes on its own initiative, it only collects the free money.
 *
 * Deliberately NOT done here:
 *   - resizing. 320px sponsor coins render at ~141 CSS px on a 1440 desktop
 *     and ~91 on a 375 phone, i.e. 282 and 273 device pixels at those DPRs,
 *     so 320 is already the honest size and dropping it would be visible on
 *     the next phone with a denser screen.
 *   - AVIF. It would win maybe another 20% of these bytes, but it needs a
 *     <picture> fallback (the src is derived from sponsors.js in three
 *     places), and 26 AVIF decodes on the main thread before the preloader
 *     can finish is a real cost paid in the exact window this pass exists to
 *     shorten. Worth revisiting only with a decode measurement beside it.
 *
 * Run: node scripts/optimize-images.mjs [--write]
 * Without --write it measures and prints, and touches nothing.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const ROOT = path.resolve(process.cwd(), 'public/assets');

// Don't rewrite a tracked binary for pocket change: a 14 byte win is a diff
// reviewers have to take on faith against a file they cannot read.
const MIN_SAVING = 512;

// PSNR floor per family. Higher = stricter = fewer bytes saved.
const GROUPS = [
  { dir: 'sponsors', floor: 46 }, // marks and logotypes: ringing shows early
  { dir: 'card', floor: 48 },     // the LCP element, and it carries alpha
  { dir: 'journey', floor: 44 },  // photographs, rendered smaller than native
  { dir: 'brand', floor: 48 },
];

const walk = (d) =>
  fs.existsSync(d)
    ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
      )
    : [];

// PSNR over RGB plus alpha, in dB. Infinity when the decode is bit identical.
function psnr(a, b) {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  const mse = sum / a.length;
  return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
}

const raw = (buf) => sharp(buf).ensureAlpha().raw().toBuffer();

// The ladder, cheapest bytes first. `effort: 6` is the encoder's slowest
// setting: it costs build time only, never a byte or a millisecond in the
// browser, so there is no reason not to spend it.
const CANDIDATES = [
  { label: 'q72', opts: { quality: 72, effort: 6, smartSubsample: true } },
  { label: 'q78', opts: { quality: 78, effort: 6, smartSubsample: true } },
  { label: 'q84', opts: { quality: 84, effort: 6, smartSubsample: true } },
  { label: 'q90', opts: { quality: 90, effort: 6, smartSubsample: true } },
  { label: 'q95', opts: { quality: 95, effort: 6, smartSubsample: true } },
  { label: 'lossless', opts: { lossless: true, effort: 6 } },
];

const files = GROUPS.flatMap((g) =>
  walk(path.join(ROOT, g.dir))
    .filter((f) => f.endsWith('.webp'))
    .map((f) => ({ file: f, floor: g.floor })),
);

let before = 0;
let after = 0;
const rows = [];

for (const { file, floor } of files) {
  const src = fs.readFileSync(file);
  const srcPx = await raw(src);
  let best = null;

  for (const c of CANDIDATES) {
    // eslint-disable-next-line no-await-in-loop
    const out = await sharp(src).webp(c.opts).toBuffer();
    if (src.length - out.length < MIN_SAVING) continue;
    // eslint-disable-next-line no-await-in-loop
    const q = psnr(srcPx, await raw(out));
    if (q < floor) continue;
    if (!best || out.length < best.buf.length) best = { buf: out, q, label: c.label };
  }

  before += src.length;
  after += best ? best.buf.length : src.length;
  rows.push({
    name: path.relative(ROOT, file).replace(/\\/g, '/'),
    from: src.length,
    to: best ? best.buf.length : src.length,
    label: best ? best.label : '—',
    q: best ? best.q : null,
  });
  if (best && WRITE) fs.writeFileSync(file, best.buf);
}

rows.sort((a, b) => b.from - b.to - (a.from - a.to));
for (const r of rows) {
  const saved = r.from - r.to;
  console.log(
    r.name.padEnd(38),
    String(r.from).padStart(7),
    '->',
    String(r.to).padStart(7),
    saved ? `(-${((saved / r.from) * 100).toFixed(0)}%)`.padStart(7) : '   kept',
    r.label.padStart(9),
    r.q === null ? '' : `${r.q === Infinity ? 'lossless' : `${r.q.toFixed(1)}dB`}`,
  );
}
console.log(
  `\n${rows.length} files  ${before} -> ${after} bytes  (-${(((before - after) / before) * 100).toFixed(1)}%)  ${WRITE ? 'WRITTEN' : 'dry run, nothing written'}`,
);
