import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DiscountAuditLog, DiscountAuditFilter, DiscountAuditItem } from '../types/pdvDiscountAudit';

const AUDIT_COLLECTION = 'pdvDiscountAuditLogs';

/**
 * Normalizes Firestore date or timestamp to JS Date object
 */
export function normalizeDate(dt: any): Date {
  if (!dt) return new Date();
  if (dt instanceof Date) return dt;
  if (typeof dt.toDate === 'function') return dt.toDate();
  if (dt.seconds) return new Date(dt.seconds * 1000);
  const parsed = new Date(dt);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Records or updates a discount audit entry in Firestore.
 */
export async function recordDiscountAuditLog(logData: Partial<DiscountAuditLog>): Promise<string> {
  try {
    const docId = logData.id || `audit-${logData.orderId || Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const ref = doc(db, AUDIT_COLLECTION, docId);

    const payload: Partial<DiscountAuditLog> = {
      id: docId,
      companyId: logData.companyId || 'discreta',
      orderId: logData.orderId || null,
      orderNumber: logData.orderNumber || (logData.orderId ? `#${logData.orderId.slice(-6).toUpperCase()}` : 'Sem número'),
      dateTime: logData.dateTime || new Date(),
      operatorId: logData.operatorId || '',
      operatorName: logData.operatorName || 'Operador',
      operatorRole: logData.operatorRole || 'Caixa',
      customerId: logData.customerId || null,
      customerName: logData.customerName || null,
      terminalId: logData.terminalId || 'Caixa 01',
      grossTotal: Number(logData.grossTotal || 0),
      itemsDiscountTotal: Number(logData.itemsDiscountTotal || 0),
      globalDiscount: Number(logData.globalDiscount || 0),
      manualReductions: Number(logData.manualReductions || 0),
      totalDiscount: Number(logData.totalDiscount || 0),
      effectivePercent: Number(logData.effectivePercent || 0),
      finalTotal: Number(logData.finalTotal || 0),
      discountType: logData.discountType || 'percentage',
      reason: logData.reason || 'Desconto Concedido',
      reasonCode: logData.reasonCode || 'PDV',
      observation: logData.observation || '',
      requiresAuthorization: Boolean(logData.requiresAuthorization),
      requiredAuthLevel: logData.requiredAuthLevel || (logData.requiresAuthorization ? 'GERENTE' : 'Dentro do limite do operador'),
      authorizationId: logData.authorizationId || null,
      authorizerName: logData.authorizerName || (logData.requiresAuthorization ? 'Gerente' : 'Não se aplica'),
      authorizerRole: logData.authorizerRole || (logData.requiresAuthorization ? 'GERENTE' : 'Sistema'),
      authorizedAt: logData.authorizedAt || logData.dateTime || new Date(),
      status: logData.status || 'APPLIED',
      saleStatus: logData.saleStatus || 'ENTREGUE',
      discountItems: logData.discountItems || [],
      createdAt: logData.createdAt || new Date(),
      updatedAt: new Date()
    };

    await setDoc(ref, payload, { merge: true });
    return docId;
  } catch (err) {
    console.error('Erro ao gravar log de auditoria de desconto:', err);
    throw err;
  }
}

/**
 * Updates status to SALE_CANCELLED when a sale with discount is cancelled.
 */
export async function markDiscountAuditAsSaleCancelled(
  orderId: string, 
  cancelledBy?: string, 
  reason?: string
): Promise<void> {
  try {
    const q = query(collection(db, AUDIT_COLLECTION), where('orderId', '==', orderId));
    const snap = await getDocs(q);

    if (!snap.empty) {
      for (const d of snap.docs) {
        await updateDoc(doc(db, AUDIT_COLLECTION, d.id), {
          status: 'SALE_CANCELLED',
          saleStatus: 'CANCELADO',
          cancellationDate: new Date(),
          cancellationReason: reason || 'Venda cancelada no sistema',
          cancelledBy: cancelledBy || 'Operador',
          updatedAt: new Date()
        });
      }
    }
  } catch (err) {
    console.warn('Aviso ao atualizar audit log de cancelamento:', err);
  }
}

/**
 * Fetches, merges, deduplicates and returns all discount audit records matching filters.
 */
