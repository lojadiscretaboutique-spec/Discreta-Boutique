import { PDVDiscountConfig, DiscountAuthCondition } from '../types/pdvDiscount';

export type AuthorizationLevel = 'NONE' | 'MANAGER' | 'ADMIN' | 'OWNER' | 'BLOCKED';

export interface OperatorDiscountProfile {
  role?: string;
  roles?: string[];
  canAuthorizeDiscounts?: boolean;
  useRoleDefaultLimits?: boolean;
  customMaxPercent?: number | null;
  customMaxAmount?: number | null;
}

export interface DiscountClassificationInput {
  config: PDVDiscountConfig;
  valorBruto: number;
  descontoTotal: number;
  percentualEfetivo: number;
  operator?: OperatorDiscountProfile;
}

export interface DiscountClassificationResult {
  level: AuthorizationLevel;
  requiresAuth: boolean;
  reason: string;
  descriptionMessage: string;
  exceededPercent: boolean;
  exceededAmount: boolean;
  operatorLimits: {
    maxPercent: number;
    maxAmount: number;
  };
}

const UI_MESSAGES: Record<AuthorizationLevel, string> = {
  NONE: 'Desconto permitido para este operador.',
  MANAGER: 'Autorização de gerente necessária.',
  ADMIN: 'Autorização de administrador necessária.',
  OWNER: 'Autorização de proprietário necessária.',
  BLOCKED: 'Desconto acima do limite máximo permitido.',
};

/**
 * Checks if values exceed given thresholds according to the configured auth condition.
 */
export function checkThresholdExceeded(
  maxPercent: number,
  maxAmount: number,
  percentualEfetivo: number,
  descontoTotal: number,
  condition: DiscountAuthCondition
): { exceeds: boolean; isPercentExceeded: boolean; isAmountExceeded: boolean } {
  // Use a small epsilon to avoid floating point issues (e.g. 5.000000001 vs 5.0)
  const isPercentExceeded = percentualEfetivo > (maxPercent + 0.001);
  const isAmountExceeded = descontoTotal > (maxAmount + 0.001);

  let exceeds = false;
  switch (condition) {
    case 'PERCENTAGE':
      exceeds = isPercentExceeded;
      break;
    case 'AMOUNT':
      exceeds = isAmountExceeded;
      break;
    case 'BOTH':
      exceeds = isPercentExceeded && isAmountExceeded;
      break;
    case 'EITHER':
    default:
      exceeds = isPercentExceeded || isAmountExceeded;
      break;
  }

  return { exceeds, isPercentExceeded, isAmountExceeded };
}

/**
 * Resolves operator's default or custom discount limits based on role and custom settings.
 */
export function getOperatorLimits(
  config: PDVDiscountConfig,
  operator?: OperatorDiscountProfile
): { maxPercent: number; maxAmount: number } {
  if (operator?.useRoleDefaultLimits === false) {
    const customPercent = operator.customMaxPercent;
    const customAmount = operator.customMaxAmount;
    if (typeof customPercent === 'number' || typeof customAmount === 'number') {
      return {
        maxPercent: typeof customPercent === 'number' ? customPercent : config.caixaMaxPercent,
        maxAmount: typeof customAmount === 'number' ? customAmount : config.caixaMaxAmount,
      };
    }
  }

  const role = (operator?.role || (operator?.roles && operator.roles[0]) || 'caixa').toLowerCase();

  if (role.includes('proprietario') || role.includes('super_admin') || role.includes('owner')) {
    return {
      maxPercent: config.proprietarioMaxPercent,
      maxAmount: config.proprietarioMaxAmount,
    };
  }
  if (role.includes('admin') || role.includes('administrador')) {
    return {
      maxPercent: config.adminMaxPercent,
      maxAmount: config.adminMaxAmount,
    };
  }
  if (role.includes('gerente') || role.includes('manager')) {
    return {
      maxPercent: config.gerenteMaxPercent,
      maxAmount: config.gerenteMaxAmount,
    };
  }

  // Default to Caixa limits
  return {
    maxPercent: config.caixaMaxPercent,
    maxAmount: config.caixaMaxAmount,
  };
}

