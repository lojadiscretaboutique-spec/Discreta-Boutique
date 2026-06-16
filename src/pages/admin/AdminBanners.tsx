import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, addDoc, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../lib/firebase';
import { storage } from '../../lib/storage';
import { Plus, Trash2, X, Upload, Calendar, Image as ImageIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { cacheService } from '../../services/cacheService';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  createdAt?: any;
}

interface OfferBanner {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  active: boolean;
  startDate: string;
  endDate: string;
  createdAt?: any;
}

type TabType = 'main' | 'offers';

export function AdminBanners() {
  const { hasPermission } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('main');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offerBanners, setOfferBanners] = useState<OfferBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [bannerToEdit, setBannerToEdit] = useState<Banner | OfferBanner | null>(null);
  const { toast, confirm } = useFeedback();

  const canCreate = hasPermission('banners', 'criar');
  const canEdit = hasPermission('banners', 'editar');
  const canDelete = hasPermission('banners', 'excluir');
  
  // Form State (Shared for both, naming might vary)
  const [title, setTitle] = useState(''); // name for offers
  const [linkUrl, setLinkUrl] = useState('');
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
    const qMain = query(collection(db, 'banners'));
    const unsubscribeMain = onSnapshot(qMain, (snapshot) => {
      setBanners(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to banners:", error);
      setLoading(false);
    });

    const qOffer = query(collection(db, 'offer_banners'));
    const unsubscribeOffer = onSnapshot(qOffer, (snapshot) => {
      setOfferBanners(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as OfferBanner)));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to offer banners:", error);
      setLoading(false);
    });

    return () => {
      unsubscribeMain();
      unsubscribeOffer();
    };
  }, []);

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Excluir Banner',
      message: `Tem certeza que deseja apagar este banner?`,
      confirmText: 'Excluir',
      variant: 'danger'
    });

    if (ok) {
       try {
         const collectionName = activeTab === 'main' ? 'banners' : 'offer_banners';
         await deleteDoc(doc(db, collectionName, id));
         await cacheService.notifyChange();
         loadData();
         toast("Banner removido com sucesso!");
       } catch {
         toast("Erro ao excluir banner.", 'error');
       }
     }
   };
 
   const toggleStatus = async (id: string, currentStatus: boolean) => {
     const collectionName = activeTab === 'main' ? 'banners' : 'offer_banners';
     await updateDoc(doc(db, collectionName, id), { active: !currentStatus });
     await cacheService.notifyChange();
     loadData();
   };

  const startEdit = (banner: Banner | OfferBanner) => {
    setBannerToEdit(banner);
    setTitle((banner as any).title || (banner as any).name);
    setLinkUrl(banner.linkUrl);
    if ('startDate' in banner) {
       setStartDate(banner.startDate ? banner.startDate.split('.')[0] : '');
       setEndDate(banner.endDate ? banner.endDate.split('.')[0] : '');
    }
    setIsActive(banner.active);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile && !bannerToEdit) {
      toast("Selecione uma imagem para o banner!", 'warning');
      return;
    }
    
    setSubmitting(true);
    try {
      let imageUrl = bannerToEdit ? bannerToEdit.imageUrl : '';
      
      if (imageFile) {
        const processImageToSquareWebP = async (file: File): Promise<File> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const maxSize = 1200; 
              let size = Math.max(img.width, img.height);
              let scale = 1;
              if (size > maxSize) {
                scale = maxSize / size;
                size = maxSize;
              }
              
              const canvas = document.createElement('canvas');
              canvas.width = size;
              canvas.height = size;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject('No canvas context');

              ctx.clearRect(0, 0, size, size);

              const targetW = img.width * scale;
              const targetH = img.height * scale;
              const dx = (size - targetW) / 2;
              const dy = (size - targetH) / 2;
              
              ctx.drawImage(img, dx, dy, targetW, targetH);

              canvas.toBlob((blob) => {
                if (!blob) return reject('Blob creation failed');
                resolve(new File([blob], `${file.name.split('.')[0]}_square.webp`, { type: 'image/webp' }));
              }, 'image/webp', 0.92);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
          });
        };

        const optimizedFile = await processImageToSquareWebP(imageFile);

        const path = activeTab === 'main' ? 'banners' : 'offer_banners';
        const fileRef = ref(storage, `${path}/${Date.now()}_${optimizedFile.name}`);
        await uploadBytes(fileRef, optimizedFile);
        imageUrl = await getDownloadURL(fileRef);
      }

      const collectionName = activeTab === 'main' ? 'banners' : 'offer_banners';
      const data = activeTab === 'main' ? {
        title,
        linkUrl,
        imageUrl,
        active: isActive,
      } : {
        name: title || "",
        linkUrl: linkUrl || "",
        imageUrl,
        active: !!isActive,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      };

      if (bannerToEdit) {
        await updateDoc(doc(db, collectionName, bannerToEdit.id), { ...data, updatedAt: serverTimestamp() });
        await cacheService.notifyChange();
        toast("Banner atualizado com sucesso!");
      } else {
        await addDoc(collection(db, collectionName), { ...data, createdAt: serverTimestamp() });
        await cacheService.notifyChange();
        toast("Banner salvo com sucesso!");
      }
      
      setShowForm(false);
      resetForm();
      loadData();
    } catch(err) {
      console.error(err);
      toast("Erro ao salvar banner", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setLinkUrl('');
    setStartDate('');
    setEndDate('');
    setImageFile(null);
    setIsActive(true);
    setBannerToEdit(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 italic tracking-tighter uppercase">Gestão de Banners</h1>
          <p className="text-xs text-slate-400 font-medium">Configure as vitrines promocionais da sua loja</p>
        </div>
        
        {!showForm && canCreate && (
          <Button className="bg-red-600 hover:bg-red-700 text-white font-bold px-6" onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" /> Novo {activeTab === 'main' ? 'Banner Principal' : 'Banner de Oferta'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      {!showForm && (
        <div className="flex border-b border-white/5 gap-4">
          <button 
            onClick={() => setActiveTab('main')}
            className={cn(
              "pb-3 px-1 text-sm font-black uppercase tracking-[2px] transition-all relative",
              activeTab === 'main' ? "text-red-500" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Banners Principais
            {activeTab === 'main' && <motion.div layoutId="banner-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]" />}
          </button>
          <button 
            onClick={() => setActiveTab('offers')}
            className={cn(
              "pb-3 px-1 text-sm font-black uppercase tracking-[2px] transition-all relative",
              activeTab === 'offers' ? "text-red-500" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Ofertas do Dia
            {activeTab === 'offers' && <motion.div layoutId="banner-tab" className="absolute bottom-0 left-0 right-0 h-1 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]" />}
          </button>
        </div>
      )}

      {showForm && (
        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-white/5 p-6 md:p-10 mb-6 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
          
          <div className="flex justify-between items-center mb-8">
             <h2 className="text-2xl font-black italic uppercase tracking-tighter">
               {activeTab === 'main' ? 'Cadastrar Banner topo' : 'Cadastrar Banner Oferta do Dia'}
             </h2>
             <button onClick={() => { setShowForm(false); resetForm(); }} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
               <X size={20}/>
             </button>
          </div>
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Título / Nome *</label>
                 <Input 
                   value={title} 
                   onChange={e=>setTitle(e.target.value)} 
                   placeholder={activeTab === 'main' ? "Ex: Lançamentos de Outono" : "Ex: Oferta Relâmpago"}
                   className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl"
                   required
                 />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Link de Destino</label>
                 <Input 
                   value={linkUrl} 
                   onChange={e=>setLinkUrl(e.target.value)} 
                   placeholder="/catalogo" 
                   className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl"
                 />
               </div>

               {activeTab === 'offers' && (
                 <>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Data Início</label>
                     <div className="relative">
                       <Input 
                         type="datetime-local"
                         value={startDate} 
                         onChange={e=>setStartDate(e.target.value)} 
                         className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl block w-full pl-10"
                       />
                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                     </div>
                   </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">Data Fim</label>
                     <div className="relative">
                       <Input 
                         type="datetime-local"
                         value={endDate} 
                         onChange={e=>setEndDate(e.target.value)} 
                         className="bg-slate-950 border-white/5 h-12 focus:border-red-600/50 transition-all rounded-xl block w-full pl-10"
                       />
                       <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                     </div>
                   </div>
                 </>
               )}
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[2px] text-slate-500 ml-1">
                Imagem do Banner * (Será convertida automaticamente para quadrada 1:1)
              </label>
              <div className="relative border-2 border-dashed border-white/10 rounded-2xl p-8 transition-all hover:border-red-600/50 group/upload bg-slate-950/50">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="banner-image"
                />
                <label htmlFor="banner-image" className="cursor-pointer flex flex-col items-center gap-4 text-slate-500 group-hover/upload:text-red-500 transition-all">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center group-hover/upload:bg-red-500/10 transition-all">
                    <Upload size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm uppercase tracking-wide">{imageFile ? imageFile.name : (bannerToEdit ? 'Manter imagem atual' : 'Clique para selecionar')}</p>
                    <p className="text-xs opacity-50 mt-1">Formatos aceitos: JPG, PNG, WebP</p>
                  </div>
                </label>
              </div>
              <p className="text-[10px] text-slate-500 italic mt-2">* Imagens serão convertidas para WebP com qualidade otimizada para celular conforme solicitado.</p>
            </div>
            
            <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl">
              <input 
                type="checkbox" 
                id="active" 
                checked={isActive} 
                onChange={e=>setIsActive(e.target.checked)} 
                className="w-5 h-5 text-red-600 bg-slate-950 border-white/10 rounded-lg focus:ring-red-600 focus:ring-offset-slate-900" 
              />
              <label htmlFor="active" className="text-xs font-black uppercase tracking-[1px] text-zinc-300">Banner Visível na Loja</label>
            </div>
            
            <div className="flex justify-end gap-3 pt-6 border-t border-white/5">
               <Button type="button" variant="ghost" onClick={() => setShowForm(false)} className="uppercase text-xs font-black tracking-widest text-slate-500">Cancelar</Button>
               <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700 font-bold px-10 h-12 uppercase tracking-widest shadow-lg shadow-red-600/20">
                 {submitting ? 'Processando e Enviando...' : 'Salvar Banner'}
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
        ) : (activeTab === 'main' ? banners : offerBanners).length === 0 ? (
             <div className="p-20 text-center flex flex-col items-center gap-4">
               <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-700">
                 <ImageIcon size={32} />
               </div>
               <div>
                  <h3 className="font-bold text-slate-300">Nenhum banner cadastrado</h3>
                  <p className="text-xs text-slate-500 mt-1">Comece criando o primeiro banner clicando no botão acima.</p>
               </div>
             </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-8">
            {(activeTab === 'main' ? banners : offerBanners).map((item) => (
              <div key={item.id} className="group border border-white/5 rounded-3xl overflow-hidden shadow-sm relative bg-slate-950 flex flex-col transition-all hover:shadow-2xl hover:border-red-600/30">
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img 
                    src={item.imageUrl} 
                    alt={(item as any).title || (item as any).name} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity"></div>
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 left-4">
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                      item.active 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                        : "bg-red-500/10 border-red-500/20 text-red-500"
                    )}>
                      {item.active ? 'Ativo' : 'Inativo'}
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
                          <ImageIcon size={16} />
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
                        onClick={() => handleDelete(item.id)}
                        className="w-9 h-9 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center text-slate-100 hover:bg-red-600 transition-all border border-white/10"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-3">
                   <div className="space-y-1">
                      <h3 className="font-black italic uppercase tracking-tighter text-lg leading-tight line-clamp-1">
                        {(item as any).title || (item as any).name}
                      </h3>
                      {item.linkUrl && (
                        <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                          <Plus size={10} /> {item.linkUrl}
                        </p>
                      )}
                   </div>

                   {activeTab === 'offers' && (
                     <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <div className="space-y-0.5">
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Início</span>
                           <p className="text-[10px] font-medium text-slate-300">
                             {(item as any).startDate ? new Date((item as any).startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                           </p>
                        </div>
                        <div className="space-y-0.5">
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Fim</span>
                           <p className="text-[10px] font-medium text-slate-300">
                             {(item as any).endDate ? new Date((item as any).endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                           </p>
                        </div>
                     </div>
                   )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {!showForm && !loading && (
        <div className="bg-red-600/5 border border-red-600/20 p-6 rounded-3xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-red-600/10 flex items-center justify-center text-red-600 shrink-0">
             <Calendar size={20} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-black uppercase tracking-[1px] text-slate-300">Dica de Gestão</h4>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              {activeTab === 'main' 
                ? "Os banners principais são os primeiros elementos que seus clientes veem. Use imagens horizontais de alta qualidade. Eles serão rotacionados automaticamente na página inicial."
                : "Os banners de oferta do dia aparecem logo abaixo das categorias. São ideais para promoções rápidas. Se você definir datas de início e fim, o sistema os exibirá automaticamente apenas durante esse período."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
