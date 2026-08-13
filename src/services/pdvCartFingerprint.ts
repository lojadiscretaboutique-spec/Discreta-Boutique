import { DEFAULT_COMPANY_ID } from '../constants/company';

export interface CartFingerprintItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  discount?: number;
}

export interface CartFingerprintInput {
  items: CartFingerprintItem[];
  globalDiscountValue?: number;
  globalDiscountType?: 'value' | 'percent';
  globalDiscount?: number;
  manualReductions?: number;
  valorBruto: number;
  valorFinal: number;
  operatorId: string;
  companyId: string;
  cartId: string; // Cart/session identifier
}

/**
 * Deterministically generates a unique hash fingerprint of the cart contents.
 */
export async function generateCartFingerprint(input: CartFingerprintInput): Promise<string> {
  // 1. Sort the items by productId and variantId to guarantee stability
  const sortedItems = [...input.items].sort((a, b) => {
    const keyA = `${a.productId}_${a.variantId || ''}`;
    const keyB = `${b.productId}_${b.variantId || ''}`;
    return keyA.localeCompare(keyB);
  });

  // 2. Map items to clean fields (avoiding extra volatile property noise)
  const cleanItems = sortedItems.map(item => {
    const price = Number(item.price) || 0;
    const discount = Number(item.discount) || 0;
    const practicedPrice = Math.max(0, price - discount);
    
    return {
      productId: item.productId,
      variantId: item.variantId || '',
      quantity: Number(item.quantity) || 0,
      price,
      originalPrice: Number(item.originalPrice !== undefined ? item.originalPrice : price),
      discount,
      practicedPrice
    };
  });

  // 3. Construct the stable structured object
  const stateObj = {
    items: cleanItems,
    globalDiscountValue: Number(input.globalDiscountValue) || 0,
    globalDiscountType: input.globalDiscountType || 'value',
    globalDiscount: Number(input.globalDiscount) || 0,
    manualReductions: Number(input.manualReductions) || 0,
    valorBruto: Number(input.valorBruto) || 0,
    valorFinal: Number(input.valorFinal) || 0,
    operatorId: input.operatorId || '',
    companyId: input.companyId || '',
    cartId: input.cartId || ''
  };

  // 4. Serialize to deterministic JSON string
  const serialized = JSON.stringify(stateObj);

  // 5. Generate SHA-256 hash
  const salt = 'CART_FINGERPRINT_SALT_2026_V1';
  const dataString = `${salt}:${serialized}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);

  const cryptoObj = typeof window !== 'undefined' ? window.crypto : (globalThis as any).crypto;
  if (cryptoObj && cryptoObj.subtle) {
    try {
      const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback
    }
  }

  // Fallback for non-subtle crypto environments
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Validates a cart's contents against a known fingerprint on the backend or frontend.
 */
export async function validateCartFingerprint(
  input: CartFingerprintInput,
  expectedFingerprint: string
): Promise<boolean> {
  if (!expectedFingerprint) return false;
  const currentFingerprint = await generateCartFingerprint(input);
  return currentFingerprint === expectedFingerprint;
}

/**
 * Runs the Prompt 8 automated tests
 */
export async function runCartFingerprintTests() {
  console.log('🧪 Running Cart Fingerprint Tests...');
  const tests: Array<{ name: string; passed: boolean; details?: string }> = [];

  const baseInput: CartFingerprintInput = {
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 2, price: 100, originalPrice: 100, discount: 10 },
      { productId: 'p2', variantId: 'v2', quantity: 1, price: 50, originalPrice: 50, discount: 0 }
    ],
    globalDiscountValue: 5,
    globalDiscountType: 'value',
    globalDiscount: 5,
    manualReductions: 0,
    valorBruto: 250,
    valorFinal: 225,
    operatorId: 'op_01',
    companyId: DEFAULT_COMPANY_ID,
    cartId: 'cart_xyz123'
  };

  // Test A: Same cart generates same fingerprint
  const fp1 = await generateCartFingerprint(baseInput);
  const fp2 = await generateCartFingerprint({ ...baseInput });
  tests.push({
    name: 'Mesmo carrinho gera mesmo fingerprint',
    passed: fp1 === fp2,
    details: `fp1: ${fp1}, fp2: ${fp2}`
  });

  // Test B: Alterar quantidade muda o fingerprint
  const inputQuantityChanged = {
    ...baseInput,
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 3, price: 100, originalPrice: 100, discount: 10 },
      { productId: 'p2', variantId: 'v2', quantity: 1, price: 50, originalPrice: 50, discount: 0 }
    ]
  };
  const fpQuantity = await generateCartFingerprint(inputQuantityChanged);
  tests.push({
    name: 'Alterar quantidade muda o fingerprint',
    passed: fp1 !== fpQuantity,
    details: `fp1: ${fp1}, fpQuantity: ${fpQuantity}`
  });

  // Test C: Alterar desconto muda o fingerprint
  const inputDiscountChanged = {
    ...baseInput,
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 2, price: 100, originalPrice: 100, discount: 15 },
      { productId: 'p2', variantId: 'v2', quantity: 1, price: 50, originalPrice: 50, discount: 0 }
    ]
  };
  const fpDiscount = await generateCartFingerprint(inputDiscountChanged);
  tests.push({
    name: 'Alterar desconto muda o fingerprint',
    passed: fp1 !== fpDiscount
  });

  // Test D: Alterar preço muda o fingerprint
  const inputPriceChanged = {
    ...baseInput,
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 2, price: 110, originalPrice: 110, discount: 10 },
      { productId: 'p2', variantId: 'v2', quantity: 1, price: 50, originalPrice: 50, discount: 0 }
    ]
  };
  const fpPrice = await generateCartFingerprint(inputPriceChanged);
  tests.push({
    name: 'Alterar preço muda o fingerprint',
    passed: fp1 !== fpPrice
  });

  // Test E: Adicionar item muda o fingerprint
  const inputItemAdded = {
    ...baseInput,
    items: [
      ...baseInput.items,
      { productId: 'p3', quantity: 1, price: 30 }
    ]
  };
  const fpAdded = await generateCartFingerprint(inputItemAdded);
  tests.push({
    name: 'Adicionar item muda o fingerprint',
    passed: fp1 !== fpAdded
  });

  // Test F: Remover item muda o fingerprint
  const inputItemRemoved = {
    ...baseInput,
    items: [
      { productId: 'p1', variantId: 'v1', quantity: 2, price: 100, originalPrice: 100, discount: 10 }
    ]
  };
  const fpRemoved = await generateCartFingerprint(inputItemRemoved);
  tests.push({
    name: 'Remover item muda o fingerprint',
    passed: fp1 !== fpRemoved
  });

  // Test G: Mudar a ordem visual dos itens não deve alterar o fingerprint
  const inputOrderChanged = {
    ...baseInput,
    items: [
      { productId: 'p2', variantId: 'v2', quantity: 1, price: 50, originalPrice: 50, discount: 0 },
      { productId: 'p1', variantId: 'v1', quantity: 2, price: 100, originalPrice: 100, discount: 10 }
    ]
  };
  const fpOrder = await generateCartFingerprint(inputOrderChanged);
  tests.push({
    name: 'Mudar a ordem visual dos itens não altera o fingerprint',
    passed: fp1 === fpOrder
  });

  // Test H: Trocar operador muda o fingerprint
  const inputOperatorChanged = {
    ...baseInput,
    operatorId: 'op_02'
  };
  const fpOperator = await generateCartFingerprint(inputOperatorChanged);
  tests.push({
    name: 'Trocar operador muda o fingerprint',
    passed: fp1 !== fpOperator
  });

  const allPassed = tests.every(t => t.passed);
  console.log(`⭐ Completed Cart Fingerprint Tests. ${tests.filter(t => t.passed).length}/${tests.length} passed.`);
  return {
    allPassed,
    results: tests
  };
}
