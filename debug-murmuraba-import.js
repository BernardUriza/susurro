#!/usr/bin/env node

console.log('🔍 Debug: Testing murmuraba imports');

async function testImports() {
  try {
    console.log('1. Testing direct import from murmuraba...');
    const murmuraba = await import('murmuraba');
    console.log('✅ Direct import successful');
    console.log('Available exports:', Object.keys(murmuraba));
    
    console.log('\n2. Testing useMurmubaraEngine import...');
    const { useMurmubaraEngine } = murmuraba;
    console.log('useMurmubaraEngine type:', typeof useMurmubaraEngine);
    console.log('useMurmubaraEngine available:', !!useMurmubaraEngine);
    
    console.log('\n3. Testing initializeAudioEngine import...');
    const { initializeAudioEngine } = murmuraba;
    console.log('initializeAudioEngine type:', typeof initializeAudioEngine);
    console.log('initializeAudioEngine available:', !!initializeAudioEngine);
    
    if (initializeAudioEngine) {
      console.log('\n4. Testing initializeAudioEngine execution...');
      try {
        const result = await initializeAudioEngine({
          noiseReductionLevel: 'medium',
          bufferSize: 1024,
          algorithm: 'rnnoise',
          logLevel: 'info',
          autoCleanup: true,
          useAudioWorklet: true,
        });
        console.log('✅ initializeAudioEngine completed successfully:', result);
      } catch (error) {
        console.log('❌ initializeAudioEngine failed:', error.message);
        console.log('Error details:', error);
      }
    }
    
    console.log('\n5. Testing getEngineStatus...');
    const { getEngineStatus } = murmuraba;
    console.log('getEngineStatus type:', typeof getEngineStatus);
    if (getEngineStatus) {
      try {
        const status = getEngineStatus();
        console.log('Engine status:', status);
      } catch (error) {
        console.log('getEngineStatus error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error('Full error:', error);
  }
}

testImports().catch(console.error);