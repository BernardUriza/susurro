import React from 'react';
import styles from '../audio-fragment-processor.module.css';

interface SettingsPanelProps {
  isCollapsed: boolean;
  onToggle: (collapsed: boolean) => void;
  chunkDuration: number;
  onChunkDurationChange: (duration: number) => void;
  isRecording: boolean;
  vadThreshold?: number;
  onVadThresholdChange?: (threshold: number) => void;
  noiseReduction?: boolean;
  onNoiseReductionChange?: (enabled: boolean) => void;
  whisperModel?: string;
  onWhisperModelChange?: (model: string) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isCollapsed,
  onToggle,
  chunkDuration,
  onChunkDurationChange,
  isRecording,
  vadThreshold = 0.2,
  onVadThresholdChange,
  noiseReduction = true,
  onNoiseReductionChange,
  whisperModel = 'base',
  onWhisperModelChange,
}) => {
  return (
    <div className={`${styles.panel} ${styles.settingsPanel} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>⚙️ Settings</h3>
        <button
          onClick={() => onToggle(!isCollapsed)}
          className={styles.toggleButton}
        >
          {isCollapsed ? '▶ Expand' : '▼ Collapse'}
        </button>
      </div>

      {!isCollapsed && (
        <div className={styles.settingsContent}>
          {/* Chunk Duration */}
          <div className={styles.settingRow}>
            <label className={styles.settingLabel}>
              <span>📏 Chunk Duration (seconds)</span>
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="number"
                min="1"
                max="60"
                value={chunkDuration}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 8;
                  const clampedValue = Math.min(60, Math.max(1, value));
                  onChunkDurationChange(clampedValue);
                }}
                disabled={isRecording}
                className={styles.settingInput}
              />
              <span style={{ color: '#888', fontSize: '0.8rem' }}>
                {chunkDuration}s
              </span>
              {chunkDuration !== 8 && (
                <button
                  onClick={() => onChunkDurationChange(8)}
                  disabled={isRecording}
                  className={styles.secondaryButton}
                  style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                >
                  Reset
                </button>
              )}
            </div>
            <div className={styles.helpText}>
              Shorter chunks (3-8s) for real-time, longer (15-30s) for complete sentences
            </div>
          </div>

          {/* VAD Threshold */}
          {onVadThresholdChange && (
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>
                <span>🎚️ VAD Threshold</span>
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={vadThreshold}
                  onChange={(e) => onVadThresholdChange(parseFloat(e.target.value))}
                  disabled={isRecording}
                  className={styles.settingInput}
                  style={{ flex: 1 }}
                />
                <span style={{ color: '#00ff41', minWidth: '40px' }}>
                  {(vadThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <div className={styles.helpText}>
                Lower = more sensitive, Higher = less background noise
              </div>
            </div>
          )}

          {/* Noise Reduction */}
          {onNoiseReductionChange && (
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>
                <input
                  type="checkbox"
                  checked={noiseReduction}
                  onChange={(e) => onNoiseReductionChange(e.target.checked)}
                  disabled={isRecording}
                  style={{ marginRight: '10px' }}
                />
                <span>🔇 Noise Reduction</span>
              </label>
              <div className={styles.helpText}>
                Reduces background noise in recordings
              </div>
            </div>
          )}

          {/* Whisper Model Selection */}
          {onWhisperModelChange && (
            <div className={styles.settingRow}>
              <label className={styles.settingLabel}>
                <span>🤖 Whisper Model</span>
              </label>
              <select
                value={whisperModel}
                onChange={(e) => onWhisperModelChange(e.target.value)}
                disabled={isRecording}
                className={styles.settingInput}
                style={{ width: '100%' }}
              >
                <option value="tiny">Tiny (39M) - Fastest</option>
                <option value="base">Base (74M) - Balanced</option>
                <option value="small">Small (244M) - Better</option>
                <option value="medium">Medium (769M) - Good</option>
                <option value="large">Large (1550M) - Best</option>
              </select>
              <div className={styles.helpText}>
                Larger models are more accurate but slower
              </div>
            </div>
          )}

          {/* Export Settings */}
          <div className={styles.settingRow}>
            <h4 style={{ margin: '10px 0', color: '#00ff41' }}>Export Options</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                className={styles.secondaryButton}
                onClick={() => {
                  // Export transcriptions as text
                  console.log('Export as TXT');
                }}
              >
                📄 Export as TXT
              </button>
              <button 
                className={styles.secondaryButton}
                onClick={() => {
                  // Export transcriptions as JSON
                  console.log('Export as JSON');
                }}
              >
                📋 Export as JSON
              </button>
              <button 
                className={styles.secondaryButton}
                onClick={() => {
                  // Export transcriptions as SRT
                  console.log('Export as SRT');
                }}
              >
                🎬 Export as SRT
              </button>
            </div>
          </div>

          {/* Debug Options */}
          <div className={styles.settingRow}>
            <h4 style={{ margin: '10px 0', color: '#00ff41' }}>Debug</h4>
            <label className={styles.settingLabel}>
              <input
                type="checkbox"
                style={{ marginRight: '10px' }}
              />
              <span>Show console logs</span>
            </label>
            <label className={styles.settingLabel}>
              <input
                type="checkbox"
                style={{ marginRight: '10px' }}
              />
              <span>Show VAD scores</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};