/**
 * Classifies the required authorization level for a PDV discount operation.
 */
export function classifyDiscountAuthorization(
  input: DiscountClassificationInput
): DiscountClassificationResult {
  const { config, valorBruto, descontoTotal, percentualEfetivo, operator } = input;
  const condition = config.requireAuthCondition || 'EITHER';
  const opLimits = getOperatorLimits(config, operator);

  // 1. If discount or total is zero or config is disabled -> NONE
  if (!config.enabled || valorBruto <= 0 || descontoTotal <= 0) {
    return {
      level: 'NONE',
      requiresAuth: false,
      reason: 'Dentro dos limites permitidos',
      descriptionMessage: UI_MESSAGES.NONE,
      exceededPercent: false,
      exceededAmount: false,
      operatorLimits: opLimits,
    };
  }

  // 2. Check Absolute Maximum limit first
  const absCheck = checkThresholdExceeded(
    config.absoluteMaxPercent,
    config.absoluteMaxAmount,
    percentualEfetivo,
    descontoTotal,
    condition
  );

  if (absCheck.exceeds) {
    let reason = 'Ultrapassou limite absoluto';
    if (absCheck.isPercentExceeded && absCheck.isAmountExceeded) {
      reason = 'Ultrapassou ambos';
    } else if (absCheck.isPercentExceeded) {
      reason = 'Ultrapassou limite percentual';
    } else if (absCheck.isAmountExceeded) {
      reason = 'Ultrapassou limite em reais';
    }

    return {
      level: 'BLOCKED',
      requiresAuth: true,
      reason,
      descriptionMessage: UI_MESSAGES.BLOCKED,
      exceededPercent: absCheck.isPercentExceeded,
      exceededAmount: absCheck.isAmountExceeded,
      operatorLimits: opLimits,
    };
  }

  // 3. Check Operator limit
  const opCheck = checkThresholdExceeded(
    opLimits.maxPercent,
    opLimits.maxAmount,
    percentualEfetivo,
    descontoTotal,
    condition
  );

  if (!opCheck.exceeds) {
    return {
      level: 'NONE',
      requiresAuth: false,
      reason: 'Dentro dos limites permitidos',
      descriptionMessage: UI_MESSAGES.NONE,
      exceededPercent: false,
      exceededAmount: false,
      operatorLimits: opLimits,
    };
  }

  // Determine breach reason for operator
  let reason = 'Ultrapassou limite de desconto';
  if (opCheck.isPercentExceeded && opCheck.isAmountExceeded) {
    reason = 'Ultrapassou ambos';
  } else if (opCheck.isPercentExceeded) {
    reason = 'Ultrapassou limite percentual';
  } else if (opCheck.isAmountExceeded) {
    reason = 'Ultrapassou limite em reais';
  }

  // 4. Determine required Auth Level (MANAGER -> ADMIN -> OWNER -> BLOCKED)
  const mgrCheck = checkThresholdExceeded(
    config.gerenteMaxPercent,
    config.gerenteMaxAmount,
    percentualEfetivo,
    descontoTotal,
    condition
  );
  if (!mgrCheck.exceeds) {
    return {
      level: 'MANAGER',
      requiresAuth: true,
      reason,
      descriptionMessage: UI_MESSAGES.MANAGER,
      exceededPercent: opCheck.isPercentExceeded,
      exceededAmount: opCheck.isAmountExceeded,
      operatorLimits: opLimits,
    };
  }

  const adminCheck = checkThresholdExceeded(
    config.adminMaxPercent,
    config.adminMaxAmount,
    percentualEfetivo,
    descontoTotal,
    condition
  );
  if (!adminCheck.exceeds) {
    return {
      level: 'ADMIN',
      requiresAuth: true,
      reason,
      descriptionMessage: UI_MESSAGES.ADMIN,
      exceededPercent: opCheck.isPercentExceeded,
      exceededAmount: opCheck.isAmountExceeded,
      operatorLimits: opLimits,
    };
  }

  const ownerCheck = checkThresholdExceeded(
    config.proprietarioMaxPercent,
    config.proprietarioMaxAmount,
    percentualEfetivo,
    descontoTotal,
    condition
  );
  if (!ownerCheck.exceeds) {
    return {
      level: 'OWNER',
      requiresAuth: true,
      reason,
      descriptionMessage: UI_MESSAGES.OWNER,
      exceededPercent: opCheck.isPercentExceeded,
      exceededAmount: opCheck.isAmountExceeded,
      operatorLimits: opLimits,
    };
  }

  return {
    level: 'BLOCKED',
    requiresAuth: true,
    reason: 'Ultrapassou limite absoluto',
    descriptionMessage: UI_MESSAGES.BLOCKED,
    exceededPercent: opCheck.isPercentExceeded,
    exceededAmount: opCheck.isAmountExceeded,
    operatorLimits: opLimits,
  };
}

