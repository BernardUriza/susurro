import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import puppeteer from 'puppeteer'

describe('AudioProcessor E2E Tests', () => {
  let browser: any
  let page: any
  let logs: Array<{type: string, text: string}> = []

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    page = await browser.newPage()
    
    page.on('console', (msg: any) => {
      logs.push({ type: msg.type(), text: msg.text() })
    })
    
    page.on('pageerror', (err: any) => { 
      throw new Error(`Page crash: ${err.message}`) 
    })

    await page.goto('http://localhost:3000')
  }, 30000)

  afterAll(async () => {
    await browser.close()
  })

  it('debe procesar archivo WAV y detectar VAD > 0.5 en cada chunk', async () => {
    const filePath = process.cwd() + '/public/sample.wav'
    const inputElement = await page.$('input[type="file"]')
    
    expect(inputElement).toBeTruthy()
    
    await inputElement.uploadFile(filePath)
    
    await page.waitForSelector('[data-testid="vad-results"]', { timeout: 10000 })
    
    const vadScores = await page.$$eval('[data-testid="vad-score"]', 
      (elements: any[]) => elements.map(el => parseFloat(el.textContent))
    )
    
    expect(vadScores.length).toBeGreaterThan(0)
    vadScores.forEach(score => {
      expect(score).toBeGreaterThan(0.5)
    })
    
    const errors = logs.filter(l => l.type === 'error')
    expect(errors).toHaveLength(0)
  })

  it('debe dividir archivo de 13s en chunks de 8s + 5s', async () => {
    const chunks = await page.$$eval('[data-testid="chunk-info"]', 
      (elements: any[]) => elements.map(el => ({
        duration: parseFloat(el.getAttribute('data-duration') || '0'),
        start: parseFloat(el.getAttribute('data-start') || '0'),
        end: parseFloat(el.getAttribute('data-end') || '0')
      }))
    )
    
    expect(chunks).toHaveLength(2)
    expect(chunks[0].duration).toBeCloseTo(8, 0.1)
    expect(chunks[1].duration).toBeCloseTo(5, 0.5)
    expect(chunks[0].start).toBe(0)
    expect(chunks[1].start).toBe(8)
  })

  it('debe mostrar detección de voz en tiempo real', async () => {
    const voiceIndicator = await page.$('[data-testid="voice-detected"]')
    expect(voiceIndicator).toBeTruthy()
    
    const isVisible = await voiceIndicator.isVisible()
    expect(isVisible).toBe(true)
  })
})