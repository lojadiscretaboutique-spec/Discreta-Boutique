export interface PaymentIntent {
  id: string;
  orderId: string;
  customerId: string;
  paymentMethodId: string;
  paymentMethodNameSnapshot: string;
  paymentMethodType: 'pix' | 'credit_card' | 'debit_card' | 'manual';
  gatewayProvider: string;
  provider: 'mercado_pago' | 'manual';
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'in_process';
  mercadopagoPaymentId?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixCopyPaste?: string;
  installments?: number;
  cardLastFour?: string;
  cardBrand?: string;
  payer: {
    email: string;
    identification?: { type: string; number: string };
  };
  payerSnapshot?: any;
  shippingSnapshot?: any;
  itemsSnapshot?: any;
  orderSnapshot?: any;
  shipping?: any;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}
