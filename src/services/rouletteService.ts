import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc, 
  addDoc, 
  query, 
  where, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  RouletteConfig, 
  RoulettePrize, 
  RouletteSpinRecord, 
  WheelSlice 
} from '../types/roulette';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Roulette Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const CONFIG_DOC_PATH = 'settings/roulette_config';
const SPINS_COLLECTION = 'rouletteSpins';

export const DEFAULT_LOSING_PHRASES: string[] = [
  'Passou a vez 💨',
  'Não foi desta vez! 🍀',
  'Quem sabe na próxima! ✨',
  'Não foi hoje! 💋',
  'Tente de novo em breve! 🌟',
  'Quase! Foi por pouco! 🤏',
  'Mais sorte na próxima! 🌹',
  'Hoje não, mas valeu! 💫',
  'Raspou na trave! 🎯',
  'Continue brilhando! ✨',
  'Obrigado pela preferência! 💖',
  'Sorte no amor hoje! ❤️',
  'Passou pertinho! 🎲',
  'Gire na próxima compra! 🛍️',
  'Fica para a próxima! 🎀',
  'Energia positiva sempre! 🔮',
  'Valeu a tentativa! 🥂',
  'O destino reservou melhor! 💎',
  'Foi quase um prêmio! 🔥',
  'Não desanime, continue! 🌸'
];

export const DEFAULT_MANUAL_PRIZES: RoulettePrize[] = [
  { id: 'p1', name: 'Calcinha de Renda Exclusiva', type: 'CUSTOM', costPrice: 12, retailPrice: 29.90, color: '#dc2626' },
  { id: 'p2', name: 'Gel Beijável Hot/Ice', type: 'CUSTOM', costPrice: 14, retailPrice: 36.00, color: '#9333ea' },
  { id: 'p3', name: 'Vale R$ 20 em Compras', type: 'CUSTOM', costPrice: 18, retailPrice: 20.00, color: '#059669' },
  { id: 'p4', name: 'Óleo Corporal Perfumado', type: 'CUSTOM', costPrice: 16, retailPrice: 42.00, color: '#ea580c' },
];

export const DEFAULT_ROULETTE_CONFIG: RouletteConfig = {
  name: 'Roleta Premiada Discreta',
  active: true,
  minPurchaseValue: 50.00,
  hitRatePercentage: 10, // 10% de chance de acerto
  multiplierRequired: 10, // 10x o custo do produto em vendas acumuladas
  prizeSelectionMode: 'AUTO_PRODUCTS',
  maxProductCost: 25.00,
  autoProductsCount: 6,
  manualPrizes: DEFAULT_MANUAL_PRIZES,
  losingPhrases: DEFAULT_LOSING_PHRASES,
  accumulatedRevenueSinceLastWin: 0,
  totalSpinsCount: 0,
  totalWinsCount: 0,
  totalPrizesCostAwarded: 0,
  soundEnabled: true,
};

