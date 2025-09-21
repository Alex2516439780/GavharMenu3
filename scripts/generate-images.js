const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const UPLOADS = path.join(ROOT, 'uploads', 'dishes');
const PUBLIC = path.join(ROOT, 'public');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

function isImage(file) {
  return /\.(png|jpg|jpeg|webp)$/i.test(file);
}

async function processFile(filePath) {
  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);

  const sizes = [400, 800];
  for (const width of sizes) {
    const outWebp = path.join(dir, `${base}-${width}.webp`);
    const outAvif = path.join(dir, `${base}-${width}.avif`);
    try {
      await sharp(filePath).resize({ width, withoutEnlargement: true }).webp({ effort: 4, quality: 75 }).toFile(outWebp);
    } catch (_) {}
    try {
      await sharp(filePath).resize({ width, withoutEnlargement: true }).avif({ effort: 4, quality: 50 }).toFile(outAvif);
    } catch (_) {}
  }
}

async function walk(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full);
    } else if (e.isFile() && isImage(e.name)) {
      await processFile(full);
    }
  }
}

(async () => {
  await ensureDir(UPLOADS);
  await walk(UPLOADS);
  // Фон: public/ELEMENTS/image 2.png -> image 2.webp
  try {
    const bgPng = path.join(PUBLIC, 'ELEMENTS', 'image 2.png');
    const bgWebp = path.join(PUBLIC, 'ELEMENTS', 'image 2.webp');
    if (fs.existsSync(bgPng)) {
      await sharp(bgPng).webp({ effort: 4, quality: 90 }).toFile(bgWebp);
    }
  } catch (_) {}
  console.log('✅ Генерация WebP/AVIF завершена');
})();


