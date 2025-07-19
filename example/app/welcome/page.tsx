'use client'

import { useEffect, useState } from 'react'
import styles from './welcome.module.css'

export default function Welcome() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className={styles.container}>
      <div className={styles.backgroundOrbs}>
        <div className={styles.orb1}></div>
        <div className={styles.orb2}></div>
        <div className={styles.orb3}></div>
      </div>

      <main className={`${styles.main} ${mounted ? styles.mounted : ''}`}>
        <div className={styles.glowCard}>
          <h1 className={styles.title}>
            <span className={styles.wave}>¡Hola!</span> 
            <span className={styles.gradient}>Bienvenido</span>
          </h1>
          
          <p className={styles.subtitle}>
            Te voy a platicar sobre algo increíble...
          </p>
        </div>

        <section className={styles.heroSection}>
          <div className={styles.floatingCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.icon}>🤖</span>
                Transformers.js by Xenova
              </h2>
            </div>
            
            <div className={styles.cardContent}>
              <p className={styles.description}>
                Imagina poder ejecutar modelos de IA de última generación 
                <span className={styles.highlight}> directamente en tu navegador</span>, 
                sin necesidad de servidores externos. Eso es exactamente lo que 
                <span className={styles.brandName}> Transformers.js</span> hace posible.
              </p>
            </div>
          </div>
        </section>

        <div className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🚀</div>
            <h3>100% JavaScript</h3>
            <p>Ejecuta modelos de Hugging Face sin Python, directamente en el navegador o Node.js</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⚡</div>
            <h3>WebAssembly + WebGPU</h3>
            <p>Rendimiento increíble gracias a ONNX Runtime y aceleración por hardware</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🔒</div>
            <h3>Privacidad Total</h3>
            <p>Tus datos nunca salen del dispositivo. Todo el procesamiento es local</p>
          </div>

          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎯</div>
            <h3>API Familiar</h3>
            <p>Misma API que la librería Transformers de Python. Si la conoces, ya sabes usarla</p>
          </div>
        </div>

        <section className={styles.demoSection}>
          <h2 className={styles.demoTitle}>¿Por qué es genial?</h2>
          
          <div className={styles.reasonsContainer}>
            <div className={styles.reasonCard}>
              <div className={styles.reasonNumber}>01</div>
              <div className={styles.reasonContent}>
                <h4>Democratiza la IA</h4>
                <p>Ya no necesitas GPUs costosas o servidores potentes. Tu laptop o teléfono es suficiente.</p>
              </div>
            </div>

            <div className={styles.reasonCard}>
              <div className={styles.reasonNumber}>02</div>
              <div className={styles.reasonContent}>
                <h4>Aplicaciones Offline</h4>
                <p>Crea apps que funcionen sin internet. Perfecto para herramientas de productividad y privacidad.</p>
              </div>
            </div>

            <div className={styles.reasonCard}>
              <div className={styles.reasonNumber}>03</div>
              <div className={styles.reasonContent}>
                <h4>Cero Latencia</h4>
                <p>Sin llamadas a APIs. Respuestas instantáneas para experiencias de usuario fluidas.</p>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.ctaSection}>
          <h2 className={styles.ctaTitle}>
            El futuro de la IA es 
            <span className={styles.animatedText}> descentralizado</span>
          </h2>
          <p className={styles.ctaDescription}>
            Con Transformers.js, puedes ejecutar modelos de lenguaje, visión por computadora, 
            audio y más, todo en el cliente. Es el poder de Hugging Face en tus manos.
          </p>
          
          <div className={styles.buttonGroup}>
            <a href="https://huggingface.co/docs/transformers.js" 
               className={styles.primaryButton}
               target="_blank"
               rel="noopener noreferrer">
              Explorar Documentación
            </a>
            <a href="https://github.com/xenova/transformers.js" 
               className={styles.secondaryButton}
               target="_blank"
               rel="noopener noreferrer">
              Ver en GitHub
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}