import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
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
  userEmail?: string;
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

    // 1. Idempotency Check: Financial Transaction
    const existingFinQ = query(
      collection(db, 'financial_transactions'),
      where('orderId', '==', orderId)
    );
    const existingFinSnap = await getDocs(existingFinQ);

    if (existingFinSnap.empty) {
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
    } else {
      console.log(`[pdvFinancialService] Financial entry already exists for order ${orderId}. Skipping duplicate creation.`);
    }

    // 2. Idempotency Check: Cash Session Transactions
    const existingCashQ = query(
      collection(db, 'cashTransactions'),
      where('orderId', '==', orderId)
    );
    const existingCashSnap = await getDocs(existingCashQ);

    if (existingCashSnap.empty) {
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
    } else {
      console.log(`[pdvFinancialService] Cash transactions already exist for order ${orderId}. Skipping duplicate creation.`);
    }
  }
};
