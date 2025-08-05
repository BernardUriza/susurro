#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');
const { URL } = require('url');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  progress: (msg) => console.log(`${colors.cyan}[PROGRESS]${colors.reset} ${msg}`)
};

// Model files to download
const MODEL_FILES = [
  'config.json',
  'generation_config.json',
  'preprocessor_config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'vocab.json',
  'merges.txt',
  'added_tokens.json',
  'special_tokens_map.json',
  'normalizer.json'
];

// ONNX model files (these are the actual weights)
const ONNX_FILES = [
  'onnx/decoder_model_merged.onnx',
  'onnx/encoder_model.onnx'
];

// HuggingFace Configuration
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || '';
const BASE_URL = 'https://huggingface.co/Xenova/whisper-tiny/resolve/main';
const MODEL_DIR = path.join(process.cwd(), 'public', 'models', 'whisper-tiny');
const ONNX_DIR = path.join(MODEL_DIR, 'onnx');

// Ensure directories exist
function ensureDirectories() {
  log.info('Creating directories...');
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    log.success(`Created directory: ${MODEL_DIR}`);
  }
  if (!fs.existsSync(ONNX_DIR)) {
    fs.mkdirSync(ONNX_DIR, { recursive: true });
    log.success(`Created directory: ${ONNX_DIR}`);
  }
}

// Download file with progress
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const fileName = path.basename(destination);
    
    log.progress(`Downloading ${fileName}...`);
    
    // Configure request options with HuggingFace token
    const requestOptions = {
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'User-Agent': 'Susurro/1.0.0'
      }
    };
    
    https.get(url, requestOptions, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        const redirectUrl = response.headers.location;
        log.info(`Redirecting to: ${redirectUrl}`);
        return downloadFile(redirectUrl, destination).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastProgress = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        file.write(chunk);
        
        if (totalSize) {
          const progress = Math.floor((downloadedSize / totalSize) * 100);
          if (progress !== lastProgress && progress % 10 === 0) {
            log.progress(`${fileName}: ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(2)}MB)`);
            lastProgress = progress;
          }
        }
      });

      response.on('end', () => {
        file.end();
        const sizeInMB = (downloadedSize / 1024 / 1024).toFixed(2);
        log.success(`✓ ${fileName} downloaded (${sizeInMB}MB)`);
        resolve();
      });

      response.on('error', (err) => {
        file.destroy();
        fs.unlink(destination, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      file.destroy();
      fs.unlink(destination, () => {});
      reject(err);
    });
  });
}

// Download all model files
async function downloadModelFiles() {
  log.info(`Starting download of Whisper-Tiny model files...`);
  log.info(`Target directory: ${MODEL_DIR}`);
  
  const totalFiles = MODEL_FILES.length + ONNX_FILES.length;
  let downloadedFiles = 0;
  
  // Download configuration and tokenizer files
  for (const file of MODEL_FILES) {
    try {
      const url = `${BASE_URL}/${file}`;
      const destination = path.join(MODEL_DIR, file);
      
      // Skip if file already exists
      if (fs.existsSync(destination)) {
        log.warn(`File already exists, skipping: ${file}`);
        downloadedFiles++;
        continue;
      }
      
      await downloadFile(url, destination);
      downloadedFiles++;
      log.info(`Progress: ${downloadedFiles}/${totalFiles} files completed`);
      
    } catch (error) {
      log.error(`Failed to download ${file}: ${error.message}`);
      // Continue with other files
    }
  }
  
  // Download ONNX model files (the actual weights)
  for (const file of ONNX_FILES) {
    try {
      const url = `${BASE_URL}/${file}`;
      const destination = path.join(MODEL_DIR, file);
      
      // Skip if file already exists
      if (fs.existsSync(destination)) {
        log.warn(`File already exists, skipping: ${file}`);
        downloadedFiles++;
        continue;
      }
      
      await downloadFile(url, destination);
      downloadedFiles++;
      log.info(`Progress: ${downloadedFiles}/${totalFiles} files completed`);
      
    } catch (error) {
      log.error(`Failed to download ${file}: ${error.message}`);
      log.warn(`ONNX files may not be available at the expected location`);
      log.warn(`You may need to download them manually from: https://huggingface.co/Xenova/whisper-tiny/tree/main`);
    }
  }
}

// Check if model is already downloaded
function checkExistingModel() {
  const requiredFiles = ['config.json', 'tokenizer.json'];
  const existingFiles = requiredFiles.filter(file => 
    fs.existsSync(path.join(MODEL_DIR, file))
  );
  
  if (existingFiles.length === requiredFiles.length) {
    log.warn('Model appears to be already downloaded');
    log.info('Use --force to re-download');
    return true;
  }
  return false;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const forceDownload = args.includes('--force');
  
  log.info(`${colors.bright}🎙️  Whisper-Tiny Model Downloader${colors.reset}`);
  log.info(`${colors.bright}======================================${colors.reset}`);
  
  try {
    ensureDirectories();
    
    if (!forceDownload && checkExistingModel()) {
      process.exit(0);
    }
    
    const startTime = Date.now();
    await downloadModelFiles();
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    log.success(`${colors.bright}🎉 Download completed in ${totalTime}s!${colors.reset}`);
    log.info(`Model location: ${MODEL_DIR}`);
    log.info(`Next steps:`);
    log.info(`  1. Run 'npm run dev' to start the application`);
    log.info(`  2. The model will now load locally instead of from CDN`);
    
    // Verify downloaded files
    const downloadedCount = MODEL_FILES.filter(file => 
      fs.existsSync(path.join(MODEL_DIR, file))
    ).length;
    
    log.info(`Downloaded ${downloadedCount}/${MODEL_FILES.length} configuration files`);
    
    if (downloadedCount < MODEL_FILES.length) {
      log.warn('Some files may be missing. Check the logs above for errors.');
    }
    
  } catch (error) {
    log.error(`Download failed: ${error.message}`);
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log.warn('Download interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main();
}