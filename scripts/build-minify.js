const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const CleanCSS = require('clean-css');

const pub = path.join(__dirname, '..', 'public');

async function minifyJS(file) {
  const srcPath = path.join(pub, file);
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = await minify(code, { compress: { drop_console: true }, mangle: true });
  fs.writeFileSync(path.join(pub, file.replace('.js', '.min.js')), result.code, 'utf8');
}

function minifyCSS(file) {
  const srcPath = path.join(pub, file);
  const code = fs.readFileSync(srcPath, 'utf8');
  const result = new CleanCSS({ level: 2 }).minify(code);
  fs.writeFileSync(path.join(pub, file.replace('.css', '.min.css')), result.styles, 'utf8');
}

(async function run() {
  await minifyJS('script.js');
  await minifyJS('api.js');
  await minifyJS('admin-script.js');
  minifyCSS('styles.css');
  if (fs.existsSync(path.join(pub, 'admin-styles.css'))) {
    minifyCSS('admin-styles.css');
  }
  console.log('Minification completed.');
})();


