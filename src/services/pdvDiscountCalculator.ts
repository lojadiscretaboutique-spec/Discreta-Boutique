/**
 * Central Discount Calculation Service for PDV (Pos Terminal)
 *
 * Handles accurate monetary calculations in integer cents to avoid floating-point
 * rounding errors, calculates item-level discounts, global discounts, manual price
 * reductions, accumulated discount totals, effective discount percentages, and
 * final order values.
 */

export interface DiscountItemInput {
  price: number;              // Current unit selling price
  quantity: number;           // Item quantity
  discount?: number;          // Specific line item discount in R$
  originalPrice?: number;     // Original unit price if unit price was manually edited
}

export interface DiscountCalculationInput {
  items: DiscountItemInput[];
  globalDiscount?: number;             // Explicit calculated global discount in R$
  globalDiscountType?: 'value' | 'percent'; // 'value' (R$) or 'percent' (%)
  globalDiscountValue?: number;        // Raw user input value for global discount
  manualReductions?: number;          // Additional manual price reductions in R$
}

export interface DiscountCalculationResult {
  valorBruto: number;           // Gross total before any discounts (R$)
  descontoItens: number;        // Total item-level discounts + price overrides (R$)
  descontoGeral: number;        // Global cart discount (R$)
  reducoesManuais: number;      // Manual price reductions (R$)
  descontoTotal: number;        // Accumulated total discount (R$)
  descontoTotalEfetivo: number; // Effective discount applied to order (capped at valorBruto) (R$)
  percentualEfetivo: number;    // Effective accumulated discount percentage (%)
  valorFinal: number;           // Final order total to pay (R$) (clamped at 0)
  hasExcessDiscount: boolean;   // True if total discount exceeds gross value
  cents: {
    valorBruto: number;
    descontoItens: number;
    descontoGeral: number;
    reducoesManuais: number;
    descontoTotal: number;
    descontoTotalEfetivo: number;
    valorFinal: number;
  };
}

/**
 * Converts monetary Real amount to integer cents.
 */
