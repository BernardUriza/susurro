// Dynamic loaders for bundle size optimization
// This file handles lazy loading of heavy dependencies

// Cache for loaded modules to prevent multiple loads
const MODULE_CACHE = {
  transformers: null as typeof import('@huggingface/transformers') | null,
  murmubaraProcessing: null as typeof import('murmuraba') | null,
};

/**
 * Dynamically loads Transformers.js for Whisper processing
 * Reduces initial bundle size by ~45MB
 */
export const loadTransformers = async () => {
  if (MODULE_CACHE.transformers) {
    console.log('[loadTransformers] Using cached module');
    return MODULE_CACHE.transformers;
  }

  const transformers = await import(
    /* webpackChunkName: "transformers-core" */
    /* webpackPreload: true */
    '@huggingface/transformers'
  );

  MODULE_CACHE.transformers = transformers;
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
  if (MODULE_CACHE.murmubaraProcessing) {
    // Reduced logging - only log on first load
    return MODULE_CACHE.murmubaraProcessing;
  }

  const module = await import(
    /* webpackChunkName: "murmuraba-processing" */
    /* webpackPreload: true */
    'murmuraba'
  );

  // Reduced verbosity - only log on first load
  // console.log('[loadMurmubaraProcessing] Module loaded');

  const processedModule = {
    processFileWithMetrics: module.processFileWithMetrics || module.processFile, // Use processFileWithMetrics first, fallback to processFile
    murmubaraVAD: module.murmubaraVAD, // No fallback - murmubaraVAD is a required export
    extractAudioMetadata:
      module.extractAudioMetadata || (() => ({ duration: 1.0, sampleRate: 44100, channels: 2 })), // Fallback metadata
    // Add engine status check to ensure initialization
    getEngineStatus: module.getEngineStatus,
    initializeAudioEngine: module.initializeAudioEngine,
  };

  MODULE_CACHE.murmubaraProcessing = processedModule;
  return processedModule;
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
