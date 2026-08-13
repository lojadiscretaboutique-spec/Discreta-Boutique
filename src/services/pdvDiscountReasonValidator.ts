import { PDVDiscountConfig, DiscountReasonModel } from '../types/pdvDiscount';

export interface DiscountReasonValidationInput {
  config: PDVDiscountConfig;
  hasDiscount: boolean;
  effectivePercent: number;
  discountReason: string;
  discountNote: string;
  reasonObj?: DiscountReasonModel | null;
}

export interface DiscountReasonValidationResult {
  isValid: boolean;
  reasonRequired: boolean;
  noteRequired: boolean;
  noteRequiredByPercent: boolean;
  noteRequiredByReason: boolean;
  missingReason: boolean;
  missingNote: boolean;
  errorMessage?: string;
}

const REASONS_REQUIRING_NOTES_NAMES = [
  'outro',
  'produto com pequena avaria',
  'compensação por problema no atendimento',
  'compensacao por problema no atendimento',
  'ajuste de preço autorizado',
  'ajuste de preco autorizado',
  'erro operacional',
];

const REASONS_REQUIRING_NOTES_CODES = [
  'OUTRO',
  'PEQUENA_AVARIA',
  'COMPENSACAO_ATENDIMENTO',
  'AJUSTE_PRECO_AUTORIZADO',
  'ERRO_OPERACIONAL',
];

/**
 * Validates whether the discount reason and observation note meet configuration rules.
 */
export function validateDiscountReasonAndNote(
  input: DiscountReasonValidationInput
): DiscountReasonValidationResult {
  const { config, hasDiscount, effectivePercent, discountReason, discountNote, reasonObj } = input;

  if (!hasDiscount || !config.enabled) {
    return {
      isValid: true,
      reasonRequired: false,
      noteRequired: false,
      noteRequiredByPercent: false,
      noteRequiredByReason: false,
      missingReason: false,
      missingNote: false,
    };
  }

  const trimmedReason = (discountReason || '').trim();
  const trimmedNote = (discountNote || '').trim();

  // Rule: Reason is required if config.requireReason is true
  const reasonRequired = Boolean(config.requireReason);
  const missingReason = reasonRequired && !trimmedReason;

  // Rule: Note required if reasonObj.requiresNotes is true, or if reason code/name matches mandatory list
  let noteRequiredByReason = false;

  if (reasonObj && typeof reasonObj.requiresNotes === 'boolean') {
    noteRequiredByReason = reasonObj.requiresNotes;
  } else {
    const lowerReason = trimmedReason.toLowerCase();
    noteRequiredByReason =
      REASONS_REQUIRING_NOTES_NAMES.some((name) => lowerReason.includes(name)) ||
      REASONS_REQUIRING_NOTES_CODES.includes(trimmedReason.toUpperCase());
  }

  // Rule: Note required if effective percent > requireNoteAbovePercent (when requireNoteAbovePercent > 0)
  const threshold = typeof config.requireNoteAbovePercent === 'number' ? config.requireNoteAbovePercent : 10;
  const noteRequiredByPercent = threshold > 0 && effectivePercent > threshold;

  const noteRequired = noteRequiredByReason || noteRequiredByPercent;
  const missingNote = noteRequired && !trimmedNote;

  let errorMessage: string | undefined = undefined;

  if (missingReason) {
    errorMessage = 'É necessário selecionar o motivo do desconto.';
  } else if (missingNote) {
    if (noteRequiredByReason && noteRequiredByPercent) {
      errorMessage = `Para este motivo de desconto e descontos acima de ${threshold}%, a observação é obrigatória.`;
    } else if (noteRequiredByReason) {
      errorMessage = `Para o motivo "${trimmedReason || 'selecionado'}", é obrigatório preencher a observação.`;
    } else {
      errorMessage = `Para descontos acima de ${threshold}%, é obrigatório preencher a observação.`;
    }
  }

  const isValid = !missingReason && !missingNote;

  return {
    isValid,
    reasonRequired,
    noteRequired,
    noteRequiredByPercent,
    noteRequiredByReason,
    missingReason,
    missingNote,
    errorMessage,
  };
}


/**
 * Test suite runner for Discount Reason & Observation Validation
 */
