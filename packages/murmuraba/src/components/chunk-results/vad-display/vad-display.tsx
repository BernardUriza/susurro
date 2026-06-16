import React from 'react';

interface IVadDisplayProps {
  averageVad?: number;
  vadData?: Array<{ time: number; vad: number }>;
  chunkIndex: number;
}

export function VadDisplay({ averageVad, vadData, chunkIndex }: IVadDisplayProps) {
  if (averageVad === undefined) return null;

  const vadPercentage = averageVad * 100;
  const vadLevel = vadPercentage > 70 ? 'high' : vadPercentage > 30 ? 'medium' : 'low';
  
  const peakVad = vadData ? Math.max(...vadData.map(d => d.vad)) : averageVad;
  const voiceDetectedPercentage = vadData 
    ? (vadData.filter(d => d.vad > 0.5).length / vadData.length) * 100
    : vadPercentage;

  return (
    <div className="vad-display" data-vad-level={vadLevel}>
      <div className="vad-display__header">
        <span className="vad-display__icon" aria-hidden="true">🎤</span>
        <h4 className="vad-display__title">Voice Activity Detection</h4>
      </div>
      
      <div className="vad-display__primary">
        <div className="vad-display__metric vad-display__metric--featured">
          <span className="vad-metric__label">Average VAD</span>
          <span className="vad-metric__value vad-metric__value--large">
            {averageVad.toFixed(3)}
          </span>
          <div className="vad-metric__bar">
            <div 
              className={`vad-metric__fill vad-metric__fill--${vadLevel}`}
              style={{ width: `${vadPercentage}%` }}
              role="progressbar"
              aria-valuenow={vadPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Voice activity ${vadPercentage.toFixed(1)}%`}
            />
          </div>
        </div>
      </div>

      {vadData && vadData.length > 0 && (
        <div className="vad-display__secondary">
          <div className="vad-display__metric">
            <span className="vad-metric__label">Voice Detected</span>
            <span className="vad-metric__value">{voiceDetectedPercentage.toFixed(1)}%</span>
          </div>
          <div className="vad-display__metric">
            <span className="vad-metric__label">Peak VAD</span>
            <span className="vad-metric__value">{peakVad.toFixed(3)}</span>
          </div>
        </div>
      )}

      <div className="vad-display__status">
        <span className={`vad-status vad-status--${vadLevel}`}>
          {vadLevel === 'high' ? '🟢 Strong Voice Activity' : 
           vadLevel === 'medium' ? '🟡 Moderate Voice Activity' : 
           '🔴 Low Voice Activity'}
        </span>
      </div>
    </div>
  );
}