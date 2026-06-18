import React, { useState, useMemo } from 'react';
import { 
  Tv, Edit2, Play, Square, Copy, Trash2, ExternalLink, 
  ShoppingBag, Eye, Search, AlertCircle 
} from 'lucide-react';
import { LiveSession } from '../../../../../types/liveShop';
import { Button } from '../../../../../components/ui/button';
import { cn } from '../../../../../lib/utils';

interface Props {
  lives: LiveSession[];
  onEdit: (live: LiveSession) => void;
  onDuplicate: (live: LiveSession) => void;
  onUpdateStatus: (live: LiveSession, status: LiveSession['status']) => void;
  onDelete: (live: LiveSession) => void;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onOpenNewForm: () => void;
}

export function LiveShopList({ 
  lives, onEdit, onDuplicate, onUpdateStatus, onDelete, 
  canCreate, canEdit, canDelete, onOpenNewForm 
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | LiveSession['status']>('todos');

  const filteredLives = useMemo(() => {
    return lives.filter((live) => {
      const q = searchTerm.toLowerCase();
      const matchSearch = 
        live.title.toLowerCase().includes(q) || 
        (live.subtitle?.toLowerCase().includes(q) ?? false) ||
        (live.description?.toLowerCase().includes(q) ?? false);
      
      const matchStatus = statusFilter === 'todos' || live.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [lives, searchTerm, statusFilter]);

  return (
    <div className="space-y-4" id="live-shop-list-container">
      {/* Search & Status Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar transmissão por título ou subtítulo..." 
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 text-white outline-none rounded-lg border border-zinc-800 focus:border-red-600 transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="border border-zinc-800 py-2 px-3 rounded-lg bg-zinc-950 text-white text-sm outline-none w-full sm:w-auto font-medium"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="todos">Todos os Status</option>
          <option value="ao_vivo">Ao Vivo</option>
          <option value="agendada">Agendadas</option>
          <option value="encerrada">Encerradas</option>
        </select>
      </div>

      {lives.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-16 text-center space-y-4">
          <Tv className="w-16 h-16 text-zinc-700 mx-auto" />
          <div>
            <h3 className="text-xl font-bold text-white">Nenhuma Transmissão Criada Ainda</h3>
            <p className="text-zinc-500 text-sm mt-1 max-w-lg mx-auto">
              Ative o poder do Live Selling! Configure cupons, monte combos de kits especiais e exiba produtos destacados ao vivo na Discreta.
            </p>
          </div>
          {canCreate && (
            <Button 
              onClick={onOpenNewForm}
              className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg px-6 h-11"
            >
              Cadastrar Primeira Live
            </Button>
          )}
        </div>
      ) : filteredLives.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-16 text-center text-zinc-500 text-sm">
          Nenhuma transmissão atende aos filtros de busca especificados.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredLives.map((live) => (
            <div 
              key={live.id}
              className={cn(
                "bg-zinc-900 border rounded-2xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-md hover:shadow-xl transition-all border-zinc-800",
                live.status === 'ao_vivo' 
                  ? "border-red-900/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-from)_0%,_transparent_60%)] from-red-950/20" 
                  : ""
              )}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                {/* Cover image area */}
                <div className="relative h-20 w-16 bg-zinc-950 rounded-lg overflow-hidden shrink-0 border border-zinc-800 flex items-center justify-center">
                  {live.coverImage ? (
                    <img src={live.coverImage} alt={live.title} className="h-full w-full object-cover" />
                  ) : (
                    <Tv className="w-6 h-6 text-zinc-700" />
                  )}
                  
                  {live.status === 'ao_vivo' && (
                    <span className="absolute bottom-1 left-1 right-1 bg-red-600 text-white text-[7px] font-bold py-0.5 rounded text-center uppercase tracking-wider animate-pulse">
                      AO VIVO
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                      live.status === 'ao_vivo' ? "bg-red-950 text-red-500 border-red-900/40 animate-pulse" :
                      live.status === 'agendada' ? "bg-amber-950 text-amber-500 border-amber-900/30" :
                      "bg-zinc-800 text-zinc-400 border-zinc-700"
                    )}>
                      {live.status === 'ao_vivo' ? '• Ao Vivo' : live.status === 'agendada' ? 'Agendada' : 'Encerrada'}
                    </span>

                    <span className="text-xs text-zinc-500 font-medium">
                      Programada: {live.date} {live.time ? `às ${live.time}` : ''}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white hover:text-red-500 transition-colors">
                    {live.title}
                  </h3>
                  
                  {live.subtitle && (
                    <p className="text-xs text-zinc-400 max-w-xl">
                      {live.subtitle}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 mt-2.5 font-mono text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                      <ShoppingBag size={14} className="text-zinc-600" /> {live.products?.length || 0} produtos
                    </span>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Eye size={14} className="text-zinc-600" /> {live.statistics?.views || 0} visualizações
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions section */}
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto self-stretch lg:self-auto shrink-0 border-t border-zinc-800/40 lg:border-none pt-4 lg:pt-0">
                {/* Instant status toggles */}
                {canEdit && (
                  <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800 gap-1 select-none">
                    <button
                      onClick={() => onUpdateStatus(live, 'ao_vivo')}
                      className={cn(
                        "text-[10px] uppercase font-bold py-1 px-2.5 h-7 rounded-md transition-all",
                        live.status === 'ao_vivo' ? "bg-red-600 text-white font-black" : "text-zinc-400 hover:text-white"
                      )}
                      title="Transmutar para Ao Vivo"
                    >
                      Ao Vivo
                    </button>
                    <button
                      onClick={() => onUpdateStatus(live, 'encerrada')}
                      className={cn(
                        "text-[10px] uppercase font-bold py-1 px-2.5 h-7 rounded-md transition-all",
                        live.status === 'encerrada' ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:text-white"
                      )}
                      title="Encerrar transmissão"
                    >
                      Encerrar
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <a 
                    href="/live" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2.5 h-10 w-10 inline-flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition"
                    title="Visualizar Página Pública /live"
                  >
                    <ExternalLink size={16} />
                  </a>

                  {canEdit && (
                    <Button 
                      onClick={() => onEdit(live)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white p-2.5 h-10 w-10 rounded-lg border border-zinc-700 flex items-center justify-center shrink-0"
                      title="Editar Live"
                    >
                      <Edit2 size={16} />
                    </Button>
                  )}

                  {canCreate && (
                    <Button 
                      onClick={() => onDuplicate(live)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2.5 h-10 w-10 rounded-lg border border-zinc-700 flex items-center justify-center shrink-0"
                      title="Duplicar Configuração"
                    >
                      <Copy size={16} />
                    </Button>
                  )}

                  {canDelete && (
                    <Button 
                      onClick={() => onDelete(live)}
                      className="bg-zinc-950 hover:bg-red-950 border border-zinc-800 text-zinc-400 hover:text-red-500 p-2.5 h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      title="Excluir Transmissão"
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default LiveShopList;
