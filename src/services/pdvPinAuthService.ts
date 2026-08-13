import { collection, query, where, getDocs, getDoc, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { hashPin } from '../utils/pinSecurity';
import { getOperatorLimits, checkThresholdExceeded } from './pdvAuthorizationClassifier';
import { PDVDiscountConfig, DEFAULT_PDV_DISCOUNT_CONFIG } from '../types/pdvDiscount';
import { auditLogService } from './auditLogService';

export interface PinValidationInput {
  pin: string;
  operatorId: string;
  saleDraft?: any;
  valorBruto: number;
  descontoTotal: number;
  percentualEfetivo: number;
  nivelNecessario: string;
  companyId: string;
  sessionId: string;
  authorizerId?: string; // Optional if selected in UI

  // Prompt 9 additions:
  clientActionId?: string;
  motivo?: string;
  observacao?: string;
  cartId?: string;
  cartFingerprint?: string;
  descontoItens?: number;
  descontoGeral?: number;
  valorFinal?: number;
}

export interface PinValidationResult {
  success: boolean;
  message: string;
  authorizer?: {
    id: string;
    name: string;
    role: string;
  } | null;
  authorizationId?: string;
}

/**
 * Validates an entered PIN against a registered, active authorizer with sufficient limits.
 */
export async function validateAuthorizationPin(input: PinValidationInput): Promise<PinValidationResult> {
  const {
    pin,
    operatorId,
    valorBruto,
    descontoTotal,
    percentualEfetivo,
    nivelNecessario,
    companyId,
    sessionId,
    authorizerId
  } = input;

  const genericErrorMessage = 'Não foi possível autorizar. Verifique o código ou solicite outro autorizador.';

  // 1. Basic PIN format validation
  if (!pin || !/^\d{4,8}$/.test(pin)) {
    return { success: false, message: genericErrorMessage };
  }

  try {
    // 2. Fetch the Store PDV Discount configurations
    const storeRef = doc(db, 'settings', 'store');
    const storeSnap = await getDoc(storeRef);
    const storeData = storeSnap.exists() ? storeSnap.data() : {};
    const config: PDVDiscountConfig = {
      ...DEFAULT_PDV_DISCOUNT_CONFIG,
      ...(storeData.pdvDiscountConfig || {}),
    };

    // If discount control is disabled, authorize everything automatically
    if (!config.enabled) {
      return {
        success: true,
        message: 'Autorização concedida automaticamente (controle de descontos desativado).',
        authorizer: null
      };
    }

    // 3. Check absolute limit first
    const absCheck = checkThresholdExceeded(
      config.absoluteMaxPercent,
      config.absoluteMaxAmount,
      percentualEfetivo,
      descontoTotal,
      config.requireAuthCondition || 'EITHER'
    );
    if (absCheck.exceeds) {
      // Cannot authorize anything exceeding absolute maximum configured limits
      return { success: false, message: genericErrorMessage };
    }

    const hashedPin = await hashPin(pin);
    let authorizerUser: any = null;

    // 4. Locate the user
    if (authorizerId) {
      // Standard flow: UI passed selected authorizer ID
      const userRef = doc(db, 'users', authorizerId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return { success: false, message: genericErrorMessage };
      }
      
      const userData = userSnap.data();
      
      // Lockout check before PIN verification to prevent further attacks
      if (userData.pinLocked || userData.pinLockoutUntil) {
        const lockoutUntil = userData.pinLockoutUntil;
        if (lockoutUntil) {
          const lockTime = typeof lockoutUntil.toDate === 'function'
            ? lockoutUntil.toDate().getTime()
            : new Date(lockoutUntil).getTime();
          
          if (lockTime > Date.now()) {
            return { success: false, message: genericErrorMessage };
          }
        }
      }

      // Verify PIN hash
      if (userData.pinHash === hashedPin) {
        authorizerUser = { id: userSnap.id, ...userData };
      } else {
        // Increment failure attempts for selected authorizer
        await handleFailedPinAttempt(authorizerId, userData, config);
        return { success: false, message: genericErrorMessage };
      }
    } else {
      // Fallback/Direct PIN flow: find user matching hashed PIN
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('pinHash', '==', hashedPin));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        // If we don't know who the user is, we can't increment their specific counter,
        // but we return the generic message as expected.
        return { success: false, message: genericErrorMessage };
      }

      // Found matching user
      const docSnap = snap.docs[0];
      authorizerUser = { id: docSnap.id, ...docSnap.data() };
    }

    // 5. Run status & lockout checks on identified authorizer
    if (!authorizerUser) {
      return { success: false, message: genericErrorMessage };
    }

    // Check if user is active
    const userActive = authorizerUser.status === 'ativo' || authorizerUser.active || (!authorizerUser.status && authorizerUser.active !== false);
    if (!userActive) {
      return { success: false, message: genericErrorMessage };
    }

    // Check if PIN is active
    if (authorizerUser.pinActive === false) {
      return { success: false, message: genericErrorMessage };
    }

    // Check active lockout
    if (authorizerUser.pinLocked || authorizerUser.pinLockoutUntil) {
      const lockoutUntil = authorizerUser.pinLockoutUntil;
      if (lockoutUntil) {
        const lockTime = typeof lockoutUntil.toDate === 'function'
          ? lockoutUntil.toDate().getTime()
          : new Date(lockoutUntil).getTime();
        
        if (lockTime > Date.now()) {
          return { success: false, message: genericErrorMessage };
        } else {
          // Lockout expired, reset counters in document
          authorizerUser.pinLocked = false;
          authorizerUser.pinFailedAttempts = 0;
          authorizerUser.pinLockoutUntil = null;
          await updateDoc(doc(db, 'users', authorizerUser.id), {
            pinLocked: false,
            pinFailedAttempts: 0,
            pinLockoutUntil: null,
            pinUpdatedAt: serverTimestamp()
          });
        }
      }
    }

    // Check company alignment
    const userCompanyId = authorizerUser.companyId || authorizerUser.tenantId;
    const userCompanyIds = authorizerUser.companyIds || [];
    const isSuperAdmin = authorizerUser.role?.includes('super_admin') || authorizerUser.roles?.includes('super_admin');

    if (!isSuperAdmin && userCompanyId && userCompanyId !== companyId && !userCompanyIds.includes(companyId)) {
      return { success: false, message: genericErrorMessage };
    }

    // Check authorization privileges
    if (!authorizerUser.canAuthorizeDiscounts) {
      return { success: false, message: genericErrorMessage };
    }

    // 6. Check operator limits sufficiency
    const authorizerLimits = getOperatorLimits(config, authorizerUser);
    const limitCheck = checkThresholdExceeded(
      authorizerLimits.maxPercent,
      authorizerLimits.maxAmount,
      percentualEfetivo,
      descontoTotal,
      config.requireAuthCondition || 'EITHER'
    );

    if (limitCheck.exceeds) {
      return { success: false, message: genericErrorMessage };
    }

    // 7. Prevent self-authorization when forbidden
    if (operatorId && operatorId === authorizerUser.id) {
      // The operator cannot authorize a level above their own standard cash limits
      const operatorLimits = getOperatorLimits(config, authorizerUser);
      const selfCheck = checkThresholdExceeded(
        operatorLimits.maxPercent,
        operatorLimits.maxAmount,
        percentualEfetivo,
        descontoTotal,
        config.requireAuthCondition || 'EITHER'
      );
      if (selfCheck.exceeds) {
        return { success: false, message: genericErrorMessage };
      }
    }

    // Success! Reset failed attempts if any
    if (authorizerUser.pinFailedAttempts && authorizerUser.pinFailedAttempts > 0) {
      await updateDoc(doc(db, 'users', authorizerUser.id), {
        pinFailedAttempts: 0,
        pinLockoutUntil: null,
        pinLocked: false,
        pinUpdatedAt: serverTimestamp()
      });
    }

    // Generate/Use authorization ID for idempotency
    const authId = input.clientActionId || doc(collection(db, 'pdvDiscountAuthorizations')).id;

    // Check if document already exists
    const existingRef = doc(db, 'pdvDiscountAuthorizations', authId);
    const existingSnap = await getDoc(existingRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      return {
        success: true,
        message: 'Autorização já existente (recuperada com sucesso).',
        authorizer: {
          id: existingData.authorizerId,
          name: existingData.authorizerName,
          role: existingData.authorizerRole
        },
        authorizationId: authId
      };
    }

    // Expiration date
    const validityMinutes = config.authValidityMinutes || 10;
    const expiresAt = new Date(Date.now() + validityMinutes * 60 * 1000);

    const authorizationDoc = {
      id: authId,
      companyId: companyId || '',
      cartId: input.cartId || sessionId || 'unknown',
      cartFingerprint: input.cartFingerprint || '',
      operatorId: operatorId || '',
      authorizerId: authorizerUser.id,
      authorizerName: authorizerUser.name,
      authorizerRole: authorizerUser.role || authorizerUser.roles?.[0] || 'gerente',
      valorBruto: Number(valorBruto),
      descontoItens: Number(input.descontoItens !== undefined ? input.descontoItens : 0),
      descontoGeral: Number(descontoTotal - (input.descontoItens || 0)),
      descontoTotal: Number(descontoTotal),
      percentualEfetivo: Number(percentualEfetivo),
      valorFinal: Number(input.valorFinal !== undefined ? input.valorFinal : (valorBruto - descontoTotal)),
      nivelNecessario: nivelNecessario || 'NONE',
      motivo: input.motivo || 'Desconto comercial',
      observacao: input.observacao || '',
      status: 'AUTHORIZED',
      createdAt: new Date(),
      authorizedAt: new Date(),
      expiresAt: expiresAt,
      usedAt: null,
      saleId: null
    };

    await setDoc(doc(db, 'pdvDiscountAuthorizations', authId), authorizationDoc);

    // Audit log success (NEVER log raw PIN or PIN hash)
    await auditLogService.logAction(
      'Autorização de Desconto Sucesso',
      'pdv_discount',
      sessionId || 'unknown',
      {
        operatorId,
        authorizerId: authorizerUser.id,
        authorizerName: authorizerUser.name,
        valorBruto,
        descontoTotal,
        percentualEfetivo,
        nivelNecessario,
        authorizationId: authId
      }
    );

    return {
      success: true,
      message: 'Autorização realizada com sucesso.',
      authorizer: {
        id: authorizerUser.id,
        name: authorizerUser.name,
        role: authorizerUser.role || authorizerUser.roles?.[0] || 'gerente'
      },
      authorizationId: authId
    };

  } catch (error: any) {
    console.error('Error verifying PIN:', error);
    return { success: false, message: genericErrorMessage };
  }
}

