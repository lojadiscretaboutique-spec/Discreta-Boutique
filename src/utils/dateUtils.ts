/**
 * Utility functions for safely parsing and formatting Firebase Timestamps,
 * Date instances, ISO strings, or numbers across Discreta Boutique.
 */

export function parseSafeDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Handle Firebase Timestamp object (with toDate method)
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    try {
      const d = (value as any).toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }

  // Handle object with seconds property (raw Firestore timestamp representation)
  if (typeof value === 'object' && value !== null && 'seconds' in value && typeof (value as any).seconds === 'number') {
    try {
      const d = new Date((value as any).seconds * 1000);
      return !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }

  // Handle string or number
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return !isNaN(d.getTime()) ? d : null;
  }

  return null;
}

export function formatSafeDate(value: unknown, options?: Intl.DateTimeFormatOptions, locale = 'pt-BR'): string {
  const d = parseSafeDate(value);
  if (!d) return '-';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
  } catch {
    return d.toLocaleDateString(locale);
  }
}
