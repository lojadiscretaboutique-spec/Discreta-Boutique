import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  where,
  limit,
  getCountFromServer,
  Query,
} from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { formatCurrency, cn, formatVariantName } from "../../lib/utils";
import {
  format,
  isToday,
  startOfDay,
  startOfWeek,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { useFeedback } from "../../contexts/FeedbackContext";
import { useAuthStore } from "../../store/authStore";
import { markDiscountAuditAsSaleCancelled } from "../../services/pdvDiscountAuditService";
import { auditLogService } from "../../services/auditLogService";
import { Order, OrderItem } from "../../types/order";
import {
  Eye,
  Printer,
  Edit2,
  X,
  Save,
  Search,
  Monitor,
  Smartphone,
  User,
  MapPin,
  CreditCard,
  Clock,
  Trash2,
  XCircle,
  Loader2,
  RotateCcw,
  Share2,
  Copy,
  Check,
  History,
} from "lucide-react";
import { orderReversalService } from "../../services/orderReversalService";
import { canReverseOrder } from "../../utils/orderReversalValidation";
import { MERCADO_PAGO_LOGO_BASE64 } from "../../constants/images";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { motion, AnimatePresence } from "motion/react";
import { stockMovementService } from "../../services/stockMovementService";
import { financialService } from "../../services/financialService";
import { cashService } from "../../services/cashService";

import { useNavigate } from "react-router-dom";

const formatAddress = (addr: any): string => {
  if (!addr) return "Retirada em Loja";
  if (typeof addr === "string") return addr.trim() || "Retirada em Loja";
  if (typeof addr === "object") {
    const parts = [
      addr.street || addr.logradouro || addr.rua,
      addr.number || addr.numero ? `nº ${addr.number || addr.numero}` : "",
      addr.complement || addr.complemento ? `(${addr.complement || addr.complemento})` : "",
      addr.neighborhood || addr.bairro,
      addr.city || addr.cidade,
      addr.state || addr.uf,
      addr.cep || addr.zipCode || addr.zip
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Retirada em Loja";
  }
  return String(addr);
};

const getFriendlyPaymentMethodName = (order: Order): string => {
  if (order.paymentMethodNameSnapshot) {
    return order.paymentMethodNameSnapshot;
  }
  if (order.payments && order.payments.length > 0) {
    return order.payments.map(p => {
      const name = p.method;
      if (name === 'pix' || name === 'PIX' || name === 'PIX_ONLINE') return 'Pix';
      if (name === 'money' || name === 'cash' || name === 'CASH' || name === 'dinheiro') return 'Dinheiro';
      if (name === 'credit_card' || name === 'CREDIT_CARD' || name === 'cartao_credito') return 'Cartão de Crédito';
      if (name === 'debit_card' || name === 'DEBIT_CARD' || name === 'cartao_debito') return 'Cartão de Débito';
      return name || 'Outro';
    }).join(' + ');
  }
  const method = order.paymentMethod || order.paymentProvider || '';
  if (!method) return 'A DEFINIR';
  
  const m = String(method).toLowerCase();
  if (m === 'pix' || m === 'pix_online' || m === 'mercado_pago') return 'Pix';
  if (m === 'money' || m === 'cash' || m === 'dinheiro') return 'Dinheiro';
  if (m === 'credit_card' || m === 'cartao_credito' || m === 'card') return 'Cartão de Crédito';
  if (m === 'debit_card' || m === 'cartao_debito') return 'Cartão de Débito';
  if (m === 'multiple' || m === 'multiplo') return 'Múltiplas Formas';
  if (m === 'online_payment' || m === 'online') return 'Pagamento Online';
  
  return method;
};

const getOrderPaymentId = (order: Order): string | undefined => {
  if (order.payments && order.payments.length > 0) {
    const firstWithId = order.payments.find(p => p.transactionId);
    if (firstWithId?.transactionId) {
      return String(firstWithId.transactionId);
    }
  }

  const legacyOrder = order as Order & {
    paymentId?: string | number;
    mercadoPagoPaymentId?: string | number;
    mercadopagoPaymentId?: string | number;
  };

  if (legacyOrder.paymentId) {
    return String(legacyOrder.paymentId);
  }
  if (legacyOrder.mercadoPagoPaymentId) {
    return String(legacyOrder.mercadoPagoPaymentId);
  }
  if (legacyOrder.mercadopagoPaymentId) {
    return String(legacyOrder.mercadopagoPaymentId);
  }

  return undefined;
};

const getEffectiveDiscountPercentage = (subtotal: number, discount: number): string => {
  if (!subtotal || subtotal <= 0 || !discount || discount <= 0) return "0%";
  const pct = (discount / subtotal) * 100;
  if (isNaN(pct) || !isFinite(pct)) return "0%";
  return `${pct.toFixed(1)}%`;
};

const getTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (typeof val.toMillis === "function") return val.toMillis();
  if (typeof val.toDate === "function") return val.toDate().getTime();
  if (val.seconds) return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") {
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const formatLogDate = (val: any): string => {
  const ms = getTimestampMs(val);
  if (!ms) return "Data não informada";
  try {
    return format(new Date(ms), "dd/MM/yyyy 'às' HH:mm");
  } catch {
    return "Data não informada";
  }
};

const isPickupOrder = (order: Order): boolean => {
  const method = (order.shippingMethod || (order as any).deliveryType || "").toLowerCase();
  const type = (order.type || "").toLowerCase();
  if (method.includes("retirada") || method.includes("pickup") || method.includes("balcao")) return true;
  if (type === "pdv" && (!order.customerAddress || order.customerAddress.toLowerCase().includes("retirada"))) return true;
  return false;
};

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [checkingExpired, setCheckingExpired] = useState(false);

  const handleCheckExpired = async () => {
    setCheckingExpired(true);
    try {
        const res = await fetch('/api/admin/check-expired-payments', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            toast(`Verificação concluída: ${data.cancelledCount} pedidos cancelados.`, "success");
        } else {
            toast("Erro ao verificar pedidos.", "error");
        }
    } catch (e) {
        toast("Erro ao verificar pedidos.", "error");
    } finally {
        setCheckingExpired(false);
    }
  }

  const [activeTab, setActiveTab] = useState<"hoje" | "abertos" | "geral">(
    "hoje",
  );
  const [datePeriod, setDatePeriod] = useState<
    "hoje" | "semana" | "mes" | "ano" | "tudo" | "personalizado"
  >("hoje");
  const [customStartDate, setCustomStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [limitCount, setLimitCount] = useState(10);
  const [metrics, setMetrics] = useState({
    geral: 0,
    abertos: 0,
    lojaFisica: 0,
    lojaOnline: 0,
  });

  const handleTabChange = (tab: "hoje" | "abertos" | "geral") => {
    setActiveTab(tab);
    if (tab === "hoje") {
      setDatePeriod("hoje");
    } else if (activeTab === "hoje") {
      // Se estava na aba de hoje e mudou para Abertos ou Geral, limpa o filtro de data para Tudo para ver os de fato correspondentes.
      setDatePeriod("tudo");
    }
  };

  const handleDatePeriodChange = (period: "hoje" | "semana" | "mes" | "ano" | "tudo" | "personalizado") => {
    setDatePeriod(period);
    // Se selecionou uma data diferente de "hoje" mas a aba atual exigiria ser só "hoje", muda a aba para "geral" automaticamente
    if (period !== "hoje" && activeTab === "hoje") {
      setActiveTab("geral");
    }
    // Se mudou pra hoje, sincronizar aba também (opcional)
    if (period === "hoje") {
      setActiveTab("hoje");
    }
  };
  const [hasMore, setHasMore] = useState(true);

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewingDetailsId, setViewingDetailsId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [processingStatusId, setProcessingStatusId] = useState<string | null>(null);
  const [orderLogs, setOrderLogs] = useState<any[]>([]);

  const { toast, confirm } = useFeedback();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuthStore();
  const printRef = useRef<HTMLDivElement>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrder?.id) {
      setOrderLogs([]);
      return;
    }

    let isMounted = true;
    const fetchOrderHistory = async () => {
      try {
        const q = query(
          collection(db, "auditLogs"),
          where("targetId", "==", selectedOrder.id)
        );
        const snap = await getDocs(q);
        const auditItems = snap.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            type: "audit",
            createdAt: data.createdAt,
            userName: data.userName || data.userEmail || "Sistema",
            action: data.action,
            previousStatus: data.details?.previousStatus,
            newStatus: data.details?.newStatus,
            reason: data.details?.reason || data.details?.discountReason,
            note: data.details?.note || data.details?.discountNote || data.details?.notes,
            details: data.details
          };
        });

        const embeddedHistory = (selectedOrder as any).history || (selectedOrder as any).statusHistory || [];
        const embeddedItems = embeddedHistory.map((h: any, idx: number) => ({
          id: `embedded-${idx}`,
          type: "embedded",
          createdAt: h.createdAt || h.date || h.timestamp,
          userName: h.userName || h.user || h.updatedBy || h.userEmail || "Sistema",
          action: h.action || h.status || "Alteração",
          previousStatus: h.previousStatus || h.oldStatus,
          newStatus: h.newStatus || h.status,
          reason: h.reason || h.motivo,
          note: h.note || h.observacao || h.obs,
          details: h
        }));

        const allLogs = [...auditItems, ...embeddedItems];

        allLogs.sort((a, b) => {
          const tA = getTimestampMs(a.createdAt);
          const tB = getTimestampMs(b.createdAt);
          return tB - tA;
        });

        if (isMounted) {
          setOrderLogs(allLogs);
        }
      } catch (e) {
        console.error("Erro ao carregar histórico do pedido:", e);
      }
    };

    fetchOrderHistory();

    return () => {
      isMounted = false;
    };
  }, [selectedOrder?.id]);

  useEffect(() => {
    // Fetch active session once to conditionally hide/show the 'Estornar' button
    const loadSession = async () => {
      try {
        const session = await cashService.getCurrentSession();
        setActiveSession(session);
      } catch (err) {
        console.error("Failed to load active session inside AdminOrders", err);
      }
    };
    loadSession();
  }, []);

  const handleReverseOrder = async (order: Order) => {
    if (reversingId || processingStatusId) return;

    const isConfirmed = await confirm({
      title: "Estornar Pedido?",
      message: `Isso irá REMOVER as movimentações financeiras, DEVOLVER o estoque e REABRIR este pedido no PDV para correção. Deseja continuar?`,
      confirmText: "Sim, Estornar Agora",
      cancelText: "Desistir",
    });

    if (!isConfirmed) return;

    setReversingId(order.id);
    setProcessingStatusId(order.id);
    try {
      // 1. Get current session
      const currentSession = await cashService.getCurrentSession();
      
      // 2. Validate
      await orderReversalService.validateOrderReversal(order, currentSession);

      // 3. Perform Reversal
      const currentUser = user || useAuthStore.getState().user;
      await orderReversalService.reverseOrder(order, currentUser!.uid, currentUser!.email || "system", navigate);

      toast("Pedido estornado com sucesso! Redirecionando para o PDV...", "success");
    } catch (error: any) {
      toast(error.message || "Erro ao estornar pedido", "error");
    } finally {
      setReversingId(null);
      setProcessingStatusId(null);
    }
  };

  const canEdit = hasPermission("orders", "editar");
  const canPrint = hasPermission("orders", "imprimir");
  const canApprove = hasPermission("orders", "aprovar");
  const canCancel = hasPermission("orders", "cancelar");
  const canDelete = hasPermission("orders", "excluir");

  useEffect(() => {
    const loadMetrics = async (dateStart?: Date, dateEnd?: Date) => {
      try {
        let qGeral: Query = collection(db, "orders");
        let qAbertos = query(
          collection(db, "orders"),
          where("status", "not-in", ["ENTREGUE", "CANCELADO"]),
        );
        let qFisica = query(
          collection(db, "orders"),
          where("type", "==", "pdv"),
        );
        let qOnline = query(
          collection(db, "orders"),
          where("type", "==", "online"),
        );

        if (dateStart && dateEnd) {
          qGeral = query(
            collection(db, "orders"),
            where("createdAt", ">=", dateStart),
            where("createdAt", "<=", dateEnd),
          );
        } else if (dateStart) {
          qGeral = query(
            collection(db, "orders"),
            where("createdAt", ">=", dateStart),
          );
          // we fallback to basic queries to avoid missing index errors when combining where
        }

        const [sGeral, sAbertos, sFisica, sOnline] = await Promise.all([
          getCountFromServer(qGeral),
          getCountFromServer(qAbertos),
          getCountFromServer(qFisica),
          getCountFromServer(qOnline),
        ]);

        setMetrics({
          geral: sGeral.data().count,
          abertos: sAbertos.data().count,
          lojaFisica: sFisica.data().count,
          lojaOnline: sOnline.data().count,
        });
      } catch (err) {
        console.warn("Erro ao buscar contagens:", err);
      }
    };

    let dateStart: Date | undefined;
    let dateEnd: Date | undefined;
    if (datePeriod === "hoje") {
      dateStart = startOfDay(new Date());
    } else if (datePeriod === "semana") {
      dateStart = startOfWeek(new Date());
    } else if (datePeriod === "mes") {
      dateStart = startOfMonth(new Date());
    } else if (datePeriod === "ano") {
      dateStart = startOfYear(new Date());
    } else if (datePeriod === "personalizado") {
      const [sYear, sMonth, sDay] = customStartDate.split('-').map(Number);
      dateStart = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);

      const [eYear, eMonth, eDay] = customEndDate.split('-').map(Number);
      dateEnd = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    }

    loadMetrics(dateStart, dateEnd);
  }, [datePeriod, customStartDate, customEndDate]);

  useEffect(() => {
    let q = query(
      collection(db, "orders"),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );

    if (datePeriod !== "tudo") {
      let dateStart = new Date();
      let dateEnd = new Date();
      let useRange = false;

      if (datePeriod === "hoje") {
        dateStart = startOfDay(new Date());
      } else if (datePeriod === "semana") {
        dateStart = startOfWeek(new Date());
      } else if (datePeriod === "mes") {
        dateStart = startOfMonth(new Date());
      } else if (datePeriod === "ano") {
        dateStart = startOfYear(new Date());
      } else if (datePeriod === "personalizado") {
        useRange = true;
        const [sYear, sMonth, sDay] = customStartDate.split('-').map(Number);
        dateStart = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);

        const [eYear, eMonth, eDay] = customEndDate.split('-').map(Number);
        dateEnd = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
      }

      if (useRange) {
        q = query(
          collection(db, "orders"),
          where("createdAt", ">=", dateStart),
          where("createdAt", "<=", dateEnd),
          orderBy("createdAt", "desc"),
          limit(limitCount),
        );
      } else {
        q = query(
          collection(db, "orders"),
          where("createdAt", ">=", dateStart),
          orderBy("createdAt", "desc"),
          limit(limitCount),
        );
      }
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setOrders(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Order),
        );
        setHasMore(snapshot.docs.length >= limitCount);
        setLoading(false);
      },
      (err: any) => {
        if (err?.code === "cancelled" || err?.message?.includes("CANCELLED")) {
          console.warn(
            "Firebase Listener Cancelled (Idle Stream). Auto-reconnecting...",
          );
          return;
        }
        console.error(err);
        toast("Erro ao carregar pedidos.", "error");
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, [toast, limitCount, datePeriod, customStartDate, customEndDate]);

  const handleDeleteOrder = async (order: Order) => {
    if (processingStatusId) return;

    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível realizar exclusões com o caixa fechado.", "error");
      return;
    }

    const isMercadoPago = order.paymentMethod?.toLowerCase().includes("pix") || 
                          order.paymentProvider === "mercado_pago" || 
                          order.paymentMethod === "online_payment";

    if (isMercadoPago) {
      toast("Pedidos com integração Mercado Pago não podem ser apagados, apenas cancelados.", "error");
      return;
    }

    const confirmed = await confirm({
      title: "APAGAR PEDIDO",
      message:
        "Tem certeza que deseja apagar este pedido? Isso reverterá a reserva de estoque. O pedido só pode ser apagado se não tiver gerado transações financeiras!",
      variant: "danger",
    });
    if (!confirmed) return;

    setProcessingStatusId(order.id);
    try {
      // Re-verify in DB
      const freshSnap = await getDoc(doc(db, "orders", order.id));
      if (!freshSnap.exists()) {
        toast("Pedido já foi excluído.", "info");
        return;
      }

      // Check if financial transactions exist
      const financialQ = query(
        collection(db, "financial_transactions"),
        where("orderId", "==", order.id),
      );
      const financialSnap = await getDocs(financialQ);
      if (!financialSnap.empty) {
        toast(
          "Não é possível apagar! Este pedido já possui registros no Financeiro.",
          "error",
        );
        return;
      }

      // Revert stock reservations
      await stockMovementService.deleteMovementsByOrderId(order.id);

      // Delete order document
      await deleteDoc(doc(db, "orders", order.id));

      // Audit log
      await auditLogService.logAction('APAGAR_PEDIDO', 'ORDERS', order.id, {
        userEmail: user?.email || 'system',
        orderTotal: order.total
      });

      toast("Pedido apagado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao apagar pedido", "error");
    } finally {
      setProcessingStatusId(null);
    }
  };

  const handleCancelDelivered = async (order: Order) => {
    if (processingStatusId) return;

    const session = await cashService.getCurrentSession();
    if (!session) {
      toast(
        "Não é possível cancelar pedidos entregues com o caixa fechado.",
        "error",
      );
      return;
    }

    const confirmed = await confirm({
      title: "CANCELAR PEDIDO ENTREGUE",
      message:
        "Isso irá gerar uma devolução de estoque para os itens e criar uma transação de estorno no financeiro. Confirmar?",
      variant: "danger",
    });
    if (!confirmed) return;

    setProcessingStatusId(order.id);
    try {
      // Fresh DB check to prevent double cancellation
      const freshSnap = await getDoc(doc(db, "orders", order.id));
      if (freshSnap.exists()) {
        const freshData = freshSnap.data();
        if (freshData?.status === "CANCELADO" || freshData?.status === "ESTORNADO") {
          toast(`Este pedido já foi ${freshData.status.toLowerCase()}. Operação cancelada.`, "warning");
          return;
        }
      }

      // 1. Generate return movement (idempotent: check if devolução movements already exist)
      const stockCheck = await getDocs(query(
        collection(db, "stockMovements"),
        where("orderId", "==", order.id),
        where("reason", "==", "Devolução de Cliente (Cancelamento de Entrega)")
      ));

      if (stockCheck.empty) {
        for (const item of order.items) {
          await stockMovementService.registerMovement({
            productId: item.productId,
            productName: item.name,
            variantId: item.variantId || undefined,
            sku: item.sku || "",
            quantity: item.quantity,
            type: "in",
            reason: "Devolução de Cliente (Cancelamento de Entrega)",
            channel: order.type === "pdv" ? "Loja Física" : "Loja Virtual",
            orderId: order.id,
            status: "realizada",
          });
        }
      }

      // 2. Generate financial reversal (idempotent: check if estorno transaction already exists)
      const finCheck = await getDocs(query(
        collection(db, "financial_transactions"),
        where("orderId", "==", order.id),
        where("category", "==", "Estorno de Vendas")
      ));

      if (finCheck.empty) {
        await financialService.saveTransaction({
          type: "expense",
          description: `Estorno de Venda - Pedido #${order.id.slice(-6).toUpperCase()}`,
          amount: order.total,
          dueDate: new Date().toISOString().split("T")[0],
          paymentDate: new Date().toISOString().split("T")[0],
          status: "paid",
          category: "Estorno de Vendas",
          notes: `Cancelamento de pedido entregue em ${format(new Date(), "dd/MM/yyyy")}`,
          orderId: order.id,
        });
      }

      await updateDoc(doc(db, "orders", order.id), {
        status: "CANCELADO",
        updatedAt: serverTimestamp(),
      });

      // Update discount audit
      await markDiscountAuditAsSaleCancelled(order.id, user?.email || 'Operador', 'Cancelamento de pedido entregue');

      // Audit log
      await auditLogService.logAction('CANCELAR_ENTREGUE', 'ORDERS', order.id, {
        userEmail: user?.email || 'system',
        previousStatus: order.status,
        orderTotal: order.total
      });

      // Send manual webhook notification
      await triggerWebhookNotification(order, "CANCELADO");

      toast(`Pedido cancelado e estornado com sucesso!`, "success");
      if (viewingDetailsId === order.id) setViewingDetailsId(null);
    } catch (err) {
      console.error(err);
      toast("Erro ao processar cancelamento.", "error");
    } finally {
      setProcessingStatusId(null);
    }
  };

  const triggerWebhookNotification = async (order: any, newStatus: string) => {
    try {
      console.log(`[AdminOrders] Enviando webhook manual para o pedido ${order.id} com status ${newStatus}`);
      await fetch("/api/botconversa/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido: {
            ...order,
            status: newStatus
          }
        })
      });
    } catch (err) {
      console.error("[AdminOrders] Erro ao disparar webhook manual:", err);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    if (processingStatusId) return;

    const session = await cashService.getCurrentSession();
    if (!session) {
      toast(
        "Não é possível alterar o status do pedido com o caixa fechado.",
        "error",
      );
      return;
    }

    const order = orders.find((o) => o.id === id);
    if (!order) return;

    // Prevent changing from specific states manually via this general function
    if (order.status === "CANCELADO" || order.status === "ENTREGUE" || order.status === "ESTORNADO") {
      toast(
        `Pedido já está com status ${order.status} e não pode ser alterado.`,
        "warning",
      );
      return;
    }

    if (newStatus === order.status) return;

    setProcessingStatusId(id);
    try {
      // Re-verify in DB
      const freshSnap = await getDoc(doc(db, "orders", id));
      if (freshSnap.exists()) {
        const freshStatus = freshSnap.data()?.status;
        if (freshStatus === "CANCELADO" || freshStatus === "ESTORNADO") {
          toast(`Este pedido já se encontra ${freshStatus}. Nenhuma alteração realizada.`, "warning");
          return;
        }
      }

      if (newStatus === "CANCELADO") {
        const confirmed = await confirm({
          title: "CANCELAR PEDIDO",
          message:
            "Tem certeza que deseja cancelar este pedido? Isso reverterá as reservas de estoque.",
          variant: "danger",
        });
        if (!confirmed) {
          setProcessingStatusId(null);
          return;
        }

        await stockMovementService.deleteMovementsByOrderId(id);
        await financialService.deleteTransactionsByOrderId(id);

        await updateDoc(doc(db, "orders", id), {
          status: "CANCELADO",
          updatedAt: serverTimestamp(),
        });

        // Update discount audit log status to SALE_CANCELLED
        await markDiscountAuditAsSaleCancelled(id, user?.email || 'Operador', 'Cancelamento de pedido via Gestão de Pedidos');

        // Audit log
        await auditLogService.logAction('CANCELAR_PEDIDO', 'ORDERS', id, {
          previousStatus: order.status,
          newStatus: "CANCELADO",
          userEmail: user?.email || 'system',
          orderTotal: order.total
        });

        // Send manual webhook notification
        await triggerWebhookNotification(order, "CANCELADO");

        toast(`Pedido cancelado com sucesso!`, "success");
        return;
      }

      const isMercadoPago = order.paymentMethod?.toLowerCase().includes("pix") || 
                            order.paymentProvider === "mercado_pago" || 
                            order.paymentMethod === "online_payment";

      if (newStatus === "ENTREGUE" && order.type === "online" && !isMercadoPago) {
        toast("Pedidos online sem integração só podem ser finalizados pelo PDV.", "warning");
        return;
      }

      await updateDoc(doc(db, "orders", id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      if (newStatus === "ENTREGUE") {
        await stockMovementService.realizeMovementsByOrderId(id);

        if (order.type === "online" && isMercadoPago) {
          const financialQ = query(
            collection(db, "financial_transactions"),
            where("orderId", "==", id)
          );
          const financialSnap = await getDocs(financialQ);
          if (financialSnap.empty) {
            const todayISO = new Date().toISOString().split('T')[0];
            await financialService.saveTransaction({
              type: "income",
              description: `Venda Online (Integração) #${order.id.slice(-6).toUpperCase()} | ${order.customerName}`,
              amount: order.total,
              originalSaleAmount: order.total,
              additionalAmount: 0,
              dueDate: todayISO,
              paymentDate: todayISO,
              status: "paid",
              category: "Vendas",
              orderId: order.id,
              paymentMethod: order.paymentMethodNameSnapshot || order.paymentMethod || 'Online',
              notes: `Pedido entregue. Valor: R$ ${order.total.toFixed(2)}.`,
            });
          }
        }
      }

      // Audit log
      await auditLogService.logAction('ALTERAR_STATUS', 'ORDERS', id, {
        previousStatus: order.status,
        newStatus,
        userEmail: user?.email || 'system',
        orderTotal: order.total
      });

      // Send manual webhook notification
      await triggerWebhookNotification(order, newStatus);

      toast(`Pedido atualizado!`, "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao atualizar", "error");
    } finally {
      setProcessingStatusId(null);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    if (selectedOrder?.id) {
      auditLogService.logAction('REIMPRIMIR_PEDIDO', 'ORDERS', selectedOrder.id, {
        userEmail: user?.email || 'system',
        orderTotal: selectedOrder.total
      });
    }

    const printWindow = window.open("", "", "width=300,height=600");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Cupom do Pedido</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 13px; 
              width: 58mm; 
              margin: 0; 
              padding: 5mm;
              color: black;
              font-weight: bold;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: 900; }
            .divider { border-top: 1px dashed black; margin: 5px 0; }
            .item { display: flex; justify-content: space-between; gap: 5px; margin-bottom: 2px; }
            .totals { margin-top: 10px; font-weight: 900; }
            .header-info { margin-bottom: 10px; font-weight: bold;}
            .footer { margin-top: 20px; text-align: center; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; font-weight: bold;}
            th { text-align: left; border-bottom: 1px solid #000; font-weight: 900;}
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    try {
      const { id, ...data } = editingOrder;
      await updateDoc(doc(db, "orders", id), {
        ...data,
        updatedAt: new Date(),
      });
      toast("Pedido atualizado com sucesso!");
      setEditingOrder(null);
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar alterações", "error");
    }
  };

  const statusColors: Record<string, string> = {
    NOVO: "bg-blue-100 text-blue-800",
    "AGUARDANDO RETIRADA": "bg-amber-100 text-amber-800",
    "SAIU PARA ENTREGA": "bg-purple-100 text-purple-800",
    ENTREGUE: "bg-green-100 text-green-800",
    CANCELADO: "bg-red-100 text-red-800",
    // Fallbacks
    recebido: "bg-blue-100 text-blue-800",
    preparando: "bg-yellow-100 text-yellow-800",
    "saiu para entrega": "bg-purple-100 text-purple-800",
    entregue: "bg-green-100 text-green-800",
    cancelado: "bg-red-100 text-red-800",
  };

  const formatOrderDate = (date: any, pattern: string = "dd/MM - HH:mm") => {
    if (!date) return "...";
    try {
      if (typeof date.toDate === "function") {
        return format(date.toDate(), pattern);
      }
      if (date instanceof Date) {
        return format(date, pattern);
      }
      if (date?.seconds) {
        return format(new Date(date.seconds * 1000), pattern);
      }
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return format(parsedDate, pattern);
      }
    } catch (e) {
      console.error("Error formatting date:", e);
    }
    return "...";
  };

  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const getCleanWhatsapp = (num?: string) => {
    if (!num) return "";
    const clean = num.replace(/\D/g, "");
    if (clean.length === 10 || clean.length === 11) {
      return "55" + clean;
    }
    return clean;
  };

  const generateShareText = (order: Order) => {
    const shortId = order.id.slice(-6).toUpperCase();
    const dateStr = order.createdAt ? formatOrderDate(order.createdAt, "dd/MM/yyyy HH:mm") : "";
    
    let text = `🌸 *DISCRETA BOUTIQUE - DETALHES DO PEDIDO* 🌸\n\n`;
    text += `📝 *Pedido:* #${shortId}\n`;
    if (dateStr) text += `📅 *Data:* ${dateStr}\n`;
    text += `👤 *Cliente:* ${order.customerName}\n`;
    if (order.customerWhatsapp) text += `📞 *WhatsApp:* ${order.customerWhatsapp}\n`;
    if (order.customerAddress) text += `📍 *Endereço:* ${order.customerAddress}\n`;
    text += `💳 *Método de Pagamento:* ${order.paymentMethodNameSnapshot || order.paymentMethod || "A DEFINIR"}\n`;
    text += `📊 *Status:* ${order.status}\n\n`;
    
    text += `🛒 *ÍTENS DO PEDIDO:*\n`;
    order.items.forEach((item) => {
      const formattedPrice = formatCurrency(item.price);
      const totalItem = formatCurrency(item.price * item.quantity);
      text += `- ${item.quantity}x ${item.name} (${formattedPrice} cada) = ${totalItem}\n`;
    });
    text += `\n`;

    if (order.subTotal && order.subTotal !== order.total) {
      text += `🔹 *Subtotal:* ${formatCurrency(order.subTotal)}\n`;
    }
    if (order.discount && order.discount > 0) {
      text += `➖ *Desconto:* -${formatCurrency(order.discount)}\n`;
    }
    if (order.deliveryFee && order.deliveryFee > 0) {
      text += `➕ *Frete:* ${formatCurrency(order.deliveryFee)}\n`;
    } else if (order.shipping && order.shipping > 0) {
      text += `➕ *Frete:* ${formatCurrency(order.shipping)}\n`;
    }
    if (order.additionalAmount && order.additionalAmount > 0) {
      text += `➕ *Acréscimo:* ${formatCurrency(order.additionalAmount)}\n`;
    }
    
    text += `💰 *TOTAL DO PEDIDO:* *${formatCurrency(order.total)}*\n\n`;
    
    if (order.notes) {
      text += `ℹ️ *Observações:* "${order.notes}"\n\n`;
    }
    
    text += `Obrigada pela preferência! Caso precise de algo, estamos à disposição. ✨`;
    return text;
  };

  const handleCopySummary = (order: Order) => {
    try {
      const text = generateShareText(order);
      navigator.clipboard.writeText(text);
      setCopiedOrderId(order.id);
      toast({
        title: "Sucesso!",
        message: "Resumo do pedido copiado para a área de transferência.",
        type: "success",
      });
      setTimeout(() => {
        setCopiedOrderId(null);
      }, 3000);
    } catch (err) {
      toast({
        title: "Erro!",
        message: "Não foi possível copiar o resumo do pedido.",
        type: "error",
      });
    }
  };

  const handleShareWhatsapp = (order: Order) => {
    const text = generateShareText(order);
    const encodedText = encodeURIComponent(text);
    const cleanPhone = getCleanWhatsapp(order.customerWhatsapp);
    
    const url = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`;
      
    window.open(url, "_blank");
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.id.toLowerCase().includes(searchTerm.toLowerCase());

    let orderDate = new Date();
    if (o.createdAt) {
      if (typeof o.createdAt.toDate === "function")
        orderDate = o.createdAt.toDate();
      else if (o.createdAt instanceof Date) orderDate = o.createdAt;
      else if (o.createdAt?.seconds)
        orderDate = new Date(o.createdAt.seconds * 1000);
      else {
        const d = new Date(o.createdAt);
        if (!isNaN(d.getTime())) orderDate = d;
      }
    }

    const matchesTab =
      activeTab === "geral" ||
      (activeTab === "abertos" &&
        !["ENTREGUE", "CANCELADO", "entregue", "cancelado"].includes(
          o.status,
        )) ||
      (activeTab === "hoje" && isToday(orderDate));
    return matchesSearch && matchesTab;
  });

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-red-600" size={40} />
        <span className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Monitorando Pedidos...
        </span>
      </div>
    );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">
            Gerenciamento de Pedidos
          </h1>
          <p className="text-sm text-slate-400">
            Acompanhe e finalize as vendas da loja.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={handleCheckExpired} 
            disabled={checkingExpired}
            className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-full h-10 px-4"
          >
            {checkingExpired ? "Verificando..." : "Verificar Pedidos Expirados"}
          </Button>
          <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 border rounded-full shadow-sm text-[10px] font-black uppercase tracking-widest text-green-600 border-green-100 italic">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            Tempo Real Ativado
          </div>
        </div>
      </header>

      {/* Metrics Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-4 rounded-3xl border border-slate-700 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            Total Geral
          </p>
          <p className="text-3xl font-black text-white">{metrics.geral}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-3xl border border-red-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-red-500 tracking-widest">
            Em Aberto
          </p>
          <p className="text-3xl font-black text-red-600">{metrics.abertos}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest">
            Loja Física
          </p>
          <p className="text-3xl font-black text-orange-600">
            {metrics.lojaFisica}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest">
            Loja Online
          </p>
          <p className="text-3xl font-black text-blue-600">
            {metrics.lojaOnline}
          </p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900 p-2 md:rounded-full rounded-2xl border border-slate-700 shadow-sm">
        <div className="flex bg-slate-800 rounded-full p-1 border border-slate-100 w-full md:w-auto">
          {["hoje", "abertos", "geral"].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab as any)}
              className={cn(
                "flex-1 md:flex-none px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                activeTab === tab
                  ? "bg-slate-900 shadow-sm text-red-600"
                  : "text-slate-400 hover:text-slate-300",
              )}
            >
              {tab === "hoje"
                ? "Hoje"
                : tab === "abertos"
                  ? "Abertos"
                  : "Geral"}
            </button>
          ))}
        </div>

        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto px-2 pb-2 md:pb-0 items-center">
          <select
            value={datePeriod}
            onChange={(e) => handleDatePeriodChange(e.target.value as any)}
            className={cn(
              "bg-slate-800 border border-slate-700 rounded-full h-10 px-4 text-[10px] font-black uppercase tracking-widest outline-none transition-all w-full md:w-auto",
              activeTab === "hoje" ? "text-slate-500 opacity-50 cursor-not-allowed hidden md:block" : "text-slate-300"
            )}
            disabled={activeTab === "hoje"}
          >
            <option value="tudo">Todos Períodos</option>
            <option value="hoje">Hoje</option>
            <option value="semana">Esta Semana</option>
            <option value="mes">Este Mês</option>
            <option value="ano">Este Ano</option>
            <option value="personalizado">Personalizado</option>
          </select>

          {datePeriod === "personalizado" && (
            <div className="flex items-center gap-1.5 w-full md:w-auto">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-full h-10 px-3 text-[10px] font-black uppercase tracking-widest text-white outline-none w-full md:w-auto"
              />
              <span className="text-slate-500 font-bold text-[10px]">A</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-full h-10 px-3 text-[10px] font-black uppercase tracking-widest text-white outline-none w-full md:w-auto"
              />
            </div>
          )}

          <div className="relative flex-1 md:w-56">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <Input
              placeholder="PROCURAR..."
              className="pl-9 h-10 w-full bg-slate-800 rounded-full border-slate-700 uppercase font-black text-[10px] tracking-widest"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs uppercase font-bold min-w-[1000px]">
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">
                  PEDIDO
                </th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">
                  TIPO
                </th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">
                  CLIENTE
                </th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">
                  TOTAL
                </th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">
                  STATUS
                </th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest text-right">
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-20 text-center text-slate-400 italic"
                  >
                    Nenhum pedido encontrado.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-800/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-mono text-[10px] text-slate-400 mb-1 tracking-tighter">
                        #{order.id.slice(-6).toUpperCase()}
                      </div>
                      <div className="font-black text-slate-200">
                        {formatOrderDate(order.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase",
                          order.type === "pdv"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700",
                        )}
                      >
                        {order.type === "pdv" ? (
                          <Monitor size={10} />
                        ) : (
                          <Smartphone size={10} />
                        )}
                        {order.type === "pdv" ? "Loja Física" : "Venda Online"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-slate-400">
                          <User size={14} />
                        </div>
                        <div>
                          <div className="font-black text-white leading-tight mb-1 whitespace-normal break-words max-w-[200px]">
                            {order.customerName}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono italic">
                            {order.customerWhatsapp}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-black text-white">
                        {formatCurrency(order.total)}
                      </div>
                      <div className="text-[9px] text-red-600 tracking-widest block max-w-[120px] truncate-tight flex items-center gap-1">
                        {(order.paymentProvider === "mercado_pago" || order.paymentMethod?.toLowerCase().includes("pix") || order.paymentMethod === "online_payment") && (
                           <img src={MERCADO_PAGO_LOGO_BASE64} alt="Mercado Pago" className="w-3 h-3" referrerPolicy="no-referrer" />
                        )}
                        {order.paymentMethodNameSnapshot || order.paymentMethod || "A DEFINIR"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                          statusColors[order.status] ||
                            "bg-slate-950 text-slate-100",
                        )}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-full hover:bg-slate-900 hover:shadow-sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setViewingDetailsId(order.id);
                          }}
                        >
                          <Eye size={16} className="text-slate-400" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-full hover:bg-emerald-500/10 hover:shadow-sm text-emerald-500"
                          title="Compartilhar no WhatsApp"
                          onClick={() => handleShareWhatsapp(order)}
                        >
                          <Share2 size={16} />
                        </Button>

                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-full hover:bg-slate-900 hover:shadow-sm"
                            disabled={
                              order.status === "ENTREGUE" ||
                              order.status === "entregue" ||
                              order.status === "CANCELADO" ||
                              order.status === "cancelado" ||
                              (order.status === "AGUARDANDO_PAGAMENTO" && (order.paymentMethod?.toLowerCase().includes("pix") || order.paymentProvider === "mercado_pago" || order.paymentMethod === "online_payment"))
                            }
                            onClick={() =>
                              navigate(`/admin/pdv?orderId=${order.id}`)
                            }
                          >
                            <Edit2 size={16} className="text-slate-400" />
                          </Button>
                        )}

                        <div className="w-px h-6 bg-slate-950 mx-1"></div>

                        {canEdit ? (
                          <select
                            className="bg-slate-800 border-none rounded-lg px-2 py-1.5 text-[9px] font-black uppercase tracking-widest focus:ring-1 focus:ring-red-500 text-slate-300 outline-none disabled:opacity-50"
                            value={order.status}
                            disabled={
                              order.status === "ENTREGUE" ||
                              order.status === "CANCELADO" ||
                              order.status === "entregue" ||
                              (order.status === "AGUARDANDO_PAGAMENTO" && (order.paymentMethod?.toLowerCase().includes("pix") || order.paymentProvider === "mercado_pago" || order.paymentMethod === "online_payment"))
                            }
                            onChange={(e) =>
                              updateStatus(order.id, e.target.value)
                            }
                          >
                            <option value="NOVO">Novo</option>
                            <option value="AGUARDANDO RETIRADA">
                              Pedente Retirada
                            </option>
                            <option value="SAIU PARA ENTREGA">
                              Saiu p/ Entrega
                            </option>
                            {(canApprove && order.type !== "online") || (order.type === "online" && (order.paymentMethod?.toLowerCase().includes("pix") || order.paymentProvider === "mercado_pago" || order.paymentMethod === "online_payment")) ? (
                              <option value="ENTREGUE">Entregue</option>
                            ) : null}
                            {canCancel && (
                              <option value="CANCELADO">Cancelar</option>
                            )}
                          </select>
                        ) : (
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                            Apenas Visualizar
                          </div>
                        )}

                        <div className="flex items-center gap-1 ml-2 border-l border-slate-100 pl-2">
                          {(order.status === "ENTREGUE" || order.status === "entregue") && canCancel && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700"
                              title="Cancelar Pedido Entregue"
                              onClick={() => handleCancelDelivered(order)}
                            >
                              <XCircle size={16} />
                            </Button>
                          )}
                          {canReverseOrder(order, activeSession) &&
                            (canEdit || canCancel) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 rounded-full hover:bg-yellow-500/10 text-yellow-500 hover:text-yellow-600"
                              title="Estornar Pedido (Reversão Profissional)"
                              disabled={reversingId === order.id}
                              onClick={() => handleReverseOrder(order)}
                            >
                              {reversingId === order.id ? (
                                <Loader2 className="animate-spin" size={16} />
                              ) : (
                                <RotateCcw size={16} />
                              )}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-8 h-8 rounded-full hover:bg-slate-950 text-slate-400 hover:text-red-600"
                              title="Apagar Pedido"
                              onClick={() => handleDeleteOrder(order)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {hasMore && orders.length >= limitCount && (
            <div className="p-4 flex justify-center border-t border-slate-100 bg-slate-800/50">
              <Button
                variant="outline"
                onClick={() => setLimitCount((prev) => prev + 10)}
                className="rounded-full bg-slate-900 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white border-slate-700"
              >
                Carregar mais 10...
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {viewingDetailsId && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setViewingDetailsId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="h-2 bg-red-600 shrink-0"></div>
              <div className="p-4 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                <div className="flex justify-between items-start mb-6 md:mb-8">
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                      Pedido #{selectedOrder.id.slice(-6).toUpperCase()}
                    </h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                      {formatOrderDate(
                        selectedOrder.createdAt,
                        "dd 'de' MMMM 'às' HH:mm",
                      )}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewingDetailsId(null)}
                  >
                    <X size={24} />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                    <section>
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">
                        Cliente
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-slate-400">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-white">
                            {selectedOrder.customerName || selectedOrder.customer?.name || "Cliente não informado"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {selectedOrder.customerWhatsapp || selectedOrder.customerPhone || selectedOrder.customer?.phone || "Não informado"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-slate-950 text-slate-300 border-slate-800 text-[10px] font-black uppercase tracking-wider h-8 rounded-xl px-3 hover:text-white hover:bg-slate-900"
                          onClick={() => handleCopySummary(selectedOrder)}
                        >
                          {copiedOrderId === selectedOrder.id ? (
                            <>
                              <Check size={12} className="mr-1 text-emerald-550" /> Copiado!
                            </>
                          ) : (
                            <>
                              <Copy size={12} className="mr-1" /> Copiar Resumo
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-emerald-950/20 text-emerald-400 border-emerald-900/45 text-[10px] font-black uppercase tracking-wider h-8 rounded-xl px-3 hover:bg-emerald-950/60 hover:text-emerald-300"
                          onClick={() => handleShareWhatsapp(selectedOrder)}
                        >
                          <Share2 size={12} className="mr-1" /> WhatsApp
                        </Button>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">
                        {isPickupOrder(selectedOrder) ? "Modalidade / Retirada" : "Endereço de Entrega"}
                      </h3>
                      <div className="flex gap-2 text-slate-300">
                        <MapPin
                          size={16}
                          className="shrink-0 mt-0.5 text-slate-400"
                        />
                        <div className="flex flex-col">
                          <p className="text-xs leading-relaxed font-medium">
                            {isPickupOrder(selectedOrder)
                              ? "Retirada em Loja (Balcão)"
                              : formatAddress(selectedOrder.customerAddress || selectedOrder.shippingAddress)}
                          </p>
                          {!isPickupOrder(selectedOrder) && (selectedOrder.deliveryFee || selectedOrder.shipping) ? (
                            <p className="text-[10px] text-slate-400 font-bold mt-1">
                              Taxa de Entrega: {formatCurrency(selectedOrder.deliveryFee || selectedOrder.shipping || 0)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <section>
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">
                        Forma de Pagamento
                      </h3>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-red-600 font-black uppercase italic text-sm tracking-tighter">
                          <CreditCard size={18} />
                          {getFriendlyPaymentMethodName(selectedOrder)}
                        </div>
                        {selectedOrder.paymentStatus && (
                          <div className="text-xs font-bold flex items-center gap-1.5 mt-1">
                            <span className="text-slate-400 text-[10px] uppercase tracking-wider">Situação:</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-black uppercase",
                              selectedOrder.paymentStatus === "approved" || selectedOrder.status === "ENTREGUE" || selectedOrder.status === "CONCLUIDO" 
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                                : selectedOrder.paymentStatus === "pending" || selectedOrder.paymentStatus === "in_process"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : selectedOrder.paymentStatus === "rejected"
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-slate-800 text-slate-300"
                            )}>
                              {selectedOrder.paymentStatus === "approved" || selectedOrder.status === "ENTREGUE" || selectedOrder.status === "CONCLUIDO"
                                ? "Confirmado / Pago"
                                : selectedOrder.paymentStatus === "pending" || selectedOrder.paymentStatus === "in_process"
                                ? "Aguardando Confirmação"
                                : selectedOrder.paymentStatus === "rejected"
                                ? "Rejeitado"
                                : selectedOrder.paymentStatus === "refunded"
                                ? "Estornado"
                                : selectedOrder.paymentStatus}
                            </span>
                          </div>
                        )}
                        {getOrderPaymentId(selectedOrder) && (
                          <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                            ID Transação: {getOrderPaymentId(selectedOrder)}
                          </span>
                        )}
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">
                        Status Atual do Pedido
                      </h3>
                      <span
                        className={cn(
                          "px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase",
                          statusColors[selectedOrder.status] || "bg-slate-950",
                        )}
                      >
                        {selectedOrder.status}
                      </span>
                    </section>
                  </div>
                </div>

                <section className="mb-8">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-4">
                    Itens do Pedido
                  </h3>
                  <div className="bg-slate-800 rounded-2xl p-4 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {selectedOrder.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-start md:items-center text-sm py-2 border-b border-slate-700 last:border-0 gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 shrink-0 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-black text-red-600">
                            {item.quantity}x
                          </span>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200 uppercase leading-tight">
                              {item.name}
                            </span>
                            {item.variantId && (
                              <span className="text-[10px] text-red-600 font-bold uppercase">
                                {item.attributes ? Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' | ') : formatVariantName(item.name)}
                              </span>
                            )}
                            {item.sku && (
                              <span className="text-[10px] text-slate-500 font-mono tracking-tighter">
                                SKU: {item.sku}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-bold text-white shrink-0">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {selectedOrder.scheduledDate && (
                  <section className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <h3 className="text-[10px] font-black uppercase text-red-600 tracking-[3px] mb-3 flex items-center gap-2">
                      <Clock size={14} /> {isPickupOrder(selectedOrder) ? "Retirada Agendada" : "Entrega Agendada"}
                    </h3>
                    <div className="flex flex-col">
                      <p className="text-xl font-black text-red-600 tracking-tighter">
                        {selectedOrder.scheduledDate
                          .split("-")
                          .reverse()
                          .join("/")}{" "}
                        @ {selectedOrder.scheduledTime}h
                      </p>
                      <p className="text-[10px] font-black uppercase text-red-400 tracking-widest mt-1 italic">
                        O cliente receberá/retirará no horário selecionado.
                      </p>
                    </div>
                  </section>
                )}

                {selectedOrder.notes && (
                  <section className="mb-8 p-4 bg-yellow-50 border border-yellow-100 rounded-2xl">
                    <h3 className="text-[9px] font-black uppercase text-yellow-600 tracking-widest mb-1 italic">
                      Observações do Cliente
                    </h3>
                    <p className="text-xs text-yellow-800 font-medium italic">
                      "{selectedOrder.notes}"
                    </p>
                  </section>
                )}

                {/* Desconto & Autorização */}
                {selectedOrder.discount && selectedOrder.discount > 0 ? (
                  <section className="mb-8 p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-[10px] font-black uppercase text-emerald-400 tracking-[3px] flex items-center gap-1.5">
                        Desconto Aplicado: {formatCurrency(selectedOrder.discount)} ({getEffectiveDiscountPercentage(selectedOrder.subTotal || selectedOrder.subtotal || selectedOrder.total + selectedOrder.discount, selectedOrder.discount)})
                      </h3>
                    </div>
                    {selectedOrder.discountAuthorizationId ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mt-2 pt-2 border-t border-emerald-500/20">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Autorizado por</span>
                          <span className="font-bold text-slate-200">
                            {selectedOrder.discountAuthorizedBy || "Supervisor"} ({selectedOrder.discountAuthorizedByRole?.toUpperCase() || "GERENTE"})
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Motivo</span>
                          <span className="font-bold text-slate-200">
                            {selectedOrder.discountReason || "Não informado"}
                          </span>
                        </div>
                        {selectedOrder.discountNote && (
                          <div className="col-span-1 sm:col-span-2 text-xs italic text-slate-400">
                            Obs: "{selectedOrder.discountNote}"
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-400 italic">
                        Desconto concedido dentro do limite operacional do operador (não exigiu autorização prévia por PIN).
                      </p>
                    )}
                  </section>
                ) : null}

                {/* Histórico e Auditoria */}
                <section className="mb-8">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3 flex items-center gap-2">
                    <History size={14} /> Histórico do Pedido
                  </h3>
                  {orderLogs.length === 0 ? (
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-500 italic">
                      Nenhum evento registrado até o momento.
                    </div>
                  ) : (
                    <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 space-y-3 max-h-52 overflow-y-auto custom-scrollbar">
                      {orderLogs.map((log) => (
                        <div key={log.id} className="text-xs border-b border-slate-800/60 last:border-0 pb-2 last:pb-0 space-y-1">
                          <div className="flex justify-between items-center text-slate-400 text-[11px]">
                            <span className="font-bold text-slate-300">{log.userName}</span>
                            <span>{formatLogDate(log.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-red-500 uppercase text-[10px] tracking-wider">
                              {log.action}
                            </span>
                            {log.previousStatus && log.newStatus && (
                              <span className="text-[11px] text-slate-400">
                                ({log.previousStatus} ➔ {log.newStatus})
                              </span>
                            )}
                          </div>
                          {log.reason && (
                            <p className="text-slate-300 font-medium text-[11px]">
                              Motivo: <span className="italic">{log.reason}</span>
                            </p>
                          )}
                          {log.note && (
                            <p className="text-slate-400 italic text-[10px]">
                              Obs: "{log.note}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="flex justify-between items-center p-6 bg-slate-900 text-white rounded-3xl">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center gap-4 min-w-[200px]">
                      <p className="text-[10px] font-black uppercase text-white/40 tracking-[2px]">
                        Subtotal
                      </p>
                      <p className="text-sm font-bold tracking-tighter">
                        {formatCurrency(selectedOrder.subTotal || selectedOrder.subtotal || selectedOrder.items.reduce((acc, item) => acc + item.price * item.quantity, 0))}
                      </p>
                    </div>
                    {selectedOrder.discount && selectedOrder.discount > 0 ? (
                      <div className="flex justify-between items-center gap-4">
                        <p className="text-[10px] font-black uppercase text-emerald-400 tracking-[2px]">
                          Desconto
                        </p>
                        <p className="text-sm font-bold text-emerald-400 tracking-tighter">
                          -{formatCurrency(selectedOrder.discount)}
                        </p>
                      </div>
                    ) : null}
                    {(selectedOrder.deliveryFee || selectedOrder.shipping) ? (
                      <div className="flex justify-between items-center gap-4">
                        <p className="text-[10px] font-black uppercase text-white/60 tracking-[2px]">
                          Taxa de Entrega
                        </p>
                        <p className="text-sm font-bold text-white/80 tracking-tighter">
                          +{formatCurrency(selectedOrder.deliveryFee || selectedOrder.shipping || 0)}
                        </p>
                      </div>
                    ) : null}
                    {selectedOrder.additionalAmount &&
                      selectedOrder.additionalAmount > 0 && (
                        <div className="flex justify-between items-center gap-4">
                          <p className="text-[10px] font-black uppercase text-green-500 tracking-[2px]">
                            Acréscimo Financeiro
                          </p>
                          <p className="text-sm font-bold text-green-500 tracking-tighter">
                            +{formatCurrency(selectedOrder.additionalAmount)}
                          </p>
                        </div>
                      )}
                    <div className="flex justify-between items-center gap-4 pt-2 border-t border-white/10">
                      <p className="text-[10px] font-black uppercase text-red-500 tracking-[3px]">
                        Total do Pedido
                      </p>
                      <p className="text-2xl font-black italic tracking-tighter">
                        {formatCurrency(
                          selectedOrder.financialReceivedAmount ||
                            selectedOrder.total,
                        )}
                      </p>
                    </div>
                    {selectedOrder.change && selectedOrder.change > 0 ? (
                      <div className="flex justify-between items-center gap-4 pt-1">
                        <p className="text-[10px] font-black uppercase text-amber-400 tracking-[2px]">
                          Troco
                        </p>
                        <p className="text-xs font-bold text-amber-400 tracking-tighter">
                          {formatCurrency(selectedOrder.change)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {(selectedOrder.status === "ENTREGUE" || selectedOrder.status === "entregue") && canCancel && (
                      <Button
                        onClick={() => handleCancelDelivered(selectedOrder)}
                        className="bg-red-600 hover:bg-red-700 text-white font-black uppercase italic text-[10px] tracking-widest px-4 h-12 rounded-2xl shrink-0"
                      >
                        <XCircle size={18} className="mr-2" /> Cancelar
                      </Button>
                    )}
                    {canReverseOrder(selectedOrder, activeSession) &&
                      (canEdit || canCancel) && (
                      <Button
                        onClick={() => handleReverseOrder(selectedOrder)}
                        disabled={reversingId === selectedOrder.id}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-black uppercase italic text-[10px] tracking-widest px-4 h-12 rounded-2xl shrink-0"
                      >
                        {reversingId === selectedOrder.id ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <RotateCcw size={18} className="mr-2" />
                        )}
                        Estornar Pedido
                      </Button>
                    )}
                    {canPrint && (
                      <Button
                        onClick={handlePrint}
                        className="bg-slate-900 hover:bg-slate-200 text-white font-black uppercase italic text-xs tracking-widest px-6 h-12 rounded-2xl w-full"
                      >
                        <Printer className="mr-2" size={18} /> Imprimir Cupom
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setEditingOrder(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden p-8"
            >
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-6">
                Editar Pedido
              </h2>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    Nome do Cliente
                  </label>
                  <Input
                    value={editingOrder.customerName}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        customerName: e.target.value,
                      })
                    }
                    className="h-12 border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    WhatsApp
                  </label>
                  <Input
                    value={editingOrder.customerWhatsapp}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        customerWhatsapp: e.target.value,
                      })
                    }
                    className="h-12 border-slate-700 font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    Endereço Completo
                  </label>
                  <textarea
                    value={editingOrder.customerAddress}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        customerAddress: e.target.value,
                      })
                    }
                    className="w-full min-h-[100px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs font-medium focus:ring-1 focus:ring-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">
                    Notas / Obs
                  </label>
                  <textarea
                    value={editingOrder.notes || ""}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        notes: e.target.value,
                      })
                    }
                    className="w-full min-h-[60px] bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs font-medium italic outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest"
                  onClick={() => setEditingOrder(null)}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest"
                  onClick={handleSaveEdit}
                >
                  <Save className="mr-2" size={18} /> Salvar Alterações
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Thermal Receipt for Print Extraction */}
      <div className="hidden">
        <div ref={printRef} className="thermal-receipt">
          <div
            className="text-center font-bold"
            style={{ fontSize: "15px", marginBottom: "5px" }}
          >
            DISCRETA BOUTIQUE
          </div>
          <div
            className="text-center"
            style={{ fontSize: "11px", marginBottom: "5px" }}
          >
            Sua boutique especializada em momentos inesquecíveis.
          </div>
          <div className="divider"></div>
          {selectedOrder && (
            <>
              <div className="header-info">
                <div>PEDIDO: #{selectedOrder.id.slice(-6).toUpperCase()}</div>
                <div>
                  DATA:{" "}
                  {formatOrderDate(selectedOrder.createdAt, "dd/MM/yyyy HH:mm")}
                </div>
                <div>
                  MODALIDADE: {selectedOrder.type === "pdv" ? "BALCAO" : "ONLINE"} ({isPickupOrder(selectedOrder) ? "RETIRADA" : "ENTREGA"})
                </div>
                {selectedOrder.scheduledDate && (
                  <div style={{ fontWeight: "bold" }}>
                    <span style={{ fontWeight: 900 }}>AGENDAMENTO:</span>
                    <br />
                    <span style={{ fontWeight: 900, fontSize: "14px" }}>
                      {selectedOrder.scheduledDate.split("-").reverse().join("/")}{" "}
                      @ {selectedOrder.scheduledTime}h
                    </span>
                  </div>
                )}
              </div>
              <div className="divider"></div>
              <div className="font-bold">CLIENTE:</div>
              <div>{selectedOrder.customerName || selectedOrder.customer?.name || "Cliente não informado"}</div>
              <div>{selectedOrder.customerWhatsapp || selectedOrder.customerPhone || "Não informado"}</div>
              <div style={{ marginTop: "5px" }}>
                {isPickupOrder(selectedOrder) ? "RETIRADA EM LOJA" : `ENDERECO: ${formatAddress(selectedOrder.customerAddress || selectedOrder.shippingAddress)}`}
              </div>
              <div className="divider"></div>
              <table>
                <thead>
                  <tr>
                    <th>QTD</th>
                    <th>DESC</th>
                    <th style={{ textAlign: "right" }}>VAL</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td style={{ verticalAlign: "top" }}>{item.quantity}</td>
                      <td>
                        {item.name}
                        {(item.sku || item.gtin) && (
                          <div style={{ fontSize: "10px" }}>
                            {item.sku ? `SKU: ${item.sku}` : ""}
                            {item.sku && item.gtin ? " | " : ""}
                            {item.gtin ? `EAN: ${item.gtin}` : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right", verticalAlign: "top" }}>
                        {formatCurrency(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divider"></div>
              <div className="totals">
                <div
                  className="item"
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subTotal || selectedOrder.subtotal || selectedOrder.items.reduce((acc, item) => acc + item.price * item.quantity, 0))}</span>
                </div>
                {!isPickupOrder(selectedOrder) && (selectedOrder.deliveryFee || selectedOrder.shipping) ? (
                  <div
                    className="item"
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span>Taxa Entrega:</span>
                    <span>{formatCurrency(selectedOrder.deliveryFee || selectedOrder.shipping || 0)}</span>
                  </div>
                ) : null}
                {selectedOrder.discount && selectedOrder.discount > 0 ? (
                  <>
                    <div
                      className="item"
                      style={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <span>Desconto:</span>
                      <span>-{formatCurrency(selectedOrder.discount)}</span>
                    </div>
                    {selectedOrder.discountAuthorizationId && (
                      <div
                        style={{ fontSize: "10px", color: "#555", marginTop: "2px", marginBottom: "4px" }}
                      >
                        Autorizado por: {selectedOrder.discountAuthorizedBy || "Supervisor"} ({selectedOrder.discountReason || "Motivo N/I"})
                      </div>
                    )}
                  </>
                ) : null}
                <div
                  className="item"
                  style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "4px", borderTop: "1px dashed #ccc" }}
                >
                  <span style={{ fontWeight: "bold" }}>Total:</span>
                  <span style={{ fontWeight: "bold" }}>{formatCurrency(selectedOrder.total)}</span>
                </div>
                {selectedOrder.additionalAmount &&
                  selectedOrder.additionalAmount > 0 && (
                    <div
                      className="item"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>Acréscimo:</span>
                      <span>
                        +{formatCurrency(selectedOrder.additionalAmount)}
                      </span>
                    </div>
                  )}
                <div
                  className="item"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: "bold",
                    fontSize: "14px",
                    marginTop: "5px",
                    borderTop: "1px dashed #ccc",
                    paddingTop: "5px",
                  }}
                >
                  <span>TOTAL RECEBIDO:</span>
                  <span>
                    {formatCurrency(
                      selectedOrder.financialReceivedAmount ||
                        selectedOrder.total,
                    )}
                  </span>
                </div>
                {selectedOrder.change && selectedOrder.change > 0 ? (
                  <div
                    className="item"
                    style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "2px" }}
                  >
                    <span>Troco:</span>
                    <span>{formatCurrency(selectedOrder.change)}</span>
                  </div>
                ) : null}
              </div>
              <div className="divider"></div>
              <div className="font-bold">FORMA DE PAGTO:</div>
              {selectedOrder.payments && selectedOrder.payments.length > 0 ? (
                <div>
                  {selectedOrder.payments.map((p, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                      <span>- {p.method}</span>
                      <span>{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div>{getFriendlyPaymentMethodName(selectedOrder)}</div>
              )}
              <div style={{ marginTop: "4px", fontSize: "10px", fontWeight: "bold" }}>
                SITUAÇÃO: {selectedOrder.paymentStatus === "approved" || selectedOrder.status === "ENTREGUE" || selectedOrder.status === "CONCLUIDO" ? "PAGAMENTO CONFIRMADO" : "PENDENTE / A RECEBER"}
              </div>
              {selectedOrder.notes && (
                <>
                  <div style={{ marginTop: "5px", fontStyle: "italic" }}>
                    OBS: {selectedOrder.notes}
                  </div>
                </>
              )}
              <div className="divider"></div>
              <div className="footer">
                OBRIGADO PELA PREFERENCIA!
                <br />
                Siga-nos no Instagram @discretaico
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
