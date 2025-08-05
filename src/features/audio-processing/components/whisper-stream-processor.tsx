'use client';

// React 19 streaming transcription processor
import React, { Suspense, useMemo, use } from 'react';
import { WhisperRevelation, WhisperFragment, AudioTimestamp } from '../../../shared/types';

interface WhisperStreamProcessorProps {
  audioFragments: WhisperFragment[];
  onRevelationStream?: (revelation: WhisperRevelation) => void;
}

export function WhisperStreamProcessor({
  audioFragments,
  onRevelationStream,
}: WhisperStreamProcessorProps) {
  // React 19 streaming with use() hook
  const streamingRevelations = use(
    useMemo(
      () => createStreamingTranscription(audioFragments, onRevelationStream),
      [audioFragments, onRevelationStream]
    )
  );

  return (
    <div className="whisper-stream-processor">
      <Suspense fallback={<WhisperStreamingSpinner />}>
        <StreamingRevelationDisplay revelations={streamingRevelations} />
      </Suspense>
    </div>
  );
}

// Create streaming transcription promise for React 19 use() hook
function createStreamingTranscription(
  fragments: WhisperFragment[],
  onRevelationStream?: (revelation: WhisperRevelation) => void
): Promise<WhisperRevelation[]> {
  return new Promise((resolve, reject) => {
    const revelations: WhisperRevelation[] = [];
    let processedCount = 0;

    if (fragments.length === 0) {
      resolve(revelations);
      return;
    }

    // Process fragments as a stream
    const processFragmentStream = async (fragment: WhisperFragment, index: number) => {
      try {
        // Simulate streaming transcription processing
        const revelation = await transcribeFragmentStreaming(index);

        // Stream individual revelations as they complete
        if (onRevelationStream) {
          onRevelationStream(revelation);
        }

        revelations[index] = revelation;
        processedCount++;

        // Resolve when all fragments are processed
        if (processedCount === fragments.length) {
          resolve(revelations);
        }
      } catch (error) {
        reject(error);
      }
    };

    // Start streaming processing for all fragments
    fragments.forEach(processFragmentStream);
  });
}

// Streaming transcription function with real-time updates
async function transcribeFragmentStreaming(
  index: number
): Promise<WhisperRevelation> {
  // Simulate streaming transcription with periodic updates
  return new Promise((resolve) => {
    let progress = 0;
    const chunkSize = 10; // Process in 10% chunks for streaming feel

    const streamingInterval = setInterval(() => {
      progress += chunkSize;

      // Emit streaming progress (could trigger UI updates)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('whisper-stream-progress', {
            detail: { fragmentIndex: index, progress },
          })
        );
      }

      if (progress >= 100) {
        clearInterval(streamingInterval);

        // Complete the transcription
        const revelation: WhisperRevelation = {
          decodedMessage: `[STREAMED_FRAGMENT_${index + 1}] Whisper revelation decoded in real-time`,
          audioFragments: [],
          fragmentIndex: index,
          revelationTime: Date.now() as AudioTimestamp,
          confidenceScore: 0.85 + Math.random() * 0.1,
          languageDetected: 'en',
          processingDuration: Math.random() * 2000 + 1000,
          semanticAnalysis: {
            sentiment: (Math.random() - 0.5) * 2,
            keywords: ['streaming', 'whisper', 'real-time'],
            topics: ['audio-processing', 'transcription'],
            entityMentions: [],
          },
        };

        resolve(revelation);
      }
    }, 100); // Update every 100ms for smooth streaming effect
  });
}

