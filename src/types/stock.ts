export type StockMovementType = 'entrada' | 'saida' | 'ajuste' | 'venda' | 'devolucao' | 'reserva' | 'cancelamento_reserva';

export interface StockMovement {
  id?: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  sku: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceId?: string; // Order ID or Purchase ID
  operatorId?: string;
  operatorName?: string;
  createdAt: any;
}

export interface StockItemBalance {
  productId: string;
  variantId?: string;
  sku: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  minStock?: number;
  lastMovementAt?: any;
}
