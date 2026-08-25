/* Generate the browser favicon set from the real BSS mark (v0.5.6).
 *
 * The tab icon and the icon Google prints beside a search result are the same
 * asset, the one declared by `<link rel="icon">`, so this script owns both.
 * Before this the site showed a maroon plate with "BSS" set in Fraunces, which
 * reads well at 16px but is not the society's actual logo; the ask was for the
 * real mark, the building over the maroon BSS.
 *
 * WHERE THE ARTWORK COMES FROM, and why the sizes stop where they do.
 * The only master in this project is the gitignored `assets/logo.png`, a
 * 375x375 raster whose ink is the full lockup. The MARK inside it, building
 * plus letters and no wordmark, measures 102x109 pixels. That number is the
 * whole size budget: every icon here is a DOWNSCALE of it, which is why they
 * are sharp. A 192 or a 512 would be a 2x to 5x upscale inventing edges that
 * were never in the artwork, the same trap `assets/brand/logo-lockup.png` is
 * capped at 257x132 to avoid, so they are deliberately not emitted.
 *
 * 96 is not an arbitrary ceiling: Google asks a favicon to be a square that is
 * a multiple of 48px and resizes it itself, so 96 satisfies the search result
 * icon with room to spare and still costs about 2KB.
 *
 * Drop a bigger PNG of the same mark at `assets/logo-mark.png` and this script
 * prefers it automatically, trimming its own white margin first, and then the
 * larger sizes become honest and can be switched on in SIZES.
 *
 * WHITE PLATE, NOT TRANSPARENCY, and that is not a shortcut. The building is
 * drawn in near black outline. On a transparent icon a dark browser theme puts
 * that linework on a dark tab strip and the top half of the logo disappears.
 * Same reason logo-lockup.png is flattened, written up in CLAUDE.md: third
 * parties composite this onto surfaces we do not choose.
 *
 * Deterministic: same input gives byte identical output, so a rerun that
 * changes nothing produces no diff.
 *
 * Run: node scripts/generate-favicons.mjs [--write]
 * Without --write it measures and prints, and touches nothing.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const ROOT = process.cwd();
const BRAND = path.join(ROOT, 'public/assets/brand');

const OVERRIDE = path.join(ROOT, 'assets/logo-mark.png');
const MASTER = path.join(ROOT, 'assets/logo.png');

// The mark's share of the square canvas. A favicon is 16 device pixels at its
// smallest, so margin there is not breathing room, it is thrown away detail;
// 0.9 keeps the mark off the tab's own edge without spending much on air.
const FILL = 0.9;

// Sizes, all at or below the 102x109 the master can honestly carry.
//
// `levels` is on at 16 alone, and the split is a measured one rather than a
// taste one. A 6.4x downscale averages the building's hairline outlines into
// pale grey and the word turns to a smudge; a contrast stretch afterwards puts
// the strokes back and makes BSS readable again. It costs colour fidelity,
// pulling the maroon toward black, which is the right trade at 16px and the
// wrong one at 32, where the plain resample is already legible and the letters
// still read as the brand maroon. Compared side by side before choosing.
const SIZES = [
  { file: 'favicon-16.png', px: 16, sharpen: true, levels: true },
  { file: 'favicon-32.png', px: 32, sharpen: true, levels: false },
  { file: 'favicon-48.png', px: 48, sharpen: true, levels: false },
  { file: 'favicon-96.png', px: 96, sharpen: false, levels: false },
];

const isInk = (data, i) => {
  if (data[i + 3] < 16) return false;
  return !(data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245);
};

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

/* Ink bounds: anything that is neither transparent nor near white. */
function inkBox({ data, W, H }) {
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isInk(data, (y * W + x) * 4)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('image has no ink');
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/* Split the mark out of the lockup. The master is one image with the wordmark
 * to the right of a divider rule, so walking right from the ink's left edge
 * until a gap appears that is wider than the space between two strokes lands
 * on the mark's right edge. On an override file there is only the mark, so the
 * whole ink box is it. */
function markBox(img, isLockup) {
  const box = inkBox(img);
  if (!isLockup) return box;
  const { data, W, H } = img;
  const inked = (x) => {
    for (let y = 0; y < H; y++) if (isInk(data, (y * W + x) * 4)) return true;
    return false;
  };
  const GAP = Math.max(4, Math.round(box.width * 0.04));
  let right = box.left, run = 0;
  for (let x = box.left; x <= box.left + box.width; x++) {
    if (inked(x)) { right = x; run = 0; } else if (++run >= GAP) break;
  }
  let minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = box.left; x <= right; x++) {
      if (!isInk(data, (y * W + x) * 4)) continue;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      break;
    }
  }
  return { left: box.left, top: minY, width: right - box.left + 1, height: maxY - minY + 1 };
}

const src = fs.existsSync(OVERRIDE) ? OVERRIDE : MASTER;
const isLockup = src === MASTER;
const meta = await sharp(src).metadata();
const box = markBox(await raw(src), isLockup);

// Square canvas sized so the mark's longest side lands at FILL of it.
const canvas = Math.round(Math.max(box.width, box.height) / FILL);
const padX = Math.round((canvas - box.width) / 2);
const padY = Math.round((canvas - box.height) / 2);

console.log(`source     ${path.relative(ROOT, src)}  ${meta.width}x${meta.height}${isLockup ? '  (lockup, mark split out)' : '  (mark)'}`);
console.log(`mark       ${box.width}x${box.height} at ${box.left},${box.top}`);
console.log(`canvas     ${canvas}x${canvas}  mark at ${padX},${padY}  fill ${(Math.max(box.width, box.height) / canvas).toFixed(3)}`);

const plate = await sharp(src)
  .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
  .flatten({ background: '#ffffff' })
  .extend({
    top: padY,
    bottom: canvas - box.height - padY,
    left: padX,
    right: canvas - box.width - padX,
    background: '#ffffff',
  })
  .png()
  .toBuffer();

for (const { file, px, sharpen, levels } of SIZES) {
  let pipe = sharp(plate).resize(px, px, { kernel: 'lanczos3' });
  // Line art this fine loses its window mullions to the resampler well before
  // it loses the silhouette, so the small sizes get the detail put back.
  if (sharpen) pipe = pipe.sharpen({ sigma: 0.6, m1: 0.6, m2: 1.6 });
  // Contrast stretch pinned near white, so the plate stays 255 and everything
  // the resampler washed out is pulled back down toward its original ink.
  if (levels) pipe = pipe.linear(1.55, -0.55 * 235);
  const out = await pipe
    .flatten({ background: '#ffffff' })
    // Palette PNGs: this artwork is three colours and their edges, so an
    // indexed image is far smaller and measures as visually identical.
    .png({ palette: true, quality: 100, effort: 10, compressionLevel: 9 })
    .toBuffer();
  const dest = path.join(BRAND, file);
  const prev = fs.existsSync(dest) ? fs.statSync(dest).size : null;
  console.log(
    `${file.padEnd(16)} ${String(px).padStart(3)}px  scale ${(px / canvas).toFixed(2)}x  ` +
      `${String(out.length).padStart(5)}B` +
      (prev === null ? '  (new)' : `  was ${prev}B`)
  );
  if (WRITE) fs.writeFileSync(dest, out);
}

console.log(WRITE ? 'written' : 'dry run, nothing written (pass --write)');
