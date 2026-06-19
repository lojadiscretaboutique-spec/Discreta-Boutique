import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { Button } from '../../../components/ui/button';
import { storyShopService } from '../../../server/services/storyShopService';
import { storyShopCacheService } from '../../../server/services/storyShopCacheService';
import { StoryShop } from '../../../types/storyShop';
import { StoryShopForm } from './components/StoryShopForm';
import { Plus, RefreshCw, Trash2, Edit2, ArrowLeft, ToggleLeft, ToggleRight, Sparkles, AlertCircle, ShoppingBag, Eye, Play, Film, Calendar, CheckCircle, HelpCircle } from 'lucide-react';

export function AdminStoryShopManager() {
  const [stories, setStories] = useState<StoryShop[]>([]);
  const [cacheStatus, setCacheStatus] = useState<{
    updatedAt: any;
    totalItems: number;
    status: 'syncing' | 'synced' | 'error';
    errorMsg?: string;
  } | null>(null);
  const [editingStory, setEditingStory] = useState<StoryShop | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast, confirm } = useFeedback();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await storyShopService.listStories();
      // Sort listed stories stably by order
      data.sort((a, b) => (a.order || 0) - (b.order || 0));
      setStories(data);
      
      // Fetch cache status indicator
      const cacheRef = doc(db, 'public_story_shop_cache', 'items');
      const cacheSnap = await getDoc(cacheRef);
      if (cacheSnap.exists()) {
        const d = cacheSnap.data();
        
        // Audit logic: check if cached count matches actual active stories
        const activeStoriesCount = data.filter(s => s.active && s.title && s.thumbnailUrl && s.videoUrl && s.productId).length;
        const outOfSync = d.totalItems !== activeStoriesCount;
        
        setCacheStatus({ 
          updatedAt: d.updatedAt, 
          totalItems: d.totalItems || 0,
          status: outOfSync ? 'error' : 'synced',
          errorMsg: outOfSync ? `Inconsistência identificada: Cache possui ${d.totalItems} mas existem ${activeStoriesCount} stories válidos no banco de dados. Por favor, regenere.` : undefined
        });
      } else {
        setCacheStatus({
          updatedAt: null,
          totalItems: 0,
          status: 'error',
          errorMsg: 'Nenhum cache público encontrado. Por favor, crie um novo story e regenere o cache.'
        });
      }
    } catch (err) {
      console.error(err);
      toast("Falha ao carregar stories cadastrados.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRegenerate = async () => {
    setLoading(true);
    try {
      await storyShopCacheService.regenerateStoryShopCache();
      
      // Reload cache and refresh admin interface
      const cacheRef = doc(db, 'public_story_shop_cache', 'items');
      const cacheSnap = await getDoc(cacheRef);
      let count = 0;
      if (cacheSnap.exists()) {
        const d = cacheSnap.data();
        count = d.totalItems || 0;
        setCacheStatus({ 
          updatedAt: d.updatedAt, 
          totalItems: count,
          status: 'synced'
        });
      }
      
      await loadData();
      toast(`Cache atualizado: ${count} stories ativos.`, "success");
    } catch (err) {
      console.error(err);
      toast("Falha ao regenerar cache.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (story: StoryShop) => {
    if (!story.id) return;
    try {
      const newActive = !story.active;
      await storyShopService.updateStory(story.id, { active: newActive });
      await storyShopCacheService.scheduleStoryShopRegeneration('toggle_active');
      toast(newActive ? "Story ativado!" : "Story inativado!");
      loadData();
    } catch (err) {
      console.error(err);
      toast("Erro ao alterar status.", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm({ title: "Excluir Story?", message: "Esta ação é irreversível e removerá o vídeo da vitrine." })) {
      setLoading(true);
      try {
        await storyShopService.deleteStory(id);
        await storyShopCacheService.scheduleStoryShopRegeneration('admin_delete');
        toast("Story excluído!", "success");
        await loadData();
      } catch (err) {
        console.error(err);
        toast("Erro ao excluir", "error");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="p-6 md:p-10 bg-black min-h-screen text-zinc-100">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-10 pb-6 border-b border-zinc-900">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Film className="text-purple-500" size={28} />
            VITRINE STORY SHOP
          </h1>
          <p className="text-sm text-zinc-400 mt-1.5 max-w-xl">
            Gerencie stories curtos e provadores interativos vinculados aos produtos para exibição elegante com rolagem horizontal na página inicial da Boutique.
          </p>
        </div>

        {!isFormOpen && (
          <div className="flex flex-wrap items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleRegenerate}
              disabled={loading}
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 font-bold"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Regenerar Cache
            </Button>
            <Button 
              onClick={() => { setEditingStory(null); setIsFormOpen(true); }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold flex items-center gap-2 shadow-[0_4px_12px_rgba(147,51,234,0.3)]"
            >
              <Plus size={18} />
              Novo Story
            </Button>
          </div>
        )}

        {isFormOpen && (
          <Button 
            variant="outline" 
            onClick={() => setIsFormOpen(false)}
            className="border-zinc-800 text-zinc-400 hover:bg-zinc-900"
          >
            <ArrowLeft className="mr-2" size={16} />
            Voltar para Listagem
          </Button>
        )}
      </div>

      {/* CACHE METRICS INDICATOR BAR */}
      {!isFormOpen && cacheStatus && (
        <div className={`p-4 rounded-xl border mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
          cacheStatus.status === 'error' 
            ? 'bg-red-950/20 border-red-900/50 text-red-300' 
            : 'bg-zinc-950 border-zinc-900 text-zinc-400'
        }`}>
          <div className="flex items-center gap-3">
            {cacheStatus.status === 'error' ? (
              <AlertCircle size={22} className="text-red-500 shrink-0" />
            ) : (
              <CheckCircle size={22} className="text-green-500 shrink-0" />
            )}
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-zinc-400">Status do Cache Público (Homepage)</p>
              <p className="text-xs mt-0.5 font-medium leading-relaxed">
                {cacheStatus.errorMsg || `Cache sincronizado com sucesso: ${cacheStatus.totalItems} stories ativos gravados na Home.`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold shrink-0">
            <div>
              <span className="block text-zinc-500 text-[10px] uppercase">Última Atualização</span>
              <span className="text-zinc-300">
                {cacheStatus.updatedAt ? cacheStatus.updatedAt.toDate().toLocaleString() : 'Nunca'}
              </span>
            </div>
            {cacheStatus.status === 'error' && (
              <Button size="sm" onClick={handleRegenerate} className="bg-red-650 hover:bg-red-750 text-white font-extrabold text-[11px] py-1 h-7">
                Corrigir Cache
              </Button>
            )}
          </div>
        </div>
      )}

      {/* LOADING INDICATOR */}
      {loading && !isFormOpen && (
        <div className="text-center py-24 space-y-3">
          <RefreshCw className="animate-spin text-purple-500 mx-auto" size={40} />
          <p className="text-sm text-zinc-400 font-medium">Processando solicitações...</p>
        </div>
      )}

      {/* FORM AND LIST VIEWS */}
      {isFormOpen ? (
        <StoryShopForm 
          story={editingStory} 
          onClose={() => setIsFormOpen(false)} 
          onSaved={() => { setIsFormOpen(false); loadData(); }} 
        />
      ) : (
        !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {stories.length === 0 ? (
              <div className="col-span-full text-center py-20 bg-zinc-950 border border-zinc-900 rounded-2xl p-10">
                <HelpCircle className="text-zinc-600 mx-auto mb-4" size={42} />
                <h3 className="font-bold text-white text-base">Nenhum Story Cadastrado</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-2">Adicione provadores ou vídeos inspiracionais de moda para turbinar as compras do seu e-commerce.</p>
                <Button 
                  onClick={() => setIsFormOpen(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs mt-6"
                >
                  Criar Primeiro Story
                </Button>
              </div>
            ) : (
              stories.map(story => {
                const isValid = !!(story.title && story.thumbnailUrl && story.videoUrl && story.productId);
                return (
                  <div 
                    key={story.id} 
                    className={`bg-zinc-950 border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 hover:border-zinc-800 ${
                      !story.active ? 'opacity-70 border-zinc-950' : 'border-zinc-900 shadow-xl'
                    }`}
                  >
                    
                    {/* Media preview */}
                    <div className="relative aspect-[9/14] bg-zinc-900 group">
                      <img 
                        src={story.thumbnailUrl} 
                        alt={story.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                      />

                      {/* Video Player Preview on hover (client request) */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                        <video 
                          src={story.videoUrl} 
                          muted 
                          playsInline 
                          preload="none" 
                          loop
                          className="absolute inset-0 w-full h-full object-cover z-0" 
                          onMouseOver={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                          onMouseOut={(e) => {
                            const vid = (e.target as HTMLVideoElement);
                            vid.pause();
                            vid.currentTime = 0;
                          }}
                        />
                        <div className="z-10 bg-black/60 backdrop-blur-md p-2.5 rounded-full pointer-events-none">
                          <Play size={16} className="text-white fill-white" />
                        </div>
                      </div>

                      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                        {story.active ? (
                          <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-green-900/90 text-green-300 rounded-full border border-green-800/50 bg-opacity-70 backdrop-blur-sm shadow-md">
                            Ativo
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700/50 bg-opacity-70 backdrop-blur-sm shadow-md">
                            Inativo
                          </span>
                        )}

                        {story.featured && (
                          <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-purple-900/90 text-purple-300 rounded-full border border-purple-800/50 bg-opacity-70 backdrop-blur-sm shadow-md">
                            Destaque
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-[10px] text-zinc-300 px-2 py-1 rounded-md border border-zinc-900/30 font-bold">
                        Ordem: {story.order}
                      </div>

                      {!isValid && (
                        <div className="absolute top-3 right-3 bg-red-650/90 text-white p-1 rounded border border-red-500" title="Informações obrigatórias ausentes. Não será indexado.">
                          <AlertCircle size={14} />
                        </div>
                      )}
                    </div>

                    {/* Metadata summary */}
                    <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1.5 min-w-0">
                        <h3 className="font-extrabold text-xs text-white truncate" title={story.title}>{story.title}</h3>
                        {story.description && (
                          <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">{story.description}</p>
                        )}
                      </div>

                      {/* Product display */}
                      <div className="p-2.5 bg-zinc-900 rounded-xl flex items-center gap-2 border border-zinc-900">
                        <ShoppingBag size={14} className="text-purple-400 shrink-0" />
                        <div className="min-w-0 pr-1">
                          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider leading-none">Vinculado:</p>
                          <p className="text-[11px] font-bold text-zinc-300 truncate mt-0.5">{story.productName || 'Não Encontrado'}</p>
                        </div>
                      </div>

                      {/* Analytics tags or dates */}
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Eye size={11} /> Views: {story.views || 0}
                        </span>
                        <span>
                          Clicks: {story.clicks || 0}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-900/60 shrink-0">
                        <Button 
                          variant="outline" 
                          onClick={() => handleToggleActive(story)}
                          className="border-zinc-800 text-zinc-400 hover:bg-zinc-900"
                          title="Alternar Status Ativo"
                        >
                          {story.active ? <ToggleRight className="text-green-500 h-4 w-4" /> : <ToggleLeft className="text-zinc-500 h-4 w-4" />}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => { setEditingStory(story); setIsFormOpen(true); }}
                          className="border-zinc-800 text-purple-400 hover:bg-zinc-900 font-bold"
                          title="Editar Detalhes"
                        >
                          <Edit2 size={13} />
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => story.id && handleDelete(story.id)}
                          className="border-zinc-800 text-red-400 hover:bg-zinc-900"
                          title="Excluir Story"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>

                    </div>

                  </div>
                );
              })
            )}
          </div>
        )
      )}

    </div>
  );
}
