// React and external libraries
import React, { useEffect, useRef } from 'react';
import { MatrixScrollArea, MatrixScrollAreaRef } from '../../../../components/MatrixScrollArea';
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
  autoScroll = true 
}) => {
  const scrollRef = useRef<MatrixScrollAreaRef>(null);
  const displayLogs = logs.slice(-maxLogs);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollToBottom();
    }
  }, [logs.length, autoScroll]);

  const getLogTypeClass = (type: LogEntry['type']) => {
    switch (type) {
      case 'error': return styles.logError;
      case 'warning': return styles.logWarning;
      case 'success': return styles.logSuccess;
      default: return styles.logInfo;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>&gt; WHISPER_ECHO_LOG</span>
        <span className={styles.indicator}>●</span>
      </div>
      
      <MatrixScrollArea 
        ref={scrollRef}
        height="240px"
        fadeEdges={true}
        className={styles.scrollArea}
      >
        <div className={styles.logsContainer}>
          {displayLogs.map((log) => (
            <div
              key={log.id}
              className={`${styles.logEntry} ${getLogTypeClass(log.type)}`}
            >
              <span className={styles.timestamp}>
                [{log.timestamp.toLocaleTimeString('es-ES', { 
                  hour12: false, 
                  hour: '2-digit', 
                  minute: '2-digit', 
                  second: '2-digit' 
                })}]
              </span>
              <span className={styles.message}>{log.message}</span>
            </div>
          ))}
        </div>
      </MatrixScrollArea>
    </div>
  );
};
