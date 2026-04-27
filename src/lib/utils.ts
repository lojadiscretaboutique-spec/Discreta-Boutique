import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

/**
 * Rounds a number to exactly 2 decimal places to avoid floating point precision issues.
 */
export function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export const PLACEHOLDER_IMAGE = "https://picsum.photos/seed/placeholder/600/800";

export function getDateFromTimestamp(timestamp: unknown): Date {
  if (!timestamp) return new Date();
  
  if (typeof timestamp === 'object' && timestamp !== null) {
      const ts = timestamp as Record<string, unknown>;
      if (typeof ts.toDate === 'function') return ts.toDate() as Date;
      if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  }
  
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
  return new Date();
}
