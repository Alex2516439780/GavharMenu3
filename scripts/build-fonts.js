const fs = require('fs');
const path = require('path');
const ttf2woff2 = require('ttf2woff2');

const ROOT = path.resolve(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'public', 'FONT');
const TTF_NAME = 'Athena-Regular (PERSONAL USE ONLY).ttf';
const WOFF2_NAME = 'Athena-Regular (PERSONAL USE ONLY).woff2';

function build() {
  const ttfPath = path.join(FONT_DIR, TTF_NAME);
  const woff2Path = path.join(FONT_DIR, WOFF2_NAME);
  if (!fs.existsSync(ttfPath)) {
    console.error('TTF font not found:', ttfPath);
    process.exit(1);
  }
  const input = fs.readFileSync(ttfPath);
  const output = ttf2woff2(input);
  fs.writeFileSync(woff2Path, Buffer.from(output));
  console.log('✅ WOFF2 generated:', WOFF2_NAME);
}

build();


