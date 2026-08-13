import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, Unlock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn, formatCurrency } from '../../lib/utils';
import { DiscountReasonModel } from '../../types/pdvDiscount';
import { getDiscountReasons } from '../../services/pdvDiscountReasonService';

interface Authorizer {
  id: string;
  name: string;
  role: string;
}

interface PDVDiscountAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthorizeSuccess: (authorizer: { id: string; name: string; role: string }, authorizationId: string, motivo: string, observacao: string) => void;
  
  // Data to display
  valorBruto: number;
  descontoItens: number;
  descontoGeral: number;
  descontoTotal: number;
  percentualEfetivo: number;
  valorFinal: number;
  nivelNecessario: string;
  operatorId: string;
  companyId: string;
  cartId: string;
  cartFingerprint: string;
  
  // Authorizer choices loaded from firestore
  availableAuthorizers: Authorizer[];
}

export const PDVDiscountAuthModal: React.FC<PDVDiscountAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthorizeSuccess,
  valorBruto,
  descontoItens,
  descontoGeral,
  descontoTotal,
  percentualEfetivo,
  valorFinal,
  nivelNecessario,
  operatorId,
  companyId,
  cartId,
  cartFingerprint,
  availableAuthorizers
}) => {
  const [selectedAuthId, setSelectedAuthId] = useState<string>('');
  const [reasonsList, setReasonsList] = useState<DiscountReasonModel[]>([]);
  const [motivo, setMotivo] = useState<string>('');
  const [customMotivo, setCustomMotivo] = useState<string>('');
  const [observacao, setObservacao] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadReasons = async () => {
      try {
        const list = await getDiscountReasons(companyId, true);
        setReasonsList(list);
      } catch (err) {
        console.warn('Erro ao carregar motivos de desconto:', err);
      }
    };
    loadReasons();
  }, [companyId]);

  // Auto-focus the PIN field when open or when authorizer is selected
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setPin('');
      // Set default selected authorizer if available
      const filtered = availableAuthorizers.filter(a => a.id !== operatorId);
      if (filtered.length > 0 && !selectedAuthId) {
        setSelectedAuthId(filtered[0].id);
      } else if (availableAuthorizers.length > 0 && !selectedAuthId) {
        setSelectedAuthId(availableAuthorizers[0].id);
      }
    }
  }, [isOpen, availableAuthorizers, operatorId]);

  if (!isOpen) return null;

  const selectedReasonObj = reasonsList.find(r => r.code === motivo || r.name === motivo);
  const isNoteMandatory = Boolean(selectedReasonObj?.requiresNotes) || motivo === 'OUTRO' || percentualEfetivo > 10;

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, ''); // Digits only
    if (value.length <= 8) {
      setPin(value);
      setErrorMsg('');
    }
  };

  const handleAuthorize = async () => {
    if (!selectedAuthId) {
      setErrorMsg('Por favor, selecione um autorizador.');
      return;
    }

    const finalReason = motivo === 'OUTRO' ? customMotivo.trim() : (selectedReasonObj?.name || motivo);
    if (!finalReason) {
      setErrorMsg('Por favor, informe o motivo do desconto.');
      return;
    }

    // Require observation if reason requires notes or total discount percent > 10%
    if (isNoteMandatory && !observacao.trim()) {
      if (motivo === 'OUTRO') {
        setErrorMsg('Para o motivo "Outro", é obrigatório preencher a observação.');
      } else if (selectedReasonObj?.requiresNotes) {
        setErrorMsg(`Para o motivo "${selectedReasonObj.name}", a observação é obrigatória.`);
      } else {
        setErrorMsg('Para descontos acima de 10%, a observação é obrigatória.');
      }
      return;
    }

    if (pin.length < 4 || pin.length > 8) {
      setErrorMsg('O PIN deve conter entre 4 e 8 dígitos numéricos.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      const clientActionId = crypto.randomUUID();

      const response = await fetch('/api/admin/pdv-discount/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin,
          operatorId,
          valorBruto,
          descontoTotal,
          percentualEfetivo,
          nivelNecessario,
          companyId,
          sessionId: cartId,
          authorizerId: selectedAuthId,
          clientActionId,
          motivo: finalReason,
          observacao: observacao.trim(),
          cartId,
          cartFingerprint,
          descontoItens,
          descontoGeral,
          valorFinal
        }),
      });

      const result = await response.json();

      if (result.success && result.authorizationId && result.authorizer) {
        onAuthorizeSuccess(result.authorizer, result.authorizationId, finalReason, observacao.trim());
      } else {
        setPin('');
        setErrorMsg(result.message || 'Código PIN inválido ou autorizador sem limite suficiente.');
        pinInputRef.current?.focus();
      }
    } catch (err) {
      console.error('Error validating PIN authorization:', err);
      setErrorMsg('Erro de conexão ao validar autorização. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAuthorize();
    }
  };

  const preventCopyPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
      {/* Container wrapper for mobile keyboard safe scroll */}
      <div 
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-white/10 flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Lock size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950 dark:text-white uppercase tracking-tight">
                Autorizar Desconto
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Nível Exigido: <span className="text-amber-600 dark:text-amber-400 font-bold">{nivelNecessario}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Section (Scrollable inside to prevent offscreen bugs) */}
        <div className="p-6 space-y-5 overflow-y-auto scrollbar-thin flex-1 max-h-[60vh]">
          
          {/* Discount Financial Summary */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Valor Bruto</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(valorBruto)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Desconto de Itens</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(descontoItens)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Desconto Geral</span>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(descontoGeral)}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Desconto (% Efetivo)</span>
              <span className="text-sm font-black text-red-600 dark:text-red-400">{formatCurrency(descontoTotal)} ({percentualEfetivo.toFixed(1)}%)</span>
            </div>
            <div className="col-span-2 pt-2 mt-2 border-t border-slate-200 dark:border-white/10 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Valor Líquido Final</span>
              <span className="text-lg font-black text-slate-900 dark:text-white">{formatCurrency(valorFinal)}</span>
            </div>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            {/* Authorizer Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Quem está autorizando?
              </label>
              <select
                value={selectedAuthId}
                onChange={(e) => setSelectedAuthId(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-hidden dark:text-white"
              >
                <option key="auth-placeholder" value="" disabled>Selecione um administrador...</option>
                {availableAuthorizers.map((auth, index) => (
                  <option key={`auth-opt-${auth.id || index}-${index}`} value={auth.id}>
                    {auth.name} ({auth.role ? auth.role.toUpperCase() : 'GERENTE'})
                  </option>
                ))}
              </select>
            </div>

            {/* Reason Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Motivo do Desconto
              </label>
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-hidden dark:text-white"
              >
                <option key="motivo-placeholder" value="">Selecione um motivo...</option>
                {reasonsList.map((r) => (
                  <option 
                    key={r.id} 
                    value={r.code}
                    title={r.description || undefined}
                  >
                    {r.name} {r.requiresNotes ? ' (Exige Obs.)' : ''}
                  </option>
                ))}
              </select>
              {selectedReasonObj?.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                  💡 {selectedReasonObj.description}
                </p>
              )}
            </div>

            {/* Custom Reason Field */}
            {motivo === 'OUTRO' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Descreva o motivo <span className="text-red-500 font-bold">*</span>
                </label>
                <input
                  type="text"
                  value={customMotivo}
                  onChange={(e) => setCustomMotivo(e.target.value)}
                  placeholder="Ex: Cliente VIP, Campanha de liquidação..."
                  className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-hidden dark:text-white"
                />
              </div>
            )}

            {/* Observations */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Observações {isNoteMandatory && <span className="text-red-500 font-black">*</span>}
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder={isNoteMandatory ? "Explicação obrigatória para este motivo de desconto..." : "Detalhes adicionais (opcional)..."}
                className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-hidden dark:text-white h-16 resize-none"
              />
            </div>

            {/* PIN field */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                PIN de Segurança do Autorizador
              </label>
              <div className="relative">
                <input
                  ref={pinInputRef}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={pin}
                  onChange={handlePinChange}
                  onKeyDown={handleKeyDown}
                  onCopy={preventCopyPaste}
                  onCut={preventCopyPaste}
                  onPaste={preventCopyPaste}
                  placeholder="••••"
                  autoComplete="off"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl text-center text-lg font-black tracking-widest focus:ring-2 focus:ring-amber-500 outline-hidden dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Errors */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3.5 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-500/20 text-xs font-semibold animate-shake">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 border-t border-slate-100 dark:border-white/5 flex gap-3 bg-slate-50 dark:bg-slate-950/20 rounded-b-3xl shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 py-3 text-xs uppercase font-black border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 dark:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleAuthorize}
            disabled={isLoading || !pin || !selectedAuthId}
            className="flex-1 py-3 text-xs uppercase font-black bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Unlock size={16} />
            )}
            Autorizar Desconto
          </Button>
        </div>
      </div>
    </div>
  );
};
