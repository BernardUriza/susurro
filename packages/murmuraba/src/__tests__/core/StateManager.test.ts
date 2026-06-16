import { StateManager } from '../../core/state-manager';
import { vi } from 'vitest';
import { EngineState } from '../../types';

describe('StateManager', () => {
  let stateManager: StateManager;
  let consoleWarn: vi.SpyInstance;

  beforeEach(() => {
    stateManager = new StateManager();
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  describe('getState()', () => {
    it('should start with uninitialized state', () => {
      expect(stateManager.getState()).toBe('uninitialized');
    });
  });

  describe('canTransitionTo()', () => {
    it('should allow valid transitions from uninitialized', () => {
      expect(stateManager.canTransitionTo('initializing')).toBe(true);
      expect(stateManager.canTransitionTo('error')).toBe(true);
    });

    it('should not allow invalid transitions from uninitialized', () => {
      expect(stateManager.canTransitionTo('ready')).toBe(false);
      expect(stateManager.canTransitionTo('processing')).toBe(false);
    });

    it('should handle all state transitions correctly', () => {
      // Test all allowed transitions based on what's actually in StateManager
      const transitions = {
        'uninitialized': ['initializing', 'error'],
        'initializing': ['ready', 'error'],
        'ready': ['processing', 'destroying', 'error'],
        'processing': ['ready', 'paused', 'destroying', 'error'],
        'paused': ['processing', 'ready', 'destroying', 'error'],
        'destroying': ['destroyed', 'error'],
        'destroyed': [],
        'error': ['initializing', 'destroying'],
      } as const;

      Object.entries(transitions).forEach(([fromState, allowedStates]) => {
        // Force state for testing
        stateManager['currentState'] = fromState as EngineState;
        
        (allowedStates as readonly EngineState[]).forEach(toState => {
          expect(stateManager.canTransitionTo(toState)).toBe(true);
        });
        
        // Test some invalid transitions
        const invalidStates: EngineState[] = ['uninitialized', 'ready', 'processing'];
        invalidStates.forEach(toState => {
          if (!(allowedStates as readonly EngineState[]).includes(toState) && toState !== fromState) {
            expect(stateManager.canTransitionTo(toState)).toBe(false);
          }
        });
      });
    });
  });

  describe('transitionTo()', () => {
    it('should transition to valid state', () => {
      const handler = vi.fn();
      stateManager.on('state-change', handler);
      
      const result = stateManager.transitionTo('initializing');
      
      expect(result).toBe(true);
      expect(stateManager.getState()).toBe('initializing');
      expect(handler).toHaveBeenCalledWith('uninitialized', 'initializing');
    });

    it('should not transition to invalid state', () => {
      const handler = vi.fn();
      stateManager.on('state-change', handler);
      
      const result = stateManager.transitionTo('ready');
      
      expect(result).toBe(false);
      expect(stateManager.getState()).toBe('uninitialized');
      expect(handler).not.toHaveBeenCalled();
      expect(consoleWarn).toHaveBeenCalledWith(
        'Invalid state transition: uninitialized -> ready'
      );
    });

    it('should handle state with no allowed transitions', () => {
      // Force to destroyed state
      stateManager['currentState'] = 'destroyed';
      
      const result = stateManager.transitionTo('ready');
      
      expect(result).toBe(false);
      expect(consoleWarn).toHaveBeenCalled();
    });
  });

  describe('isInState()', () => {
    it('should return true when in specified state', () => {
      expect(stateManager.isInState('uninitialized')).toBe(true);
    });

    it('should return false when not in specified state', () => {
      expect(stateManager.isInState('ready')).toBe(false);
    });

    it('should check multiple states', () => {
      expect(stateManager.isInState('ready', 'uninitialized', 'error')).toBe(true);
      expect(stateManager.isInState('ready', 'processing')).toBe(false);
    });
  });

  describe('requireState()', () => {
    it('should not throw when in required state', () => {
      expect(() => stateManager.requireState('uninitialized')).not.toThrow();
    });

    it('should throw when not in required state', () => {
      expect(() => stateManager.requireState('ready')).toThrow(
        'Operation requires state to be one of: ready, but current state is: uninitialized'
      );
    });

    it('should check multiple required states', () => {
      expect(() => stateManager.requireState('ready', 'processing')).toThrow();
      expect(() => stateManager.requireState('uninitialized', 'ready')).not.toThrow();
    });
  });

  describe('reset()', () => {
    it('should reset to uninitialized state', () => {
      const handler = vi.fn();
      stateManager.on('state-change', handler);
      
      // Transition to another state first
      stateManager.transitionTo('initializing');
      handler.mockClear();
      
      stateManager.reset();
      
      expect(stateManager.getState()).toBe('uninitialized');
      expect(handler).toHaveBeenCalledWith('initializing', 'uninitialized');
    });

    it('should not emit event when already uninitialized', () => {
      const handler = vi.fn();
      stateManager.on('state-change', handler);
      
      stateManager.reset();
      
      expect(stateManager.getState()).toBe('uninitialized');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should handle complete lifecycle', () => {
      const handler = vi.fn();
      stateManager.on('state-change', handler);
      
      // Full lifecycle
      expect(stateManager.transitionTo('initializing')).toBe(true);
      expect(stateManager.transitionTo('ready')).toBe(true);
      expect(stateManager.transitionTo('processing')).toBe(true);
      expect(stateManager.transitionTo('paused')).toBe(true);
      expect(stateManager.transitionTo('processing')).toBe(true);
      expect(stateManager.transitionTo('ready')).toBe(true);
      expect(stateManager.transitionTo('destroying')).toBe(true);
      expect(stateManager.transitionTo('destroyed')).toBe(true);
      
      expect(handler).toHaveBeenCalledTimes(8);
      expect(stateManager.getState()).toBe('destroyed');
    });

    it('should handle error recovery', () => {
      // Transition to error
      stateManager.transitionTo('error');
      expect(stateManager.getState()).toBe('error');
      
      // Can recover from error
      expect(stateManager.transitionTo('initializing')).toBe(true);
      expect(stateManager.getState()).toBe('initializing');
    });
  });
});