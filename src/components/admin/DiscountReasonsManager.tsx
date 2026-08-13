import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  RefreshCw, 
  AlertCircle, 
  HelpCircle, 
  ShieldAlert, 
  ListOrdered, 
  FileText, 
  Power,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { 
  DiscountReasonModel 
} from '../../types/pdvDiscount';
import { 
  getDiscountReasons, 
  createDiscountReason, 
  updateDiscountReason, 
  toggleDiscountReasonActive, 
  safeDeleteDiscountReason, 
  seedDiscountReasons 
} from '../../services/pdvDiscountReasonService';

interface DiscountReasonsManagerProps {
  companyId?: string;
  canEdit?: boolean;
}

export const DiscountReasonsManager: React.FC<DiscountReasonsManagerProps> = ({
  companyId,
  canEdit = true,
}) => {
  const [reasons, setReasons] = useState<DiscountReasonModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingReason, setEditingReason] = useState<DiscountReasonModel | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formRequiresNotes, setFormRequiresNotes] = useState<boolean>(false);
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);
  const [formActive, setFormActive] = useState<boolean>(true);

  const fetchReasons = async () => {
    setLoading(true);
    try {
      const list = await getDiscountReasons(companyId, false);
      setReasons(list);
    } catch (err) {
      console.error('Erro ao carregar motivos de desconto:', err);
      setMessage({ type: 'error', text: 'Não foi possível carregar os motivos de desconto.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReasons();
  }, [companyId]);

  const handleSeedDefaults = async () => {
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    try {
      const seeded = await seedDiscountReasons(companyId);
      setReasons(seeded);
      setMessage({
        type: 'success',
        text: 'Motivos de desconto padrão cadastrados/verificados com sucesso!',
      });
    } catch (err) {
      console.error('Erro ao cadastrar motivos padrão:', err);
      setMessage({ type: 'error', text: 'Erro ao cadastrar os motivos padrão.' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingReason(null);
    setFormName('');
    setFormDescription('');
    setFormRequiresNotes(false);
    setFormDisplayOrder(reasons.length > 0 ? Math.max(...reasons.map(r => r.displayOrder || 0)) + 1 : 1);
    setFormActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (reason: DiscountReasonModel) => {
    setEditingReason(reason);
    setFormName(reason.name);
    setFormDescription(reason.description || '');
    setFormRequiresNotes(reason.requiresNotes);
    setFormDisplayOrder(reason.displayOrder);
    setFormActive(reason.active);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setMessage({ type: 'error', text: 'Informe o nome do motivo.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      if (editingReason) {
        // Edit existing
        await updateDiscountReason(editingReason.id, {
          name: formName.trim(),
          description: formDescription.trim(),
          requiresNotes: formRequiresNotes,
          displayOrder: formDisplayOrder,
          active: formActive,
        });
        setMessage({ type: 'success', text: `Motivo "${formName}" atualizado com sucesso.` });
      } else {
        // Create new
        await createDiscountReason({
          code: formName.trim().toUpperCase().replace(/\s+/g, '_'),
          name: formName.trim(),
          description: formDescription.trim(),
          requiresNotes: formRequiresNotes,
          displayOrder: formDisplayOrder,
          active: formActive,
          isSystemDefault: false,
          companyId,
          createdBy: 'admin',
        });
        setMessage({ type: 'success', text: `Novo motivo "${formName}" criado com sucesso.` });
      }

      setIsModalOpen(false);
      await fetchReasons();
    } catch (err) {
      console.error('Erro ao salvar motivo:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar o motivo de desconto.' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (reason: DiscountReasonModel) => {
    if (!canEdit) return;
    try {
      const nextActive = !reason.active;
      await toggleDiscountReasonActive(reason.id, nextActive);
      setReasons(prev => prev.map(r => r.id === reason.id ? { ...r, active: nextActive } : r));
      setMessage({
        type: 'info',
        text: `Motivo "${reason.name}" foi ${nextActive ? 'ativado' : 'desativado'}.`
      });
    } catch (err) {
      console.error('Erro ao alterar status:', err);
      setMessage({ type: 'error', text: 'Falha ao alterar o status do motivo.' });
    }
  };

  const handleDeleteOrDeactivate = async (reason: DiscountReasonModel) => {
    if (!canEdit) return;
    
    if (!confirm(`Deseja remover ou desativar o motivo "${reason.name}"?`)) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const result = await safeDeleteDiscountReason(reason);
      setMessage({
        type: result.deactivatedOnly ? 'info' : 'success',
        text: result.message,
      });
      await fetchReasons();
    } catch (err) {
      console.error('Erro ao remover motivo:', err);
      setMessage({ type: 'error', text: 'Erro ao processar remoção do motivo.' });
    } finally {
      setSaving(false);
    }
  };

  const activeCount = reasons.filter(r => r.active).length;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-amber-500" />
            Motivos de Desconto
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 normal-case">
              ({activeCount} ativos de {reasons.length})
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cadastre e gerencie os motivos selecionáveis pelos operadores no PDV.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleSeedDefaults}
            disabled={saving || !canEdit}
            className="text-xs h-9 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Cadastra e restaura os 17 motivos de desconto padrão do sistema se ainda não existirem"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
            Cadastrar Padrões
          </Button>

          <Button
            type="button"
            onClick={handleOpenAddModal}
            disabled={!canEdit}
            className="text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Motivo
          </Button>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between animate-fadeIn ${
          message.type === 'error'
            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50'
            : message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50'
            : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50'
        }`}>
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setMessage(null)} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
          Carregando motivos de desconto...
        </div>
      ) : reasons.length === 0 ? (
        /* Empty State */
        <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
          <HelpCircle className="w-8 h-8 mx-auto text-slate-400" />
          <div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhum motivo de desconto cadastrado</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Clique em "Cadastrar Padrões" para gerar os 17 motivos padrão recomendados para o varejo.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleSeedDefaults}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Gerar 17 Motivos Padrão
          </Button>
        </div>
      ) : (
        /* Table of Reasons */
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3 w-12 text-center">Ordem</th>
                <th className="py-2.5 px-4">Motivo / Descrição</th>
                <th className="py-2.5 px-3 text-center">Obs. Obrigatória</th>
                <th className="py-2.5 px-3 text-center">Tipo</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {reasons.map((reason) => (
                <tr 
                  key={reason.id} 
                  className={`transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${
                    !reason.active ? 'opacity-50 bg-slate-50/30 dark:bg-slate-950/30' : ''
                  }`}
                >
                  <td className="py-3 px-3 text-center font-bold text-slate-600 dark:text-slate-400">
                    {reason.displayOrder}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                      {reason.name}
                    </div>
                    {reason.description && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {reason.description}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {reason.requiresNotes ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                        <FileText className="w-3 h-3 mr-1" />
                        Obrigatória
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 dark:text-slate-600">Opcional</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {reason.isSystemDefault ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        Padrão
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400">
                        Personalizado
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(reason)}
                      disabled={!canEdit}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                        reason.active
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                      }`}
                      title={reason.active ? 'Clique para desativar' : 'Clique para ativar'}
                    >
                      <Power className="w-3 h-3" />
                      {reason.active ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(reason)}
                      disabled={!canEdit}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      title="Editar motivo"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteOrDeactivate(reason)}
                      disabled={!canEdit}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Excluir ou Desativar motivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {editingReason ? 'Editar Motivo de Desconto' : 'Novo Motivo de Desconto'}
              </h4>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Nome do Motivo <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Cliente fidelizado, Promoção relâmpago..."
                  required
                  className="dark:bg-slate-950 font-medium text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Descrição / Ajuda ao operador (opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Explicativo breve sobre quando este motivo deve ser aplicado..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Ordem de Exibição
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={formDisplayOrder}
                    onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                    className="dark:bg-slate-950 text-xs font-bold text-center"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={formActive}
                      onChange={(e) => setFormActive(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    Motivo Ativo
                  </label>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-500/5">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formRequiresNotes}
                    onChange={(e) => setFormRequiresNotes(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded mt-0.5"
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">
                      Exigir Observação por Escrito
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      Sempre que este motivo for selecionado no PDV, o operador será obrigado a preencher o campo de observação.
                    </span>
                  </div>
                </label>
              </div>

              <div className="pt-2 flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                >
                  {saving ? 'Salvando...' : 'Salvar Motivo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
