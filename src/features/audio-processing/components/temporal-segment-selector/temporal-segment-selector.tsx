'use client';

// React and external libraries
import React from 'react';

export interface TemporalSegmentSelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  showOverlap?: boolean;
  overlapDuration?: number;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  variant?: 'simple' | 'advanced';
  presets?: number[];
  showProgressBar?: boolean;
  showIncrementButtons?: boolean;
  description?: string;
}

export const TemporalSegmentSelector: React.FC<TemporalSegmentSelectorProps> = ({
  value,
  onChange,
  min = 1,
  max = 60,
  label = 'TEMPORAL_SEGMENT_DURATION_SEC',
  showOverlap = false,
  overlapDuration = 3,
  style = {},
  inputStyle = {},
  variant = 'simple',
  presets = [5, 10, 15, 30],
  showProgressBar = false,
  showIncrementButtons = false,
  description,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || min;
    onChange(Math.max(min, Math.min(max, newValue)));
  };

  if (variant === 'simple') {
    return (
      <div
        style={{
          marginBottom: '30px',
          padding: '20px',
          background: 'rgba(0, 255, 65, 0.05)',
          border: '1px solid rgba(0, 255, 65, 0.3)',
          ...style,
        }}
      >
        <label style={{ fontSize: '1.1rem' }}>&gt; {label}: </label>
        <input
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            color: '#00ff41',
            border: '1px solid #00ff41',
            padding: '8px',
            marginLeft: '10px',
            width: '80px',
            fontSize: '1.1rem',
            textAlign: 'center',
            ...inputStyle,
          }}
        />
        {showOverlap && (
          <span style={{ marginLeft: '20px', opacity: 0.7 }}>
            OVERLAP: {overlapDuration}s FIXED
          </span>
        )}
      </div>
    );
  }

  // Advanced variant
  return (
    <div
      style={{
        marginTop: 20,
        marginBottom: 20,
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(0, 255, 65, 0.3)',
        borderRadius: '0',
        backdropFilter: 'blur(5px)',
        position: 'relative',
        overflow: 'hidden',
        animation: 'fadeIn 0.5s ease-in',
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <label
          style={{
            color: '#00ff41',
            fontSize: '14px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          &gt; {label}:
        </label>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          {showIncrementButtons && (
            <button
              onClick={() => onChange(Math.max(min, value - 1))}
              className="matrix-button"
              style={{
                width: '40px',
                height: '40px',
                padding: '0',
                fontSize: '20px',
                lineHeight: '1',
                borderRadius: '0',
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#00ff41';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.color = '#00ff41';
              }}
            >
              -
            </button>
          )}

          <input
            type="number"
            value={value}
            onChange={handleChange}
            min={min}
            max={max}
            style={{
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#00ff41',
              border: '1px solid #00ff41',
              padding: '8px 12px',
              width: '80px',
              fontSize: '16px',
              textAlign: 'center',
              borderRadius: '0',
              ...inputStyle,
            }}
          />

          {showIncrementButtons && (
            <button
              onClick={() => onChange(Math.min(max, value + 1))}
              className="matrix-button"
              style={{
                width: '40px',
                height: '40px',
                padding: '0',
                fontSize: '20px',
                lineHeight: '1',
                borderRadius: '0',
                background: 'rgba(0, 0, 0, 0.8)',
                border: '1px solid #00ff41',
                color: '#00ff41',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#00ff41';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                e.currentTarget.style.color = '#00ff41';
              }}
            >
              +
            </button>
          )}
        </div>

        {/* Preset buttons */}
        {presets.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: '5px',
              flexWrap: 'wrap',
            }}
          >
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => onChange(preset)}
                className="matrix-button"
                style={{
                  padding: '5px 10px',
                  fontSize: '12px',
                  background: value === preset ? '#00ff41' : 'rgba(0, 0, 0, 0.8)',
                  color: value === preset ? '#000' : '#00ff41',
                  border: '1px solid #00ff41',
                  borderRadius: '0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (value !== preset) {
                    e.currentTarget.style.background = 'rgba(0, 255, 65, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (value !== preset) {
                    e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
                  }
                }}
              >
                {preset}s
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visual indicator bar */}
      {showProgressBar && (
        <div
          style={{
            marginTop: '15px',
            height: '4px',
            background: 'rgba(0, 255, 65, 0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${(value / max) * 100}%`,
              background: 'linear-gradient(to right, #00ff41, #00cc33)',
              boxShadow: '0 0 10px #00ff41',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      )}

      {description && (
        <p
          style={{
            marginTop: '10px',
            fontSize: '11px',
            color: '#00ff41',
            opacity: 0.6,
            textAlign: 'center',
          }}
        >
          &gt; {description}
        </p>
      )}
    </div>
  );
};
