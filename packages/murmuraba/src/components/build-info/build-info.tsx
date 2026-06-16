import React, { useMemo } from 'react';

interface IBuildInfoProps {
  version?: string;
  buildDate?: string;
  className?: string;
  'aria-label'?: string;
  showPrefix?: boolean;
  separator?: string;
  format?: 'inline' | 'block' | 'badge';
  size?: 'small' | 'medium' | 'large';
}

export const BuildInfo: React.FC<IBuildInfoProps> = ({
  version = '1.0.0',
  buildDate = new Date().toLocaleDateString(),
  className = '',
  'aria-label': ariaLabel,
  showPrefix = true,
  separator = '•',
  format = 'inline',
  size = 'medium'
}) => {
  const formattedBuildDate = useMemo(() => {
    try {
      // Try to parse as ISO date first
      const date = new Date(buildDate);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
      return buildDate;
    } catch {
      return buildDate;
    }
  }, [buildDate]);

  const versionText = showPrefix ? `v${version}` : version;

  const styles = useMemo(() => {
    const baseStyles: React.CSSProperties = {
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: format === 'block' ? 'block' : 'inline-flex',
      alignItems: 'center',
      gap: format === 'block' ? '0.25rem' : '0.5rem',
      fontSize: size === 'small' ? '0.75rem' : size === 'large' ? '1rem' : '0.875rem',
      lineHeight: '1.4',
    };

    // Theme styles - Always use dark mode
    baseStyles.color = 'var(--dark-text-tertiary, #7B7D8E)';

    // Format-specific styles
    if (format === 'badge') {
      baseStyles.backgroundColor = 'var(--dark-surface-hover, #252631)';
      baseStyles.border = '1px solid var(--neutral-400, #4E5165)';
      baseStyles.borderRadius = '12px';
      baseStyles.padding = size === 'small' ? '0.25rem 0.5rem' : '0.375rem 0.75rem';
      baseStyles.fontSize = size === 'small' ? '0.6875rem' : size === 'large' ? '0.875rem' : '0.75rem';
    }

    return baseStyles;
  }, [format, size]);

  const separatorStyles = useMemo(() => ({
    opacity: 0.5,
    margin: format === 'block' ? '0' : '0 0.25rem',
    userSelect: 'none' as const,
  }), [format]);

  return (
    <div 
      className={`murmuraba-build-info murmuraba-build-info--${format} murmuraba-build-info--${size} ${className}`}
      style={styles}
      role="status"
      aria-label={ariaLabel || `Build information: Version ${version}, built on ${formattedBuildDate}`}
    >
      {format === 'block' ? (
        <>
          <div>{versionText}</div>
          <div>{formattedBuildDate}</div>
        </>
      ) : (
        <>
          <span className="murmuraba-build-info__version">
            {versionText}
          </span>
          {separator && (
            <span 
              className="murmuraba-build-info__separator"
              style={separatorStyles}
              aria-hidden="true"
            >
              {separator}
            </span>
          )}
          <span className="murmuraba-build-info__date">
            {formattedBuildDate}
          </span>
        </>
      )}
    </div>
  );
};

// Utility function to get package version
export const getPackageVersion = (): string => {
  try {
    // In a real package, this would be replaced during build
    return process.env.PACKAGE_VERSION || '3.0.0';
  } catch {
    return '1.0.0';
  }
};

// Utility function to format build date
export const formatBuildDate = (date: Date | string): string => {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return new Date().toLocaleDateString();
  }
};

// Pre-configured variants for common use cases
export const BuildInfoBadge: React.FC<Omit<IBuildInfoProps, 'format'>> = (props) => (
  <BuildInfo {...props} format="badge" />
);

export const BuildInfoBlock: React.FC<Omit<IBuildInfoProps, 'format'>> = (props) => (
  <BuildInfo {...props} format="block" />
);

export const BuildInfoInline: React.FC<Omit<IBuildInfoProps, 'format'>> = (props) => (
  <BuildInfo {...props} format="inline" />
);