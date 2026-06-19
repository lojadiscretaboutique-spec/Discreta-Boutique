import { useState, useEffect, useRef } from 'react';
import { db } from '../../../../lib/firebase';
import { collection, query, getDocs, Timestamp } from 'firebase/firestore';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { StoryShop } from '../../../../types/storyShop';
import { Product } from '../../../../services/productService';
import { storyShopService } from '../../../../server/services/storyShopService';
import { storyShopCacheService } from '../../../../server/services/storyShopCacheService';
import { useFeedback } from '../../../../contexts/FeedbackContext';
import { Search, Globe, Video, Image as ImageIcon, Sparkles, Check, Play, AlertCircle, Calendar, UploadCloud, FileVideo, AlertTriangle, RefreshCw, Layers } from 'lucide-react';
import { validateStoryVideo, generateVideoThumbnailWebP, VideoValidationResult } from '../../../../utils/storyVideoUtils';
import { doc } from 'firebase/firestore';

interface Props {
  story: StoryShop | null;
  onClose: () => void;
  onSaved: () => void;
}

export function isDirectMp4Url(url: string): boolean {
  if (!url) return false;
  const cleanUrl = url.trim().toLowerCase();
  
  // Check if it's a Cloudinary video upload link
  if (cleanUrl.includes('/video/upload/')) return true;
  
  // Check if it ends with .mp4 or contains .mp4 before query params
  const urlWithoutQuery = cleanUrl.split('?')[0];
  if (urlWithoutQuery.endsWith('.mp4')) return true;
  
  return false;
}

