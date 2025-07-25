import { describe, it, expect, beforeAll } from 'vitest'
import puppeteer from 'puppeteer'

describe('VAD Performance Tests', () => {
  let browser: any
  let page: any
  const performanceMetrics: any[] = []

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    page = await browser.newPage()
    await page.goto('http://localhost:3000')
  }, 30000)

  it('debe procesar audio en menos de 3 segundos', async () => {
    const startTime = await page.evaluate(() => performance.now())
    const memStart = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0)

    const filePath = process.cwd() + '/public/sample.wav'
    const inputElement = await page.$('input[type="file"]')
    await inputElement.uploadFile(filePath)

    await page.waitForSelector('[data-testid="vad-results"]', { timeout: 5000 })

    const endTime = await page.evaluate(() => performance.now())
    const memEnd = await page.evaluate(() => (performance as any).memory?.usedJSHeapSize || 0)

    const processingTime = endTime - startTime
    const memoryUsed = (memEnd - memStart) / (1024 * 1024) // MB

    performanceMetrics.push({
      processingTimeMs: processingTime,
      memoryUsedMB: memoryUsed
    })

    expect(processingTime).toBeLessThan(3000)
    expect(memoryUsed).toBeLessThan(50)

    console.log(`⏱️ Processing time: ${processingTime.toFixed(2)}ms`)
    console.log(`💾 Memory used: ${memoryUsed.toFixed(2)}MB`)
  })

  it('debe mantener rendimiento constante en múltiples ejecuciones', async () => {
    const times: number[] = []

    for (let i = 0; i < 3; i++) {
      const start = await page.evaluate(() => performance.now())
      
      await page.reload()
      const inputElement = await page.$('input[type="file"]')
      const filePath = process.cwd() + '/public/sample.wav'
      await inputElement.uploadFile(filePath)
      await page.waitForSelector('[data-testid="vad-results"]')
      
      const end = await page.evaluate(() => performance.now())
      times.push(end - start)
    }

    const avgTime = times.reduce((a, b) => a + b) / times.length
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / times.length
    const stdDev = Math.sqrt(variance)

    expect(stdDev).toBeLessThan(500) // Desviación < 500ms
    console.log(`📊 Avg: ${avgTime.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms`)
  })

  afterAll(async () => {
    await browser.close()
    
    console.log('\n📈 Performance Summary:')
    performanceMetrics.forEach((metric, i) => {
      console.log(`Run ${i + 1}: ${metric.processingTimeMs.toFixed(2)}ms, ${metric.memoryUsedMB.toFixed(2)}MB`)
    })
  })
})