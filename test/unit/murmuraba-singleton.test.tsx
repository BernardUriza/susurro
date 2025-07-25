import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

describe('Murmuraba Multiple Initialization Error', () => {
  let murmurabaModule: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    murmurabaModule = {
      initializeAudioEngine: vi.fn(),
      destroyEngine: vi.fn(),
      isInitialized: false,
      _engineInstance: null
    }
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('debe fallar cuando se inicializa múltiples veces sin destruir', async () => {
    murmurabaModule.initializeAudioEngine.mockImplementation(() => {
      if (murmurabaModule._engineInstance) {
        throw new Error('Audio engine is already initialized. Call destroyEngine() first.')
      }
      murmurabaModule._engineInstance = true
      murmurabaModule.isInitialized = true
    })

    // Primera inicialización: OK
    expect(() => murmurabaModule.initializeAudioEngine()).not.toThrow()
    
    // Segunda inicialización: DEBE FALLAR
    expect(() => murmurabaModule.initializeAudioEngine()).toThrow(
      'Audio engine is already initialized. Call destroyEngine() first.'
    )
  })

  it('debe permitir reinicialización después de destroyEngine()', async () => {
    murmurabaModule.initializeAudioEngine.mockImplementation(() => {
      if (murmurabaModule._engineInstance) {
        throw new Error('Audio engine is already initialized. Call destroyEngine() first.')
      }
      murmurabaModule._engineInstance = true
      murmurabaModule.isInitialized = true
    })

    murmurabaModule.destroyEngine.mockImplementation(() => {
      murmurabaModule._engineInstance = null
      murmurabaModule.isInitialized = false
    })

    // Primera inicialización
    murmurabaModule.initializeAudioEngine()
    expect(murmurabaModule.isInitialized).toBe(true)

    // Destruir
    murmurabaModule.destroyEngine()
    expect(murmurabaModule.isInitialized).toBe(false)

    // Segunda inicialización: DEBE FUNCIONAR
    expect(() => murmurabaModule.initializeAudioEngine()).not.toThrow()
    expect(murmurabaModule.isInitialized).toBe(true)
  })

  it('debe manejar múltiples componentes intentando inicializar', async () => {
    let isEngineInitialized = false
    
    const initEngine = vi.fn(async () => {
      if (isEngineInitialized) {
        throw new Error('Audio engine is already initialized. Call destroyEngine() first.')
      }
      isEngineInitialized = true
    })

    // Simular 3 componentes montándose al mismo tiempo
    const component1 = initEngine()
    const component2 = initEngine()
    const component3 = initEngine()

    const results = await Promise.allSettled([component1, component2, component3])
    
    // Solo uno debe tener éxito
    const successes = results.filter(r => r.status === 'fulfilled')
    const failures = results.filter(r => r.status === 'rejected')
    
    expect(successes).toHaveLength(1)
    expect(failures).toHaveLength(2)
    failures.forEach(failure => {
      expect((failure as any).reason.message).toBe(
        'Audio engine is already initialized. Call destroyEngine() first.'
      )
    })
  })
})