'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSusurro } from '@susurro/core';
import type { StreamingSusurroChunk } from '@susurro/core';

export interface VoiceCommandInterfaceProps {
  onBack: () => void;
}

// Voice commands configuration
interface VoiceCommand {
  id: string;
  phrase: string;
  description: string;
  action: () => void;
  category: 'navigation' | 'system' | 'audio' | 'custom';
  cooldown?: number; // milliseconds
}

// Command execution result
interface CommandExecution {
  id: string;
  command: VoiceCommand;
  confidence: number;
  timestamp: number;
  success: boolean;
  executionTime: number;
  transcribedText: string;
}

export const StreamingText: React.FC<VoiceCommandInterfaceProps> = ({ onBack }) => {
  // 🚀 CONSOLIDATED SUSURRO - Voice command recognition system
  const {
    // Streaming recording for command detection
    startStreamingRecording,
    stopStreamingRecording,

    // Engine status
    isEngineInitialized,
    engineError,
    whisperReady,
    whisperProgress,
    initializeAudioEngine,
  } = useSusurro({
    chunkDurationMs: 1500, // Quick recognition for commands
    whisperConfig: {
      language: 'en',
    },
  });

  // Voice command state
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState('');
  const [currentTranscription, setCurrentTranscription] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandExecution[]>([]);
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [listeningMode, setListeningMode] = useState<'push-to-talk' | 'continuous'>('push-to-talk');
  const [commandCooldowns, setCommandCooldowns] = useState<Map<string, number>>(new Map());

  // System feedback
  const [systemResponse, setSystemResponse] = useState<{
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  } | null>(null);

  // Define available voice commands
  const [voiceCommands] = useState<VoiceCommand[]>([
    {
      id: 'start-recording',
      phrase: 'start recording',
      description: 'Begin audio recording',
      action: () => simulateSystemAction('Recording started'),
      category: 'audio',
    },
    {
      id: 'stop-recording',
      phrase: 'stop recording',
      description: 'Stop audio recording',
      action: () => simulateSystemAction('Recording stopped'),
      category: 'audio',
    },
    {
      id: 'open-visualizer',
      phrase: 'open visualizer',
      description: 'Launch audio visualizer',
      action: () => simulateSystemAction('Visualizer opened'),
      category: 'navigation',
    },
    {
      id: 'process-batch',
      phrase: 'process batch',
      description: 'Start batch processing',
      action: () => simulateSystemAction('Batch processing initiated'),
      category: 'audio',
    },
    {
      id: 'clear-history',
      phrase: 'clear history',
      description: 'Clear command history',
      action: () => {
        setCommandHistory([]);
        showSystemResponse('success', 'Command history cleared');
      },
      category: 'system',
    },
    {
      id: 'show-status',
      phrase: 'show status',
      description: 'Display system status',
      action: () => {
        const status = `Engine: ${isEngineInitialized ? 'Online' : 'Offline'} | Whisper: ${whisperReady ? 'Ready' : 'Loading'} | Commands: ${commandHistory.length}`;
        showSystemResponse('info', status);
      },
      category: 'system',
    },
    {
      id: 'switch-mode',
      phrase: 'switch mode',
      description: 'Toggle listening modes',
      action: () => {
        const newMode = listeningMode === 'push-to-talk' ? 'continuous' : 'push-to-talk';
        setListeningMode(newMode);
        showSystemResponse('info', `Switched to ${newMode} mode`);
      },
      category: 'system',
    },
    {
      id: 'help',
      phrase: 'help',
      description: 'Show available commands',
      action: () => showSystemResponse('info', `Available commands: ${voiceCommands.length}`),
      category: 'system',
    },
  ]);

  // System action simulation
  const simulateSystemAction = (action: string) => {
    showSystemResponse('success', `Action executed: ${action}`);
    // In a real implementation, this would trigger actual system functions
  };

  // Show system response with auto-dismiss
  const showSystemResponse = useCallback(
    (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
      setSystemResponse({ type, message, timestamp: Date.now() });
      setTimeout(() => setSystemResponse(null), 4000);
    },
    []
  );

  // Command matching algorithm with fuzzy matching
  const findMatchingCommand = useCallback(
    (transcription: string): { command: VoiceCommand; confidence: number } | null => {
      const text = transcription.toLowerCase().trim();

      for (const command of voiceCommands) {
        const phrase = command.phrase.toLowerCase();

        // Exact match
        if (text.includes(phrase)) {
          return { command, confidence: 1.0 };
        }

        // Fuzzy matching - check if most words match
        const textWords = text.split(' ');
        const phraseWords = phrase.split(' ');
        const matchingWords = phraseWords.filter((word) => textWords.includes(word));
        const confidence = matchingWords.length / phraseWords.length;

        // Require at least 70% word match
        if (confidence >= 0.7) {
          return { command, confidence };
        }
      }

      return null;
    },
    [voiceCommands]
  );

  // Execute voice command
  const executeCommand = useCallback(
    async (command: VoiceCommand, confidence: number, transcribedText: string) => {
      const startTime = Date.now();

      // Check cooldown
      const lastExecution = commandCooldowns.get(command.id);
      const cooldownPeriod = command.cooldown || 2000; // Default 2 second cooldown

      if (lastExecution && Date.now() - lastExecution < cooldownPeriod) {
        showSystemResponse('warning', `Command "${command.phrase}" is on cooldown`);
        return;
      }

      setIsProcessingCommand(true);
      let success = true;

      try {
        // Execute command action
        await command.action();

        // Update cooldown
        setCommandCooldowns((prev) => new Map(prev).set(command.id, Date.now()));
      } catch (error) {
        success = false;
        showSystemResponse('error', `Command execution failed: ${error}`);
      } finally {
        const executionTime = Date.now() - startTime;

        // Add to history
        const execution: CommandExecution = {
          id: `exec-${Date.now()}`,
          command,
          confidence,
          timestamp: Date.now(),
          success,
          executionTime,
          transcribedText,
        };

        setCommandHistory((prev) => [execution, ...prev.slice(0, 19)]); // Keep last 20
        setIsProcessingCommand(false);
      }
    },
    [commandCooldowns, showSystemResponse]
  );

  // 🎤 VOICE COMMAND LISTENING
  const startListening = useCallback(async () => {
    if (!isEngineInitialized || !whisperReady) {
      if (!isEngineInitialized) {
        try {
          await initializeAudioEngine();
        } catch (error) {
          setStatus(`[ERROR] Engine initialization failed: ${error}`);
          return;
        }
      }
      return;
    }

    setIsListening(true);
    setCurrentTranscription('');
    setStatus('[VOICE_COMMAND_ACTIVE] Listening for commands...');

    // Real-time command processing
    const onChunkProcessed = (chunk: StreamingSusurroChunk) => {
      if (chunk.isVoiceActive && chunk.transcriptionText.trim()) {
        const transcription = chunk.transcriptionText.trim();
        setCurrentTranscription(transcription);

        // Try to match command
        const match = findMatchingCommand(transcription);

        if (match && match.confidence >= 0.7) {
          setStatus(
            `[COMMAND_DETECTED] "${match.command.phrase}" (${(match.confidence * 100).toFixed(0)}%)`
          );

          // Execute command after a brief delay
          setTimeout(() => {
            executeCommand(match.command, match.confidence, transcription);
          }, 300);
        } else {
          setStatus(`[LISTENING] "${transcription}" (no match)`);
        }
      }
    };

    try {
      await startStreamingRecording(onChunkProcessed, {
        chunkDuration: 2, // Quick command recognition
        vadThreshold: 0.4, // Sensitive for quiet commands
        enableRealTimeTranscription: true,
        enableNoiseReduction: true,
      });
    } catch (error) {
      setIsListening(false);
      setStatus(`[ERROR] ${error}`);
    }
  }, [
    isEngineInitialized,
    whisperReady,
    initializeAudioEngine,
    startStreamingRecording,
    findMatchingCommand,
    executeCommand,
  ]);

  const stopListening = useCallback(async () => {
    await stopStreamingRecording();
    setIsListening(false);
    setCurrentTranscription('');
    setStatus('[VOICE_COMMAND_INACTIVE] Press and hold to activate');
  }, [stopStreamingRecording]);

  // Auto-initialize
  useEffect(() => {
    if (whisperReady && !isEngineInitialized && !engineError) {
      initializeAudioEngine().catch(() => {});
    }
  }, [whisperReady, isEngineInitialized, engineError, initializeAudioEngine]);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        color: '#00ff41',
        padding: '20px',
        background:
          'radial-gradient(ellipse at center, rgba(0, 20, 0, 0.9) 0%, rgba(0, 0, 0, 0.95) 100%)',
      }}
    >
      <button className="matrix-back-button" onClick={onBack}>
        [&lt; BACK_TO_MATRIX]
      </button>

      <div className="matrix-grid" />

      <div
        style={{
          maxWidth: '1200px',
          margin: '40px auto',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '2px solid #00ff41',
          padding: '30px',
          backdropFilter: 'blur(15px)',
          boxShadow: '0 0 40px rgba(0, 255, 65, 0.3)',
        }}
      >
        {/* Header */}
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            fontSize: '2.5rem',
            marginBottom: '20px',
            textAlign: 'center',
            textShadow: '0 0 20px #00ff41',
            background: 'linear-gradient(45deg, #00ff41, #00cc33)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          &gt; SUSURRO_VOICE_COMMANDER &lt;
        </motion.h1>

        {/* Status */}
        {status && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`matrix-status ${status.includes('ERROR') ? 'error' : ''}`}
            style={{
              marginBottom: '20px',
              padding: '12px',
              background: status.includes('ERROR')
                ? 'rgba(255, 0, 0, 0.1)'
                : isListening
                  ? 'rgba(255, 255, 0, 0.1)'
                  : 'rgba(0, 255, 65, 0.1)',
              border: `1px solid ${status.includes('ERROR') ? '#ff0041' : isListening ? '#ffff00' : '#00ff41'}`,
              textAlign: 'center',
            }}
          >
            &gt; {status}
          </motion.div>
        )}

        {/* System Response */}
        <AnimatePresence>
          {systemResponse && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                marginBottom: '20px',
                padding: '12px',
                background: `rgba(${
                  systemResponse.type === 'success'
                    ? '0, 255, 65'
                    : systemResponse.type === 'error'
                      ? '255, 0, 65'
                      : systemResponse.type === 'warning'
                        ? '255, 255, 0'
                        : '0, 100, 255'
                }, 0.1)`,
                border: `1px solid ${
                  systemResponse.type === 'success'
                    ? '#00ff41'
                    : systemResponse.type === 'error'
                      ? '#ff0041'
                      : systemResponse.type === 'warning'
                        ? '#ffff00'
                        : '#0064ff'
                }`,
                textAlign: 'center',
                color:
                  systemResponse.type === 'success'
                    ? '#00ff41'
                    : systemResponse.type === 'error'
                      ? '#ff0041'
                      : systemResponse.type === 'warning'
                        ? '#ffff00'
                        : '#0064ff',
              }}
            >
              📢 {systemResponse.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Control Panel */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginBottom: '30px',
          }}
        >
          {/* Voice Control */}
          <div
            style={{
              background: 'rgba(0, 255, 65, 0.05)',
              border: '1px solid #00ff41',
              padding: '20px',
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>🎤 VOICE_CONTROL</h3>

            <div style={{ marginBottom: '15px' }}>
              <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>MODE: </span>
              <select
                value={listeningMode}
                onChange={(e) => setListeningMode(e.target.value as 'push-to-talk' | 'continuous')}
                style={{
                  background: 'rgba(0, 0, 0, 0.8)',
                  border: '1px solid #00ff41',
                  color: '#00ff41',
                  padding: '5px 10px',
                  marginLeft: '10px',
                }}
              >
                <option value="push-to-talk">Push-to-Talk</option>
                <option value="continuous">Continuous</option>
              </select>
            </div>

            <button
              onMouseDown={listeningMode === 'push-to-talk' ? startListening : undefined}
              onMouseUp={listeningMode === 'push-to-talk' ? stopListening : undefined}
              onClick={
                listeningMode === 'continuous'
                  ? isListening
                    ? stopListening
                    : startListening
                  : undefined
              }
              disabled={!whisperReady || isProcessingCommand}
              className="matrix-button"
              style={{
                width: '100%',
                padding: '15px',
                fontSize: '1rem',
                background: isListening ? 'rgba(255, 255, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                borderColor: isListening ? '#ffff00' : '#00ff41',
                color: isListening ? '#ffff00' : '#00ff41',
                opacity: !whisperReady ? 0.5 : 1,
                marginBottom: '15px',
              }}
            >
              {isListening ? '🔴 [LISTENING...]' : '🎤 [ACTIVATE_VOICE_COMMANDS]'}
            </button>

            {!whisperReady && (
              <div style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.7 }}>
                [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
              </div>
            )}
          </div>

          {/* Current Transcription */}
          <div
            style={{
              background: 'rgba(255, 255, 0, 0.05)',
              border: '1px solid #ffff00',
              padding: '20px',
              color: '#ffff00',
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>📝 LIVE_TRANSCRIPTION</h3>
            <div
              style={{
                minHeight: '60px',
                background: 'rgba(0, 0, 0, 0.5)',
                padding: '15px',
                fontSize: '1rem',
                fontFamily: 'monospace',
                border: '1px solid rgba(255, 255, 0, 0.3)',
              }}
            >
              {currentTranscription ||
                (isListening ? '[LISTENING...]' : '[VOICE_COMMANDS_INACTIVE]')}
              {isListening && (
                <span
                  style={{
                    opacity: 0.7,
                    animation: 'blink 1s infinite',
                    marginLeft: '5px',
                  }}
                >
                  █
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Available Commands */}
        <div
          style={{
            background: 'rgba(0, 100, 255, 0.05)',
            border: '1px solid #0064ff',
            padding: '20px',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ marginBottom: '15px', color: '#0064ff' }}>⚡ AVAILABLE_COMMANDS</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '10px',
            }}
          >
            {voiceCommands.map((command) => (
              <div
                key={command.id}
                style={{
                  background: 'rgba(0, 100, 255, 0.05)',
                  border: '1px solid rgba(0, 100, 255, 0.3)',
                  padding: '12px',
                  fontSize: '0.9rem',
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#0064ff', marginBottom: '5px' }}>
                  &quot;{command.phrase}&quot;
                </div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>{command.description}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.6, marginTop: '5px' }}>
                  [{command.category.toUpperCase()}]
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Command History */}
        {commandHistory.length > 0 && (
          <div
            style={{
              background: 'rgba(0, 255, 65, 0.05)',
              border: '1px solid #00ff41',
              padding: '20px',
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>📋 COMMAND_HISTORY ({commandHistory.length})</h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              <AnimatePresence>
                {commandHistory.map((execution) => (
                  <motion.div
                    key={execution.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    style={{
                      background: 'rgba(0, 255, 65, 0.05)',
                      border: `1px solid ${execution.success ? '#00ff41' : '#ff0041'}`,
                      padding: '12px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 'bold',
                          color: execution.success ? '#00ff41' : '#ff0041',
                        }}
                      >
                        {execution.success ? '✅' : '❌'} &quot;{execution.command.phrase}&quot;
                      </span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        {new Date(execution.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '5px' }}>
                      Transcribed: &quot;{execution.transcribedText}&quot;
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                      Confidence: {(execution.confidence * 100).toFixed(1)}% | Execution:{' '}
                      {execution.executionTime}ms
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div
          style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(0, 255, 65, 0.05)',
            fontSize: '0.9rem',
            opacity: 0.8,
            border: '1px solid rgba(0, 255, 65, 0.3)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
            &gt; VOICE_COMMAND_INSTRUCTIONS:
          </div>
          <div style={{ lineHeight: '1.6' }}>
            🎯 <strong>PUSH-TO-TALK:</strong> Hold the voice button and speak commands
            <br />
            🔄 <strong>CONTINUOUS:</strong> Click to toggle continuous listening mode
            <br />
            🎯 <strong>FUZZY MATCHING:</strong> Commands work with partial matches (70%+ word
            accuracy)
            <br />
            <br />
            <span style={{ color: '#ffff00' }}>
              Powered by the consolidated useSusurro hook with real-time voice recognition!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