export async function getDiscountAuditLogs(
  filter?: DiscountAuditFilter,
  companyId: string = 'discreta',
  maxRecords: number = 200
): Promise<DiscountAuditLog[]> {
  try {
    const logsMap = new Map<string, DiscountAuditLog>();

    // 1. Query explicit pdvDiscountAuditLogs
    try {
      const qAudit = query(
        collection(db, AUDIT_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(maxRecords)
      );
      const auditSnap = await getDocs(qAudit);
      auditSnap.forEach((docSnap) => {
        const data = docSnap.data() as DiscountAuditLog;
        if (!data.companyId || data.companyId === companyId || companyId === 'all') {
          const key = data.orderId ? `order-${data.orderId}` : (data.authorizationId ? `auth-${data.authorizationId}` : docSnap.id);
          logsMap.set(key, { ...data, id: docSnap.id });
        }
      });
    } catch (err) {
      console.warn('Erro ao consultar coleção principal de audit logs:', err);
    }

    // 2. Query completed orders with discount > 0 to consolidate historical/existing sales
    try {
      const qOrders = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc'),
        limit(maxRecords)
      );
      const ordersSnap = await getDocs(qOrders);
      ordersSnap.forEach((docSnap) => {
        const order = docSnap.data() as any;
        const discountAmt = Number(order.discount || order.discountAmount || 0);

        if (discountAmt > 0 || order.discountAuthorizationId) {
          const key = `order-${docSnap.id}`;

          // Only construct if not already explicitly saved in audit logs
          if (!logsMap.has(key)) {
            const isCancelled = order.status === 'CANCELADO' || order.status === 'cancelado';
            const subtotal = Number(order.subtotal || ((order.total || 0) + discountAmt));
            const total = Number(order.total || 0);
            const effPercent = subtotal > 0 ? Number(((discountAmt / subtotal) * 100).toFixed(2)) : 0;

            // Extract item level discounts if present
            const items: DiscountAuditItem[] = Array.isArray(order.items) ? order.items.map((item: any) => {
              const origPrice = Number(item.originalPrice || item.price || 0);
              const finalPrice = Number(item.price || 0);
              const unitDisc = origPrice > finalPrice ? origPrice - finalPrice : 0;
              const qty = Number(item.quantity || 1);
              const itemDiscPct = origPrice > 0 ? Number(((unitDisc / origPrice) * 100).toFixed(2)) : 0;
              const costPrice = item.costPrice ? Number(item.costPrice) : null;

              return {
                productId: item.productId || item.id || '',
                variantId: item.variantId || null,
                productName: item.name || 'Produto',
                variantName: item.variantName || null,
                sku: item.sku || null,
                barcode: item.barcode || null,
                quantity: qty,
                originalUnitPrice: origPrice,
                unitDiscount: unitDisc,
                itemDiscountPercent: itemDiscPct,
                finalUnitPrice: finalPrice,
                totalItemDiscount: unitDisc * qty,
                costPrice: costPrice,
                isBelowCost: Boolean(costPrice && finalPrice < costPrice),
                itemReason: item.discountReason || null,
                itemNote: item.discountNote || null
              };
            }) : [];

            const itemDiscSum = items.reduce((acc, i) => acc + i.totalItemDiscount, 0);
            const reqAuth = Boolean(order.discountAuthorizationId || order.discountAuthorizedBy);

            const auditObj: DiscountAuditLog = {
              id: `order-audit-${docSnap.id}`,
              companyId: order.companyId || companyId,
              orderId: docSnap.id,
              orderNumber: `#${docSnap.id.slice(-6).toUpperCase()}`,
              dateTime: order.createdAt || order.date || new Date(),
              operatorId: order.sellerId || order.userId || '',
              operatorName: order.sellerName || order.operatorName || 'Caixa',
              operatorRole: order.sellerRole || 'Caixa',
              customerId: order.customerId || null,
              customerName: order.customerName || 'Cliente Balcão',
              terminalId: order.terminalId || order.cashRegisterId || 'Caixa 01',
              grossTotal: subtotal,
              itemsDiscountTotal: itemDiscSum,
              globalDiscount: discountAmt >= itemDiscSum ? discountAmt - itemDiscSum : discountAmt,
              manualReductions: 0,
              totalDiscount: discountAmt,
              effectivePercent: effPercent,
              finalTotal: total,
              discountType: itemDiscSum > 0 && discountAmt > itemDiscSum ? 'mixed' : (itemDiscSum > 0 ? 'override' : 'percentage'),
              reason: order.discountReason || (reqAuth ? 'Desconto Autorizado no PDV' : 'Desconto no Balcão'),
              reasonCode: 'PDV',
              observation: order.discountNote || '',
              requiresAuthorization: reqAuth,
              requiredAuthLevel: order.discountAuthorizedByRole ? order.discountAuthorizedByRole.toUpperCase() : (reqAuth ? 'GERENTE' : 'Dentro do limite do operador'),
              authorizationId: order.discountAuthorizationId || null,
              authorizerName: order.discountAuthorizedBy || (reqAuth ? 'Gerente' : 'Não se aplica'),
              authorizerRole: order.discountAuthorizedByRole || (reqAuth ? 'GERENTE' : 'Sistema'),
              authorizedAt: order.createdAt,
              status: isCancelled ? 'SALE_CANCELLED' : (reqAuth ? 'USED' : 'APPLIED'),
              saleStatus: order.status || 'ENTREGUE',
              discountItems: items,
              createdAt: order.createdAt || new Date(),
              updatedAt: order.updatedAt || new Date()
            };

            logsMap.set(key, auditObj);
          }
        }
      });
    } catch (err) {
      console.warn('Erro ao carregar vendas com desconto para histórico:', err);
    }

    // 3. Query pdvDiscountAuthorizations for unfulfilled/standalone authorizations (expired, rejected, invalidated, etc.)
    try {
      const qAuths = query(
        collection(db, 'pdvDiscountAuthorizations'),
        orderBy('createdAt', 'desc'),
        limit(maxRecords)
      );
      const authsSnap = await getDocs(qAuths);
      authsSnap.forEach((docSnap) => {
        const auth = docSnap.data() as any;
        const authId = docSnap.id;
        
        // If authorization is associated with an order, check if we already have it
        const authOrderKey = auth.orderId && auth.orderId !== 'new' ? `order-${auth.orderId}` : null;
        const standaloneKey = `auth-${authId}`;

        if (!authOrderKey || !logsMap.has(authOrderKey)) {
          if (!logsMap.has(standaloneKey)) {
            // Only add if authorization was NOT used or if it represents an unfulfilled/rejected/expired authorization
            const statusStr = (auth.status || 'AUTHORIZED').toUpperCase();
            
            // Map status
            let mappedStatus: any = 'AUTHORIZED';
            if (statusStr === 'EXPIRED') mappedStatus = 'EXPIRED';
            else if (statusStr === 'INVALIDATED' || statusStr === 'CANCELLED') mappedStatus = 'INVALIDATED';
            else if (statusStr === 'REJECTED') mappedStatus = 'REJECTED';
            else if (statusStr === 'BLOCKED') mappedStatus = 'BLOCKED';
            else if (statusStr === 'USED') mappedStatus = 'USED';

            const subtotal = Number(auth.cartSubtotal || 0);
            const discAmt = Number(auth.discountAmount || 0);
            const total = Number(auth.proposedTotal || (subtotal - discAmt));
            const effPercent = Number(auth.requestedPercent || (subtotal > 0 ? ((discAmt / subtotal) * 100).toFixed(2) : 0));

            const authAudit: DiscountAuditLog = {
              id: `auth-audit-${authId}`,
              companyId: auth.companyId || companyId,
              orderId: auth.orderId && auth.orderId !== 'new' ? auth.orderId : null,
              orderNumber: auth.orderId && auth.orderId !== 'new' ? `#${auth.orderId.slice(-6).toUpperCase()}` : 'Venda não finalizada',
              dateTime: auth.createdAt || auth.requestedAt || new Date(),
              operatorId: auth.operatorId || auth.requestedBy || '',
              operatorName: auth.operatorName || auth.requestedByEmail || 'Operador',
              operatorRole: auth.operatorRole || 'Caixa',
              customerId: auth.customerId || null,
              customerName: auth.customerName || null,
              terminalId: auth.terminalId || 'Caixa 01',
              grossTotal: subtotal,
              itemsDiscountTotal: 0,
              globalDiscount: discAmt,
              manualReductions: 0,
              totalDiscount: discAmt,
              effectivePercent: effPercent,
              finalTotal: total,
              discountType: auth.discountType || 'percentage',
              reason: auth.motivo || auth.reason || 'Solicitação de Desconto',
              reasonCode: 'PDV',
              observation: auth.observacao || auth.note || '',
              requiresAuthorization: true,
              requiredAuthLevel: auth.authorizerRole || 'GERENTE',
              authorizationId: authId,
              authorizerName: auth.authorizerName || 'Gerente',
              authorizerRole: auth.authorizerRole || 'GERENTE',
              authorizedAt: auth.authorizedAt || auth.createdAt,
              status: mappedStatus,
              saleStatus: auth.orderId && auth.orderId !== 'new' ? 'ENTREGUE' : 'NENHUMA_VENDA',
              discountItems: [],
              createdAt: auth.createdAt || new Date(),
              updatedAt: auth.updatedAt || new Date()
            };

            // Avoid adding if USED and already mapped by order
            if (mappedStatus !== 'USED' || !authOrderKey) {
              logsMap.set(standaloneKey, authAudit);
            }
          }
        }
      });
    } catch (err) {
      console.warn('Erro ao carregar autorizações de desconto:', err);
    }

    // Convert map values to array and sort descending by date
    let list = Array.from(logsMap.values()).sort((a, b) => {
      const dA = normalizeDate(a.dateTime || a.createdAt).getTime();
      const dB = normalizeDate(b.dateTime || b.createdAt).getTime();
      return dB - dA;
    });

    // Apply Client-Side Filtering
    if (filter) {
      if (filter.startDate) {
        const start = new Date(filter.startDate + 'T00:00:00');
        list = list.filter(item => normalizeDate(item.dateTime || item.createdAt) >= start);
      }

      if (filter.endDate) {
        const end = new Date(filter.endDate + 'T23:59:59');
        list = list.filter(item => normalizeDate(item.dateTime || item.createdAt) <= end);
      }

      if (filter.orderNumber && filter.orderNumber.trim()) {
        const numTerm = filter.orderNumber.trim().toLowerCase();
        list = list.filter(item => 
          (item.orderNumber && item.orderNumber.toLowerCase().includes(numTerm)) ||
          (item.orderId && item.orderId.toLowerCase().includes(numTerm))
        );
      }

      if (filter.operatorSearch && filter.operatorSearch.trim()) {
        const opTerm = filter.operatorSearch.trim().toLowerCase();
        list = list.filter(item => 
          (item.operatorName && item.operatorName.toLowerCase().includes(opTerm)) ||
          (item.operatorId && item.operatorId.toLowerCase().includes(opTerm))
        );
      }

      if (filter.authorizerSearch && filter.authorizerSearch.trim()) {
        const authTerm = filter.authorizerSearch.trim().toLowerCase();
        list = list.filter(item => 
          item.authorizerName && item.authorizerName.toLowerCase().includes(authTerm)
        );
      }

      if (filter.customerSearch && filter.customerSearch.trim()) {
        const custTerm = filter.customerSearch.trim().toLowerCase();
        list = list.filter(item => 
          item.customerName && item.customerName.toLowerCase().includes(custTerm)
        );
      }

      if (filter.reasonSearch && filter.reasonSearch.trim()) {
        const rTerm = filter.reasonSearch.trim().toLowerCase();
        list = list.filter(item => 
          (item.reason && item.reason.toLowerCase().includes(rTerm)) ||
          (item.observation && item.observation.toLowerCase().includes(rTerm))
        );
      }

      if (filter.status && filter.status !== 'ALL') {
        list = list.filter(item => item.status === filter.status);
      }

      if (filter.requiresAuthorization !== undefined && filter.requiresAuthorization !== 'ALL') {
        const req = Boolean(filter.requiresAuthorization);
        list = list.filter(item => item.requiresAuthorization === req);
      }

      if (filter.authLevel && filter.authLevel !== 'ALL') {
        list = list.filter(item => 
          item.requiredAuthLevel?.toLowerCase().includes(filter.authLevel!.toLowerCase()) ||
          item.authorizerRole?.toLowerCase().includes(filter.authLevel!.toLowerCase())
        );
      }

      if (filter.discountScope && filter.discountScope !== 'ALL') {
        if (filter.discountScope === 'ITEM') {
          list = list.filter(item => item.itemsDiscountTotal > 0);
        } else if (filter.discountScope === 'GLOBAL') {
          list = list.filter(item => item.globalDiscount > 0);
        }
      }

      if (filter.minPercent !== undefined && filter.minPercent !== '') {
        list = list.filter(item => item.effectivePercent >= Number(filter.minPercent));
      }

      if (filter.maxPercent !== undefined && filter.maxPercent !== '') {
        list = list.filter(item => item.effectivePercent <= Number(filter.maxPercent));
      }

      if (filter.minDiscountValue !== undefined && filter.minDiscountValue !== '') {
        list = list.filter(item => item.totalDiscount >= Number(filter.minDiscountValue));
      }

      if (filter.maxDiscountValue !== undefined && filter.maxDiscountValue !== '') {
        list = list.filter(item => item.totalDiscount <= Number(filter.maxDiscountValue));
      }

      if (filter.productSearch && filter.productSearch.trim()) {
        const pTerm = filter.productSearch.trim().toLowerCase();
        list = list.filter(item => 
          item.discountItems?.some(di => 
            di.productName.toLowerCase().includes(pTerm) ||
            (di.sku && di.sku.toLowerCase().includes(pTerm)) ||
            (di.barcode && di.barcode.toLowerCase().includes(pTerm))
          )
        );
      }

      if (filter.terminalSearch && filter.terminalSearch.trim()) {
        const tTerm = filter.terminalSearch.trim().toLowerCase();
        list = list.filter(item => 
          item.terminalId && item.terminalId.toLowerCase().includes(tTerm)
        );
      }
    }

    return list;
  } catch (err) {
    console.error('Erro ao buscar histórico de auditoria de descontos:', err);
    return [];
  }
}
