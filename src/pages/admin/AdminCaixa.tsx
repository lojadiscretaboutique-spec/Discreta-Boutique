import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { cashService, CashSession, CashTransaction } from '../../services/cashService';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { format } from 'date-fns';
import { 
  Banknote, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  History, 
  Plus, 
  Lock, 
  AlertCircle,
  FileText,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { formatCurrency, roundTo2 } from '../../lib/utils';

export function AdminCaixa() {
  const { hasPermission } = useAuthStore();
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'status' | 'history' | 'report'>('status');
  
  const { toast, confirm } = useFeedback();
  const { user } = useAuthStore();

  const canCreate = hasPermission('caixa', 'criar');
  const canEdit = hasPermission('caixa', 'editar');
  const canDelete = hasPermission('caixa', 'excluir');
  const canReopen = hasPermission('caixa', 'reabrir');

  // Form states
  const [initialBalance, setInitialBalance] = useState('0');
  const [transId, setTransId] = useState<string | null>(null);
  const [transAmount, setTransAmount] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [transType, setTransType] = useState<'entrada' | 'saida'>('entrada');
  const [transCategory, setTransCategory] = useState('Suprimento');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [closingBalance, setClosingBalance] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
  const [sessionTransactions, setSessionTransactions] = useState<CashTransaction[]>([]);
  const [loadingSessionTrans, setLoadingSessionTrans] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const current = await cashService.getCurrentSession();
      setCurrentSession(current);
      
      const sessList = await cashService.listRecentSessions();
      setSessions(sessList);

      if (current) {
          const transList = await cashService.listTransactions(current.id);
          setTransactions(transList);
          
          // Calculate expected balance
          const expected = roundTo2(current.initialBalance + (current.totalInputs || 0) - (current.totalOutputs || 0));
          setClosingBalance(expected.toString());
      } else {
          setTransactions([]);
      }

      if (selectedSession) {
        const transList = await cashService.listTransactions(selectedSession.id);
        setSessionTransactions(transList);
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Erro ao carregar dados do caixa", 'error');
    } finally {
      setLoading(false);
    }
  }, [toast, selectedSession]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenCaixa = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      setSubmitting(true);
      try {
          await cashService.openSession({
              userId: user.uid,
              userName: user.displayName || 'Vendedor',
              initialBalance: roundTo2(parseFloat(initialBalance)) || 0
          });
          toast("Caixa aberto com sucesso!", 'success');
          loadData();
      } catch (err: unknown) {
          toast(err instanceof Error ? err.message : "Erro ao abrir caixa", 'error');
      } finally {
          setSubmitting(false);
      }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentSession || !user) return;
      const amount = roundTo2(parseFloat(transAmount));
      if (!amount || amount <= 0) return toast("Informe um valor válido", 'warning');

      setSubmitting(true);
      try {
          if (transId) {
            await cashService.updateTransaction(transId, {
              type: transType,
              category: transCategory,
              amount,
              description: transDesc,
              paymentMethod: paymentMethod
            });
            toast("Lançamento atualizado!", 'success');
          } else {
            await cashService.addTransaction({
                sessionId: currentSession.id,
                type: transType,
                category: transCategory,
                amount,
                description: transDesc,
                paymentMethod: paymentMethod,
                userId: user.uid,
                source: 'loja_fisica'
            });
            toast("Lançamento realizado!", 'success');
          }
          setTransAmount('');
          setTransDesc('');
          setTransId(null);
          loadData();
      } catch (err: unknown) {
          toast(err instanceof Error ? "Erro: " + err.message : "Erro ao realizar lançamento", 'error');
      } finally {
          setSubmitting(false);
      }
  };

  const handleEditTransaction = (t: CashTransaction) => {
    setTransId(t.id!);
    setTransAmount(t.amount.toString());
    setTransType(t.type);
    setTransCategory(t.category);
    setPaymentMethod(t.paymentMethod);
    setTransDesc(t.description || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTransaction = async (t: CashTransaction) => {
    if (!await confirm({ title: 'Excluir Lançamento', message: 'Deseja realmente apagar este lançamento? O saldo do caixa será recalculado.', variant: 'danger' })) return;
    try {
      await cashService.deleteTransaction(t.id!);
      toast("Lançamento excluído.");
      loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Erro ao excluir lançamento", 'error');
    }
  };

  const handleCloseCaixa = async () => {
      if (!currentSession) return;
      const ok = await confirm({
          title: "Fechar Caixa",
          message: `Deseja encerrar este turno com o saldo final de ${formatCurrency(parseFloat(closingBalance))}?`,
          confirmText: "Sim, Fechar",
          variant: "danger"
      });
      if (!ok) return;

      setSubmitting(true);
      try {
          await cashService.closeSession(currentSession.id!, roundTo2(parseFloat(closingBalance)));
          toast("Caixa aberto com sucesso.");
          loadData();
      } catch (err: unknown) {
          toast(err instanceof Error ? "Erro: " + err.message : "Erro ao fechar caixa", 'error');
      } finally {
          setSubmitting(false);
      }
  };

  const handleReopenCaixa = async (sessionId: string) => {
    if (!await confirm({ title: 'Reabrir Caixa', message: 'Deseja realmente reabrir este caixa? Ele se tornará o caixa ativo novamente.' })) return;
    try {
      await cashService.reopenSession(sessionId);
      toast("Caixa reaberto com sucesso.");
      setView('status');
      loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Erro ao reabrir caixa", 'error');
    }
  };

  const handleDeleteCaixa = async (sessionId: string) => {
    if (!await confirm({ title: 'Excluir Turno', message: 'Deseja apagar permanentemente este turno e todos os seus lançamentos? Esta ação é irreversível.', variant: 'danger' })) return;
    try {
      await cashService.deleteSession(sessionId);
      toast("Caixa e lançamentos apagados.");
      loadData();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Erro ao excluir caixa", 'error');
    }
  };

  const handleSelectSession = async (session: CashSession) => {
    setSelectedSession(session);
    setLoadingSessionTrans(true);
    try {
      const trans = await cashService.listTransactions(session.id);
      setSessionTransactions(trans);
    } finally {
      setLoadingSessionTrans(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Carregando módulo de caixa...</div>;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Banknote className="text-emerald-600" /> Controle de Caixa
          </h1>
          <p className="text-slate-400">Gestão financeira diária da loja.</p>
        </div>
        <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border shadow-sm self-start">
            <button 
              onClick={() => setView('status')} 
              className={`px-4 py-2 text-xs font-bold uppercase rounded-md transition-all ${view === 'status' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              Caixa Atual
            </button>
            <button 
              onClick={() => setView('history')} 
              className={`px-4 py-2 text-xs font-bold uppercase rounded-md transition-all ${view === 'history' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800'}`}
            >
              Histórico
            </button>
        </div>
      </header>

      {view === 'status' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LADO ESQUERDO: STATUS E RESUMO */}
          <div className="lg:col-span-2 space-y-6">
            {!currentSession ? (
              <div className="bg-slate-900 rounded-2xl border p-12 text-center flex flex-col items-center gap-4 shadow-sm">
                <div className="w-20 h-20 bg-slate-950 rounded-full flex items-center justify-center text-slate-400">
                  <Lock size={40} />
                </div>
                <h2 className="text-2xl font-bold text-white">O caixa está FECHADO</h2>
                <p className="text-slate-400 max-w-sm">Para realizar vendas físicas e lançamentos manuais, é necessário abrir um novo turno de caixa.</p>
                {canCreate ? (
                  <form onSubmit={handleOpenCaixa} className="flex items-center gap-3 mt-4 w-full max-w-xs">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                      <Input 
                        className="pl-10" 
                        placeholder="Saldo Inicial" 
                        type="number" 
                        step="0.01" 
                        value={initialBalance} 
                        onChange={e => setInitialBalance(e.target.value)} 
                        onBlur={e => setInitialBalance(roundTo2(parseFloat(e.target.value)).toString())}
                      />
                    </div>
                    <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700 h-10 px-6">
                      {submitting ? 'Abre...' : 'Abrir'}
                    </Button>
                  </form>
                ) : (
                  <div className="p-4 bg-slate-800 rounded-xl text-center text-slate-400 font-bold text-sm border-2 border-dashed mt-4 w-full">
                    Você não tem permissão para abrir o caixa
                  </div>
                )}
              </div>
            ) : (
                <>
                {/* CARDS DE RESUMO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900 p-6 rounded-2xl border shadow-sm">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Saldo Inicial</p>
                        <p className="text-2xl font-black text-white">{formatCurrency(currentSession.initialBalance)}</p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase">Abertura: {format(currentSession.openedAt?.toDate() || new Date(), "HH:mm")}</p>
                    </div>
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">Total Entradas</p>
                            <TrendingUp size={16} className="text-emerald-500" />
                        </div>
                        <p className="text-2xl font-black text-emerald-700">+{formatCurrency(currentSession.totalInputs || 0)}</p>
                        <p className="text-[10px] text-emerald-500 mt-1 uppercase">Soma de recebimentos</p>
                    </div>
                    <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm">
                        <div className="flex justify-between items-start">
                            <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-2">Total Saídas</p>
                            <TrendingDown size={16} className="text-rose-500" />
                        </div>
                        <p className="text-2xl font-black text-rose-700">-{formatCurrency(currentSession.totalOutputs || 0)}</p>
                        <p className="text-[10px] text-rose-500 mt-1 uppercase">Sangrias e despesas</p>
                    </div>
                </div>

                {/* LANÇAMENTOS RECENTES */}
                <div className="bg-slate-900 rounded-2xl border shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b bg-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-slate-200 flex items-center gap-2">
                       <History size={16} /> Lancamentos Recentes
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[500px]">
                      <thead className="bg-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="p-4 text-left">Hora</th>
                          <th className="p-4 text-left">Descrição / Categoria</th>
                          <th className="p-4 text-left">Metodo</th>
                          <th className="p-4 text-right">Valor</th>
                          <th className="p-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum lançamento no turno atual.</td></tr>
                        ) : transactions.map(t => (
                            <tr key={t.id} className="hover:bg-slate-800 transition-colors">
                                <td className="p-4 text-slate-400 text-xs font-medium">
                                    {format(t.createdAt?.toDate() || new Date(), "HH:mm")}
                                </td>
                                <td className="p-4">
                                    <p className="font-bold text-white whitespace-normal break-words max-w-[200px]">{t.description || 'Venda'}</p>
                                    <p className="text-[10px] uppercase text-slate-400">{t.category}</p>
                                </td>
                                <td className="p-4 text-slate-400 text-xs">
                                   {t.paymentMethod}
                                </td>
                                <td className={`p-4 text-right font-bold ${t.type === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {t.type === 'entrada' ? '+' : '-'} {formatCurrency(t.amount)}
                                </td>
                                <td className="p-4 text-center">
                                  <div className="flex justify-center gap-1">
                                    {canEdit && (
                                       <button onClick={() => handleEditTransaction(t)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                          <Plus size={14} className="rotate-45" /> {/* Use Plus rotated for "X" if no edit icon, but I'll use text for now or whatever is available */}
                                          <FileText size={14} />
                                       </button>
                                    )}
                                    {canDelete && (
                                       <button onClick={() => handleDeleteTransaction(t)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                          <Plus size={14} className="rotate-45" />
                                       </button>
                                    )}
                                  </div>
                                </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
            )}
          </div>

          {/* LADO DIREITO: ACOES RÁPIDAS */}
          <div className="lg:col-span-1 space-y-6">
            {currentSession && (
               <>
               {/* NOVO LANÇAMENTO */}
               <div className="bg-slate-900 rounded-2xl border p-6 shadow-sm space-y-4">
                 <h3 className="font-bold text-white flex items-center gap-2">
                   <Plus size={18} className="text-red-600" /> Novo Lançamento
                 </h3>
                <form onSubmit={handleAddTransaction} className="space-y-4">
                    {transId && (
                      <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        <span className="text-[10px] font-black text-emerald-700 uppercase">Editando Lançamento</span>
                        <button type="button" onClick={() => { setTransId(null); setTransAmount(''); setTransDesc(''); }} className="text-emerald-700 hover:text-emerald-900">
                          <AlertCircle size={14} />
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                          type="button"
                          onClick={() => {
                            setTransType('entrada');
                            if (transCategory === 'Sangria') setTransCategory('Suprimento');
                          }}
                          className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${transType === 'entrada' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                            <ArrowUpCircle size={16} /> ENTRADA
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setTransType('saida');
                            if (transCategory === 'Suprimento') setTransCategory('Sangria');
                          }}
                          className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${transType === 'saida' ? 'bg-rose-50 border-rose-500 text-rose-700' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                            <ArrowDownCircle size={16} /> SAÍDA
                        </button>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Valor do Lançamento</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                            <Input 
                              type="number" 
                              step="0.01" 
                              className="pl-10 font-bold" 
                              placeholder="0,00" 
                              value={transAmount}
                              onChange={e => setTransAmount(e.target.value)}
                              onBlur={e => setTransAmount(roundTo2(parseFloat(e.target.value)).toString())}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Categoria / Descrição</label>
                        <select 
                          className="w-full border border-slate-600 p-2.5 rounded-md text-sm font-bold outline-none focus:ring-2 focus:ring-red-600 bg-slate-800 mb-2"
                          value={transCategory}
                          onChange={e => setTransCategory(e.target.value)}
                        >
                            {transType === 'entrada' && <option value="Suprimento">Suprimento (Entrada)</option>}
                            {transType === 'saida' && <option value="Sangria">Sangria (Saída)</option>}
                            <option value="Ajuste">Ajuste de Saldo</option>
                        </select>
                        <Input 
                          placeholder="Motivo (opcional)" 
                          value={transDesc}
                          onChange={e => setTransDesc(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Meio de Pagamento</label>
                        <select 
                          className="w-full border border-slate-600 p-2.5 rounded-md text-sm outline-none focus:ring-2 focus:ring-red-600 bg-slate-800"
                          value={paymentMethod}
                          onChange={e => setPaymentMethod(e.target.value)}
                        >
                            <option value="Dinheiro">Dinheiro</option>
                            <option value="PIX">PIX</option>
                            <option value="Cartão de Crédito">Cartão de Crédito</option>
                            <option value="Cartão de Débito">Cartão de Débito</option>
                        </select>
                    </div>

                    <Button type="submit" disabled={submitting} className="w-full bg-slate-900 hover:bg-slate-800">
                        {submitting ? 'Processando...' : 'Realizar Lançamento'}
                    </Button>
                 </form>
               </div>

                {/* FECHAMENTO DE CAIXA */}
                {(() => {
                  const methodTotals = transactions.reduce((acc, t) => {
                    const method = t.paymentMethod || 'Dinheiro';
                    if (!acc[method]) acc[method] = 0;
                    if (t.type === 'entrada') acc[method] = roundTo2(acc[method] + t.amount);
                    else acc[method] = roundTo2(acc[method] - t.amount);
                    return acc;
                  }, {} as Record<string, number>);
                  
                  // O saldo inicial entra no cálculo do Dinheiro (físico)
                  methodTotals['Dinheiro'] = roundTo2((methodTotals['Dinheiro'] || 0) + (currentSession.initialBalance || 0));

                  return (
                    <div className="bg-slate-900 rounded-2xl p-6 shadow-lg text-white space-y-4">
                      <h3 className="font-bold flex items-center gap-2">
                        <Lock size={18} className="text-red-500" /> Fechamento de Turno
                      </h3>
                      
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resumo por Pagamento</p>
                        <div className="grid grid-cols-1 gap-2">
                          {Object.entries(methodTotals).map(([method, total]) => (
                            <div key={method} className="flex justify-between items-center bg-slate-800/50 p-2 rounded-lg border border-slate-800">
                              <span className="text-xs text-slate-400">{method}</span>
                              <span className="text-xs font-bold text-slate-200">{formatCurrency(total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 pt-2 border-t border-slate-800">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400 italic">Total Esperado (Geral):</span>
                            <span className="font-black text-emerald-400">
                              {formatCurrency(roundTo2(currentSession.initialBalance + (currentSession.totalInputs || 0) - (currentSession.totalOutputs || 0)))}
                            </span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Saldo Final em Dinheiro (Físico)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                                <Input 
                                  type="number" 
                                  step="0.01" 
                                  className="pl-10 font-bold bg-slate-800 border-slate-700 text-white" 
                                  placeholder="0,00" 
                                  value={closingBalance}
                                  onChange={e => setClosingBalance(e.target.value)}
                                  onBlur={e => setClosingBalance(roundTo2(parseFloat(e.target.value)).toString())}
                                  disabled={!canEdit}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">Confirme apenas o valor físico disponível na gaveta.</p>
                        </div>
                        {canEdit ? (
                          <Button onClick={handleCloseCaixa} disabled={submitting} variant="destructive" className="w-full">
                              {submitting ? 'Encerrando...' : 'Fechar Caixa para Balanço'}
                          </Button>
                        ) : (
                          <div className="p-3 bg-red-950/30 rounded-xl text-center text-red-500 font-bold text-xs border border-red-900 italic">
                            Você não tem permissão para fechar o caixa
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
               </>
            )}
            
            {/* CARD INFO SEGURANCA */}
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex gap-3">
              <AlertCircle className="text-amber-600 shrink-0" size={20} />
              <div className="text-[11px] text-amber-800 leading-tight">
                 <p className="font-bold mb-1">Segurança de Auditoria</p>
                 Todos os lançamentos do caixa são auditados e vinculados ao seu usuário. Lembre-se de fechar o caixa ao fim do seu expediente.
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* VISÃO DE HISTÓRICO */
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-2xl border shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <FileText size={16} /> Histórico de Encerramentos
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-slate-800 text-slate-400 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="p-4 text-left">ID Turno</th>
                    <th className="p-4 text-left">Aberto por</th>
                    <th className="p-4 text-left">Datas (Abr/Fech)</th>
                    <th className="p-4 text-right">Saldo Inicial</th>
                    <th className="p-4 text-right">Saldo Final</th>
                    <th className="p-4 text-right">Diferença</th>
                    <th className="p-4 text-right">Lançamentos</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-slate-400">Nenhum histórico disponível.</td></tr>
                  ) : sessions.map(s => {
                      const expected = roundTo2(s.initialBalance + (s.totalInputs || 0) - (s.totalOutputs || 0));
                      const diff = s.status === 'fechado' ? roundTo2((s.finalBalance || 0) - expected) : 0;
                      const isSelected = selectedSession?.id === s.id;
                      return (
                          <tr key={s.id} className={`hover:bg-slate-800 transition-colors ${isSelected ? 'bg-slate-800 border-l-4 border-red-600' : ''}`}>
                              <td className="p-4 text-slate-400 font-mono text-xs uppercase">{s.id}</td>
                              <td className="p-4 font-bold text-white">{s.openedByName}</td>
                              <td className="p-4 text-slate-400 text-xs">
                                  <div>{format(s.openedAt?.toDate() || new Date(), "dd/MM/yy HH:mm")}</div>
                                  {s.closedAt && <div className="text-[10px] text-slate-400 italic">Fechado: {format(s.closedAt?.toDate(), "dd/MM/yy HH:mm")}</div>}
                              </td>
                              <td className="p-4 text-right text-white">{formatCurrency(s.initialBalance)}</td>
                              <td className="p-4 text-right font-bold text-white">
                                {s.status === 'aberto' ? <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase">Em Aberto</span> : formatCurrency(s.finalBalance || 0)}
                              </td>
                              <td className={`p-4 text-right font-bold ${diff === 0 ? 'text-slate-400' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {s.status === 'fechado' ? formatCurrency(diff) : '-'}
                              </td>
                              <td className="p-4 text-right">
                                <button onClick={() => handleSelectSession(s)} className="text-[10px] font-black uppercase text-red-600 hover:underline">
                                  Ver detalhes
                                </button>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex justify-center gap-1">
                                  {s.status === 'fechado' && canReopen && (
                                    <button onClick={() => handleReopenCaixa(s.id!)} title="Reabrir Turno" className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                                      <TrendingUp size={16} />
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button onClick={() => handleDeleteCaixa(s.id!)} title="Excluir Turno" className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                      <ArrowDownCircle size={16} className="rotate-45" />
                                    </button>
                                  )}
                                </div>
                              </td>
                          </tr>
                      );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {selectedSession && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 rounded-2xl border shadow-lg overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b bg-slate-900 text-white flex justify-between items-center">
                  <div>
                    <h3 className="font-bold flex items-center gap-2">
                       <History size={16} className="text-red-500" /> Detalhes do Turno: {selectedSession.id}
                    </h3>
                    <p className="text-[10px] text-slate-400 opacity-70">Turno de {selectedSession.openedByName}</p>
                  </div>
                  <button onClick={() => setSelectedSession(null)} className="text-slate-400 hover:text-white">
                    <History size={20} className="rotate-45" />
                  </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
                 <div className="p-4 rounded-xl bg-slate-800 border">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Entradas</p>
                    <p className="text-lg font-black text-emerald-600">+{formatCurrency(selectedSession.totalInputs || 0)}</p>
                 </div>
                 <div className="p-4 rounded-xl bg-slate-800 border">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Saídas</p>
                    <p className="text-lg font-black text-rose-600">-{formatCurrency(selectedSession.totalOutputs || 0)}</p>
                 </div>
                 <div className="p-4 rounded-xl bg-slate-800 border">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Saldo Final Informado</p>
                    <p className="text-lg font-black text-white">{formatCurrency(selectedSession.finalBalance || 0)}</p>
                 </div>
                  <div className="p-4 rounded-xl bg-slate-800 border">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Diferença</p>
                    {(() => {
                        const exp = roundTo2(selectedSession.initialBalance + (selectedSession.totalInputs || 0) - (selectedSession.totalOutputs || 0));
                        const d = roundTo2((selectedSession.finalBalance || 0) - exp);
                        return <p className={`text-lg font-black ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(d)}</p>
                    })()}
                 </div>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-sm min-w-[600px]">
                   <thead className="bg-slate-800 text-slate-400 text-[10px] uppercase tracking-wider border-y">
                     <tr>
                       <th className="p-4 text-left">Data/Hora</th>
                       <th className="p-4 text-left">Categoria</th>
                       <th className="p-4 text-left">Metodo</th>
                       <th className="p-4 text-left">Descrição</th>
                       <th className="p-4 text-right">Valor</th>
                       <th className="p-4 text-center">Ações</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {loadingSessionTrans ? (
                       <tr><td colSpan={6} className="p-8 text-center text-slate-400">Carregando lançamentos...</td></tr>
                     ) : sessionTransactions.length === 0 ? (
                       <tr><td colSpan={6} className="p-8 text-center text-slate-400">Sem lançamentos.</td></tr>
                     ) : sessionTransactions.map(st => (
                        <tr key={st.id} className="hover:bg-slate-800 transition-colors">
                           <td className="p-4 text-xs text-slate-400">{format(st.createdAt?.toDate() || new Date(), "dd/MM/yy HH:mm")}</td>
                           <td className="p-4"><span className="text-[10px] bg-slate-950 px-2 py-0.5 rounded font-black uppercase text-slate-300">{st.category}</span></td>
                           <td className="p-4 text-slate-400 text-xs">{st.paymentMethod}</td>
                           <td className="p-4 font-medium text-white">{st.description || '-'}</td>
                           <td className={`p-4 text-right font-black ${st.type === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {st.type === 'entrada' ? '+' : '-'} {formatCurrency(st.amount)}
                           </td>
                           <td className="p-4 text-center">
                              <div className="flex justify-center gap-1">
                                 {canEdit && (
                                   <button onClick={() => {
                                      // Reopening the cash makes this session the "active" one for main view edits
                                      // But here we can edit directly if we are in history details
                                      // To keep it simple, I'll restrict editing in history to current active session only
                                      // OR I could implement a global update. 
                                      // The user requested: "editar os lançamentos contidos nele" even in history?
                                      // Let's allow if canEdit.
                                      handleEditTransaction(st);
                                      setView('status');
                                      toast("Redirecionado para o painel de lançamento para editar.");
                                   }} className="p-1 px-2 text-[10px] font-black uppercase bg-slate-950 text-slate-300 hover:bg-slate-900 hover:text-white rounded transition-colors">
                                     Editar
                                   </button>
                                 )}
                              </div>
                           </td>
                        </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
            </motion.div>
          )}
        </div>
      )}

    </div>
  );
}