export function toCents(amount: number | null | undefined): number {
  if (!amount || isNaN(amount) || !isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

/**
 * Converts integer cents back to monetary Real amount rounded to 2 decimals.
 */
export function fromCents(cents: number): number {
  if (!cents || isNaN(cents) || !isFinite(cents)) return 0;
  return Number((cents / 100).toFixed(2));
}

/**
 * Rounds a number to 2 decimal places.
 */
export function roundTo2(value: number): number {
  if (!value || isNaN(value) || !isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Central Discount Calculation Function
 *
 * Combines item discounts, global discounts, and manual reductions together
 * to calculate the true accumulated discount and effective discount percentage.
 */
export function calculatePdvDiscounts(input: DiscountCalculationInput): DiscountCalculationResult {
  const items = input.items || [];

  // 1. Calculate Gross Total and Item Discounts in Cents
  let valorBrutoCents = 0;
  let descontoItensCents = 0;

  for (const item of items) {
    const qty = Math.max(0, item.quantity || 0);
    const currentPriceCents = toCents(item.price);
    const origPriceCents = item.originalPrice !== undefined ? toCents(item.originalPrice) : currentPriceCents;

    // Use higher of originalPrice or currentPrice as gross unit base
    const baseUnitPriceCents = Math.max(currentPriceCents, origPriceCents);
    const lineGrossCents = baseUnitPriceCents * qty;
    valorBrutoCents += lineGrossCents;

    // Item discount = explicit line discount + price override difference
    const lineDiscountCents = toCents(item.discount);
    const overrideDifferenceCents = Math.max(0, (origPriceCents - currentPriceCents) * qty);
    
    descontoItensCents += lineDiscountCents + overrideDifferenceCents;
  }

  // 2. Calculate Manual Reductions in Cents
  const reducoesManuaisCents = valorBrutoCents > 0 ? Math.max(0, toCents(input.manualReductions)) : 0;

  // 3. Calculate Global Discount in Cents
  let descontoGeralCents = 0;

  if (valorBrutoCents > 0) {
    if (input.globalDiscount !== undefined && input.globalDiscount > 0) {
      descontoGeralCents = Math.max(0, toCents(input.globalDiscount));
    } else if (input.globalDiscountValue && input.globalDiscountValue > 0) {
      if (input.globalDiscountType === 'percent') {
        const rawPercentCents = Math.round((valorBrutoCents * input.globalDiscountValue) / 100);
        descontoGeralCents = Math.max(0, rawPercentCents);
      } else {
        descontoGeralCents = Math.max(0, toCents(input.globalDiscountValue));
      }
    }
  }

  // 4. Calculate Total Accumulated Discount in Cents
  const descontoTotalCents = descontoItensCents + descontoGeralCents + reducoesManuaisCents;

  // 5. Check excess discount and clamp effective discount & final value
  const hasExcessDiscount = descontoTotalCents > valorBrutoCents;
  const descontoTotalEfetivoCents = Math.min(valorBrutoCents, descontoTotalCents);
  const valorFinalCents = Math.max(0, valorBrutoCents - descontoTotalCents);

  // 6. Calculate Effective Accumulated Percentage
  let percentualEfetivo = 0;
  if (valorBrutoCents > 0) {
    percentualEfetivo = roundTo2((descontoTotalCents / valorBrutoCents) * 100);
  }

  return {
    valorBruto: fromCents(valorBrutoCents),
    descontoItens: fromCents(descontoItensCents),
    descontoGeral: fromCents(descontoGeralCents),
    reducoesManuais: fromCents(reducoesManuaisCents),
    descontoTotal: fromCents(descontoTotalCents),
    descontoTotalEfetivo: fromCents(descontoTotalEfetivoCents),
    percentualEfetivo,
    valorFinal: fromCents(valorFinalCents),
    hasExcessDiscount,
    cents: {
      valorBruto: valorBrutoCents,
      descontoItens: descontoItensCents,
      descontoGeral: descontoGeralCents,
      reducoesManuais: reducoesManuaisCents,
      descontoTotal: descontoTotalCents,
      descontoTotalEfetivo: descontoTotalEfetivoCents,
      valorFinal: valorFinalCents,
    }
  };
}

/**
 * Test Runner for PDV Discount Calculator
 * Validates all required test scenarios and returns a detailed execution report.
 */
export interface TestScenarioResult {
  name: string;
  passed: boolean;
  expected: any;
  actual: any;
  error?: string;
}

export function runPdvDiscountCalculatorTests(): {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  results: TestScenarioResult[];
} {
  const results: TestScenarioResult[] = [];

  const assertScenario = (
    name: string,
    input: DiscountCalculationInput,
    expected: {
      valorBruto: number;
      descontoItens: number;
      descontoGeral: number;
      descontoTotal: number;
      percentualEfetivo: number;
      valorFinal: number;
      hasExcessDiscount?: boolean;
    }
  ) => {
    try {
      const res = calculatePdvDiscounts(input);
      const passed =
        res.valorBruto === expected.valorBruto &&
        res.descontoItens === expected.descontoItens &&
        res.descontoGeral === expected.descontoGeral &&
        res.descontoTotal === expected.descontoTotal &&
        res.percentualEfetivo === expected.percentualEfetivo &&
        res.valorFinal === expected.valorFinal &&
        (expected.hasExcessDiscount === undefined || res.hasExcessDiscount === expected.hasExcessDiscount);

      results.push({
        name,
        passed,
        expected,
        actual: {
          valorBruto: res.valorBruto,
          descontoItens: res.descontoItens,
          descontoGeral: res.descontoGeral,
          descontoTotal: res.descontoTotal,
          percentualEfetivo: res.percentualEfetivo,
          valorFinal: res.valorFinal,
          hasExcessDiscount: res.hasExcessDiscount,
        },
        error: passed ? undefined : `Mismatch in output values`,
      });
    } catch (e: any) {
      results.push({
        name,
        passed: false,
        expected,
        actual: null,
        error: e?.message || String(e),
      });
    }
  };

  // Test 1: Venda sem desconto
  assertScenario(
    '1. Venda sem desconto',
    {
      items: [
        { price: 100, quantity: 2 }, // 200
        { price: 50, quantity: 1 }   // 50 -> total 250
      ]
    },
    {
      valorBruto: 250,
      descontoItens: 0,
      descontoGeral: 0,
      descontoTotal: 0,
      percentualEfetivo: 0,
      valorFinal: 250,
      hasExcessDiscount: false
    }
  );

  // Test 2: Desconto apenas em item
  assertScenario(
    '2. Desconto apenas em item',
    {
      items: [
        { price: 100, quantity: 1, discount: 15 }, // gross 100, desc 15
        { price: 50, quantity: 2, discount: 10 }   // gross 100, desc 10 -> total gross 200, item desc 25
      ]
    },
    {
      valorBruto: 200,
      descontoItens: 25,
      descontoGeral: 0,
      descontoTotal: 25,
      percentualEfetivo: 12.5,
      valorFinal: 175,
      hasExcessDiscount: false
    }
  );

  // Test 3: Desconto apenas no total
  assertScenario(
    '3. Desconto apenas no total (valor fixo R$)',
    {
      items: [
        { price: 150, quantity: 2 } // gross 300
      ],
      globalDiscount: 30
    },
    {
      valorBruto: 300,
      descontoItens: 0,
      descontoGeral: 30,
      descontoTotal: 30,
      percentualEfetivo: 10,
      valorFinal: 270,
      hasExcessDiscount: false
    }
  );

  // Test 4: Desconto em item e no total
  assertScenario(
    '4. Desconto em item e no total',
    {
      items: [
        { price: 100, quantity: 2, discount: 20 } // gross 200, desc 20
      ],
      globalDiscount: 30
    },
    {
      valorBruto: 200,
      descontoItens: 20,
      descontoGeral: 30,
      descontoTotal: 50,
      percentualEfetivo: 25,
      valorFinal: 150,
      hasExcessDiscount: false
    }
  );

  // Test 5: Desconto em dinheiro (R$)
  assertScenario(
    '5. Desconto em dinheiro (R$)',
    {
      items: [
        { price: 80, quantity: 1 } // gross 80
      ],
      globalDiscountType: 'value',
      globalDiscountValue: 12
    },
    {
      valorBruto: 80,
      descontoItens: 0,
      descontoGeral: 12,
      descontoTotal: 12,
      percentualEfetivo: 15,
      valorFinal: 68,
      hasExcessDiscount: false
    }
  );

  // Test 6: Desconto percentual (%)
  assertScenario(
    '6. Desconto percentual (%)',
    {
      items: [
        { price: 200, quantity: 1 } // gross 200
      ],
      globalDiscountType: 'percent',
      globalDiscountValue: 15 // 15% of 200 = 30
    },
    {
      valorBruto: 200,
      descontoItens: 0,
      descontoGeral: 30,
      descontoTotal: 30,
      percentualEfetivo: 15,
      valorFinal: 170,
      hasExcessDiscount: false
    }
  );

  // Test 7: Vários descontos pequenos
  assertScenario(
    '7. Vários descontos pequenos acumulados',
    {
      items: [
        { price: 10, quantity: 1, discount: 1 },
        { price: 10, quantity: 1, discount: 1 },
        { price: 10, quantity: 1, discount: 1 },
        { price: 10, quantity: 1, discount: 1 },
        { price: 10, quantity: 1, discount: 1 } // gross 50, item desc 5
      ],
      globalDiscount: 5 // global desc 5 -> total desc 10 (20%)
    },
    {
      valorBruto: 50,
      descontoItens: 5,
      descontoGeral: 5,
      descontoTotal: 10,
      percentualEfetivo: 20,
      valorFinal: 40,
      hasExcessDiscount: false
    }
  );

  // Test 8: Arredondamento (precisão de centavos)
  assertScenario(
    '8. Arredondamento e centavos',
    {
      items: [
        { price: 33.33, quantity: 3 } // gross 99.99
      ],
      globalDiscountType: 'percent',
      globalDiscountValue: 10 // 10% of 99.99 = 9.999 -> rounded to 10.00
    },
    {
      valorBruto: 99.99,
      descontoItens: 0,
      descontoGeral: 10,
      descontoTotal: 10,
      percentualEfetivo: 10.00,
      valorFinal: 89.99,
      hasExcessDiscount: false
    }
  );

  // Test 9: Carrinho vazio
  assertScenario(
    '9. Carrinho vazio',
    {
      items: [],
      globalDiscount: 10
    },
    {
      valorBruto: 0,
      descontoItens: 0,
      descontoGeral: 0,
      descontoTotal: 0,
      percentualEfetivo: 0,
      valorFinal: 0,
      hasExcessDiscount: false
    }
  );

  // Test 10: Desconto maior que o valor da venda
  assertScenario(
    '10. Desconto maior que o valor da venda',
    {
      items: [
        { price: 100, quantity: 1, discount: 60 } // gross 100, desc 60
      ],
      globalDiscount: 80 // desc 80 -> total desc 140 (140% of 100)
    },
    {
      valorBruto: 100,
      descontoItens: 60,
      descontoGeral: 80,
      descontoTotal: 140,
      percentualEfetivo: 140,
      valorFinal: 0, // Clamped at 0
      hasExcessDiscount: true
    }
  );

  const passedCount = results.filter(r => r.passed).length;

  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results
  };
}
