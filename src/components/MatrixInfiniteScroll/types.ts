import { ReactNode } from 'react';

export interface MatrixInfiniteScrollProps {
  children: ReactNode;
  loadMore: () => void | Promise<void>;
  hasMore: boolean;
  loader?: ReactNode;
  endMessage?: ReactNode;
  threshold?: number; // Distance from bottom to trigger load (in pixels)
  initialLoad?: boolean;
  inverse?: boolean; // For chat-like interfaces (scroll up to load)
  className?: string;
  scrollableTarget?: string; // ID of scrollable parent
  dataLength: number; // Current items count
}