export type RaffleRuleType = 'EVERY_X_AMOUNT' | 'ANY_PURCHASE';

export interface RaffleCampaign {
  id: string;
  title: string;
  prize: string;
  rules: string;
  type: RaffleRuleType;
  amountPerTicket?: number; // Valor a cada R$ (ex: 50.00)
  minPurchaseValue?: number; // Valor mínimo da compra (ex: 0)
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  drawDate?: string; // Data e horário previsto do sorteio
  active: boolean;
  autoPrint: boolean; // Se deve disparar a impressão automática ao finalizar no PDV
  ticketsIssuedCount?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RaffleTicket {
  id: string;
  campaignId: string;
  campaignTitle: string;
  prize: string;
  rules: string;
  ticketNumber: number;
  ticketCode: string;
  orderId: string;
  orderTotal: number;
  orderDate: string;
  ticketIndexInSale: number; // 1 de 3
  ticketsTotalInSale: number; // 3
  customerName?: string;
  customerWhatsapp?: string;
  drawDate?: string;
  createdAt?: string;
}
