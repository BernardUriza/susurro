import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

interface IWaveformAnalyzerProps {
  stream?: MediaStream;
  audioUrl?: string;
  label?: string;
  color?: string;
  isActive?: boolean;
  isPaused?: boolean;
  hideControls?: boolean;
  isMuted?: boolean;
  volume?: number;
  className?: string;
  'aria-label'?: string;
  onPlayStateChange?: (isPlaying: boolean) => void;
  width?: number;
  height?: number;
  disabled?: boolean;
  disablePlayback?: boolean;
}

export const WaveformAnalyzer: React.FC<IWaveformAnalyzerProps> = ({ 
  stream,
  audioUrl, 
  label, 
  color = 'var(--grass-glow, #52A32F)',
  isActive = true,
  isPaused = false,
  hideControls = false,
  isMuted = false,
  volume = 1.0,
  className = '',
  'aria-label': ariaLabel,
  onPlayStateChange,
  width = 800,
  height = 200,
  disabled = false,
  disablePlayback = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [source, setSource] = useState<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Optimized canvas dimensions
  const canvasStyle = useMemo(() => ({
    width: '100%',
    height: stream ? '200px' : '150px',
    borderRadius: '10px',
    backgroundColor: 'var(--dark-bg-primary, #0A0B0E)',
    boxShadow: stream ? '0 4px 20px rgba(102, 126, 234, 0.3)' : 'none'
  }), [stream]);

  // Handle play state changes with callback
  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    onPlayStateChange?.(playing);
  }, [onPlayStateChange]);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = 0;
    }
    
    // Disconnect audio source node to release MediaStream reference
    if (source) {
      try {
        source.disconnect();
        console.log('🧹 WaveformAnalyzer: Audio source disconnected');
      } catch (err) {
        console.warn('Warning: Could not disconnect audio source:', err);
      }
    }
    
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(console.error);
    }
    
    // Reset state
    setSource(null);
    setAnalyser(null);
    setAudioContext(null);
  }, [audioContext, source]);

  // Helper function to draw static waveform when no analyser available
  const drawStaticWaveform = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#0A0B0E');
    gradient.addColorStop(1, '#13141A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw a simple static waveform line
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.shadowBlur = 5;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw status text
    ctx.fillStyle = '#CACBDA';
    ctx.font = '12px monospace';
    ctx.fillText('Audio Visualization', 10, 25);
  }, [color]);

  // Drawing functions
  const drawLiveWaveform = useCallback((analyserNode?: AnalyserNode) => {
    if (!canvasRef.current || disabled) return;

    const activeAnalyser = analyserNode || analyser;
    if (!activeAnalyser) {
      console.log('WaveformAnalyzer: No analyser available for drawing');
      return;
    }

    console.log('🎨 drawLiveWaveform: Starting animation with analyser:', {
      fftSize: activeAnalyser.fftSize,
      frequencyBinCount: activeAnalyser.frequencyBinCount
    });

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = activeAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const waveformData = new Uint8Array(bufferLength);

    const drawVisual = () => {
      if (!activeAnalyser || disabled) return;
      animationRef.current = requestAnimationFrame(drawVisual);

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0A0B0E');
      gradient.addColorStop(1, '#13141A');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (isActive && !isPaused) {
        activeAnalyser.getByteFrequencyData(dataArray);
        activeAnalyser.getByteTimeDomainData(waveformData);
        
      } else {
        dataArray.fill(0);
        waveformData.fill(128);
      }

      // Draw frequency bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.5;
        const hue = (i / bufferLength) * 120 + 200;
        ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.3)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      // Draw main waveform
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = waveformData[i] / 128.0;
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
      ctx.shadowBlur = 0;

      // Draw amplitude meter
      let sum = 0;
      for (let i = 0; i < waveformData.length; i++) {
        sum += Math.abs(waveformData[i] - 128);
      }
      const average = sum / waveformData.length;
      const normalizedAmplitude = average / 128;
      
      const ampGradient = ctx.createLinearGradient(10, 0, 110, 0);
      ampGradient.addColorStop(0, '#4A90E2');
      ampGradient.addColorStop(1, '#5B9BD5');
      ctx.fillStyle = ampGradient;
      ctx.fillRect(10, 10, normalizedAmplitude * 100, 10);
      
      ctx.strokeStyle = '#2E3039';
      ctx.strokeRect(10, 10, 100, 10);
      
      ctx.fillStyle = '#CACBDA';
      ctx.font = '12px monospace';
      ctx.fillText(`Volume: ${(normalizedAmplitude * 100).toFixed(1)}%`, 10, 35);
      
      // Status indicator
      if (stream) {
        if (isActive && !isPaused) {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(canvas.width - 20, 20, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#CACBDA';
          ctx.font = '10px monospace';
          ctx.fillText('LIVE', canvas.width - 50, 25);
        } else if (isPaused) {
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(canvas.width - 20, 20, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#CACBDA';
          ctx.font = '10px monospace';
          ctx.fillText('PAUSED', canvas.width - 60, 25);
        }
      }
    };

    drawVisual();
  }, [isActive, isPaused, color, disabled, analyser]);

  const draw = useCallback(() => {
    if (!canvasRef.current || disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If no analyser, draw a static waveform
    if (!analyser) {
      drawStaticWaveform(ctx, canvas);
      return;
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const frequencyData = new Uint8Array(bufferLength);

    const drawVisual = () => {
      if (!analyser || disabled) return;
      
      animationRef.current = requestAnimationFrame(drawVisual);
      
      // Get audio data
      analyser.getByteTimeDomainData(dataArray);
      analyser.getByteFrequencyData(frequencyData);

      // Clear canvas with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#0A0B0E');
      gradient.addColorStop(1, '#13141A');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars (background)
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (frequencyData[i] / 255) * canvas.height * 0.3;
        const hue = (i / bufferLength) * 120 + 200;
        ctx.fillStyle = `hsla(${hue}, 50%, 40%, 0.2)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      // Draw main waveform
      ctx.lineWidth = 3;
      ctx.strokeStyle = color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
      ctx.beginPath();

      const sliceWidth = canvas.width / bufferLength;
      x = 0;

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
      ctx.shadowBlur = 0;

      // Amplitude meter
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += Math.abs(dataArray[i] - 128);
      }
      const average = sum / dataArray.length;
      const normalizedAmplitude = average / 128;
      
      const ampGradient = ctx.createLinearGradient(10, 0, 110, 0);
      ampGradient.addColorStop(0, color);
      ampGradient.addColorStop(1, color + '88');
      ctx.fillStyle = ampGradient;
      ctx.fillRect(10, 10, normalizedAmplitude * 100, 10);
      
      ctx.strokeStyle = '#2E3039';
      ctx.strokeRect(10, 10, 100, 10);
      
      ctx.fillStyle = '#CACBDA';
      ctx.font = '12px monospace';
      ctx.fillText(`Level: ${(normalizedAmplitude * 100).toFixed(1)}%`, 10, 35);
      
      // Status indicator
      if (audioRef.current) {
        const status = audioRef.current.paused ? 'PAUSED' : 'PLAYING';
        const statusColor = audioRef.current.paused ? '#f59e0b' : '#22c55e';
        
        ctx.fillStyle = statusColor;
        ctx.beginPath();
        ctx.arc(canvas.width - 20, 20, 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#CACBDA';
        ctx.font = '10px monospace';
        ctx.fillText(status, canvas.width - 60, 25);
      }
    };

    drawVisual();
  }, [analyser, hideControls, isPaused, color, disabled]);

  // Initialization functions
  const initializeAudio = useCallback(async () => {
    if (!audioRef.current || disabled) return;
    
    // If we already have a working context with analyser, reuse it
    if (audioContext && audioContext.state !== 'closed' && analyser && source) {
      console.log('WaveformAnalyzer: Reusing existing audio context');
      return;
    }

    try {
      // Always close existing context before creating new one
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }
      
      const ctx = new AudioContext();
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.85;

      let sourceNode: MediaElementAudioSourceNode | null = null;
      
      try {
        // Try to create a new source. This will throw if element already has one
        sourceNode = ctx.createMediaElementSource(audioRef.current);
        sourceNode.connect(analyserNode);
        analyserNode.connect(ctx.destination);
        setSource(sourceNode);
        console.log('WaveformAnalyzer: Created new MediaElementSource');
      } catch (err) {
        // If element already has a source from another context, close context and continue
        if (err instanceof Error && err.message.includes('already connected')) {
          console.warn('WaveformAnalyzer: Audio element already connected, continuing without audio context');
          await ctx.close();
          setError(null);
          return;
        } else {
          throw err;
        }
      }

      setAudioContext(ctx);
      setAnalyser(analyserNode);
      setError(null);
      
      if (audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, volume));
        audioRef.current.muted = isMuted;
      }
    } catch (error) {
      console.error('Error initializing audio:', error);
      setError(`Failed to initialize audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [volume, isMuted, audioContext, disabled, analyser, source]);

  // CRITICAL FIX: Stabilize callback with refs to prevent dependency loops
  const streamRef = useRef<MediaStream | undefined>(stream);
  const initializeLiveStream = useCallback(async () => {
    const currentStream = streamRef.current;
    if (!currentStream || disabled) return;
    
    // If we already have an audio context for this stream, don't create a new one
    if (audioContext && source && source instanceof MediaStreamAudioSourceNode) {
      console.log('WaveformAnalyzer: Audio context already initialized for stream');
      return;
    }
    
    // Check if canvas is visible and has valid dimensions
    if (canvasRef.current) {
      const { width, height } = canvasRef.current.getBoundingClientRect();
      if (width === 0 || height === 0) {
        console.warn('WaveformAnalyzer: Canvas has zero dimensions, cannot draw');
        setError('Canvas not visible - cannot render waveform');
        return;
      }
    }

    try {
      console.log('WaveformAnalyzer: Initializing live stream...');
      console.log('Stream tracks:', currentStream?.getTracks().map(t => ({ 
        kind: t.kind, 
        enabled: t.enabled, 
        readyState: t.readyState,
        label: t.label,
        id: t.id,
        muted: t.muted
      })));
      
      // Verificar que el stream tenga audio tracks activos
      const audioTracks = currentStream?.getAudioTracks() || [];
      if (audioTracks.length === 0) {
        console.error('WaveformAnalyzer: No audio tracks found in stream!');
        setError('No audio tracks found in stream');
        return;
      }
      
      const activeTrack = audioTracks.find(t => t.enabled && t.readyState === 'live');
      if (!activeTrack) {
        console.error('WaveformAnalyzer: No active audio tracks found!');
        setError('No active audio tracks found');
        return;
      }
      
      console.log('WaveformAnalyzer: Active audio track found:', {
        label: activeTrack.label,
        enabled: activeTrack.enabled,
        readyState: activeTrack.readyState
      });
      
      // Clean up previous context if it exists
      if (audioContext && audioContext.state !== 'closed') {
        console.log('Closing previous AudioContext...');
        await audioContext.close();
      }
      
      const ctx = new AudioContext();
      console.log('AudioContext state:', ctx.state);
      
      // Resume AudioContext if suspended
      if (ctx.state === 'suspended') {
        console.log('AudioContext suspended, resuming...');
        try {
          await ctx.resume();
          console.log('AudioContext resumed, new state:', ctx.state);
        } catch (resumeError) {
          console.error('Failed to resume AudioContext:', resumeError);
          setError('Audio playback blocked by browser - click to enable');
          await ctx.close();
          return;
        }
      }
      
      const analyserNode = ctx.createAnalyser();
      analyserNode.fftSize = 2048;
      analyserNode.smoothingTimeConstant = 0.8;
      analyserNode.minDecibels = -90;
      analyserNode.maxDecibels = -10;

      const sourceNode = ctx.createMediaStreamSource(currentStream);
      sourceNode.connect(analyserNode);
      
      setAudioContext(ctx);
      setAnalyser(analyserNode);
      setSource(sourceNode);
      setError(null);
      
      console.log('WaveformAnalyzer: Live stream initialized successfully');
      console.log('🎯 Calling drawLiveWaveform with analyser:', analyserNode);
      drawLiveWaveform(analyserNode);
    } catch (error) {
      console.error('Error initializing live stream:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        setError(`Failed to initialize live stream: ${error.message}`);
      } else {
        setError('Failed to initialize live stream');
      }
    }
  }, [audioContext, disabled, drawLiveWaveform, source, analyser]); // REMOVED stream dependency
  
  // Update stream ref when stream changes
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // CRITICAL FIX: Stable effect for stream initialization - prevent mount/unmount cycles
  useEffect(() => {
    if (stream && isActive && !isPaused && !disabled) {
      console.log('🎤 WaveformAnalyzer: Stream active, initializing live stream...');
      initializeLiveStream();
      // Start drawing animation for live stream
      drawLiveWaveform();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
    };
  }, [stream, isActive, isPaused, disabled, drawLiveWaveform]); // Added drawLiveWaveform dependency

  // CRITICAL FIX: Single cleanup effect on unmount only
  useEffect(() => {
    return () => {
      console.log('🧹 WaveformAnalyzer: Component unmounting, cleaning up...');
      cleanup();
    };
  }, []); // EMPTY dependency array - only run on mount/unmount

  // Initialize audio URL when hideControls is true and handle external playback
  useEffect(() => {
    if (audioUrl && hideControls && audioRef.current && !disabled && !audioContext) {
      const timer = setTimeout(() => {
        initializeAudio();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [audioUrl, hideControls, disabled, audioContext, initializeAudio]);
  
  // Handle playback state changes
  useEffect(() => {
    if (hideControls && audioRef.current && !disabled && !disablePlayback) {
      audioRef.current.muted = isMuted;
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
      
      if (!isPaused) {
        audioRef.current.play().catch((err) => {
          console.error('Audio play failed:', err);
          if (err.name === 'NotAllowedError') {
            setError('Audio playback blocked - user interaction required');
          } else {
            setError(`Failed to play audio: ${err.message}`);
          }
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPaused, hideControls, isMuted, volume, disabled, disablePlayback]);

  // Event handlers
  const handlePlay = useCallback(async () => {
    if (!audioRef.current || disabled || disablePlayback) return;

    if (!audioContext) {
      await initializeAudio();
    }

    try {
      if (isPlaying) {
        audioRef.current.pause();
        handlePlayStateChange(false);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      } else {
        await audioRef.current.play();
        handlePlayStateChange(true);
        draw();
      }
    } catch (err) {
      console.error('Playback error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Audio playback blocked - click play to enable');
        } else {
          setError(`Playback failed: ${err.message}`);
        }
      } else {
        setError('Playback failed');
      }
    }
  }, [audioContext, isPlaying, initializeAudio, handlePlayStateChange, draw, disabled, disablePlayback]);

  // Handle drawing when component is ready
  useEffect(() => {
    if (!stream && !disabled && audioUrl && canvasRef.current) {
      // For audio URLs, always try to draw (static or animated)
      draw();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
    };
  }, [analyser, stream, disabled, audioUrl, draw]);

  // REMOVED: Duplicate cleanup effect that was causing mount/unmount cycles

  // CRITICAL FIX: Stream change cleanup with ref pattern
  const prevStreamRef = useRef<MediaStream | undefined>(stream);
  useEffect(() => {
    const prevStream = prevStreamRef.current;
    if (prevStream && prevStream !== stream) {
      console.log('🧹 WaveformAnalyzer: Stream changed, cleaning up previous stream...');
      // Only cleanup when stream actually changes, not on every render
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = 0;
      }
    }
    prevStreamRef.current = stream;
  }, [stream]); // REMOVED cleanup dependency

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePlay();
    }
  }, [handlePlay, disabled]);

  // Error display
  if (error) {
    return (
      <div className={`waveform-analyzer error ${className}`} role="alert">
        <div style={{ color: 'var(--error-main, #ef4444)', textAlign: 'center', padding: '20px' }}>
          ⚠️ {error}
        </div>
      </div>
    );
  }

  // Live stream visualization
  if (stream) {
    return (
      <div 
        className={`waveform-analyzer ${className}`}
        role="img"
        aria-label={ariaLabel || `Live audio waveform visualization${label ? ` for ${label}` : ''}`}
      >
        {label && <h4 style={{ color, margin: '0 0 10px 0' }}>{label}</h4>}
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height} 
          style={canvasStyle}
          aria-hidden="true"
        />
        {disabled && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(10, 11, 14, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            Disabled
          </div>
        )}
      </div>
    );
  }

  // Audio file visualization
  if (audioUrl) {
    return (
      <div className={`waveform-analyzer ${className}`}>
        {label && <h4 style={{ color, margin: '0 0 10px 0' }}>{label}</h4>}
        <canvas 
          ref={canvasRef} 
          width={300} 
          height={150} 
          style={canvasStyle}
          role="img"
          aria-label={ariaLabel || `Audio waveform for ${label || 'audio file'}`}
        />
        {!hideControls && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
            <button 
              onClick={handlePlay} 
              onKeyDown={handleKeyDown}
              disabled={disabled}
              style={{
                padding: '8px 16px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: disabled ? 'var(--dark-surface, #1F2028)' : 'var(--grass-glow, #52A32F)',
                color: 'var(--dark-text-primary, #CACBDA)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1
              }}
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
          </div>
        )}
        <audio 
          ref={audioRef} 
          src={audioUrl}
          onEnded={() => handlePlayStateChange(false)}
          style={{ display: 'none' }}
          preload="metadata"
          crossOrigin="anonymous"
        />
      </div>
    );
  }

  return null;
}