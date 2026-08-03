/* Generate the maskable app icon from the square brand icon (v0.5.4).
 *
 * A maskable icon is not a different picture, it is the same mark with room
 * around it. Android does not draw a manifest icon as given: it crops it to
 * whatever shape the launcher uses, circle, squircle, rounded square, teardrop,
 * and the only region guaranteed to survive every one of those is a circle of
 * 80% of the icon's width, centred. An icon that does not declare `maskable`
 * gets the safe treatment instead, shrunk onto a white plate, which is why the
 * current icon reads as a small square floating in a circle on a phone home
 * screen rather than as a brand.
 *
 * icon-512.png cannot simply be relabelled: its letterforms run to about 91%
 * of the width, so a circular mask would clip the outer strokes of both S's.
 * So this scales that artwork to the safe zone and lays it on a full bleed
 * plate of its own background colour, which is what makes the seam invisible.
 *
 * The plate colour is SAMPLED from the source rather than typed in, for the
 * same reason no module on this site carries a literal colour: the ground has
 * swung four times and a hardcoded maroon here would be the one copy nobody
 * remembers to update. Sampled at the top centre, which is inside the rounded
 * square and above the letters.
 *
 * Deterministic: same input gives byte identical output, so a rerun that
 * changes nothing produces no diff.
 *
 * Run: node scripts/generate-maskable-icon.mjs [--write]
 * Without --write it probes, measures and prints, and touches nothing.
 */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const WRITE = process.argv.includes('--write');
const BRAND = path.resolve(process.cwd(), 'public/assets/brand');
const SRC = path.join(BRAND, 'icon-512.png');
const OUT = path.join(BRAND, 'icon-maskable-512.png');

const SIZE = 512;
// The safe zone is a circle of 80% of the width. Scaling the whole source to
// that diameter puts every pixel of it inside the circle's bounding box, which
// is stricter than the spec asks for and leaves the corners as plate.
const SAFE = 0.8;

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

const src = sharp(SRC);
const meta = await src.metadata();
if (meta.width !== SIZE || meta.height !== SIZE) {
  console.error(`source is ${meta.width}x${meta.height}, expected ${SIZE}x${SIZE}`);
  process.exit(1);
}

const { data, info } = await src.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => {
  const i = (y * info.width + x) * info.channels;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};

// Probe: the corners tell us whether the rounded square sits on transparency
// or on opaque white, which decides whether the composite needs a flatten.
const corner = px(2, 2);
const plate = px(Math.floor(SIZE / 2), Math.floor(SIZE * 0.08));

console.log(`source     ${meta.width}x${meta.height}  channels ${meta.channels}  alpha ${meta.hasAlpha}`);
console.log(`corner     rgba(${corner.join(', ')})`);
console.log(`plate      rgba(${plate.join(', ')})  ${hex(plate)}`);

if (plate[3] !== 255) {
  console.error('plate sample is not opaque; the sample point is off the artwork');
  process.exit(1);
}

const inner = Math.round(SIZE * SAFE);
const offset = Math.round((SIZE - inner) / 2);
console.log(`composite  ${inner}x${inner} at ${offset},${offset} on ${hex(plate)}`);

const resized = await src
  .clone()
  .resize(inner, inner, { kernel: 'lanczos3' })
  // Any transparency in the source (its rounded corners) becomes the plate
  // colour here, so the inner artwork's silhouette cannot show as a seam.
  .flatten({ background: { r: plate[0], g: plate[1], b: plate[2] } })
  .toBuffer();

const out = await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 3,
    background: { r: plate[0], g: plate[1], b: plate[2] },
  },
})
  .composite([{ input: resized, top: offset, left: offset }])
  .png({ palette: true, compressionLevel: 9, effort: 10 })
  .toBuffer();

const before = fs.existsSync(OUT) ? fs.statSync(OUT).size : 0;
console.log(`output     ${(out.length / 1024).toFixed(1)}KB${before ? ` (was ${(before / 1024).toFixed(1)}KB)` : ''}`);

if (!WRITE) {
  console.log('\ndry run, nothing written. Pass --write to emit the icon.');
  process.exit(0);
}

fs.writeFileSync(OUT, out);
console.log(`wrote      ${path.relative(process.cwd(), OUT)}`);
