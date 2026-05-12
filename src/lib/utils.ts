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

/**
 * Extracts and cleans the variant name, removing product prefix if present.
 * Example: "Product Name - Blue, M" -> "Blue, M"
 */
export function formatVariantName(name: string): string {
  if (!name) return '';
  if (name.includes(' - ')) {
    return name.split(' - ').slice(1).join(' - ');
  }
  return name;
}

/**
 * Normalizes text for search: removes accents, lowercase, removes extra spaces.
 */
export function normalizeSearchText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .trim()
    .replace(/\s+/g, " "); // Single spaces
}

/**
 * Generates variations (singular/plural) for a word.
 * Very basic Portuguese rules.
 */
export function getWordVariations(word: string): string[] {
  const w = normalizeSearchText(word);
  if (w.length < 3) return [w];

  const variations = new Set<string>();
  variations.add(w);

  // Simple plural -> singular / singular -> plural
  if (w.endsWith("s")) {
    variations.add(w.substring(0, w.length - 1));
  } else {
    variations.add(w + "s");
  }

  // Handle -ao / -oes
  if (w.endsWith("ao")) {
    variations.add(w.substring(0, w.length - 2) + "oes");
  } else if (w.endsWith("oes")) {
    variations.add(w.substring(0, w.length - 3) + "ao");
  }

  return Array.from(variations);
}
