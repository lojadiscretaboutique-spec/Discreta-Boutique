export interface RoulettePrize {
  id: string;
  name: string;
  type: 'PRODUCT' | 'CUSTOM';
  productId?: string;
  costPrice: number;
  retailPrice: number;
  stock?: number;
  color?: string;
}

export interface RouletteConfig {
  name: string;
  active: boolean;
  minPurchaseValue: number; // Valor mínimo da compra para girar
  hitRatePercentage: number; // Padrão: 10% de chance
  multiplierRequired: number; // Padrão: 10x o custo do produto
  prizeSelectionMode: 'AUTO_PRODUCTS' | 'MANUAL';
  maxProductCost: number; // Preço de custo máximo ao puxar produtos (ex: R$ 25)
  autoProductsCount: number; // Quantidade de produtos para sortear (ex: 6)
  manualPrizes: RoulettePrize[];
  losingPhrases: string[];
  accumulatedRevenueSinceLastWin: number; // Renda acumulada para garantia de margem
  totalSpinsCount: number;
  totalWinsCount: number;
  totalPrizesCostAwarded: number;
  soundEnabled: boolean;
  updatedAt?: string;
}

export interface RouletteSpinRecord {
  id: string;
  orderId: string;
  orderTotal: number;
  customerName?: string;
  customerWhatsapp?: string;
  resultType: 'WIN' | 'LOSS';
  prizeWon?: string;
  prizeCost?: number;
  phraseLanded?: string;
  createdAt: string;
}

export interface WheelSlice {
  id: string;
  label: string;
  isWin: boolean;
  prize?: RoulettePrize;
  color: string;
  textColor: string;
}