const compressToWebP = (file: File, maxWidth = 480, quality = 0.82): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, 'image/webp', quality);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export function StoryShopForm({ story, onClose, onSaved }: Props) {
  const storyIdRef = useRef<string>(story?.id || '');
  
  // Stable StoryId generation for new items to match storage buckets safely
  useEffect(() => {
    if (!storyIdRef.current) {
      storyIdRef.current = doc(collection(db, 'story_shop')).id;
    }
  }, []);

  const [formData, setFormData] = useState<Partial<StoryShop>>({
    title: '',
    description: '',
    productId: '',
    thumbnailUrl: '',
    videoUrl: '',
    order: 0,
    active: true,
    featured: false,
    tags: [],
    videoSource: story?.videoSource || 'url',
    videoStoragePath: story?.videoStoragePath || null,
    thumbnailSource: story?.thumbnailSource || 'url',
    thumbnailStoragePath: story?.thumbnailStoragePath || null,
  });

  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [tagInput, setTagInput] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searching, setSearching] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Video Origin toggle ('url' or 'upload')
  const [videoOrigin, setVideoOrigin] = useState<'url' | 'upload'>(
    story?.videoSource === 'firebase_storage' ? 'upload' : 'url'
  );

  // Browser video processing & upload states
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoValidation, setVideoValidation] = useState<VideoValidationResult | null>(null);
  const [isGeneratingThumb, setIsGeneratingThumb] = useState(false);
  const [generatedThumbBlob, setGeneratedThumbBlob] = useState<Blob | null>(null);
  const [generatedThumbUrl, setGeneratedThumbUrl] = useState<string | null>(null);
  const [selectedSeekTime, setSelectedSeekTime] = useState<number>(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Video Testing Preview state
  const [testUrl, setTestUrl] = useState('');
  const [videoTestStatus, setVideoTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [videoTestMsg, setVideoTestMsg] = useState('');
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const { toast } = useFeedback();

  useEffect(() => {
    if (story) {
      setFormData({
        title: story.title || '',
        description: story.description || '',
        productId: story.productId || '',
        thumbnailUrl: story.thumbnailUrl || '',
        videoUrl: story.videoUrl || '',
        order: story.order || 0,
        active: story.active ?? true,
        featured: story.featured ?? false,
        tags: story.tags || [],
        videoSource: story.videoSource || 'url',
        videoStoragePath: story.videoStoragePath || null,
        thumbnailSource: story.thumbnailSource || 'url',
        thumbnailStoragePath: story.thumbnailStoragePath || null,
      });
      setTagInput((story.tags || []).join(', '));

      const start = story.startDate instanceof Timestamp ? story.startDate.toDate() : new Date(story.startDate || Date.now());
      const end = story.endDate instanceof Timestamp ? story.endDate.toDate() : new Date(story.endDate || Date.now());
      setStartDateStr(start.toISOString().slice(0, 16));
      setEndDateStr(end.toISOString().slice(0, 16));

      // Attempt to load attached product if info is already cached
      if (story.productId) {
        setSelectedProduct({
          id: story.productId,
          name: story.productName || 'Produto Vinculado',
          sku: '',
          price: story.price || 0,
          promoPrice: story.promotionalPrice,
          hasVariants: story.hasVariants || false,
          stock: story.inStock ? 1 : 0,
          active: true,
          featured: false,
          newRelease: false,
          unit: 'un',
          controlStock: false,
          allowBackorder: true,
          images: story.productImageThumb ? [{ url: story.productImageThumb, path: '', isMain: true }] : [],
          seo: story.productSlug ? { slug: story.productSlug, condition: 'new' } : undefined,
          categoryId: '',
        } as any);
      }
    } else {
      const now = new Date();
      setStartDateStr(now.toISOString().slice(0, 16));
      const nextYear = new Date();
      nextYear.setFullYear(now.getFullYear() + 1);
      setEndDateStr(nextYear.toISOString().slice(0, 16));
    }
  }, [story]);

  const searchProducts = async () => {
    if (!productSearch.trim()) return;
    setSearching(true);
    try {
      const snap = await getDocs(query(collection(db, 'products')));
      const allProducts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const queryLower = productSearch.toLowerCase();
      
      const filtered = allProducts.filter(p => 
        p.name?.toLowerCase().includes(queryLower) || 
        p.sku?.toLowerCase().includes(queryLower) || 
        p.id?.toLowerCase().includes(queryLower) ||
        (p.internalCode && p.internalCode.toLowerCase().includes(queryLower))
      );
      setSearchResults(filtered.slice(0, 12));
    } catch (err) {
      console.error(err);
      toast("Erro ao buscar produtos.", "error");
    } finally {
      setSearching(false);
    }
  };

  const handleProductSelect = (p: Product) => {
    setSelectedProduct(p);
    setFormData(prev => ({ 
      ...prev, 
      productId: p.id,
    }));
    setSearchResults([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingImage(true);
    try {
      const compressedBlob = await compressToWebP(file, 480, 0.75);
      const convertedFile = new File([compressedBlob], `story_thumb_${Date.now()}.webp`, { type: 'image/webp' });
      
      const { ref: storageRef, uploadBytes, getDownloadURL, deleteObject } = await import('firebase/storage');
      const { storage } = await import('../../../../lib/storage');
      
      const storyId = storyIdRef.current;
      const timestamp = Date.now();
      const path = `story-shop/thumbnails/${storyId}/${timestamp}-thumb.webp`;
      const fileRef = storageRef(storage, path);
      
      await uploadBytes(fileRef, convertedFile);
      const downloadUrl = await getDownloadURL(fileRef);

      // Clean up previous thumbnail if it was storage-based
      if (
        formData.thumbnailSource === 'firebase_storage' && 
        formData.thumbnailStoragePath && 
        formData.thumbnailStoragePath.startsWith('story-shop/thumbnails/')
      ) {
         try {
           await deleteObject(storageRef(storage, formData.thumbnailStoragePath));
         } catch (storageErr) {
           console.warn("Could not delete old thumbnail:", storageErr);
         }
      }
      
      setFormData(prev => ({ 
        ...prev, 
        thumbnailUrl: downloadUrl,
        thumbnailSource: 'firebase_storage',
        thumbnailStoragePath: path
      }));
      toast("Thumbnail comprimida em WebP e salva!", "success");
    } catch (err) {
      console.error(err);
      toast("Falha ao subir imagem.", "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleVideoFile = async (file: File) => {
    toast("Analisando vídeo no navegador...", "info");
    const result = await validateStoryVideo(file);
    setVideoValidation(result);
    
    if (result.valid) {
      setSelectedVideoFile(file);
      toast("Vídeo validado!", "success");
      await extractThumbnail(file, 1);
    } else {
      setSelectedVideoFile(null);
      setVideoValidation(result);
      if (generatedThumbUrl) {
        URL.revokeObjectURL(generatedThumbUrl);
        setGeneratedThumbUrl(null);
      }
      setGeneratedThumbBlob(null);
      toast("Vídeo inválido. Verifique os erros apontados.", "error");
    }
  };

  const extractThumbnail = async (file: File, seekTime: number) => {
    setIsGeneratingThumb(true);
    try {
      const blob = await generateVideoThumbnailWebP(file, { seekTime });
      if (generatedThumbUrl) {
        URL.revokeObjectURL(generatedThumbUrl);
      }
      const previewUrl = URL.createObjectURL(blob);
      setGeneratedThumbBlob(blob);
      setGeneratedThumbUrl(previewUrl);
      setSelectedSeekTime(seekTime);
    } catch (err) {
      console.error(err);
      toast("Erro ao gerar thumbnail.", "error");
    } finally {
      setIsGeneratingThumb(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await handleVideoFile(file);
    }
  };

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (generatedThumbUrl) {
        URL.revokeObjectURL(generatedThumbUrl);
      }
    };
  }, [generatedThumbUrl]);

  const verifyAndTestVideo = () => {
    const url = formData.videoUrl;
    if (!url) {
      setVideoTestStatus('error');
      setVideoTestMsg("Insira uma URL primeiro.");
      return;
    }

    const cleanUrl = url.trim();
    setTestUrl(cleanUrl);
    setVideoTestStatus('testing');

    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') || cleanUrl.includes('drive.google.com')) {
      setVideoTestStatus('error');
      setVideoTestMsg("Este link não parece ser um MP4 público direto (YouTube/Drive detectado). Use um link direto .mp4, preferencialmente Cloudinary.");
      return;
    }

    if (!isDirectMp4Url(cleanUrl)) {
      setVideoTestStatus('error');
      setVideoTestMsg("Este link não possui extensão .mp4 ou marcações do Cloudinary (/video/upload/). Verifique e garanta que seja reproduzível.");
      return;
    }

    setVideoTestStatus('success');
    setVideoTestMsg("Excelente! Formato aceito. Verifique a prévia live abaixo.");
  };

  const handleSave = async () => {
    const isEditing = !!story?.id;

    if (!formData.title || !formData.productId) {
      toast("Por favor, preencha Título e Produto Vinculado.", "error");
      return;
    }

    if (videoOrigin === 'url') {
      if (!formData.videoUrl || !formData.thumbnailUrl) {
        toast("Por favor, informe a URL do Vídeo e da Thumbnail.", "error");
        return;
      }
    } else {
      if (!isEditing && (!selectedVideoFile || !generatedThumbBlob)) {
        toast("Por favor, faça upload de um vídeo válido para salvar.", "error");
        return;
      }
    }

    setIsSaving(true);
    try {
      let finalVideoUrl = formData.videoUrl || '';
      let finalVideoStoragePath = formData.videoStoragePath || null;
      let finalThumbnailUrl = formData.thumbnailUrl || '';
      let finalThumbnailStoragePath = formData.thumbnailStoragePath || null;

      const storyId = storyIdRef.current;

      const { ref: storageRef, uploadBytes, getDownloadURL, deleteObject } = await import('firebase/storage');
      const { storage } = await import('../../../../lib/storage');

      if (videoOrigin === 'upload' && selectedVideoFile && generatedThumbBlob) {
        const timestamp = Date.now();
        const safeFileName = selectedVideoFile.name.toLowerCase().replace(/[^a-z0-9.]/g, '-');

        // 1. Upload Video
        const videoPath = `story-shop/videos/${storyId}/${timestamp}-${safeFileName}`;
        const fileVideoRef = storageRef(storage, videoPath);

        toast("Subindo arquivo de vídeo ao Storage...", "info");
        await uploadBytes(fileVideoRef, selectedVideoFile);
        const uploadedVideoUrl = await getDownloadURL(fileVideoRef);

        // Delete old video if overwriting
        if (
          isEditing &&
          story?.videoSource === 'firebase_storage' &&
          story.videoStoragePath &&
          story.videoStoragePath.startsWith('story-shop/videos/')
        ) {
          try {
            await deleteObject(storageRef(storage, story.videoStoragePath));
            console.log(`Overwriting old video: ${story.videoStoragePath}`);
          } catch (storageErr) {
            console.warn("Could not delete old video:", storageErr);
          }
        }

        finalVideoUrl = uploadedVideoUrl;
        finalVideoStoragePath = videoPath;

        // 2. Upload generated WebP thumbnail
        const thumbPath = `story-shop/thumbnails/${storyId}/${timestamp}-thumb.webp`;
        const fileThumbRef = storageRef(storage, thumbPath);

        toast("Subindo thumbnail WebP gerada...", "info");
        await uploadBytes(fileThumbRef, generatedThumbBlob);
        const uploadedThumbUrl = await getDownloadURL(fileThumbRef);

        // Delete old thumbnail if overwriting
        if (
          isEditing &&
          story?.thumbnailSource === 'firebase_storage' &&
          story.thumbnailStoragePath &&
          story.thumbnailStoragePath.startsWith('story-shop/thumbnails/')
        ) {
          try {
            await deleteObject(storageRef(storage, story.thumbnailStoragePath));
            console.log(`Overwriting old thumbnail: ${story.thumbnailStoragePath}`);
          } catch (storageErr) {
            console.warn("Could not delete old thumbnail:", storageErr);
          }
        }

        finalThumbnailUrl = uploadedThumbUrl;
        finalThumbnailStoragePath = thumbPath;
      } else if (videoOrigin === 'url') {
        // If switched to url, cleanup old store-owned files to avoid orphan resources
        if (
          isEditing &&
          story?.videoSource === 'firebase_storage' &&
          story.videoStoragePath &&
          story.videoStoragePath.startsWith('story-shop/videos/')
        ) {
          try {
            await deleteObject(storageRef(storage, story.videoStoragePath));
          } catch (e) {
            console.warn("Could not delete video storage file upon switching to URL:", e);
          }
        }

        if (
          isEditing &&
          story?.thumbnailSource === 'firebase_storage' &&
          story.thumbnailStoragePath &&
          story.thumbnailStoragePath.startsWith('story-shop/thumbnails/')
        ) {
          try {
            await deleteObject(storageRef(storage, story.thumbnailStoragePath));
          } catch (e) {
            console.warn("Could not delete thumbnail storage file upon switching to URL:", e);
          }
        }

        finalVideoStoragePath = null;
        finalThumbnailStoragePath = null;
      }

      const tagsArray = tagInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const finalStoryData = {
        title: formData.title,
        description: formData.description || '',
        productId: formData.productId,
        thumbnailUrl: finalThumbnailUrl,
        videoUrl: finalVideoUrl,
        order: Number(formData.order) || 0,
        active: formData.active ?? true,
        featured: formData.featured ?? false,
        tags: tagsArray,
        startDate: Timestamp.fromDate(new Date(startDateStr)),
        endDate: Timestamp.fromDate(new Date(endDateStr)),
        views: story?.views || 0,
        clicks: story?.clicks || 0,

        // Cache the product data inside the story for zero-joins
        productName: selectedProduct?.name || null,
        productSlug: selectedProduct?.seo?.slug || selectedProduct?.id || null,
        productImageThumb: selectedProduct?.images?.[0]?.url || null,
        price: selectedProduct?.price || null,
        promotionalPrice: selectedProduct?.promoPrice || null,
        hasVariants: selectedProduct?.hasVariants || false,
        inStock: (selectedProduct?.stock !== undefined ? selectedProduct.stock > 0 : true),

        videoSource: videoOrigin === 'upload' ? 'firebase_storage' : 'url',
        videoStoragePath: videoOrigin === 'upload' ? finalVideoStoragePath : null,
        thumbnailSource: (videoOrigin === 'upload' || formData.thumbnailSource === 'firebase_storage') ? 'firebase_storage' : 'url',
        thumbnailStoragePath: (videoOrigin === 'upload' || formData.thumbnailSource === 'firebase_storage') ? finalThumbnailStoragePath : null,

        updatedAt: Timestamp.now(),
        createdAt: story?.id ? story.createdAt : Timestamp.now(),
      };

      if (story?.id) {
        await storyShopService.updateStory(story.id, finalStoryData);
        toast("Story editado com sucesso!", "success");
      } else {
        await storyShopService.createStory(finalStoryData as any);
        toast("Story criado com sucesso!", "success");
      }

      await storyShopCacheService.scheduleStoryShopRegeneration('story_saved');
      toast("Story salvo e cache agendado para atualização.");
      onSaved();
    } catch (e) {
      console.error(e);
      toast("Erro ao salvar o Story.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 md:p-8 max-w-4xl mx-auto shadow-2xl space-y-8 animate-fadeIn text-zinc-100">
      
      {/* Header Form */}
      <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="text-purple-500" size={20} />
            {story ? 'Editar Story' : 'Cadastrar Novo Story'}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">Insira os dados da vitrine estilo Reels/Tiktok para a Boutique.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Hand: Details & Fields */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">Título do Story *</label>
            <Input 
              placeholder="Ex: Provador Vestido Midi Decotado" 
              value={formData.title} 
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-600 focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">Breve Descrição</label>
            <textarea 
              rows={2}
              placeholder="Descreva detalhes ou adicione chamadas para ação..." 
              value={formData.description} 
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-800 text-sm p-3 rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          {/* Product selection search */}
          <div className="space-y-2 p-4 bg-zinc-900/50 border border-zinc-900 rounded-xl">
            <label className="text-xs font-bold text-purple-400 uppercase tracking-wider block flex items-center gap-2">
              <Search size={14} />
              Vincular Produto da Loja *
            </label>
            
            <div className="flex gap-2">
              <Input 
                placeholder="Busque por Nome, SKU ou código..." 
                value={productSearch} 
                onChange={e => setProductSearch(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-650"
              />
              <Button onClick={searchProducts} disabled={searching} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                Buscar
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-850 max-h-48 overflow-y-auto mt-2">
                {searchResults.map(p => (
                  <div 
                    key={p.id} 
                    className="p-3 text-xs flex justify-between items-center cursor-pointer hover:bg-zinc-800/80 transition-colors"
                    onClick={() => handleProductSelect(p)}
                  >
                    <div>
                      <p className="font-extrabold text-white">{p.name}</p>
                      <p className="text-[10px] text-zinc-500">SKU: {p.sku || 'N/D'}</p>
                    </div>
                    <span className="text-purple-400 font-extrabold">R$ {p.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedProduct && (
              <div className="mt-3 p-3 bg-zinc-900 border border-purple-950/40 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded overflow-hidden bg-zinc-950 border border-zinc-800">
                  <img 
                    src={selectedProduct.images?.[0]?.url || 'https://via.placeholder.com/100'} 
                    alt={selectedProduct.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{selectedProduct.name}</p>
                  <p className="text-[10px] text-zinc-400">Preço: R$ {selectedProduct.price?.toFixed(2)}</p>
                </div>
                <Check className="text-green-500" size={16} />
              </div>
            )}
          </div>

          {/* Start and end dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block flex items-center gap-1">
                <Calendar size={12} /> Começo
              </label>
              <input 
                type="datetime-local" 
                value={startDateStr}
                onChange={e => setStartDateStr(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block flex items-center gap-1">
                <Calendar size={12} /> Fim
              </label>
              <input 
                type="datetime-local" 
                value={endDateStr}
                onChange={e => setEndDateStr(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs p-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">Ordem Exibição</label>
              <Input 
                type="number" 
                value={formData.order} 
                onChange={e => setFormData({ ...formData, order: Number(e.target.value) })}
                className="bg-zinc-900 border-zinc-800 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">Tags (separadas por vírgula)</label>
              <Input 
                placeholder="ex: provador, verao, vestidos" 
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-white"
              />
            </div>
          </div>

          {/* Booleans Switches */}
          <div className="flex gap-6 items-center p-3 bg-zinc-900/30 border border-zinc-900 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={formData.active} 
                onChange={e => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 accent-purple-600 cursor-pointer"
              />
              <span className="text-xs font-semibold text-zinc-300">Ativo</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={formData.featured} 
                onChange={e => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 accent-purple-600 cursor-pointer"
              />
              <span className="text-xs font-semibold text-purple-400">Destaque na Vitrine</span>
            </label>
          </div>

        </div>

        {/* Right Hand: Thumbnail & Video Links, WebP compression, Live test */}
        <div className="space-y-6">
          {/* Segmented Controller for Video Origin Source */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Origem do Vídeo do Story</label>
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800/80">
              <button
                type="button"
                onClick={() => setVideoOrigin('url')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  videoOrigin === 'url' 
                    ? 'bg-purple-600 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                }`}
              >
                <Globe size={13} className={videoOrigin === 'url' ? 'text-white' : 'text-zinc-500'} />
                URL Externa
              </button>
              <button
                type="button"
                onClick={() => setVideoOrigin('upload')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all ${
                  videoOrigin === 'upload' 
                    ? 'bg-purple-600 text-white shadow-lg' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/50'
                }`}
              >
                <UploadCloud size={13} className={videoOrigin === 'upload' ? 'text-white' : 'text-zinc-500'} />
                Upload MP4 (Storage)
              </button>
            </div>
          </div>

          {/* ========================================================== */}
          {/* OPTION A: EXTERNAL URL */}
          {/* ========================================================== */}
          {videoOrigin === 'url' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Thumbnail Config */}
              <div className="space-y-3 p-4 bg-zinc-900/50 border border-zinc-900 rounded-2xl block relative">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon size={14} className="text-purple-500" />
                  Capa / Thumbnail (URL) *
                </label>
                
                <Input 
                  placeholder="Insira URL direta da imagem..." 
                  value={formData.thumbnailUrl} 
                  onChange={e => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-650"
                />

                <div className="relative text-center py-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-950/80">
                  <span className="text-[11px] text-zinc-400 block mb-2 font-medium">Ou suba WebP comprimido da máquina:</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                    id="thumbnail_upload_input"
                    className="hidden" 
                  />
                  <Button 
                    type="button"
                    onClick={() => document.getElementById('thumbnail_upload_input')?.click()}
                    disabled={uploadingImage}
                    className="bg-zinc-900 text-zinc-200 border border-zinc-800 hover:bg-zinc-800 active:scale-95 text-xs font-medium"
                  >
                    {uploadingImage ? "Processando..." : "Escolher arquivo de Imagem"}
                  </Button>
                </div>

                {formData.thumbnailUrl && (
                  <div className="mt-2 text-center">
                    <p className="text-[10px] text-zinc-500 mb-1">Prévia da Capa:</p>
                    <img src={formData.thumbnailUrl} className="w-24 h-32 object-cover rounded-xl mx-auto border border-zinc-800" />
                  </div>
                )}
              </div>

              {/* Video URL Config */}
              <div className="space-y-3 p-4 bg-zinc-900/50 border border-zinc-900 rounded-2xl block relative">
                <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                  <Video size={14} className="text-purple-500" />
                  URL do Vídeo (.mp4 ou Cloudinary) *
                </label>

                <Input 
                  placeholder="Ex: https://res.cloudinary.com/... ou outro .mp4" 
                  value={formData.videoUrl} 
                  onChange={e => setFormData({ ...formData, videoUrl: e.target.value })}
                  className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-650"
                />

                <div className="flex gap-2 justify-end">
                  <Button 
                    type="button"
                    onClick={verifyAndTestVideo} 
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
                  >
                    Testar Vídeo
                  </Button>
                </div>

                {videoTestStatus !== 'idle' && (
                  <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                    videoTestStatus === 'error' 
                      ? 'bg-red-950/20 border-red-900/50 text-red-400' 
                      : videoTestStatus === 'testing'
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      : 'bg-green-950/20 border-green-900/50 text-green-400'
                  }`}>
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <p className="leading-tight">{videoTestMsg}</p>
                  </div>
                )}

                {videoTestStatus === 'success' && testUrl && (
                  <div className="mt-4 p-3 border border-zinc-850 rounded-xl bg-black text-center">
                    <p className="text-[10px] text-zinc-500 mb-2">Reprodutor de Teste:</p>
                    <video 
                      ref={videoPreviewRef}
                      src={testUrl}
                      controls 
                      muted 
                      playsInline 
                      preload="metadata"
                      className="w-full aspect-[9/16] max-h-72 object-cover rounded-lg border border-zinc-800 mx-auto"
                      onError={() => {
                        setVideoTestStatus('error');
                        setVideoTestMsg("Vídeo não carregou. Verifique se a URL é pública e direta.");
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* OPTION B: STORAGE VIDEO UPLOAD */}
          {/* ========================================================== */}
          {videoOrigin === 'upload' && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Drag and Drop Container */}
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('video_upload_input')?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all duration-300 relative overflow-hidden ${
                  isDragOver 
                    ? 'border-purple-500 bg-purple-950/20 scale-[0.99] shadow-xl' 
                    : selectedVideoFile 
                    ? 'border-emerald-800 bg-zinc-900/40 hover:bg-zinc-900/60'
                    : 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900/30'
                }`}
              >
                <input 
                  type="file" 
                  accept="video/mp4" 
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleVideoFile(file);
                  }} 
                  id="video_upload_input"
                  className="hidden" 
                />
                
                {selectedVideoFile ? (
                  <div className="space-y-1">
                    <FileVideo size={36} className="mx-auto text-emerald-500" />
                    <p className="text-xs font-bold text-zinc-200 truncate max-w-xs mx-auto">{selectedVideoFile.name}</p>
                    <p className="text-[10px] text-zinc-500">{(selectedVideoFile.size / (1024 * 1024)).toFixed(2)} MB • Clique para alterar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <UploadCloud className="mx-auto text-purple-500" size={36} />
                    <div>
                      <p className="text-xs font-bold text-zinc-200">Escolha ou arraste o vídeo MP4</p>
                      <p className="text-[10px] text-zinc-500 mt-1 leading-normal max-w-xs mx-auto">
                        Tamanho máximo: <strong className="text-zinc-400">20 MB</strong> • Duração máxima: <strong className="text-zinc-400">30s</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Validation Results Display */}
              {videoValidation && (
                <div className={`p-4 rounded-xl border space-y-2.5 text-xs ${
                  videoValidation.valid 
                    ? 'bg-emerald-950/15 border-emerald-900/40 text-emerald-300' 
                    : 'bg-red-950/20 border-red-900/40 text-red-400'
                }`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    {videoValidation.valid ? (
                      <Check className="text-emerald-500 shrink-0" size={14} />
                    ) : (
                      <AlertTriangle className="text-red-500 shrink-0" size={14} />
                    )}
                    <span>Metadados do Vídeo no Navegador:</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300 border-t border-zinc-900/85 pt-2">
                    <div>Duração: <strong>{videoValidation.duration.toFixed(1)} segundos</strong></div>
                    <div>Tamanho: <strong>{videoValidation.sizeMB.toFixed(2)} MB</strong></div>
                    <div>Resolução: <strong>{videoValidation.width}x{videoValidation.height}</strong></div>
                    <div>Proporção: <strong>{videoValidation.height > videoValidation.width ? '9:16 (Vertical)' : '16:9 (Horizontal)'}</strong></div>
                  </div>

                  {/* Errors alerts */}
                  {videoValidation.errors.length > 0 && (
                    <div className="space-y-1 border-t border-red-950/40 pt-2 text-[11px] text-red-500 font-medium">
                      {videoValidation.errors.map((err, i) => (
                        <p key={i}>• {err}</p>
                      ))}
                    </div>
                  )}

                  {/* Warnings alerts */}
                  {videoValidation.warnings.length > 0 && (
                    <div className="space-y-1 border-s-2 border-yellow-700 ps-2 mt-2 text-[10.5px] text-yellow-500/90 leading-tight">
                      {videoValidation.warnings.map((warn, i) => (
                        <p key={i}>{warn}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AUTOMATIC COVER SELECTOR FROM VIDEO */}
              {selectedVideoFile && videoValidation?.valid && (
                <div className="p-4 bg-zinc-900/40 border border-zinc-900 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-purple-400 animate-spin" />
                      Extrair Capa do Vídeo
                    </span>
                    {isGeneratingThumb && (
                      <RefreshCw size={12} className="text-purple-500 animate-spin" />
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRegenerateThumb(1)}
                      disabled={isGeneratingThumb}
                      className={`flex-1 py-1 px-2 text-[10px] font-bold rounded border uppercase tracking-wider transition-all ${
                        selectedSeekTime === 1
                          ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Em 1s
                    </button>
                    {videoValidation.duration >= 3 && (
                      <button
                        type="button"
                        onClick={() => handleRegenerateThumb(3)}
                        disabled={isGeneratingThumb}
                        className={`flex-1 py-1 px-2 text-[10px] font-bold rounded border uppercase tracking-wider transition-all ${
                          selectedSeekTime === 3
                            ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        Em 3s
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRegenerateThumb(videoValidation.duration / 2)}
                      disabled={isGeneratingThumb}
                      className={`flex-1 py-1 px-2 text-[10px] font-bold rounded border uppercase tracking-wider transition-all ${
                        selectedSeekTime === videoValidation.duration / 2
                          ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      Meio ({(videoValidation.duration / 2).toFixed(1)}s)
                    </button>
                  </div>
                </div>
              )}

              {/* DUAL PREVIEW SECTION */}
              {(generatedThumbUrl || (story && videoOrigin === 'upload')) && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-900/60">
                  
                  {/* Capa Preview */}
                  <div className="text-center p-2.5 bg-zinc-900/20 border border-zinc-900 rounded-xl space-y-2">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Capa WebP</span>
                    <div className="aspect-[9/16] bg-zinc-950 rounded-lg overflow-hidden border border-zinc-850 flex items-center justify-center relative">
                      {isGeneratingThumb ? (
                        <div className="text-center p-2">
                          <RefreshCw size={18} className="text-purple-500 animate-spin mx-auto mb-2" />
                          <span className="text-[9px] text-zinc-500">Extraindo...</span>
                        </div>
                      ) : generatedThumbUrl ? (
                        <img 
                          src={generatedThumbUrl} 
                          alt="WebP Thumbnail" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <img 
                          src={formData.thumbnailUrl} 
                          alt="Current Thumb" 
                          className="w-full h-full object-cover" 
                        />
                      )}
                    </div>
                  </div>

                  {/* Player Preview */}
                  <div className="text-center p-2.5 bg-zinc-900/20 border border-zinc-900 rounded-xl space-y-2">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Reprodutor</span>
                    <div className="aspect-[9/16] bg-zinc-950 rounded-lg overflow-hidden border border-zinc-850 flex items-center justify-center relative">
                      {selectedVideoFile ? (
                        <video
                          src={URL.createObjectURL(selectedVideoFile)}
                          controls
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : formData.videoUrl ? (
                        <video
                          src={formData.videoUrl}
                          controls
                          muted
                          playsInline
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-zinc-500 p-3">Aguardando arquivo...</span>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-900">
        <Button 
          type="button"
          variant="outline" 
          onClick={onClose} 
          disabled={isSaving}
          className="border-zinc-800 text-zinc-400 hover:bg-zinc-900"
        >
          Cancelar
        </Button>
        <Button 
          type="button"
          onClick={handleSave} 
          disabled={isSaving || (videoOrigin === 'upload' && videoValidation && !videoValidation.valid)}
          className="bg-purple-600 hover:bg-purple-700 font-extrabold text-white min-w-[140px] relative flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              <span>Processando...</span>
            </>
          ) : (
            <span>{story ? 'Salvar Alterações' : 'Cadastrar Story'}</span>
          )}
        </Button>
      </div>

    </div>
  );
}
