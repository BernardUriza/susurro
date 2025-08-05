import { forwardRef } from 'react';
import styles from './MatrixButton.module.css';
import type { MatrixButtonProps } from './types';

export const MatrixButton = forwardRef<HTMLButtonElement, MatrixButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    fullWidth = false,
    loading = false,
    className = '',
    children, 
    disabled,
    ...props 
  }, ref) => {
    const classes = [
      styles.button,
      styles[variant],
      styles[size],
      fullWidth && styles.fullWidth,
      loading && styles.loading,
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className={styles.loadingText}>[PROCESSING...]</span>
        ) : (
          children
        )}
      </button>
    );
  }
);

MatrixButton.displayName = 'MatrixButton';