/**
 * Test suite runner for Authorization Classifier
 */
export function runAuthorizationClassifierTests() {
  const results: { name: string; passed: boolean; error?: string }[] = [];

  const testConfig: PDVDiscountConfig = {
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
    absoluteMaxAmount: 500,
    requireAuthCondition: 'EITHER',
    requireReason: true,
    requireNoteAbovePercent: 10,
    blockBelowCost: true,
    authValidityMinutes: 10,
    maxPinAttempts: 3,
    pinLockoutMinutes: 5,
    invalidateOnCartChange: true,
  };

  // 1. Dentro do limite do caixa -> NONE
  const res1 = classifyDiscountAuthorization({
    config: testConfig,
    valorBruto: 100,
    descontoTotal: 4,
    percentualEfetivo: 4,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '1. Dentro do limite do caixa (NONE)',
    passed: res1.level === 'NONE' && !res1.requiresAuth && res1.descriptionMessage === 'Desconto permitido para este operador.',
    error: res1.level !== 'NONE' ? `Obtido level=${res1.level}` : undefined,
  });

  // 2. Acima do caixa e dentro do gerente -> MANAGER
  const res2 = classifyDiscountAuthorization({
    config: testConfig,
    valorBruto: 200,
    descontoTotal: 20,
    percentualEfetivo: 10,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '2. Acima do caixa e dentro do gerente (MANAGER)',
    passed: res2.level === 'MANAGER' && res2.requiresAuth && res2.descriptionMessage === 'Autorização de gerente necessária.',
    error: res2.level !== 'MANAGER' ? `Obtido level=${res2.level}` : undefined,
  });

  // 3. Acima do gerente e dentro do administrador -> ADMIN
  const res3 = classifyDiscountAuthorization({
    config: testConfig,
    valorBruto: 500,
    descontoTotal: 125,
    percentualEfetivo: 25,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '3. Acima do gerente e dentro do administrador (ADMIN)',
    passed: res3.level === 'ADMIN' && res3.descriptionMessage === 'Autorização de administrador necessária.',
    error: res3.level !== 'ADMIN' ? `Obtido level=${res3.level}` : undefined,
  });

  // 4. Acima do administrador e dentro do proprietário -> OWNER
  const res4 = classifyDiscountAuthorization({
    config: testConfig,
    valorBruto: 800,
    descontoTotal: 320,
    percentualEfetivo: 40,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '4. Acima do administrador e dentro do proprietário (OWNER)',
    passed: res4.level === 'OWNER' && res4.descriptionMessage === 'Autorização de proprietário necessária.',
    error: res4.level !== 'OWNER' ? `Obtido level=${res4.level}` : undefined,
  });

  // 5. Acima do limite absoluto -> BLOCKED
  const res5 = classifyDiscountAuthorization({
    config: testConfig,
    valorBruto: 1000,
    descontoTotal: 600,
    percentualEfetivo: 60,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '5. Acima do limite absoluto (BLOCKED)',
    passed: res5.level === 'BLOCKED' && res5.descriptionMessage === 'Desconto acima do limite máximo permitido.',
    error: res5.level !== 'BLOCKED' ? `Obtido level=${res5.level}` : undefined,
  });

  // 6. Teste de Condições: PERCENTAGE vs AMOUNT vs EITHER vs BOTH
  const pctOnlyConfig = { ...testConfig, requireAuthCondition: 'PERCENTAGE' as DiscountAuthCondition };
  const resPct = classifyDiscountAuthorization({
    config: pctOnlyConfig,
    valorBruto: 1000,
    descontoTotal: 30, // Exceeds caixaMaxAmount (20) but percent (3%) is within caixaMaxPercent (5%)
    percentualEfetivo: 3,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '6a. Condição PERCENTAGE (respeita apenas %)',
    passed: resPct.level === 'NONE',
    error: resPct.level !== 'NONE' ? `Obtido level=${resPct.level}` : undefined,
  });

  const bothConfig = { ...testConfig, requireAuthCondition: 'BOTH' as DiscountAuthCondition };
  const resBoth = classifyDiscountAuthorization({
    config: bothConfig,
    valorBruto: 1000,
    descontoTotal: 30, // Exceeds amount (20), but percent (3%) does NOT exceed (5%)
    percentualEfetivo: 3,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '6b. Condição BOTH (exige violar ambos)',
    passed: resBoth.level === 'NONE',
    error: resBoth.level !== 'NONE' ? `Obtido level=${resBoth.level}` : undefined,
  });

  // 7. Testes de Motivo de Violação (reasons)
  const resReasonPct = classifyDiscountAuthorization({
    config: { ...testConfig, caixaMaxPercent: 5, caixaMaxAmount: 1000 },
    valorBruto: 100,
    descontoTotal: 10,
    percentualEfetivo: 10,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '7a. Motivo: Ultrapassou limite percentual',
    passed: resReasonPct.reason === 'Ultrapassou limite percentual',
    error: `Obtido reason="${resReasonPct.reason}"`,
  });

  const resReasonAmt = classifyDiscountAuthorization({
    config: { ...testConfig, caixaMaxPercent: 50, caixaMaxAmount: 15 },
    valorBruto: 100,
    descontoTotal: 20,
    percentualEfetivo: 20,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '7b. Motivo: Ultrapassou limite em reais',
    passed: resReasonAmt.reason === 'Ultrapassou limite em reais',
    error: `Obtido reason="${resReasonAmt.reason}"`,
  });

  const resReasonBoth = classifyDiscountAuthorization({
    config: { ...testConfig, caixaMaxPercent: 5, caixaMaxAmount: 15 },
    valorBruto: 100,
    descontoTotal: 20,
    percentualEfetivo: 20,
    operator: { role: 'caixa' },
  });
  results.push({
    name: '7c. Motivo: Ultrapassou ambos',
    passed: resReasonBoth.reason === 'Ultrapassou ambos',
    error: `Obtido reason="${resReasonBoth.reason}"`,
  });

  const passedCount = results.filter(r => r.passed).length;
  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results,
  };
}

/**
 * Helper function called by AdminPDV to classify discounts
 */
export function classifyPdvDiscount(
  config: PDVDiscountConfig,
  percentualEfetivo: number,
  descontoTotal: number,
  operator?: OperatorDiscountProfile | null
) {
  const result = classifyDiscountAuthorization({
    config,
    valorBruto: percentualEfetivo > 0 ? (descontoTotal / (percentualEfetivo / 100)) : 0,
    descontoTotal,
    percentualEfetivo,
    operator: operator || undefined
  });
  return {
    needsAuthorization: result.requiresAuth,
    requiredLevel: result.level,
    exceedsAbsolute: result.level === 'BLOCKED'
  };
}
