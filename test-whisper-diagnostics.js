#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { createServer } from 'http';
import { createReadStream, existsSync } from 'fs';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('=== Whisper Model Diagnostics ===\n');

// 1. Check if model files exist
console.log('1. Checking model files existence:');
const modelPath = join(__dirname, 'public', 'models', 'whisper-tiny');
const requiredFiles = [
    'config.json',
    'generation_config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'preprocessor_config.json',
    'onnx/encoder_model.onnx',
    'onnx/decoder_model_merged.onnx'
];

let allFilesExist = true;
for (const file of requiredFiles) {
    const fullPath = join(modelPath, file);
    const exists = existsSync(fullPath);
    console.log(`   ${exists ? '✓' : '✗'} ${file}`);
    if (!exists) {
        allFilesExist = false;
    }
}

console.log(`\n   Result: ${allFilesExist ? '✓ All files exist' : '✗ Missing files detected'}\n`);

// 2. Test local server
console.log('2. Testing local model serving:');
const PORT = 3001;
const server = createServer(async (req, res) => {
    console.log(`   Request: ${req.method} ${req.url}`);
    
    // Handle model file requests
    if (req.url.startsWith('/models/')) {
        const filePath = join(__dirname, 'public', req.url);
        
        if (existsSync(filePath)) {
            const ext = req.url.split('.').pop();
            const contentType = {
                'json': 'application/json',
                'onnx': 'application/octet-stream',
                'txt': 'text/plain'
            }[ext] || 'application/octet-stream';
            
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            
            await pipeline(createReadStream(filePath), res);
            console.log(`   ✓ Served: ${req.url}`);
        } else {
            res.writeHead(404);
            res.end('Not found');
            console.log(`   ✗ 404: ${req.url}`);
        }
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, async () => {
    console.log(`   Server running on http://localhost:${PORT}\n`);
    
    // 3. Test fetching a model file
    console.log('3. Testing model file fetch:');
    try {
        const response = await fetch(`http://localhost:${PORT}/models/whisper-tiny/config.json`);
        const contentType = response.headers.get('content-type');
        console.log(`   Status: ${response.status}`);
        console.log(`   Content-Type: ${contentType}`);
        
        if (response.ok && contentType.includes('json')) {
            const config = await response.json();
            console.log(`   ✓ Config loaded: ${config._name_or_path || 'whisper-tiny'}\n`);
        } else {
            const text = await response.text();
            console.log(`   ✗ Unexpected response: ${text.substring(0, 100)}...\n`);
        }
    } catch (error) {
        console.log(`   ✗ Fetch error: ${error.message}\n`);
    }
    
    // 4. Check transformers.js environment
    console.log('4. Testing @xenova/transformers configuration:');
    try {
        const { env } = await import('@xenova/transformers');
        
        // Try different configurations
        const configs = [
            { 
                name: 'Local files only',
                settings: {
                    allowLocalModels: true,
                    allowRemoteModels: false,
                    localModelPath: '/models/',
                    useBrowserCache: false
                }
            },
            {
                name: 'With absolute path',
                settings: {
                    allowLocalModels: true,
                    allowRemoteModels: false,
                    localModelPath: `http://localhost:${PORT}/models/`,
                    useBrowserCache: false
                }
            }
        ];
        
        for (const config of configs) {
            console.log(`\n   Testing: ${config.name}`);
            Object.assign(env, config.settings);
            
            console.log(`   - allowLocalModels: ${env.allowLocalModels}`);
            console.log(`   - allowRemoteModels: ${env.allowRemoteModels}`);
            console.log(`   - localModelPath: ${env.localModelPath}`);
            
            // Note: We can't actually test pipeline loading in Node.js environment
            console.log('   (Pipeline loading would need browser environment)');
        }
        
    } catch (error) {
        console.log(`   ✗ Error importing transformers: ${error.message}`);
    }
    
    console.log('\n=== Diagnostics Complete ===\n');
    console.log('Recommendations:');
    console.log('1. Ensure Vite dev server is properly serving /models/ directory');
    console.log('2. Check browser DevTools Network tab for actual requests');
    console.log('3. Verify CORS headers are set correctly');
    console.log('4. Consider using explicit model URLs in worker configuration');
    
    server.close();
});