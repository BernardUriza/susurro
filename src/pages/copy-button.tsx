import { useState } from 'react';
import styles from './pages.module.css';

interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = 'copy' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className={styles.copyButton} onClick={handleCopy}>
      {copied ? 'copied ✓' : label}
    </button>
  );
}
