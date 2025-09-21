const fs = require('fs');
const path = require('path');

// Get current timestamp as version
const version = Date.now();

// Files to update
const files = [
  'public/index.html',
  'public/admin.html',
  'public/menu.html',
  'public/restaurant.html'
];

files.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);

  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf8');

    // Update version in script tags
    content = content.replace(/src="([^"]*\.(?:js|min\.js))(\?v=\d+)?"/g, `src="$1?v=${version}"`);
    content = content.replace(/onerror="[^"]*src='([^']*\.(?:js|min\.js))(\?v=\d+)?'[^"]*"/g, `onerror="(function(){var s=document.createElement('script');s.defer=true;s.src='$1?v=${version}';document.body.appendChild(s);})();"`);

    // Update version in CSS links
    content = content.replace(/href="([^"]*\.css)(\?v=\d+)?"/g, `href="$1?v=${version}"`);

    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Updated ${filePath} with version ${version}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('Version update completed!');
