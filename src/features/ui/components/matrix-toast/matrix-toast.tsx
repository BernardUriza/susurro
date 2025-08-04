'use client';

// React and external libraries
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastItem extends ToastProps {
  id: string;
  isVisible: boolean;
}

export const MatrixToast: React.FC<ToastProps & { onClose: () => void }> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'error':
        return '#ff0041';
      case 'warning':
        return '#ffaa00';
      default:
        return '#00ff41';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.95)',
        border: `1px solid ${getBorderColor()}`,
        padding: '15px 20px',
        minWidth: '300px',
        maxWidth: '400px',
        boxShadow: `0 0 20px ${getBorderColor()}`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'all 0.3s ease',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
      }}
    >
      <span style={{ fontSize: '1.5rem' }}>{getIcon()}</span>
      <p
        style={{
          color: getBorderColor(),
          margin: 0,
          fontFamily: 'monospace',
          fontSize: '0.95rem',
          lineHeight: '1.4',
          flex: 1,
        }}
      >
        {message}
      </p>
    </div>
  );
};

// Toast manager
class MatrixToastManager {
  private static instance: MatrixToastManager;
  private container: HTMLDivElement | null = null;
  private toasts: Map<string, HTMLDivElement> = new Map();

  static getInstance(): MatrixToastManager {
    if (!MatrixToastManager.instance) {
      MatrixToastManager.instance = new MatrixToastManager();
    }
    return MatrixToastManager.instance;
  }

  private ensureContainer() {
    if (!this.container && typeof document !== 'undefined') {
      this.container = document.createElement('div');
      this.container.id = 'matrix-toast-container';
      this.container.style.position = 'fixed';
      this.container.style.top = '20px';
      this.container.style.right = '20px';
      this.container.style.zIndex = '10000';
      this.container.style.display = 'flex';
      this.container.style.flexDirection = 'column';
      this.container.style.gap = '10px';
      document.body.appendChild(this.container);
    }
    return this.container;
  }

  show(props: ToastProps) {
    const container = this.ensureContainer();
    if (!container) return;

    const toastId = `toast-${Date.now()}`;
    const toastDiv = document.createElement('div');
    toastDiv.id = toastId;
    container.appendChild(toastDiv);
    this.toasts.set(toastId, toastDiv);

    const close = () => {
      ReactDOM.unmountComponentAtNode(toastDiv);
      toastDiv.remove();
      this.toasts.delete(toastId);
    };

    ReactDOM.render(<MatrixToast {...props} onClose={close} />, toastDiv);
  }

  success(message: string) {
    this.show({ message, type: 'success' });
  }

  error(message: string) {
    this.show({ message, type: 'error' });
  }

  info(message: string) {
    this.show({ message, type: 'info' });
  }

  warning(message: string) {
    this.show({ message, type: 'warning' });
  }
}

export const matrixToast = MatrixToastManager.getInstance();
