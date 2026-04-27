import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { Plus, Trash2, X, Upload } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  active: boolean;
  order: number;
}

export function AdminBanners() {
  const { hasPermission } = useAuthStore();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { toast, confirm } = useFeedback();

  const canCreate = hasPermission('banners', 'criar');
  const canEdit = hasPermission('banners', 'editar');
  const canDelete = hasPermission('banners', 'excluir');
  
  // Form State
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'banners'));
      const snap = await getDocs(q);
      setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
        await deleteDoc(doc(db, 'banners', id));
        loadData();
        toast("Banner removido com sucesso!");
      } catch {
        toast("Erro ao excluir banner.", 'error');
      }
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    await updateDoc(doc(db, 'banners', id), { active: !currentStatus });
    loadData();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      toast("Selecione uma imagem para o banner!", 'warning');
      return;
    }
    
    setSubmitting(true);
    try {
      const fileRef = ref(storage, `banners/${Date.now()}_${imageFile.name}`);
      await uploadBytes(fileRef, imageFile);
      const imageUrl = await getDownloadURL(fileRef);

      await addDoc(collection(db, 'banners'), {
        title,
        linkUrl,
        imageUrl,
        active: isActive,
        createdAt: serverTimestamp()
      });
      
      setShowForm(false);
      setTitle('');
      setLinkUrl('');
      setImageFile(null);
      setIsActive(true);
      loadData();
      toast("Banner salvo com sucesso!");
    } catch(err) {
      console.error(err);
      toast("Erro ao salvar banner", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-100">Banners</h1>
        {!showForm && canCreate && (
          <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" /> Novo Banner
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-900 rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold">Cadastrar Banner</h2>
             <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-100"><X size={20}/></button>
          </div>
          
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                 <label className="block text-sm font-medium mb-1">Título (Opcional)</label>
                 <Input value={title} onChange={e=>setTitle(e.target.value)} />
               </div>
               <div>
                 <label className="block text-sm font-medium mb-1">Link de Destino (Opcional)</label>
                 <Input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="/catalogo" />
               </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Imagem do Banner * (Recomendado: 1200x400)</label>
              <div className="border-2 border-dashed border-slate-600 rounded-md p-6 flex flex-col items-center justify-center">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                  className="hidden"
                  id="banner-image"
                />
                <label htmlFor="banner-image" className="cursor-pointer flex flex-col items-center gap-2 text-slate-400 hover:text-red-600 transition-colors">
                  <Upload size={32} />
                  <span>{imageFile ? imageFile.name : 'Clique para selecionar uma imagem'}</span>
                </label>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="active" checked={isActive} onChange={e=>setIsActive(e.target.checked)} className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-600" />
              <label htmlFor="active" className="text-sm font-medium">Banner Ativo</label>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
               <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
               <Button type="submit" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar Banner'}</Button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
             <div className="p-8 text-center text-slate-400">Carregando banners...</div>
        ) : banners.length === 0 ? (
             <div className="p-12 text-center text-slate-400">Nenhum banner cadastrado.</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 p-6">
            {banners.map((banner) => (
              <div key={banner.id} className="border rounded-xl overflow-hidden shadow-sm relative group">
                <img src={banner.imageUrl} alt={banner.title} className="w-full h-48 md:h-64 object-cover" />
                <div className="absolute top-4 right-4 flex gap-2">
                  {canEdit && (
                    <Button 
                      variant={banner.active ? "default" : "outline"}
                      size="sm"
                      className={banner.active ? "bg-green-600 hover:bg-green-700" : "bg-slate-900"}
                      onClick={() => toggleStatus(banner.id, banner.active)}
                    >
                      {banner.active ? 'Ativo' : 'Inativo'}
                    </Button>
                  )}
                  {canDelete && (
                    <Button 
                      size="icon" 
                      className="bg-slate-900 text-red-600 hover:bg-red-50 border border-slate-700"
                      onClick={() => handleDelete(banner.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                  {!canEdit && !canDelete && (
                    <span className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">Visualização</span>
                  )}
                </div>
                {(banner.title || banner.linkUrl) && (
                  <div className="bg-black/80 backdrop-blur-sm text-white p-4 absolute bottom-0 w-full left-0">
                    {banner.title && <h3 className="font-bold">{banner.title}</h3>}
                    {banner.linkUrl && <p className="text-xs text-gray-300">Link: {banner.linkUrl}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
