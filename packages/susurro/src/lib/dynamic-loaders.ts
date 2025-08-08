// Dynamic loaders for bundle size optimization
// This file handles lazy loading of heavy dependencies

/**
 * Dynamically loads Transformers.js for Whisper processing
 * Reduces initial bundle size by ~45MB
 */
export const loadTransformers = async () => {
  const transformers = await import(
    /* webpackChunkName: "transformers-core" */
    /* webpackPreload: true */
    '@huggingface/transformers'
  );

  return transformers;
};

// Note: useMurmubaraEngine is now imported directly in use-susurro.ts
// to avoid conditional hook calls which violate React's rules of hooks
// Keeping this commented for reference
// export const loadMurmubaraEngine = async () => {
//   const { useMurmubaraEngine } = await import('murmuraba');
//   return useMurmubaraEngine;
// };

/**
 * Dynamically loads Murmuraba processing functions
 * Separates heavy processing logic from core engine
 */
export const loadMurmubaraProcessing = async () => {
  const module = await import(
    /* webpackChunkName: "murmuraba-processing" */
    /* webpackPreload: true */
    'murmuraba'
  );

  return {
    processFileWithMetrics: module.processFileWithMetrics || module.processFile, // Use processFileWithMetrics first, fallback to processFile
    murmubaraVAD: module.murmubaraVAD || module.getDiagnostics, // Fallback function
    extractAudioMetadata:
      module.extractAudioMetadata || (() => ({ duration: 1.0, sampleRate: 44100, channels: 2 })), // Fallback metadata
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
      '@huggingface/transformers'
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
