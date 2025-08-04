'use client'

// React and external libraries
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

interface MatrixAlertProps {
  isOpen: boolean
  onClose?: () => void
  title?: string
  message?: string
  progress?: number
  type?: 'loading' | 'success' | 'error' | 'info'
  autoClose?: number
}

export const MatrixAlert: React.FC<MatrixAlertProps> = ({
  isOpen,
  onClose,
  title = '[SYSTEM_ALERT]',
  message = '',
  progress,
  type = 'info',
  autoClose
}) => {
  const [isVisible, setIsVisible] = useState(isOpen)

  useEffect(() => {
    setIsVisible(isOpen)
    
    if (isOpen && autoClose && autoClose > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, autoClose)
      
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoClose, onClose])

  if (!isVisible) return null

  const content = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 9999,
      animation: 'fadeIn 0.3s ease-in'
    }}>
      <div style={{
        background: 'rgba(0, 0, 0, 0.95)',
        border: '2px solid #00ff41',
        padding: '30px',
        minWidth: '400px',
        maxWidth: '600px',
        boxShadow: '0 0 20px #00ff41',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Matrix rain effect background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #00ff41 2px, #00ff41 3px)',
          animation: 'matrix-rain 20s linear infinite'
        }} />
        
        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{
            color: '#00ff41',
            fontSize: '1.5rem',
            marginBottom: '20px',
            fontFamily: 'monospace',
            textShadow: '0 0 10px #00ff41',
            textTransform: 'uppercase',
            letterSpacing: '2px'
          }}>
            {title}
          </h2>
          
          {type === 'loading' && (
            <div style={{
              fontSize: '3rem',
              textAlign: 'center',
              marginBottom: '20px',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}>
              🎙️
            </div>
          )}
          
          <p style={{
            color: '#00ff41',
            fontSize: '1.1rem',
            marginBottom: progress !== undefined ? '20px' : '0',
            fontFamily: 'monospace',
            lineHeight: '1.6'
          }}>
            {message}
          </p>
          
          {progress !== undefined && (
            <>
              <div style={{
                background: 'rgba(0, 255, 65, 0.1)',
                height: '10px',
                borderRadius: '0',
                overflow: 'hidden',
                marginBottom: '10px',
                border: '1px solid rgba(0, 255, 65, 0.3)'
              }}>
                <div style={{
                  background: 'linear-gradient(90deg, #00ff41, #00cc33)',
                  height: '100%',
                  width: `${progress}%`,
                  transition: 'width 0.3s ease',
                  boxShadow: '0 0 10px #00ff41'
                }} />
              </div>
              <p style={{
                color: '#00ff41',
                fontSize: '0.9rem',
                textAlign: 'center',
                fontFamily: 'monospace',
                opacity: 0.8
              }}>
                [{Math.round(progress)}%]
              </p>
            </>
          )}
          
          {type === 'success' && (
            <div style={{
              marginTop: '20px',
              textAlign: 'center',
              fontSize: '2rem'
            }}>
              ✅
            </div>
          )}
          
          {type === 'error' && (
            <div style={{
              marginTop: '20px',
              textAlign: 'center',
              fontSize: '2rem'
            }}>
              ❌
            </div>
          )}
        </div>
        
        {/* Close button for non-auto-close alerts */}
        {!autoClose && onClose && (
          <button
            onClick={() => {
              setIsVisible(false)
              onClose()
            }}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'transparent',
              border: '1px solid #00ff41',
              color: '#00ff41',
              padding: '5px 10px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00ff41'
              e.currentTarget.style.color = '#000'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#00ff41'
            }}
          >
            [X]
          </button>
        )}
      </div>
      
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
        
        @keyframes matrix-rain {
          from { transform: translateY(0); }
          to { transform: translateY(20px); }
        }
      `}</style>
    </div>
  )

  return ReactDOM.createPortal(content, document.body)
}

// Alert manager singleton
class MatrixAlertManager {
  private static instance: MatrixAlertManager
  private container: HTMLDivElement | null = null
  
  static getInstance(): MatrixAlertManager {
    if (!MatrixAlertManager.instance) {
      MatrixAlertManager.instance = new MatrixAlertManager()
    }
    return MatrixAlertManager.instance
  }
  
  private ensureContainer() {
    if (!this.container && typeof document !== 'undefined') {
      this.container = document.createElement('div')
      this.container.id = 'matrix-alert-container'
      document.body.appendChild(this.container)
    }
    return this.container
  }
  
  show(props: Omit<MatrixAlertProps, 'isOpen'>) {
    const container = this.ensureContainer()
    if (!container) return null
    
    const alertId = `alert-${Date.now()}`
    const alertDiv = document.createElement('div')
    alertDiv.id = alertId
    container.appendChild(alertDiv)
    
    const close = () => {
      ReactDOM.unmountComponentAtNode(alertDiv)
      alertDiv.remove()
      props.onClose?.()
    }
    
    ReactDOM.render(
      <MatrixAlert
        {...props}
        isOpen={true}
        onClose={close}
      />,
      alertDiv
    )
    
    return {
      update: (newProps: Partial<MatrixAlertProps>) => {
        ReactDOM.render(
          <MatrixAlert
            {...props}
            {...newProps}
            isOpen={true}
            onClose={close}
          />,
          alertDiv
        )
      },
      close
    }
  }
}

export const matrixAlert = MatrixAlertManager.getInstance()