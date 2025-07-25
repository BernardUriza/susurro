import React from 'react'

interface StatusMessageProps {
  status: string
}

export const StatusMessage: React.FC<StatusMessageProps> = ({ status }) => {
  if (!status) return null

  const isError = status.includes('Error')
  
  return (
    <p style={{ 
      padding: 10, 
      background: isError ? '#ffebee' : '#e8f5e9',
      borderRadius: 6,
      marginBottom: 20
    }}>
      {status}
    </p>
  )
}