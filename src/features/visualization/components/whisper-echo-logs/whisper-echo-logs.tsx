// React and external libraries\nimport React from 'react'

interface LogEntry {
  id: string
  timestamp: Date
  message: string
  type: 'info' | 'warning' | 'error' | 'success'
}

interface WhisperEchoLogsProps {
  logs: LogEntry[]
  maxLogs?: number
}

export const WhisperEchoLogs: React.FC<WhisperEchoLogsProps> = ({ logs, maxLogs = 10 }) => {
  const displayLogs = logs.slice(-maxLogs) // Show only last N logs
  
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      width: '400px',
      maxHeight: '300px',
      background: 'rgba(0, 0, 0, 0.95)',
      border: '1px solid #00ff41',
      borderRadius: '0',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#00ff41',
      overflow: 'auto',
      zIndex: 1000,
      boxShadow: '0 0 20px rgba(0, 255, 65, 0.3)',
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{ 
        borderBottom: '1px solid #00ff41', 
        paddingBottom: '5px', 
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>&gt; WHISPER_ECHO_LOG</span>
        <span style={{ 
          fontSize: '10px', 
          opacity: 0.7,
          animation: 'pulse 2s infinite'
        }}>●</span>
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
      }}>
        {displayLogs.map((log) => (
          <div key={log.id} style={{
            opacity: 0.9,
            fontSize: '11px',
            color: log.type === 'error' ? '#ff4141' : 
                   log.type === 'warning' ? '#ffff41' :
                   log.type === 'success' ? '#41ff41' : '#00ff41'
          }}>
            <span style={{ opacity: 0.6 }}>
              [{log.timestamp.toLocaleTimeString()}]
            </span>{' '}
            {log.message}
          </div>
        ))}
      </div>
    </div>
  )
}