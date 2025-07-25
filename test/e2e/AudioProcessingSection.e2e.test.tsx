import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import puppeteer from 'puppeteer'

describe('AudioProcessingSection E2E Tests con murmuraba', () => {
  let browser: any
  let page: any
  let logs: Array<{type: string, text: string}> = []
  const startTime = Date.now()

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    page = await browser.newPage()
    
    page.on('console', (msg: any) => {
      const text = msg.text()
      logs.push({ type: msg.type(), text })
      if (text.includes('VAD') || text.includes('chunk')) {
        console.log(`[Browser Log] ${text}`)
      }
    })
    
    page.on('pageerror', (err: any) => { 
      console.error(`[Page Error] ${err.message}`)
    })

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' })
  }, 30000)

  afterAll(async () => {
    const totalTime = Date.now() - startTime
    console.log(`Total test time: ${totalTime}ms`)
    await browser.close()
  })

  it('debe cargar murmuraba y procesar chunks con VAD', async () => {
    const filePath = process.cwd() + '/public/sample.wav'
    
    // Esperar a que murmuraba se cargue
    await page.waitForFunction(() => {
      return window.murmuraba !== undefined
    }, { timeout: 10000 })

    // Subir archivo
    const inputElement = await page.$('input[type="file"]')
    expect(inputElement).toBeTruthy()
    await inputElement.uploadFile(filePath)

    // Esperar procesamiento de chunks
    await page.waitForSelector('[data-testid="chunk-info"]', { timeout: 15000 })

    // Validar chunks generados
    const chunks = await page.$$eval('[data-testid="chunk-info"]', 
      (elements: any[]) => elements.map(el => ({
        duration: parseFloat(el.getAttribute('data-duration') || '0'),
        start: parseFloat(el.getAttribute('data-start') || '0'),
        end: parseFloat(el.getAttribute('data-end') || '0')
      }))
    )

    // Archivo de 13s debe generar 2 chunks: 8s y 5s
    expect(chunks).toHaveLength(2)
    expect(chunks[0].duration).toBeCloseTo(8, 0.5)
    expect(chunks[0].start).toBe(0)
    expect(chunks[0].end).toBe(8)
    
    expect(chunks[1].duration).toBeCloseTo(5, 0.5)
    expect(chunks[1].start).toBe(8)
    expect(chunks[1].end).toBeCloseTo(13, 0.5)
  })

  it('debe detectar voz con VAD score > 0.5 en cada chunk', async () => {
    const vadScores = await page.$$eval('[data-testid="vad-score"]', 
      (elements: any[]) => elements.map(el => parseFloat(el.textContent || '0'))
    )

    expect(vadScores).toHaveLength(2)
    vadScores.forEach((score, index) => {
      console.log(`Chunk ${index + 1} VAD score: ${score}`)
      expect(score).toBeGreaterThan(0.5)
    })

    // Verificar indicador de voz detectada
    const voiceIndicator = await page.$('[data-testid="voice-detected"]')
    expect(voiceIndicator).toBeTruthy()
    
    const voiceText = await page.$eval('[data-testid="voice-detected"]', 
      (el: any) => el.textContent
    )
    expect(voiceText).toContain('Voice detected')
  })

  it('debe completar procesamiento sin errores de consola', async () => {
    const errors = logs.filter(l => l.type === 'error')
    expect(errors).toHaveLength(0)

    // Verificar logs de murmuraba
    const murmurabaLogs = logs.filter(l => 
      l.text.includes('murmuraba') || 
      l.text.includes('VAD') || 
      l.text.includes('chunk')
    )
    expect(murmurabaLogs.length).toBeGreaterThan(0)
  })

  it('debe medir performance del procesamiento', async () => {
    const startMark = await page.evaluate(() => performance.now())
    
    // Esperar a que termine el procesamiento
    await page.waitForSelector('[data-testid="vad-results"]')
    
    const endMark = await page.evaluate(() => performance.now())
    const processingTime = endMark - startMark
    
    console.log(`Processing time: ${processingTime}ms`)
    expect(processingTime).toBeLessThan(5000) // < 5 segundos
  })
})