export function runReasonValidatorTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  const baseConfig: PDVDiscountConfig = {
    enabled: true,
    caixaMaxPercent: 5,
    caixaMaxAmount: 20,
    gerenteMaxPercent: 15,
    gerenteMaxAmount: 100,
    adminMaxPercent: 30,
    adminMaxAmount: 200,
    proprietarioMaxPercent: 50,
    proprietarioMaxAmount: 500,
    absoluteMaxPercent: 50,
    absoluteMaxAmount: 1000,
    requireAuthCondition: 'EITHER',
    requireReason: true,
    requireNoteAbovePercent: 10,
    blockBelowCost: true,
    authValidityMinutes: 10,
    maxPinAttempts: 3,
    pinLockoutMinutes: 5,
    invalidateOnCartChange: true,
  };

  // Test 1: Sem desconto -> Válido
  const res1 = validateDiscountReasonAndNote({
    config: baseConfig,
    hasDiscount: false,
    effectivePercent: 0,
    discountReason: '',
    discountNote: '',
  });
  results.push({
    name: '1. Sem desconto (Sempre Válido)',
    passed: res1.isValid && !res1.reasonRequired && !res1.noteRequired,
    error: !res1.isValid ? `Obtido isValid=${res1.isValid}` : undefined,
  });

  // Test 2: Com desconto, motivo exigido porém vazio -> Inválido
  const res2 = validateDiscountReasonAndNote({
    config: baseConfig,
    hasDiscount: true,
    effectivePercent: 5,
    discountReason: '',
    discountNote: '',
  });
  results.push({
    name: '2. Com desconto sem motivo quando requireReason=true (Inválido)',
    passed: !res2.isValid && res2.missingReason && res2.errorMessage === 'É necessário selecionar o motivo do desconto.',
    error: res2.isValid ? `Deveria ser inválido` : undefined,
  });

  // Test 3: Com desconto, motivo informado ("Cliente fidelizado"), % <= 10% -> Válido
  const res3 = validateDiscountReasonAndNote({
    config: baseConfig,
    hasDiscount: true,
    effectivePercent: 8,
    discountReason: 'Cliente fidelizado',
    discountNote: '',
  });
  results.push({
    name: '3. Motivo padrão "Cliente fidelizado" e 8% (Válido sem obs)',
    passed: res3.isValid && !res3.noteRequired,
    error: !res3.isValid ? `Erro: ${res3.errorMessage}` : undefined,
  });

  // Test 4: Com motivo "Outro" sem observação -> Inválido
  const res4 = validateDiscountReasonAndNote({
    config: baseConfig,
    hasDiscount: true,
    effectivePercent: 5,
    discountReason: 'Outro',
    discountNote: '',
  });
  results.push({
    name: '4. Motivo "Outro" sem observação (Inválido)',
    passed: !res4.isValid && res4.missingNote && res4.noteRequiredByReason,
    error: res4.isValid ? `Deveria exigir observação` : undefined,
  });

  // Test 5: Com motivo "Outro" e com observação -> Válido
  const res5 = validateDiscountReasonAndNote({
    config: baseConfig,
    hasDiscount: true,
    effectivePercent: 5,
    discountReason: 'Outro',
    discountNote: 'Cliente amigo do dono',
  });
  results.push({
    name: '5. Motivo "Outro" com observação (Válido)',
    passed: res5.isValid,
    error: !res5.isValid ? `Erro: ${res5.errorMessage}` : undefined,
  });

  // Test 6: Com desconto de 15% (> requireNoteAbovePercent: 10%) sem observação -> Inválido
  const res6 = validateDiscountReasonAndNote({
    config: baseConfig,
    hasDiscount: true,
    effectivePercent: 12,
    discountReason: 'Negociação autorizada',
    discountNote: '',
  });
  results.push({
    name: '6. Desconto de 12% (> 10%) sem observação (Inválido)',
    passed: !res6.isValid && res6.noteRequiredByPercent && res6.missingNote,
    error: res6.isValid ? `Deveria exigir observação por percentual` : undefined,
  });

  // Test 7: Com desconto de 15% (> 10%) COM observação -> Válido
  const res7 = validateDiscountReasonAndNote({
    config: baseConfig,
    hasDiscount: true,
    effectivePercent: 12,
    discountReason: 'Negociação autorizada',
    discountNote: 'Aprovado por fone',
  });
  results.push({
    name: '7. Desconto de 12% (> 10%) com observação (Válido)',
    passed: res7.isValid,
    error: !res7.isValid ? `Erro: ${res7.errorMessage}` : undefined,
  });

  const passedCount = results.filter((r) => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results,
  };
}
