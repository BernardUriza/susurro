import { EngineState } from '../types';
import { EventEmitter } from './event-emitter';

interface StateEvents {
  'state-change': (oldState: EngineState, newState: EngineState) => void;
  [key: string]: (...args: any[]) => void;
}

export class StateManager extends EventEmitter<StateEvents> {
  private currentState: EngineState = 'uninitialized';
  private allowedTransitions: Map<EngineState, EngineState[]> = new Map([
    ['uninitialized', ['initializing', 'error']],
    ['initializing', ['creating-context', 'loading-wasm', 'ready', 'degraded', 'error']],
    ['creating-context', ['loading-wasm', 'ready', 'degraded', 'error']],
    ['loading-wasm', ['ready', 'degraded', 'error']],
    ['ready', ['processing', 'destroying', 'error']],
    ['processing', ['ready', 'paused', 'destroying', 'error']],
    ['paused', ['processing', 'ready', 'destroying', 'error']],
    ['degraded', ['processing', 'destroying', 'error']],
    ['destroying', ['destroyed', 'error']],
    ['destroyed', []],
    ['error', ['initializing', 'destroying']],
  ]);
  
  getState(): EngineState {
    return this.currentState;
  }
  
  canTransitionTo(newState: EngineState): boolean {
    const allowed = this.allowedTransitions.get(this.currentState) || [];
    return allowed.includes(newState);
  }
  
  transitionTo(newState: EngineState): boolean {
    if (!this.canTransitionTo(newState)) {
      console.warn(
        `Invalid state transition: ${this.currentState} -> ${newState}`
      );
      return false;
    }
    
    const oldState = this.currentState;
    this.currentState = newState;
    this.emit('state-change', oldState, newState);
    return true;
  }
  
  isInState(...states: EngineState[]): boolean {
    return states.includes(this.currentState);
  }
  
  requireState(...states: EngineState[]): void {
    if (!this.isInState(...states)) {
      throw new Error(
        `Operation requires state to be one of: ${states.join(', ')}, ` +
        `but current state is: ${this.currentState}`
      );
    }
  }
  
  reset(): void {
    const oldState = this.currentState;
    this.currentState = 'uninitialized';
    if (oldState !== 'uninitialized') {
      this.emit('state-change', oldState, 'uninitialized');
    }
  }
}