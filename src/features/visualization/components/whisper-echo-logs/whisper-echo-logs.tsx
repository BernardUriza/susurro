// 1. React and external libraries
import React, { useEffect, useRef, useState } from 'react';

// 2. Absolute imports (internal modules)
import { MatrixScrollArea, MatrixScrollAreaRef } from '../../../../components/MatrixScrollArea';

// 3. Type imports
// (none in this component)

// 4. Style imports
import styles from './whisper-echo-logs.module.css';

interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
}

export interface WhisperEchoLogsProps {
  logs: LogEntry[];
  maxLogs?: number;
  autoScroll?: boolean;
}

export const WhisperEchoLogs: React.FC<WhisperEchoLogsProps> = ({
  logs,
  maxLogs = 100,
  autoScroll = true,
}) => {
  const scrollRef = useRef<MatrixScrollAreaRef>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const displayLogs = logs.slice(-maxLogs);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollToBottom();
    }
  }, [logs.length, autoScroll]);

  const getLogTypeClass = (type: LogEntry['type']) => {
    switch (type) {
      case 'error':
        return styles.logError;
      case 'warning':
        return styles.logWarning;
      case 'success':
        return styles.logSuccess;
      default:
        return styles.logInfo;
    }
  };

  return (
    <div className={`${styles.container} ${isCollapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <span>&gt; WHISPER_ECHO_LOG</span>
        <div className={styles.headerControls}>
          <button
            className={styles.collapseButton}
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '▲' : '▼'}
          </button>
          <span className={styles.indicator}>●</span>
        </div>
      </div>

      {!isCollapsed && (
        <MatrixScrollArea
          ref={scrollRef}
          height="155px"
          fadeEdges={true}
          className={styles.scrollArea}
        >
          <div className={styles.logsContainer}>
            {displayLogs.map((log) => (
              <div key={log.id} className={`${styles.logEntry} ${getLogTypeClass(log.type)}`}>
                <span className={styles.timestamp}>
                  [
                  {log.timestamp.toLocaleTimeString('es-ES', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                  ]
                </span>
                <span className={styles.message}>{log.message}</span>
              </div>
            ))}
          </div>
        </MatrixScrollArea>
      )}
    </div>
  );
};
