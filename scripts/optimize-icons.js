const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIRS = [
  path.join(ROOT, 'public', 'ELEMENTS')
];

function isPngJpg(file) {
  return /(\.png|\.jpg|\.jpeg)$/i.test(file);
}

async function optimizeFile(full) {
  const ext = path.extname(full).toLowerCase();
  const tmp = full + '.tmp';
  try {
    const statBefore = fs.statSync(full).size;
    if (ext === '.png') {
      await sharp(full)
        .png({ compressionLevel: 9, effort: 6 })
        .toFile(tmp);
    } else {
      await sharp(full)
        .jpeg({ quality: 85, mozjpeg: true, chromaSubsampling: '4:4:4' })
        .toFile(tmp);
    }
    const statAfter = fs.statSync(tmp).size;
    if (statAfter < statBefore) {
      fs.renameSync(tmp, full);
      console.log(`Optimized ${path.basename(full)}: ${(statBefore/1024).toFixed(1)}KB → ${(statAfter/1024).toFixed(1)}KB`);
    } else {
      fs.unlinkSync(tmp);
    }
  } catch (e) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.warn('Skip optimize', full, e.message);
  }
}

async function walk(dir) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full);
    else if (e.isFile() && isPngJpg(e.name)) await optimizeFile(full);
  }
}

(async () => {
  for (const d of TARGET_DIRS) {
    if (fs.existsSync(d)) await walk(d);
  }
  console.log('✅ Icons optimization finished');
})();


