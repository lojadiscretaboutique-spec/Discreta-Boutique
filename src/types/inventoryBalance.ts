export type InventoryTimestamp = Date | { toDate?: () => Date; seconds?: number; nanoseconds?: number } | string | number;

export type InventoryBalanceStatus = 
  | 'RASCUNHO'
  | 'EM_CONTAGEM'
  | 'PAUSADO'
  | 'AGUARDANDO_CONFERENCIA'
  | 'FINALIZADO'
  | 'CANCELADO';

export type InventoryBalanceScope = 
  | 'ALL'
  | 'CATEGORY'
  | 'BRAND'
  | 'SELECTED_PRODUCTS';

export type ItemCountStatus = 
  | 'NAO_CONTADO'
  | 'CONTADO_SEM_DIVERGENCIA'
  | 'SOBRA'
  | 'FALTA'
  | 'NAO_LOCALIZADO';

export interface ManualAdjustment {
  timestamp: InventoryTimestamp;
  userId: string;
  userName: string;
  prevQty: number;
  newQty: number;
  reason?: string;
}

export interface InventoryBalanceItem {
  id: string; // `${productId}_${variantId || 'main'}`
  balanceId: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku: string;
  barcode?: string;
  categoryName?: string;
  brand?: string;
  imageUrl?: string;
  
  expectedSnapshot: number;
  movementsDuringBalance: number;
  theoreticalBalance: number;
  countedQuantity: number;
  difference: number;
  
  status: ItemCountStatus;
  unitCost: number;
  salePrice: number;
  
  counted: boolean;
  lastCountedAt?: InventoryTimestamp;
  lastCountedBy?: string;
  lastCountedByName?: string;
  manualAdjustments?: ManualAdjustment[];

  // Finalization tracking
  finalized?: boolean;
  adjustmentProcessed?: boolean;
  adjustmentProcessedAt?: InventoryTimestamp;
  adjustmentFinalizationId?: string;
  adjustmentMovementId?: string;
}

export interface InventoryBalanceCountEvent {
  id?: string;
  balanceId: string;
  itemId: string;
  productId: string;
  variantId?: string;
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  method: 'SCAN' | 'MANUAL' | 'BULK';
  userId: string;
  userName: string;
  deviceId?: string;
  clientActionId?: string;
  createdAt: InventoryTimestamp;
  syncedAt?: InventoryTimestamp;
}

export interface InventoryBalance {
  id?: string;
  code: string; // e.g. "BAL-2026-0001"
  name: string;
  description?: string;
  status: InventoryBalanceStatus;
  
  scope: InventoryBalanceScope;
  scopeValue?: string; // categoryId or brand or list of productIds
  scopeOptions?: {
    onlyActive?: boolean;
    includeZeroStock?: boolean;
    includeInactive?: boolean;
  };
  
  blindCount: boolean; // default true
  
  createdAt: InventoryTimestamp;
  createdBy: string;
  createdByName: string;
  
  startedAt?: InventoryTimestamp;
  startedBy?: string;
  pausedAt?: InventoryTimestamp;
  pausedBy?: string;
  finishedAt?: InventoryTimestamp;
  finishedBy?: string;
  finishedByName?: string;
  cancelledAt?: InventoryTimestamp;
  cancelledBy?: string;
  
  expectedItems: number;
  countedItems: number;
  totalExpectedUnits: number;
  totalCountedUnits: number;
  
  shortageItems: number;
  surplusItems: number;
  matchItems: number;
  
  shortageCostValue: number;
  surplusCostValue: number;
  
  reconciliationCutoffAt?: InventoryTimestamp;
  uncountedResolution?: 'KEEP_CURRENT' | 'SET_ZERO';
  finalizationId?: string;
  finalizationState?: 'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  finalizationTotalItems?: number;
  finalizationProcessedItems?: number;
  finalizationFailedItems?: number;
  finalizationStartedAt?: InventoryTimestamp;
  finalizationCompletedAt?: InventoryTimestamp;
  finalizationError?: string;
  companyId?: string;
  notes?: string;
}
