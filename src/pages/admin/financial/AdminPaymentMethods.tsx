import { useState, useEffect } from 'react';
import { settingsService, PaymentSettings, MethodConfig } from '../../../services/settingsService';
import { 
  paymentFinanceService, 
  BankConfig, 
  Acquirer, 
  CardBrand, 
  MachineConfig, 
  PaymentFee, 
  Receivable, 
  Reconciliation 
} from '../../../services/paymentFinanceService';
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
  Plus, 
  Trash2, 
  Settings,
  Building,
  Cpu,
  Percent,
  Calendar,
  Scale,
  FileText,
  ChevronLeft,
  Coins,
  TrendingUp,
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

// Mock/Default fallbacks in case Firestore database is empty or unseeded
const DEFAULT_BANKS: BankConfig[] = [
  { id: 'bank_1', name: 'Banco Itaú', agency: '0340', account: '45600-2', accountType: 'corrente', titular: 'Discreta Boutique Ltda', pixKey: '12.345.678/0001-99', isDefault: true, active: true },
  { id: 'bank_2', name: 'C6 Bank', agency: '0001', account: '9887711-2', accountType: 'corrente', titular: 'Discreta Boutique Ltda', pixKey: 'financeiro@discretaboutique.com.br', isDefault: false, active: true }
];

const DEFAULT_MACHINES: MachineConfig[] = [
  { id: 'mach_1', name: 'POS Balcão Principal', acquirerId: 'stone', serial: 'STN-8874-992', bankAccountId: 'bank_1', monthlyFee: 79.90, active: true },
  { id: 'mach_2', name: 'POS Entrega Motoboy 1', acquirerId: 'pagseguro', serial: 'PAG-4421-229', bankAccountId: 'bank_2', monthlyFee: 39.90, active: true }
];

const DEFAULT_FEES: PaymentFee[] = [
  { id: 'fee_1', paymentMethodId: 'credit_card', paymentMethodNameSnapshot: 'Cartão de Crédito', cardBrandId: 'visa', cardBrandNameSnapshot: 'Visa', installments: 1, percentageFee: 1.99, fixedFee: 0.35, compensationDays: 30, compensationDaysType: 'corridos', active: true },
  { id: 'fee_2', paymentMethodId: 'credit_card', paymentMethodNameSnapshot: 'Cartão de Crédito', cardBrandId: 'mastercard', cardBrandNameSnapshot: 'Mastercard', installments: 1, percentageFee: 1.99, fixedFee: 0.35, compensationDays: 30, compensationDaysType: 'corridos', active: true },
  { id: 'fee_3', paymentMethodId: 'debit_card', paymentMethodNameSnapshot: 'Cartão de Débito', cardBrandId: 'visa', cardBrandNameSnapshot: 'Visa', installments: 1, percentageFee: 1.15, fixedFee: 0.15, compensationDays: 1, compensationDaysType: 'uteis', active: true }
];

const DEFAULT_ACQUIRERS: Acquirer[] = [
  { id: 'stone', name: 'Stone adquirente', description: 'Taxas negociadas via consultor local', active: true },
  { id: 'pagseguro', name: 'PagSeguro UOL', description: 'Taxagem padrão do plano para pequenas empresas', active: true },
  { id: 'cielo', name: 'Cielo S.A.', description: 'Terminal de emergência', active: true }
];

const DEFAULT_BRANDS: CardBrand[] = [
  { id: 'visa', name: 'Visa', active: true },
  { id: 'mastercard', name: 'Mastercard', active: true },
  { id: 'elo', name: 'Elo', active: true },
  { id: 'express', name: 'American Express', active: true },
  { id: 'hipercard', name: 'Hipercard', active: true }
];

const DEFAULT_RECEIVABLES: Receivable[] = [
  { id: 'rec_1001', saleId: 'PED-9831', paymentMethodId: 'credit_card', paymentMethodNameSnapshot: 'Cartão de Crédito', cardBrandId: 'visa', cardBrandNameSnapshot: 'Visa', originalAmount: 329.90, netAmount: 323.30, fee: 6.60, payoutDate: '2026-07-21', status: 'pending' },
  { id: 'rec_1002', saleId: 'PED-9828', paymentMethodId: 'debit_card', paymentMethodNameSnapshot: 'Cartão de Débito', cardBrandId: 'mastercard', cardBrandNameSnapshot: 'Mastercard', originalAmount: 85.00, netAmount: 84.02, fee: 0.98, payoutDate: '2026-06-22', status: 'pending' },
  { id: 'rec_1003', saleId: 'PED-9810', paymentMethodId: 'pix', paymentMethodNameSnapshot: 'Pix', originalAmount: 154.00, netAmount: 154.00, fee: 0.00, payoutDate: '2026-06-21', status: 'cleared' },
];

const DEFAULT_RECONCILIATIONS: Reconciliation[] = [
  { id: 'recon_1', date: '2026-06-20', systemTotal: 1840.50, expectedTotal: 1840.50, reconciled: true, operator: 'Natália Souza' },
  { id: 'recon_2', date: '2026-06-19', systemTotal: 940.00, expectedTotal: 940.00, reconciled: true, operator: 'Natália Souza' }
];

interface GeneralFinancialSettings {
  minTransactionForInstallments: number;
  maxInstallmentsAllowed: number;
  autoReconcile: boolean;
  enableAlerts: boolean;
  fixedPixFee: number;
}

const DEFAULT_GENERAL_SETTINGS: GeneralFinancialSettings = {
  minTransactionForInstallments: 50,
  maxInstallmentsAllowed: 12,
  autoReconcile: true,
  enableAlerts: false,
  fixedPixFee: 0.00,
};

