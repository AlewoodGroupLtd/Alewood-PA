const sharp = require('sharp');
const fs = require('fs');

async function resizeIcons() {
  const input = 'public/favicon.png';
  
  if (!fs.existsSync(input)) {
    console.error('favicon.png not found!');
    return;
  }

  try {
    await sharp(input)
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile('public/pwa-192x192.png');
    console.log('Created pwa-192x192.png');

    await sharp(input)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile('public/pwa-512x512.png');
    console.log('Created pwa-512x512.png');
  } catch (err) {
    console.error('Error resizing:', err);
  }
}

resizeIcons();
