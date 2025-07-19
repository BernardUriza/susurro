'use client'

import { WhisperRecorder } from '../src/components/WhisperRecorder'
import '../src/components/styles.css'
import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'

export default function Home() {
  const [transcriptions, setTranscriptions] = useState<string[]>([])
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [showApp, setShowApp] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleTranscription = (text: string) => {
    console.log('Transcripción recibida:', text)
    setTranscriptions(prev => [text, ...prev])
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type === 'audio/wav') {
      setUploadedFile(file)
      
      // SweetAlert2 Toast notification
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        background: '#000a00',
        color: '#00ff00',
        iconColor: '#00ff00',
        customClass: {
          popup: 'swal-dark-popup',
          title: 'swal-dark-title',
          timerProgressBar: 'swal-dark-progress'
        },
        didOpen: (toast) => {
          toast.style.border = '2px solid #00ff00'
          toast.style.boxShadow = '0 0 20px #00ff00'
        }
      })
      
      Toast.fire({
        icon: 'success',
        title: '📁 Archivo WAV cargado',
        text: file.name
      })
    } else if (file) {
      Swal.fire({
        icon: 'error',
        title: '¡Formato Inválido!',
        text: 'Solo se aceptan archivos WAV',
        background: '#000a00',
        color: '#ff0000',
        confirmButtonColor: '#00ff00',
        confirmButtonText: 'Entendido',
        customClass: {
          popup: 'swal-dark-popup',
          title: 'swal-error-title'
        },
        didOpen: (popup) => {
          popup.style.border = '2px solid #ff0000'
          popup.style.boxShadow = '0 0 30px #ff0000'
        }
      })
    }
  }

  const handleStartApp = () => {
    setShowApp(true)
  }

  if (!showApp) {
    return (
      <div className="welcome-container">
        <div className="background-orbs">
          <div className="orb-1"></div>
          <div className="orb-2"></div>
          <div className="orb-3"></div>
        </div>

        <main className={`welcome-main ${mounted ? 'mounted' : ''}`}>
          <div className="glow-card">
            <h1 className="welcome-title">
              <span className="wave">¡Hola!</span> 
              <span className="gradient-text">Bienvenido a SUSURRO</span>
            </h1>
            
            <p className="welcome-subtitle">
              Transcripción de voz con IA, directamente en tu navegador
            </p>
          </div>

          <section className="hero-section">
            <div className="floating-card">
              <div className="card-header">
                <h2 className="section-title">
                  <span className="icon">🤖</span>
                  Powered by Transformers.js
                </h2>
              </div>
              
              <div className="card-content">
                <p className="description">
                  SUSURRO ejecuta modelos de IA de última generación 
                  <span className="highlight"> directamente en tu navegador</span>, 
                  sin necesidad de servidores externos. Todo gracias a
                  <span className="brand-name"> Transformers.js by Xenova</span>.
                </p>
              </div>
            </div>
          </section>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🚀</div>
              <h3>100% JavaScript</h3>
              <p>Ejecuta Whisper sin Python, directamente en el navegador</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3>WebAssembly + WebGPU</h3>
              <p>Rendimiento increíble gracias a ONNX Runtime</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Privacidad Total</h3>
              <p>Tu voz nunca sale del dispositivo</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3>Sin Latencia</h3>
              <p>Procesamiento instantáneo y local</p>
            </div>
          </div>

          <div className="cta-section">
            <h2 className="cta-title">
              ¿Listo para experimentar la transcripción
              <span className="animated-text"> del futuro</span>?
            </h2>
            <p className="cta-description">
              Con SUSURRO, puedes transcribir audio en tiempo real o desde archivos WAV,
              todo procesado localmente en tu navegador.
            </p>
            
            <button onClick={handleStartApp} className="primary-button">
              Comenzar a Transcribir
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="modern-layout">
      {/* Header */}
      <header className="header">
        <h1>SUSURRO</h1>
        <p className="tagline">Neural Voice Recognition System v2.077</p>
      </header>

      {/* Main Content - 3 Column Layout */}
      <main className="main-content">
        {/* Left Panel - Features */}
        <aside className="panel panel-left">
          <h2>⚡ System Capabilities</h2>
          <ul className="features-list">
            <li>
              <span className="feature-icon">🔐</span>
              <strong>Zero-Knowledge Protocol</strong>
              <small>Neural processing stays on-device</small>
            </li>
            <li>
              <span className="feature-icon">⚡</span>
              <strong>Real-Time Processing</strong>
              <small>Sub-millisecond response time</small>
            </li>
            <li>
              <span className="feature-icon">🌐</span>
              <strong>Edge Computing</strong>
              <small>No cloud dependency required</small>
            </li>
            <li>
              <span className="feature-icon">🤖</span>
              <strong>Neural Architecture</strong>
              <small>Transformer-based AI engine</small>
            </li>
          </ul>
        </aside>

        {/* Center Panel - Main Interface */}
        <section className="panel panel-center">
          <div className="recorder-section">
            <h2>🎙️ Live Audio Capture</h2>
            <WhisperRecorder
              config={{
                language: 'es',
              }}
              onTranscription={handleTranscription}
            />
          </div>

          <div className="divider"></div>

          <div className="upload-section">
            <h2>📁 WAV File Upload</h2>
            
            {/* Demo Button */}
            <div className="demo-section">
              <p className="demo-text">First time? Try our sample audio file:</p>
              <button 
                className="demo-button"
                onClick={async () => {
                  const Toast = Swal.mixin({
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000,
                    timerProgressBar: true,
                    background: '#000a00',
                    color: '#00ff00',
                    iconColor: '#00ff00',
                    customClass: {
                      popup: 'swal-dark-popup',
                      title: 'swal-dark-title',
                      timerProgressBar: 'swal-dark-progress'
                    },
                    didOpen: (toast) => {
                      toast.style.border = '2px solid #00ff00'
                      toast.style.boxShadow = '0 0 20px #00ff00'
                    }
                  })
                  
                  try {
                    // Cargar sample.wav
                    const response = await fetch('/sample.wav')
                    if (!response.ok) throw new Error('No se pudo cargar el archivo')
                    
                    const blob = await response.blob()
                    const file = new File([blob], 'sample.wav', { type: 'audio/wav' })
                    setUploadedFile(file)
                    
                    Toast.fire({
                      icon: 'success',
                      title: '🎵 Archivo de ejemplo cargado',
                      text: 'sample.wav listo para procesar'
                    })
                  } catch (error) {
                    Swal.fire({
                      icon: 'error',
                      title: '¡Error al cargar ejemplo!',
                      text: 'No se pudo cargar sample.wav',
                      background: '#000a00',
                      color: '#ff0000',
                      confirmButtonColor: '#00ff00',
                      confirmButtonText: 'Entendido',
                      customClass: {
                        popup: 'swal-dark-popup',
                        title: 'swal-error-title'
                      },
                      didOpen: (popup) => {
                        popup.style.border = '2px solid #ff0000'
                        popup.style.boxShadow = '0 0 30px #ff0000'
                      }
                    })
                  }
                }}
              >
                🎤 Load Sample File
              </button>
            </div>
            
            <div className="divider-small"></div>
            
            <div className="file-upload">
              <input
                type="file"
                id="wav-upload"
                accept="audio/wav"
                onChange={handleFileUpload}
                className="file-input"
              />
              <label htmlFor="wav-upload" className="file-label">
                {uploadedFile ? uploadedFile.name : 'Select WAV File'}
              </label>
              {uploadedFile && (
                <button 
                  className="process-button"
                  onClick={() => {
                    Swal.fire({
                      title: '🎵 Procesando WAV',
                      html: '<div class="swal-loading-spinner">🎶</div><br>Analizando archivo de audio...',
                      allowOutsideClick: false,
                      showConfirmButton: false,
                      background: '#000a00',
                      color: '#00ff00',
                      customClass: {
                        popup: 'swal-dark-popup'
                      },
                      didOpen: (popup) => {
                        popup.style.border = '2px solid #00ff00'
                        popup.style.boxShadow = '0 0 30px #00ff00'
                        Swal.showLoading()
                        
                        // Simulación de procesamiento (aquí iría la lógica real)
                        setTimeout(() => {
                          Swal.close()
                          const Toast = Swal.mixin({
                            toast: true,
                            position: 'top-end',
                            showConfirmButton: false,
                            timer: 3000,
                            timerProgressBar: true,
                            background: '#000a00',
                            color: '#00ff00',
                            iconColor: '#00ff00',
                            customClass: {
                              popup: 'swal-dark-popup',
                              title: 'swal-dark-title',
                              timerProgressBar: 'swal-dark-progress'
                            },
                            didOpen: (toast) => {
                              toast.style.border = '2px solid #00ff00'
                              toast.style.boxShadow = '0 0 20px #00ff00'
                            }
                          })
                          
                          Toast.fire({
                            icon: 'info',
                            title: '⏳ Funcionalidad en desarrollo',
                            text: 'Procesamiento WAV próximamente'
                          })
                        }, 2000)
                      }
                    })
                  }}
                >
                  Process File
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right Panel - History */}
        <aside className="panel panel-right">
          <h2>📜 Transcription Log</h2>
          <div className="transcription-history">
            {transcriptions.length === 0 ? (
              <p className="empty-history">No transcriptions recorded</p>
            ) : (
              transcriptions.map((text, index) => (
                <div key={index} className="history-item">
                  <span className="history-number">#{transcriptions.length - index}</span>
                  <p className="history-text">{text}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>Initial model download: ~40MB • Cached for future sessions</p>
      </footer>
    </div>
  )
}