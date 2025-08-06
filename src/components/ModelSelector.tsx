import React, { useState, useEffect } from 'react';

export interface WhisperModel {
  id: 'tiny' | 'base' | 'medium';
  name: string;
  size: string;
}

const MODELS: WhisperModel[] = [
  { id: 'tiny', name: 'Whisper Tiny', size: '39 MB' },
  { id: 'base', name: 'Whisper Base', size: '74 MB' },
  { id: 'medium', name: 'Whisper Medium', size: '769 MB' }
];

interface Props {
  onModelSelect: (modelId: 'tiny' | 'base' | 'medium') => void;
}

export const ModelSelector: React.FC<Props> = ({ onModelSelect }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + MODELS.length) % MODELS.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % MODELS.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onModelSelect(MODELS[selectedIndex].id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
      zIndex: 9999
    },
    box: {
      border: '2px solid #0f0',
      padding: '40px',
      background: '#001100',
      maxWidth: '600px',
      width: '90%'
    },
    title: {
      textAlign: 'center' as const,
      fontSize: '24px',
      marginBottom: '30px',
      textShadow: '0 0 10px #0f0'
    },
    instructions: {
      textAlign: 'center' as const,
      marginBottom: '30px',
      opacity: 0.8
    },
    list: {
      listStyle: 'none',
      padding: 0,
      margin: '20px 0'
    },
    item: {
      padding: '10px',
      margin: '5px 0',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    selected: {
      background: '#003300',
      transform: 'translateX(10px)',
      boxShadow: '0 0 20px #0f0'
    },
    footer: {
      textAlign: 'center' as const,
      marginTop: '30px',
      opacity: 0.6
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.box}>
        <h1 style={styles.title}>WHISPER MODEL SELECTOR</h1>
        
        <div style={styles.instructions}>
          ↑/↓ Navigate • ENTER Select
        </div>

        <ul style={styles.list}>
          {MODELS.map((model, index) => (
            <li
              key={model.id}
              style={{
                ...styles.item,
                ...(index === selectedIndex ? styles.selected : {})
              }}
              onClick={() => onModelSelect(model.id)}
            >
              {index === selectedIndex ? '▶ ' : '  '}
              {model.name} [{model.size}]
            </li>
          ))}
        </ul>

        <div style={styles.footer}>
          Press ENTER to continue...
        </div>
      </div>
    </div>
  );
};