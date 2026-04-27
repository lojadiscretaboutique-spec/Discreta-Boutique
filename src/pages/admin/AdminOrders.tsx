import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, getDocs, where, limit, getCountFromServer } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency, cn } from '../../lib/utils';
import { format, isToday, startOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { 
  Eye, Printer, Edit2, X, Save, 
  Search, Monitor, Smartphone, User, MapPin, CreditCard, Clock, Trash2, XCircle
} from 'lucide-react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { stockMovementService } from '../../services/stockMovementService';
import { financialService } from '../../services/financialService';
import { cashService } from '../../services/cashService';

import { useNavigate } from 'react-router-dom';

interface OrderItem {
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
}

interface Order {
  id: string;
  createdAt: { toDate: () => Date } | null | any;
  customerName: string;
  customerWhatsapp: string;
  customerAddress: string;
  items: OrderItem[];
  notes?: string;
  total: number;
  status: string;
  paymentMethod?: string;
  type?: 'online' | 'pdv';
  subTotal?: number;
  deliveryFee?: number;
  discount?: number;
  change?: number;
  scheduledDate?: string;
  scheduledTime?: string;
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [activeTab, setActiveTab] = useState<'hoje' | 'abertos' | 'geral'>('geral');
  const [datePeriod, setDatePeriod] = useState<'hoje' | 'semana' | 'mes' | 'ano' | 'tudo'>('tudo');
  const [limitCount, setLimitCount] = useState(10);
  const [metrics, setMetrics] = useState({ geral: 0, abertos: 0, lojaFisica: 0, lojaOnline: 0 });
  const [hasMore, setHasMore] = useState(true);
  
  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [viewingDetailsId, setViewingDetailsId] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  
  const { toast, confirm } = useFeedback();
  const { hasPermission } = useAuthStore();
  const printRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const canEdit = hasPermission('orders', 'editar');
  const canPrint = hasPermission('orders', 'imprimir');
  const canApprove = hasPermission('orders', 'aprovar');
  const canCancel = hasPermission('orders', 'cancelar');
  const canDelete = hasPermission('orders', 'excluir');

  useEffect(() => {
    const loadMetrics = async (dateStart?: Date) => {
      try {
        let qGeral = collection(db, 'orders');
        let qAbertos = query(collection(db, 'orders'), where('status', 'not-in', ['ENTREGUE', 'CANCELADO']));
        let qFisica = query(collection(db, 'orders'), where('type', '==', 'pdv'));
        let qOnline = query(collection(db, 'orders'), where('type', '==', 'online'));
        
        if (dateStart) {
          qGeral = query(collection(db, 'orders'), where('createdAt', '>=', dateStart));
          // we fallback to basic queries to avoid missing index errors when combining where
        }
        
        const [sGeral, sAbertos, sFisica, sOnline] = await Promise.all([
          getCountFromServer(qGeral),
          getCountFromServer(qAbertos),
          getCountFromServer(qFisica),
          getCountFromServer(qOnline)
        ]);
        
        setMetrics({
           geral: sGeral.data().count,
           abertos: sAbertos.data().count,
           lojaFisica: sFisica.data().count,
           lojaOnline: sOnline.data().count
        });
      } catch (err) {
         console.warn("Erro ao buscar contagens:", err);
      }
    };
    
    let dateStart: Date | undefined;
    if (datePeriod === 'hoje') dateStart = startOfDay(new Date());
    else if (datePeriod === 'semana') dateStart = startOfWeek(new Date());
    else if (datePeriod === 'mes') dateStart = startOfMonth(new Date());
    else if (datePeriod === 'ano') dateStart = startOfYear(new Date());
    
    loadMetrics(dateStart);
  }, [datePeriod]);

  useEffect(() => {
    let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(limitCount));
    
    if (datePeriod !== 'tudo') {
       let dateStart = new Date();
       if (datePeriod === 'hoje') dateStart = startOfDay(new Date());
       else if (datePeriod === 'semana') dateStart = startOfWeek(new Date());
       else if (datePeriod === 'mes') dateStart = startOfMonth(new Date());
       else if (datePeriod === 'ano') dateStart = startOfYear(new Date());
       
       q = query(collection(db, 'orders'), where('createdAt', '>=', dateStart), orderBy('createdAt', 'desc'), limit(limitCount));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
      setHasMore(snapshot.docs.length >= limitCount);
      setLoading(false);
    }, (err) => {
      console.error(err);
      toast("Erro ao carregar pedidos.", 'error');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [toast, limitCount, datePeriod]);

  const handleDeleteOrder = async (order: Order) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível realizar exclusões com o caixa fechado.", "error");
      return;
    }

    const confirmed = await confirm({
      title: 'APAGAR PEDIDO',
      message: 'Tem certeza que deseja apagar este pedido? Isso reverterá a reserva de estoque. O pedido só pode ser apagado se não tiver gerado transações financeiras!',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      // Check if financial transactions exist
      const financialQ = query(collection(db, 'financial_transactions'), where('orderId', '==', order.id));
      const financialSnap = await getDocs(financialQ);
      if (!financialSnap.empty) {
         toast("Não é possível apagar! Este pedido já possui registros no Financeiro.", "error");
         return;
      }

      // Revert stock reservations
      await stockMovementService.deleteMovementsByOrderId(order.id);

      // Delete order document
      await deleteDoc(doc(db, 'orders', order.id));

      toast("Pedido apagado com sucesso!", "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao apagar pedido", "error");
    }
  };

  const handleCancelDelivered = async (order: Order) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível cancelar pedidos entregues com o caixa fechado.", "error");
      return;
    }

    const confirmed = await confirm({
      title: 'CANCELAR PEDIDO ENTREGUE',
      message: 'Isso irá gerar uma devolução de estoque para os itens e criar uma transação de estorno no financeiro. Confirmar?',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      // 1. Generate return movement
      for (const item of order.items) {
          await stockMovementService.registerMovement({
              productId: item.productId,
              productName: item.name,
              variantId: item.variantId || undefined,
              sku: item.sku || '',
              quantity: item.quantity,
              type: 'in',
              reason: 'Devolução de Cliente (Cancelamento de Entrega)',
              channel: order.type === 'pdv' ? 'Loja Física' : 'Loja Virtual',
              orderId: order.id,
              status: 'realizada'
          });
      }
      
      // 2. Generate financial reversal
      await financialService.saveTransaction({
          type: 'expense',
          description: `Estorno de Venda - Pedido #${order.id.slice(-6).toUpperCase()}`,
          amount: order.total,
          dueDate: new Date().toISOString().split('T')[0],
          paymentDate: new Date().toISOString().split('T')[0],
          status: 'paid',
          category: 'Estorno de Vendas',
          notes: `Cancelamento de pedido entregue em ${format(new Date(), 'dd/MM/yyyy')}`,
          orderId: order.id
      });

      await updateDoc(doc(db, 'orders', order.id), {
        status: 'CANCELADO',
        updatedAt: serverTimestamp()
      });

      toast(`Pedido cancelado e estornado com sucesso!`, 'success');
      if (viewingDetailsId === order.id) setViewingDetailsId(null);
    } catch (err) {
      console.error(err);
      toast("Erro ao processar cancelamento.", "error");
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível alterar o status do pedido com o caixa fechado.", "error");
      // Reset select input if possible, but the state will update anyway on next render
      return;
    }

    const order = orders.find(o => o.id === id);
    if (!order) return;

    // Prevent changing from specific states manually via this general function
    if (order.status === 'CANCELADO' || order.status === 'ENTREGUE') {
       toast(`Pedido já está com status ${order.status} e não pode ser alterado.`, 'warning');
       return;
    }

    if (newStatus === 'CANCELADO') {
      const confirmed = await confirm({
        title: 'CANCELAR PEDIDO',
        message: 'Tem certeza que deseja cancelar este pedido? Isso reverterá as reservas de estoque.',
        variant: 'danger'
      });
      if (!confirmed) return;

      try {
         await stockMovementService.deleteMovementsByOrderId(id);
         await financialService.deleteTransactionsByOrderId(id);

         await updateDoc(doc(db, 'orders', id), {
          status: 'CANCELADO',
          updatedAt: serverTimestamp()
         });

         toast(`Pedido cancelado com sucesso!`, 'success');
         return;
      } catch (err) {
        console.error(err);
        toast("Erro ao processar cancelamento.", 'error');
        return;
      }
    }

    try {
      if (newStatus === 'ENTREGUE' && order.type === 'online') {
         toast("Pedidos online só podem ser finalizados pelo PDV.", "warning");
         return;
      }

      await updateDoc(doc(db, 'orders', id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      if (newStatus === 'ENTREGUE') {
        await stockMovementService.realizeMovementsByOrderId(id);
      }
      
      toast(`Pedido atualizado!`, 'success');
    } catch (err) {
      console.error(err);
      toast("Erro ao atualizar", 'error');
    }
  };


  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'width=300,height=600');
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
      await updateDoc(doc(db, 'orders', id), {
        ...data,
        updatedAt: new Date()
      });
      toast("Pedido atualizado com sucesso!");
      setEditingOrder(null);
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar alterações", "error");
    }
  };

  const statusColors: Record<string, string> = {
    'NOVO': 'bg-blue-100 text-blue-800',
    'AGUARDANDO RETIRADA': 'bg-amber-100 text-amber-800',
    'SAIU PARA ENTREGA': 'bg-purple-100 text-purple-800',
    'ENTREGUE': 'bg-green-100 text-green-800',
    'CANCELADO': 'bg-red-100 text-red-800',
    // Fallbacks
    'recebido': 'bg-blue-100 text-blue-800',
    'preparando': 'bg-yellow-100 text-yellow-800',
    'saiu para entrega': 'bg-purple-100 text-purple-800',
    'entregue': 'bg-green-100 text-green-800',
    'cancelado': 'bg-red-100 text-red-800',
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'geral' || 
      (activeTab === 'abertos' && !['ENTREGUE', 'CANCELADO', 'entregue', 'cancelado'].includes(o.status)) ||
      (activeTab === 'hoje' && isToday(o.createdAt?.toDate ? o.createdAt.toDate() : new Date()));
    return matchesSearch && matchesTab;
  });

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="animate-spin text-red-600" size={40} />
      <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Monitorando Pedidos...</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tight">Gerenciamento de Pedidos</h1>
          <p className="text-sm text-slate-400">Acompanhe e finalize as vendas da loja.</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 border rounded-full shadow-sm text-[10px] font-black uppercase tracking-widest text-green-600 border-green-100 italic">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          Tempo Real Ativado
        </div>
      </header>

      {/* Metrics Blocks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 p-4 rounded-3xl border border-slate-700 shadow-sm">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Geral</p>
          <p className="text-3xl font-black text-white">{metrics.geral}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-3xl border border-red-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-red-500 tracking-widest">Em Aberto</p>
          <p className="text-3xl font-black text-red-600">{metrics.abertos}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-3xl border border-orange-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Loja Física</p>
          <p className="text-3xl font-black text-orange-600">{metrics.lojaFisica}</p>
        </div>
        <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100 shadow-sm">
          <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Loja Online</p>
          <p className="text-3xl font-black text-blue-600">{metrics.lojaOnline}</p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900 p-2 md:rounded-full rounded-2xl border border-slate-700 shadow-sm">
         <div className="flex bg-slate-800 rounded-full p-1 border border-slate-100 w-full md:w-auto">
            {['hoje', 'abertos', 'geral'].map(tab => (
               <button 
                 key={tab} 
                 onClick={() => setActiveTab(tab as any)}
                 className={cn(
                   "flex-1 md:flex-none px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                   activeTab === tab ? "bg-slate-900 shadow-sm text-red-600" : "text-slate-400 hover:text-slate-300"
                 )}
               >
                  {tab === 'hoje' ? 'Hoje' : tab === 'abertos' ? 'Abertos' : 'Geral'}
               </button>
            ))}
         </div>
         
         <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto px-2 pb-2 md:pb-0">
            <select 
               value={datePeriod}
               onChange={(e) => setDatePeriod(e.target.value as any)}
               className="bg-slate-800 border border-slate-700 rounded-full h-10 px-4 text-[10px] font-black uppercase tracking-widest outline-none text-slate-300 w-full md:w-auto"
            >
               <option value="tudo">Todos Períodos</option>
               <option value="hoje">Hoje</option>
               <option value="semana">Esta Semana</option>
               <option value="mes">Este Mês</option>
               <option value="ano">Este Ano</option>
            </select>
            
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <Input 
                placeholder="PROCURAR..." 
                className="pl-9 h-10 w-full bg-slate-800 rounded-full border-slate-700 uppercase font-black text-[10px] tracking-widest"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
         </div>
      </div>

      <div className="bg-slate-900 rounded-3xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs uppercase font-bold min-w-[1000px]">
            <thead className="bg-slate-800 border-b border-slate-700">
              <tr>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">PEDIDO</th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">TIPO</th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">CLIENTE</th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">TOTAL</th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest">STATUS</th>
                <th className="px-6 py-5 font-black text-slate-400 tracking-widest text-right">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 italic">Nenhum pedido encontrado.</td></tr>
              ) : filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-800/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-mono text-[10px] text-slate-400 mb-1 tracking-tighter">#{order.id.slice(-6).toUpperCase()}</div>
                    <div className="font-black text-slate-200">
                      {order.createdAt?.toDate ? format(order.createdAt.toDate(), "dd/MM - HH:mm") : '...'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase",
                      order.type === 'pdv' ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    )}>
                      {order.type === 'pdv' ? <Monitor size={10} /> : <Smartphone size={10} />}
                      {order.type === 'pdv' ? 'Loja Física' : 'Venda Online'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-slate-400">
                         <User size={14} />
                       </div>
                       <div>
                         <div className="font-black text-white leading-tight mb-1 whitespace-normal break-words max-w-[200px]">{order.customerName}</div>
                         <div className="text-[10px] text-zinc-400 font-mono italic">{order.customerWhatsapp}</div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-white">{formatCurrency(order.total)}</div>
                    <div className="text-[9px] text-red-600 tracking-widest">{order.paymentMethod || 'A DEFINIR'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                      statusColors[order.status] || 'bg-slate-950 text-slate-100'
                    )}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex justify-end items-center gap-1">
                        <Button 
                          variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-slate-900 hover:shadow-sm"
                          onClick={() => { setSelectedOrder(order); setViewingDetailsId(order.id); }}
                        >
                          <Eye size={16} className="text-slate-400" />
                        </Button>
                        
                        {canEdit && (
                          <Button 
                            variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-slate-900 hover:shadow-sm"
                            disabled={order.status === 'ENTREGUE' || order.status === 'entregue' || order.status === 'CANCELADO' || order.status === 'cancelado'}
                            onClick={() => navigate(`/admin/pdv?orderId=${order.id}`)}
                          >
                            <Edit2 size={16} className="text-slate-400" />
                          </Button>
                        )}

                        <div className="w-px h-6 bg-slate-950 mx-1"></div>
                        
                        {canEdit ? (
                          <select 
                              className="bg-slate-800 border-none rounded-lg px-2 py-1.5 text-[9px] font-black uppercase tracking-widest focus:ring-1 focus:ring-red-500 text-slate-300 outline-none disabled:opacity-50"
                              value={order.status}
                              disabled={order.status === 'ENTREGUE' || order.status === 'CANCELADO' || order.status === 'entregue'}
                              onChange={(e) => updateStatus(order.id, e.target.value)}
                           >
                             <option value="NOVO">Novo</option>
                             <option value="AGUARDANDO RETIRADA">Pedente Retirada</option>
                             <option value="SAIU PARA ENTREGA">Saiu p/ Entrega</option>
                             {canApprove && order.type !== 'online' && <option value="ENTREGUE">Entregue</option>}
                             {canCancel && <option value="CANCELADO">Cancelar</option>}
                          </select>
                        ) : (
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                             Apenas Visualizar
                          </div>
                        )}

                        <div className="flex items-center gap-1 ml-2 border-l border-slate-100 pl-2">
                           {order.status === 'ENTREGUE' && canEdit && (
                              <Button
                                variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-red-50 text-red-500 hover:text-red-700"
                                title="Cancelar Pedido Entregue (Estorno)"
                                onClick={() => handleCancelDelivered(order)}
                              >
                                <XCircle size={16} />
                              </Button>
                           )}
                           {canDelete && (
                              <Button
                                variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-slate-950 text-slate-400 hover:text-red-600"
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
              ))}
            </tbody>
          </table>
          
          {hasMore && orders.length >= limitCount && (
            <div className="p-4 flex justify-center border-t border-slate-100 bg-slate-800/50">
              <Button 
                variant="outline" 
                onClick={() => setLimitCount(prev => prev + 10)}
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
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
               onClick={() => setViewingDetailsId(null)}
             />
             <motion.div 
               initial={{ opacity: 0, scale: 0.9, y: 20 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.9, y: 20 }}
               className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
             >
                <div className="h-2 bg-red-600"></div>
                <div className="p-8">
                   <div className="flex justify-between items-start mb-8">
                     <div>
                       <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Pedido #{selectedOrder.id.slice(-6).toUpperCase()}</h2>
                       <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                         {selectedOrder.createdAt?.toDate ? format(selectedOrder.createdAt.toDate(), "dd 'de' MMMM 'às' HH:mm") : '--'}
                       </p>
                     </div>
                     <Button variant="ghost" size="icon" onClick={() => setViewingDetailsId(null)}>
                        <X size={24} />
                     </Button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="space-y-6">
                         <section>
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">Cliente</h3>
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-slate-400">
                                 <User size={20} />
                               </div>
                               <div>
                                 <p className="font-bold text-white">{selectedOrder.customerName}</p>
                                 <p className="text-xs text-slate-400">{selectedOrder.customerWhatsapp}</p>
                               </div>
                            </div>
                         </section>

                         <section>
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">Endereço</h3>
                            <div className="flex gap-2 text-slate-300">
                               <MapPin size={16} className="shrink-0 mt-0.5 text-slate-400" />
                               <p className="text-xs leading-relaxed font-medium">{selectedOrder.customerAddress}</p>
                            </div>
                         </section>
                      </div>

                      <div className="space-y-6">
                         <section>
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">Pagamento</h3>
                            <div className="flex items-center gap-2 text-red-600 font-black uppercase italic text-sm tracking-tighter">
                               <CreditCard size={18} />
                               {selectedOrder.paymentMethod || 'A DEFINIR'}
                            </div>
                         </section>

                         <section>
                            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-3">Status Atual</h3>
                            <span className={cn(
                              "px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase",
                              statusColors[selectedOrder.status] || 'bg-slate-950'
                            )}>
                              {selectedOrder.status}
                            </span>
                         </section>
                      </div>
                   </div>

                   <section className="mb-8">
                      <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[3px] mb-4">Itens do Pedido</h3>
                      <div className="bg-slate-800 rounded-2xl p-4 space-y-2">
                        {selectedOrder.items.map((item, i) => (
                           <div key={i} className="flex justify-between items-center text-sm py-2 border-b border-slate-700 last:border-0">
                              <div className="flex items-center gap-3">
                                 <span className="w-8 h-8 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-lg text-xs font-black text-red-600">{item.quantity}x</span>
                                 <span className="font-bold text-slate-200 uppercase">{item.name}</span>
                              </div>
                              <span className="font-bold text-white">{formatCurrency(item.price * item.quantity)}</span>
                           </div>
                        ))}
                      </div>
                   </section>

                   {selectedOrder.scheduledDate && (
                      <section className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl">
                         <h3 className="text-[10px] font-black uppercase text-red-600 tracking-[3px] mb-3 flex items-center gap-2">
                           <Clock size={14} /> Entrega Agendada
                         </h3>
                         <div className="flex flex-col">
                            <p className="text-xl font-black text-red-600 tracking-tighter">
                               {selectedOrder.scheduledDate.split('-').reverse().join('/')} @ {selectedOrder.scheduledTime}h
                            </p>
                            <p className="text-[10px] font-black uppercase text-red-400 tracking-widest mt-1 italic">
                               O cliente poderá receber até 60min antes do horário desejado.
                            </p>
                         </div>
                      </section>
                   )}

                   {selectedOrder.notes && (
                      <section className="mb-8 p-4 bg-yellow-50 border border-yellow-100 rounded-2xl">
                         <h3 className="text-[9px] font-black uppercase text-yellow-600 tracking-widest mb-1 italic">Observações do Cliente</h3>
                         <p className="text-xs text-yellow-800 font-medium italic">"{selectedOrder.notes}"</p>
                      </section>
                   )}

                   <div className="flex justify-between items-center p-6 bg-slate-900 text-white rounded-3xl">
                      <div>
                        <p className="text-[10px] font-black uppercase text-white/40 tracking-[3px]">Total Pago</p>
                        <p className="text-3xl font-black italic tracking-tighter">{formatCurrency(selectedOrder.total)}</p>
                      </div>
                      {canPrint && (
                        <Button 
                          onClick={handlePrint}
                          className="bg-slate-900 hover:bg-slate-200 text-white font-black uppercase italic text-xs tracking-widest px-6 h-12 rounded-2xl"
                        >
                          <Printer className="mr-2" size={18} /> Imprimir Cupom
                        </Button>
                      )}
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setEditingOrder(null)} />
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden p-8">
                 <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-6">Editar Pedido</h2>
                 
                 <div className="space-y-4 mb-8">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Nome do Cliente</label>
                      <Input value={editingOrder.customerName} onChange={e => setEditingOrder({...editingOrder, customerName: e.target.value})} className="h-12 border-slate-700 font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">WhatsApp</label>
                      <Input value={editingOrder.customerWhatsapp} onChange={e => setEditingOrder({...editingOrder, customerWhatsapp: e.target.value})} className="h-12 border-slate-700 font-bold font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Endereço Completo</label>
                      <textarea 
                        value={editingOrder.customerAddress} 
                        onChange={e => setEditingOrder({...editingOrder, customerAddress: e.target.value})}
                        className="w-full min-h-[100px] bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs font-medium focus:ring-1 focus:ring-red-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 block">Notas / Obs</label>
                      <textarea 
                        value={editingOrder.notes || ''} 
                        onChange={e => setEditingOrder({...editingOrder, notes: e.target.value})}
                        className="w-full min-h-[60px] bg-slate-800 border border-slate-700 rounded-xl p-4 text-xs font-medium italic outline-none"
                      />
                    </div>
                 </div>

                 <div className="flex gap-3">
                   <Button variant="outline" className="flex-1 h-12 rounded-2xl font-black uppercase tracking-widest" onClick={() => setEditingOrder(null)}>Cancelar</Button>
                   <Button className="flex-1 h-12 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest" onClick={handleSaveEdit}>
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
          <div className="text-center font-bold" style={{ fontSize: '15px', marginBottom: '5px' }}>DISCRETA BOUTIQUE</div>
          <div className="text-center" style={{ fontSize: '11px', marginBottom: '5px' }}>Sua boutique especializada em momentos inesquecíveis.</div>
          <div className="divider"></div>
          {selectedOrder && (
            <>
              <div className="header-info">
                <div>PEDIDO: #{selectedOrder.id.slice(-6).toUpperCase()}</div>
                <div>DATA: {selectedOrder.createdAt?.toDate ? format(selectedOrder.createdAt.toDate(), "dd/MM/yyyy HH:mm") : ''}</div>
                <div>TIPO: {selectedOrder.type === 'pdv' ? 'BALCAO' : 'ONLINE'}</div>
                {selectedOrder.scheduledDate && (
                  <div style={{ color: 'red', fontWeight: 'bold' }}>ENTREGA: {selectedOrder.scheduledDate.split('-').reverse().join('/')} @ {selectedOrder.scheduledTime}h</div>
                )}
              </div>
              <div className="divider"></div>
              <div className="font-bold">CLIENTE:</div>
              <div>{selectedOrder.customerName}</div>
              <div>{selectedOrder.customerWhatsapp}</div>
              {selectedOrder.type !== 'pdv' && (
                <>
                  <div style={{ marginTop: '5px' }}>ENDERECO:</div>
                  <div style={{ fontSize: '10px' }}>{selectedOrder.customerAddress}</div>
                </>
              )}
              <div className="divider"></div>
              <table>
                <thead>
                  <tr>
                    <th>QTD</th>
                    <th>DESC</th>
                    <th style={{ textAlign: 'right' }}>VAL</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.quantity}</td>
                      <td>{item.name}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divider"></div>
              <div className="totals">
                <div className="item">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(selectedOrder.total)}</span>
                </div>
              </div>
              <div className="divider"></div>
              <div className="font-bold">FORMA DE PAGTO:</div>
              <div>{selectedOrder.paymentMethod || 'A DEFINIR'}</div>
              {selectedOrder.notes && (
                <>
                  <div style={{ marginTop: '5px', fontStyle: 'italic' }}>OBS: {selectedOrder.notes}</div>
                </>
              )}
              <div className="divider"></div>
              <div className="footer">
                OBRIGADO PELA PREFERENCIA!<br/>
                Siga-nos no Instagram @discretaico
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const Loader2 = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
