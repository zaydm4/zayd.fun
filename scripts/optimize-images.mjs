// Shrinks big originals in the built site (never in your repo): max 1600px on the long side.
// Usage (the workflow does this): node scripts/optimize-images.mjs _site/assets
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

let sharp;
try { sharp = (await import('sharp')).default; }
catch { console.warn('sharp is not installed, skipping image optimization'); process.exit(0); }

const dir = process.argv[2] || '_site/assets';

async function* walk(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

let saved = 0, count = 0;
for await (const file of walk(dir)) {
  const ext = extname(file).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
  try {
    const input = await readFile(file);
    let img = sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    if (ext === '.png') img = img.png({ compressionLevel: 9 });
    else if (ext === '.webp') img = img.webp({ quality: 82 });
    else img = img.jpeg({ quality: 82, mozjpeg: true });
    const out = await img.toBuffer();
    if (out.length < input.length) { await writeFile(file, out); saved += input.length - out.length; count++; }
  } catch (err) {
    console.warn(`skipped ${file}: ${err.message}`);
  }
}
console.log(`Optimized ${count} image(s), saved ${(saved / 1048576).toFixed(1)} MB`);
