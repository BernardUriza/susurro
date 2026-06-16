import React from 'react';
import { formatPercentage } from '../formatters';

interface IProcessingMetricsProps {
  inputLevel: number;
  outputLevel: number;
  frameCount: number;
  droppedFrames: number;
}

export function ProcessingMetrics({ 
  inputLevel, 
  outputLevel, 
  frameCount, 
  droppedFrames 
}: IProcessingMetricsProps) {
  return (
    <div className="details__section">
      <h4 className="section__title">📊 Processing Metrics</h4>
      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric__label">Input Level</span>
          <span className="metric__value">
            {formatPercentage(inputLevel * 100)}
          </span>
          <div className="metric__bar">
            <div 
              className="metric__fill metric__fill--input"
              style={{ width: `${inputLevel * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="metric-item">
          <span className="metric__label">Output Level</span>
          <span className="metric__value">
            {formatPercentage(outputLevel * 100)}
          </span>
          <div className="metric__bar">
            <div 
              className="metric__fill metric__fill--output"
              style={{ width: `${outputLevel * 100}%` }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="metric-item">
          <span className="metric__label">Frames Processed</span>
          <span className="metric__value">
            {frameCount.toLocaleString()}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric__label">Dropped Frames</span>
          <span className="metric__value metric__value--warning">
            {droppedFrames}
          </span>
        </div>
      </div>
    </div>
  );
}