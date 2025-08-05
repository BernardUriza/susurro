'use client';

import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSusurro } from '@susurro/core';
import type { CompleteAudioResult } from '@susurro/core';

export interface BatchAudioProcessorProps {
  onBack: () => void;
}

// Batch processing job interface
interface BatchProcessingJob {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: CompleteAudioResult;
  progress: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export function WhisperStreamProcessor({ onBack }: BatchAudioProcessorProps) {
  // 🚀 CONSOLIDATED SUSURRO - Batch processing powerhouse
  const {
    // File processing - our main method
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

  // Batch processing state
  const [jobs, setJobs] = useState<BatchProcessingJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [processingStats, setProcessingStats] = useState({
    totalFiles: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    successRate: 0,
  });

  // 📁 ADD FILES TO BATCH
  const handleFilesSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      const newJobs: BatchProcessingJob[] = Array.from(files).map((file, index) => ({
        id: `job-${Date.now()}-${index}`,
        file,
        status: 'pending',
        progress: 0,
      }));

      setJobs((prev) => [...prev, ...newJobs]);
      setStatus(
        `[ADDED_${newJobs.length}_FILES] Total batch size: ${jobs.length + newJobs.length}`
      );
    },
    [jobs.length]
  );

  // 🚀 BATCH PROCESSING ENGINE
  const processBatch = useCallback(async () => {
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
    setStatus('[BATCH_PROCESSING_INITIATED]');
    setCompletedJobs(0);

    const startTime = Date.now();
    let completedCount = 0;
    let successCount = 0;

    // Process jobs in concurrent batches
    const processJob = async (job: BatchProcessingJob): Promise<void> => {
      try {
        // Update job status
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id ? { ...j, status: 'processing', startTime: Date.now() } : j
          )
        );

        // Process with useSusurro - ONE METHOD CALL
        const result = await processAndTranscribeFile(job.file);

        // Update with success
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: 'completed',
                  result,
                  progress: 100,
                  endTime: Date.now(),
                }
              : j
          )
        );

        successCount++;
        completedCount++;
        setCompletedJobs(completedCount);
      } catch (error) {
        // Update with error
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? {
                  ...j,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Processing failed',
                  endTime: Date.now(),
                }
              : j
          )
        );

        completedCount++;
        setCompletedJobs(completedCount);
      }
    };

    // Process in batches of maxConcurrent
    const pendingJobs = jobs.filter((job) => job.status === 'pending');

    for (let i = 0; i < pendingJobs.length; i += maxConcurrent) {
      const batch = pendingJobs.slice(i, i + maxConcurrent);
      setStatus(
        `[PROCESSING_BATCH_${Math.floor(i / maxConcurrent) + 1}] Jobs: ${batch.map((j) => j.file.name.substring(0, 15)).join(', ')}`
      );

      // Process batch concurrently
      await Promise.all(batch.map(processJob));

      // Brief pause between batches to prevent overwhelming
      if (i + maxConcurrent < pendingJobs.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Calculate final stats
    const totalTime = Date.now() - startTime;
    const completedJobsList = jobs.filter((j) => j.status === 'completed' || j.status === 'error');
    const avgTime =
      completedJobsList.length > 0
        ? completedJobsList.reduce(
            (acc, job) => acc + ((job.endTime || 0) - (job.startTime || 0)),
            0
          ) / completedJobsList.length
        : 0;

    setProcessingStats({
      totalFiles: pendingJobs.length,
      totalProcessingTime: totalTime,
      averageProcessingTime: avgTime,
      successRate: pendingJobs.length > 0 ? (successCount / pendingJobs.length) * 100 : 0,
    });

    setIsProcessing(false);
    setStatus(
      `[BATCH_COMPLETE] ${successCount}/${pendingJobs.length} successful (${((successCount / pendingJobs.length) * 100).toFixed(1)}%)`
    );
  }, [
    jobs,
    isEngineInitialized,
    whisperReady,
    initializeAudioEngine,
    processAndTranscribeFile,
    maxConcurrent,
  ]);

  // Clear all jobs
  const clearJobs = useCallback(() => {
    setJobs([]);
    setCompletedJobs(0);
    setProcessingStats({
      totalFiles: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      successRate: 0,
    });
    setStatus('[BATCH_CLEARED]');
  }, []);

  // Remove completed jobs
  const clearCompleted = useCallback(() => {
    setJobs((prev) =>
      prev.filter((job) => job.status === 'pending' || job.status === 'processing')
    );
    setStatus('[COMPLETED_JOBS_CLEARED]');
  }, []);

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
          &gt; SUSURRO_BATCH_PROCESSOR &lt;
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

        {/* Batch Stats Dashboard */}
        {(jobs.length > 0 || processingStats.totalFiles > 0) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px',
              marginBottom: '30px',
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
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>TOTAL FILES</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{jobs.length}</div>
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
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>COMPLETED</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{completedJobs}</div>
            </div>
            <div
              style={{
                background: 'rgba(0, 100, 255, 0.05)',
                border: '1px solid #0064ff',
                padding: '15px',
                textAlign: 'center',
                color: '#0064ff',
              }}
            >
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>SUCCESS RATE</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                {processingStats.successRate.toFixed(1)}%
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
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>AVG TIME</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>
                {(processingStats.averageProcessingTime / 1000).toFixed(1)}s
              </div>
            </div>
          </div>
        )}

        {/* File Upload Area */}
        <div
          style={{
            marginBottom: '30px',
            padding: '30px',
            border: '2px dashed #00ff41',
            textAlign: 'center',
            background: 'rgba(0, 255, 65, 0.05)',
            cursor: 'pointer',
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <h3 style={{ marginBottom: '15px' }}>&gt; BATCH_FILE_UPLOAD_ZONE</h3>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="audio/*"
            onChange={handleFilesSelected}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>
            Click to select multiple audio files for batch processing
            <br />
            Each file will be processed with: Murmuraba + Whisper + VAD Analysis
          </div>
        </div>

        {/* Concurrency Controls */}
        <div
          style={{
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '15px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.9rem' }}>CONCURRENT_JOBS:</span>
            <select
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(Number(e.target.value))}
              style={{
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                padding: '5px 10px',
              }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={processBatch}
              disabled={
                isProcessing ||
                jobs.filter((j) => j.status === 'pending').length === 0 ||
                !whisperReady
              }
              className="matrix-button"
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: isProcessing ? 'rgba(255, 255, 0, 0.2)' : 'rgba(0, 255, 65, 0.1)',
                borderColor: isProcessing ? '#ffff00' : '#00ff41',
                color: isProcessing ? '#ffff00' : '#00ff41',
                opacity:
                  !whisperReady || jobs.filter((j) => j.status === 'pending').length === 0
                    ? 0.5
                    : 1,
              }}
            >
              {isProcessing ? '⚡ [PROCESSING_BATCH...]' : '🚀 [START_BATCH_PROCESSING]'}
            </button>

            <button
              onClick={clearCompleted}
              disabled={
                jobs.filter((j) => j.status === 'completed' || j.status === 'error').length === 0
              }
              className="matrix-button"
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: 'rgba(255, 255, 0, 0.1)',
                border: '1px solid #ffff00',
                color: '#ffff00',
              }}
            >
              🧹 [CLEAR_COMPLETED]
            </button>

            <button
              onClick={clearJobs}
              className="matrix-button"
              style={{
                padding: '10px 20px',
                fontSize: '0.9rem',
                background: 'rgba(255, 0, 65, 0.1)',
                border: '1px solid #ff0041',
                color: '#ff0041',
              }}
            >
              🗑️ [CLEAR_ALL]
            </button>
          </div>
        </div>

        {!whisperReady && (
          <div style={{ marginBottom: '20px', textAlign: 'center', fontSize: '0.9rem' }}>
            [LOADING_WHISPER: {(whisperProgress * 100).toFixed(0)}%]
          </div>
        )}

        {/* Jobs List */}
        {jobs.length > 0 && (
          <div
            style={{
              background: 'rgba(0, 255, 65, 0.05)',
              border: '1px solid #00ff41',
              padding: '20px',
              maxHeight: '600px',
              overflow: 'auto',
            }}
          >
            <h3 style={{ marginBottom: '15px' }}>
              &gt; BATCH_PROCESSING_QUEUE ({jobs.length} files)
            </h3>
            <div style={{ display: 'grid', gap: '10px' }}>
              <AnimatePresence>
                {jobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    style={{
                      background: 'rgba(0, 255, 65, 0.05)',
                      border: `1px solid ${
                        job.status === 'completed'
                          ? '#00ff41'
                          : job.status === 'error'
                            ? '#ff0041'
                            : job.status === 'processing'
                              ? '#ffff00'
                              : 'rgba(0, 255, 65, 0.3)'
                      }`,
                      padding: '15px',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <span style={{ fontWeight: 'bold' }}>
                        [{job.status.toUpperCase()}] {job.file.name}
                      </span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                        {(job.file.size / 1024).toFixed(1)}KB
                      </span>
                    </div>

                    {job.status === 'processing' && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 0, 0.1)',
                          padding: '5px 10px',
                          marginBottom: '10px',
                          color: '#ffff00',
                        }}
                      >
                        ⚡ Processing with Susurro pipeline...
                      </div>
                    )}

                    {job.status === 'error' && job.error && (
                      <div
                        style={{
                          background: 'rgba(255, 0, 0, 0.1)',
                          padding: '5px 10px',
                          marginBottom: '10px',
                          color: '#ff0041',
                        }}
                      >
                        ❌ {job.error}
                      </div>
                    )}

                    {job.result && (
                      <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '10px',
                            marginBottom: '10px',
                          }}
                        >
                          <div>Processing: {job.result.processingTime.toFixed(0)}ms</div>
                          <div>VAD: {(job.result.vadAnalysis.averageVad * 100).toFixed(1)}%</div>
                          <div>Duration: {job.result.metadata.duration.toFixed(1)}s</div>
                        </div>
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.5)',
                            padding: '8px',
                            marginTop: '8px',
                            fontSize: '0.7rem',
                            maxHeight: '60px',
                            overflow: 'hidden',
                          }}
                        >
                          {job.result.transcriptionText}
                        </div>
                      </div>
                    )}
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
            &gt; SUSURRO_BATCH_PROCESSING_INSTRUCTIONS:
          </div>
          <div style={{ lineHeight: '1.6' }}>
            🎯 <strong>BATCH PROCESSING:</strong> Upload multiple audio files and process them
            concurrently
            <br />⚡ <strong>CONCURRENT JOBS:</strong> Control how many files process simultaneously
            (1-5)
            <br />
            📊 <strong>REAL-TIME STATS:</strong> Monitor success rates, processing times, and
            progress
            <br />
            <br />
            <span style={{ color: '#ffff00' }}>
              Each file gets the full Susurro treatment: Murmuraba processing + Whisper
              transcription + VAD analysis!
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
