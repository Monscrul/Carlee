/**
 * Convert body-style PNGs in assets/cars/ to true vector SVGs
 * filled with the same color as CARLEE_LOGO.svg (#eef2ff).
 *
 * Usage: npm run optimize-car-svgs
 */
import fs from 'node:fs';
import path from 'node:path';
import potrace from 'potrace';
import sharp from 'sharp';

const CARS_DIR = 'assets/cars';
const FILL = '#eef2ff'; // matches CARLEE_LOGO.svg fill/stroke

const pngFiles = fs
  .readdirSync(CARS_DIR)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort();

if (pngFiles.length === 0) {
  console.error(`No PNGs found in ${CARS_DIR}`);
  process.exit(1);
}

function traceToSvg(pngBuffer) {
  return new Promise((resolve, reject) => {
    potrace.trace(
      pngBuffer,
      {
        color: FILL,
        background: 'transparent',
        threshold: 128,
        turdSize: 2,
        optTolerance: 0.2,
      },
      (err, svg) => (err ? reject(err) : resolve(svg)),
    );
  });
}

for (const file of pngFiles) {
  const pngPath = path.join(CARS_DIR, file);
  const svgPath = path.join(CARS_DIR, file.replace(/\.png$/i, '.svg'));

  // Flatten onto white so potrace gets a clean black silhouette vs white bg
  const flattened = await sharp(pngPath)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png()
    .toBuffer();

  let svg = await traceToSvg(flattened);

  // Ensure fill matches logo even if potrace emits a different attribute order
  svg = svg.replace(/fill="[^"]*"/g, `fill="${FILL}"`);
  if (!svg.includes(`fill="${FILL}"`)) {
    svg = svg.replace(/<path/g, `<path fill="${FILL}"`);
  }

  fs.writeFileSync(svgPath, svg);
  const before = fs.statSync(pngPath).size;
  const after = Buffer.byteLength(svg);
  console.log(
    `${file} → ${path.basename(svgPath)}  (${before} B PNG → ${after} B SVG)`,
  );
}

console.log(`Done. Fill color: ${FILL}`);
