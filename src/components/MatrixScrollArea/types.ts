import { HTMLAttributes, ReactNode } from 'react';

export interface MatrixScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  height?: string | number;
  maxHeight?: string | number;
  orientation?: 'vertical' | 'horizontal' | 'both';
  showScrollbar?: boolean;
  fadeEdges?: boolean;
  smoothScroll?: boolean;
  onScrollEnd?: () => void;
  onScrollTop?: () => void;
  virtualizeThreshold?: number; // Number of items before enabling virtualization
}
