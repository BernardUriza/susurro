// Re-export everything from the refactored module
export * from './murmuraba-engine';
export { useMurmubaraEngine as default } from './murmuraba-engine';

// Legacy support - will be removed in next major version
import { useMurmubaraEngine } from './murmuraba-engine';

/**
 * @deprecated Import directly from './murmuraba-engine' instead
 * This file now serves as a re-export for backward compatibility
 */
export { useMurmubaraEngine };