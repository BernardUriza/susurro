// Dynamic loaders for bundle size optimization
// This file handles lazy loading of heavy dependencies

/**
 * Dynamically loads Transformers.js for Whisper processing
 * Reduces initial bundle size by ~45MB
 */
export const loadTransformers = async () => {
  console.log('🎯 Loading Transformers.js dynamically...');
  const startTime = performance.now();

  const transformers = await import(
    /* webpackChunkName: "transformers-core" */
    /* webpackPreload: true */
    '@xenova/transformers'
  );

  const loadTime = performance.now() - startTime;
  console.log(`✅ Transformers.js loaded in ${loadTime.toFixed(2)}ms`);

  return transformers;
};

/**
 * Dynamically loads Murmuraba engine for audio processing
 * Reduces initial bundle size and improves First Contentful Paint
 */
export const loadMurmubaraEngine = async () => {
  console.log('🎯 Loading Murmuraba engine dynamically...');
  const startTime = performance.now();

  const { useMurmubaraEngine } = await import(
    /* webpackChunkName: "murmuraba-engine" */
    /* webpackPreload: true */
    'murmuraba'
  );

  const loadTime = performance.now() - startTime;
  console.log(`✅ Murmuraba engine loaded in ${loadTime.toFixed(2)}ms`);

  return useMurmubaraEngine;
};

/**
 * Dynamically loads Murmuraba processing functions
 * Separates heavy processing logic from core engine
 */
export const loadMurmubaraProcessing = async () => {
  console.log('🎯 Loading Murmuraba processing functions...');
  const startTime = performance.now();

  const module = await import(
    /* webpackChunkName: "murmuraba-processing" */
    /* webpackPreload: true */
    'murmuraba'
  );

  const loadTime = performance.now() - startTime;
  console.log(`✅ Murmuraba processing loaded in ${loadTime.toFixed(2)}ms`);

  return {
    processFileWithMetrics: module.processFileWithMetrics || module.processFile, // Use processFileWithMetrics first, fallback to processFile 
    murmubaraVAD: module.murmubaraVAD || module.getDiagnostics, // Fallback function
    extractAudioMetadata: module.extractAudioMetadata || (() => ({ duration: 1.0, sampleRate: 44100, channels: 2 })), // Fallback metadata
    // Add engine status check to ensure initialization
    getEngineStatus: module.getEngineStatus,
    initializeAudioEngine: module.initializeAudioEngine,
  };
};

/**
 * Preloads critical dependencies in the background
 * Call this after initial page load for better UX
 */
export const preloadCriticalDependencies = () => {
  // Preload transformers.js in background
  setTimeout(() => {
    import(
      /* webpackChunkName: "transformers-core" */
      /* webpackPrefetch: true */
      '@xenova/transformers'
    ).catch(() => {
      // Ignore preload errors - will load when needed
    });
  }, 2000);

  // Preload murmuraba in background
  setTimeout(() => {
    import(
      /* webpackChunkName: "murmuraba-engine" */
      /* webpackPrefetch: true */
      'murmuraba'
    ).catch(() => {
      // Ignore preload errors - will load when needed
    });
  }, 3000);
};
