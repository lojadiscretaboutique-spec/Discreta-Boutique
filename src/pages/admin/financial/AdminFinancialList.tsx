import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus, Edit2, Trash2, Search, Filter, ArrowDownCircle, ArrowUpCircle, 
  DollarSign, CheckCircle2, Clock, Check, X, Printer, FileText, Sparkles, ShieldCheck, UserCheck
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatCurrency, cn } from '../../../lib/utils';
import { financialService, FinancialTransaction, TransactionType, TransactionStatus, SalaryPaymentDetails } from '../../../services/financialService';
import { cashService } from '../../../services/cashService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { useAuthStore } from '../../../store/authStore';
import { paymentFinanceService, MethodConfig } from '../../../services/paymentFinanceService';
import { PaymentReceiptModal } from '../../../components/admin/financial/PaymentReceiptModal';

export function AdminFinancial() {
  const location = useLocation();
  const { toast, confirm } = useFeedback();
  const { user } = useAuthStore();
  
  const currentPath = location.pathname;
  const params = new URLSearchParams(location.search);
  const filterParam = params.get('filtro');

  let viewMode: 'all' | 'income' | 'expense' = 'all';
  if (currentPath.includes('entradas') || filterParam === 'receber') viewMode = 'income';
  if (currentPath.includes('saidas') || filterParam === 'pagar') viewMode = 'expense';

  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TransactionStatus>('all');

  // Handle Query Filters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const filter = params.get('filtro');
    if (filter === 'receber') {
      setStatusFilter('pending');
    } else if (filter === 'pagar') {
      setStatusFilter('pending');
    } else {
      setStatusFilter('all');
    }
  }, [location.search]);

  const [monthFilter, setMonthFilter] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
  });

  // Form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Recibo de Pagamento Modal
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptTransaction, setReceiptTransaction] = useState<FinancialTransaction | null>(null);

  const handleOpenReceipt = (t: FinancialTransaction) => {
    setReceiptTransaction(t);
    setIsReceiptOpen(true);
  };
  
  const initialForm: Partial<FinancialTransaction> = {
    type: viewMode === 'expense' ? 'expense' : 'income',
    description: '',
    amount: 0,
    dueDate: new Date().toISOString().split('T')[0],
    status: 'pending',
    category: '',
    contact: '',
    documentNumber: '',
    paymentMethod: '',
    salaryDetails: {
      collaboratorName: '',
      collaboratorCpf: '',
      collaboratorRole: '',
      paymentType: 'salario',
      paymentTypeLabel: 'Salário Mensal',
      referenceMonth: new Date().toISOString().slice(0, 7),
      grossAmount: 0,
      deductions: 0,
      netAmount: 0,
      legalNotice: ''
    }
  };
  
  const [form, setForm] = useState<Partial<FinancialTransaction>>(initialForm);
  const [paymentMethods, setPaymentMethods] = useState<MethodConfig[]>([]);

  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const list = await paymentFinanceService.getPaymentMethodsForFinancialLaunches();
        setPaymentMethods(list);
      } catch (err) {
        console.error("Error fetching financial payment methods:", err);
      }
    };
    fetchMethods();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // For a real app we'd fetch entirely based on date ranges to avoid pulling the whole DB
      const data = await financialService.listTransactions();
      setTransactions(data);
    } catch (e) {
      toast('Erro ao carregar dados', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (form.type) {
      financialService.getCategories(form.type).then(setCategories);
    }
  }, [form.type]);

  const handleOpenCreate = () => {
    const newClientActionId = `FIN_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setForm({
      ...initialForm,
      id: newClientActionId,
      type: viewMode === 'expense' ? 'expense' : 'income',
      dueDate: new Date().toISOString().split('T')[0],
      salaryDetails: {
        collaboratorName: '',
        collaboratorCpf: '',
        collaboratorRole: '',
        paymentType: 'salario',
        paymentTypeLabel: 'Salário Mensal',
        referenceMonth: new Date().toISOString().slice(0, 7),
        grossAmount: 0,
        deductions: 0,
        netAmount: 0,
        legalNotice: ''
      }
    });
    setIsFormOpen(true);
  };

  const handleEdit = (t: FinancialTransaction) => {
    const isSalary = t.category?.toLowerCase().includes('salár') || t.category?.toLowerCase().includes('salar');
    setForm({ 
      ...t,
      salaryDetails: t.salaryDetails || (isSalary ? {
        collaboratorName: t.contact || '',
        collaboratorCpf: t.documentNumber || '',
        collaboratorRole: '',
        paymentType: 'salario',
        paymentTypeLabel: 'Salário Mensal',
        referenceMonth: t.dueDate ? t.dueDate.slice(0, 7) : new Date().toISOString().slice(0, 7),
        grossAmount: t.amount || 0,
        deductions: 0,
        netAmount: t.amount || 0,
        legalNotice: ''
      } : undefined)
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string,  desc: string) => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível realizar exclusões financeiras com o caixa fechado.", "error");
      return;
    }

    if (await confirm({ 
      title: 'Excluir lançamento?', 
      message: `Tem certeza que deseja apagar ${desc}?`,
      variant: 'danger'
    })) {
      try {
        await financialService.deleteTransaction(id, desc);
        toast('Lançamento excluído com sucesso!');
        loadData();
      } catch (e) {
        toast('Erro ao excluir', 'error');
      }
    }
  };

  const handleSave = async () => {
    const session = await cashService.getCurrentSession();
    if (!session) {
      toast("Não é possível realizar lançamentos ou alterações financeiras com o caixa fechado.", "error");
      return;
    }

    // Se for salário e a descrição estiver vazia, gera automaticamente
    const isSalary = form.category?.toLowerCase().includes('salár') || form.category?.toLowerCase().includes('salar');
    let finalDesc = form.description?.trim();
    if (isSalary && !finalDesc) {
      const colab = form.salaryDetails?.collaboratorName || form.contact || 'Colaborador';
      const tipo = form.salaryDetails?.paymentTypeLabel || 'Salário';
      const mes = form.salaryDetails?.referenceMonth || form.dueDate?.slice(0, 7) || '';
      const comp = mes.includes('-') ? mes.split('-').reverse().join('/') : mes;
      finalDesc = `${tipo} - ${colab} (Ref: ${comp})`;
    }

    if (!finalDesc || !form.amount || !form.dueDate || !form.category) {
      toast('Preencha os campos obrigatórios (*)', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const sanitizedSalary = isSalary && form.salaryDetails ? {
        ...form.salaryDetails,
        collaboratorName: form.salaryDetails.collaboratorName || form.contact || '',
        collaboratorCpf: form.salaryDetails.collaboratorCpf || form.documentNumber || '',
        netAmount: form.amount
      } : form.salaryDetails;

      const payload: Partial<FinancialTransaction> = {
        ...form,
        description: finalDesc,
        documentNumber: form.documentNumber || form.salaryDetails?.collaboratorCpf || '',
        salaryDetails: sanitizedSalary,
        userId: user?.uid || 'system',
        isManual: true
      };
      
      if (payload.status === 'paid' && !payload.paymentDate) {
        payload.paymentDate = new Date().toISOString().split('T')[0];
      }
      
      await financialService.saveTransaction(payload);
      toast('Lançamento salvo com sucesso!');
      setIsFormOpen(false);
      loadData();
    } catch (error) {
      console.error('[Financial Save]', error);
      toast('Erro ao salvar lançamento financeiro', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Data
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      // Type
      if (viewMode === 'income' && t.type !== 'income') return false;
      if (viewMode === 'expense' && t.type !== 'expense') return false;
      
      // Status
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      
      // Month (dueDate)
      if (monthFilter && !t.dueDate.startsWith(monthFilter)) return false;
      
      // Search
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const str = `${t.description} ${t.contact} ${t.category}`.toLowerCase();
        if (!str.includes(query)) return false;
      }
      
      return true;
    });
  }, [transactions, viewMode, statusFilter, monthFilter, searchTerm]);

  // Totals
  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    filteredData.forEach(t => {
      if (t.type === 'income') income += t.amount;
      if (t.type === 'expense') expense += t.amount;
    });
    return { income, expense, balance: income - expense };
  }, [filteredData]);

  let pageTitle = viewMode === 'all' ? 'Lançamentos' : viewMode === 'income' ? 'Entradas (Receitas)' : 'Saídas (Despesas)';
  if (filterParam === 'receber') pageTitle = 'Contas a Receber';
  if (filterParam === 'pagar') pageTitle = 'Contas a Pagar';

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{pageTitle}</h1>
          <p className="text-sm text-slate-400">Gestão financeira e controle de fluxo de caixa.</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-blue-600 hover:bg-blue-700">
          <Plus size={18} className="mr-2" /> Novo Lançamento
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-700 flex flex-col justify-between">
           <div className="flex justify-between items-center text-slate-400 mb-4">
              <span className="font-bold text-sm uppercase">Entradas no Mês</span>
              <ArrowUpCircle size={24} className="text-green-500" />
           </div>
           <h2 className="text-3xl font-black text-white">{formatCurrency(totals.income)}</h2>
        </div>
        <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-700 flex flex-col justify-between">
           <div className="flex justify-between items-center text-slate-400 mb-4">
              <span className="font-bold text-sm uppercase">Saídas no Mês</span>
              <ArrowDownCircle size={24} className="text-red-500" />
           </div>
           <h2 className="text-3xl font-black text-white">{formatCurrency(totals.expense)}</h2>
        </div>
        <div className={cn("p-6 rounded-2xl shadow-sm border flex flex-col justify-between", totals.balance >= 0 ? "bg-green-600 border-green-700 text-white" : "bg-red-600 border-red-700 text-white")}>
           <div className="flex justify-between items-center mb-4 opacity-80">
              <span className="font-bold text-sm uppercase">Saldo do Período</span>
              <DollarSign size={24} />
           </div>
           <h2 className="text-3xl font-black">{formatCurrency(totals.balance)}</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-700 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar lançamentos..." 
            className="pl-10 h-11 w-full border-slate-600"
          />
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex flex-col w-full md:w-auto">
             <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Mês de Ref.</label>
             <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="h-11 px-3 border border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="flex flex-col w-full md:w-auto">
             <label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Situação</label>
             <select 
               value={statusFilter} 
               onChange={e => setStatusFilter(e.target.value as any)}
               className="h-11 px-3 border border-slate-600 rounded-md outline-none focus:ring-2 focus:ring-red-500 bg-slate-900 min-w-[140px]"
             >
               <option value="all">Todos</option>
               <option value="paid">Pagos / Recebidos</option>
               <option value="pending">Pendentes</option>
             </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 rounded-2xl shadow-sm border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
             <thead className="bg-slate-800/80 text-slate-400 font-bold border-b text-[11px] uppercase tracking-widest">
                <tr>
                   <th className="px-6 py-4">Vencimento</th>
                   <th className="px-6 py-4">Descrição</th>
                   <th className="px-6 py-4">Categoria</th>
                   <th className="px-6 py-4">Contato</th>
                   <th className="px-6 py-4 text-right">Valor</th>
                   <th className="px-6 py-4 text-center">Status</th>
                   <th className="px-6 py-4 text-center">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y">
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">Carregando financeiro...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">Nenhum lançamento encontrado para os filtros.</td></tr>
                ) : filteredData.map(t => (
                  <tr key={t.id} className="hover:bg-slate-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                       <span className="font-medium text-white">{t.dueDate.split('-').reverse().join('/')}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[200px] max-w-[300px]">
                       <div className="font-bold text-white whitespace-normal break-words">{t.description}</div>
                       {t.paymentMethod && <span className="text-[10px] text-slate-400 uppercase tracking-widest">{t.paymentMethod}</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                       <span className="bg-slate-950 border border-slate-700 px-2 py-1 rounded text-xs">{t.category}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-300 whitespace-normal break-words max-w-[150px]">{t.contact || '-'}</td>
                    <td className={cn("px-6 py-4 text-right whitespace-nowrap")}>
                      <div className={cn("font-black", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                        {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                      </div>
                      {t.additionalAmount && t.additionalAmount > 0 && (
                        <div className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">
                          Venda: {formatCurrency(t.originalSaleAmount || 0)} <br/>
                          Acrésc: {formatCurrency(t.additionalAmount)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 flex justify-center mt-1">
                       {t.status === 'paid' ? (
                         <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 object-center rounded-full text-[10px] font-bold uppercase">
                           <CheckCircle2 size={12}/> Pago
                         </span>
                       ) : (
                         <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 object-center rounded-full text-[10px] font-bold uppercase">
                           <Clock size={12}/> Pendente
                         </span>
                       )}
                    </td>
                    <td className="px-6 py-3">
                        <div className="flex justify-center gap-2">
                            {t.status === 'pending' && (
                             <button 
                               onClick={async () => {
                                 const session = await cashService.getCurrentSession();
                                 if (!session) {
                                   toast("Não é possível realizar baixas com o caixa fechado.", "error");
                                   return;
                                 }
                                 financialService.saveTransaction({
                                   ...t, 
                                   status: 'paid', 
                                   paymentDate: new Date().toISOString().split('T')[0],
                                   userId: user?.uid,
                                   isManual: true // Garante sincronização com caixa
                                 }).then(loadData);
                               }}
                               className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200 shadow-sm"
                               title="Baixar Título (Marcar como Pago)"
                             >
                                <Check size={16} />
                             </button>
                           )}
                           <button 
                             onClick={() => handleOpenReceipt(t)} 
                             className={cn(
                               "p-1.5 rounded-lg transition-all shadow-sm border",
                               t.status === 'paid'
                                 ? "bg-slate-900 border-emerald-500/50 text-emerald-400 hover:text-emerald-300 hover:border-emerald-400 hover:bg-emerald-950/40"
                                 : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                             )}
                             title={t.status === 'paid' ? "Imprimir Recibo do Pagamento Realizado" : "Visualizar Recibo de Pagamento"}
                           >
                             <Printer size={16} />
                           </button>
                           <button onClick={() => handleEdit(t)} className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-blue-600 hover:border-blue-600 transition-all shadow-sm">
                             <Edit2 size={16} />
                           </button>
                           <button onClick={() => handleDelete(t.id!, t.description)} className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:text-red-600 hover:border-red-600 transition-all shadow-sm">
                             <Trash2 size={16} />
                           </button>
                        </div>
                    </td>
                  </tr>
                ))}
             </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
              <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                 <h2 className="text-xl font-bold">{form.id ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
                 <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-red-500 rounded-full p-2 bg-slate-800"><X size={20}/></button>
              </div>
              <div className="p-6 flex-1 space-y-6">
                 
                 <div className="flex gap-4 p-1 bg-slate-950 rounded-xl">
                   <button 
                     onClick={() => setForm({...form, type: 'income'})}
                     className={cn("flex-1 py-2 font-bold text-sm rounded-lg transition-all", form.type === 'income' ? 'bg-slate-900 shadow text-green-600' : 'text-slate-400')}
                   >Receita (Entrada)</button>
                   <button 
                     onClick={() => setForm({...form, type: 'expense'})}
                     className={cn("flex-1 py-2 font-bold text-sm rounded-lg transition-all", form.type === 'expense' ? 'bg-slate-900 shadow text-red-600' : 'text-slate-400')}
                   >Despesa (Saída)</button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                       <label className="block text-sm font-bold mb-1">Descrição *</label>
                       <Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Compra de mercadorias" />
                    </div>
                    
                    <div>
                       <label className="block text-sm font-bold mb-1">Valor (R$) *</label>
                       <Input 
                         type="number" 
                         step="0.01" 
                         min="0"
                         value={form.amount || ''} 
                         onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} 
                       />
                    </div>
                    
                    <div>
                       <label className="block text-sm font-bold mb-1">Vencimento *</label>
                       <Input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
                    </div>

                    <div>
                       <label className="block text-sm font-bold mb-1">Categoria *</label>
                       <select 
                         className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                         value={form.category}
                         onChange={e => setForm({...form, category: e.target.value})}
                       >
                         <option value="">Selecione...</option>
                         {categories.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </div>

                    <div>
                       <label className="block text-sm font-bold mb-1">
                         {form.category?.toLowerCase().includes('salár') || form.category?.toLowerCase().includes('salar') 
                           ? 'Colaborador(a) / Empregado(a) *' 
                           : 'Cliente / Fornecedor'}
                       </label>
                       <Input 
                         value={form.contact || ''} 
                         onChange={e => {
                           const val = e.target.value;
                           setForm(prev => ({
                             ...prev, 
                             contact: val,
                             salaryDetails: prev.salaryDetails ? { ...prev.salaryDetails, collaboratorName: val } : undefined
                           }));
                         }} 
                         placeholder={form.category?.toLowerCase().includes('salár') || form.category?.toLowerCase().includes('salar') 
                           ? "Nome do empregado(a)" 
                           : "Nome da empresa/pessoa"} 
                       />
                    </div>

                    <div>
                       <label className="block text-sm font-bold mb-1">
                         {form.category?.toLowerCase().includes('salár') || form.category?.toLowerCase().includes('salar') 
                           ? 'CPF do Colaborador *' 
                           : 'CPF / CNPJ do Contato'}
                       </label>
                       <Input 
                         value={form.documentNumber || form.salaryDetails?.collaboratorCpf || ''} 
                         onChange={e => {
                           const val = e.target.value;
                           setForm(prev => ({
                             ...prev, 
                             documentNumber: val,
                             salaryDetails: prev.salaryDetails ? { ...prev.salaryDetails, collaboratorCpf: val } : undefined
                           }));
                         }} 
                         placeholder={form.category?.toLowerCase().includes('salár') || form.category?.toLowerCase().includes('salar') 
                           ? "000.000.000-00" 
                           : "000.000.000-00 ou CNPJ"} 
                       />
                    </div>

                    <div>
                       <label className="block text-sm font-bold mb-1">Forma de Pagamento</label>
                       <select 
                         className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                         value={form.paymentMethod || ''}
                         onChange={e => {
                           const mIdOrName = e.target.value;
                           const found = paymentMethods.find(m => m.id === mIdOrName || m.name === mIdOrName || m.label === mIdOrName);
                           if (found) {
                             setForm({
                               ...form,
                               paymentMethod: found.name || found.label || found.id,
                               paymentMethodId: found.id,
                               paymentMethodNameSnapshot: found.name || found.label || found.id,
                               paymentMethodType: found.type,
                               gatewayProvider: found.gatewayProvider || 'manual',
                               paymentContext: 'lancamentos_financeiros'
                             });
                           } else {
                             setForm({
                               ...form,
                               paymentMethod: '',
                               paymentMethodId: undefined,
                               paymentMethodNameSnapshot: undefined,
                               paymentMethodType: undefined,
                               gatewayProvider: undefined,
                               paymentContext: undefined
                             });
                           }
                         }}
                       >
                         <option value="">Nenhum / Indefinido</option>
                         {paymentMethods.map(m => (
                           <option key={m.id} value={m.name || m.label || m.id}>
                             {m.name || m.label || m.id}
                           </option>
                         ))}
                       </select>
                    </div>

                    <div>
                       <label className="block text-sm font-bold mb-1">Situação *</label>
                       <select 
                         className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                         value={form.status}
                         onChange={e => setForm({...form, status: e.target.value as TransactionStatus})}
                       >
                         <option value="pending">Pendente (A Pagar/Receber)</option>
                         <option value="paid">Pago / Recebido</option>
                       </select>
                    </div>
                 </div>

                 {/* Seção Exclusiva de Formalidade Legal para Categoria Salários (CLT Art. 464) */}
                 {(form.category?.toLowerCase().includes('salár') || form.category?.toLowerCase().includes('salar')) && (
                    <div className="bg-slate-950 border border-blue-600/40 rounded-xl p-4 sm:p-5 space-y-4 shadow-inner">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-blue-400">
                          <ShieldCheck size={20} className="text-blue-400" />
                          <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                              Formalidade Legal e Trabalhista (Art. 464 CLT)
                              <span className="bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded text-[10px] uppercase font-bold">
                                Recibo Salarial
                              </span>
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              Informações obrigatórias que comprovam formalmente o pagamento de salário ou quinzena
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const colab = form.contact || form.salaryDetails?.collaboratorName || 'Colaborador';
                            const tipo = form.salaryDetails?.paymentTypeLabel || 'Salário Mensal';
                            const mes = form.salaryDetails?.referenceMonth || form.dueDate?.slice(0, 7) || '';
                            const compFormatada = mes.includes('-') ? mes.split('-').reverse().join('/') : mes;
                            setForm(prev => ({
                              ...prev,
                              description: `${tipo} - ${colab} (Ref: ${compFormatada})`
                            }));
                            toast('Descrição formal gerada com sucesso!', 'info');
                          }}
                          className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-100 bg-blue-900/40 hover:bg-blue-800/60 px-3 py-1.5 rounded-lg border border-blue-700/50 transition-colors shadow-sm"
                          title="Preencher campo de descrição com a nomenclatura padrão formal"
                        >
                          <Sparkles size={13} /> Gerar Descrição Formal
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {/* Tipo de Pagamento */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Tipo de Remuneração *</label>
                          <select
                            className="w-full h-10 px-3 rounded-md border border-slate-700 bg-slate-900 text-xs text-white outline-none focus:ring-2 focus:ring-blue-600"
                            value={form.salaryDetails?.paymentType || 'salario'}
                            onChange={e => {
                              const val = e.target.value;
                              const mapLabels: Record<string, string> = {
                                salario: 'Salário Mensal',
                                quinzena: 'Adiantamento Salarial (1ª Quinzena)',
                                saldo: 'Saldo de Salário (2ª Quinzena)',
                                pro_labore: 'Pró-Labore',
                                comissao: 'Comissões de Vendas',
                                decimo_terceiro: '13º Salário',
                                ferias: 'Férias / Adicional de Férias',
                                rescisao: 'Verbas Rescisórias',
                                outro: 'Outro Provento'
                              };
                              const label = mapLabels[val] || val;
                              setForm(prev => ({
                                ...prev,
                                salaryDetails: {
                                  ...prev.salaryDetails,
                                  paymentType: val,
                                  paymentTypeLabel: label
                                }
                              }));
                            }}
                          >
                            <option value="salario">Salário Mensal Integral</option>
                            <option value="quinzena">Adiantamento Salarial (1ª Quinzena)</option>
                            <option value="saldo">Saldo de Salário (2ª Quinzena)</option>
                            <option value="pro_labore">Pró-Labore (Sócios)</option>
                            <option value="comissao">Comissões de Vendas</option>
                            <option value="decimo_terceiro">13º Salário</option>
                            <option value="ferias">Férias / Adicional 1/3</option>
                            <option value="rescisao">Verbas Rescisórias</option>
                            <option value="outro">Outro Provento</option>
                          </select>
                        </div>

                        {/* Mês/Competência de Referência */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Competência (Mês/Ano) *</label>
                          <Input
                            type="month"
                            className="h-10 text-xs"
                            value={form.salaryDetails?.referenceMonth || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setForm(prev => ({
                                ...prev,
                                salaryDetails: {
                                  ...prev.salaryDetails,
                                  referenceMonth: val
                                }
                              }));
                            }}
                          />
                        </div>

                        {/* Cargo / Função */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Cargo / Função</label>
                          <Input
                            className="h-10 text-xs"
                            placeholder="Ex: Vendedora, Gerente, Caixa..."
                            value={form.salaryDetails?.collaboratorRole || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setForm(prev => ({
                                ...prev,
                                salaryDetails: {
                                  ...prev.salaryDetails,
                                  collaboratorRole: val
                                }
                              }));
                            }}
                          />
                        </div>

                        {/* Salário Bruto */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Salário Bruto / Proventos (R$)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-10 text-xs"
                            placeholder="R$ 0,00"
                            value={form.salaryDetails?.grossAmount || ''}
                            onChange={e => {
                              const bruto = parseFloat(e.target.value) || 0;
                              const desc = form.salaryDetails?.deductions || 0;
                              const liquido = Math.max(0, bruto - desc);
                              setForm(prev => ({
                                ...prev,
                                amount: liquido > 0 ? liquido : prev.amount,
                                salaryDetails: {
                                  ...prev.salaryDetails,
                                  grossAmount: bruto,
                                  netAmount: liquido > 0 ? liquido : prev.amount
                                }
                              }));
                            }}
                          />
                        </div>

                        {/* Descontos Legais */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Descontos Legais / Vales (R$)</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="h-10 text-xs"
                            placeholder="INSS, vales, faltas..."
                            value={form.salaryDetails?.deductions || ''}
                            onChange={e => {
                              const desc = parseFloat(e.target.value) || 0;
                              const bruto = form.salaryDetails?.grossAmount || form.amount || 0;
                              const liquido = Math.max(0, bruto - desc);
                              setForm(prev => ({
                                ...prev,
                                amount: liquido,
                                salaryDetails: {
                                  ...prev.salaryDetails,
                                  deductions: desc,
                                  netAmount: liquido
                                }
                              }));
                            }}
                          />
                        </div>

                        {/* Valor Líquido */}
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">Valor Líquido a Pagar</label>
                          <div className="h-10 px-3 bg-slate-900 border border-slate-700 rounded-md flex items-center font-bold text-emerald-400 text-sm">
                            {formatCurrency(form.amount || 0)}
                          </div>
                        </div>
                      </div>

                      {/* Termo de Quitação Formal */}
                      <div className="pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-slate-300 font-bold text-xs">
                            Declaração e Termo Formal de Quitação (Art. 464 CLT)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const colab = form.contact || form.salaryDetails?.collaboratorName || 'colaborador';
                              const tipo = form.salaryDetails?.paymentTypeLabel || 'salário';
                              const mes = form.salaryDetails?.referenceMonth || form.dueDate?.slice(0, 7) || '';
                              const compFormatada = mes.includes('-') ? mes.split('-').reverse().join('/') : mes;
                              const texto = `Declaro para os devidos fins legais, em conformidade com o Artigo 464 da Consolidação das Leis do Trabalho (CLT), ter recebido da empresa empregadora Discreta Boutique a importância líquida supra discriminada, referente à quitação de ${tipo} relativo à competência de ${compFormatada}, conferido e achado exato, pelo que firmo o presente dando plena e rasa quitação dos referidos valores.`;
                              setForm(prev => ({
                                ...prev,
                                salaryDetails: {
                                  ...prev.salaryDetails,
                                  legalNotice: texto
                                }
                              }));
                            }}
                            className="text-[11px] text-blue-400 hover:underline"
                          >
                            Redefinir Texto Padrão CLT
                          </button>
                        </div>
                        <textarea
                          className="w-full min-h-[60px] p-2.5 rounded-md border border-slate-700 bg-slate-900 text-xs text-slate-200 outline-none focus:ring-2 focus:ring-blue-600"
                          placeholder="Texto de quitação legal gerado automaticamente para o comprovante..."
                          value={form.salaryDetails?.legalNotice || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setForm(prev => ({
                              ...prev,
                              salaryDetails: {
                                ...prev.salaryDetails,
                                legalNotice: val
                              }
                            }));
                          }}
                        />
                      </div>
                    </div>
                 )}

                 {form.status === 'paid' && (
                   <div>
                     <label className="block text-sm font-bold mb-1 mx-0 flex flex-col md:w-1/2">Data de Recebimento/Pagamento</label>
                     <Input className="md:w-1/2" type="date" value={form.paymentDate || ''} onChange={e => setForm({...form, paymentDate: e.target.value})} />
                   </div>
                 )}

                 <div>
                    <label className="block text-sm font-bold mb-1">Observações Internas</label>
                    <textarea 
                      className="w-full min-h-[80px] p-3 rounded-md border border-slate-600 bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                      value={form.notes || ''}
                      onChange={e => setForm({...form, notes: e.target.value})}
                    />
                 </div>
              </div>
              <div className="p-6 border-t bg-slate-800 flex justify-between items-center gap-3 rounded-b-2xl sticky bottom-0">
                 <div>
                   {form.id && (
                     <Button
                       type="button"
                       variant="outline"
                       onClick={() => {
                         handleOpenReceipt({
                           ...form,
                           id: form.id,
                           type: form.type || 'expense',
                           description: form.description || '',
                           amount: form.amount || 0,
                           dueDate: form.dueDate || '',
                           status: form.status || 'pending',
                           category: form.category || ''
                         } as FinancialTransaction);
                       }}
                       className="border-emerald-600/60 text-emerald-400 hover:bg-emerald-950/40 flex items-center gap-1.5"
                       title="Imprimir Recibo de Pagamento"
                     >
                       <Printer size={16} /> Imprimir Recibo
                     </Button>
                   )}
                 </div>
                 <div className="flex gap-3">
                   <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                   <Button onClick={handleSave} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                      {submitting ? 'Salvando...' : 'Salvar Lançamento'}
                   </Button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Modal de Impressão de Recibo */}
      <PaymentReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setReceiptTransaction(null);
        }}
        transaction={receiptTransaction}
      />
    </div>
  );
}
