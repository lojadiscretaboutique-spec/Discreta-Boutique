import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Gift, 
  Settings, 
  History, 
  RotateCcw, 
  Save, 
  Plus, 
  Trash2, 
  Play, 
  DollarSign, 
  Percent, 
  Package, 
  CheckCircle2, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Volume2,
  VolumeX,
  Search
} from 'lucide-react';
import { rouletteService, DEFAULT_LOSING_PHRASES } from '../../../services/rouletteService';
import { RouletteConfig, RoulettePrize, RouletteSpinRecord } from '../../../types/roulette';
import { RouletteWheelModal } from '../../../components/admin/RouletteWheelModal';

export default function AdminRoulette() {
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'phrases' | 'history'>('config');

  // Eligible products preview
  const [eligibleProducts, setEligibleProducts] = useState<RoulettePrize[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Spin History
  const [history, setHistory] = useState<RouletteSpinRecord[]>([]);
  const [historySearch, setHistorySearch] = useState('');

  // Simulator Wheel
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  // New Phrase Input
  const [newPhrase, setNewPhrase] = useState('');

  // New Manual Prize inputs
  const [newPrizeName, setNewPrizeName] = useState('');
  const [newPrizeCost, setNewPrizeCost] = useState<number>(15);
  const [newPrizeRetail, setNewPrizeRetail] = useState<number>(35);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = rouletteService.subscribeConfig((cfg) => {
      setConfig(cfg);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch eligible products when auto mode parameters change
  useEffect(() => {
    if (!config) return;

    if (config.prizeSelectionMode === 'AUTO_PRODUCTS') {
      setLoadingProducts(true);
      rouletteService.getEligibleProducts(config.maxProductCost, config.autoProductsCount)
        .then(prods => {
          setEligibleProducts(prods);
        })
        .finally(() => setLoadingProducts(false));
    }
  }, [config?.prizeSelectionMode, config?.maxProductCost, config?.autoProductsCount]);

  // Load history when tab is clicked
  useEffect(() => {
    if (activeTab === 'history') {
      rouletteService.getSpinHistory(100).then(setHistory);
    }
  }, [activeTab]);

  const handleSaveConfig = async (updates: Partial<RouletteConfig>) => {
    if (!config) return;
    setSaving(true);
    try {
      await rouletteService.saveConfig(updates);
      setConfig(prev => prev ? { ...prev, ...updates } : null);
    } catch (e: any) {
      alert('Erro ao salvar configurações: ' + (e.message || 'Verifique a conexão'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhrase = () => {
    if (!newPhrase.trim() || !config) return;
    const updated = [...config.losingPhrases, newPhrase.trim()];
    handleSaveConfig({ losingPhrases: updated });
    setNewPhrase('');
  };

  const handleRemovePhrase = (indexToRemove: number) => {
    if (!config) return;
    const updated = config.losingPhrases.filter((_, idx) => idx !== indexToRemove);
    handleSaveConfig({ losingPhrases: updated });
  };

  const handleResetPhrases = () => {
    if (confirm('Deseja restaurar as 20 frases padrão de "não foi desta vez / passou a vez"?')) {
      handleSaveConfig({ losingPhrases: DEFAULT_LOSING_PHRASES });
    }
  };

  const handleAddManualPrize = () => {
    if (!newPrizeName.trim() || !config) return;
    const newPrize: RoulettePrize = {
      id: `manual-${Date.now()}`,
      name: newPrizeName.trim(),
      type: 'CUSTOM',
      costPrice: Number(newPrizeCost) || 15,
      retailPrice: Number(newPrizeRetail) || 35,
      color: '#dc2626'
    };

    const updated = [...(config.manualPrizes || []), newPrize];
    handleSaveConfig({ manualPrizes: updated });
    setNewPrizeName('');
  };

  const handleRemoveManualPrize = (id: string) => {
    if (!config) return;
    const updated = config.manualPrizes.filter(p => p.id !== id);
    handleSaveConfig({ manualPrizes: updated });
  };

  const handleResetRevenueCounter = async () => {
    if (confirm('Deseja zerar a renda acumulada da roleta? A roleta precisará acumular novas vendas até atingir 10x o custo do prêmio para autorizar o próximo sorteio de produto.')) {
      await rouletteService.resetAccumulatedRevenue();
    }
  };

  if (loading || !config) {
    return (
      <div className="bg-zinc-950/40 border border-zinc-850 rounded-3xl p-16 text-center text-zinc-400 max-w-7xl mx-auto">
        <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs font-bold">Carregando painel da Roleta Premiada...</p>
      </div>
    );
  }

  // Filtered History
  const filteredHistory = history.filter(h => {
    if (!historySearch) return true;
    const term = historySearch.toLowerCase();
    return (
      h.orderId.toLowerCase().includes(term) ||
      (h.customerName || '').toLowerCase().includes(term) ||
      (h.prizeWon || '').toLowerCase().includes(term) ||
      (h.phraseLanded || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 text-white max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-zinc-950/70 border border-zinc-850 p-6 md:p-8 rounded-3xl backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/10 to-rose-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                <Sparkles className="w-5 h-5" />
              </span>
              <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 font-mono">
                Gamificação & Marketing PDV
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-rose-50 tracking-tight">
              Roleta Premiada
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
              Acionada no PDV ao finalizar compras de valor mínimo configurado. Possui algoritmo de proteção 
              financeira que exige 10x de retorno em vendas sobre o custo do produto para contemplar um ganhador, 
              além de taxa de acerto de 10% e frases encorajadoras pré-cadastradas.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setSimulatorOpen(true)}
              className="flex items-center gap-2.5 px-5 py-3 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/20 transition-all cursor-pointer hover:scale-[1.02]"
            >
              <Play className="w-4 h-4" />
              Testar Roleta ao Vivo
            </button>
          </div>
        </div>

        {/* Financial Yield & Protection Meter */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-zinc-900">
          <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
            <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Status Geral</span>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-base font-black ${config.active ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {config.active ? 'Ativa no PDV' : 'Pausada'}
              </span>
              <button
                onClick={() => handleSaveConfig({ active: !config.active })}
                className="cursor-pointer"
              >
                {config.active ? (
                  <ToggleRight className="w-6 h-6 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-6 h-6 text-zinc-600" />
                )}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
            <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Renda Acumulada no Ciclo</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-xl font-black text-rose-400 font-mono">
                R$ {(config.accumulatedRevenueSinceLastWin || 0).toFixed(2).replace('.', ',')}
              </span>
              <button
                onClick={handleResetRevenueCounter}
                className="text-[10px] text-zinc-500 hover:text-white underline cursor-pointer"
                title="Zerar acumulador"
              >
                Resetar
              </button>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">
              Meta 10x: R$ {((config.maxProductCost || 20) * 10).toFixed(2).replace('.', ',')}
            </span>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
            <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Taxa de Acerto</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-amber-300 font-mono">
                {config.hitRatePercentage}%
              </span>
              <span className="text-xs text-zinc-400">10x multiplicador</span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">
              Regra estrita de margem
            </span>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800/80 p-4 rounded-2xl">
            <span className="text-xs text-zinc-500 font-bold block uppercase tracking-wider">Giros Realizados</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-black text-white font-mono">
                {config.totalSpinsCount || 0}
              </span>
              <span className="text-xs text-emerald-400 font-mono font-bold">
                ({config.totalWinsCount || 0} prêmios)
              </span>
            </div>
            <span className="text-[10px] text-zinc-500 block mt-1">
              Total entregue: R$ {(config.totalPrizesCostAwarded || 0).toFixed(2).replace('.', ',')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800 rounded-2xl self-start">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'config' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Configurações da Roleta
        </button>
        <button
          onClick={() => setActiveTab('phrases')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'phrases' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Frases Encorajadoras ({config.losingPhrases.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            activeTab === 'history' ? 'bg-red-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          Histórico de Giros no PDV
        </button>
      </div>

      {/* TAB 1: CONFIG */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Parameters */}
          <div className="lg:col-span-7 bg-zinc-950 border border-zinc-850 rounded-3xl p-6 sm:p-8 space-y-6">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-red-500" />
              Parâmetros de Operação no PDV
            </h2>

            {/* Nome da Roleta */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase text-zinc-300 tracking-wider">
                Nome da Roleta
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-red-600"
              />
            </div>

            {/* Valor mínimo de compra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-zinc-300 tracking-wider">
                  Valor Mínimo da Compra no PDV (R$)
                </label>
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                  <span className="text-zinc-500 font-mono text-xs">R$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={config.minPurchaseValue}
                    onChange={(e) => setConfig({ ...config, minPurchaseValue: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-white font-mono font-bold focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  A roleta só abre no PDV para compras iguais ou superiores a este valor.
                </span>
              </div>

              {/* Taxa de Acerto (%) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold uppercase text-zinc-300 tracking-wider">
                  Taxa de Acerto da Roleta (%)
                </label>
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                  <span className="text-zinc-500 font-mono text-xs">%</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    value={config.hitRatePercentage}
                    onChange={(e) => setConfig({ ...config, hitRatePercentage: Number(e.target.value) })}
                    className="w-full bg-transparent text-xs text-white font-mono font-bold focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-zinc-500 block">
                  Padrão solicitado: 10% de chance probabilística.
                </span>
              </div>
            </div>

            {/* Multiplicador de Retorno Financeiro */}
            <div className="p-4 bg-zinc-900/60 border border-zinc-805 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Algoritmo de Retorno Financeiro (10x Custo)
                  </span>
                </div>
                <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-lg border border-emerald-900/40">
                  {config.multiplierRequired}x
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                O algoritmo monitora as vendas acumuladas geradas por compras elegíveis no PDV. 
                Mesmo que o giro caia nos 10% de chance, o prêmio em produto só é liberado se a roleta já tiver 
                acumulado pelo menos <strong>{config.multiplierRequired} vezes o preço de custo</strong> do produto sorteado.
              </p>
            </div>

            {/* Modo de Seleção de Prêmios */}
            <div className="space-y-3 pt-4 border-t border-zinc-900">
              <label className="text-[11px] font-extrabold uppercase text-zinc-300 tracking-wider block">
                Origem dos Prêmios Sorteados
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div
                  onClick={() => setConfig({ ...config, prizeSelectionMode: 'AUTO_PRODUCTS' })}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    config.prizeSelectionMode === 'AUTO_PRODUCTS'
                      ? 'bg-red-950/40 border-red-600 text-white'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-extrabold text-xs flex items-center gap-2 mb-1">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${config.prizeSelectionMode === 'AUTO_PRODUCTS' ? 'border-red-500 bg-red-500' : 'border-zinc-600'}`}>
                      {config.prizeSelectionMode === 'AUTO_PRODUCTS' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </span>
                    Automático pelo Estoque
                  </div>
                  <p className="text-[11px] text-zinc-400 pl-5">
                    O algoritmo escolhe produtos ativos com saldo em estoque positivo e custo de até R$ configurado.
                  </p>
                </div>

                <div
                  onClick={() => setConfig({ ...config, prizeSelectionMode: 'MANUAL' })}
                  className={`p-4 rounded-2xl border cursor-pointer transition ${
                    config.prizeSelectionMode === 'MANUAL'
                      ? 'bg-red-950/40 border-red-600 text-white'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="font-extrabold text-xs flex items-center gap-2 mb-1">
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${config.prizeSelectionMode === 'MANUAL' ? 'border-red-500 bg-red-500' : 'border-zinc-600'}`}>
                      {config.prizeSelectionMode === 'MANUAL' && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </span>
                    Prêmios Manuais
                  </div>
                  <p className="text-[11px] text-zinc-400 pl-5">
                    Você digita manualmente os nomes e custos dos brindes (ex: Vale R$ 20, Calcinha Brinde).
                  </p>
                </div>
              </div>

              {/* Automatic Mode Settings */}
              {config.prizeSelectionMode === 'AUTO_PRODUCTS' && (
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400">
                      Custo Máximo do Produto (R$)
                    </label>
                    <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5">
                      <span className="text-zinc-500 font-mono text-xs">R$</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={config.maxProductCost}
                        onChange={(e) => setConfig({ ...config, maxProductCost: Number(e.target.value) })}
                        className="w-full bg-transparent text-xs text-white font-mono font-bold focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400">
                      Qtd de Produtos na Roleta
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="12"
                      step="1"
                      value={config.autoProductsCount}
                      onChange={(e) => setConfig({ ...config, autoProductsCount: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-750 rounded-xl px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
              <div>
                <span className="text-xs font-bold text-white block">Efeitos Sonoros e Fanfarras</span>
                <span className="text-[11px] text-zinc-400">
                  Executa som de comemoração ao abrir no PDV, ticks mecânicos no giro e trombetas da vitória ao premiar.
                </span>
              </div>
              <button
                onClick={() => setConfig({ ...config, soundEnabled: !config.soundEnabled })}
                className="cursor-pointer"
              >
                {config.soundEnabled ? (
                  <Volume2 className="w-6 h-6 text-emerald-400" />
                ) : (
                  <VolumeX className="w-6 h-6 text-zinc-600" />
                )}
              </button>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => handleSaveConfig(config)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-red-600/30 transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Gravando...' : 'Salvar Configurações'}
              </button>
            </div>
          </div>

          {/* Right Column: Active Prizes Preview */}
          <div className="lg:col-span-5 bg-zinc-950 border border-zinc-850 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-rose-50 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-rose-500" />
                  Prêmios Ativos na Roleta
                </h3>
                <span className="text-[10px] font-mono text-zinc-500">
                  {config.prizeSelectionMode === 'AUTO_PRODUCTS' ? 'Modo Automático' : 'Modo Manual'}
                </span>
              </div>

              {config.prizeSelectionMode === 'AUTO_PRODUCTS' ? (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    Produtos selecionados do seu estoque com custo até <strong>R$ {config.maxProductCost.toFixed(2).replace('.', ',')}</strong>:
                  </p>

                  {loadingProducts ? (
                    <div className="p-8 text-center text-xs text-zinc-500">
                      Buscando produtos elegíveis no catálogo...
                    </div>
                  ) : eligibleProducts.length === 0 ? (
                    <div className="p-6 bg-zinc-900/40 border border-zinc-800 rounded-2xl text-center text-xs text-zinc-500">
                      Nenhum produto com saldo em estoque e custo até R$ {config.maxProductCost} encontrado. Aumente o valor limite ou use o modo manual.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {eligibleProducts.map((p, idx) => (
                        <div key={p.id || idx} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold text-white truncate block">🏆 {p.name}</span>
                            <span className="text-[10px] text-zinc-400 block font-mono">
                              Custo: R$ {p.costPrice.toFixed(2).replace('.', ',')} • Estoque: {p.stock} un
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900/30 shrink-0">
                            Meta 10x: R$ {(p.costPrice * 10).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Manual Prizes Mode */
                <div className="space-y-4">
                  {/* Add manual prize form */}
                  <div className="p-3.5 bg-zinc-900/60 border border-zinc-800 rounded-2xl space-y-2.5 text-xs">
                    <span className="font-bold text-zinc-300 block text-[11px] uppercase">
                      Adicionar Prêmio Customizado
                    </span>
                    <input
                      type="text"
                      placeholder="Nome do brinde / prêmio..."
                      value={newPrizeName}
                      onChange={(e) => setNewPrizeName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-750 rounded-xl p-2 text-white text-xs focus:outline-none focus:border-red-600"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-500">Custo estimado (R$)</span>
                        <input
                          type="number"
                          value={newPrizeCost}
                          onChange={(e) => setNewPrizeCost(Number(e.target.value))}
                          className="w-full bg-zinc-950 border border-zinc-750 rounded-xl p-2 text-white font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-500">Valor de venda (R$)</span>
                        <input
                          type="number"
                          value={newPrizeRetail}
                          onChange={(e) => setNewPrizeRetail(Number(e.target.value))}
                          className="w-full bg-zinc-950 border border-zinc-750 rounded-xl p-2 text-white font-mono text-xs"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleAddManualPrize}
                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
                    >
                      + Inserir Brinde
                    </button>
                  </div>

                  {/* List of manual prizes */}
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {config.manualPrizes.map((p) => (
                      <div key={p.id} className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div>
                          <span className="font-bold text-white block">🏆 {p.name}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Custo: R$ {p.costPrice.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveManualPrize(p.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 transition cursor-pointer"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-zinc-900/40 border border-zinc-850 rounded-2xl text-[11px] text-zinc-400 leading-relaxed">
              💡 <strong>Como funciona na hora da venda:</strong> Quando a operadora finaliza uma compra de no mínimo R$ {config.minPurchaseValue.toFixed(2).replace('.', ',')} no PDV, a roleta sobe automaticamente em tela cheia com fanfarra comemorativa para o cliente girar no centro da tela.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PHRASES (PASSOU A VEZ / NÃO FOI HOJE) */}
      {activeTab === 'phrases' && (
        <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-red-500" />
                Frases de "Passou a vez / Não foi desta vez"
              </h2>
              <p className="text-xs text-zinc-400">
                A roleta contém por padrão 20 opções pré-cadastradas para os momentos em que a cliente não for contemplada, mantendo o clima positivo e acolhedor.
              </p>
            </div>

            <button
              onClick={handleResetPhrases}
              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Restaurar 20 Frases Padrão
            </button>
          </div>

          {/* Add new phrase */}
          <div className="flex items-center gap-2 max-w-xl">
            <input
              type="text"
              placeholder="Digite uma nova frase (ex: Mais sorte na próxima! ✨)..."
              value={newPhrase}
              onChange={(e) => setNewPhrase(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddPhrase(); }}
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-600"
            />
            <button
              onClick={handleAddPhrase}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
            >
              Adicionar Frase
            </button>
          </div>

          {/* Phrases Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-2">
            {config.losingPhrases.map((phrase, idx) => (
              <div 
                key={idx}
                className="p-3 bg-zinc-900/50 border border-zinc-800/80 rounded-2xl flex items-center justify-between gap-2 text-xs hover:border-zinc-700 transition"
              >
                <span className="text-zinc-200 truncate font-medium">
                  {idx + 1}. {phrase}
                </span>
                <button
                  onClick={() => handleRemovePhrase(idx)}
                  className="text-zinc-500 hover:text-red-400 p-1 transition cursor-pointer shrink-0"
                  title="Excluir frase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-red-500" />
                Histórico de Giros no PDV
              </h2>
              <p className="text-xs text-zinc-400">
                Auditoria de todos os giros efetuados pelas clientes após compras no caixa físico.
              </p>
            </div>

            <div className="relative min-w-[280px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por pedido, cliente ou prêmio..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-600"
              />
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 space-y-2">
              <History className="w-8 h-8 mx-auto text-zinc-600" />
              <p className="text-xs font-bold">Nenhum registro de giro encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/60 text-zinc-400 uppercase font-mono text-[10px] tracking-wider border-b border-zinc-850">
                  <tr>
                    <th className="py-3 px-4">Data/Hora</th>
                    <th className="py-3 px-4">Pedido PDV</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Valor Compra</th>
                    <th className="py-3 px-4">Resultado</th>
                    <th className="py-3 px-4">Prêmio / Frase Sorteada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {filteredHistory.map((h) => {
                    const isWin = h.resultType === 'WIN';
                    return (
                      <tr key={h.id} className="hover:bg-zinc-900/40 transition">
                        <td className="py-3 px-4 font-mono text-zinc-400">
                          {h.createdAt ? new Date(h.createdAt).toLocaleString('pt-BR') : '-'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          #{h.orderId.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-3 px-4">
                          {h.customerName || 'Cliente Balcão'}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          R$ {Number(h.orderTotal || 0).toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono ${
                            isWin 
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/40' 
                              : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                          }`}>
                            {isWin ? '🏆 Ganhou Prêmio' : 'Não foi desta vez'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {isWin ? (
                            <span className="text-rose-300">🏆 {h.prizeWon}</span>
                          ) : (
                            <span className="text-zinc-400">{h.phraseLanded}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Live Simulation Wheel Modal */}
      <RouletteWheelModal
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        orderId="SIMULACAO-TESTE"
        orderTotal={120.00}
        customerName="CLIENTE TESTE (SIMULADOR)"
      />
    </div>
  );
}
