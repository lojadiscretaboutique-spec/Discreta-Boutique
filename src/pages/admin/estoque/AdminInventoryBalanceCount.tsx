import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Barcode, 
  Search, 
  Plus, 
  Minus, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Pause, 
  Play, 
  ArrowLeft, 
  RefreshCw, 
  Volume2, 
  VolumeX, 
  Edit3, 
  Check, 
  TrendingDown, 
  TrendingUp, 
  Layers,
  Sparkles,
  Camera,
  RotateCcw,
  CheckSquare
} from 'lucide-react';
import { inventoryBalanceService } from '../../../services/inventoryBalanceService';
import { InventoryBalance, InventoryBalanceItem } from '../../../types/inventoryBalance';
import { useFeedback } from '../../../contexts/FeedbackContext';

// Helper to synthesize audio beeps via Web Audio API
const playSound = (type: 'success' | 'error') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 high note
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // Low note
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Ignore audio context errors if blocked by browser
  }
};

export function AdminInventoryBalanceCount() {
  const { balanceId } = useParams<{ balanceId: string }>();
  const navigate = useNavigate();
  const { toast } = useFeedback();

  const [balance, setBalance] = useState<InventoryBalance | null>(null);
  const [items, setItems] = useState<InventoryBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Scan input & multiplier
  const [scanInput, setScanInput] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastScannedItem, setLastScannedItem] = useState<{
    item: InventoryBalanceItem;
    newQty: number;
    delta: number;
  } | null>(null);

  // Filters & search
  const [filterTab, setFilterTab] = useState<'ALL' | 'RECENT' | 'COUNTED' | 'UNCOUNTED' | 'SURPLUS' | 'SHORTAGE'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [recentItemIds, setRecentItemIds] = useState<string[]>([]);

  // Modals
  const [matchingPickerItems, setMatchingPickerItems] = useState<InventoryBalanceItem[]>([]);
  const [selectedEditItem, setSelectedEditItem] = useState<InventoryBalanceItem | null>(null);
  const [editManualQty, setEditManualQty] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>('');

  const scanInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    if (!balanceId) return;
    try {
      setLoading(true);
      const [balData, itemsData] = await Promise.all([
        inventoryBalanceService.getBalance(balanceId),
        inventoryBalanceService.listBalanceItems(balanceId)
      ]);
      setBalance(balData);
      setItems(itemsData);
    } catch (e) {
      console.error("Error loading balance count data:", e);
      toast("Erro ao carregar dados do balanço.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [balanceId]);

  // Maintain input focus for USB/Bluetooth barcode scanners
  useEffect(() => {
    if (!loading && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [loading, lastScannedItem]);

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawCode = scanInput.trim();
    if (!rawCode || !balanceId) return;

    setScanInput('');

    // Parse multiplier (e.g. "10*78912345" or "5*SKU123")
    let delta = 1;
    let codeToSearch = rawCode;

    if (rawCode.includes('*')) {
      const parts = rawCode.split('*');
      const parsedMultiplier = parseInt(parts[0], 10);
      if (!isNaN(parsedMultiplier) && parsedMultiplier > 0) {
        delta = parsedMultiplier;
        codeToSearch = parts.slice(1).join('*').trim();
      }
    }

    try {
      const matches = await inventoryBalanceService.findMatchingItems(balanceId, codeToSearch);

      if (matches.length === 0) {
        if (soundEnabled) playSound('error');
        toast(`Código "${codeToSearch}" não localizado no balanço.`, "error");
        return;
      }

      if (matches.length === 1) {
        const targetItem = matches[0];
        const res = await inventoryBalanceService.recordScan(balanceId, targetItem.id, delta, 'SCAN');
        if (res.success && res.item) {
          if (soundEnabled) playSound('success');
          setLastScannedItem({
            item: res.item,
            newQty: res.newQty || 0,
            delta
          });

          // Update local state immediately for instant feedback
          setItems(prev => prev.map(i => i.id === targetItem.id ? res.item! : i));
          setRecentItemIds(prev => [targetItem.id, ...prev.filter(id => id !== targetItem.id)]);
        }
      } else {
        // Multiple items matched (e.g., duplicate barcode across variations)
        setMatchingPickerItems(matches);
      }
    } catch (err: any) {
      if (soundEnabled) playSound('error');
      toast(err.message || "Erro ao registrar bipagem.", "error");
    } finally {
      if (scanInputRef.current) scanInputRef.current.focus();
    }
  };

  const handleSelectFromPicker = async (item: InventoryBalanceItem) => {
    if (!balanceId) return;
    try {
      const res = await inventoryBalanceService.recordScan(balanceId, item.id, 1, 'SCAN');
      if (res.success && res.item) {
        if (soundEnabled) playSound('success');
        setLastScannedItem({
          item: res.item,
          newQty: res.newQty || 0,
          delta: 1
        });
        setItems(prev => prev.map(i => i.id === item.id ? res.item! : i));
        setRecentItemIds(prev => [item.id, ...prev.filter(id => id !== item.id)]);
      }
    } catch (err: any) {
      toast("Erro ao registrar bipagem do item selecionado.", "error");
    } finally {
      setMatchingPickerItems([]);
      if (scanInputRef.current) scanInputRef.current.focus();
    }
  };

  const handleManualSave = async () => {
    if (!selectedEditItem || !balanceId) return;
    try {
      setSubmitting(true);
      await inventoryBalanceService.updateItemCountManual(
        balanceId,
        selectedEditItem.id,
        editManualQty,
        editReason
      );

      toast(`Quantidade de "${selectedEditItem.productName}" atualizada para ${editManualQty}.`, "success");
      
      // Update local item
      const updatedList = await inventoryBalanceService.listBalanceItems(balanceId);
      setItems(updatedList);
      setSelectedEditItem(null);
    } catch (e) {
      toast("Erro ao salvar ajuste manual.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePause = async () => {
    if (!balance || !balanceId) return;
    try {
      if (balance.status === 'EM_CONTAGEM') {
        await inventoryBalanceService.pauseBalance(balanceId);
        toast("Balanço pausado.", "info");
      } else {
        await inventoryBalanceService.resumeBalance(balanceId);
        toast("Balanço retomado.", "success");
      }
      const updatedBal = await inventoryBalanceService.getBalance(balanceId);
      setBalance(updatedBal);
    } catch (e) {
      toast("Erro ao alterar status do balanço.", "error");
    }
  };

  // Filter items for list display
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.productName.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.variantName || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.sku || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.barcode || '').toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'RECENT') return recentItemIds.includes(item.id);
    if (filterTab === 'COUNTED') return item.counted || item.countedQuantity > 0;
    if (filterTab === 'UNCOUNTED') return !item.counted && item.countedQuantity === 0;
    if (filterTab === 'SURPLUS') return item.difference > 0;
    if (filterTab === 'SHORTAGE') return item.difference < 0;
    return true;
  });

  const totalExpected = items.length;
  const totalCountedItems = items.filter(i => i.counted || i.countedQuantity > 0).length;
  const progressPercent = totalExpected > 0 ? Math.round((totalCountedItems / totalExpected) * 100) : 0;
  const totalCountedUnits = items.reduce((acc, i) => acc + (i.countedQuantity || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-400 space-y-3">
        <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
        <p className="text-sm font-semibold">Carregando balanço de estoque...</p>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="p-8 text-center text-zinc-400 space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <div className="text-lg font-bold text-white">Balanço não encontrado</div>
        <Link to="/admin/estoque/balancos" className="text-amber-400 underline text-sm">
          Voltar para a lista de balanços
        </Link>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 space-y-4 max-w-7xl mx-auto pb-24">
      {/* Header Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/estoque/balancos"
            className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                {balance.code}
              </span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {balance.status === 'EM_CONTAGEM' ? 'Em Contagem' : balance.status}
              </span>
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight mt-1">
              {balance.name}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              soundEnabled 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'bg-zinc-950 border-zinc-800 text-zinc-500'
            }`}
            title="Alternar Bip Sonoro"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Som Ativo' : 'Mudo'}</span>
          </button>

          <button
            onClick={handleTogglePause}
            className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            {balance.status === 'EM_CONTAGEM' ? (
              <>
                <Pause className="w-4 h-4 text-amber-400" /> Pausar
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-emerald-400" /> Retomar
              </>
            )}
          </button>

          <Link
            to={`/admin/estoque/balancos/${balanceId}/divergencias`}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" /> Conferir & Finalizar
          </Link>
        </div>
      </div>

      {/* Progress Bar & Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium">Progresso de Contagem</div>
          <div className="text-xl font-bold text-white mt-0.5">{progressPercent}%</div>
          <div className="w-full bg-zinc-950 h-1.5 rounded-full overflow-hidden mt-2">
            <div className="bg-amber-500 h-full transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium">Itens Bipados / Total</div>
          <div className="text-xl font-bold text-amber-400 mt-0.5">
            {totalCountedItems} <span className="text-xs text-zinc-500 font-normal">/ {totalExpected}</span>
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Produtos distintos contados</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium">Total de Peças Contadas</div>
          <div className="text-xl font-bold text-emerald-400 mt-0.5">{totalCountedUnits} un</div>
          <div className="text-[10px] text-zinc-500 mt-1">Soma física das unidades</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800">
          <div className="text-xs text-zinc-400 font-medium">Pendentes de Contagem</div>
          <div className="text-xl font-bold text-zinc-300 mt-0.5">
            {totalExpected - totalCountedItems}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">Aguardando bipagem</div>
        </div>
      </div>

      {/* MAIN BARCODE SCANNER INPUT BOX */}
      <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-amber-500/10 border-2 border-amber-500/40 p-4 rounded-2xl shadow-2xl space-y-3">
        <form onSubmit={handleScanSubmit} className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Barcode className="w-6 h-6 absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" />
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Bipe o código de barras ou digite (ex: 5*78912345)..."
                className="w-full pl-12 pr-4 py-3.5 bg-zinc-950 border-2 border-amber-500/60 rounded-xl text-base md:text-lg font-mono font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-500/20 transition-all"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95 shrink-0"
            >
              Bipar / Somar
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 px-1">
          <div className="flex items-center gap-2">
            <span className="font-mono bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 rounded text-amber-400">
              Multiplicador:
            </span>
            <span>Digite <code className="text-white">10*CÓDIGO</code> para adicionar 10 unidades de uma vez.</span>
          </div>

          <button
            type="button"
            onClick={() => scanInputRef.current?.focus()}
            className="text-amber-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5" /> Re-focar Leitor de Código
          </button>
        </div>
      </div>

      {/* Last Scanned Feedback Banner */}
      {lastScannedItem && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-emerald-500/30 overflow-hidden shrink-0 flex items-center justify-center">
              {lastScannedItem.item.imageUrl ? (
                <img src={lastScannedItem.item.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Barcode className="w-6 h-6 text-emerald-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  + {lastScannedItem.delta} adicionado com sucesso!
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {lastScannedItem.item.sku || lastScannedItem.item.barcode}
                </span>
              </div>
              <div className="font-bold text-white text-base">
                {lastScannedItem.item.productName}
                {lastScannedItem.item.variantName && (
                  <span className="text-amber-400 text-sm ml-2">({lastScannedItem.item.variantName})</span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xs text-zinc-400">Total Contado:</div>
            <div className="text-2xl font-black text-emerald-400">
              {lastScannedItem.newQty} <span className="text-xs text-zinc-400 font-medium">un</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Filtrar por nome, SKU, código..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: `Todos (${items.length})` },
            { id: 'RECENT', label: `Últimos Bipados (${recentItemIds.length})` },
            { id: 'COUNTED', label: `Contados (${items.filter(i => i.counted || i.countedQuantity > 0).length})` },
            { id: 'UNCOUNTED', label: `Pendentes (${items.filter(i => !i.counted && i.countedQuantity === 0).length})` },
            { id: 'SURPLUS', label: 'Sobras' },
            { id: 'SHORTAGE', label: 'Faltas' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                filterTab === tab.id
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 space-y-2">
            <Barcode className="w-10 h-10 mx-auto text-zinc-600" />
            <p className="text-sm font-semibold text-zinc-400">Nenhum item encontrado nesta aba.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {filteredItems.map(item => {
              const qty = item.countedQuantity || 0;
              const expected = item.theoreticalBalance ?? item.expectedSnapshot ?? 0;
              const diff = qty - expected;

              return (
                <div 
                  key={item.id}
                  className={`p-3.5 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-800/40 transition-colors ${
                    recentItemIds[0] === item.id ? 'bg-amber-500/5 border-l-4 border-amber-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Barcode className="w-5 h-5 text-zinc-600" />
                      )}
                    </div>

                    <div>
                      <div className="font-bold text-white text-sm md:text-base flex items-center gap-2">
                        {item.productName}
                        {item.variantName && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                            {item.variantName}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 mt-1 font-mono">
                        {item.sku && <span>SKU: {item.sku}</span>}
                        {item.barcode && <span>EAN: {item.barcode}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right side controls: Count & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 border-zinc-800/60 pt-2 sm:pt-0">
                    {!balance.blindCount && (
                      <div className="text-right text-xs">
                        <span className="text-zinc-500">Esperado:</span>
                        <div className="font-bold text-zinc-300">{expected} un</div>
                      </div>
                    )}

                    <div className="text-right">
                      <span className="text-xs text-zinc-400">Contado:</span>
                      <div className="text-xl font-extrabold text-amber-400">
                        {qty} <span className="text-xs text-zinc-400 font-medium">un</span>
                      </div>
                    </div>

                    {/* Increment / Decrement Quick Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => inventoryBalanceService.recordScan(balanceId!, item.id, -1, 'SCAN').then(loadData)}
                        className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                        title="Subtrair 1"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => inventoryBalanceService.recordScan(balanceId!, item.id, 1, 'SCAN').then(loadData)}
                        className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold transition-colors shadow-md shadow-amber-500/20"
                        title="Somar 1"
                      >
                        <Plus className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setSelectedEditItem(item);
                          setEditManualQty(item.countedQuantity || 0);
                          setEditReason('');
                        }}
                        className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors ml-1"
                        title="Ajuste Manual Completo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: Multiple Matches Picker */}
      {matchingPickerItems.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Barcode className="w-5 h-5 text-amber-500" /> Código vinculado a múltiplos produtos
              </h3>
              <button onClick={() => setMatchingPickerItems([])} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              O código bipado foi encontrado em mais de uma variação ou item. Clique no item correto para somar a contagem:
            </p>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {matchingPickerItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => handleSelectFromPicker(item)}
                  className="w-full p-3.5 rounded-xl bg-zinc-950 hover:bg-amber-500/10 border border-zinc-800 hover:border-amber-500/40 text-left transition-all flex items-center justify-between gap-3 group"
                >
                  <div>
                    <div className="font-bold text-white text-sm group-hover:text-amber-400">
                      {item.productName}
                    </div>
                    {item.variantName && (
                      <div className="text-xs text-amber-400 font-semibold mt-0.5">
                        Variação: {item.variantName}
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-500 font-mono mt-1">
                      SKU: {item.sku} | EAN: {item.barcode}
                    </div>
                  </div>

                  <div className="px-3 py-1.5 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs shrink-0">
                    +1 Selecionar
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Manual Quantity Override */}
      {selectedEditItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-500" /> Ajuste Manual de Contagem
              </h3>
              <button onClick={() => setSelectedEditItem(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <div className="font-bold text-white text-sm">{selectedEditItem.productName}</div>
              {selectedEditItem.variantName && (
                <div className="text-xs text-amber-400 font-semibold">{selectedEditItem.variantName}</div>
              )}
              <div className="text-xs text-zinc-500 font-mono mt-1">SKU: {selectedEditItem.sku}</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Quantidade Física Total
              </label>
              <input
                type="number"
                min="0"
                value={editManualQty}
                onChange={(e) => setEditManualQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xl font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Motivo da Alteração Manual
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Ex: Re-contagem da gaveta superior / Caixa fechada com 50 un"
                className="w-full px-3.5 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedEditItem(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleManualSave}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20"
              >
                {submitting ? 'Gravando...' : 'Salvar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
