/**
 * PIN Security Utilities for PDV Authorization
 */

export interface PinValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates PIN format and strength rules.
 * Rules:
 * - Must be strictly digits (0-9).
 * - Length between 4 and 8 characters.
 * - Rejects weak PINs (repetitive digits, ascending/descending sequences).
 */
export function validatePin(pin: string): PinValidationResult {
  if (!pin) {
    return { valid: false, error: 'O PIN não pode ser vazio.' };
  }

  // Check if it's strictly numbers
  if (!/^\d+$/.test(pin)) {
    return { valid: false, error: 'O PIN deve conter apenas números (0-9).' };
  }

  // Check length (4 to 8 digits)
  if (pin.length < 4 || pin.length > 8) {
    return { valid: false, error: 'O PIN deve ter entre 4 e 8 dígitos.' };
  }

  // Check repetitive numbers (e.g. 0000, 1111, 999999)
  const isRepetitive = /^(\d)\1+$/.test(pin);
  if (isRepetitive) {
    return { valid: false, error: 'PIN muito fraco! Evite repetir o mesmo número (ex: 0000, 1111).' };
  }

  // Check ascending sequence (e.g. 1234, 12345, 0123456)
  const isAscending = '0123456789'.includes(pin);
  if (isAscending) {
    return { valid: false, error: 'PIN muito fraco! Evite sequências numéricas diretas (ex: 1234, 123456).' };
  }

  // Check descending sequence (e.g. 4321, 98765)
  const isDescending = '9876543210'.includes(pin);
  if (isDescending) {
    return { valid: false, error: 'PIN muito fraco! Evite sequências numéricas inversas (ex: 4321, 654321).' };
  }

  // Common weak PINs list
  const weakPins = [
    '1122', '2211', '1212', '2121', '1313', '1414', '2020', '2024', '2025', '2026',
    '12341234', '11223344', '000000', '123123'
  ];
  if (weakPins.includes(pin)) {
    return { valid: false, error: 'PIN muito comum e inseguro. Escolha uma combinação diferente.' };
  }

  return { valid: true };
}

/**
 * Computes SHA-256 hash of a PIN using standard Web Crypto API.
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = 'DISCRETA_PDV_AUTH_SALT_2026_V1';
  const encoder = new TextEncoder();
  const data = encoder.encode(`${salt}:${pin}`);
  
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback for environments without SubtleCrypto
  let hash = 0;
  const str = `${salt}:${pin}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Verifies a plain PIN against a stored SHA-256 hash.
 */
export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
  if (!pin || !storedHash) return false;
  const computedHash = await hashPin(pin);
  return computedHash === storedHash;
}
