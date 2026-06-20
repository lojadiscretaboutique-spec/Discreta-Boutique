import { useAutoAdvanceCarousel, AutoAdvanceOptions } from './useAutoAdvanceCarousel';

export { useAutoAdvanceCarousel };
export type { AutoAdvanceOptions };

export interface AutoScrollOptions {
  enabled?: boolean;
  speed?: 'slow' | 'medium' | 'fast' | number;
  pauseOnHover?: boolean;
  pauseOnTouch?: boolean;
  resumeDelay?: number;
}

/**
 * Re-export useInfiniteAutoScroll utilizing the extremely stable, non-flickering, non-trembling
 * item-by-item slow scroll auto-advance logic. This implements the same hook API interface to prevent compile failures.
 */
export function useInfiniteAutoScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: AutoScrollOptions = {}
) {
  // Convert old speed preset names into corresponding intervals or standard parameter mappings
  let intervalMs = 4500;
  if (options.speed === 'fast') {
    intervalMs = 3000;
  } else if (options.speed === 'medium') {
    intervalMs = 4000;
  } else if (options.speed === 'slow') {
    intervalMs = 5000;
  }

  useAutoAdvanceCarousel(containerRef, {
    enabled: options.enabled,
    intervalMs,
    pauseOnInteraction: true,
    resumeDelay: options.resumeDelay ?? 6000,
    minItems: 4
  });
}
