/**
 * Utility to measure application performance metrics safely in development mode.
 */
export function measurePerformance(label: string, startTime: number): number {
  const duration = performance.now() - startTime;
  if (import.meta.env.DEV) {
    console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
  }
  return duration;
}
