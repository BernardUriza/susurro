import React, { useEffect, useRef, useState } from 'react';
import { SimpleWaveformAnalyzer } from 'murmuraba';
import styles from '../audio-fragment-processor.module.css';

interface VisualizationPanelProps {
  currentStream: MediaStream | null;
  isRecording: boolean;
  engineReady: boolean;
  showStreamInfo?: boolean;
  onToggleStreamInfo?: (show: boolean) => void;
}

export const VisualizationPanel: React.FC<VisualizationPanelProps> = ({
  currentStream,
  isRecording,
  engineReady,
  showStreamInfo = false,
  onToggleStreamInfo,
}) => {
  const waveformContainerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<any>(null);
  const [streamInfo, setStreamInfo] = useState<string>('No stream active');

  // Initialize waveform analyzer
  useEffect(() => {
    if (waveformContainerRef.current && !waveformRef.current) {
      try {
        waveformRef.current = new (SimpleWaveformAnalyzer as any)(waveformContainerRef.current, {
          lineColor: '#00ff41',
          lineWidth: 2,
          fillColor: 'rgba(0, 255, 65, 0.1)',
          canvasBackground: '#000000',
          responsive: true,
          smoothing: 0.8,
          minDecibels: -90,
          maxDecibels: -10,
          fftSize: 2048,
        });
      } catch (error) {
        console.error('Failed to create waveform analyzer:', error);
      }
    }

    return () => {
      if (waveformRef.current) {
        waveformRef.current.destroy();
        waveformRef.current = null;
      }
    };
  }, []);

  // Connect stream to waveform
  useEffect(() => {
    if (waveformRef.current && currentStream && isRecording) {
      try {
        waveformRef.current.connectStream(currentStream);
        waveformRef.current.start();
      } catch (error) {
        console.error('Failed to connect stream to waveform:', error);
      }
    } else if (waveformRef.current && !isRecording) {
      waveformRef.current.stop();
    }

    return () => {
      if (waveformRef.current && waveformRef.current.isActive) {
        waveformRef.current.stop();
      }
    };
  }, [currentStream, isRecording]);

  // Update stream info
  useEffect(() => {
    if (currentStream) {
      const audioTracks = currentStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const track = audioTracks[0];
        const settings = track.getSettings();
        // const constraints = track.getConstraints();
        
        const info = `
Stream ID: ${currentStream.id}
Active: ${currentStream.active}
Audio Tracks: ${audioTracks.length}

Track Settings:
- Sample Rate: ${settings.sampleRate || 'N/A'} Hz
- Channel Count: ${settings.channelCount || 'N/A'}
- Echo Cancellation: ${settings.echoCancellation || 'N/A'}
- Noise Suppression: ${settings.noiseSuppression || 'N/A'}
- Auto Gain Control: ${settings.autoGainControl || 'N/A'}
- Sample Size: ${settings.sampleSize || 'N/A'} bits
- Latency: ${(settings as any).latency || 'N/A'} ms

Track State:
- Enabled: ${track.enabled}
- Muted: ${track.muted}
- Ready State: ${track.readyState}
- Label: ${track.label || 'Default Microphone'}
        `.trim();
        
        setStreamInfo(info);
      }
    } else {
      setStreamInfo('No stream active');
    }
  }, [currentStream]);

  return (
    <div className={`${styles.panel} ${styles.visualizationPanel}`}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>📊 Audio Visualization</h3>
        <button
          onClick={() => onToggleStreamInfo?.(!showStreamInfo)}
          className={styles.toggleButton}
        >
          {showStreamInfo ? '▼ Hide Info' : '▶ Show Info'}
        </button>
      </div>

      <div className={styles.waveformContainer} ref={waveformContainerRef}>
        {!engineReady && (
          <div className={styles.loading}>
            <span className={styles.spinner}></span>
            Initializing audio engine...
          </div>
        )}
        {engineReady && !isRecording && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: '#888'
          }}>
            Start recording to see waveform
          </div>
        )}
      </div>

      {showStreamInfo && (
        <div className={styles.streamInfo}>
          <pre style={{ 
            margin: 0, 
            fontFamily: 'inherit',
            fontSize: 'inherit',
            color: 'inherit'
          }}>
            {streamInfo}
          </pre>
        </div>
      )}
    </div>
  );
};