#!/usr/bin/env node

/**
 * 🔥 COVERAGE GATE ENFORCER
 * 
 * Siguiendo las reglas del Agents.md:
 * "Si coverage < 90% = SHAME"
 * "VIOLACIÓN = DESTIERRO INMEDIATO"
 * 
 * Este script bloquea el build si el coverage no cumple con el 90% mínimo.
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

const MINIMUM_COVERAGE = 90;
const COVERAGE_THRESHOLDS = {
  statements: MINIMUM_COVERAGE,
  branches: 85, // Slightly lower for branches as per config
  functions: MINIMUM_COVERAGE,
  lines: MINIMUM_COVERAGE
};

console.log('🔍 ========================================');
console.log('🔥 INICIANDO QUALITY GATE ENFORCER 🔥');
console.log('🔍 ========================================');
console.log('');
console.log('📊 Ejecutando tests con coverage...');

try {
  // Ejecutar tests con coverage
  const coverageOutput = execSync('npm run test:coverage', {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
    timeout: 120000 // 2 minutos máximo
  });

  // Buscar archivos de coverage
  const coverageSummaryPath = join(packageRoot, 'coverage', 'coverage-summary.json');
  const coverageFinalPath = join(packageRoot, 'coverage', 'coverage-final.json');
  
  let totals;
  
  if (existsSync(coverageSummaryPath)) {
    // Usar coverage-summary.json si existe
    const coverageSummary = JSON.parse(readFileSync(coverageSummaryPath, 'utf8'));
    totals = coverageSummary.total;
  } else if (existsSync(coverageFinalPath)) {
    // Parsear coverage-final.json para obtener totales
    const coverageFinal = JSON.parse(readFileSync(coverageFinalPath, 'utf8'));
    
    // Calcular totales de coverage-final.json
    let totalStatements = 0, coveredStatements = 0;
    let totalBranches = 0, coveredBranches = 0;
    let totalFunctions = 0, coveredFunctions = 0;
    let totalLines = 0, coveredLines = 0;
    
    for (const [filePath, fileData] of Object.entries(coverageFinal)) {
      const { s, b, f, l } = fileData;
      
      // Statements
      totalStatements += Object.keys(s).length;
      coveredStatements += Object.values(s).filter(count => count > 0).length;
      
      // Branches
      totalBranches += Object.keys(b).length * 2; // Cada branch tiene 2 rutas
      coveredBranches += Object.values(b).flat().filter(count => count > 0).length;
      
      // Functions
      totalFunctions += Object.keys(f).length;
      coveredFunctions += Object.values(f).filter(count => count > 0).length;
      
      // Lines
      totalLines += Object.keys(l).length;
      coveredLines += Object.values(l).filter(count => count > 0).length;
    }
    
    totals = {
      statements: { pct: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100 * 100) / 100 : 0 },
      branches: { pct: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100 * 100) / 100 : 0 },
      functions: { pct: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100 * 100) / 100 : 0 },
      lines: { pct: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100 * 100) / 100 : 0 }
    };
  } else {
    console.error('❌ ERROR: No se encontraron archivos de coverage');
    console.error('   Asegúrate de que vitest esté configurado para generar coverage');
    console.error('   Verifica que el comando test:coverage funcione correctamente');
    process.exit(1);
  }

  console.log('📊 RESULTADOS DE COVERAGE:');
  console.log('================================');
  console.log(`📈 Statements: ${totals.statements.pct}%`);
  console.log(`🌿 Branches:   ${totals.branches.pct}%`);
  console.log(`⚡ Functions:  ${totals.functions.pct}%`);
  console.log(`📝 Lines:      ${totals.lines.pct}%`);
  console.log('');

  // Validar cada métrica
  const failures = [];
  
  if (totals.statements.pct < COVERAGE_THRESHOLDS.statements) {
    failures.push(`Statements: ${totals.statements.pct}% < ${COVERAGE_THRESHOLDS.statements}%`);
  }
  
  if (totals.branches.pct < COVERAGE_THRESHOLDS.branches) {
    failures.push(`Branches: ${totals.branches.pct}% < ${COVERAGE_THRESHOLDS.branches}%`);
  }
  
  if (totals.functions.pct < COVERAGE_THRESHOLDS.functions) {
    failures.push(`Functions: ${totals.functions.pct}% < ${COVERAGE_THRESHOLDS.functions}%`);
  }
  
  if (totals.lines.pct < COVERAGE_THRESHOLDS.lines) {
    failures.push(`Lines: ${totals.lines.pct}% < ${COVERAGE_THRESHOLDS.lines}%`);
  }

  if (failures.length > 0) {
    console.log('💀 ========================================');
    console.log('❌ QUALITY GATE FAILED - BUILD BLOCKED!');
    console.log('💀 ========================================');
    console.log('');
    console.log('🚫 Coverage insuficiente detectado:');
    failures.forEach(failure => console.log(`   • ${failure}`));
    console.log('');
    console.log('💡 Para desbloquear el build:');
    console.log('   1. Escribe más tests');
    console.log('   2. Mejora la cobertura existente');
    console.log('   3. Ejecuta: npm run test:coverage');
    console.log('   4. Repite hasta alcanzar el 90% mínimo');
    console.log('');
    console.log('🔥 "Sin test no hay commit. Sin commit no hay sueldo." - Agents.md');
    console.log('');
    process.exit(1);
  }

  console.log('✅ ========================================');
  console.log('🎉 QUALITY GATE PASSED - BUILD ALLOWED!');
  console.log('✅ ========================================');
  console.log('');
  console.log('🏆 ¡Coverage cumple con los estándares de calidad!');
  console.log('🚀 Procediendo con el build...');
  console.log('');

} catch (error) {
  console.error('💥 ========================================');
  console.error('❌ ERROR AL EJECUTAR COVERAGE CHECK');
  console.error('💥 ========================================');
  console.error('');
  console.error('🚨 Error:', error.message);
  console.error('');
  console.error('🔧 Posibles soluciones:');
  console.error('   1. Ejecuta: npm install');
  console.error('   2. Verifica que vitest esté configurado');
  console.error('   3. Ejecuta manualmente: npm run test:coverage');
  console.error('');
  process.exit(1);
}