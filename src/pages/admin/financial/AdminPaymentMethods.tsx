import { useState, useEffect } from 'react';
import { settingsService, PaymentSettings, MethodConfig } from '../../../services/settingsService';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { 
  CreditCard, 
  Wallet, 
  Smartphone, 
  Banknote, 
  Truck, 
  Store, 
  Zap, 
  Check, 
  LucideIcon, 
  Building2, 
  Tablet, 
  Percent, 
  Clock, 
  ArrowLeft, 
  Scale, 
  BarChart3, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  SlidersHorizontal,
  DollarSign,
  Briefcase,
  Layers,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Interfaces for additional configurations
interface BankConfig {
  id: string;
  name: string;
  agency: string;
  account: string;
  pixKey: string;
  isDefault: boolean;
}

interface MachineConfig {
  id: string;
  name: string;
  serial: string;
  operator: string;
  status: 'active' | 'inactive';
}

interface CardRate {
  id: string;
  machineId: string;
  type: string;
  brand: string;
  fee: number;
}

interface Receivable {
  id: string;
  saleId: string;
  originalAmount: number;
  netAmount: number;
  fee: number;
  payoutDate: string;
  status: 'pending' | 'cleared';
  method: string;
}

interface Reconciliation {
  id: string;
  date: string;
  systemTotal: number;
  expectedTotal: number;
  reconciled: boolean;
  operator: string;
}

interface FinancialConfig {
  defaultPayoutTerm: string;
  antiFraudThreshold: number;
  autoPayoutEnabled: boolean;
  allowBankTransfer: boolean;
}

export function AdminPaymentMethods() {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // checkout configurations (Firestore settings)
  const [settings, setSettings] = useState<PaymentSettings>({
    methods: []
  });

  const methodIcons: Record<string, LucideIcon> = {
    pix: Smartphone,
    credit_card: CreditCard,
    debit_card: Wallet,
    cash: Banknote,
    smartphone: Smartphone,
    card: CreditCard,
    wallet: Wallet,
    banknote: Banknote,
    zap: Zap,
    settings: Settings,
  };

  // Additional financial states persisted via LocalStorage
  const [banks, setBanks] = useState<BankConfig[]>(() => {
    const saved = localStorage.getItem('discreta_financial_banks');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Itaú Unibanco', agency: '0340', account: '48392-1', pixKey: 'CNPJ: 14.819.382/0001-44', isDefault: true },
      { id: '2', name: 'C6 Bank SP', agency: '0001', account: '912384-5', pixKey: 'financeiro@discretaboutique.com.br', isDefault: false }
    ];
  });

  const [machines, setMachines] = useState<MachineConfig[]>(() => {
    const saved = localStorage.getItem('discreta_financial_machines');
    return saved ? JSON.parse(saved) : [
      { id: '1', name: 'Stone Terminal Pro', serial: 'ST-9283749', operator: 'Stone', status: 'active' },
      { id: '2', name: 'Moderninha Smart 2', serial: 'PAG-481923', operator: 'PagSeguro', status: 'active' }
    ];
  });

  const [cardRates, setCardRates] = useState<CardRate[]>(() => {
    const saved = localStorage.getItem('discreta_financial_card_rates');
    return saved ? JSON.parse(saved) : [
      { id: '1', machineId: '1', type: 'Débito', brand: 'Visa/Master', fee: 1.25 },
      { id: '2', machineId: '1', type: 'Crédito à Vista', brand: 'Visa/Master', fee: 2.79 },
      { id: '3', machineId: '1', type: 'Crédito Parcelado 2x-6x', brand: 'Visa/Master', fee: 3.20 },
      { id: '4', machineId: '2', type: 'Débito', brand: 'Elo/Amex', fee: 1.80 },
      { id: '5', machineId: '2', type: 'Crédito à Vista', brand: 'Elo/Amex', fee: 3.10 }
    ];
  });

  const [receivables, setReceivables] = useState<Receivable[]>(() => {
    const saved = localStorage.getItem('discreta_financial_receivables');
    return saved ? JSON.parse(saved) : [
      { id: '1', saleId: 'PDV-#PBPNSH', originalAmount: 68.90, netAmount: 67.21, fee: 1.69, payoutDate: '2026-06-17', status: 'pending', method: 'Crédito' },
      { id: '2', saleId: 'PDV-#PBPNDA', originalAmount: 250.00, netAmount: 246.88, fee: 3.12, payoutDate: '2026-06-18', status: 'pending', method: 'Débito' },
      { id: '3', saleId: 'PDV-#PBPNDF', originalAmount: 180.00, netAmount: 180.00, fee: 0.00, payoutDate: '2026-06-16', status: 'cleared', method: 'Pix' }
    ];
  });

  const [reconciliations, setReconciliations] = useState<Reconciliation[]>(() => {
    const saved = localStorage.getItem('discreta_financial_reconciliations');
    return saved ? JSON.parse(saved) : [
      { id: '1', date: '2026-06-15', systemTotal: 1540.90, expectedTotal: 1540.90, reconciled: true, operator: 'Gerente Administrativo' },
      { id: '2', date: '2026-06-16', systemTotal: 2120.50, expectedTotal: 2120.50, reconciled: false, operator: 'Caixa 01' }
    ];
  });

  const [financialConfigs, setFinancialConfigs] = useState<FinancialConfig>(() => {
    const saved = localStorage.getItem('discreta_financial_configs');
    return saved ? JSON.parse(saved) : {
      defaultPayoutTerm: '1',
      antiFraudThreshold: 10000,
      autoPayoutEnabled: true,
      allowBankTransfer: true
    };
  });

  // Keep lists synced with LocalStorage
  useEffect(() => {
    localStorage.setItem('discreta_financial_banks', JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    localStorage.setItem('discreta_financial_machines', JSON.stringify(machines));
  }, [machines]);

  useEffect(() => {
    localStorage.setItem('discreta_financial_card_rates', JSON.stringify(cardRates));
  }, [cardRates]);

  useEffect(() => {
    localStorage.setItem('discreta_financial_receivables', JSON.stringify(receivables));
  }, [receivables]);

  useEffect(() => {
    localStorage.setItem('discreta_financial_reconciliations', JSON.stringify(reconciliations));
  }, [reconciliations]);

  useEffect(() => {
    localStorage.setItem('discreta_financial_configs', JSON.stringify(financialConfigs));
  }, [financialConfigs]);


  // Load Firestore settings
  useEffect(() => {
    async function load() {
      try {
        const data = await settingsService.getPaymentSettings();
        setSettings(data);
      } catch (err) {
        console.error(err);
        toast("Erro ao carregar configurações de checkout", 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  const updateMethod = (methodId: string, updates: Partial<MethodConfig>) => {
    setSettings({
      ...settings,
      methods: settings.methods.map(m => m.id === methodId ? { ...m, ...updates } : m)
    });
  };

  const handleSaveCheckoutSettings = async () => {
    setSaving(true);
    try {
      await settingsService.savePaymentSettings(settings);
      toast("Meios de Pagamento de checkout atualizados!", 'success');
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar configurações", 'error');
    } finally {
      setSaving(false);
    }
  };

  // State/Input state variables for sub-forms
  // New Payment Method states
  const [newMethodLabel, setNewMethodLabel] = useState('');
  const [newMethodIconKey, setNewMethodIconKey] = useState('card');
  const [newMethodEnabledDelivery, setNewMethodEnabledDelivery] = useState(true);
  const [newMethodEnabledPickup, setNewMethodEnabledPickup] = useState(true);
  const [newMethodUseIntegration, setNewMethodUseIntegration] = useState(false);

  // Banks Form state
  const [newBankName, setNewBankName] = useState('');
  const [newBankAgency, setNewBankAgency] = useState('');
  const [newBankAccount, setNewBankAccount] = useState('');
  const [newBankPix, setNewBankPix] = useState('');

  // Machines form state
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineSerial, setNewMachineSerial] = useState('');
  const [newMachineOperator, setNewMachineOperator] = useState('Stone');

  // Rates form state
  const [newRateMachineId, setNewRateMachineId] = useState('1');
  const [newRateType, setNewRateType] = useState('Débito');
  const [newRateBrand, setNewRateBrand] = useState('Visa/Master');
  const [newRateFee, setNewRateFee] = useState(1.5);

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodLabel.trim()) {
      toast("O nome do meio de pagamento é obrigatório", "error");
      return;
    }

    const cleanLabel = newMethodLabel.trim();
    const id = cleanLabel
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (settings.methods.some(m => m.id === id)) {
      toast("Este meio de pagamento já está cadastrado ou possui nome similar", "error");
      return;
    }

    const newMethod: MethodConfig = {
      id,
      label: cleanLabel,
      enabledDelivery: newMethodEnabledDelivery,
      enabledPickup: newMethodEnabledPickup,
      useIntegration: newMethodUseIntegration,
      icon: newMethodIconKey,
    };

    setSettings({
      ...settings,
      methods: [...settings.methods, newMethod]
    });

    setNewMethodLabel('');
    setNewMethodIconKey('card');
    setNewMethodEnabledDelivery(true);
    setNewMethodEnabledPickup(true);
    setNewMethodUseIntegration(false);
    toast("Meio de pagamento adicionado à lista local! Salve para persistir no banco.", "success");
  };

  const handleDeletePaymentMethod = (id: string) => {
    const isProtected = ['pix', 'credit_card', 'debit_card', 'cash'].includes(id);
    if (isProtected) {
      if (!confirm("Este é um meio de pagamento nativo do sistema. Tem certeza que deseja removê-lo?")) {
        return;
      }
    }
    setSettings({
      ...settings,
      methods: settings.methods.filter(m => m.id !== id)
    });
    toast("Meio de pagamento removido! Salve para persistir no banco.", "success");
  };

  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName || !newBankAccount) {
      toast("Preencha o nome do banco e a conta", "error");
      return;
    }
    const newBank: BankConfig = {
      id: Date.now().toString(),
      name: newBankName,
      agency: newBankAgency,
      account: newBankAccount,
      pixKey: newBankPix,
      isDefault: banks.length === 0
    };
    setBanks([...banks, newBank]);
    setNewBankName('');
    setNewBankAgency('');
    setNewBankAccount('');
    setNewBankPix('');
    toast("Banco cadastrado com sucesso!", "success");
  };

  const handleSetDefaultBank = (id: string) => {
    setBanks(banks.map(b => ({ ...b, isDefault: b.id === id })));
    toast("Conta padrão de recebimento alterada!", "success");
  };

  const handleDeleteBank = (id: string) => {
    setBanks(banks.filter(b => b.id !== id));
    toast("Conta bancária removida", "success");
  };

  const handleAddMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName || !newMachineSerial) {
      toast("Preencha as informações da maquininha", "error");
      return;
    }
    const newMac: MachineConfig = {
      id: Date.now().toString(),
      name: newMachineName,
      serial: newMachineSerial,
      operator: newMachineOperator,
      status: 'active'
    };
    setMachines([...machines, newMac]);
    setNewMachineName('');
    setNewMachineSerial('');
    toast("Maquininha adicionada com sucesso!", "success");
  };

  const toggleMachineStatus = (id: string) => {
    setMachines(machines.map(m => m.id === id ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' } : m));
    toast("Status da maquininha alterado!", "success");
  };

  const handleDeleteMachine = (id: string) => {
    setMachines(machines.filter(m => m.id !== id));
    toast("Maquininha removida", "success");
  };

  const handleAddRate = (e: React.FormEvent) => {
    e.preventDefault();
    const newRate: CardRate = {
      id: Date.now().toString(),
      machineId: newRateMachineId,
      type: newRateType,
      brand: newRateBrand,
      fee: Number(newRateFee) || 0
    };
    setCardRates([...cardRates, newRate]);
    toast("Taxa de cartão cadastrada!", "success");
  };

  const handleDeleteRate = (id: string) => {
    setCardRates(cardRates.filter(r => r.id !== id));
    toast("Taxa de cartão removida", "success");
  };

  const handleReconcile = (id: string) => {
    setReconciliations(reconciliations.map(r => r.id === id ? { ...r, reconciled: !r.reconciled } : r));
    toast("Status de conciliação atualizado!", "success");
  };

  const handleClearReceivable = (id: string) => {
    setReceivables(receivables.map(r => r.id === id ? { ...r, status: r.status === 'cleared' ? 'pending' : 'cleared' } : r));
    toast("Lançamento de recebível atualizado!", "success");
  };

  const formatBRL = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-[10px] font-black uppercase tracking-[5px] text-zinc-500">Sincronizando Módulo Financeiro</span>
      </div>
    );
  }

  // Cards configurations
  const menuCards = [
    {
      id: 'dashboard',
      title: 'Dashboard Financeiro',
      description: 'Resumo rápido de vendas, taxas acumuladas e créditos a compensar.',
      icon: BarChart3,
      badge: 'Visualização'
    },
    {
      id: 'meios',
      title: 'Meios de Pagamento',
      description: 'Cadastro e controle de Pix, dinheiro, débito, crédito e links.',
      icon: CreditCard,
      badge: 'Checkout'
    },
    {
      id: 'bancos',
      title: 'Bancos e Contas',
      description: 'Cadastro de bancos, contas, chaves Pix e conta padrão do caixa.',
      icon: Building2,
      badge: 'Bancário'
    },
    {
      id: 'maquininhas',
      title: 'Maquininhas',
      description: 'Terminais de adquirentes físicas e digitais usadas pela loja.',
      icon: Tablet,
      badge: 'POS'
    },
    {
      id: 'taxas',
      title: 'Taxas de Cartão',
      description: 'Tarifas por maquininha, bandeira, forma de pagamento e parcelamento.',
      icon: Percent,
      badge: 'Comissões'
    },
    {
      id: 'recebiveis',
      title: 'Recebíveis',
      description: 'Controle de fluxo de recebíveis futuros e datas de compensação.',
      icon: Clock,
      badge: 'Fluxo'
    },
    {
      id: 'conciliacao',
      title: 'Conciliação',
      description: 'Audite os proventos reais depositados contra as vendas de sistema.',
      icon: Scale,
      badge: 'Auditoria'
    },
    {
      id: 'relatorios',
      title: 'Relatórios',
      description: 'Relatório de vendas por forma, taxas deduzidas e líquido real.',
      icon: BarChart3,
      badge: 'Indicadores'
    },
    {
      id: 'configuracoes',
      title: 'Configurações',
      description: 'Configurações dos prazos padrão, regras antifraude e automações.',
      icon: Settings,
      badge: 'Gerais'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto pb-44 px-4 sm:px-6">
      <AnimatePresence mode="wait">
        {activeCard === null ? (
          // DASHBOARD DE CARDS (VIEW INICIAL)
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
          >
            <header className="mb-14">
              <span className="text-[10px] font-black uppercase tracking-[8px] text-red-600 mb-3 block">Boutique Financial</span>
              <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-white leading-none">
                Gestão <br/>
                <span className="text-red-600 drop-shadow-[0_0_12px_rgba(255,30,30,0.3)]">Financeira</span>
              </h1>
              <p className="text-zinc-500 text-xs mt-3 max-w-lg leading-relaxed">
                Central de controle administrativo. Gerencie taxas de adquirência, contas padrão, maquininhas físicas da boutique e configure os meios de pagamento do e-commerce.
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {menuCards.map((card, idx) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setActiveCard(card.id)}
                    className="group relative bg-[#131316] border border-zinc-800/80 hover:border-red-600/60 rounded-[1.5rem] p-6 cursor-pointer hover:shadow-[0_0_20px_rgba(255,30,30,0.08)] transition-all duration-300 flex flex-col justify-between"
                  >
                    <div className="absolute top-4 right-4 text-[8px] font-black tracking-widest text-zinc-600 uppercase border border-zinc-800/80 px-2 py-0.5 rounded-full group-hover:text-red-500 group-hover:border-red-500/30 transition-all">
                      {card.badge}
                    </div>

                    <div>
                      <div className="w-12 h-12 bg-zinc-950 rounded-2xl flex items-center justify-center text-red-500 border border-zinc-800/80 mb-5 group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                        <Icon size={22} />
                      </div>
                      <h3 className="text-lg font-black uppercase italic tracking-tight text-white group-hover:text-red-500 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-zinc-400 text-xs mt-2 leading-relaxed font-normal">
                        {card.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-zinc-950 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors uppercase tracking-wider">Acessar</span>
                      <div className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-red-500 group-hover:border-red-600 group-hover:translate-x-1 transition-all">
                        <Plus size={12} />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : (
          // CONTEÚDO DETALHADO DO CARD SELECIONADO
          <motion.div
            key="card-view"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            {/* Header com botão de voltar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-900">
              <div>
                <button
                  onClick={() => setActiveCard(null)}
                  className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-all mb-3"
                >
                  <ArrowLeft size={12} /> Voltar à Central
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
                    {menuCards.find(c => c.id === activeCard)?.title}
                  </h2>
                </div>
              </div>
              
              <div className="text-xs font-bold text-zinc-500 bg-zinc-950 px-4 py-2 border border-zinc-800 rounded-xl">
                Boutique Admin • {menuCards.find(c => c.id === activeCard)?.badge}
              </div>
            </div>

            {/* CARD 1: DASHBOARD FINANCEIRO */}
            {activeCard === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider block">Faturamento Bruto</span>
                    <span className="text-2xl font-black text-white block mt-1">{formatBRL(42910.80)}</span>
                    <span className="text-[9px] text-emerald-500 mt-2 block font-medium">↑ +14.2% comparado ao mês anterior</span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider block">Créditos Pendentes</span>
                    <span className="text-2xl font-black text-white block mt-1">{formatBRL(318.78)}</span>
                    <span className="text-[9px] text-zinc-400 mt-2 block">2 recebíveis aguardando liberação</span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider block">Tarifas de Adquirentes</span>
                    <span className="text-2xl font-black text-red-500 block mt-1">{formatBRL(1012.33)}</span>
                    <span className="text-[9px] text-zinc-400 mt-2 block">Média contratatada de 2.35% a.m.</span>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider block">Saldo Total em Contas</span>
                    <span className="text-2xl font-black text-emerald-500 mt-1 block font-black">{formatBRL(18420.00)}</span>
                    <span className="text-[9px] text-zinc-400 mt-2 block">Somatória de Itaú & C6 Bank</span>
                  </div>
                </div>

                <div className="bg-zinc-900/40 border border-zinc-800 rounded-[1.5rem] p-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Sparkles size={14} className="text-red-500" /> Fluxo Diário Projetado (Inflows)
                  </h3>
                  <div className="h-44 flex items-end gap-3 pt-6 border-b border-zinc-800 px-2 lg:px-4">
                    {[3400, 1800, 0, 4200, 2900, 5600, 4100, 3100, 0, 2100, 4500, 6200].map((val, idx) => {
                      const max = 7000;
                      const pct = Math.max(5, (val / max) * 100);
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                          <span className="text-[8px] font-bold text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {val > 0 ? formatBRL(val) : '-'}
                          </span>
                          <div 
                            style={{ height: `${pct}%` }} 
                            className={`w-full rounded-t-md transition-all duration-300 ${val > 4000 ? 'bg-red-600' : val > 0 ? 'bg-zinc-700 hover:bg-zinc-500' : 'bg-transparent border-b-2 border-zinc-800'}`}
                          />
                          <span className="text-[7.5px] font-mono text-zinc-600 mt-1">D-{12-idx}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* CARD 2: MEIOS DE PAGAMENTO (ORIGINAL SCREEN METHOD TOGGLES) */}
            {activeCard === 'meios' && (
              <div className="space-y-6">
                <div className="bg-zinc-950 p-4 border border-zinc-900 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <p className="text-zinc-400 text-xs leading-relaxed max-w-2xl">
                    Gerencie, ative e cadastre todas as formas de recebimento aceitas no checkout de vendas e-commerce e as respectivas opções de entrega ou retirada na loja física.
                  </p>
                  <Button
                    onClick={handleSaveCheckoutSettings}
                    disabled={saving}
                    className="h-10 px-6 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] whitespace-nowrap self-start md:self-center"
                  >
                    {saving ? 'Gravando...' : 'Salvar no Banco'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Cadastrar Novo Meio de Pagamento Form */}
                  <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-[1.5rem] h-fit space-y-6">
                    <div>
                      <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider mb-1">Cadastrar Meio de Pagamento</h4>
                      <p className="text-[10px] text-zinc-500">Adicione formas de cobrança personalizadas para o e-commerce.</p>
                    </div>

                    <form onSubmit={handleAddPaymentMethod} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Nome do Meio (Ex: Boleto, VA)</label>
                        <input 
                          type="text" 
                          value={newMethodLabel} 
                          onChange={e => setNewMethodLabel(e.target.value)}
                          placeholder="Ex: Transferência Bancária, Vale Alimentação" 
                          className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600 placeholder-zinc-700"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Representação Visual (Ícone)</label>
                        <div className="grid grid-cols-5 gap-2">
                          {[
                            { key: 'card', icon: CreditCard, label: 'Cartão' },
                            { key: 'smartphone', icon: Smartphone, label: 'Pix' },
                            { key: 'wallet', icon: Wallet, label: 'Débito' },
                            { key: 'banknote', icon: Banknote, label: 'Físico' },
                            { key: 'zap', icon: Zap, label: 'Digital' },
                          ].map((item) => {
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.key}
                                type="button"
                                title={item.label}
                                onClick={() => setNewMethodIconKey(item.key)}
                                className={`h-11 rounded-xl flex items-center justify-center border transition-all ${
                                  newMethodIconKey === item.key
                                    ? 'bg-red-600/10 border-red-500 text-red-500'
                                    : 'bg-zinc-950 border-zinc-900 text-zinc-500 hover:border-zinc-800 hover:text-zinc-300'
                                }`}
                              >
                                <ItemIcon size={18} />
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        {/* Delivery Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-300 font-bold uppercase tracking-wider">Habilitar p/ Entrega</span>
                          <button
                            type="button"
                            onClick={() => setNewMethodEnabledDelivery(!newMethodEnabledDelivery)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodEnabledDelivery ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodEnabledDelivery ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                          </button>
                        </div>

                        {/* Pickup Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-300 font-bold uppercase tracking-wider">Habilitar p/ Retirada</span>
                          <button
                            type="button"
                            onClick={() => setNewMethodEnabledPickup(!newMethodEnabledPickup)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodEnabledPickup ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodEnabledPickup ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                          </button>
                        </div>

                        {/* Integration Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-300 font-bold uppercase tracking-wider">Usar Gateway Online</span>
                          <button
                            type="button"
                            onClick={() => setNewMethodUseIntegration(!newMethodUseIntegration)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodUseIntegration ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                          >
                            <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodUseIntegration ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                          </button>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-4"
                      >
                        Cadastrar Meio
                      </Button>
                    </form>
                  </div>

                  {/* List of Payment Methods */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider">Meios de Pagamento Ativos</h4>

                    <div className="grid grid-cols-1 gap-4">
                      {settings.methods.map((method, idx) => {
                        const Icon = methodIcons[method.icon || ''] || methodIcons[method.id] || Smartphone;
                        return (
                          <div
                            key={method.id}
                            className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col lg:flex-row items-start lg:items-center gap-6"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center text-red-500 border border-zinc-800">
                                <Icon size={24} />
                              </div>
                              <div>
                                <h4 className="text-base font-bold uppercase text-white">{method.label}</h4>
                                <p className="text-[9px] font-mono text-zinc-500 mt-0.5">METODO: {method.id}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                              <button
                                onClick={() => updateMethod(method.id, { enabledDelivery: !method.enabledDelivery })}
                                className={`flex items-center gap-2 px-3 py-1.5 h-9 rounded-lg border text-[10px] uppercase font-black tracking-wider transition-all ${
                                  method.enabledDelivery 
                                    ? "bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.05)]" 
                                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                }`}
                              >
                                <Truck size={12} />
                                <span>Entrega</span>
                                {method.enabledDelivery && <Check size={10} />}
                              </button>

                              <button
                                onClick={() => updateMethod(method.id, { enabledPickup: !method.enabledPickup })}
                                className={`flex items-center gap-2 px-3 py-1.5 h-9 rounded-lg border text-[10px] uppercase font-black tracking-wider transition-all ${
                                  method.enabledPickup 
                                    ? "bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.05)]" 
                                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                }`}
                              >
                                <Store size={12} />
                                <span>Retirada</span>
                                {method.enabledPickup && <Check size={10} />}
                              </button>

                              <button
                                onClick={() => updateMethod(method.id, { useIntegration: !method.useIntegration })}
                                className={`flex items-center gap-2 px-3 py-1.5 h-9 rounded-lg border text-[10px] uppercase font-black tracking-wider transition-all ${
                                  method.useIntegration 
                                    ? "bg-emerald-500/15 border-emerald-500 text-emerald-500" 
                                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                }`}
                              >
                                <Zap size={12} />
                                <span>Gateway Online</span>
                                {method.useIntegration && <Check size={10} />}
                              </button>

                              <button
                                onClick={() => handleDeletePaymentMethod(method.id)}
                                className="w-9 h-9 flex items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-500 hover:text-red-500 hover:border-red-500/30 transition-all ml-1"
                                title="Excluir Meio de Pagamento"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 3: BANCOS E CONTAS */}
            {activeCard === 'bancos' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form Cadastro */}
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-[1.5rem] h-fit">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider mb-4">Adicionar Nova Conta</h4>
                  <form onSubmit={handleAddBank} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Nome do Banco</label>
                      <input 
                        type="text" 
                        value={newBankName} 
                        onChange={e => setNewBankName(e.target.value)}
                        placeholder="Ex: Itaú, Bradesco, C6, Nubank" 
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Agência</label>
                        <input 
                          type="text" 
                          value={newBankAgency} 
                          onChange={e => setNewBankAgency(e.target.value)}
                          placeholder="Ex: 0001" 
                          className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Conta Corrente</label>
                        <input 
                          type="text" 
                          value={newBankAccount} 
                          onChange={e => setNewBankAccount(e.target.value)}
                          placeholder="Ex: 12345-6" 
                          className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Chave Pix Associada</label>
                      <input 
                        type="text" 
                        value={newBankPix} 
                        onChange={e => setNewBankPix(e.target.value)}
                        placeholder="E-mail, CNPJ ou telefone" 
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                    >
                      Cadastrar Conta
                    </Button>
                  </form>
                </div>

                {/* Lista de Contas */}
                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider">Contas Ativas para Depósito</h4>
                  {banks.length === 0 ? (
                    <div className="p-8 text-center bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 rounded-2xl text-xs">
                      Nenhuma conta cadastrada inicialmente. Use o formulário à esquerda.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {banks.map(bank => (
                        <div 
                          key={bank.id} 
                          className={`p-5 rounded-2xl border transition-all ${bank.isDefault ? 'bg-red-600/5 border-red-600' : 'bg-zinc-900/40 border-zinc-800/80'}`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-sm font-black text-white block uppercase italic">{bank.name}</span>
                              <span className="text-[10px] text-zinc-400 block mt-1">Agência: {bank.agency} • CC: {bank.account}</span>
                            </div>
                            <button 
                              onClick={() => handleDeleteBank(bank.id)}
                              className="text-zinc-500 hover:text-red-500 p-1"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div className="mt-4 pt-3 border-t border-zinc-900 flex justify-between items-center">
                            <div className="text-[9px] text-zinc-500">
                              <span className="block font-black uppercase">Chave Pix:</span>
                              <span className="text-zinc-300">{bank.pixKey || 'Não cadastrada'}</span>
                            </div>

                            {bank.isDefault ? (
                              <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-red-600 text-white">Padrão</span>
                            ) : (
                              <button 
                                onClick={() => handleSetDefaultBank(bank.id)}
                                className="text-[8.5px] font-black uppercase tracking-wider text-zinc-400 hover:text-white"
                              >
                                Tornar Padrão
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* CARD 4: MAQUININHAS */}
            {activeCard === 'maquininhas' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form maquininhas */}
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-[1.5rem] h-fit">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider mb-4">Cadastrar Maquininha POS</h4>
                  <form onSubmit={handleAddMachine} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Identificação / Nome</label>
                      <input 
                        type="text" 
                        value={newMachineName} 
                        onChange={e => setNewMachineName(e.target.value)}
                        placeholder="Ex: Stone Terminal Frente" 
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Nº de Série (Serial)</label>
                      <input 
                        type="text" 
                        value={newMachineSerial} 
                        onChange={e => setNewMachineSerial(e.target.value)}
                        placeholder="Ex: ST-9283749" 
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Operadora / Adquirente</label>
                      <select 
                        value={newMachineOperator} 
                        onChange={e => setNewMachineOperator(e.target.value)}
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                      >
                        <option value="Stone">Stone</option>
                        <option value="Rede">Redecard</option>
                        <option value="Cielo">Cielo</option>
                        <option value="PagSeguro">PagSeguro</option>
                        <option value="Mercado Pago">Mercado Pago</option>
                      </select>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                    >
                      Salvar Dispositivo
                    </Button>
                  </form>
                </div>

                {/* Lista Maquininhas */}
                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider">Dispositivos POS Ativos</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {machines.map(m => (
                      <div key={m.id} className="p-5 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-black text-white block uppercase italic">{m.name}</span>
                            <span className="text-[10px] font-mono text-zinc-400 block mt-1">S/N: {m.serial}</span>
                          </div>
                          <button 
                            onClick={() => handleDeleteMachine(m.id)}
                            className="text-zinc-500 hover:text-red-500 p-1"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="mt-6 pt-3 border-t border-zinc-950 flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded bg-[#09090b] border border-zinc-800 text-zinc-300">
                            PROVEDOR: {m.operator}
                          </span>

                          <button
                            onClick={() => toggleMachineStatus(m.id)}
                            className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg transition-all ${
                              m.status === 'active' 
                                ? 'bg-red-500/10 border border-red-500/30 text-red-500' 
                                : 'bg-zinc-950 border border-zinc-800 text-zinc-600'
                            }`}
                          >
                            {m.status === 'active' ? '● Ativo' : '○ Inativo'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* CARD 5: TAXAS DE CARTÃO */}
            {activeCard === 'taxas' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Form taxas */}
                <div className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-[1.5rem] h-fit">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider mb-4">Adicionar Regra de Taxa</h4>
                  <form onSubmit={handleAddRate} className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Maquininha</label>
                      <select 
                        value={newRateMachineId} 
                        onChange={e => setNewRateMachineId(e.target.value)}
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                      >
                        {machines.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Bandeira</label>
                      <select 
                        value={newRateBrand} 
                        onChange={e => setNewRateBrand(e.target.value)}
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                      >
                        <option value="Visa/Master">Visa/Mastercard</option>
                        <option value="Elo">Elo</option>
                        <option value="Amex">American Express</option>
                        <option value="Hipercard">Hipercard</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Modalidade</label>
                        <select 
                          value={newRateType} 
                          onChange={e => setNewRateType(e.target.value)}
                          className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                        >
                          <option value="Débito">Débito</option>
                          <option value="Crédito à Vista">Crédito à Vista</option>
                          <option value="Crédito Parcelado 2x-6x">Crédito 2x-6x</option>
                          <option value="Crédito Parcelado 7x-12x">Crédito 7x-12x</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Alíquota (%)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={newRateFee} 
                          onChange={e => setNewRateFee(Number(e.target.value))}
                          placeholder="Ex: 1.99" 
                          className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                        />
                      </div>
                    </div>
                    <Button 
                      type="submit" 
                      className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                    >
                      Cadastrar Taxa
                    </Button>
                  </form>
                </div>

                {/* Tabela taxas */}
                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider">Grade de Custos de Operações</h4>
                  <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase font-bold text-[9px] tracking-wider">
                          <th className="p-4">Maquininha</th>
                          <th className="p-4">Bandeira</th>
                          <th className="p-4">Alíquota</th>
                          <th className="p-4">Modalidade</th>
                          <th className="p-4 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 text-zinc-300">
                        {cardRates.map(rate => {
                          const macName = machines.find(m => m.id === rate.machineId)?.name || 'Anônima';
                          return (
                            <tr key={rate.id} className="hover:bg-zinc-900/40">
                              <td className="p-4 font-black uppercase italic">{macName}</td>
                              <td className="p-4 text-zinc-400">{rate.brand}</td>
                              <td className="p-4 font-bold text-red-500">{rate.fee}%</td>
                              <td className="p-4 text-zinc-400 font-mono text-[10px]">{rate.type}</td>
                              <td className="p-4 text-center">
                                <button 
                                  onClick={() => handleDeleteRate(rate.id)}
                                  className="text-zinc-500 hover:text-red-500 transition-all p-1"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 6: RECEBÍVEIS */}
            {activeCard === 'recebiveis' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider">Lançamentos de Recebíveis Futuros</h4>
                  <span className="text-[10px] font-mono text-zinc-500">Fluxo projetado por vendas de cartão</span>
                </div>

                <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase font-bold text-[9px] tracking-wider">
                        <th className="p-4">Identificador de Venda</th>
                        <th className="p-4">Forma</th>
                        <th className="p-4">Valor Bruto</th>
                        <th className="p-4">Taxas Dedução</th>
                        <th className="p-4">Valor Líquido</th>
                        <th className="p-4">Data Estimada</th>
                        <th className="p-4">Compensação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300">
                      {receivables.map(r => (
                        <tr key={r.id} className="hover:bg-zinc-900/40">
                          <td className="p-4 font-black text-white">{r.saleId}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 rounded bg-[#131316] border border-zinc-800 text-[10px] text-zinc-400 uppercase font-bold">
                              {r.method}
                            </span>
                          </td>
                          <td className="p-4 font-mono">{formatBRL(r.originalAmount)}</td>
                          <td className="p-4 font-mono text-red-500">-{formatBRL(r.originalAmount - r.netAmount)} (-{r.fee > 0 ? `${((r.fee / r.originalAmount)*100).toFixed(1)}%` : '0%'})</td>
                          <td className="p-4 font-black text-emerald-500 font-mono">{formatBRL(r.netAmount)}</td>
                          <td className="p-4 text-zinc-500 font-mono">{r.payoutDate}</td>
                          <td className="p-4">
                            <button
                              onClick={() => handleClearReceivable(r.id)}
                              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                r.status === 'cleared'
                                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
                                  : 'bg-zinc-950 border border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-300'
                              }`}
                            >
                              {r.status === 'cleared' ? '✓ Pago em Conta' : 'A Compensar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CARD 7: CONCILIAÇÃO */}
            {activeCard === 'conciliacao' && (
              <div className="space-y-6">
                <div className="p-4 bg-zinc-900/40 border border-zinc-800 rounded-xl leading-relaxed text-xs text-zinc-400">
                  A conciliação audita se o fechamento do caixa físico bate com os relatórios consolidados de adquirentes e extratos bancários.
                </div>

                <div className="bg-[#0c0c0e] border border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase font-bold text-[9px] tracking-wider">
                        <th className="p-4">Dia do Turno</th>
                        <th className="p-4">Operador Auditor</th>
                        <th className="p-4">Faturamento Sistema</th>
                        <th className="p-4">Depósito Conferido</th>
                        <th className="p-4">Inconsistência</th>
                        <th className="p-4">Feito por</th>
                        <th className="p-4 text-center">Auditar Fechamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900 text-zinc-300">
                      {reconciliations.map(rec => {
                        const diff = rec.expectedTotal - rec.systemTotal;
                        return (
                          <tr key={rec.id} className="hover:bg-zinc-900/40">
                            <td className="p-4 font-mono font-bold text-white">{rec.date}</td>
                            <td className="p-4 text-zinc-400 uppercase font-bold">{rec.operator}</td>
                            <td className="p-4 font-mono">{formatBRL(rec.systemTotal)}</td>
                            <td className="p-4 font-mono">{formatBRL(rec.expectedTotal)}</td>
                            <td className={`p-4 font-mono ${diff === 0 ? 'text-zinc-500' : 'text-red-500 font-bold'}`}>
                              {diff === 0 ? 'Sem divergência' : formatBRL(diff)}
                            </td>
                            <td className="p-4 text-zinc-500">Supervisão</td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleReconcile(rec.id)}
                                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all inline-flex items-center gap-1 ${
                                  rec.reconciled
                                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                                    : 'bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white'
                                }`}
                              >
                                <CheckCircle2 size={11} />
                                <span>{rec.reconciled ? 'Conciliado' : 'Marcar Conciliado'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CARD 8: RELATÓRIOS FINANCEIROS */}
            {activeCard === 'relatorios' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribuição por Meio */}
                <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-[1.5rem] space-y-6">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider flex items-center gap-2">
                    <Check size={14} className="text-red-500" /> Distribuição de Receitas
                  </h4>

                  <div className="space-y-4">
                    {[
                      { type: 'Pix', pct: 45, val: 19309.86, color: 'bg-red-700' },
                      { type: 'Crédito à Vista', pct: 30, val: 12873.24, color: 'bg-zinc-100' },
                      { type: 'Crédito Parcelado', pct: 15, val: 6436.62, color: 'bg-zinc-600' },
                      { type: 'Dinheiro', pct: 10, val: 4291.08, color: 'bg-zinc-800' }
                    ].map((row, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-300">{row.type}</span>
                          <span className="font-mono text-zinc-500">{formatBRL(row.val)} ({row.pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-[#09090b] rounded-full overflow-hidden border border-zinc-900">
                          <div style={{ width: `${row.pct}%` }} className={`h-full rounded-full ${row.color}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deduções de Taxas */}
                <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-[1.5rem] space-y-6">
                  <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-red-500" /> Resumo Consolidado Deduções
                  </h4>

                  <div className="space-y-4 text-xs">
                    <div className="flex justify-between items-center py-2.5 border-b border-zinc-900">
                      <span className="text-zinc-400">Faturamento Bruto</span>
                      <span className="font-mono font-bold text-white">{formatBRL(42910.80)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-zinc-900">
                      <span className="text-zinc-400">Total Descontado Taxas</span>
                      <span className="font-mono font-bold text-red-500">-{formatBRL(1012.33)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-zinc-900">
                      <span className="text-zinc-400">Margem Tributária Deduzida</span>
                      <span className="font-mono font-bold text-red-500">-{formatBRL(2145.54)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-red-600/5 px-4 rounded-xl border border-red-500/20">
                      <span className="font-black text-red-500 uppercase tracking-wide">Faturamento Líquido Real</span>
                      <span className="font-mono font-black text-white text-base">{formatBRL(39752.93)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CARD 9: CONFIGURAÇÕES GERAIS */}
            {activeCard === 'configuracoes' && (
              <div className="max-w-2xl bg-zinc-900/40 border border-zinc-800 rounded-[1.5rem] p-6 space-y-6">
                <h4 className="text-zinc-200 font-black uppercase text-xs tracking-wider">Políticas Financeiras da Boutique</h4>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Prazo Padrão de Repasse (Dias Correntes)</label>
                    <select 
                      value={financialConfigs.defaultPayoutTerm}
                      onChange={e => setFinancialConfigs({ ...financialConfigs, defaultPayoutTerm: e.target.value })}
                      className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-red-600"
                    >
                      <option value="1">1 Dia Útil (D+1 Antecipado)</option>
                      <option value="14">14 Dias Úteis (D+14)</option>
                      <option value="30">30 Dias Sem Antecipação (D+30)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Limite Máximo de Risco Antifraude (Por Transação)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">R$</span>
                      <input 
                        type="number" 
                        value={financialConfigs.antiFraudThreshold}
                        onChange={e => setFinancialConfigs({ ...financialConfigs, antiFraudThreshold: Number(e.target.value) || 0 })}
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 text-xs text-white focus:outline-none focus:border-red-600"
                      />
                    </div>
                  </div>

                  <div className="pt-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-zinc-200 block">Saque Automático Ativo</span>
                      <span className="text-[10px] text-zinc-400">Inicia transferência diária para conta bancária padrão ao fechar caixa.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFinancialConfigs({ ...financialConfigs, autoPayoutEnabled: !financialConfigs.autoPayoutEnabled })}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${financialConfigs.autoPayoutEnabled ? 'bg-red-600' : 'bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 left-1.0 bg-white w-4 h-4 rounded-full transition-all duration-300 ${financialConfigs.autoPayoutEnabled ? 'translate-x-[24px]' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="pt-3 border-t border-zinc-900 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-zinc-200 block">Permitir Transferência Bancária Manual (TED)</span>
                      <span className="text-[10px] text-zinc-400">Ativa opção de TED no painel de vendas administrativas.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFinancialConfigs({ ...financialConfigs, allowBankTransfer: !financialConfigs.allowBankTransfer })}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${financialConfigs.allowBankTransfer ? 'bg-red-600' : 'bg-zinc-800'}`}
                    >
                      <div className={`absolute top-1 left-1.0 bg-white w-4 h-4 rounded-full transition-all duration-300 ${financialConfigs.allowBankTransfer ? 'translate-x-[24px]' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={() => {
                      toast("Políticas financeiras gravadas com sucesso!", "success");
                    }}
                    className="h-11 px-8 bg-zinc-950 hover:bg-zinc-900 text-white border border-zinc-800 font-bold uppercase tracking-widest text-[10px] rounded-xl transition-all"
                  >
                    Salvar Ajustes Gerais
                  </Button>
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
