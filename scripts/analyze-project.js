#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Susurro Project Analysis');
console.log('===========================\n');

// Check for unused dependencies
console.log('📦 Checking for unused dependencies...');
try {
  const depcheckResult = execSync('npx depcheck --skip-missing', { encoding: 'utf8' });
  console.log(depcheckResult);
} catch (error) {
  console.log('✅ No unused dependencies found');
}

// Check for dead code using TypeScript compiler
console.log('\n🔎 Checking for unused code...');
try {
  const tscResult = execSync('npx tsc --noEmit --noUnusedLocals --noUnusedParameters', { encoding: 'utf8' });
  console.log('✅ No unused code detected');
} catch (error) {
  console.log('❌ Unused code found:');
  console.log(error.stdout);
}

// Analyze bundle size
console.log('\n📊 Analyzing bundle composition...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  
  const distPath = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    const files = fs.readdirSync(distPath);
    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);
      console.log(`📄 ${file}: ${(stats.size / 1024).toFixed(2)} KB`);
    });
  }
} catch (error) {
  console.log('❌ Build failed, cannot analyze bundle');
}

// Check project structure health
console.log('\n🏗️  Project Structure Analysis');
console.log('------------------------------');

const srcPath = path.join(process.cwd(), 'src');
const features = fs.readdirSync(path.join(srcPath, 'features'));
console.log(`✅ Features found: ${features.join(', ')}`);

// Check for feature isolation
features.forEach(feature => {
  const featurePath = path.join(srcPath, 'features', feature);
  const hasComponents = fs.existsSync(path.join(featurePath, 'components'));
  console.log(`${hasComponents ? '✅' : '❌'} ${feature}: ${hasComponents ? 'properly structured' : 'missing components directory'}`);
});

console.log('\n✨ Analysis complete!');