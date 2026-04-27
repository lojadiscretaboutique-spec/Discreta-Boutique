import { useEffect, useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Plus, Edit2, Trash2, Search, Filter, ArrowDownCircle, ArrowUpCircle, 
  DollarSign, CheckCircle2, Clock, Check, X
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatCurrency, cn } from '../../../lib/utils';
import { financialService, FinancialTransaction, TransactionType, TransactionStatus } from '../../../services/financialService';
import { cashService } from '../../../services/cashService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { useAuthStore } from '../../../store/authStore';

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
  
  const initialForm: Partial<FinancialTransaction> = {
    type: viewMode === 'expense' ? 'expense' : 'income',
    description: '',
    amount: 0,
    dueDate: new Date().toISOString().split('T')[0],
    status: 'pending',
    category: '',
    contact: '',
    paymentMethod: ''
  };
  
  const [form, setForm] = useState<Partial<FinancialTransaction>>(initialForm);

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

  const handleEdit = (t: FinancialTransaction) => {
    setForm({ ...t });
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

    if (!form.description || !form.amount || !form.dueDate || !form.category) {
      toast('Preencha os campos obrigatórios (*)', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = { ...form, userId: user?.uid };
      if (payload.status === 'paid' && !payload.paymentDate) {
        payload.paymentDate = new Date().toISOString().split('T')[0];
      }
      
      await financialService.saveTransaction(payload);
      toast('Lançamento salvo com sucesso!');
      setIsFormOpen(false);
      loadData();
    } catch (e) {
      toast('Erro ao salvar', 'error');
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
        <Button onClick={() => { setForm({ ...initialForm, type: viewMode === 'expense' ? 'expense' : 'income' }); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
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
                    <td className={cn("px-6 py-4 text-right font-black whitespace-nowrap", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                       {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
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
                                   userId: user?.uid
                                 }).then(loadData);
                               }}
                               className="p-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-colors border border-green-200 shadow-sm"
                               title="Baixar Título (Marcar como Pago)"
                             >
                                <Check size={16} />
                             </button>
                           )}
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
                       <label className="block text-sm font-bold mb-1">Cliente / Fornecedor</label>
                       <Input value={form.contact || ''} onChange={e => setForm({...form, contact: e.target.value})} placeholder="Nome da empresa/pessoa" />
                    </div>

                    <div>
                       <label className="block text-sm font-bold mb-1">Forma de Pagamento</label>
                       <select 
                         className="w-full h-10 px-3 rounded-md border border-slate-600 bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-600"
                         value={form.paymentMethod || ''}
                         onChange={e => setForm({...form, paymentMethod: e.target.value})}
                       >
                         <option value="">Nenhum / Indefinido</option>
                         <option value="Dinheiro">Dinheiro</option>
                         <option value="PIX">PIX</option>
                         <option value="Cartão de Crédito">Cartão de Crédito</option>
                         <option value="Cartão de Débito">Cartão de Débito</option>
                         <option value="Boleto">Boleto</option>
                         <option value="Transferência">Transferência Bancária</option>
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
              <div className="p-6 border-t bg-slate-800 flex justify-end gap-3 rounded-b-2xl sticky bottom-0">
                 <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
                 <Button onClick={handleSave} disabled={submitting} className="bg-blue-600 hover:bg-blue-700">
                    {submitting ? 'Salvando...' : 'Salvar Lançamento'}
                 </Button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