export const rouletteService = {
  // Subscribe to config in real time
  subscribeConfig(callback: (config: RouletteConfig) => void, onError?: (err: Error) => void) {
    const docRef = doc(db, 'settings', 'roulette_config');
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callback({
          ...DEFAULT_ROULETTE_CONFIG,
          ...data,
          losingPhrases: Array.isArray(data.losingPhrases) && data.losingPhrases.length > 0 
            ? data.losingPhrases 
            : DEFAULT_LOSING_PHRASES,
          manualPrizes: Array.isArray(data.manualPrizes) && data.manualPrizes.length > 0 
            ? data.manualPrizes 
            : DEFAULT_MANUAL_PRIZES,
        });
      } else {
        callback(DEFAULT_ROULETTE_CONFIG);
      }
    }, (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, CONFIG_DOC_PATH);
    });
  },

  // Get current config once
  async getConfig(): Promise<RouletteConfig> {
    try {
      const docRef = doc(db, 'settings', 'roulette_config');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          ...DEFAULT_ROULETTE_CONFIG,
          ...data,
          losingPhrases: Array.isArray(data.losingPhrases) && data.losingPhrases.length > 0 
            ? data.losingPhrases 
            : DEFAULT_LOSING_PHRASES,
          manualPrizes: Array.isArray(data.manualPrizes) && data.manualPrizes.length > 0 
            ? data.manualPrizes 
            : DEFAULT_MANUAL_PRIZES,
        };
      }
      return DEFAULT_ROULETTE_CONFIG;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, CONFIG_DOC_PATH);
    }
  },

  // Save config
  async saveConfig(config: Partial<RouletteConfig>): Promise<void> {
    try {
      const docRef = doc(db, 'settings', 'roulette_config');
      await setDoc(docRef, {
        ...config,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, CONFIG_DOC_PATH);
    }
  },

  // Reset accumulated revenue counter
  async resetAccumulatedRevenue(): Promise<void> {
    await this.saveConfig({ accumulatedRevenueSinceLastWin: 0 });
  },

  // Fetch products with stock > 0 and cost <= maxProductCost
  async getEligibleProducts(maxCost: number = 25, count: number = 6): Promise<RoulettePrize[]> {
    try {
      const q = query(
        collection(db, 'products'),
        where('active', '==', true),
        limit(50)
      );
      const snap = await getDocs(q);
      const candidates: RoulettePrize[] = [];

      snap.forEach(d => {
        const p = d.data();
        const costPrice = typeof p.costPrice === 'number' && p.costPrice > 0 
          ? p.costPrice 
          : (typeof p.price === 'number' ? p.price * 0.4 : 15);
        const stock = typeof p.stock === 'number' ? p.stock : 1;

        if (stock > 0 && costPrice <= maxCost) {
          candidates.push({
            id: d.id,
            productId: d.id,
            name: p.name || 'Produto Discreta',
            type: 'PRODUCT',
            costPrice: costPrice,
            retailPrice: p.price || costPrice * 2.5,
            stock: stock,
            color: '#dc2626'
          });
        }
      });

      // Shuffle and pick `count` products
      candidates.sort(() => Math.random() - 0.5);
      return candidates.slice(0, count);
    } catch (e) {
      console.warn('Fallback products for roulette:', e);
      return DEFAULT_MANUAL_PRIZES;
    }
  },

  // Build the complete wheel segments
  async buildWheelSlices(config: RouletteConfig): Promise<{
    slices: WheelSlice[];
    prizes: RoulettePrize[];
  }> {
    let prizes: RoulettePrize[] = [];

    if (config.prizeSelectionMode === 'AUTO_PRODUCTS') {
      prizes = await this.getEligibleProducts(config.maxProductCost, config.autoProductsCount);
      if (prizes.length === 0) {
        prizes = config.manualPrizes && config.manualPrizes.length > 0 
          ? config.manualPrizes 
          : DEFAULT_MANUAL_PRIZES;
      }
    } else {
      prizes = config.manualPrizes && config.manualPrizes.length > 0 
        ? config.manualPrizes 
        : DEFAULT_MANUAL_PRIZES;
    }

    const phrases = config.losingPhrases && config.losingPhrases.length > 0 
      ? config.losingPhrases 
      : DEFAULT_LOSING_PHRASES;

    // Pick 12 to 16 losing phrases
    const selectedPhrases = [...phrases].sort(() => Math.random() - 0.5).slice(0, 14);

    // Create wheel slices alternating prizes and encouraging losing phrases
    const slices: WheelSlice[] = [];
    const prizeColors = ['#e11d48', '#9333ea', '#ea580c', '#059669', '#2563eb', '#d97706'];
    const losingColors = ['#18181b', '#27272a'];

    const totalSlots = selectedPhrases.length + prizes.length;
    let prizeIdx = 0;
    let phraseIdx = 0;

    // Spread prizes evenly across the circle
    const prizeInterval = Math.max(2, Math.floor(totalSlots / prizes.length));

    for (let i = 0; i < totalSlots; i++) {
      if (i % prizeInterval === 0 && prizeIdx < prizes.length) {
        const p = prizes[prizeIdx];
        slices.push({
          id: `prize-${p.id}-${i}`,
          label: `🏆 ${p.name}`,
          isWin: true,
          prize: p,
          color: prizeColors[prizeIdx % prizeColors.length],
          textColor: '#ffffff'
        });
        prizeIdx++;
      } else if (phraseIdx < selectedPhrases.length) {
        slices.push({
          id: `phrase-${phraseIdx}`,
          label: selectedPhrases[phraseIdx],
          isWin: false,
          color: losingColors[phraseIdx % losingColors.length],
          textColor: '#e4e4e7'
        });
        phraseIdx++;
      }
    }

    // Add any remaining prizes or phrases
    while (prizeIdx < prizes.length) {
      const p = prizes[prizeIdx];
      slices.push({
        id: `prize-extra-${prizeIdx}`,
        label: `🏆 ${p.name}`,
        isWin: true,
        prize: p,
        color: prizeColors[prizeIdx % prizeColors.length],
        textColor: '#ffffff'
      });
      prizeIdx++;
    }

    return { slices, prizes };
  },

  // Calculate spin outcome based on 10% hit rate and 10x margin multiplier protection
  async determineSpinOutcome(
    orderTotal: number,
    slices: WheelSlice[],
    _prizes?: RoulettePrize[]
  ): Promise<{
    targetSliceIndex: number;
    isWin: boolean;
    prizeWon?: RoulettePrize;
    phraseLanded?: string;
    newAccumulatedRevenue: number;
    revenueThresholdNeeded: number;
    reason: string;
  }> {
    const config = await this.getConfig();
    const currentAccumulated = (config.accumulatedRevenueSinceLastWin || 0) + orderTotal;

    // Hit rate check (e.g. 10% chance)
    const diceRoll = Math.random() * 100;
    const hitRateThreshold = config.hitRatePercentage || 10;
    const isLuckyHit = diceRoll < hitRateThreshold;

    const winningSliceIndices = slices
      .map((s, idx) => (s.isWin ? idx : -1))
      .filter(idx => idx !== -1);

    const losingSliceIndices = slices
      .map((s, idx) => (!s.isWin ? idx : -1))
      .filter(idx => idx !== -1);

    // Pick a candidate prize if lucky hit
    let candidatePrize: RoulettePrize | undefined;
    let candidateSliceIndex = -1;

    if (winningSliceIndices.length > 0) {
      candidateSliceIndex = winningSliceIndices[Math.floor(Math.random() * winningSliceIndices.length)];
      candidatePrize = slices[candidateSliceIndex].prize;
    }

    const prizeCost = candidatePrize?.costPrice || 20;
    const requiredRevenue = prizeCost * (config.multiplierRequired || 10);

    // Both conditions required: Lucky 10% roll AND 10x revenue yield threshold achieved
    if (isLuckyHit && candidatePrize && currentAccumulated >= requiredRevenue) {
      // WINNER!
      // Deduct the required revenue yield or reset accumulator to safeguard store cash flow
      const updatedAccumulated = Math.max(0, currentAccumulated - requiredRevenue);

      return {
        targetSliceIndex: candidateSliceIndex,
        isWin: true,
        prizeWon: candidatePrize,
        newAccumulatedRevenue: updatedAccumulated,
        revenueThresholdNeeded: requiredRevenue,
        reason: `Acerto de 10% contemplado e renda acumulada de R$ ${currentAccumulated.toFixed(2)} superou a meta de 10x (R$ ${requiredRevenue.toFixed(2)})!`
      };
    }

    // LOSS: Land on a friendly encouraging phrase
    const lossIndex = losingSliceIndices.length > 0 
      ? losingSliceIndices[Math.floor(Math.random() * losingSliceIndices.length)]
      : 0;

    return {
      targetSliceIndex: lossIndex,
      isWin: false,
      phraseLanded: slices[lossIndex]?.label || 'Quem sabe na próxima!',
      newAccumulatedRevenue: currentAccumulated,
      revenueThresholdNeeded: requiredRevenue,
      reason: !isLuckyHit 
        ? `Probabilidade (sorteio aleatório não caiu nos 10% de chance).` 
        : `Renda acumulada (R$ ${currentAccumulated.toFixed(2)}) ainda não atingiu 10x o custo do prêmio (R$ ${requiredRevenue.toFixed(2)}).`
    };
  },

  // Record spin result in Firestore and update counters
  async recordSpinResult(spin: {
    orderId: string;
    orderTotal: number;
    customerName?: string;
    customerWhatsapp?: string;
    resultType: 'WIN' | 'LOSS';
    prizeWon?: string;
    prizeCost?: number;
    phraseLanded?: string;
    newAccumulatedRevenue: number;
  }): Promise<void> {
    try {
      // 1. Add log to rouletteSpins
      await addDoc(collection(db, SPINS_COLLECTION), {
        orderId: spin.orderId,
        orderTotal: spin.orderTotal,
        customerName: spin.customerName || 'Cliente Balcão',
        customerWhatsapp: spin.customerWhatsapp || '',
        resultType: spin.resultType,
        prizeWon: spin.prizeWon || null,
        prizeCost: spin.prizeCost || 0,
        phraseLanded: spin.phraseLanded || null,
        createdAt: new Date().toISOString(),
      });

      // 2. Update config stats
      const config = await this.getConfig();
      await this.saveConfig({
        accumulatedRevenueSinceLastWin: spin.newAccumulatedRevenue,
        totalSpinsCount: (config.totalSpinsCount || 0) + 1,
        totalWinsCount: spin.resultType === 'WIN' ? (config.totalWinsCount || 0) + 1 : (config.totalWinsCount || 0),
        totalPrizesCostAwarded: spin.resultType === 'WIN' 
          ? (config.totalPrizesCostAwarded || 0) + (spin.prizeCost || 0)
          : (config.totalPrizesCostAwarded || 0),
      });
    } catch (e) {
      console.error('Error recording roulette spin:', e);
    }
  },

  // Get spin history
  async getSpinHistory(limitCount: number = 50): Promise<RouletteSpinRecord[]> {
    try {
      const q = query(
        collection(db, SPINS_COLLECTION),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      const list: RouletteSpinRecord[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({
          id: d.id,
          orderId: data.orderId || '',
          orderTotal: data.orderTotal || 0,
          customerName: data.customerName || '',
          customerWhatsapp: data.customerWhatsapp || '',
          resultType: data.resultType || 'LOSS',
          prizeWon: data.prizeWon || '',
          prizeCost: data.prizeCost || 0,
          phraseLanded: data.phraseLanded || '',
          createdAt: data.createdAt || '',
        });
      });
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, SPINS_COLLECTION);
    }
  }
};