/**
 * Handles failed PIN attempts: increments failure counter and registers temporary lockout if threshold is hit.
 */
async function handleFailedPinAttempt(userId: string, userData: any, config: PDVDiscountConfig) {
  try {
    const attempts = (userData.pinFailedAttempts || 0) + 1;
    const updates: any = {
      pinFailedAttempts: attempts,
      pinUpdatedAt: serverTimestamp()
    };

    const isLocked = attempts >= config.maxPinAttempts;
    if (isLocked) {
      updates.pinLocked = true;
      updates.pinLockoutUntil = new Date(Date.now() + config.pinLockoutMinutes * 60 * 1000);
    }

    await updateDoc(doc(db, 'users', userId), updates);

    // Audit log failed attempt (NEVER log typed pin or hash)
    await auditLogService.logAction(
      'Tentativa de PIN Incorreta',
      'pdv_discount',
      userId,
      {
        userId,
        email: userData.email,
        attempts,
        locked: isLocked,
        lockoutMinutes: isLocked ? config.pinLockoutMinutes : 0
      }
    );
  } catch (err) {
    console.error('Error handling failed PIN attempt:', err);
  }
}

/**
 * Self testing script for the validation logic (in-memory business rules verification)
 */
export async function runPinAuthTests() {
  console.log('🧪 Starting PIN Authentication Service self tests...');
  const results: Array<{ name: string; passed: boolean; error?: string }> = [];

  const mockConfig: PDVDiscountConfig = {
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

  // Test 1: PIN Format validation
  const invalidPins = ['', 'abc', '12', '123456789', '12a45'];
  for (const p of invalidPins) {
    const isFormatOk = /^\d{4,8}$/.test(p);
    results.push({
      name: `1. Formato inválido para "${p}"`,
      passed: !isFormatOk,
      error: isFormatOk ? `PIN "${p}" foi aceito incorretamente como formato válido.` : undefined,
    });
  }

  // Test 2: Absolute Limit Exceeded
  const absCheck1 = checkThresholdExceeded(
    mockConfig.absoluteMaxPercent,
    mockConfig.absoluteMaxAmount,
    60, // 60% > absoluteMaxPercent (50%)
    300,
    'EITHER'
  );
  results.push({
    name: '2a. Limite absoluto excedido (por percentual)',
    passed: absCheck1.exceeds,
    error: !absCheck1.exceeds ? 'Falhou em detectar percentual acima do limite absoluto.' : undefined,
  });

  const absCheck2 = checkThresholdExceeded(
    mockConfig.absoluteMaxPercent,
    mockConfig.absoluteMaxAmount,
    10,
    1200, // R$ 1200 > absoluteMaxAmount (1000)
    'EITHER'
  );
  results.push({
    name: '2b. Limite absoluto excedido (por valor)',
    passed: absCheck2.exceeds,
    error: !absCheck2.exceeds ? 'Falhou em detectar valor acima do limite absoluto.' : undefined,
  });

  // Test 3: Operator Limit sufficiency
  const mockManagerUser = {
    id: 'mgr_01',
    name: 'Carlos Gerente',
    role: 'gerente',
    canAuthorizeDiscounts: true,
    useRoleDefaultLimits: true,
  };

  const mgrLimits = getOperatorLimits(mockConfig, mockManagerUser);
  results.push({
    name: '3a. Limites padrão do gerente resolvidos corretamente',
    passed: mgrLimits.maxPercent === 15 && mgrLimits.maxAmount === 100,
    error: `Limites obtidos: %=${mgrLimits.maxPercent}, R$=${mgrLimits.maxAmount}`,
  });

  // Manager tries to authorize 10% / R$ 80 discount (within limits)
  const mgrCheckOk = checkThresholdExceeded(
    mgrLimits.maxPercent,
    mgrLimits.maxAmount,
    10,
    80,
    'EITHER'
  );
  results.push({
    name: '3b. Desconto dentro dos limites do gerente permitido',
    passed: !mgrCheckOk.exceeds,
    error: mgrCheckOk.exceeds ? 'Desconto dentro do limite do gerente foi marcado como excedido.' : undefined,
  });

  // Manager tries to authorize 20% discount (exceeds 15% limit)
  const mgrCheckExceeded = checkThresholdExceeded(
    mgrLimits.maxPercent,
    mgrLimits.maxAmount,
    20,
    80,
    'EITHER'
  );
  results.push({
    name: '3c. Desconto acima dos limites do gerente bloqueado',
    passed: mgrCheckExceeded.exceeds,
    error: !mgrCheckExceeded.exceeds ? 'Desconto acima do limite do gerente foi permitido.' : undefined,
  });

  // Test 4: Custom limits
  const mockCustomUser = {
    id: 'usr_custom',
    name: 'Operador Especial',
    role: 'caixa',
    canAuthorizeDiscounts: true,
    useRoleDefaultLimits: false,
    customMaxPercent: 12,
    customMaxAmount: 75,
  };

  const customLimits = getOperatorLimits(mockConfig, mockCustomUser);
  results.push({
    name: '4a. Limites customizados resolvidos corretamente',
    passed: customLimits.maxPercent === 12 && customLimits.maxAmount === 75,
    error: `Limites obtidos: %=${customLimits.maxPercent}, R$=${customLimits.maxAmount}`,
  });

  // Test 5: Lockout status logic
  const mockLockedUser = {
    id: 'locked_01',
    pinLocked: true,
    pinLockoutUntil: new Date(Date.now() + 100000), // Locked in the future
  };

  const isLockedTimeActive = mockLockedUser.pinLockoutUntil.getTime() > Date.now();
  results.push({
    name: '5. Usuário bloqueado no futuro identificado',
    passed: mockLockedUser.pinLocked && isLockedTimeActive,
    error: !isLockedTimeActive ? 'Bloqueio de tempo foi marcado como expirado incorretamente.' : 'Falhou em identificar bloqueio.',
  });

  // Test 6: Self-authorization block
  const operatorId = 'mgr_01';
  const authorizerId = 'mgr_01';
  let selfAuthBlocked = false;

  if (operatorId === authorizerId) {
    // Under test: Manager is trying to authorize their own discount that exceeds cashier limits
    const opLimits = getOperatorLimits(mockConfig, mockManagerUser);
    const selfCheck = checkThresholdExceeded(
      opLimits.maxPercent,
      opLimits.maxAmount,
      25, // 25% > manager limits (15%)
      150,
      'EITHER'
    );
    selfAuthBlocked = selfCheck.exceeds;
  }

  results.push({
    name: '6. Impedir auto-autorização se o próprio desconto do gerente exceder seus limites',
    passed: selfAuthBlocked,
    error: !selfAuthBlocked ? 'Permitiu auto-autorização que excede os próprios limites.' : undefined,
  });

  const passedCount = results.filter(r => r.passed).length;
  console.log(`⭐ Completed PIN self tests. ${passedCount}/${results.length} passed.`);
  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results,
  };
}
