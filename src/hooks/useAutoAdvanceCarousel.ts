import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../store/uiStore';

export interface AutoAdvanceOptions {
  enabled?: boolean;
  intervalMs?: number;
  pauseOnInteraction?: boolean;
  resumeDelay?: number;
  minItems?: number;
}

// Global manager to limit concurrent scrolling of carousels to maximum 2 visible at the same time
interface ScrollerRegistration {
  id: string;
  element: HTMLElement;
  isVisible: boolean;
  setAllowed: (allowed: boolean) => void;
  y: number;
}

const activeScrollers = new Set<ScrollerRegistration>();

function updateAllowedScrollers() {
  const visible = Array.from(activeScrollers).filter(s => s.isVisible);
  
  // Calculate vertical offset of each scroller relative to the viewport
  visible.forEach(s => {
    const rect = s.element.getBoundingClientRect();
    s.y = rect.top;
  });

  // Sort from topmost physically down
  visible.sort((a, b) => a.y - b.y);

  // Allow only the first 2 visible ones to auto-scroll, pause others
  const allowedIds = visible.slice(0, 2).map(s => s.id);

  activeScrollers.forEach(s => {
    s.setAllowed(s.isVisible && allowedIds.includes(s.id));
  });
}

if (typeof window !== 'undefined') {
  const triggerUpdate = () => {
    requestAnimationFrame(updateAllowedScrollers);
  };
  window.addEventListener('scroll', triggerUpdate, { passive: true });
  window.addEventListener('resize', triggerUpdate, { passive: true });
  document.addEventListener('visibilitychange', triggerUpdate, { passive: true });
}

export function useAutoAdvanceCarousel(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: AutoAdvanceOptions = {}
) {
  const {
    enabled = true,
    intervalMs = 4500,
    pauseOnInteraction = true,
    resumeDelay = 6000,
    minItems = 4,
  } = options;

  const isHomeReady = useUIStore(s => s.isHomeReady);
  const [isAllowed, setIsAllowed] = useState(false);
  const lastInteractionRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const recordInteraction = () => {
    if (pauseOnInteraction) {
      lastInteractionRef.current = Date.now();
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) {
      setIsAllowed(false);
      return;
    }

    const id = Math.random().toString(36).substring(2, 11);
    const registration: ScrollerRegistration = {
      id,
      element: el,
      isVisible: false,
      setAllowed: (val) => setIsAllowed(val),
      y: 0,
    };

    activeScrollers.add(registration);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          registration.isVisible = entry.isIntersecting;
        });
        updateAllowedScrollers();
      },
      { threshold: 0.05 }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      activeScrollers.delete(registration);
      updateAllowedScrollers();
    };
  }, [containerRef, enabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled || !isAllowed) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const advance = () => {
      const children = Array.from(el.children);
      if (children.length < minItems) return;

      const isPageVisible = document.visibilityState === 'visible';
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const timeSinceLastInteraction = Date.now() - lastInteractionRef.current;

      if (!isPageVisible || prefersReduced) return;
      if (pauseOnInteraction && timeSinceLastInteraction < resumeDelay) return;

      // Find closest item currently aligned at the scroll view left
      const containerLeft = el.getBoundingClientRect().left;
      let currentIndex = 0;
      let minDistance = Infinity;

      children.forEach((child, idx) => {
        const childLeft = child.getBoundingClientRect().left;
        const distance = Math.abs(childLeft - containerLeft);
        if (distance < minDistance) {
          minDistance = distance;
          currentIndex = idx;
        }
      });

      // Calculate next index (loops back to first item when reaching the end)
      const nextIndex = (currentIndex + 1) % children.length;
      const targetChild = children[nextIndex] as HTMLElement;

      if (targetChild) {
        const containerScrollLeft = el.scrollLeft;
        const containerRect = el.getBoundingClientRect();
        const childRect = targetChild.getBoundingClientRect();
        const targetScrollLeft = containerScrollLeft + (childRect.left - containerRect.left);
        
        el.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth'
        });
      }
    };

    let startTimeout: NodeJS.Timeout;

    const setupAutoTimer = () => {
      timerRef.current = setInterval(advance, intervalMs);
    };

    // Wait at least 1.5 seconds after Home is ready before initiating auto-scroll
    if (isHomeReady === undefined || isHomeReady) {
      startTimeout = setTimeout(() => {
        setupAutoTimer();
      }, 1500);
    }

    const handleMouseOver = () => recordInteraction();
    const handleTouchStart = () => recordInteraction();
    const handleScroll = () => {
      // Small debounce/throttle behavior on manual scrolls to prevent competing transitions
      recordInteraction();
    };
    const handleFocus = () => recordInteraction();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
        recordInteraction();
      }
    };

    el.addEventListener('mouseover', handleMouseOver, { passive: true });
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('pointerdown', recordInteraction, { passive: true });
    el.addEventListener('scroll', handleScroll, { passive: true });
    el.addEventListener('focusin', handleFocus, { passive: true });
    el.addEventListener('keydown', handleKeyDown, { passive: true });

    return () => {
      clearTimeout(startTimeout);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      el.removeEventListener('mouseover', handleMouseOver);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('pointerdown', recordInteraction);
      el.removeEventListener('scroll', handleScroll);
      el.removeEventListener('focusin', handleFocus);
      el.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, enabled, isAllowed, isHomeReady, intervalMs, pauseOnInteraction, resumeDelay, minItems]);
}
