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
  timestamp: any;
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
  lastCountedAt?: any;
  lastCountedBy?: string;
  lastCountedByName?: string;
  manualAdjustments?: ManualAdjustment[];
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
  createdAt: any;
  syncedAt?: any;
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
  
  createdAt: any;
  createdBy: string;
  createdByName: string;
  
  startedAt?: any;
  startedBy?: string;
  pausedAt?: any;
  pausedBy?: string;
  finishedAt?: any;
  finishedBy?: string;
  finishedByName?: string;
  cancelledAt?: any;
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
  
  uncountedResolution?: 'KEEP_CURRENT' | 'SET_ZERO';
  finalizationId?: string;
  companyId?: string;
  notes?: string;
}
