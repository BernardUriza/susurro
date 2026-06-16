/**
 * Test brutal para React 19 + Next.js 14 compatibility
 * Siguiendo protocolo RED->GREEN->REFACTOR
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMurmubaraEngine } from '../../hooks/murmuraba-engine';

// Mock de módulos que requieren servidor
vi.mock('../../api', () => ({
  initializeAudioEngine: vi.fn().mockResolvedValue(undefined),
  destroyEngine: vi.fn().mockResolvedValue(undefined),
  getEngineStatus: vi.fn().mockReturnValue('ready'),
  getDiagnostics: vi.fn().mockReturnValue({}),
  onMetricsUpdate: vi.fn(),
  processStream: vi.fn(),
  processStreamChunked: vi.fn(),
  processFile: vi.fn()
}));

vi.mock('../../utils/audio-converter', () => ({
  getAudioConverter: vi.fn().mockReturnValue({}),
  destroyAudioConverter: vi.fn()
}));

// Mock dynamic import scenario
const mockDynamicImport = () => {
  // Simular el entorno de Next.js con React 19
  const originalReact = globalThis.React;
  
  // Simular React 19 context
  globalThis.React = {
    ...originalReact,
    version: '19.0.0',
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
      ReactCurrentDispatcher: {
        current: null
      }
    }
  } as any;
  
  return () => {
    globalThis.React = originalReact;
  };
};

describe('React 19 + Next.js 14 Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debe funcionar con importación dinámica en Next.js', async () => {
    const cleanup = mockDynamicImport();
    
    try {
      // Simular importación dinámica
      const { useMurmubaraEngine: dynamicHook } = await import('../../hooks/murmuraba-engine');
      
      const { result } = renderHook(() => dynamicHook());
      
      expect(result.current).toBeDefined();
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.error).toBeNull();
      
      // Verificar que puede inicializarse
      await act(async () => {
        await result.current.initialize();
      });
      
      expect(result.current.isInitialized).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('debe manejar SSR deshabilitado correctamente', () => {
    // Este test verifica que el hook puede ser importado sin errores
    // en un entorno con SSR deshabilitado (dynamic import con ssr: false)
    const { result } = renderHook(() => useMurmubaraEngine());
    
    expect(result.current).toBeDefined();
    expect(result.current.error).toBeNull();
    expect(result.current.isInitialized).toBe(false);
    
    // Verificar que todas las funciones están disponibles
    expect(result.current.initialize).toBeInstanceOf(Function);
    expect(result.current.processFile).toBeInstanceOf(Function);
  });

  it('debe funcionar con múltiples versiones de React en peerDependencies', () => {
    const reactVersions = ['16.8.0', '17.0.0', '18.0.0', '19.0.0'];
    
    reactVersions.forEach(version => {
      const cleanup = mockDynamicImport();
      (globalThis.React as any).version = version;
      
      try {
        const { result } = renderHook(() => useMurmubaraEngine());
        expect(result.current).toBeDefined();
        expect(() => result.current.initialize()).not.toThrow();
      } finally {
        cleanup();
      }
    });
  });

  it('no debe acceder a React internals directamente', () => {
    const internalsSpy = vi.spyOn(React as any, '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED', 'get');
    
    renderHook(() => useMurmubaraEngine());
    
    // El hook NO debe acceder a internals
    expect(internalsSpy).not.toHaveBeenCalled();
  });

  it('debe mantener API estable con react19Mode', async () => {
    const { result } = renderHook(() => useMurmubaraEngine({ 
      react19Mode: true 
    }));
    
    // Verificar que todas las funciones existen
    expect(result.current.initialize).toBeInstanceOf(Function);
    expect(result.current.destroy).toBeInstanceOf(Function);
    expect(result.current.processFile).toBeInstanceOf(Function);
    expect(result.current.startRecording).toBeInstanceOf(Function);
    expect(result.current.stopRecording).toBeInstanceOf(Function);
  });
});