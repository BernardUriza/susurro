import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface IVadTimelineProps {
  vadData: Array<{ time: number; vad: number }>;
  chunkId: string;
}

export const VadTimeline = React.memo(function VadTimeline({ vadData, chunkId }: IVadTimelineProps) {

  // Show loading state while data is being processed
  if (!vadData || vadData.length === 0) {
    return (
      <div className="details__section">
        <h4 className="section__title">📈 Voice Activity Detection (VAD) Timeline</h4>
        <div className="vad-loading-container">
          <div className="vad-loading-spinner">
            <div className="spinner-dot"></div>
            <div className="spinner-dot"></div>
            <div className="spinner-dot"></div>
          </div>
          <p className="vad-loading-text">Analizando actividad de voz, por favor espera...</p>
        </div>
      </div>
    );
  }

  const stats = useMemo(() => {
    const voiceDetectedPercentage = (vadData.filter(d => d.vad > 0.5).length / vadData.length) * 100;
    const peakVad = Math.max(...vadData.map(d => d.vad));
    const minVad = Math.min(...vadData.map(d => d.vad));
    return { voiceDetectedPercentage, peakVad, minVad };
  }, [vadData]);

  return (
    <div className="details__section">
      <h4 className="section__title">📈 Voice Activity Detection (VAD) Timeline</h4>
      <div className="vad-chart-container vad-chart-fade-in">
        {vadData && vadData.length > 0 ? (
          <div style={{ 
            height: '200px', 
            width: '100%',
            minHeight: '200px',
            minWidth: '300px',
            position: 'relative'
          }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={200}>
            <AreaChart data={vadData}>
              <defs>
                <linearGradient id={`vadGradient-${chunkId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7ED321" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#7ED321" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3b3c5a" opacity={0.5} />
              <XAxis 
                dataKey="time" 
                stroke="#a0a0a0"
                tickFormatter={(value: number) => `${value.toFixed(1)}s`}
              />
              <YAxis 
                domain={[0, 1]} 
                stroke="#a0a0a0"
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tickFormatter={(value: number) => value.toFixed(2)}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(36, 37, 58, 0.95)', 
                  border: '1px solid #3b3c5a',
                  borderRadius: '8px',
                  color: '#e0e0e0'
                }}
                formatter={(value) => [`VAD: ${Number(value).toFixed(3)}`, '']}
                labelFormatter={(label) => `Time: ${label}s`}
              />
              <Area 
                type="monotone" 
                dataKey="vad" 
                stroke="#7ED321" 
                fill={`url(#vadGradient-${chunkId})`}
                fillOpacity={1}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        ) : (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p>No VAD data available</p>
          </div>
        )}
        
        {/* Stats section */}
        {vadData && vadData.length > 0 && (
          <div className="vad-stats">
          <span className="vad-stat">
            <strong>Voice Detected:</strong> {stats.voiceDetectedPercentage.toFixed(1)}%
          </span>
          <span className="vad-stat">
            <strong>Peak VAD:</strong> {stats.peakVad.toFixed(3)}
          </span>
          <span className="vad-stat">
            <strong>Min VAD:</strong> {stats.minVad.toFixed(3)}
          </span>
        </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  if (prevProps.chunkId !== nextProps.chunkId) return false;
  if (!prevProps.vadData && !nextProps.vadData) return true;
  if (!prevProps.vadData || !nextProps.vadData) return false;
  if (prevProps.vadData.length !== nextProps.vadData.length) return false;
  
  // Deep comparison of first and last few data points
  const checkPoints = [0, 1, prevProps.vadData.length - 2, prevProps.vadData.length - 1];
  for (const i of checkPoints) {
    if (i >= 0 && i < prevProps.vadData.length) {
      if (prevProps.vadData[i]?.time !== nextProps.vadData[i]?.time ||
          prevProps.vadData[i]?.vad !== nextProps.vadData[i]?.vad) {
        return false;
      }
    }
  }
  return true;
});