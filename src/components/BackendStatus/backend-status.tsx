import { useEffect, useState } from 'react';
import styles from './backend-status.module.css';

interface BackendStatusProps {
  backendUrl?: string;
  selectedModel?: string;
}

export const BackendStatus: React.FC<BackendStatusProps> = ({
  backendUrl = import.meta.env.VITE_WHISPER_BACKEND_URL || 'http://localhost:8000',
  selectedModel
}) => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'error'>('checking');
  const [implementation, setImplementation] = useState<string>('');

  useEffect(() => {
    const checkBackend = async () => {
      if (selectedModel === 'deepgram') {
        setStatus('online');
        setImplementation('Deepgram Nova-2 API');
        return;
      }

      try {
        const response = await fetch(`${backendUrl}/health`, {
          method: 'GET',
          mode: 'cors',
          signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
          const data = await response.json();
          setStatus('online');
          setImplementation(data.implementation || 'whisper');
        } else {
          setStatus('offline');
        }
      } catch (error) {
        setStatus('offline');
      }
    };

    // Check immediately
    checkBackend();

    // Check every 10 seconds
    const interval = setInterval(checkBackend, 10000);

    return () => clearInterval(interval);
  }, [backendUrl, selectedModel]);

  const getStatusColor = () => {
    switch (status) {
      case 'online': return '#00ff00';
      case 'offline': return '#ff0000';
      case 'checking': return '#ffff00';
      default: return '#808080';
    }
  };

  const getStatusText = () => {
    if (selectedModel === 'deepgram') {
      return 'Deepgram API';
    }

    switch (status) {
      case 'online': return `Backend: ${implementation}`;
      case 'offline': return 'Backend: Offline';
      case 'checking': return 'Backend: Checking...';
      default: return 'Backend: Unknown';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.indicator}>
        <span
          className={styles.dot}
          style={{ backgroundColor: getStatusColor() }}
        />
        <span className={styles.text}>{getStatusText()}</span>
      </div>
    </div>
  );
};