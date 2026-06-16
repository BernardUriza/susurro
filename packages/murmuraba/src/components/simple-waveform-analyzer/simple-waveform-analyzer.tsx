import React, { useRef, useEffect, useState } from 'react';

interface ISimpleWaveformAnalyzerProps {
  stream?: MediaStream;
  isActive?: boolean;
  isPaused?: boolean;
  width?: number;
  height?: number;
}

export const SimpleWaveformAnalyzer: React.FC<ISimpleWaveformAnalyzerProps> = ({
  stream,
  isActive = true,
  isPaused = false,
  width = 800,
  height = 200
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stream || !isActive || isPaused) {
      // Stop animation if paused or inactive
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const initializeWaveform = async () => {
      try {
        // Clean up previous context
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.close();
        }

        // Create new AudioContext
        const audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        // Create analyser
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        // Create source and connect
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        // Store references
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;

        console.log('SimpleWaveformAnalyzer: Initialized successfully');
        setError(null);
        startDrawing();

      } catch (err) {
        console.error('SimpleWaveformAnalyzer: Initialization failed:', err);
        setError('Failed to initialize waveform');
      }
    };

    const startDrawing = () => {
      const canvas = canvasRef.current;
      const analyser = analyserRef.current;
      
      if (!canvas || !analyser) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!isActive || isPaused) return;

        animationRef.current = requestAnimationFrame(draw);

        // Get audio data
        analyser.getByteTimeDomainData(dataArray);

        // Clear canvas
        ctx.fillStyle = '#0A0B0E';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw waveform
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#52A32F';
        ctx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        // Draw amplitude meter
        const average = dataArray.reduce((sum, value) => sum + Math.abs(value - 128), 0) / bufferLength;
        const normalizedAmplitude = average / 128;
        
        // Amplitude bar with gradient
        const ampGradient = ctx.createLinearGradient(10, 0, 110, 0);
        ampGradient.addColorStop(0, '#52A32F');
        ampGradient.addColorStop(1, '#52A32F88');
        ctx.fillStyle = ampGradient;
        ctx.fillRect(10, 10, normalizedAmplitude * 100, 10);
        
        // Meter border
        ctx.strokeStyle = '#2E3039';
        ctx.strokeRect(10, 10, 100, 10);
        
        // Level text
        ctx.fillStyle = '#CACBDA';
        ctx.font = '12px monospace';
        ctx.fillText(`Level: ${(normalizedAmplitude * 100).toFixed(1)}%`, 10, 35);
      };

      draw();
    };

    initializeWaveform();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stream?.id, isActive, isPaused]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#ff6b6b' }}>
        <p>⚠️ {error}</p>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: '200px',
        borderRadius: '10px',
        backgroundColor: '#0A0B0E',
        boxShadow: stream ? '0 4px 20px rgba(102, 126, 234, 0.3)' : 'none'
      }}
    />
  );
};