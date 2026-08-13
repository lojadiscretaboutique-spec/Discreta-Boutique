export type DiscountStatus = 
  | 'APPLIED'
  | 'AUTHORIZED'
  | 'USED'
  | 'CANCELLED'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'SALE_CANCELLED';

export type RequiredAuthLevel = 
  | 'CAIXA_LIMITE'
  | 'GERENTE'
  | 'ADMIN'
  | 'PROPRIETARIO'
  | 'NENHUM';

export type DiscountFormType = 'percentage' | 'value' | 'mixed' | 'override';

export interface DiscountAuditItem {
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  originalUnitPrice: number;
  unitDiscount: number;
  itemDiscountPercent: number;
  finalUnitPrice: number;
  totalItemDiscount: number;
  costPrice?: number | null;
  isBelowCost?: boolean;
  itemReason?: string | null;
  itemNote?: string | null;
}

export interface DiscountAuditLog {
  id: string;
  companyId?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  dateTime: any; // Date | Timestamp | string
  
  // Operator
  operatorId?: string;
  operatorName?: string;
  operatorRole?: string;
  
  // Customer
  customerId?: string | null;
  customerName?: string | null;
  
  // Terminal / Caixa
  terminalId?: string | null;
  
  // Financial Totals
  grossTotal: number;
  itemsDiscountTotal: number;
  globalDiscount: number;
  manualReductions: number;
  totalDiscount: number;
  effectivePercent: number;
  finalTotal: number;
  
  // Discount Details
  discountType: DiscountFormType;
  reason: string;
  reasonCode?: string;
  observation?: string;
  
  // Authorization
  requiresAuthorization: boolean;
  requiredAuthLevel?: RequiredAuthLevel | string;
  authorizationId?: string | null;
  authorizerName?: string;
  authorizerRole?: string;
  authorizedAt?: any;
  
  // Statuses
  status: DiscountStatus;
  saleStatus?: string;
  
  // Cancellation
  cancellationDate?: any;
  cancellationReason?: string;
  cancelledBy?: string;
  
  // Items Breakdown
  discountItems?: DiscountAuditItem[];
  
  // Timestamps
  createdAt: any;
  updatedAt?: any;
}

export interface DiscountAuditFilter {
  startDate?: string;
  endDate?: string;
  orderNumber?: string;
  operatorSearch?: string;
  authorizerSearch?: string;
  customerSearch?: string;
  reasonSearch?: string;
  status?: string;
  requiresAuthorization?: boolean | 'ALL';
  authLevel?: string;
  discountScope?: 'ALL' | 'ITEM' | 'GLOBAL';
  minPercent?: number | '';
  maxPercent?: number | '';
  minDiscountValue?: number | '';
  maxDiscountValue?: number | '';
  productSearch?: string;
  terminalSearch?: string;
}

export const DISCOUNT_STATUS_LABELS: Record<DiscountStatus, { label: string; colorClass: string; bgClass: string }> = {
  APPLIED: {
    label: 'Aplicado',
    colorClass: 'text-emerald-700 dark:text-emerald-300',
    bgClass: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
  },
  AUTHORIZED: {
    label: 'Autorizado',
    colorClass: 'text-blue-700 dark:text-blue-300',
    bgClass: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800'
  },
  USED: {
    label: 'Utilizado',
    colorClass: 'text-purple-700 dark:text-purple-300',
    bgClass: 'bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800'
  },
  CANCELLED: {
    label: 'Cancelado',
    colorClass: 'text-amber-700 dark:text-amber-300',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
  },
  INVALIDATED: {
    label: 'Invalidado',
    colorClass: 'text-orange-700 dark:text-orange-300',
    bgClass: 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800'
  },
  EXPIRED: {
    label: 'Expirado',
    colorClass: 'text-slate-600 dark:text-slate-400',
    bgClass: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
  },
  REJECTED: {
    label: 'Recusado',
    colorClass: 'text-red-700 dark:text-red-300',
    bgClass: 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800'
  },
  BLOCKED: {
    label: 'Bloqueado',
    colorClass: 'text-rose-800 dark:text-rose-300',
    bgClass: 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800'
  },
  SALE_CANCELLED: {
    label: 'Venda Cancelada',
    colorClass: 'text-red-800 dark:text-red-200',
    bgClass: 'bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-800'
  }
};
