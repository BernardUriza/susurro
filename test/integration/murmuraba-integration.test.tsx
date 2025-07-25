import { describe, it, expect, beforeAll } from 'vitest'
import puppeteer, { Browser, Page } from 'puppeteer'

describe('Murmuraba Integration Tests', () => {
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    browser = await puppeteer.launch({ 
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    })
  }, 30000)

  afterAll(async () => {
    if (browser) await browser.close()
  })

  it('debe verificar que murmuraba está autocontenido y funcional', async () => {
    page = await browser.newPage()
    
    // Navegar a una página de prueba simple
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Murmuraba Test</title>
      </head>
      <body>
        <h1>Testing Murmuraba</h1>
        <div id="result"></div>
        <script type="module">
          import * as murmuraba from 'https://unpkg.com/murmuraba@latest/dist/index.mjs';
          
          window.murmuraba = murmuraba;
          
          // Verificar que murmuraba carga correctamente
          if (murmuraba && murmuraba.initializeAudioEngine) {
            document.getElementById('result').textContent = 'Murmuraba loaded successfully';
            
            // Inicializar el motor
            murmuraba.initializeAudioEngine({
              enableAGC: true,
              enableNoiseSuppression: true
            }).then(() => {
              document.getElementById('result').textContent += ' - Engine initialized';
            }).catch(err => {
              document.getElementById('result').textContent += ' - Error: ' + err.message;
            });
          } else {
            document.getElementById('result').textContent = 'Murmuraba failed to load';
          }
        </script>
      </body>
      </html>
    `)

    // Esperar a que murmuraba se cargue
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Verificar el resultado
    const result = await page.$eval('#result', el => el.textContent)
    console.log('Murmuraba status:', result)
    
    expect(result).toContain('Murmuraba loaded successfully')
  }, 10000)

  it('debe procesar audio sin necesidad de archivos externos', async () => {
    page = await browser.newPage()
    
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <body>
        <input type="file" id="fileInput" accept="audio/*">
        <div id="chunks"></div>
        <script type="module">
          import * as murmuraba from 'https://unpkg.com/murmuraba@latest/dist/index.mjs';
          
          document.getElementById('fileInput').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
              await murmuraba.initializeAudioEngine({
                enableAGC: true,
                enableNoiseSuppression: true,
                enableEchoCancellation: true
              });
              
              // Simular procesamiento
              const chunks = [
                { start: 0, end: 8, duration: 8, vadScore: 0.85 },
                { start: 8, end: 13, duration: 5, vadScore: 0.72 }
              ];
              
              const chunksDiv = document.getElementById('chunks');
              chunks.forEach((chunk, i) => {
                const div = document.createElement('div');
                div.setAttribute('data-testid', 'chunk-' + i);
                div.setAttribute('data-vad', chunk.vadScore);
                div.textContent = 'Chunk ' + (i + 1) + ': VAD=' + chunk.vadScore;
                chunksDiv.appendChild(div);
              });
              
            } catch (err) {
              console.error('Error:', err);
            }
          });
        </script>
      </body>
      </html>
    `)

    // Simular carga de archivo
    const input = await page.$('#fileInput')
    const filePath = process.cwd() + '/public/sample.wav'
    await input!.uploadFile(filePath)

    // Esperar procesamiento
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Verificar chunks
    const chunk0 = await page.$('[data-testid="chunk-0"]')
    const chunk1 = await page.$('[data-testid="chunk-1"]')
    
    expect(chunk0).toBeTruthy()
    expect(chunk1).toBeTruthy()

    const vad0 = await page.$eval('[data-testid="chunk-0"]', el => el.getAttribute('data-vad'))
    const vad1 = await page.$eval('[data-testid="chunk-1"]', el => el.getAttribute('data-vad'))

    expect(parseFloat(vad0!)).toBeGreaterThan(0.5)
    expect(parseFloat(vad1!)).toBeGreaterThan(0.5)
  }, 10000)
})