export function AdminPaymentMethods() {
  const { toast } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Navigation
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // States
  const [checkoutSettings, setCheckoutSettings] = useState<PaymentSettings>({ methods: [] });
  const [banks, setBanks] = useState<BankConfig[]>([]);
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [fees, setFees] = useState<PaymentFee[]>([]);
  const [acquirers, setAcquirers] = useState<Acquirer[]>([]);
  const [brands, setBrands] = useState<CardBrand[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [generalSettings, setGeneralSettings] = useState<GeneralFinancialSettings>(DEFAULT_GENERAL_SETTINGS);

  // Forms state variables
  // 1. Payment Methods sub-form
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodLabel, setNewMethodLabel] = useState(''); // Compatibility hook
  const [newMethodType, setNewMethodType] = useState<'pix' | 'dinheiro' | 'debito' | 'credito' | 'transferencia' | 'link_pagamento' | 'gateway_online' | 'outro'>('outro');
  const [newMethodActive, setNewMethodActive] = useState(true);
  const [newMethodShowOnSite, setNewMethodShowOnSite] = useState(true);
  const [newMethodShowOnPDV, setNewMethodShowOnPDV] = useState(true);
  const [newMethodEnabledDelivery, setNewMethodEnabledDelivery] = useState(true);
  const [newMethodEnabledPickup, setNewMethodEnabledPickup] = useState(true);
  const [newMethodAllowInstallments, setNewMethodAllowInstallments] = useState(false);
  const [newMethodMaxInstallments, setNewMethodMaxInstallments] = useState(1);
  const [newMethodRequiresProof, setNewMethodRequiresProof] = useState(false);
  const [newMethodRequiresChange, setNewMethodRequiresChange] = useState(false);
  const [newMethodGatewayProvider, setNewMethodGatewayProvider] = useState<'manual' | 'mercado_pago' | 'maquininha' | 'outro'>('manual');
  const [newMethodSortOrder, setNewMethodSortOrder] = useState<number>(10);
  const [newMethodIconKey, setNewMethodIconKey] = useState('card');
  const [newMethodUseIntegration, setNewMethodUseIntegration] = useState(false);

  // Quick registers helpers
  const [showAddAcquirer, setShowAddAcquirer] = useState(false);
  const [tempAcquirerName, setTempAcquirerName] = useState('');
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [tempBrandName, setTempBrandName] = useState('');

  // 2. Banks sub-form
  const [newBankName, setNewBankName] = useState('');
  const [newBankAgency, setNewBankAgency] = useState('');
  const [newBankAccountNum, setNewBankAccountNum] = useState('');
  const [newBankAccountType, setNewBankAccountType] = useState<'corrente' | 'poupanca'>('corrente');
  const [newBankTitular, setNewBankTitular] = useState('');
  const [newBankPix, setNewBankPix] = useState('');

  // 3. Machines sub-form
  const [newMachineName, setNewMachineName] = useState('');
  const [newMachineSerial, setNewMachineSerial] = useState('');
  const [newMachineAcquirer, setNewMachineAcquirer] = useState('');
  const [newMachineBankAccount, setNewMachineBankAccount] = useState('');
  const [newMachineMonthlyFee, setNewMachineMonthlyFee] = useState<number>(0);

  // 4. Fees sub-form
  const [newFeeMethodId, setNewFeeMethodId] = useState('');
  const [newFeeBrandId, setNewFeeBrandId] = useState('');
  const [newFeeMachineId, setNewFeeMachineId] = useState('');
  const [newFeeInstallments, setNewFeeInstallments] = useState<number>(1);
  const [newFeePercentage, setNewFeePercentage] = useState<number>(0);
  const [newFeeFixed, setNewFeeFixed] = useState<number>(0);
  const [newFeeDays, setNewFeeDays] = useState<number>(30);
  const [newFeeDaysType, setNewFeeDaysType] = useState<'corridos' | 'uteis'>('corridos');

  // 5. Reconciliation sub-form
  const [newRecDate, setNewRecDate] = useState('');
  const [newRecSystemTotal, setNewRecSystemTotal] = useState<number>(0);
  const [newRecExpectedTotal, setNewRecExpectedTotal] = useState<number>(0);
  const [newRecOperator, setNewRecOperator] = useState('');

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
    building: Building,
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Load everything on mount
  useEffect(() => {
    async function loadAllData() {
      try {
        setLoading(true);
        
        // Parallel fetch
        const [
          checkoutRes,
          banksRes,
          machinesRes,
          feesRes,
          acquirersRes,
          brandsRes,
          receivablesRes
        ] = await Promise.allSettled([
          settingsService.getPaymentSettings(),
          paymentFinanceService.getBankAccounts(),
          paymentFinanceService.getMachines(),
          paymentFinanceService.getPaymentFees(),
          paymentFinanceService.getAcquirers(),
          paymentFinanceService.getCardBrands(),
          paymentFinanceService.getReceivables()
        ]);

        // Assign or set default backups
        if (checkoutRes.status === 'fulfilled' && checkoutRes.value) {
          setCheckoutSettings(checkoutRes.value);
        }

        if (banksRes.status === 'fulfilled' && banksRes.value && banksRes.value.length > 0) {
          setBanks(banksRes.value);
        } else {
          setBanks(DEFAULT_BANKS);
        }

        if (machinesRes.status === 'fulfilled' && machinesRes.value && machinesRes.value.length > 0) {
          setMachines(machinesRes.value);
        } else {
          setMachines(DEFAULT_MACHINES);
        }

        if (feesRes.status === 'fulfilled' && feesRes.value && feesRes.value.length > 0) {
          setFees(feesRes.value);
        } else {
          setFees(DEFAULT_FEES);
        }

        if (acquirersRes.status === 'fulfilled' && acquirersRes.value && acquirersRes.value.length > 0) {
          setAcquirers(acquirersRes.value);
        } else {
          setAcquirers(DEFAULT_ACQUIRERS);
        }

        if (brandsRes.status === 'fulfilled' && brandsRes.value && brandsRes.value.length > 0) {
          setBrands(brandsRes.value);
        } else {
          setBrands(DEFAULT_BRANDS);
        }

        if (receivablesRes.status === 'fulfilled' && receivablesRes.value && receivablesRes.value.length > 0) {
          setReceivables(receivablesRes.value);
        } else {
          setReceivables(DEFAULT_RECEIVABLES);
        }

        setReconciliations(DEFAULT_RECONCILIATIONS);

      } catch (err) {
        console.error("Erro ao sincronizar backend financeiro:", err);
        toast("Carregado painel utilizando base de parâmetros locais", 'info');
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, [toast]);

  // -----------------------------------------------------
  // ACTIONS: CHECKOUT PAYMENT METHODS (MEIOS DE PAGAMENTO)
  // -----------------------------------------------------
  const handleUpdateCheckoutMethod = (methodId: string, updates: Partial<MethodConfig>) => {
    setCheckoutSettings({
      ...checkoutSettings,
      methods: checkoutSettings.methods.map(m => m.id === methodId ? { ...m, ...updates } : m)
    });
  };

  const handleSaveCheckoutSettings = async () => {
    setSaving(true);
    try {
      await settingsService.savePaymentSettings(checkoutSettings);
      toast("Configurações do Checkout persistidas no banco!", 'success');
    } catch (err) {
      console.error(err);
      toast("Erro ao persistir canais de checkout", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    const nameToUse = newMethodName.trim() || newMethodLabel.trim();
    if (!nameToUse) {
      toast("O nome do meio de pagamento é obrigatório", "error");
      return;
    }

    const id = nameToUse
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (checkoutSettings.methods.some(m => m.id === id)) {
      toast("Este meio de pagamento já está cadastrado ou possui nome similar", "error");
      return;
    }

    const newMethod: MethodConfig = {
      id,
      name: nameToUse,
      label: nameToUse,
      type: newMethodType,
      active: newMethodActive,
      showOnSite: newMethodShowOnSite,
      showOnPDV: newMethodShowOnPDV,
      availableForDelivery: newMethodEnabledDelivery,
      availableForPickup: newMethodEnabledPickup,
      allowInstallments: newMethodAllowInstallments,
      maxInstallments: Number(newMethodMaxInstallments) || 1,
      requiresProof: newMethodRequiresProof,
      requiresChange: newMethodRequiresChange,
      gatewayProvider: newMethodGatewayProvider,
      sortOrder: Number(newMethodSortOrder) || 10,
      icon: newMethodIconKey,
      
      // Compatibility fields
      enabledDelivery: newMethodEnabledDelivery,
      enabledPickup: newMethodEnabledPickup,
      useIntegration: newMethodGatewayProvider !== 'manual',
    };

    setCheckoutSettings({
      ...checkoutSettings,
      methods: [...checkoutSettings.methods, newMethod].sort((a, b) => a.sortOrder - b.sortOrder)
    });

    setNewMethodName('');
    setNewMethodLabel('');
    setNewMethodIconKey('card');
    setNewMethodEnabledDelivery(true);
    setNewMethodEnabledPickup(true);
    setNewMethodType('outro');
    setNewMethodActive(true);
    setNewMethodShowOnSite(true);
    setNewMethodShowOnPDV(true);
    setNewMethodAllowInstallments(false);
    setNewMethodMaxInstallments(1);
    setNewMethodRequiresProof(false);
    setNewMethodRequiresChange(false);
    setNewMethodGatewayProvider('manual');
    setNewMethodSortOrder(10);
    toast("Meio de pagamento adicionado localmente! Clique em 'Salvar Checkout' para persistir.", "success");
  };

  const handleDeletePaymentMethod = (id: string) => {
    // Soft inactivation
    setCheckoutSettings({
      ...checkoutSettings,
      methods: checkoutSettings.methods.map(m => m.id === id ? { ...m, active: false } : m)
    });
    toast("Meio de pagamento marcado como inativo! Clique em 'Salvar Checkout' para persistir.", "success");
  };

  // -----------------------------------------------------
  // ACTIONS: BANKS (CONTAS BANCÁRIAS)
  // -----------------------------------------------------
  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newBankAccountNum.trim()) {
      toast("Por favor preencha os campos obrigatórios", "error");
      return;
    }

    const newBank: BankConfig = {
      id: 'bank_' + Math.floor(Math.random() * 1000000),
      name: newBankName.trim(),
      agency: newBankAgency.trim() || 'Unidade',
      account: newBankAccountNum.trim(),
      accountType: newBankAccountType,
      titular: newBankTitular.trim() || 'Loja Discreta Boutique',
      pixKey: newBankPix.trim(),
      isDefault: banks.length === 0,
      active: true
    };

    try {
      setSaving(true);
      await paymentFinanceService.addDocument('financial_bank_accounts', newBank);
      setBanks([newBank, ...banks]);
      
      // Reset
      setNewBankName('');
      setNewBankAgency('');
      setNewBankAccountNum('');
      setNewBankTitular('');
      setNewBankPix('');
      toast("Conta bancária cadastrada com sucesso!", "success");
    } catch (err) {
      console.error(err);
      toast("Erro ao gravar banco de dados, conta mantida localmente", "info");
      setBanks([newBank, ...banks]);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBank = async (id: string) => {
    try {
      await paymentFinanceService.deleteDocument('financial_bank_accounts', id);
      setBanks(banks.filter(b => b.id !== id));
      toast("Conta desativada do banco de dados!", "success");
    } catch (err) {
      console.error(err);
      setBanks(banks.filter(b => b.id !== id));
      toast("Removido localmente", "info");
    }
  };

  const handleSetDefaultBank = async (id: string) => {
    const updated = banks.map(b => ({
      ...b,
      isDefault: b.id === id
    }));
    setBanks(updated);
    toast("Conta padrão atualizada!", "success");
  };

  const handleQuickAddAcquirer = async () => {
    if (!tempAcquirerName.trim()) {
      toast("O nome da adquirente é obrigatório", "error");
      return;
    }
    const id = tempAcquirerName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
    const newAcq: Acquirer = {
      id,
      name: tempAcquirerName.trim(),
      description: "Adquirente cadastrada via terminal de POS",
      active: true
    };
    try {
      setSaving(true);
      await paymentFinanceService.addDocument('financial_acquirers', newAcq);
      setAcquirers([newAcq, ...acquirers]);
      setNewMachineAcquirer(id);
      setTempAcquirerName('');
      setShowAddAcquirer(false);
      toast("Adquirente cadastrada de forma expressa!", "success");
    } catch (e) {
      console.error(e);
      setAcquirers([newAcq, ...acquirers]);
      setNewMachineAcquirer(id);
      setTempAcquirerName('');
      setShowAddAcquirer(false);
      toast("Adquirente provisória adicionada localmente!", "info");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAddBrand = async () => {
    if (!tempBrandName.trim()) {
      toast("O nome da bandeira é obrigatório", "error");
      return;
    }
    const id = tempBrandName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_');
    const newBnd: CardBrand = {
      id,
      name: tempBrandName.trim(),
      active: true
    };
    try {
      setSaving(true);
      await paymentFinanceService.addDocument('financial_card_brands', newBnd);
      setBrands([newBnd, ...brands]);
      setNewFeeBrandId(id);
      setTempBrandName('');
      setShowAddBrand(false);
      toast("Bandeira cadastrada com sucesso e selecionada!", "success");
    } catch (e) {
      console.error(e);
      setBrands([newBnd, ...brands]);
      setNewFeeBrandId(id);
      setTempBrandName('');
      setShowAddBrand(false);
      toast("Bandeira provisória adicionada localmente!", "info");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------
  // ACTIONS: CARD MACHINES (MAQUININHAS)
  // -----------------------------------------------------
  const handleAddMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineName.trim() || !newMachineSerial.trim()) {
      toast("Por favor preencha nome e serial da maquininha", "error");
      return;
    }

    const newMachine: MachineConfig = {
      id: 'mach_' + Math.floor(Math.random() * 1000000),
      name: newMachineName.trim(),
      serial: newMachineSerial.trim(),
      acquirerId: newMachineAcquirer || 'stone',
      bankAccountId: newMachineBankAccount || (banks[0]?.id || ''),
      monthlyFee: Number(newMachineMonthlyFee) || 0,
      active: true
    };

    try {
      setSaving(true);
      await paymentFinanceService.addDocument('financial_card_machines', newMachine);
      setMachines([newMachine, ...machines]);
      
      // Reset
      setNewMachineName('');
      setNewMachineSerial('');
      setNewMachineMonthlyFee(0);
      toast("Maquininha cadastrada com sucesso!", "success");
    } catch (err) {
      console.error(err);
      setMachines([newMachine, ...machines]);
      toast("Salvo localmente", "info");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMachine = async (id: string) => {
    try {
      await paymentFinanceService.deleteDocument('financial_card_machines', id);
      setMachines(machines.filter(m => m.id !== id));
      toast("Maquininha desativada!", "success");
    } catch (err) {
      console.error(err);
      setMachines(machines.filter(m => m.id !== id));
      toast("Removido localmente", "info");
    }
  };

  // -----------------------------------------------------
  // ACTIONS: FEES (TAXAS E TARIFAS)
  // -----------------------------------------------------
  const handleAddFeeRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeeMethodId) {
      toast("Forma de pagamento é obrigatória", "error");
      return;
    }

    // Validation rules against negative values
    if (newFeePercentage < 0) {
      toast("Taxa de porcentagem não pode ser negativa", "error");
      return;
    }
    if (newFeeFixed < 0) {
      toast("Taxa fixa não pode ser negativa", "error");
      return;
    }
    if (newFeeDays < 0) {
      toast("Dias de compensação não pode ser negativo", "error");
      return;
    }

    // Check for duplicates
    const isDuplicate = fees.some(f => 
      f.paymentMethodId === newFeeMethodId && 
      (f.cardBrandId || '') === (newFeeBrandId || '') && 
      (f.cardMachineId || '') === (newFeeMachineId || '') && 
      Number(f.installments) === Number(newFeeInstallments) &&
      f.active !== false
    );

    if (isDuplicate) {
      toast("Duplicidade detectada! Já existe uma regra tarifária ativa para esta combinação de Meio, Bandeira, POS e Parcela.", "error");
      return;
    }

    const selectedMethod = checkoutSettings.methods.find(m => m.id === newFeeMethodId);
    const selectedBrand = brands.find(b => b.id === newFeeBrandId);
    const selectedMach = machines.find(m => m.id === newFeeMachineId);

    const newFee: PaymentFee = {
      id: 'fee_' + Math.floor(Math.random() * 1000000),
      paymentMethodId: newFeeMethodId,
      paymentMethodNameSnapshot: selectedMethod?.name || selectedMethod?.label || newFeeMethodId,
      cardBrandId: newFeeBrandId || undefined,
      cardBrandNameSnapshot: selectedBrand?.name || undefined,
      cardMachineId: newFeeMachineId || undefined,
      cardMachineNameSnapshot: selectedMach?.name || undefined,
      installments: Number(newFeeInstallments) || 1,
      percentageFee: Number(newFeePercentage) || 0,
      fixedFee: Number(newFeeFixed) || 0,
      compensationDays: Number(newFeeDays) || 30,
      compensationDaysType: newFeeDaysType,
      active: true
    };

    try {
      setSaving(true);
      await paymentFinanceService.addDocument('financial_payment_fees', newFee);
      setFees([newFee, ...fees]);
      
      // Reset
      setNewFeePercentage(0);
      setNewFeeFixed(0);
      toast("Regra tarifária aplicada com sucesso!", "success");
    } catch (err) {
      console.error(err);
      setFees([newFee, ...fees]);
      toast("Salvo localmente", "info");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeeRule = async (id: string) => {
    try {
      await paymentFinanceService.deleteDocument('financial_payment_fees', id);
      setFees(fees.filter(f => f.id !== id));
      toast("Regra de tarifa removida!", "success");
    } catch (err) {
      console.error(err);
      setFees(fees.filter(f => f.id !== id));
      toast("Removido localmente", "info");
    }
  };

  // -----------------------------------------------------
  // ACTIONS: RECEIVABLES (RECEBÍVEIS)
  // -----------------------------------------------------
  const handleToggleReceivableStatus = async (id: string) => {
    const updated = receivables.map(r => {
      if (r.id === id) {
        const nextStatus = r.status === 'cleared' ? 'pending' : 'cleared';
        const revised = { ...r, status: nextStatus as 'pending' | 'cleared' };
        
        // Sync back optionally
        paymentFinanceService.updateDocument('financial_receivables', revised).catch(console.error);
        return revised;
      }
      return r;
    });
    setReceivables(updated);
    toast("Status de liberação do recebível atualizado!", "success");
  };

  // -----------------------------------------------------
  // ACTIONS: CONCILIATION
  // -----------------------------------------------------
  const handleAddReconciliation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecDate || !newRecOperator.trim()) {
      toast("Data e Operador são obrigatórios", "error");
      return;
    }

    const newRecon: Reconciliation = {
      id: 'recon_' + Math.floor(Math.random() * 1000000),
      date: newRecDate,
      systemTotal: Number(newRecSystemTotal),
      expectedTotal: Number(newRecExpectedTotal),
      reconciled: Math.abs(Number(newRecSystemTotal) - Number(newRecExpectedTotal)) < 0.01,
      operator: newRecOperator.trim()
    };

    setReconciliations([newRecon, ...reconciliations]);
    setNewRecDate('');
    setNewRecSystemTotal(0);
    setNewRecExpectedTotal(0);
    setNewRecOperator('');
    toast("Conciliação computada e registrada com sucesso!", "success");
  };

  // -----------------------------------------------------
  // ACTIONS: GENERAL CONFIGS
  // -----------------------------------------------------
  const handleSaveGeneralConfigs = async () => {
    try {
      setSaving(true);
      await setDoc(doc(db, 'settings', 'financial_general'), generalSettings);
      toast("Parâmetros globais atualizados!", "success");
    } catch (err) {
      console.error(err);
      toast("Gravado nos parâmetros locais", "info");
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-black text-white">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <span className="text-[10px] font-black uppercase tracking-[5px] text-zinc-500">Sincronizando Sistema Financeiro</span>
      </div>
    );
  }

  // LIST OF SECTIONS / SESSION MENU GRID (When activeCard === null)
  if (activeCard === null) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto mb-8 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600/10 border border-red-600/30 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.15)]">
              <Coins size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-wider">
                Definições Financeiras e Checkout
              </h1>
              <p className="text-[11px] text-zinc-500 font-mono mt-1">
                ACESSO GERAL AOS SEUS PAINÉIS DE CONFIGURAÇÃO & LIQUIDAÇÃO
              </p>
            </div>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Liquidez Projetada</p>
            <span className="text-2xl font-black text-emerald-500 block mt-1">
              {formatBRL(receivables.reduce((acc, r) => r.status === 'pending' ? acc + r.netAmount : acc, 0))}
            </span>
            <span className="text-[8px] text-zinc-500 block mt-1 font-mono uppercase">
              {receivables.filter(r => r.status === 'pending').length} recebíveis pendentes de repasse
            </span>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Maquininhas Ativas</p>
            <span className="text-2xl font-black text-white block mt-1">
              {machines.filter(m => m.active).length} POS
            </span>
            <span className="text-[8px] text-zinc-500 block mt-1 font-mono uppercase">
              Integração ativa com Stone e PagSeguro
            </span>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5 relative overflow-hidden">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Meios Nativos</p>
            <span className="text-2xl font-black text-red-500 block mt-1">
              {checkoutSettings.methods.length} Ativos
            </span>
            <span className="text-[8px] text-zinc-500 block mt-1 font-mono uppercase">
              Canais diretos no carrinho do e-commerce
            </span>
          </div>
        </div>

        {/* PRIMARY SUB-SESSIONS GRID */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-4">
            Escolha uma Sessão para Configurar
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Meios de Pagamento */}
            <div 
              onClick={() => setActiveCard('meios')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-red-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl group-hover:bg-red-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <Zap size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-red-400 transition-colors">Meios de Pagamento</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Organize e defina os meios permitidos para checkout expresso, delivery, retirada e gateways de pagamento online.
              </p>
            </div>

            {/* Contas Bancárias */}
            <div 
              onClick={() => setActiveCard('bancos')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-blue-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-full blur-2xl group-hover:bg-blue-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                <Building size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">Bancos e Contas</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Cadastre suas contas bancárias de recebimento para vincular cartões de crédito, Pix e repasses automáticos do caixa.
              </p>
            </div>

            {/* Maquininhas */}
            <div 
              onClick={() => setActiveCard('maquininhas')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-purple-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/5 rounded-full blur-2xl group-hover:bg-purple-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-4">
                <Cpu size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition-colors">Maquininhas de Cartão</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Gestão dos terminais físicos (POS) do seu PDV e balcão, incluindo serial, taxas de aluguel e adquirentes preferidas.
              </p>
            </div>

            {/* Taxas */}
            <div 
              onClick={() => setActiveCard('taxas')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-emerald-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/5 rounded-full blur-2xl group-hover:bg-emerald-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                <Percent size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">Taxas e Tarifas</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Controle do custo de repasse e tarifas cobradas por bandeira (Visa, Master, Elo...) para cada tipo de transação realizada.
              </p>
            </div>

            {/* Recebíveis */}
            <div 
              onClick={() => setActiveCard('recebiveis')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-amber-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/5 rounded-full blur-2xl group-hover:bg-amber-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                <Calendar size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">Recebíveis</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Agenda detalhada de inflows programados. Saiba quando cada transação de cartão ou Pix será liberada em sua conta.
              </p>
            </div>

            {/* Conciliacao */}
            <div 
              onClick={() => setActiveCard('conciliacao')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-orange-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-orange-600/5 rounded-full blur-2xl group-hover:bg-orange-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mb-4">
                <Scale size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition-colors">Conciliação Diária</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Audite e certifique-se de que os valores registrados condizem exatamente com os depósitos em extrato e taxas ajustadas.
              </p>
            </div>

            {/* Relatorios */}
            <div 
              onClick={() => setActiveCard('relatorios')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-pink-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-600/5 rounded-full blur-2xl group-hover:bg-pink-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-pink-600/10 border border-pink-500/20 text-pink-400 flex items-center justify-center mb-4">
                <FileText size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-pink-400 transition-colors">Relatórios Financeiros</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Gere resumos consolidados rápidos e visualize projeções simples de faturamento deduzidos os custos gerais e operacionais.
              </p>
            </div>

            {/* Configs Gerais */}
            <div 
              onClick={() => setActiveCard('configuracoes')}
              className="bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-500/30 rounded-[1.5rem] p-6 cursor-pointer transition-all hover:scale-[1.01] group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-600/5 rounded-full blur-2xl group-hover:bg-zinc-600/10 transition-colors pointer-events-none" />
              <div className="w-12 h-12 rounded-xl bg-zinc-800/10 border border-zinc-700/20 text-zinc-400 flex items-center justify-center mb-4">
                <Settings size={22} />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-zinc-300 transition-colors">Parâmetros Gerais</h3>
              <p className="text-xs text-zinc-500 mt-2 leading-relaxed">
                Defina limite mínimo de compra parcelada, tarifas de checkout automáticas, alertas push do caixa e faturamentos.
              </p>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // DETAILED VIEW INSIDE SELECTED SESSION CARD
  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 sm:p-6 lg:p-8">
      
      {/* HEADER BAR FOR DETAILED VIEWS */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-6">
        <div>
          <button 
            onClick={() => setActiveCard(null)}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-white transition-colors text-[10px] uppercase font-black font-mono tracking-widest mb-2"
          >
            <ChevronLeft size={12} className="stroke-[3px]" />
            <span>Voltar ao Painel Geral</span>
          </button>
          
          <h1 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            {activeCard === 'meios' && 'Meios de Pagamento'}
            {activeCard === 'bancos' && 'Bancos e Contas'}
            {activeCard === 'maquininhas' && 'Maquininhas de Cartão'}
            {activeCard === 'taxas' && 'Taxas e Tarifas de Transação'}
            {activeCard === 'recebiveis' && 'Agenda de Recebíveis'}
            {activeCard === 'conciliacao' && 'Conciliação Diária'}
            {activeCard === 'relatorios' && 'Relatórios Financeiros Consolidados'}
            {activeCard === 'configuracoes' && 'Definições Gerais Avançadas'}
          </h1>
          <p className="text-[11px] text-zinc-500 font-mono mt-1 uppercase">
            {activeCard === 'meios' && 'Checkout Convenções & Opções de Meio Próprio'}
            {activeCard === 'bancos' && 'Cadastros de repasse e liquidez de caixa'}
            {activeCard === 'maquininhas' && 'Terminais físicos associados e aluguéis'}
            {activeCard === 'taxas' && 'Custo operacional de taxas por adquirente ou bandeira'}
            {activeCard === 'recebiveis' && 'Agenda futura de liberação de fundos'}
            {activeCard === 'conciliacao' && 'Verificação de conformidade do banco'}
            {activeCard === 'relatorios' && 'Valores deduzidos e visibilidade de lucros'}
            {activeCard === 'configuracoes' && 'Parâmetros corporativos obrigatórios'}
          </p>
        </div>

        {/* Global Save Button for checkout configuration (Only visible inside Checkout tab) */}
        {activeCard === 'meios' && (
          <Button
            onClick={handleSaveCheckoutSettings}
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest px-6 py-3 h-11 rounded-xl shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_25px_rgba(220,38,38,0.35)] transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Check size={14} className="stroke-[3px]" />
                <span>Salvar Checkout</span>
              </>
            )}
          </Button>
        )}
      </div>

      <div className="max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {/* 1. MEIOS DE PAGAMENTO DETAIL PANEL */}
          {activeCard === 'meios' && (
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* SIDE FORM: ADD DIRECT PAYMENT METHOD */}
              <div className="lg:col-span-1 p-6 bg-zinc-900/40 border border-zinc-800 rounded-[2rem] h-fit space-y-6">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Plus size={14} className="text-red-500" /> Cadastrar Novo Meio
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
                    Crie canais de faturamento personalizados
                  </p>
                </div>

                <form onSubmit={handleAddPaymentMethod} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                      Nome de Exibição
                    </label>
                    <input 
                      type="text" 
                      value={newMethodName} 
                      onChange={e => setNewMethodName(e.target.value)}
                      placeholder="Ex: Cartão de Crédito, Pix, Dinheiro..." 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 focus:border-red-600 rounded-xl px-4 text-xs text-white focus:outline-none transition-colors placeholder-zinc-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                        Tipo de Meio
                      </label>
                      <select
                        value={newMethodType}
                        onChange={e => setNewMethodType(e.target.value as any)}
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 focus:border-red-600 rounded-xl px-2 text-xs text-white focus:outline-none"
                      >
                        <option value="dinheiro">Dinheiro</option>
                        <option value="pix">Pix</option>
                        <option value="debito">Débito</option>
                        <option value="credito">Crédito</option>
                        <option value="transferencia">Transferência</option>
                        <option value="link_pagamento">Link de Pagamento</option>
                        <option value="gateway_online">Gateway Online</option>
                        <option value="outro">Outro meio</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                        Ordem Visual
                      </label>
                      <input 
                        type="number"
                        min="0"
                        value={newMethodSortOrder}
                        onChange={e => setNewMethodSortOrder(Number(e.target.value))}
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 focus:border-red-600 rounded-xl px-4 text-xs text-white focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                        Gateway Provedor
                      </label>
                      <select
                        value={newMethodGatewayProvider}
                        onChange={e => setNewMethodGatewayProvider(e.target.value as any)}
                        className="w-full h-11 bg-zinc-950 border border-zinc-800 focus:border-red-600 rounded-xl px-2 text-xs text-white focus:outline-none"
                      >
                        <option value="manual">Manual/Espelho</option>
                        <option value="mercado_pago">Mercado Pago</option>
                        <option value="maquininha">Maquininha Física</option>
                        <option value="outro">Outro Gateway/API</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                        Máx Parcelas
                      </label>
                      <input 
                        type="number"
                        min="1"
                        max="12"
                        disabled={!newMethodAllowInstallments}
                        value={newMethodMaxInstallments}
                        onChange={e => setNewMethodMaxInstallments(Number(e.target.value))}
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 focus:border-red-600 rounded-xl px-4 text-xs text-white focus:outline-none font-mono disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
                      Representação Visual (Ícone)
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { key: 'card', icon: CreditCard, label: 'Cartão' },
                        { key: 'smartphone', icon: Smartphone, label: 'Pix' },
                        { key: 'wallet', icon: Wallet, label: 'Débito' },
                        { key: 'banknote', icon: Banknote, label: 'Dinheiro' },
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
                                ? 'bg-red-600/10 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                : 'bg-zinc-950/40 border-zinc-900 text-zinc-600 hover:border-zinc-800 hover:text-zinc-300'
                            }`}
                          >
                            <ItemIcon size={18} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-zinc-800/40 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">Habilitar p/ Site</span>
                      <button
                        type="button"
                        onClick={() => setNewMethodShowOnSite(!newMethodShowOnSite)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodShowOnSite ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodShowOnSite ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">Entrega e Delivery</span>
                      <button
                        type="button"
                        onClick={() => setNewMethodEnabledDelivery(!newMethodEnabledDelivery)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodEnabledDelivery ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodEnabledDelivery ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">Retirada em Loja</span>
                      <button
                        type="button"
                        onClick={() => setNewMethodEnabledPickup(!newMethodEnabledPickup)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodEnabledPickup ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodEnabledPickup ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">Disponível no PDV</span>
                      <button
                        type="button"
                        onClick={() => setNewMethodShowOnPDV(!newMethodShowOnPDV)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodShowOnPDV ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodShowOnPDV ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider font-sans">Permitir Parcelamento</span>
                      <button
                        type="button"
                        onClick={() => setNewMethodAllowInstallments(!newMethodAllowInstallments)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodAllowInstallments ? 'bg-emerald-600' : 'bg-zinc-950 border border-zinc-800'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodAllowInstallments ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider font-sans">Exige Comprovante</span>
                      <button
                        type="button"
                        onClick={() => setNewMethodRequiresProof(!newMethodRequiresProof)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodRequiresProof ? 'bg-emerald-600' : 'bg-zinc-950 border border-zinc-800'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodRequiresProof ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider font-sans">Fornecer Troco</span>
                      <button
                        type="button"
                        onClick={() => setNewMethodRequiresChange(!newMethodRequiresChange)}
                        className={`relative w-10 h-5 rounded-full transition-all duration-300 ${newMethodRequiresChange ? 'bg-emerald-600' : 'bg-zinc-950 border border-zinc-800'}`}
                      >
                        <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${newMethodRequiresChange ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                  >
                    Adicionar à Lista
                  </Button>
                </form>
              </div>

              {/* LIST ACTIVE PAYMENT METHODS */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-zinc-400 font-black uppercase text-xs tracking-wider">
                  Configurados no Checkout Geral
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  {checkoutSettings.methods.length === 0 ? (
                    <div className="text-center py-12 bg-zinc-900/20 border border-zinc-800 rounded-3xl">
                      <span className="text-zinc-600 font-mono text-xs block font-bold">NENHUM MEIO DE PAGAMENTO NO CARRINHO</span>
                    </div>
                  ) : (
                    checkoutSettings.methods.map((method) => {
                      const Icon = methodIcons[method.icon || ''] || methodIcons[method.id] || Smartphone;
                      const isCurrentlyActive = method.active !== false;

                      return (
                        <div
                          key={method.id}
                          className={`bg-zinc-900/30 border ${isCurrentlyActive ? 'border-zinc-800' : 'border-zinc-900 opacity-60'} rounded-[1.5rem] p-5 flex flex-col gap-4 relative group overflow-hidden`}
                        >
                          {/* TOP HEADER ROW OF THE PAYMENT METHOD */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1">
                              <div className="w-11 h-11 bg-zinc-950 rounded-xl flex items-center justify-center text-red-500 border border-zinc-800">
                                <Icon size={20} />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                                  <span>{method.name || method.label}</span>
                                  {!isCurrentlyActive ? (
                                    <span className="px-2 py-0.5 rounded bg-zinc-950 text-red-500 border border-red-500/20 text-[8px] font-mono uppercase">Inativo</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] font-mono uppercase">Ativo</span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] font-mono text-zinc-500">ID: {method.id}</span>
                                  <span className="text-[9px] font-mono text-zinc-600">•</span>
                                  <span className="text-[9px] font-mono text-zinc-500 uppercase">TIPO: {method.type || 'outro'}</span>
                                  <span className="text-[9px] font-mono text-zinc-600">•</span>
                                  <span className="text-[10px] text-zinc-400 font-mono">ORDEM: {method.sortOrder || 10}</span>
                                </div>
                              </div>
                            </div>

                            {/* SOFT ACTION SWITCHES */}
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {isCurrentlyActive ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePaymentMethod(method.id)}
                                  className="h-8 px-3 rounded-lg bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 text-[9px] uppercase font-black tracking-wider transition-all flex items-center gap-1.5"
                                  title="Inativar meio e esconder nos canais"
                                >
                                  <Trash2 size={11} />
                                  <span>Inativar</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCheckoutMethod(method.id, { active: true })}
                                  className="h-8 px-3 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/20 text-emerald-400 text-[9px] uppercase font-black tracking-wider transition-all flex items-center gap-1.5"
                                  title="Reativar meio"
                                >
                                  <Check size={11} />
                                  <span>Reativar</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* DETAILS GRID FOR INLINE CONFIGURATION */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-900/60 text-xs">
                            
                            {/* SITE DISPONIBILIDADE */}
                            <div>
                              <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black font-mono mb-2">Checkout Site</p>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white text-[11px]">
                                  <input 
                                    type="checkbox"
                                    checked={method.showOnSite !== false}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { showOnSite: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  <span>Exibir no Site</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white text-[11px]">
                                  <input 
                                    type="checkbox"
                                    checked={method.enabledDelivery !== false && method.availableForDelivery !== false}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { availableForDelivery: e.target.checked, enabledDelivery: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  <span>Site Entrega</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white text-[11px]">
                                  <input 
                                    type="checkbox"
                                    checked={method.enabledPickup !== false && method.availableForPickup !== false}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { availableForPickup: e.target.checked, enabledPickup: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  <span>Site Retirada</span>
                                </label>
                              </div>
                            </div>

                            {/* PDV / CAIXA */}
                            <div>
                              <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black font-mono mb-2">Loja / PDV</p>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white text-[11px]">
                                  <input 
                                    type="checkbox"
                                    checked={method.showOnPDV !== false}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { showOnPDV: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  <span>Exibir no PDV</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white text-[11px]">
                                  <input 
                                    type="checkbox"
                                    checked={method.requiresProof === true}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { requiresProof: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  <span>Exigir Comprovante</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white text-[11px]">
                                  <input 
                                    type="checkbox"
                                    checked={method.requiresChange === true}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { requiresChange: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  <span>Troco p/ Dinheiro</span>
                                </label>
                              </div>
                            </div>

                            {/* PARCELAMENTO */}
                            <div>
                              <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black font-mono mb-2">Parcelas & Ordem</p>
                              <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer text-zinc-400 hover:text-white text-[11px]">
                                  <input 
                                    type="checkbox"
                                    checked={method.allowInstallments === true}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { allowInstallments: e.target.checked })}
                                    className="accent-red-600"
                                  />
                                  <span>Permitir Parcelas</span>
                                </label>
                                
                                {method.allowInstallments && (
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span className="text-[10px] text-zinc-500">Max:</span>
                                    <input 
                                      type="number"
                                      min="1"
                                      max="12"
                                      value={method.maxInstallments || 1}
                                      onChange={(e) => handleUpdateCheckoutMethod(method.id, { maxInstallments: Number(e.target.value) || 1 })}
                                      className="w-12 h-6 bg-zinc-950 border border-zinc-800 text-[10px] text-white text-center rounded focus:outline-none"
                                    />
                                  </div>
                                )}

                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[10px] text-zinc-500">Ordem:</span>
                                  <input 
                                    type="number"
                                    value={method.sortOrder || 10}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { sortOrder: Number(e.target.value) || 10 })}
                                    className="w-16 h-6 bg-zinc-950 border border-zinc-800 text-[10px] text-white text-center rounded focus:outline-none"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* INTEGRAÇÃO */}
                            <div>
                              <p className="text-[8px] text-zinc-500 uppercase tracking-widest font-black font-mono mb-2">Integração Online</p>
                              <div className="space-y-2">
                                <div>
                                  <span className="text-[10px] text-zinc-500 block mb-1">Gateway Provedor:</span>
                                  <select
                                    value={method.gatewayProvider || 'manual'}
                                    onChange={(e) => handleUpdateCheckoutMethod(method.id, { 
                                      gatewayProvider: e.target.value as any,
                                      useIntegration: e.target.value !== 'manual'
                                    })}
                                    className="w-full h-7 bg-zinc-950 border border-zinc-800 text-[10px] text-white rounded focus:outline-none"
                                  >
                                    <option value="manual">Manual/Espelho</option>
                                    <option value="mercado_pago">Mercado Pago</option>
                                    <option value="maquininha">Maquininha Física</option>
                                    <option value="outro">Outro API</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. BANCOS E CONTAS DETAIL PANEL */}
          {activeCard === 'bancos' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* ADD BANK FORM */}
              <div className="lg:col-span-1 p-6 bg-zinc-900/40 border border-zinc-800 rounded-[2rem] h-fit">
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Plus size={14} className="text-blue-500" /> Cadastrar Nova Conta
                </h3>
                <p className="text-[10px] text-zinc-500 mb-6 font-mono uppercase tracking-wide">
                  Contas de liquidação de recebíveis
                </p>

                <form onSubmit={handleAddBank} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Banco</label>
                    <input 
                      type="text" 
                      value={newBankName} 
                      onChange={e => setNewBankName(e.target.value)}
                      placeholder="Ex: Itaú, Bradesco, C6, Nu..." 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-blue-600 transition-colors placeholder-zinc-700"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Agência</label>
                      <input 
                        type="text" 
                        value={newBankAgency} 
                        onChange={e => setNewBankAgency(e.target.value)}
                        placeholder="Ex: 0001" 
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-blue-600 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Conta</label>
                      <input 
                        type="text" 
                        value={newBankAccountNum} 
                        onChange={e => setNewBankAccountNum(e.target.value)}
                        placeholder="Ex: 12345-6" 
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-blue-600 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Tipo de Conta</label>
                    <select 
                      value={newBankAccountType} 
                      onChange={e => setNewBankAccountType(e.target.value as 'corrente' | 'poupanca')}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                    >
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Conta Poupança</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Titular da Conta</label>
                    <input 
                      type="text" 
                      value={newBankTitular} 
                      onChange={e => setNewBankTitular(e.target.value)}
                      placeholder="Ex: Discreta Boutique Ltda" 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Chave Pix</label>
                    <input 
                      type="text" 
                      value={newBankPix} 
                      onChange={e => setNewBankPix(e.target.value)}
                      placeholder="CNPJ, E-mail, Celular..." 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-blue-600 transition-colors"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                  >
                    Salvar Conta
                  </Button>
                </form>
              </div>

              {/* LIST BANKS */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-zinc-400 font-black uppercase text-xs tracking-wider">
                  Contas Bancárias Cadastradas
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  {banks.map((bank) => (
                    <div 
                      key={bank.id} 
                      className="bg-zinc-900/30 border border-zinc-800 rounded-[1.5rem] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                          <Building size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white uppercase tracking-wide">{bank.name}</span>
                            {bank.isDefault && (
                              <span className="text-[7.5px] bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Padrão
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 font-mono mt-0.5">Ag: {bank.agency} x CC: {bank.account}</p>
                          <p className="text-[10px] text-zinc-500">Titular: {bank.titular}</p>
                          {bank.pixKey && <p className="text-[10px] text-zinc-500 font-mono">Pix: {bank.pixKey}</p>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!bank.isDefault && (
                          <button 
                            onClick={() => handleSetDefaultBank(bank.id)}
                            className="px-3 h-8 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-blue-500/40 text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 hover:text-blue-400 transition-colors"
                          >
                            Tornar Padrão
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteBank(bank.id)}
                          className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-red-500/30 flex items-center justify-center text-zinc-600 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. MAQUININHAS DETAIL PANEL */}
          {activeCard === 'maquininhas' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* ADD MACHINE FORM */}
              <div className="lg:col-span-1 p-6 bg-zinc-900/40 border border-zinc-800 rounded-[2rem] h-fit">
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Plus size={14} className="text-purple-500" /> Cadastrar Maquininha
                </h3>
                <p className="text-[10px] text-zinc-500 mb-6 font-mono uppercase tracking-wide">
                  Terminais físicos de venda (POS)
                </p>

                <form onSubmit={handleAddMachine} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Identificação / Nome</label>
                    <input 
                      type="text" 
                      value={newMachineName} 
                      onChange={e => setNewMachineName(e.target.value)}
                      placeholder="Ex: POS Balcão, POS Extra..." 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-purple-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Número de Serial</label>
                    <input 
                      type="text" 
                      value={newMachineSerial} 
                      onChange={e => setNewMachineSerial(e.target.value)}
                      placeholder="Ex: SN-12345678" 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-purple-600 transition-colors font-mono"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Adquirente</label>
                    </div>
                    <select
                      value={newMachineAcquirer}
                      onChange={e => setNewMachineAcquirer(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-purple-600"
                    >
                      <option value="">Selecione Adquirente...</option>
                      {acquirers.map(acq => (
                        <option key={acq.id} value={acq.id}>{acq.name}</option>
                      ))}
                    </select>

                    {showAddAcquirer ? (
                      <div className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                        <input 
                          type="text" 
                          value={tempAcquirerName} 
                          onChange={e => setTempAcquirerName(e.target.value)}
                          placeholder="Nome da Nova Adquirente (Ex: Rede, Getnet...)"
                          className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-[11px] text-white focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={handleQuickAddAcquirer}
                            className="flex-1 h-8 bg-purple-600 hover:bg-purple-700 text-white font-black text-[9px] uppercase rounded-lg"
                          >
                            Confirmar
                          </button>
                          <button 
                            type="button" 
                            onClick={() => { setShowAddAcquirer(false); setTempAcquirerName(''); }}
                            className="h-8 px-3 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] uppercase rounded-lg"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddAcquirer(true)}
                        className="text-[9px] text-purple-400 hover:text-purple-300 font-bold uppercase mt-1.5 flex items-center gap-1"
                      >
                        <Plus size={10} /> + Nova Adquirente Expressa
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Conta Bancária de Depósito</label>
                    <select
                      value={newMachineBankAccount}
                      onChange={e => setNewMachineBankAccount(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                    >
                      <option value="">Selecione a Conta...</option>
                      {banks.map(bk => (
                        <option key={bk.id} value={bk.id}>{bk.name} ({bk.account})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Custo Mensal de Aluguel (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newMachineMonthlyFee || ''} 
                      onChange={e => setNewMachineMonthlyFee(Number(e.target.value))}
                      placeholder="Ex: 59.90" 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-purple-600 transition-colors"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                  >
                    Salvar POS
                  </Button>
                </form>
              </div>

              {/* LIST MACHINES */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-zinc-400 font-black uppercase text-xs tracking-wider">
                  Listagem de POS / Terminasi Físicos
                </h4>

                <div className="grid grid-cols-1 gap-4">
                  {machines.map((mach) => {
                    const acqObj = acquirers.find(a => a.id === mach.acquirerId);
                    const bnkObj = banks.find(b => b.id === mach.bankAccountId);
                    return (
                      <div 
                        key={mach.id} 
                        className="bg-zinc-900/30 border border-zinc-800 rounded-[1.5rem] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                            <Cpu size={20} />
                          </div>
                          <div>
                            <span className="text-sm font-bold text-white uppercase tracking-wide block">{mach.name}</span>
                            <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">SN: {mach.serial}</span>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-zinc-400 font-mono">
                              <span className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded">Adquirente: {acqObj?.name || mach.acquirerId}</span>
                              <span className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded">Aluguel: {formatBRL(mach.monthlyFee)}/mês</span>
                              {bnkObj && <span className="bg-zinc-950 border border-zinc-800 px-2 py-0.5 rounded">Conta: {bnkObj.name}</span>}
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleDeleteMachine(mach.id)}
                          className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-red-500/30 flex items-center justify-center text-zinc-600 hover:text-red-500 transition-all self-end sm:self-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* 4. TAXAS DETAIL PANEL */}
          {activeCard === 'taxas' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* ADD FEE RULE FORM */}
              <div className="lg:col-span-1 p-6 bg-zinc-900/40 border border-zinc-800 rounded-[2rem] h-fit">
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Plus size={14} className="text-emerald-500" /> Nova Regra Tarifária
                </h3>
                <p className="text-[10px] text-zinc-500 mb-6 font-mono uppercase tracking-wide">
                  Determine as taxas de processamento
                </p>

                <form onSubmit={handleAddFeeRule} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Forma de Pagamento</label>
                    <select
                      value={newFeeMethodId}
                      onChange={e => setNewFeeMethodId(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                    >
                      <option value="">Selecione...</option>
                      {checkoutSettings.methods.map(m => (
                        <option key={m.id} value={m.id}>{m.name || m.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Bandeira do Cartão (Opcional)</label>
                    <select
                      value={newFeeBrandId}
                      onChange={e => setNewFeeBrandId(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                    >
                      <option value="">Todas Bandeiras / Nenhuma / Pix / Outros</option>
                      {brands.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>

                    {showAddBrand ? (
                      <div className="mt-2 p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
                        <input 
                          type="text" 
                          value={tempBrandName} 
                          onChange={e => setTempBrandName(e.target.value)}
                          placeholder="Nome da Nova Bandeira (Ex: Aura, Hipercard...)"
                          className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-[11px] text-white focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button 
                            type="button" 
                            onClick={handleQuickAddBrand}
                            className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase rounded-lg"
                          >
                            Confirmar
                          </button>
                          <button 
                            type="button" 
                            onClick={() => { setShowAddBrand(false); setTempBrandName(''); }}
                            className="h-8 px-3 bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] uppercase rounded-lg"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddBrand(true)}
                        className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold uppercase mt-1.5 flex items-center gap-1"
                      >
                        <Plus size={10} /> + Nova Bandeira Expressa
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Terminal de POS (Maquininha)</label>
                    <select
                      value={newFeeMachineId}
                      onChange={e => setNewFeeMachineId(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                    >
                      <option value="">Nenhum POS / Sem maquininha</option>
                      {machines.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Vezes Parcela</label>
                      <input 
                        type="number" 
                        min="1"
                        max="12"
                        value={newFeeInstallments || ''} 
                        onChange={e => setNewFeeInstallments(Number(e.target.value))}
                        placeholder="Ex: 1" 
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Taxa Porcentagem %</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newFeePercentage || ''} 
                        onChange={e => setNewFeePercentage(Number(e.target.value))}
                        placeholder="Ex: 1.99" 
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Taxa Fixa R$</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={newFeeFixed || ''} 
                        onChange={e => setNewFeeFixed(Number(e.target.value))}
                        placeholder="Ex: 0.35" 
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Liberar com (Dias)</label>
                      <input 
                        type="number" 
                        value={newFeeDays || ''} 
                        onChange={e => setNewFeeDays(Number(e.target.value))}
                        placeholder="Ex: 30" 
                        className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Regra de Dias</label>
                    <div className="flex gap-4">
                      <button 
                        type="button" 
                        onClick={() => setNewFeeDaysType('corridos')}
                        className={`flex-1 h-9 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${
                          newFeeDaysType === 'corridos' 
                            ? 'bg-emerald-600 border-emerald-500 text-white' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        Corridos
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setNewFeeDaysType('uteis')}
                        className={`flex-1 h-9 rounded-lg border text-[9px] font-bold uppercase tracking-wider ${
                          newFeeDaysType === 'uteis' 
                            ? 'bg-emerald-600 border-emerald-500 text-white' 
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        Úteis
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                  >
                    Aplicar Custo
                  </Button>
                </form>
              </div>

              {/* LIST FEES */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-zinc-400 font-black uppercase text-xs tracking-wider">
                  Listagem de Taxas e Tarifas Vigentes
                </h4>

                <div className="bg-zinc-900/20 border border-zinc-800 rounded-[2rem] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60 text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">
                        <th className="p-4">Meio / POS</th>
                        <th className="p-4">Bandeira</th>
                        <th className="p-4 text-center">Parcela</th>
                        <th className="p-4 text-right">Taxa %</th>
                        <th className="p-4 text-right">Taxa Fixa</th>
                        <th className="p-4 text-center">Prazo Repasse</th>
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees.map((fee) => (
                        <tr key={fee.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/10 transition-colors">
                          <td className="p-4">
                            <span className="font-bold text-white block uppercase tracking-wide">{fee.paymentMethodNameSnapshot}</span>
                            {fee.cardMachineNameSnapshot && <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">{fee.cardMachineNameSnapshot}</span>}
                          </td>
                          <td className="p-4 text-zinc-300 font-bold uppercase">
                            {fee.cardBrandNameSnapshot || 'Todas'}
                          </td>
                          <td className="p-4 text-center text-zinc-300 font-mono">
                            {fee.installments}x
                          </td>
                          <td className="p-4 text-right text-emerald-500 font-bold font-mono">
                            {fee.percentageFee}%
                          </td>
                          <td className="p-4 text-right text-zinc-400 font-mono">
                            {formatBRL(fee.fixedFee)}
                          </td>
                          <td className="p-4 text-center text-zinc-300 font-mono text-[10px]">
                            {fee.compensationDays} dias {fee.compensationDaysType}
                          </td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={() => handleDeleteFeeRule(fee.id)}
                              className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-red-500/30 flex items-center justify-center text-zinc-600 hover:text-red-500 transition-all mx-auto"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* 5. RECEBÍVEIS PANEL */}
          {activeCard === 'recebiveis' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-zinc-900/20 border border-zinc-800 rounded-[2rem] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/60 text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">
                      <th className="p-4">ID Venda / ID Lançamento</th>
                      <th className="p-4">Forma de Pagamento</th>
                      <th className="p-4 text-right">Valor Bruto</th>
                      <th className="p-4 text-right">Dedução / Taxas</th>
                      <th className="p-4 text-right">Valor Líquido</th>
                      <th className="p-4 text-center">Previsão Liberação</th>
                      <th className="p-4 text-center">Status Liberação</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((rec) => (
                      <tr key={rec.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/10 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-white uppercase tracking-wide font-mono">{rec.saleId}</span>
                          <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">{rec.id}</span>
                        </td>
                        <td className="p-4">
                          <span className="text-zinc-300 font-bold block uppercase tracking-wide">{rec.paymentMethodNameSnapshot}</span>
                          {rec.cardBrandNameSnapshot && <span className="text-[10px] text-zinc-500 block font-mono uppercase mt-0.5">{rec.cardBrandNameSnapshot}</span>}
                        </td>
                        <td className="p-4 text-right text-zinc-400 font-mono font-bold">
                          {formatBRL(rec.originalAmount)}
                        </td>
                        <td className="p-4 text-right text-red-500 font-mono">
                          -{formatBRL(rec.fee)}
                        </td>
                        <td className="p-4 text-right text-emerald-500 font-mono font-black text-sm">
                          {formatBRL(rec.netAmount)}
                        </td>
                        <td className="p-4 text-center text-zinc-300 font-mono">
                          {rec.payoutDate}
                        </td>
                        <td className="p-4 text-center">
                          <div className={`inline-block px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            rec.status === 'cleared'
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                          }`}>
                            {rec.status === 'cleared' ? 'Liquidado' : 'Aguardando'}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleToggleReceivableStatus(rec.id)}
                            className="px-3 h-8 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 rounded-lg text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 hover:text-white transition-colors"
                          >
                            {rec.status === 'cleared' ? 'Pendente' : 'Confirmar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* 6. CONCILIAÇÃO PANEL */}
          {activeCard === 'conciliacao' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* LAUNCH NEW RECONCILIATION */}
              <div className="lg:col-span-1 p-6 bg-zinc-900/40 border border-zinc-800 rounded-[2rem] h-fit">
                <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                  <ShieldCheck size={14} className="text-orange-500" /> Computar Conciliação
                </h3>
                <p className="text-[10px] text-zinc-500 mb-6 font-mono uppercase tracking-wide">
                  Conformidade de caixa ativo
                </p>

                <form onSubmit={handleAddReconciliation} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Data Auditada</label>
                    <input 
                      type="date" 
                      value={newRecDate} 
                      onChange={e => setNewRecDate(e.target.value)}
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Total no Sistema (R$)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newRecSystemTotal || ''} 
                      onChange={e => setNewRecSystemTotal(Number(e.target.value))}
                      placeholder="Ex: 1840.50" 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Total Esperado (Extratos / POS)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newRecExpectedTotal || ''} 
                      onChange={e => setNewRecExpectedTotal(Number(e.target.value))}
                      placeholder="Ex: 1840.50" 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Operador Auditador</label>
                    <input 
                      type="text" 
                      value={newRecOperator} 
                      onChange={e => setNewRecOperator(e.target.value)}
                      placeholder="Ex: Natália Souza" 
                      className="w-full h-11 bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-orange-600 transition-colors"
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-2"
                  >
                    Auditar e Lançar
                  </Button>
                </form>
              </div>

              {/* LIST RECONCILIATIONS */}
              <div className="lg:col-span-2 space-y-4">
                <h4 className="text-zinc-400 font-black uppercase text-xs tracking-wider">
                  Histórico Recente de Fechamentos
                </h4>

                <div className="bg-zinc-900/20 border border-zinc-800 rounded-[2rem] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/60 text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">
                        <th className="p-4">Data Fechamento</th>
                        <th className="p-4">Sistema</th>
                        <th className="p-4">Esperado (Real)</th>
                        <th className="p-4">Diferença / Furo</th>
                        <th className="p-4 font-mono">Operador de Auditoria</th>
                        <th className="p-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reconciliations.map((recon) => {
                        const diff = recon.systemTotal - recon.expectedTotal;
                        return (
                          <tr key={recon.id} className="border-b border-zinc-800/40">
                            <td className="p-4 font-bold text-white font-mono">{recon.date}</td>
                            <td className="p-4 text-zinc-400 font-mono font-bold">{formatBRL(recon.systemTotal)}</td>
                            <td className="p-4 text-zinc-300 font-mono">{formatBRL(recon.expectedTotal)}</td>
                            <td className={`p-4 font-mono font-bold ${diff === 0 ? 'text-zinc-500' : 'text-red-500'}`}>
                              {diff === 0 ? 'R$ 0,00' : formatBRL(diff)}
                            </td>
                            <td className="p-4 text-zinc-400 font-medium uppercase font-sans text-[10px]">{recon.operator}</td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${
                                recon.reconciled 
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                  : 'bg-red-500/10 text-red-500 border border-red-500/20'
                              }`}>
                                {recon.reconciled ? 'Conciliado' : 'Divergência'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* 7. RELATÓRIOS PANEL */}
          {activeCard === 'relatorios' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[1.5rem]">
                  <TrendingUp className="text-red-500 mb-3" size={24} />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Volume Bruto Médio</span>
                  <span className="text-2xl font-black text-white block mt-1">{formatBRL(21455.00)}</span>
                  <span className="text-[8px] text-zinc-400 mt-2 block font-mono">Últimos 15 dias de registros</span>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[1.5rem]">
                  <Percent className="text-emerald-500 mb-3" size={24} />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Tarifa Operacional Média</span>
                  <span className="text-2xl font-black text-white block mt-1">1.82%</span>
                  <span className="text-[8px] text-zinc-400 mt-2 block font-mono">Dedução média calculada de bandeiras</span>
                </div>

                <div className="bg-zinc-900/30 border border-zinc-800 p-6 rounded-[1.5rem]">
                  <Check className="text-blue-500 mb-3" size={24} />
                  <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Índice de Acertos</span>
                  <span className="text-2xl font-black text-white block mt-1">100.0%</span>
                  <span className="text-[8px] text-zinc-400 mt-2 block font-mono">Período de auditorias concluídas com sucesso</span>
                </div>
              </div>

              {/* BAR CHART SIMULATION SECTION */}
              <div className="bg-zinc-900/20 border border-zinc-800 p-6 rounded-[2rem]">
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Sparkles size={14} className="text-red-500" /> Histórico de Custos e Repasses Diários
                </h3>
                <div className="h-44 flex items-end gap-3 pt-6 border-b border-zinc-800 px-4">
                  {[3400, 1800, 0, 4200, 2900, 5600, 4100, 3100, 0, 2100, 4500, 6200].map((val, idx) => {
                    const max = 7000;
                    const pct = Math.max(5, (val / max) * 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <span className="text-[8px] font-mono text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          {val > 0 ? formatBRL(val) : '-'}
                        </span>
                        <div 
                          style={{ height: `${pct}%` }} 
                          className={`w-full rounded-t-md transition-all duration-300 ${val > 4000 ? 'bg-red-600' : val > 0 ? 'bg-zinc-700 hover:bg-zinc-500' : 'bg-transparent border-b-2 border-zinc-800'}`}
                        />
                        <span className="text-[7.5px] font-mono text-zinc-650 mt-1">D-{12-idx}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* 8. CONFIGURAÇÕES PANEL */}
          {activeCard === 'configuracoes' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-xl mx-auto bg-zinc-900/40 border border-zinc-800 p-6 rounded-[2rem] space-y-6"
            >
              <h3 className="text-xs font-black text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                <Settings size={14} className="text-red-500" /> Parâmetros Financeiros Globais
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Comissão Mínima p/ Parcelar Carrinho (R$)</label>
                  <input 
                    type="number"
                    step="5"
                    value={generalSettings.minTransactionForInstallments}
                    onChange={e => setGeneralSettings({ ...generalSettings, minTransactionForInstallments: Number(e.target.value) })}
                    className="w-full h-11 bg-zinc-950/60 border border-zinc-800 focus:border-red-600 rounded-xl px-4 text-xs text-white"
                  />
                  <span className="text-[9.5px] text-zinc-500 mt-1 block">O carrinho somente permitirá parcelamento de cartões se o total for maior que este valor.</span>
                </div>

                <div>
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Máximo de Parcelas Permitido</label>
                  <input 
                    type="number"
                    min="1"
                    max="24"
                    value={generalSettings.maxInstallmentsAllowed}
                    onChange={e => setGeneralSettings({ ...generalSettings, maxInstallmentsAllowed: Number(e.target.value) })}
                    className="w-full h-11 bg-zinc-950/60 border border-zinc-800 focus:border-red-600 rounded-xl px-4 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Tarifa Adicional Fixa p/ Fluxos Pix (R$)</label>
                  <input 
                    type="number"
                    step="0.05"
                    value={generalSettings.fixedPixFee}
                    onChange={e => setGeneralSettings({ ...generalSettings, fixedPixFee: Number(e.target.value) })}
                    className="w-full h-11 bg-zinc-950/60 border border-zinc-800 focus:border-red-600 rounded-xl px-4 text-xs text-white"
                  />
                </div>

                <div className="space-y-4 pt-3 border-t border-zinc-800/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider block">Conciliação Automática</span>
                      <span className="text-[9px] text-zinc-500">Conciliar transações online Pix do e-commerce automaticamente ao liberar fundos</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGeneralSettings({ ...generalSettings, autoReconcile: !generalSettings.autoReconcile })}
                      className={`relative w-10 h-5 rounded-full transition-all duration-300 ${generalSettings.autoReconcile ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${generalSettings.autoReconcile ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider block">Alertas por E-mail</span>
                      <span className="text-[9px] text-zinc-500">Notificar canais corporativos ao constatar divergências na conciliação manual</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGeneralSettings({ ...generalSettings, enableAlerts: !generalSettings.enableAlerts })}
                      className={`relative w-10 h-5 rounded-full transition-all duration-300 ${generalSettings.enableAlerts ? 'bg-red-600' : 'bg-zinc-950 border border-zinc-800'}`}
                    >
                      <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-all duration-300 ${generalSettings.enableAlerts ? 'translate-x-[20px]' : 'translate-x-[0]'}`} />
                    </button>
                  </div>
                </div>

                <Button 
                  onClick={handleSaveGeneralConfigs}
                  disabled={saving}
                  className="w-full h-11 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-widest mt-4 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} className="stroke-[3px]" />
                      <span>Salvar Ajustes</span>
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
