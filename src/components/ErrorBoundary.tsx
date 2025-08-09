import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('[ErrorBoundary] Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // If a fallback is provided, use it
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }
      
      // Otherwise, use the default error UI
      return (
        <div
          style={{
            padding: '20px',
            color: 'red',
            background: '#000',
            minHeight: '100vh',
          }}
        >
          <h1>Something went wrong!</h1>
          <pre style={{ color: '#ff6b6b' }}>{this.state.error?.message}</pre>
          <pre style={{ color: '#ffa500', fontSize: '12px' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}
