'use client';

import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useSusurro } from '@susurro/core';
import type { CompleteAudioResult } from '@susurro/core';

export interface AudioComparisonToolProps {
  onBack: () => void;
}

// Comparison session interface
interface ComparisonSession {
  id: string;
  name: string;
  files: ComparisonFile[];
  created: number;
  comparisonMetrics?: ComparisonMetrics;
}

// Individual file in comparison
interface ComparisonFile {
  id: string;
  file: File;
  result?: CompleteAudioResult;
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

// Detailed comparison metrics
interface ComparisonMetrics {
  transcriptionSimilarity: number;
  vadCorrelation: number;
  durationDifference: number;
  processingTimeComparison: number[];
  qualityScores: number[];
  similarityMatrix: number[][];
  insights: string[];
}

export const ChatMessage: React.FC<AudioComparisonToolProps> = ({ onBack }) => {
  // 🚀 CONSOLIDATED SUSURRO - Audio comparison system
  const {
    // File processing
    processAndTranscribeFile,

    // Engine status
    isEngineInitialized,
    whisperReady,
    whisperProgress,
    initializeAudioEngine,
  } = useSusurro({
    chunkDurationMs: 3000,
    whisperConfig: {
      language: 'en',
    },
  });

  // Comparison state
  const [sessions, setSessions] = useState<ComparisonSession[]>([]);
  const [activeSession, setActiveSession] = useState<ComparisonSession | null>(null);
  const [status, setStatus] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 📊 COMPARISON ANALYSIS ALGORITHMS
  const calculateTranscriptionSimilarity = useCallback((transcriptions: string[]): number => {
    if (transcriptions.length < 2) return 0;

    // Simple word-based similarity (could be enhanced with advanced NLP)
    const [text1, text2] = transcriptions.slice(0, 2);
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter((word) => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return commonWords.length / totalWords;
  }, []);

  const calculateVADCorrelation = useCallback((vadScores: number[][]): number => {
    if (vadScores.length < 2 || vadScores[0].length === 0) return 0;

    // Pearson correlation coefficient
    const [scores1, scores2] = vadScores.slice(0, 2);
    const minLength = Math.min(scores1.length, scores2.length);

    if (minLength === 0) return 0;

    const mean1 = scores1.slice(0, minLength).reduce((a, b) => a + b, 0) / minLength;
    const mean2 = scores2.slice(0, minLength).reduce((a, b) => a + b, 0) / minLength;

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < minLength; i++) {
      const diff1 = scores1[i] - mean1;
      const diff2 = scores2[i] - mean2;
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denominator1 * denominator2);
    return denominator === 0 ? 0 : numerator / denominator;
  }, []);

  const generateComparisonInsights = useCallback((metrics: ComparisonMetrics): string[] => {
    const insights: string[] = [];

    if (metrics.transcriptionSimilarity > 0.8) {
      insights.push('🎯 High transcription similarity - likely same content');
    } else if (metrics.transcriptionSimilarity > 0.5) {
      insights.push('📝 Moderate transcription similarity - related content');
    } else {
      insights.push('🔀 Low transcription similarity - different content');
    }

    if (Math.abs(metrics.vadCorrelation) > 0.7) {
      insights.push('🎵 Strong voice activity correlation - similar speech patterns');
    } else if (Math.abs(metrics.vadCorrelation) > 0.3) {
      insights.push('📊 Moderate voice activity correlation');
    } else {
      insights.push('🌊 Low voice activity correlation - different speech patterns');
    }

    if (metrics.durationDifference < 2000) {
      insights.push('⏱️ Similar duration - comparable recordings');
    } else {
      insights.push('📏 Significant duration difference detected');
    }

    const avgProcessingTime =
      metrics.processingTimeComparison.reduce((a, b) => a + b, 0) /
      metrics.processingTimeComparison.length;
    if (avgProcessingTime < 1000) {
      insights.push('⚡ Fast processing - good audio quality');
    } else if (avgProcessingTime > 3000) {
      insights.push('🐌 Slower processing - possible quality issues');
    }

    return insights;
  }, []);

  // 🔬 COMPREHENSIVE COMPARISON ANALYSIS
  const analyzeComparison = useCallback(
    (files: ComparisonFile[]): ComparisonMetrics => {
      const completedFiles = files.filter((f) => f.result);

      if (completedFiles.length < 2) {
        return {
          transcriptionSimilarity: 0,
          vadCorrelation: 0,
          durationDifference: 0,
          processingTimeComparison: [],
          qualityScores: [],
          similarityMatrix: [],
          insights: ['Insufficient files for comparison'],
        };
      }

      const transcriptions = completedFiles.map((f) => f.result?.transcriptionText || '');
      const vadScores = completedFiles.map((f) => f.result?.vadAnalysis.vadScores || []);
      const durations = completedFiles.map((f) => f.result?.metadata.duration || 0);
      const processingTimes = completedFiles.map((f) => f.result?.processingTime || 0);
      const avgVadScores = completedFiles.map((f) => f.result?.vadAnalysis.averageVad || 0);

      const transcriptionSimilarity = calculateTranscriptionSimilarity(transcriptions);
      const vadCorrelation = calculateVADCorrelation(vadScores);
      const durationDifference = Math.abs(durations[0] - durations[1]) * 1000; // Convert to ms

      // Create similarity matrix for multiple files
      const similarityMatrix: number[][] = [];
      for (let i = 0; i < completedFiles.length; i++) {
        similarityMatrix[i] = [];
        for (let j = 0; j < completedFiles.length; j++) {
          if (i === j) {
            similarityMatrix[i][j] = 1.0;
          } else {
            // Simple similarity based on VAD correlation and transcription similarity
            const similarity = (Math.abs(vadCorrelation) + transcriptionSimilarity) / 2;
            similarityMatrix[i][j] = similarity;
          }
        }
      }

      const metrics: ComparisonMetrics = {
        transcriptionSimilarity,
        vadCorrelation,
        durationDifference,
        processingTimeComparison: processingTimes,
        qualityScores: avgVadScores,
        similarityMatrix,
        insights: [],
      };

      metrics.insights = generateComparisonInsights(metrics);

      return metrics;
    },
    [calculateTranscriptionSimilarity, calculateVADCorrelation, generateComparisonInsights]
  );

  // 📁 CREATE NEW COMPARISON SESSION
  const createNewSession = useCallback(() => {
    const session: ComparisonSession = {
      id: `session-${Date.now()}`,
      name: `Comparison ${sessions.length + 1}`,
      files: [],
      created: Date.now(),
    };

    setSessions((prev) => [session, ...prev]);
    setActiveSession(session);
    setStatus(`[NEW_SESSION_CREATED] ${session.name}`);
  }, [sessions.length]);

  // 📂 ADD FILES TO SESSION
  const handleFilesSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeSession) {
        setStatus('[ERROR] No active session. Create a session first.');
        return;
      }

