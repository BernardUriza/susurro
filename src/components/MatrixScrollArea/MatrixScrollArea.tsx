import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import styles from './MatrixScrollArea.module.css';
import type { MatrixScrollAreaProps } from './types';

export interface MatrixScrollAreaRef {
  scrollTo: (options: ScrollToOptions) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

export const MatrixScrollArea = forwardRef<MatrixScrollAreaRef, MatrixScrollAreaProps>(
  ({ 
    children,
    height,
    maxHeight,
    orientation = 'vertical',
    showScrollbar = true,
    fadeEdges = true,
    smoothScroll = true,
    onScrollEnd,
    onScrollTop,
    virtualizeThreshold,
    className = '',
    style,
    ...props 
  }, ref) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    const [scrollPosition, setScrollPosition] = useState({ top: true, bottom: false });
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Expose scroll methods
    useImperativeHandle(ref, () => ({
      scrollTo: (options: ScrollToOptions) => {
        scrollRef.current?.scrollTo(options);
      },
      scrollToTop: () => {
        scrollRef.current?.scrollTo({ top: 0, behavior: smoothScroll ? 'smooth' : 'auto' });
      },
      scrollToBottom: () => {
        scrollRef.current?.scrollTo({ 
          top: scrollRef.current.scrollHeight, 
          behavior: smoothScroll ? 'smooth' : 'auto' 
        });
      }
    }));

    const handleScroll = () => {
      const element = scrollRef.current;
      if (!element) return;

      setIsScrolling(true);
      
      // Clear previous timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set scrolling to false after scroll ends
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      // Check scroll position
      const isTop = element.scrollTop === 0;
      const isBottom = Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 1;

      setScrollPosition({ top: isTop, bottom: isBottom });

      // Trigger callbacks
      if (isTop && onScrollTop) {
        onScrollTop();
      }
      if (isBottom && onScrollEnd) {
        onScrollEnd();
      }
    };

    useEffect(() => {
      const element = scrollRef.current;
      if (!element) return;

      element.addEventListener('scroll', handleScroll, { passive: true });
      
      // Initial position check
      handleScroll();

      return () => {
        element.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }, [onScrollEnd, onScrollTop]);

    const containerClasses = [
      styles.container,
      styles[orientation],
      !showScrollbar && styles.hideScrollbar,
      fadeEdges && styles.fadeEdges,
      isScrolling && styles.scrolling,
      scrollPosition.top && styles.atTop,
      scrollPosition.bottom && styles.atBottom,
      className
    ].filter(Boolean).join(' ');

    const containerStyle = {
      ...style,
      height,
      maxHeight
    };

    return (
      <div className={styles.wrapper}>
        {fadeEdges && <div className={styles.fadeTop} />}
        <div
          ref={scrollRef}
          className={containerClasses}
          style={containerStyle}
          {...props}
        >
          {children}
        </div>
        {fadeEdges && <div className={styles.fadeBottom} />}
      </div>
    );
  }
);

MatrixScrollArea.displayName = 'MatrixScrollArea';