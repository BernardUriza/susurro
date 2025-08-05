import { useEffect, useRef, useState } from 'react';

interface ScrollAnimationOptions {
  threshold?: number | number[];
  rootMargin?: string;
  triggerOnce?: boolean;
  delay?: number;
}

export const useScrollAnimation = <T extends HTMLElement = HTMLDivElement>(
  options: ScrollAnimationOptions = {}
) => {
  const {
    threshold = 0.1,
    rootMargin = '0px',
    triggerOnce = false,
    delay = 0
  } = options;

  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const shouldAnimate = entry.isIntersecting && (!triggerOnce || !hasAnimated);
          
          if (shouldAnimate) {
            if (delay > 0) {
              setTimeout(() => {
                setIsInView(true);
                setHasAnimated(true);
              }, delay);
            } else {
              setIsInView(true);
              setHasAnimated(true);
            }
          } else if (!triggerOnce) {
            setIsInView(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, triggerOnce, hasAnimated, delay]);

  return { ref, isInView };
};

// Preset animations
export const scrollAnimations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: 'opacity 0.6s ease-out'
  },
  slideUp: {
    initial: { opacity: 0, transform: 'translateY(20px)' },
    animate: { opacity: 1, transform: 'translateY(0)' },
    transition: 'all 0.6s ease-out'
  },
  slideInLeft: {
    initial: { opacity: 0, transform: 'translateX(-20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    transition: 'all 0.6s ease-out'
  },
  slideInRight: {
    initial: { opacity: 0, transform: 'translateX(20px)' },
    animate: { opacity: 1, transform: 'translateX(0)' },
    transition: 'all 0.6s ease-out'
  },
  scale: {
    initial: { opacity: 0, transform: 'scale(0.9)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    transition: 'all 0.6s ease-out'
  },
  matrixGlitch: {
    initial: { opacity: 0, filter: 'blur(10px)', transform: 'scale(0.95)' },
    animate: { opacity: 1, filter: 'blur(0px)', transform: 'scale(1)' },
    transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
  }
};