import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import puppeteer from 'puppeteer'
import path from 'path'

describe('Murmuraba Singleton E2E', () => {
  let browser: any
  let page: any

  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: 'new' })
    page = await browser.newPage()
  }, 30000)

  afterAll(async () => {
    await browser.close()
  })

  it('debe inicializar murmuraba sin errores de inicialización múltiple', async () => {
    await page.goto('http://localhost:3000')
    // Interceptar logs de consola
    const consoleLogs: string[] = []
    const errorLogs: string[] = []
    
    page.on('console', (msg) => {
      const text = msg.text()
      if (msg.type() === 'error') {
        errorLogs.push(text)
      }
      consoleLogs.push(text)
    })

    // Interceptar errores de página
    page.on('pageerror', (error) => {
      errorLogs.push(error.message)
    })

    // Cargar archivo de audio
    const testFile = path.join(__dirname, '../fixtures/sample-audio.wav')
    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Esperar procesamiento
    await page.waitForTimeout(3000)

    // Verificar que NO hay errores de inicialización múltiple
    const initErrors = errorLogs.filter(log => 
      log.includes('Audio engine is already initialized') ||
      log.includes('Call destroyEngine() first')
    )
    
    expect(initErrors).toHaveLength(0)

    // Verificar que el procesamiento fue exitoso
    const successLogs = consoleLogs.filter(log => 
      log.includes('Processing WAV file') ||
      log.includes('File processing complete')
    )
    
    expect(successLogs.length).toBeGreaterThan(0)
  })

  it('debe procesar múltiples archivos sin conflictos de inicialización', async () => {
    await page.goto('http://localhost:3000')
    const errorLogs: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text())
      }
    })

    const testFile = path.join(__dirname, '../fixtures/sample-audio.wav')
    const fileInput = await page.locator('input[type="file"]')

    // Subir primer archivo
    await fileInput.setInputFiles(testFile)
    await page.waitForTimeout(2000)

    // Limpiar y subir segundo archivo
    await fileInput.setInputFiles([])
    await page.waitForTimeout(500)
    await fileInput.setInputFiles(testFile)
    await page.waitForTimeout(2000)

    // Verificar que NO hay errores de inicialización
    const initErrors = errorLogs.filter(log => 
      log.includes('Audio engine is already initialized')
    )
    
    expect(initErrors).toHaveLength(0)
  })

  it('debe mostrar VAD scores sin errores de DataView', async () => {
    await page.goto('http://localhost:3000')
    const errorLogs: string[] = []
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errorLogs.push(msg.text())
      }
    })

    const testFile = path.join(__dirname, '../fixtures/sample-audio.wav')
    const fileInput = await page.locator('input[type="file"]')
    await fileInput.setInputFiles(testFile)

    // Esperar a que se procese
    await page.waitForTimeout(3000)

    // Verificar que NO hay errores de DataView
    const dataViewErrors = errorLogs.filter(log => 
      log.includes('First argument to DataView constructor must be an ArrayBuffer')
    )
    
    expect(dataViewErrors).toHaveLength(0)

    // Verificar que se muestran los VAD scores
    const vadElements = await page.locator('[data-testid="vad-score"]').all()
    expect(vadElements.length).toBeGreaterThan(0)
  }, 10000)
})