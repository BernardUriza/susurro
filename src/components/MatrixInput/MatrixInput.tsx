import { forwardRef } from 'react';
import styles from './MatrixInput.module.css';
import type { MatrixInputProps } from './types';

export const MatrixInput = forwardRef<HTMLInputElement, MatrixInputProps>(
  ({ 
    label,
    error,
    helperText,
    size = 'md',
    fullWidth = false,
    className = '',
    id,
    ...props 
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    const containerClasses = [
      styles.container,
      fullWidth && styles.fullWidth,
      error && styles.hasError,
      className
    ].filter(Boolean).join(' ');

    const inputClasses = [
      styles.input,
      styles[size]
    ].filter(Boolean).join(' ');

    return (
      <div className={containerClasses}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            [{label.toUpperCase()}]
          </label>
        )}
        <div className={styles.inputWrapper}>
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            {...props}
          />
          <span className={styles.focusLine} />
        </div>
        {error && (
          <span id={`${inputId}-error`} className={styles.error}>
            [ERROR] {error}
          </span>
        )}
        {helperText && !error && (
          <span id={`${inputId}-helper`} className={styles.helperText}>
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

MatrixInput.displayName = 'MatrixInput';