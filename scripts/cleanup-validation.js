#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧹 Susurro Project Cleanup Validation');
console.log('=====================================\n');

const rootPath = process.cwd();

// Check for common cleanup items
const cleanupChecklist = [
  {
    name: 'Config files organized',
    check: () => fs.existsSync(path.join(rootPath, 'config')),
    expected: true
  },
  {
    name: 'Legacy files removed',
    check: () => !fs.existsSync(path.join(rootPath, 'tsc')) && !fs.existsSync(path.join(rootPath, 'styles.css')),
    expected: true
  },
  {
    name: 'Scripts directory created',
    check: () => fs.existsSync(path.join(rootPath, 'scripts')),
    expected: true
  },
  {
    name: 'Documentation organized',
    check: () => fs.existsSync(path.join(rootPath, 'docs')),
    expected: true
  },
  {
    name: 'ESLint configuration exists',
    check: () => fs.existsSync(path.join(rootPath, 'eslintrc.json')),
    expected: true
  }
];

console.log('📋 Cleanup Validation Results:');
console.log('------------------------------');

let allPassed = true;
cleanupChecklist.forEach(item => {
  const result = item.check();
  const status = result === item.expected ? '✅' : '❌';
  console.log(`${status} ${item.name}`);
  if (result !== item.expected) allPassed = false;
});

console.log(`\n📊 Overall Status: ${allPassed ? '✅ All checks passed!' : '❌ Some issues found'}`);

// Count files in root directory
const rootFiles = fs.readdirSync(rootPath).filter(item => {
  const itemPath = path.join(rootPath, item);
  return fs.statSync(itemPath).isFile();
});

console.log(`\n📁 Root directory file count: ${rootFiles.length}`);
console.log('Root files:', rootFiles.join(', '));

if (rootFiles.length <= 8) {
  console.log('✅ Root directory is clean (≤8 files)');
} else {
  console.log('⚠️  Root directory has many files, consider further organization');
}

console.log('\n🎉 Cleanup validation complete!');