import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, addDoc, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../../lib/firebase';
import { Plus, Trash2, X, Upload, Calendar, Link as LinkIcon, Eye, MousePointer, Tag } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { useAuthStore } from '../../../store/authStore';
import { cn } from '../../../lib/utils';

interface PopupBanner {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  actionType?: 'link' | 'coupon';
  couponCode?: string;
  active: boolean;
  startDate: string;
  endDate: string;
  clickCount: number;
  createdAt?: any;
}

export function AdminPopups() {
  const { hasPermission } = useAuthStore();
  const [popups, setPopups] = useState<PopupBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [popupToEdit, setPopupToEdit] = useState<PopupBanner | null>(null);
  const { toast, confirm } = useFeedback();

  const canCreate = hasPermission('banners', 'criar');
  const canEdit = hasPermission('banners', 'editar');
  const canDelete = hasPermission('banners', 'excluir');

  // Form State
  const [name, setName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [actionType, setActionType] = useState<'link' | 'coupon'>('link');
  const [couponCode, setCouponCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    // No-op because we listen to Firestore onSnapshot live!
  };

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'popups'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => {
        const docData = d.data();
        return {
          id: d.id,
          name: docData.name || '',
          imageUrl: docData.imageUrl || '',
          linkUrl: docData.linkUrl || '',
          actionType: docData.actionType || 'link',
          couponCode: docData.couponCode || '',
          active: docData.active ?? true,
          startDate: docData.startDate || '',
          endDate: docData.endDate || '',
          clickCount: docData.clickCount || 0,
          createdAt: docData.createdAt
        } as PopupBanner;
      });
      setPopups(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to popups:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: 'Excluir Popup',
      message: `Tem certeza que deseja remover o popup "${name}"?`,
      confirmText: 'Excluir',
      variant: 'danger'
    });

    if (ok) {
      try {
        await deleteDoc(doc(db, 'popups', id));
        loadData();
        toast("Popup removido com sucesso!");
      } catch {
        toast("Erro ao excluir popup.", 'error');
      }
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'popups', id), { active: !currentStatus });
      toast(`Popup ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
      loadData();
    } catch {
      toast("Erro ao atualizar status do popup.", 'error');
    }
  };

  const startEdit = (popup: PopupBanner) => {
    setPopupToEdit(popup);
    setName(popup.name);
    setLinkUrl(popup.linkUrl || '');
    setActionType(popup.actionType || 'link');
    setCouponCode(popup.couponCode || '');
    setStartDate(popup.startDate ? popup.startDate.split('.')[0] : '');
    setEndDate(popup.endDate ? popup.endDate.split('.')[0] : '');
    setIsActive(popup.active);
    setShowForm(true);
  };

  const processImageToMobileWebP = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Reduz a dimensão máxima para 800px mantendo o aspect ratio original (perfeito para popups verticais ou horizontais)
        const maxDim = 800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) return reject('Blob creation failed');
          resolve(new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}_mobile.webp`, { type: 'image/webp' }));
        }, 'image/webp', 0.85); // Qualidade balanceada (85%) para carregamento instantâneo em dados móveis
      };
      img.onerror = () => reject('Image load failed');
      img.src = URL.createObjectURL(file);
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile && !popupToEdit) {
      toast("Selecione uma imagem para o popup!", 'warning');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl = popupToEdit ? popupToEdit.imageUrl : '';

      if (imageFile) {
        // Otimizar imagem para celular
        const optimizedFile = await processImageToMobileWebP(imageFile);
        const fileRef = ref(storage, `popups/${Date.now()}_${optimizedFile.name}`);
        await uploadBytes(fileRef, optimizedFile);
        imageUrl = await getDownloadURL(fileRef);
      }

      const data = {
        name: name,
        linkUrl: actionType === 'link' ? (linkUrl || '') : '',
        actionType,
        couponCode: actionType === 'coupon' ? couponCode : '',
        imageUrl,
        active: isActive,
        startDate: startDate ? new Date(startDate).toISOString() : '',
        endDate: endDate ? new Date(endDate).toISOString() : '',
        clickCount: popupToEdit ? popupToEdit.clickCount : 0,
      };

      if (popupToEdit) {
        await updateDoc(doc(db, 'popups', popupToEdit.id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        toast("Popup atualizado com sucesso!");
      } else {
        await addDoc(collection(db, 'popups'), {
          ...data,
          createdAt: serverTimestamp()
        });
        toast("Popup criado com sucesso!");
      }

      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar popup", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setName('');
    setLinkUrl('');
    setActionType('link');
    setCouponCode('');
    setStartDate('');
    setEndDate('');
    setImageFile(null);
    setIsActive(true);
    setPopupToEdit(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 italic tracking-tighter uppercase">Gestão de Popups</h1>
          <p className="text-xs text-slate-400 font-medium">Banners interativos com abertura automática ao entrar no site</p>
        </div>

        {!showForm && canCreate && (
          <Button className="bg-red-600 hover:bg-red-700 text-white font-bold px-6" onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" /> Novo Banner Popup
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-white/5 p-6 md:p-10 mb-6 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>

          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">
              {popupToEdit ? 'Editar Popup Banner' : 'Cadastrar Banner Popup'}
            </h2>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Identificação / Nome Interno *</label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: PopUp Namorados - 15% OFF"
                  className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl text-white"
                  required
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Tipo de Ação / Clique</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActionType('link')}
                    className={cn(
                      "flex items-center justify-center gap-2 h-12 rounded-xl text-xs font-black uppercase tracking-wider border transition-all",
                      actionType === 'link'
                        ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/15"
                        : "bg-slate-950 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300"
                    )}
                  >
                    <LinkIcon size={14} /> Redirecionar para Link (URL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('coupon')}
                    className={cn(
                      "flex items-center justify-center gap-2 h-12 rounded-xl text-xs font-black uppercase tracking-wider border transition-all",
                      actionType === 'coupon'
                        ? "bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/15"
                        : "bg-slate-950 border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-300"
                    )}
                  >
                    <Tag size={14} /> Exibir Cupom para Copiar
                  </button>
                </div>
              </div>

              {actionType === 'link' ? (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Link de Redirecionamento</label>
                  <Input
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="Ex: /catalogo?categoria=lingeries"
                    className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl text-white"
                  />
                </div>
              ) : (
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Código do Cupom de Desconto *</label>
                  <Input
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="Ex: QUERO15"
                    className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl text-white"
                    required
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Data de Início da Campanha (Opcional)</label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl block w-full pl-10 text-white"
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Data de Fim da Campanha (Opcional)</label>
                <div className="relative">
                  <Input
                    type="datetime-local"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl block w-full pl-10 text-white"
                  />
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1 animate-pulse">
                Arte do Popup * (Convertido para Webp Mobile otimizado de carregamento rápido)
              </label>
              <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 transition-all hover:border-red-600/50 group/upload bg-slate-950/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="popup-image"
                />
                <label htmlFor="popup-image" className="cursor-pointer flex flex-col items-center gap-4 text-slate-500 group-hover/upload:text-red-500 transition-all">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center group-hover/upload:bg-red-500/10 transition-all">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm uppercase tracking-wide">
                      {imageFile ? imageFile.name : (popupToEdit ? 'Substituir arte atual' : 'Selecione a imagem do Popup')}
                    </p>
                    <p className="text-xs opacity-50 mt-1">Sugerido formato retangular vertical (ex: 800x1200px) ou quadrado</p>
                  </div>
                </label>
              </div>
              <p className="text-[10px] text-slate-500 italic mt-2">
                * O algoritmo de compressão Discreta reduzirá automaticamente as dimensões para no máximo 800px no maior lado e converterá para o ultra-leve formato WebP. Sua loja abre rápido até em dados móveis 3G ruins!
              </p>
            </div>

            <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl">
              <input
                type="checkbox"
                id="active"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-5 h-5 text-red-600 bg-slate-950 border-white/10 rounded-lg focus:ring-red-600 focus:ring-offset-slate-900"
              />
              <label htmlFor="active" className="text-xs font-black uppercase tracking-[1px] text-zinc-300">Popup Ativo nas páginas do cliente</label>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="uppercase text-xs font-black tracking-widest text-slate-500">Cancelar</Button>
              <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700 font-bold px-10 h-12 uppercase tracking-widest shadow-lg shadow-red-600/20">
                {submitting ? 'Processando e Enviando...' : 'Salvar Popup'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* List Area */}
      <div className={cn("bg-slate-900 rounded-3xl border border-white/5 overflow-hidden shadow-2xl", showForm && "opacity-50 pointer-events-none")}>
        {loading ? (
          <div className="p-20 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[4px] text-slate-500">Carregando...</p>
          </div>
        ) : popups.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-700">
              <Upload size={32} />
            </div>
            <div>
              <h3 className="font-bold text-slate-300">Nenhum popup cadastrado</h3>
              <p className="text-xs text-slate-500 mt-1">Crie seu primeiro banner promocional interativo clicando acima.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8">
            {popups.map((item) => {
              const endsInDate = item.endDate ? new Date(item.endDate) : null;
              const isPast = endsInDate ? endsInDate < new Date() : false;

              return (
                <div key={item.id} className="group border border-white/5 rounded-3xl overflow-hidden shadow-sm relative bg-slate-950 flex flex-col transition-all hover:shadow-2xl hover:border-red-600/30">
                  <div className="relative aspect-[3/4] bg-slate-900 border-b border-white/5 overflow-hidden flex items-center justify-center">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="max-h-full max-w-full object-contain transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-85 transition-opacity"></div>

                    {/* Status Badge */}
                    <div className="absolute top-4 left-4 flex flex-col gap-1.5 z-10">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                        (item.active && !isPast)
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                          : "bg-red-500/10 border-red-500/20 text-red-500"
                      )}>
                        {(!item.active) ? 'Inativo' : isPast ? 'Expirado' : 'Campanha Ativa'}
                      </span>
                      <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border bg-slate-950/80 border-white/10 text-slate-300 w-max">
                        {item.actionType === 'coupon' ? '🎯 Cupom' : '🔗 Link'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all translate-y-[-10px] group-hover:translate-y-0">
                      {canEdit && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(item)}
                            className="w-9 h-9 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-slate-100 hover:bg-zinc-800 transition-all border border-white/10"
                            title="Editar"
                          >
                            <Calendar size={16} />
                          </button>
                          <button
                            onClick={() => toggleStatus(item.id, item.active)}
                            className={cn(
                              "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                              item.active ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
                            )}
                            title={item.active ? "Desativar" : "Ativar"}
                          >
                            {item.active ? <X size={16} /> : <Plus size={16} />}
                          </button>
                        </div>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="w-9 h-9 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-slate-100 hover:bg-red-600 transition-all border border-white/10"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="space-y-1">
                      <h3 className="font-black italic uppercase tracking-tighter text-lg leading-tight line-clamp-1 text-slate-100">
                        {item.name}
                      </h3>
                      {item.actionType === 'coupon' ? (
                        <p className="text-[10px] font-bold text-red-500 flex items-center gap-1.5 uppercase tracking-wider">
                          <Tag size={10} className="shrink-0 animate-pulse text-red-500" /> Cupom: <span className="underline font-black bg-red-600/10 px-1.5 py-0.5 rounded text-white">{item.couponCode}</span>
                        </p>
                      ) : item.linkUrl ? (
                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 break-all">
                          <LinkIcon size={10} className="text-red-500 shrink-0" /> {item.linkUrl}
                        </p>
                      ) : (
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest italic">
                          Sem Link de Redirecionamento
                        </p>
                      )}
                    </div>

                    {/* Stats Widget */}
                    <div className="bg-slate-900/60 border border-white/5 p-3 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-red-600/10 text-red-500">
                          <MousePointer size={14} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total de Cliques:</span>
                      </div>
                      <span className="text-lg font-black text-white italic">
                        {item.clickCount}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <div className="space-y-0.5 text-left">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Mostrar de</span>
                        <p className="text-[10px] font-bold text-slate-300">
                          {item.startDate ? new Date(item.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Imediato'}
                        </p>
                      </div>
                      <div className="space-y-0.5 text-left">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Mostrar até</span>
                        <p className="text-[10px] font-bold text-slate-300">
                          {item.endDate ? new Date(item.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Indeterminado'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!showForm && !loading && (
        <div className="bg-red-600/5 border border-red-600/20 p-6 rounded-3xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-600/10 flex items-center justify-center text-red-600 shrink-0">
            <Eye size={20} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black uppercase tracking-[1px] text-slate-300 font-sans">Como funcionam os popups?</h4>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl text-left">
              Os popup banners aparecem de modo não intrusivo para os visitantes do site 3 segundos após a página abrir. Para evitar inconvenientes e poluição visual, o sistema exibe apenas 1 popup de maior prioridade por sessão do usuário e não repete a exibição caso este tenha sido fechado pelo visitante. O formulário acima possui algoritmos de autocompressionamento de pixels, otimizando seu carregamento mesmo em instabilidade de tráfego móvel.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