// Streaming revelations display component
function StreamingRevelationDisplay({ revelations }: { revelations: WhisperRevelation[] }) {
  return (
    <div className="streaming-revelation-display">
      <div className="stream-header">
        <h3>&gt; REAL_TIME_WHISPER_STREAM</h3>
        <div className="stream-indicator">
          <div className="pulse-dot" />
          <span>LIVE</span>
        </div>
      </div>

      <div className="revelations-stream">
        {revelations.map((revelation, index) => (
          <div
            key={index}
            className="streaming-revelation"
            style={{
              animationDelay: `${index * 0.2}s`,
              opacity: revelation ? 1 : 0.3,
            }}
          >
            <div className="revelation-header">
              <span className="fragment-id">FRAGMENT_{revelation.fragmentIndex + 1}</span>
              <span className="confidence-score">
                CONFIDENCE: {((revelation.confidenceScore ?? 0) * 100).toFixed(1)}%
              </span>
              <span className="processing-time">{revelation.processingDuration}ms</span>
            </div>

            <div className="revelation-content">{revelation.decodedMessage}</div>

            {revelation.semanticAnalysis && (
              <div className="semantic-analysis">
                <div className="sentiment">
                  SENTIMENT: {revelation.semanticAnalysis.sentiment > 0 ? 'POSITIVE' : 'NEGATIVE'}(
                  {(revelation.semanticAnalysis.sentiment * 100).toFixed(1)})
                </div>
                <div className="keywords">
                  KEYWORDS: {revelation.semanticAnalysis.keywords.join(', ')}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Loading spinner for streaming
function WhisperStreamingSpinner() {
  return (
    <div className="whisper-streaming-spinner">
      <div className="spinner-container">
        <div className="matrix-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <p>&gt; INITIALIZING_WHISPER_STREAM...</p>
        <div className="streaming-dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </div>
      </div>
    </div>
  );
}

// React 19 streaming hook for real-time updates
export function useWhisperStream(fragments: WhisperFragment[]) {
  const [streamingRevelations, setStreamingRevelations] = React.useState<WhisperRevelation[]>([]);
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamProgress, setStreamProgress] = React.useState(0);

  const startStreaming = React.useCallback(() => {
    if (fragments.length === 0) return;

    setIsStreaming(true);
    setStreamingRevelations([]);
    setStreamProgress(0);

    // Listen for streaming progress events
    const handleStreamProgress = (event: CustomEvent) => {
      const { fragmentIndex, progress } = event.detail;
      setStreamProgress(((fragmentIndex + progress / 100) / fragments.length) * 100);
    };

    window.addEventListener('whisper-stream-progress', handleStreamProgress as EventListener);

    // Start streaming transcription
    createStreamingTranscription(fragments, (revelation) => {
      setStreamingRevelations((prev) => {
        const updated = [...prev];
        updated[revelation.fragmentIndex] = revelation;
        return updated;
      });
    })
      .then(() => {
        setIsStreaming(false);
        setStreamProgress(100);
      })
      .finally(() => {
        window.removeEventListener(
          'whisper-stream-progress',
          handleStreamProgress as EventListener
        );
      });
  }, [fragments]);

  return {
    streamingRevelations,
    isStreaming,
    streamProgress,
    startStreaming,
  };
}

// CSS-in-JS styles for streaming components
const streamingStyles = `
.whisper-stream-processor {
  position: relative;
  background: rgba(0, 0, 0, 0.95);
  border: 2px solid #00ff41;
  padding: 20px;
  margin: 20px 0;
  font-family: 'Courier New', monospace;
  color: #00ff41;
}

.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid #00ff41;
  padding-bottom: 10px;
}

.stream-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #00ff41;
  border-radius: 50%;
  animation: pulse 1s infinite;
}

.streaming-revelation {
  margin: 15px 0;
  padding: 15px;
  background: rgba(0, 255, 65, 0.05);
  border-left: 3px solid #00ff41;
  animation: slideInFromRight 0.5s ease-out;
}

.revelation-header {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 10px;
}

.revelation-content {
  font-size: 14px;
  line-height: 1.5;
  margin: 10px 0;
}

.semantic-analysis {
  font-size: 11px;
  opacity: 0.7;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(0, 255, 65, 0.3);
}

@keyframes slideInFromRight {
  from {
    transform: translateX(50px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
`;

// Inject styles
if (typeof document !== 'undefined' && !document.getElementById('whisper-streaming-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'whisper-streaming-styles';
  styleSheet.textContent = streamingStyles;
  document.head.appendChild(styleSheet);
}
