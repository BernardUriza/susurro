// React and external libraries
import { useState, useEffect } from 'react';

// Type imports
import type { FC } from 'react';

export interface WhisperModel {
  id: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  name: string;
  size: string;
  description: string;
}

const WHISPER_MODELS: WhisperModel[] = [
  { id: 'tiny', name: 'Whisper Tiny', size: '39 MB', description: 'Más rápido, menos preciso' },
  { id: 'base', name: 'Whisper Base', size: '74 MB', description: 'Balance básico' },
  { id: 'small', name: 'Whisper Small', size: '244 MB', description: 'Buena precisión' },
  {
    id: 'medium',
    name: 'Whisper Medium',
    size: '769 MB',
    description: 'Recomendado - Mejor balance',
  },
  { id: 'large', name: 'Whisper Large-v3', size: '1.5 GB', description: 'Máxima precisión' },
];

interface ModelSelectorProps {
  onModelSelect: (modelId: 'tiny' | 'base' | 'small' | 'medium' | 'large') => void;
}

export const ModelSelector: FC<ModelSelectorProps> = ({ onModelSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + WHISPER_MODELS.length) % WHISPER_MODELS.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % WHISPER_MODELS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onModelSelect(WHISPER_MODELS[selectedIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedIndex, onModelSelect]);

  const styles = {
    container: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: '#000',
      color: '#0f0',
      fontFamily: 'monospace',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    },
    box: {
      border: '2px solid #0f0',
      padding: '40px',
      background: '#001100',
      maxWidth: '600px',
      width: '90%',
    },
    title: {
      textAlign: 'center' as const,
      fontSize: '24px',
      marginBottom: '30px',
      textShadow: '0 0 10px #0f0',
    },
    instructions: {
      textAlign: 'center' as const,
      marginBottom: '30px',
      opacity: 0.8,
    },
    list: {
      listStyle: 'none',
      padding: 0,
      margin: '20px 0',
    },
    item: {
      padding: '10px',
      margin: '5px 0',
      cursor: 'pointer',
      transition: 'all 0.2s',
    },
    selected: {
      background: '#003300',
      transform: 'translateX(10px)',
      boxShadow: '0 0 20px #0f0',
    },
    footer: {
      textAlign: 'center' as const,
      marginTop: '30px',
      opacity: 0.6,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1 style={styles.title}>WHISPER MODEL SELECTOR</h1>
        <div style={{ ...styles.instructions, fontSize: '14px', marginBottom: '10px' }}>
          🌍 Modelos Multilingües - Soporte Completo para Español
        </div>
        <div style={styles.instructions}>↑/↓ Navegar • ENTER Seleccionar</div>

        <ul style={styles.list}>
          {WHISPER_MODELS.map((model, index) => (
            <li
              key={model.id}
              style={{
                ...styles.item,
                ...(index === selectedIndex ? styles.selected : {}),
              }}
              onClick={() => onModelSelect(model.id)}
            >
              {index === selectedIndex ? '▶ ' : '  '}
              {model.name} [{model.size}] - {model.description}
            </li>
          ))}
        </ul>

        <div style={styles.footer}>Press ENTER to continue...</div>
      </div>
    </div>
  );
};
