// Test script to diagnose Whisper model loading issues

async function testModelLoading() {
  console.log('=== Whisper Model Loading Test ===\n');
  
  // Test 1: Check if model files can be accessed directly
  console.log('1. Testing direct file access from browser context:');
  const modelPath = '/models/whisper-tiny/config.json';
  
  try {
    const response = await fetch(modelPath);
    console.log(`   - Fetch ${modelPath}: Status ${response.status}`);
    console.log(`   - Content-Type: ${response.headers.get('content-type')}`);
    
    if (response.headers.get('content-type')?.includes('text/html')) {
      console.log('   ❌ ERROR: Server is returning HTML instead of JSON');
      console.log('   - This means the model files are not being served correctly');
      const text = await response.text();
      console.log('   - First 200 chars of response:', text.substring(0, 200));
    } else if (response.ok) {
      const data = await response.json();
      console.log('   ✓ Config file loaded successfully');
      console.log('   - Model name:', data._name_or_path);
    }
  } catch (error) {
    console.log('   ❌ ERROR:', error.message);
  }
  
  // Test 2: Check @xenova/transformers configuration
  console.log('\n2. Testing @xenova/transformers configuration:');
  try {
    const { env } = await import('@xenova/transformers');
    console.log('   - env.allowLocalModels:', env.allowLocalModels);
    console.log('   - env.allowRemoteModels:', env.allowRemoteModels);
    console.log('   - env.localModelPath:', env.localModelPath);
    console.log('   - env.useBrowserCache:', env.useBrowserCache);
  } catch (error) {
    console.log('   ❌ ERROR loading transformers:', error.message);
  }
  
  // Test 3: Try to load the model with proper error handling
  console.log('\n3. Testing model pipeline initialization:');
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    
    // Configure for local models
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = '/models/';
    env.useBrowserCache = false;
    
    console.log('   - Creating pipeline...');
    const transcriber = await pipeline(
      'automatic-speech-recognition',
      'whisper-tiny',
      {
        progress_callback: (progress) => {
          if (progress.status) {
            console.log(`   - Progress: ${progress.status}`, 
              progress.file ? `(${progress.file})` : '',
              progress.progress ? `${Math.round(progress.progress * 100)}%` : ''
            );
          }
        }
      }
    );
    console.log('   ✓ Model loaded successfully!');
    return transcriber;
  } catch (error) {
    console.log('   ❌ ERROR loading model:', error.message);
    console.log('   - Full error:', error);
  }
  
  console.log('\n=== Test Complete ===');
}

// Run the test
testModelLoading().then(model => {
  if (model) {
    console.log('\n✓ Model is ready for transcription');
  }
}).catch(err => {
  console.error('Test failed:', err);
});