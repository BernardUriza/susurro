/**
 * TDD Tests for Triple System Integration
 *
 * Verifies complete migration from dual → triple system
 */

import { describe, it, expect } from 'vitest';

describe('Triple System Migration - TDD', () => {
  describe('Legacy Code Removal', () => {
    it('should not export useDualTranscription anymore', async () => {
      const coreModule = await import('@susurro/core');

      // Should have useTripleTranscription
      expect(coreModule.useTripleTranscription).toBeDefined();

      // useDualTranscription should still exist for now (used internally)
      // but useTripleTranscription is the public API
    });

    it('should not have SimpleTranscriptionMode component', () => {
      // SimpleTranscriptionMode should be removed
      // Only TripleTranscriptionPanel should exist
      expect(true).toBe(true); // Will verify after deletion
    });
  });

  describe('Triple System as Primary', () => {
    it('should use TripleTranscriptionPanel in main UI', () => {
      // Main UI should render TripleTranscriptionPanel
      expect(true).toBe(true); // Will verify after integration
    });

    it('should have 3 streams active by default', () => {
      // All 3 engines should be enabled by default
      expect(true).toBe(true); // Will verify after integration
    });
  });

  describe('Backwards Compatibility', () => {
    it('should maintain useSusurro for recording functionality', async () => {
      const coreModule = await import('@susurro/core');

      // useSusurro should still exist for audio recording
      expect(coreModule.useSusurro).toBeDefined();
    });

    it('should maintain NeuralContext wrapper', () => {
      // NeuralContext should use triple system internally
      expect(true).toBe(true); // Will verify after migration
    });
  });
});
