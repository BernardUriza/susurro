import React from 'react';

interface MatrixRainProps {
  density?: number;
  speed?: number;
  fontSize?: number;
}

export const MatrixRain: React.FC<MatrixRainProps> = ({ density = 0.6 }) => {
  return <div className="matrix-rain" style={{ opacity: density }} />;
};