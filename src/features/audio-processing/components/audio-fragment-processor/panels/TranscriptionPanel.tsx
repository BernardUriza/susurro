import React, { useRef, useEffect, useState } from 'react';
import styles from '../audio-fragment-processor.module.css';

// interface TranscriptionEntry {
//   id: string;
//   timestamp: number;
//   text: string;
//   vadScore: number;
//   chunkId: string;
// }

interface TranscriptionPanelProps {
  transcriptions: string[];
  isRecording: boolean;
  filter?: string;
  onFilterChange?: (filter: string) => void;
  onExport?: () => void;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  transcriptions,
  isRecording,
  filter = '',
  onFilterChange,
  onExport,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filteredTranscriptions, setFilteredTranscriptions] = useState<string[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Filter transcriptions
  useEffect(() => {
    if (filter) {
      const filtered = transcriptions.filter(t => 
        t.toLowerCase().includes(filter.toLowerCase())
      );
      setFilteredTranscriptions(filtered);
    } else {
      setFilteredTranscriptions(transcriptions);
    }
  }, [transcriptions, filter]);

  // Auto-scroll to bottom when new transcriptions arrive
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filteredTranscriptions, autoScroll]);

  // Check if user has scrolled up
  const handleScroll = () => {
    if (listRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = listRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  // Parse transcription entry to extract metadata
  const parseTranscription = (entry: string) => {
    // Extract timestamp, VAD score, and text from the formatted string
    const timestampMatch = entry.match(/\[([\d:]+)\]/);
    const vadMatch = entry.match(/VAD:\s*([\d.]+)/);
    const textMatch = entry.match(/Transcription:\s*"([^"]+)"/);
    const isVoiceActive = entry.includes('🔊');

    return {
      timestamp: timestampMatch ? timestampMatch[1] : '',
      vadScore: vadMatch ? parseFloat(vadMatch[1]) : 0,
      text: textMatch ? textMatch[1] : entry,
      isVoiceActive,
      isSummary: entry.includes('RECORDING SUMMARY'),
    };
  };

  // Copy all transcriptions concatenated
  const copyAllTranscriptions = () => {
    const allText = transcriptions
      .filter(t => t.includes('📝 Transcription:'))
      .map(t => {
        const match = t.match(/📝 Transcription:\s*"([^"]+)"/);
        return match ? match[1] : '';
      })
      .filter(text => text.length > 0)
      .join(' ');
    
    if (allText.length === 0) {
      return;
    }
    
    navigator.clipboard.writeText(allText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }).catch(() => {
      // Fallback for browsers without clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = allText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  // Get transcription statistics
  const getStats = () => {
    const transcribedEntries = transcriptions.filter(t => t.includes('📝 Transcription:'));
    const totalChars = transcribedEntries.reduce((acc, t) => {
      const match = t.match(/📝 Transcription:\s*"([^"]+)"/);
      return acc + (match ? match[1].length : 0);
    }, 0);
    
    return {
      count: transcribedEntries.length,
      totalChars,
      avgCharsPerEntry: transcribedEntries.length > 0 ? Math.round(totalChars / transcribedEntries.length) : 0
    };
  };

  return (
    <div className={`${styles.panel} ${styles.transcriptionPanel}`}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>
          📝 Transcriptions {isRecording && <span className={styles.recordingIndicator}>● LIVE</span>}
        </h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {!autoScroll && (
            <button
              onClick={() => setAutoScroll(true)}
              className={styles.secondaryButton}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
            >
              ↓ Auto-scroll
            </button>
          )}
          {onExport && (
            <button 
              onClick={onExport}
              className={styles.secondaryButton}
              style={{ padding: '4px 8px', fontSize: '0.8rem' }}
              disabled={transcriptions.length === 0}
            >
              Export
            </button>
          )}
        </div>
      </div>

      <div className={styles.searchBar}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="🔍 Search transcriptions..."
          value={filter}
          onChange={(e) => onFilterChange?.(e.target.value)}
        />
        {filter && (
          <button 
            onClick={() => onFilterChange?.('')}
            className={styles.secondaryButton}
            style={{ padding: '0 12px' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Copy and Stats Bar */}
      {transcriptions.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: '10px', 
          alignItems: 'center',
          marginBottom: '10px',
          padding: '8px',
          background: 'rgba(0, 255, 65, 0.05)',
          border: '1px solid rgba(0, 255, 65, 0.3)',
          borderRadius: '4px'
        }}>
          <button
            onClick={copyAllTranscriptions}
            className={styles.primaryButton}
            style={{
              padding: '6px 12px',
              fontSize: '0.9rem',
              background: copySuccess ? '#00cc33' : '#00ff41',
            }}
          >
            {copySuccess ? '✅ COPIED!' : '📋 COPY TEXT'}
          </button>
          
          <div style={{ 
            color: '#00ff41', 
            fontSize: '0.85rem',
            marginLeft: 'auto',
            opacity: 0.8
          }}>
            {(() => {
              const stats = getStats();
              return `📊 ${stats.count} entries • ${stats.totalChars} chars • ~${stats.avgCharsPerEntry} avg`;
            })()}
          </div>
        </div>
      )}

      <div 
        ref={listRef}
        className={styles.transcriptionList}
        onScroll={handleScroll}
      >
        {filteredTranscriptions.length === 0 ? (
          <div className={styles.loading}>
            {isRecording ? (
              <>
                <span className={styles.spinner}></span>
                Waiting for speech...
              </>
            ) : (
              'No transcriptions yet. Start recording to begin.'
            )}
          </div>
        ) : (
          filteredTranscriptions.map((entry, index) => {
            const parsed = parseTranscription(entry);
            const vadClass = parsed.vadScore > 0.5 
              ? styles.highVad 
              : parsed.vadScore > 0.2 
                ? '' 
                : styles.lowVad;

            if (parsed.isSummary) {
              return (
                <div key={index} style={{ 
                  padding: '15px', 
                  margin: '10px 0',
                  border: '2px solid #00ff41',
                  background: 'rgba(0, 255, 65, 0.1)'
                }}>
                  <pre style={{ 
                    color: '#00ff41', 
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit'
                  }}>
                    {entry}
                  </pre>
                </div>
              );
            }

            return (
              <div 
                key={index} 
                className={`${styles.transcriptionEntry} ${vadClass}`}
              >
                {parsed.timestamp && (
                  <div className={styles.transcriptionTimestamp}>
                    {parsed.timestamp}
                    {parsed.vadScore > 0 && (
                      <span className={styles.vadIndicator}>
                        VAD: {(parsed.vadScore * 100).toFixed(0)}%
                      </span>
                    )}
                    {parsed.isVoiceActive && ' 🔊'}
                  </div>
                )}
                <div className={styles.transcriptionText}>
                  {parsed.text}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};