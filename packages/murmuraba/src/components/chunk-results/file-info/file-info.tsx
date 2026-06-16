import React from 'react';
import { formatFileSize } from '../formatters';

interface IFileInfoProps {
  originalSize: number;
  processedSize: number;
  noiseRemoved: number;
}

export function FileInfo({ originalSize, processedSize, noiseRemoved }: IFileInfoProps) {
  return (
    <div className="details__section">
      <h4 className="section__title">📁 File Information</h4>
      <div className="file-info-grid">
        <div className="file-info-item">
          <span className="info__label">Original Size</span>
          <span className="info__value">{formatFileSize(originalSize)}</span>
        </div>
        <div className="file-info-item">
          <span className="info__label">Processed Size</span>
          <span className="info__value">{formatFileSize(processedSize)}</span>
        </div>
        <div className="file-info-item">
          <span className="info__label">Size Reduction</span>
          <span className="info__value info__value--success">
            {formatFileSize(noiseRemoved)}
          </span>
        </div>
      </div>
    </div>
  );
}