import { useEffect, useRef, useCallback, useState } from 'react';
import styles from './MatrixInfiniteScroll.module.css';
import type { MatrixInfiniteScrollProps } from './types';

export const MatrixInfiniteScroll = ({
  children,
  loadMore,
  hasMore,
  loader = <div className={styles.loader}>[LOADING MORE...]</div>,
  endMessage = <div className={styles.endMessage}>[END OF DATA]</div>,
  threshold = 100,
  initialLoad = true,
  inverse = false,
  className = '',
  scrollableTarget,
  dataLength
}: MatrixInfiniteScrollProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const previousDataLength = useRef(dataLength);

  const handleLoadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      await loadMore();
    } catch (error) {
      console.error('[INFINITE_SCROLL_ERROR]', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, loadMore]);

  // Set up Intersection Observer
  useEffect(() => {
    const scrollableElement = scrollableTarget 
      ? document.getElementById(scrollableTarget)
      : window;

    const options: IntersectionObserverInit = {
      root: scrollableTarget ? document.getElementById(scrollableTarget) : null,
      rootMargin: `${threshold}px`,
      threshold: 0.1
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasMore && !isLoading) {
        handleLoadMore();
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersection, options);

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold, scrollableTarget, hasMore, isLoading, handleLoadMore]);

  // Handle initial load
  useEffect(() => {
    if (initialLoad && dataLength === 0 && hasMore) {
      handleLoadMore();
    }
  }, []);

  // Detect data changes for inverse scroll
  useEffect(() => {
    if (inverse && previousDataLength.current !== dataLength) {
      const scrollableElement = scrollableTarget 
        ? document.getElementById(scrollableTarget)
        : document.documentElement;

      if (scrollableElement) {
        const previousHeight = scrollableElement.scrollHeight;
        
        // Use requestAnimationFrame to wait for DOM update
        requestAnimationFrame(() => {
          const newHeight = scrollableElement.scrollHeight;
          const heightDifference = newHeight - previousHeight;
          
          if (heightDifference > 0) {
            scrollableElement.scrollTop += heightDifference;
          }
        });
      }
    }
    previousDataLength.current = dataLength;
  }, [dataLength, inverse, scrollableTarget]);

  const containerClasses = [
    styles.container,
    inverse && styles.inverse,
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {inverse && (
        <>
          <div ref={sentinelRef} className={styles.sentinel} />
          {isLoading && loader}
          {!hasMore && dataLength > 0 && endMessage}
        </>
      )}
      
      {children}
      
      {!inverse && (
        <>
          {isLoading && loader}
          {!hasMore && dataLength > 0 && endMessage}
          <div ref={sentinelRef} className={styles.sentinel} />
        </>
      )}
    </div>
  );
};