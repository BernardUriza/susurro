#!/usr/bin/env node

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, '..', 'public');
const icon192Path = path.join(outputDir, 'icon-192.png');
const icon512Path = path.join(outputDir, 'icon-512.png');

async function generateIcons() {
  // Check if icons already exist
  if (fs.existsSync(icon192Path) && fs.existsSync(icon512Path)) {
    console.log('✅ PWA icons already exist, skipping generation');
    return;
  }

  console.log('🎨 Generating PWA icons...');

  // Try to find source image (favicon or other)
  const possibleSources = [
    path.join(outputDir, '94a3c5da-e632-4817-9c6f-094ab4fda838.png'),
    path.join(outputDir, 'icon-192.png'), // Use existing if only one is missing
    'c:\\Users\\Bernard\\Pictures\\94a3c5da-e632-4817-9c6f-094ab4fda838.png',
  ];

  let inputPath = null;
  for (const source of possibleSources) {
    if (fs.existsSync(source)) {
      inputPath = source;
      break;
    }
  }

  if (!inputPath) {
    console.log('⚠️  No source image found, icons should be committed to repo');
    console.log('✅ Skipping icon generation (use existing icons from repo)');
    return;
  }

  try {
    // Generate 192x192 icon
    if (!fs.existsSync(icon192Path)) {
      await sharp(inputPath)
        .resize(192, 192, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(icon192Path);
      console.log('✅ Generated icon-192.png');
    }

    // Generate 512x512 icon
    if (!fs.existsSync(icon512Path)) {
      await sharp(inputPath)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(icon512Path);
      console.log('✅ Generated icon-512.png');
    }

    console.log('✨ PWA icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    console.log('⚠️  Icons should be committed to the repository');
    // Don't exit with error - allow build to continue with existing icons
  }
}

generateIcons();
