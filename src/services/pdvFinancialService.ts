import { financialService } from "./financialService";
import { cashService } from "./cashService";
import { roundTo2 } from "../lib/utils";

export interface PdvSaleCapture {
  orderId: string;
  orderRefTag: string;
  customerName: string;
  totalVenda: number;
  totalRecebido: number;
  paymentMethod: string;
  payments: any[];
  userId: string;
  sessionId: string;
}

export const pdvFinancialService = {
  calculateAdditionalAmount(totalVenda: number, totalRecebido: number): number {
    if (totalRecebido > totalVenda) {
      return roundTo2(totalRecebido - totalVenda);
    }
    return 0;
  },

  async finalizeSaleFinancials(capture: PdvSaleCapture) {
    const {
      orderId,
      orderRefTag,
      customerName,
      totalVenda,
      totalRecebido,
      paymentMethod,
      payments,
      userId,
      sessionId,
    } = capture;

    const additionalAmount = this.calculateAdditionalAmount(totalVenda, totalRecebido);
    const todayISO = new Date().toISOString().split('T')[0];

    // 1. Register in Global Financial Module (Income)
    // We register the FULL received amount as income
    await financialService.saveTransaction({
      type: "income",
      description: `PDV: Venda #${orderRefTag} | ${customerName}${additionalAmount > 0 ? ` (C/ Acréscimo: R$ ${additionalAmount.toFixed(2)})` : ""}`,
      amount: totalRecebido,
      originalSaleAmount: totalVenda,
      additionalAmount: additionalAmount,
      dueDate: todayISO,
      paymentDate: todayISO,
      status: "paid",
      category: "Vendas",
      orderId: orderId,
      paymentMethod: paymentMethod,
      notes: `Venda balcão. Total Venda: R$ ${totalVenda.toFixed(2)}. Valor Recebido: R$ ${totalRecebido.toFixed(2)}. Acréscimo: R$ ${additionalAmount.toFixed(2)}.`,
    });

    // 2. Register separate "Acréscimo" if exists (Optional, maybe for reporting? The prompt says "os R$ 20,00 adicionais devem entrar como acréscimo financeiro da venda")
    // The requirement says "o financeiro deve registrar R$ 200,00" (the full amount) but also mentions "acréscimo financeiro". 
    // Usually, this means the transaction itself or its metadata identifies the part that is additional.
    // I already included it in notes and description.

    // 3. Register in Cash Session
    // We iterate through payments but we must ensure we don't duplicate what saveTransaction might have done.
    // financialService.saveTransaction usually syncs to cash if it's a manual entry, 
    // but here in PDV we often register cash entries explicitly.
    
    // In our current saveTransaction logic, PDV sales might not auto-sync if isManual is false.
    // So we manually add to cash session.
    for (const p of payments) {
      if (p.amount > 0) {
        await cashService.addTransaction({
          sessionId: sessionId,
          type: 'entrada',
          category: 'VENDA_PDV',
          amount: p.amount,
          description: `Venda PDV #${orderRefTag}${additionalAmount > 0 ? ' (Inclui Acréscimo)' : ''}`,
          paymentMethod: p.method,
          userId: userId,
          source: 'loja_fisica' as any,
          orderId: orderId
        });
      }
    }
  }
};
