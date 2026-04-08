const fs = require('fs');
const path = require('path');

function createSVG(size) {
  const fontSize = Math.floor(size * 0.5);
  const radius = Math.floor(size * 0.15);
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">',
    '  <rect width="' + size + '" height="' + size + '" rx="' + radius + '" fill="#3b82f6"/>',
    '  <text x="50%" y="55%" font-family="Arial,sans-serif" font-size="' + fontSize + '" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">G</text>',
    '</svg>'
  ].join('\n');
}

fs.writeFileSync(path.join(__dirname, 'icon-192x192.svg'), createSVG(192));
fs.writeFileSync(path.join(__dirname, 'icon-512x512.svg'), createSVG(512));
console.log('SVGs criados com sucesso');