      const files = event.target.files;
      if (!files) return;

      const newFiles: ComparisonFile[] = Array.from(files).map((file, index) => ({
        id: `file-${Date.now()}-${index}`,
        file,
        status: 'pending',
      }));

      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? { ...session, files: [...session.files, ...newFiles] }
            : session
        )
      );

      // Update active session
      setActiveSession((prev) => (prev ? { ...prev, files: [...prev.files, ...newFiles] } : null));
      setStatus(`[ADDED_${newFiles.length}_FILES] Ready for comparison`);
    },
    [activeSession]
  );

  // 🚀 PROCESS AND COMPARE
  const processComparison = useCallback(async () => {
    if (!activeSession || activeSession.files.length < 2) {
      setStatus('[ERROR] Need at least 2 files for comparison');
      return;
    }

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

    setIsProcessing(true);
    setStatus('[COMPARISON_PROCESSING_INITIATED]');

    let processedCount = 0;
    const totalFiles = activeSession.files.filter((f) => f.status === 'pending').length;

    // Process each file
    for (const file of activeSession.files) {
      if (file.status !== 'pending') continue;

      try {
        // Update status
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  files: session.files.map((f) =>
                    f.id === file.id ? { ...f, status: 'processing' } : f
                  ),
                }
              : session
          )
        );

        setStatus(`[PROCESSING] ${file.file.name} (${processedCount + 1}/${totalFiles})`);

        // Process with Susurro
        const result = await processAndTranscribeFile(file.file);

        // Update with success
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  files: session.files.map((f) =>
                    f.id === file.id ? { ...f, status: 'completed', result } : f
                  ),
                }
              : session
          )
        );

        processedCount++;
      } catch (error) {
        // Update with error
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSession.id
              ? {
                  ...session,
                  files: session.files.map((f) =>
                    f.id === file.id
                      ? {
                          ...f,
                          status: 'error',
                          error: error instanceof Error ? error.message : 'Processing failed',
                        }
                      : f
                  ),
                }
              : session
          )
        );
      }
    }

    // Perform comparison analysis
    const updatedSession = sessions.find((s) => s.id === activeSession.id);
    if (updatedSession) {
      const comparisonMetrics = analyzeComparison(updatedSession.files);

      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id ? { ...session, comparisonMetrics } : session
        )
      );

      setActiveSession((prev) => (prev ? { ...prev, comparisonMetrics } : null));
    }

    setIsProcessing(false);
    setStatus(`[COMPARISON_COMPLETE] Analysis ready`);
  }, [
    activeSession,
    sessions,
    isEngineInitialized,
    whisperReady,
    initializeAudioEngine,
    processAndTranscribeFile,
    analyzeComparison,
  ]);

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
          maxWidth: '1400px',
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
          &gt; SUSURRO_AUDIO_COMPARATOR &lt;
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
                : 'rgba(0, 255, 65, 0.1)',
              border: `1px solid ${status.includes('ERROR') ? '#ff0041' : '#00ff41'}`,
              textAlign: 'center',
            }}
          >
            &gt; {status}
          </motion.div>
        )}

        {/* Session Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            flexWrap: 'wrap',
            gap: '15px',
          }}
        >
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <button
              onClick={createNewSession}
              className="matrix-button"
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: 'rgba(0, 255, 65, 0.1)',
                border: '2px solid #00ff41',
                color: '#00ff41',
              }}
            >
              🆕 [NEW_COMPARISON]
            </button>

            <select
              value={activeSession?.id || ''}
              onChange={(e) => {
                const session = sessions.find((s) => s.id === e.target.value);
                setActiveSession(session || null);
              }}
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                padding: '8px 12px',
              }}
            >
              <option value="">Select Session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} ({session.files.length} files)
                </option>
              ))}
            </select>
          </div>

          {activeSession && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="matrix-button"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  background: 'rgba(255, 255, 0, 0.1)',
                  border: '1px solid #ffff00',
                  color: '#ffff00',
                }}
              >
                📁 [ADD_FILES]
              </button>

              <button
                onClick={processComparison}
                disabled={
                  isProcessing || !activeSession || activeSession.files.length < 2 || !whisperReady
                }
                className="matrix-button"
                style={{
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  background: isProcessing ? 'rgba(255, 255, 0, 0.2)' : 'rgba(0, 100, 255, 0.1)',
                  borderColor: isProcessing ? '#ffff00' : '#0064ff',
                  color: isProcessing ? '#ffff00' : '#0064ff',
                  opacity:
                    !whisperReady || !activeSession || activeSession.files.length < 2 ? 0.5 : 1,
                }}
              >
                {isProcessing ? '⚡ [COMPARING...]' : '🔬 [START_COMPARISON]'}
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*"
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
        />

        {!whisperReady && (
          <div style={{ marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
            [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
          </div>
        )}

        {/* Active Session Display */}
        {activeSession && (
          <div
            style={{
              background: 'rgba(0, 255, 65, 0.05)',
              border: '1px solid #00ff41',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>📊 ACTIVE_SESSION: {activeSession.name}</h3>

            {/* Files in Session */}
            {activeSession.files.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px', color: '#ffff00' }}>FILES IN COMPARISON:</h4>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {activeSession.files.map((file) => (
                    <div
                      key={file.id}
                      style={{
                        background: 'rgba(0, 255, 65, 0.05)',
                        border: `1px solid ${
                          file.status === 'completed'
                            ? '#00ff41'
                            : file.status === 'error'
                              ? '#ff0041'
                              : file.status === 'processing'
                                ? '#ffff00'
                                : 'rgba(0, 255, 65, 0.3)'
                        }`,
                        padding: '12px',
                        fontSize: '0.9rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontWeight: 'bold' }}>
                          [{file.status.toUpperCase()}] {file.file.name}
                        </span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                          {(file.file.size / 1024).toFixed(1)}KB
                        </span>
                      </div>

                      {file.result && (
                        <div style={{ marginTop: '8px', fontSize: '0.8rem', opacity: 0.8 }}>
                          Duration: {file.result.metadata.duration.toFixed(1)}s | VAD:{' '}
                          {(file.result.vadAnalysis.averageVad * 100).toFixed(1)}% | Processing:{' '}
                          {file.result.processingTime.toFixed(0)}ms
                        </div>
                      )}

                      {file.error && (
                        <div style={{ marginTop: '8px', color: '#ff0041', fontSize: '0.8rem' }}>
                          Error: {file.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comparison Results */}
            {activeSession.comparisonMetrics && (
              <div
                style={{
                  background: 'rgba(0, 100, 255, 0.05)',
                  border: '1px solid #0064ff',
                  padding: '20px',
                  marginTop: '20px',
                }}
              >
                <h4 style={{ marginBottom: '15px', color: '#0064ff' }}>🔬 COMPARISON_ANALYSIS</h4>

                {/* Metrics Dashboard */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '15px',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(0, 255, 65, 0.05)',
                      border: '1px solid #00ff41',
                      padding: '15px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>TRANSCRIPTION SIMILARITY</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                      {(activeSession.comparisonMetrics.transcriptionSimilarity * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 255, 0, 0.05)',
                      border: '1px solid #ffff00',
                      padding: '15px',
                      textAlign: 'center',
                      color: '#ffff00',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>VAD CORRELATION</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                      {(activeSession.comparisonMetrics.vadCorrelation * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'rgba(255, 0, 255, 0.05)',
                      border: '1px solid #ff00ff',
                      padding: '15px',
                      textAlign: 'center',
                      color: '#ff00ff',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>DURATION DIFF</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                      {(activeSession.comparisonMetrics.durationDifference / 1000).toFixed(1)}s
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(0, 100, 255, 0.3)',
                    padding: '15px',
                  }}
                >
                  <h5 style={{ marginBottom: '10px', color: '#0064ff' }}>💡 AI_INSIGHTS:</h5>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {activeSession.comparisonMetrics.insights.map((insight, index) => (
                      <div key={index} style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
            &gt; AUDIO_COMPARISON_INSTRUCTIONS:
          </div>
          <div style={{ lineHeight: '1.6' }}>
            🆕 <strong>NEW SESSION:</strong> Create comparison sessions to organize your work
            <br />
            📁 <strong>ADD FILES:</strong> Upload 2+ audio files to compare content and quality
            <br />
            🔬 <strong>ANALYSIS:</strong> Get transcription similarity, VAD correlation, and AI
            insights
            <br />
            <br />
            <span style={{ color: '#ffff00' }}>
              Perfect for A/B testing recordings, quality comparisons, and content verification!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
