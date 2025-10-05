#!/usr/bin/env node

const sharp = require('sharp');
const path = require('path');

const inputPath = 'c:\\Users\\Bernard\\Pictures\\94a3c5da-e632-4817-9c6f-094ab4fda838.png';
const outputDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  console.log('🎨 Generating PWA icons...');

  try {
    // Generate 192x192 icon
    await sharp(inputPath)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-192.png'));
    console.log('✅ Generated icon-192.png');

    // Generate 512x512 icon
    await sharp(inputPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(path.join(outputDir, 'icon-512.png'));
    console.log('✅ Generated icon-512.png');

    console.log('✨ PWA icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
