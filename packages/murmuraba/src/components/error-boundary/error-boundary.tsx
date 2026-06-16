import React, { Component, ErrorInfo, ReactNode } from 'react';

interface IErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  className?: string;
  'aria-label'?: string;
}

interface IErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<IErrorBoundaryProps, IErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  public state: IErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): Partial<IErrorBoundaryState> {
    return { 
      hasError: true, 
      error 
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
    
    // Log error for debugging
    console.error('🚨 Murmuraba ErrorBoundary caught an error:', error, errorInfo);
  }

  public componentDidUpdate(prevProps: IErrorBoundaryProps) {
    const { resetOnPropsChange } = this.props;
    const { hasError } = this.state;
    
    // Reset error state if props change and resetOnPropsChange is enabled
    if (resetOnPropsChange && hasError && prevProps.children !== this.props.children) {
      this.resetErrorBoundary();
    }
  }

  public componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }
  }

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private handleReload = () => {
    this.resetErrorBoundary();
    
    // If still erroring after reset, reload the page
    this.resetTimeoutId = window.setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  private handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.handleReload();
    }
  };

  public render() {
    const { hasError, error, errorInfo } = this.state;
    const { 
      children, 
      fallback, 
      className = '', 
      'aria-label': ariaLabel 
    } = this.props;

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo!);
      }

      // Default error UI
      return (
        <div 
          className={`murmuraba-error-boundary ${className}`}
          role="alert"
          aria-label={ariaLabel || 'Application error occurred'}
          style={defaultStyles.container}
        >
          <div style={defaultStyles.card}>
            <div style={defaultStyles.icon} aria-hidden="true">
              🌾
            </div>
            
            <h1 style={defaultStyles.title}>
              Oops! Something went wrong
            </h1>
            
            <p style={defaultStyles.message}>
              The audio processing application encountered an unexpected error. 
              This might be due to browser compatibility or a temporary issue.
            </p>
            
            <button 
              onClick={this.handleReload}
              onKeyDown={this.handleKeyDown}
              style={defaultStyles.button}
              aria-label="Reload application to recover from error"
            >
              <span style={defaultStyles.buttonIcon} aria-hidden="true">🔄</span>
              <span>Reload Application</span>
            </button>

            {/* Development error details */}
            {process.env.NODE_ENV === 'development' && error && (
              <details style={defaultStyles.details}>
                <summary style={defaultStyles.summary}>
                  🔍 Error Details (Development)
                </summary>
                <div style={defaultStyles.errorContent}>
                  <h4 style={defaultStyles.errorTitle}>Error:</h4>
                  <pre style={defaultStyles.errorText}>
                    {error.toString()}
                  </pre>
                  
                  {error.stack && (
                    <>
                      <h4 style={defaultStyles.errorTitle}>Stack Trace:</h4>
                      <pre style={defaultStyles.errorText}>
                        {error.stack}
                      </pre>
                    </>
                  )}
                  
                  {errorInfo?.componentStack && (
                    <>
                      <h4 style={defaultStyles.errorTitle}>Component Stack:</h4>
                      <pre style={defaultStyles.errorText}>
                        {errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

// Default styles for the error boundary
const defaultStyles = {
  container: {
    minHeight: '400px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    backgroundColor: 'var(--dark-bg-primary, #0A0B0E)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties,

  card: {
    maxWidth: '500px',
    width: '100%',
    padding: '3rem 2rem',
    backgroundColor: 'var(--dark-surface, #1F2028)',
    borderRadius: '12px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
    textAlign: 'center' as const,
    border: '1px solid var(--neutral-400, #4E5165)',
  } as React.CSSProperties,

  icon: {
    fontSize: '4rem',
    marginBottom: '1.5rem',
    display: 'block',
  } as React.CSSProperties,

  title: {
    fontSize: '1.75rem',
    fontWeight: 'bold' as const,
    color: 'var(--dark-text-primary, #CACBDA)',
    marginBottom: '1rem',
    margin: '0 0 1rem 0',
  } as React.CSSProperties,

  message: {
    fontSize: '1rem',
    color: 'var(--dark-text-secondary, #A0A1B3)',
    lineHeight: '1.6',
    marginBottom: '2rem',
    margin: '0 0 2rem 0',
  } as React.CSSProperties,

  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--accent-green, #52A32F)',
    color: 'var(--dark-text-primary, #CACBDA)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '500' as const,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      backgroundColor: 'var(--accent-green-light, #6BC748)',
    },
  } as React.CSSProperties,

  buttonIcon: {
    fontSize: '1rem',
  } as React.CSSProperties,

  details: {
    marginTop: '2rem',
    textAlign: 'left' as const,
    backgroundColor: 'var(--dark-bg-tertiary, #1A1B23)',
    borderRadius: '6px',
    padding: '1rem',
  } as React.CSSProperties,

  summary: {
    cursor: 'pointer',
    fontWeight: '500' as const,
    color: 'var(--dark-text-secondary, #A0A1B3)',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  } as React.CSSProperties,

  errorContent: {
    marginTop: '1rem',
  } as React.CSSProperties,

  errorTitle: {
    fontSize: '0.875rem',
    fontWeight: '600' as const,
    color: 'var(--dark-text-primary, #CACBDA)',
    marginBottom: '0.5rem',
    margin: '1rem 0 0.5rem 0',
  } as React.CSSProperties,

  errorText: {
    fontSize: '0.75rem',
    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
    backgroundColor: '#edf2f7',
    padding: '0.75rem',
    borderRadius: '4px',
    overflow: 'auto',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    color: 'var(--dark-text-primary, #CACBDA)',
    border: '1px solid #cbd5e0',
    margin: '0 0 0.5rem 0',
  } as React.CSSProperties,
};

// Export a HOC version for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<IErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}