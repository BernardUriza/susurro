const fs = require('fs');
const path = require('path');

// Read WASM file
const wasmPath = path.join(__dirname, '../node_modules/@jitsi/rnnoise-wasm/dist/rnnoise.wasm');
const wasmBuffer = fs.readFileSync(wasmPath);

// Convert to base64
const wasmBase64 = wasmBuffer.toString('base64');

// Create embedded module
const embeddedModule = `
// Auto-generated file - DO NOT EDIT
export const RNNOISE_WASM_BASE64 = '${wasmBase64}';

export async function loadRNNoiseWASM() {
  // Convert base64 back to ArrayBuffer
  const binaryString = atob(RNNOISE_WASM_BASE64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Instantiate WebAssembly module
  const wasmModule = await WebAssembly.instantiate(bytes.buffer);
  return wasmModule;
}
`;

// Write to file
fs.writeFileSync(
  path.join(__dirname, '../src/engines/rnnoise-wasm-embedded.ts'),
  embeddedModule
);

console.log('✅ WASM embedded successfully!');
console.log(`📦 WASM size: ${(wasmBuffer.length / 1024).toFixed(2)} KB`);
console.log(`📄 Base64 size: ${(wasmBase64.length / 1024).toFixed(2)} KB`);