'use client'

import { WhisperRecorder } from '../src/components/WhisperRecorder'
import '../src/components/styles.css'

export default function Home() {
  const handleTranscription = (text: string) => {
    console.log('Transcripción recibida:', text)
  }

  return (
    <div className="container">
      <h1>Susurro - Whisper en tu navegador</h1>
      
      <div className="description">
        <p>
          Transcripción de voz a texto usando Transformers.js - 100% local, sin servidor
        </p>
      </div>
      
      <WhisperRecorder
        config={{
          language: 'es',
        }}
        onTranscription={handleTranscription}
      />

      <div className="features">
        <h2>✨ Características</h2>
        <ul>
          <li>🔒 <strong>Privacidad total</strong>: Tu voz nunca sale de tu dispositivo</li>
          <li>⚡ <strong>Sin latencia</strong>: Procesamiento local instantáneo</li>
          <li>🌐 <strong>Sin conexión</strong>: Funciona completamente offline</li>
          <li>🤖 <strong>Powered by Transformers.js</strong>: IA de vanguardia en el navegador</li>
        </ul>
      </div>

      <div className="info">
        <p>
          La primera vez que uses la app, se descargará el modelo Whisper (~40MB).
          El modelo se guardará en caché para uso futuro.
        </p>
      </div>
    </div>
  )
}