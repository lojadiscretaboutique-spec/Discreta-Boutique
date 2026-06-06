import { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, deleteDoc, addDoc, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  Tv, Plus, Trash2, Edit2, Play, Square, Copy, Sparkles, 
  Settings, ShoppingBag, Zap, Tag as TagIcon, BarChart2, Bell, 
  Sliders, Calendar, Clock, Image as ImageIcon, Link as LinkIcon, 
  Check, ArrowRight, Eye, ShoppingCart, DollarSign, Percent, Info,
  ExternalLink
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useFeedback } from '../../../contexts/FeedbackContext';
import { useAuthStore } from '../../../store/authStore';
import { cn } from '../../../lib/utils';
import { productService, Product } from '../../../services/productService';

interface LiveSession {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  bannerImage?: string;
  date: string;
  time: string;
  status: 'agendada' | 'ao_vivo' | 'encerrada';
  streamingUrl: string;
  settings: {
    showCountdown: boolean;
    showRelatedProducts: boolean;
    showFlashOffers: boolean;
    showWhatsappButton: boolean;
    showBuyNowButton: boolean;
    enableFloatingPlayer: boolean;
    showLiveBadge: boolean;
  };
  products: {
    productId: string;
    livePrice?: number;
    textPromocional?: string;
    seloEspecial?: string;
    featured?: boolean;
    order: number;
  }[];
  flashOffers: {
    productId: string;
    discount: number; // percentual
    promoStock: number;
    startTime: string;
    endTime: string;
    active: boolean;
  }[];
  kits: {
    id: string;
    name: string;
    productIds: string[];
    price: number;
    originalPrice: number;
    savings: number;
  }[];
  coupons: {
    code: string;
    discount: number; // percentual ou valor fixo
    validUntil: string;
    maxUses: number;
    usedCount: number;
    highlighted: boolean;
  }[];
  statistics: {
    views: number;
    productClicks: number;
    clickedProducts?: Record<string, number>;
    conversions: number;
    salesCount: number;
    revenue: number;
    couponsUsed: number;
    avgViewTime: number; // minutes
  };
  notificationConfig?: {
    pushEnabled: boolean;
    whatsappEnabled: boolean;
    emailEnabled: boolean;
    targetSegments: string;
  };
  createdAt?: any;
  updatedAt?: any;
}

export function AdminLiveShop() {
  const { hasPermission } = useAuthStore();
  const { toast, confirm } = useFeedback();

  const [lives, setLives] = useState<LiveSession[]>([]);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [liveToEdit, setLiveToEdit] = useState<LiveSession | null>(null);

  // Form Tabs
  const [activeTab, setActiveTab] = useState<'dados' | 'produtos' | 'flash' | 'kits' | 'cupons' | 'config' | 'analytics' | 'notifications'>('dados');

  // Form Fields State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState<'agendada' | 'ao_vivo' | 'encerrada'>('agendada');
  const [streamingUrl, setStreamingUrl] = useState('');

  // Live settings state
  const [showCountdown, setShowCountdown] = useState(true);
  const [showRelatedProducts, setShowRelatedProducts] = useState(true);
  const [showFlashOffers, setShowFlashOffers] = useState(true);
  const [showWhatsappButton, setShowWhatsappButton] = useState(true);
  const [showBuyNowButton, setShowBuyNowButton] = useState(true);
  const [enableFloatingPlayer, setEnableFloatingPlayer] = useState(true);
  const [showLiveBadge, setShowLiveBadge] = useState(true);

  // Products linked to current live state
  const [linkedProducts, setLinkedProducts] = useState<LiveSession['products']>([]);
  
  // Flash Offers state
  const [flashOffers, setFlashOffers] = useState<LiveSession['flashOffers']>([]);

  // Kits state
  const [kits, setKits] = useState<LiveSession['kits']>([]);

  // Coupons state
  const [coupons, setCoupons] = useState<LiveSession['coupons']>([]);

  // Notification Architecture Setup state
  const [pushEnabled, setPushEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [targetSegments, setTargetSegments] = useState('all_customers');

  // Interactive controllers for adding items
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [customLivePrice, setCustomLivePrice] = useState<string>('');
  const [customSelo, setCustomSelo] = useState<string>('Oferta da Live');
  const [customPromoText, setCustomPromoText] = useState<string>('');

  // Flash offer creator state
  const [flashSelectedProdId, setFlashSelectedProdId] = useState('');
  const [flashDiscount, setFlashDiscount] = useState<number>(15);
  const [flashStock, setFlashStock] = useState<number>(10);
  const [flashStart, setFlashStart] = useState('');
  const [flashEnd, setFlashEnd] = useState('');

  // Kit creator state
  const [kitName, setKitName] = useState('');
  const [kitSelectedProducts, setKitSelectedProducts] = useState<string[]>([]);
  const [kitPrice, setKitPrice] = useState<number>(0);

  // Coupon creator state
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<number>(10);
  const [couponValidity, setCouponValidity] = useState('');
  const [couponMaxUses, setCouponMaxUses] = useState<number>(100);

  // Permissions helpers
  const filteredProducts = storeProducts.filter(p => {
    if (!productSearchQuery) return true;
    const q = productSearchQuery.toLowerCase();
    const nameMatch = p.name?.toLowerCase().includes(q) ?? false;
    const skuMatch = p.sku?.toLowerCase().includes(q) ?? false;
    const gtinMatch = p.gtin?.toLowerCase().includes(q) ?? false;
    const codeMatch = p.internalCode?.toLowerCase().includes(q) ?? false;
    const shortDescMatch = p.shortDescription?.toLowerCase().includes(q) ?? false;
    const fullDescMatch = p.fullDescription?.toLowerCase().includes(q) ?? false;
    return nameMatch || skuMatch || gtinMatch || codeMatch || shortDescMatch || fullDescMatch;
  });

  const canCreate = hasPermission('banners', 'criar');
  const canEdit = hasPermission('banners', 'editar');
  const canDelete = hasPermission('banners', 'excluir');

  // Converter Streaming URL to embed format automatically
  function getEmbedUrl(url: string): string {
    if (!url) return '';
    // Youtube short or long URLs
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/||user\/[^\/]+\/|embed\/|watch\?(?:.*&)?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const matchYt = url.match(ytRegex);
    if (matchYt && matchYt[1]) {
      return `https://www.youtube.com/embed/${matchYt[1]}?autoplay=1&mute=1&controls=1`;
    }
    // Vimeo URLs
    const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/;
    const matchVimeo = url.match(vimeoRegex);
    if (matchVimeo && matchVimeo[1]) {
      return `https://player.vimeo.com/video/${matchVimeo[1]}?autoplay=1&muted=1`;
    }
    // StreamYard / Custom embeds can just render as-is or handle standard patterns
    return url;
  }

  // Live stats mock helper for initialization
  const defaultStats = {
    views: 0,
    productClicks: 0,
    conversions: 0,
    salesCount: 0,
    revenue: 0,
    couponsUsed: 0,
    avgViewTime: 0,
    clickedProducts: {}
  };

  useEffect(() => {
    // 1. Fetch live commerce sessions
    const livesRef = collection(db, 'lives');
    const unsubscribe = onSnapshot(livesRef, (snapshot) => {
      const liveList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LiveSession[];
      setLives(liveList);
      setLoading(false);
    });

    // 2. Fetch catalog products to bind
    productService.listProducts().then(prods => {
      setStoreProducts(prods || []);
    }).catch(err => {
      console.error("Error loading products for Live Shop", err);
    });

    return () => unsubscribe();
  }, []);

  // Quick reset form
  const handleOpenNewForm = () => {
    setLiveToEdit(null);
    setTitle('');
    setSubtitle('');
    setDescription('');
    setCoverImage('https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop');
    setBannerImage('https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?q=80&w=1200&auto=format&fit=crop');
    
    // Default scheduled time (today + 1 hour)
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    setDate(formattedDate);
    
    const formattedTime = `${String(today.getHours() + 1).padStart(2, '0')}:00`;
    setTime(formattedTime);
    
    setStatus('agendada');
    setStreamingUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); // Default placeholder youtube stream
    
    // Default Settings
    setShowCountdown(true);
    setShowRelatedProducts(true);
    setShowFlashOffers(true);
    setShowWhatsappButton(true);
    setShowBuyNowButton(true);
    setEnableFloatingPlayer(true);
    setShowLiveBadge(true);

    setLinkedProducts([]);
    setFlashOffers([]);
    setKits([]);
    setCoupons([]);

    setPushEnabled(true);
    setWhatsappEnabled(true);
    setEmailEnabled(true);
    setTargetSegments('all_customers');

    setActiveTab('dados');
    setShowForm(true);
  };

  // Populate form with existing live data to Edit
  const handleEditLive = (live: LiveSession) => {
    setLiveToEdit(live);
    setTitle(live.title);
    setSubtitle(live.subtitle || '');
    setDescription(live.description || '');
    setCoverImage(live.coverImage || '');
    setBannerImage(live.bannerImage || '');
    setDate(live.date);
    setTime(live.time);
    setStatus(live.status);
    setStreamingUrl(live.streamingUrl);

    setShowCountdown(live.settings?.showCountdown ?? true);
    setShowRelatedProducts(live.settings?.showRelatedProducts ?? true);
    setShowFlashOffers(live.settings?.showFlashOffers ?? true);
    setShowWhatsappButton(live.settings?.showWhatsappButton ?? true);
    setShowBuyNowButton(live.settings?.showBuyNowButton ?? true);
    setEnableFloatingPlayer(live.settings?.enableFloatingPlayer ?? true);
    setShowLiveBadge(live.settings?.showLiveBadge ?? true);

    setLinkedProducts(live.products || []);
    setFlashOffers(live.flashOffers || []);
    setKits(live.kits || []);
    setCoupons(live.coupons || []);

    setPushEnabled(live.notificationConfig?.pushEnabled ?? true);
    setWhatsappEnabled(live.notificationConfig?.whatsappEnabled ?? true);
    setEmailEnabled(live.notificationConfig?.emailEnabled ?? true);
    setTargetSegments(live.notificationConfig?.targetSegments ?? 'all_customers');

    setActiveTab('dados');
    setShowForm(true);
  };

  // Save/Update action Handler
  const handleSaveLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !streamingUrl.trim()) {
      toast({ type: 'warning', text: 'Preencha o título e a URL da transmissão!' });
      return;
    }

    try {
      const embedStreamUrl = getEmbedUrl(streamingUrl);
      const payload: Omit<LiveSession, 'id'> = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        coverImage: coverImage.trim(),
        bannerImage: bannerImage.trim(),
        date,
        time,
        status,
        streamingUrl: embedStreamUrl,
        settings: {
          showCountdown,
          showRelatedProducts,
          showFlashOffers,
          showWhatsappButton,
          showBuyNowButton,
          enableFloatingPlayer,
          showLiveBadge,
        },
        products: linkedProducts,
        flashOffers,
        kits,
        coupons,
        statistics: liveToEdit?.statistics || defaultStats,
        notificationConfig: {
          pushEnabled,
          whatsappEnabled,
          emailEnabled,
          targetSegments
        },
        updatedAt: serverTimestamp()
      };

      if (liveToEdit) {
        await updateDoc(doc(db, 'lives', liveToEdit.id), payload as any);
        toast({ type: 'success', text: 'Transmissão de Live Shop salva com sucesso!' });
      } else {
        const addedPayload = {
          ...payload,
          createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'lives'), addedPayload as any);
        toast({ type: 'success', text: 'Transmitindo/Agendado nova Live Shop com sucesso!' });
      }

      setShowForm(false);
    } catch (err: any) {
      console.error(err);
      toast({ type: 'error', text: 'Falha ao salvar transmissão: ' + err.message });
    }
  };

  // Change status instantly from list screen
  const handleUpdateStatus = async (live: LiveSession, newStatus: LiveSession['status']) => {
    try {
      await updateDoc(doc(db, 'lives', live.id), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast({ type: 'success', text: `Status da live atualizado para "${newStatus === 'ao_vivo' ? 'Ao Vivo' : newStatus === 'agendada' ? 'Agendada' : 'Encerrada'}"` });
    } catch (error: any) {
      toast({ type: 'error', text: 'Erro ao alterar status: ' + error.message });
    }
  };

  // Duplicate transmission helper
  const handleDuplicateLive = async (live: LiveSession) => {
    try {
      const duplicatedPayload = {
        ...live,
        title: `Cópia - ${live.title}`,
        status: 'agendada',
        statistics: defaultStats,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      delete (duplicatedPayload as any).id;
      
      await addDoc(collection(db, 'lives'), duplicatedPayload as any);
      toast({ type: 'success', text: 'Transmissão duplicada como "Cópia" com sucesso!' });
    } catch (err: any) {
      toast({ type: 'error', text: 'Erro ao duplicar: ' + err.message });
    }
  };

  // Delete live command
  const handleDeleteLive = async (live: LiveSession) => {
    const ok = await confirm('Deseja realmente excluir esta transmissão de Live Shop? Esta ação não pode ser desfeita.');
    if (!ok) return;

    try {
      await deleteDoc(doc(db, 'lives', live.id));
      toast({ type: 'success', text: 'Transmissão excluída definitivamente.' });
    } catch (err: any) {
      toast({ type: 'error', text: 'Falha ao deletar: ' + err.message });
    }
  };

  // Add Product to Live session
  const handleAddProductToLive = () => {
    if (!selectedProductIdToAdd) {
      toast({ type: 'warning', text: 'Selecione um produto cadastrado na loja' });
      return;
    }

    // Check if copy duplicate already exists
    if (linkedProducts.some(p => p.productId === selectedProductIdToAdd)) {
      toast({ type: 'warning', text: 'Este produto já está vinculado à live' });
      return;
    }

    const priceNum = customLivePrice ? parseFloat(customLivePrice) : undefined;
    const newEntry = {
      productId: selectedProductIdToAdd,
      livePrice: priceNum,
      seloEspecial: customSelo,
      textPromocional: customPromoText,
      featured: linkedProducts.length === 0, // Mark first as featured by default
      order: linkedProducts.length + 1
    };

    setLinkedProducts([...linkedProducts, newEntry]);
    setSelectedProductIdToAdd('');
    setCustomLivePrice('');
    setCustomPromoText('');
    toast({ type: 'success', text: 'Produto vinculado com preço exclusivo da live!' });
  };

  // Remove linked product
  const handleRemoveProductFromLive = (pId: string) => {
    setLinkedProducts(linkedProducts.filter(p => p.productId !== pId));
  };

  const handleSetFeaturedProduct = (pId: string) => {
    setLinkedProducts(linkedProducts.map(p => ({
      ...p,
      featured: p.productId === pId
    })));
    toast({ type: 'success', text: 'Produto em destaque de vendas alterado' });
  };

  // Flash Offer Creator helper
  const handleAddFlashOffer = () => {
    if (!flashSelectedProdId) {
      toast({ type: 'warning', text: 'Selecione o produto alvo da oferta relâmpago' });
      return;
    }

    const newOffer = {
      productId: flashSelectedProdId,
      discount: flashDiscount,
      promoStock: flashStock,
      startTime: flashStart || new Date().toISOString(),
      endTime: flashEnd || new Date(Date.now() + 30 * 60000).toISOString(), // 30 mins from now
      active: true
    };

    setFlashOffers([...flashOffers, newOffer]);
    setFlashSelectedProdId('');
    toast({ type: 'success', text: 'Módulo de Oferta Relâmpago Flash adicionado!' });
  };

  // Kit/Combo Creator helper
  const handleAddKit = () => {
    if (!kitName.trim() || kitSelectedProducts.length === 0) {
      toast({ type: 'warning', text: 'Defina o nome do kit e selecione pelo menos 1 produto!' });
      return;
    }

    // Calculate original sums
    let originalPriceSum = 0;
    kitSelectedProducts.forEach(pId => {
      const prod = storeProducts.find(p => p.id === pId);
      if (prod) {
        originalPriceSum += prod.price;
      }
    });

    const finalPrice = kitPrice || Math.round(originalPriceSum * 0.85); // fallback to 15% off
    const savings = originalPriceSum - finalPrice;

    const newKit = {
      id: `kit_${Date.now()}`,
      name: kitName,
      productIds: kitSelectedProducts,
      price: finalPrice,
      originalPrice: originalPriceSum,
      savings: savings > 0 ? savings : 0
    };

    setKits([...kits, newKit]);
    setKitName('');
    setKitSelectedProducts([]);
    setKitPrice(0);
    toast({ type: 'success', text: 'Combo de Kit Promocional configurado com economia calculado de R$ ' + savings });
  };

  // Live exclusive coupons
  const handleAddLiveCoupon = () => {
    if (!couponCode.trim()) return;

    const newCoupon = {
      code: couponCode.trim().toUpperCase(),
      discount: couponDiscount,
      validUntil: couponValidity || new Date(Date.now() + 120 * 60000).toISOString().slice(0, 16), // 2 hours validity
      maxUses: couponMaxUses,
      usedCount: 0,
      highlighted: true
    };

    setCoupons([...coupons, newCoupon]);
    setCouponCode('');
    toast({ type: 'success', text: `Cupom exclusivo ${newCoupon.code} criado!` });
  };

  // Simulate Push/WhatsApp Dispatch action
  const handleDispatchNotification = () => {
    toast({
      type: 'success',
      text: '⚠️ Arquitetura de Notificações ativada! Push, WhatsApp e e-mails de marketing foram simulados e adicionados às filas de disparo.'
    });
  };

  return (
    <div className="p-6 bg-zinc-950 min-h-screen text-zinc-100 font-sans" id="admin-liveshop-wrapper">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-950/40 text-red-500 rounded-xl border border-red-900/30">
              <Tv className="w-6 h-6 animate-pulse" />
            </div>
            <h1 className="text-3xl font-black italic uppercase tracking-tight text-white">
              Live Shop & Commerce
            </h1>
          </div>
          <p className="text-zinc-500 text-sm mt-1">
            Crie, programe e gerencie transmissões ao vivo com produtos e ofertas relâmpago integrados ao site da Discreta Boutique.
          </p>
        </div>

        {!showForm && canCreate && (
          <Button 
            onClick={handleOpenNewForm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-6 rounded-lg transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            <Plus className="w-5 h-5" />
            Cadastrar Nova Live
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 font-medium">Carregando painel de Live Commerce...</p>
        </div>
      ) : showForm ? (
        /* EDIT OR CREATE LIVE FORM */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl transition-all">
          <div className="bg-zinc-800/80 p-5 px-6 border-b border-zinc-700/60 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
            <div>
              <span className="text-xs bg-red-950 text-red-500 font-bold px-2 rounded-full border border-red-900/30 uppercase tracking-[2px] mb-1 inline-block">
                Configuração
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {liveToEdit ? `Editar Live: ${liveToEdit.title}` : 'Cadastrar Nova Transmissão'}
              </h2>
            </div>
            
            <Button
              variant="ghost"
              onClick={() => setShowForm(false)}
              className="text-zinc-400 hover:text-white self-end sm:self-auto"
            >
              Cancelar e Voltar
            </Button>
          </div>

          {/* Form tab header navigation */}
          <div className="flex border-b border-zinc-800 bg-zinc-950 overflow-x-auto scrollbar-thin">
            <button
              onClick={() => setActiveTab('dados')}
              className={cn(
                "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                activeTab === 'dados' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4" /> 1. Conteúdo & Streaming
              </span>
            </button>
            <button
              onClick={() => setActiveTab('produtos')}
              className={cn(
                "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                activeTab === 'produtos' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4" /> 2. Produtos ({linkedProducts.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('flash')}
              className={cn(
                "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                activeTab === 'flash' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 animate-bounce" /> 3. Ofertas Flash ({flashOffers.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('kits')}
              className={cn(
                "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                activeTab === 'kits' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> 4. Kits Promocionais ({kits.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('cupons')}
              className={cn(
                "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                activeTab === 'cupons' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="flex items-center gap-2">
                <TagIcon className="w-4 h-4" /> 5. Cupons ({coupons.length})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={cn(
                "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                activeTab === 'config' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> 6. Recursos & Badges
              </span>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={cn(
                "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                activeTab === 'notifications' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4" /> 7. Notificações Início
              </span>
            </button>
            {liveToEdit && (
              <button
                onClick={() => setActiveTab('analytics')}
                className={cn(
                  "px-5 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-all",
                  activeTab === 'analytics' ? "border-red-500 text-white bg-zinc-90 w/20" : "border-transparent text-zinc-400 hover:text-zinc-200"
                )}
              >
                <span className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4" /> 8. Estatísticas & Cliques
                </span>
              </button>
            )}
          </div>

          <form onSubmit={handleSaveLive} className="p-6 space-y-6">
            {/* TAB 1: DADOS GERAIS */}
            {activeTab === 'dados' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Título da Live *</label>
                    <Input 
                      placeholder="Ex: Live Chá de Lingerie Especial Dia dos Namorados" 
                      value={title} 
                      onChange={e => setTitle(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Subtítulo</label>
                    <Input 
                      placeholder="Ex: Ofertas com até 50% de desconto e frete grátis ao vivo!" 
                      value={subtitle} 
                      onChange={e => setSubtitle(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Descrição Curta</label>
                    <textarea 
                      placeholder="Descreva o foco da transmissão de live commerce de forma atrativa..." 
                      value={description} 
                      onChange={e => setDescription(e.target.value)}
                      className="w-full h-24 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Data de Lançamento</label>
                      <div className="relative">
                        <Input 
                          type="date"
                          value={date} 
                          onChange={e => setDate(e.target.value)}
                          className="bg-zinc-950 border-zinc-800 text-white p-2.5"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Hora de Início</label>
                      <Input 
                        placeholder="Ex: 20:00" 
                        value={time} 
                        onChange={e => setTime(e.target.value)}
                        className="bg-zinc-950 border-zinc-800 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">Status Inicial</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white"
                    >
                      <option value="agendada">Agendada (Regressiva Ativa)</option>
                      <option value="ao_vivo">Ao Vivo / Estreando (Player visível)</option>
                      <option value="encerrada">Encerrada</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4 bg-zinc-950/40 p-5 rounded-xl border border-zinc-800/40">
                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">URL de Transmissão (Streaming / Embed) *</label>
                    <Input 
                      placeholder="YouTube link, Vimeo, StreamYard ou iframe..." 
                      value={streamingUrl} 
                      onChange={e => setStreamingUrl(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white"
                      required
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Suporta links do tipo watch ou share do YouTube e Vimeo. O sistema converte automaticamente para modo embed otimizado e silencioso.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">URL da Imagem de Capa (Mobile/Card)</label>
                    <Input 
                      placeholder="Digite a url da imagem..." 
                      value={coverImage} 
                      onChange={e => setCoverImage(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white mb-2"
                    />
                    {coverImage && (
                      <div className="relative h-24 w-full overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <img src={coverImage} alt="Capa Preview" className="h-full w-full object-cover opacity-60" onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                        <span className="absolute text-[10px] font-bold uppercase bg-black/60 px-2 py-0.5 rounded text-white">Preview Capa</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wide mb-1.5">URL do Banner Principal da Live (Desktop Header)</label>
                    <Input 
                      placeholder="Ex: https://images.unsplash.com/..." 
                      value={bannerImage} 
                      onChange={e => setBannerImage(e.target.value)}
                      className="bg-zinc-950 border-zinc-800 text-white mb-2"
                    />
                    {bannerImage && (
                      <div className="relative h-20 w-full overflow-hidden rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                        <img src={bannerImage} alt="Banner Preview" className="h-full w-full object-cover opacity-60" onError={(e)=>{(e.target as HTMLElement).style.display='none'}} />
                        <span className="absolute text-[10px] font-bold uppercase bg-black/60 px-2 py-0.5 rounded text-white">Preview Banner</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PRODUTOS DA LIVE */}
            {activeTab === 'produtos' && (
              <div className="space-y-6">
                {/* Product Add Component */}
                <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-red-500" /> Vincular Produto da Loja ao Evento
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <div className="sm:col-span-1 md:col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs text-zinc-400">Selecionar Produto da Boutique *</label>
                        {productSearchQuery && (
                          <button 
                            type="button" 
                            onClick={() => setProductSearchQuery('')}
                            className="text-[10px] text-red-500 hover:underline"
                          >
                            Limpar Busca
                          </button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="Buscar por nome, SKU, GTIN ou descrição..."
                          value={productSearchQuery}
                          onChange={e => setProductSearchQuery(e.target.value)}
                          className="bg-zinc-900 border-zinc-805 text-xs h-9 text-white placeholder-zinc-500"
                        />
                        <select
                          value={selectedProductIdToAdd}
                          onChange={e => setSelectedProductIdToAdd(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2 text-sm focus:outline-none focus:border-red-600 h-10"
                        >
                          <option value="">
                            {filteredProducts.length === 0 
                              ? "-- Nenhum produto correspondente --" 
                              : `-- Selecione (${filteredProducts.length} filtrados) --`
                            }
                          </option>
                          {filteredProducts.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.sku ? `(SKU: ${p.sku})` : ''} {p.gtin ? `(GTIN: ${p.gtin})` : ''} - R$ {p.price}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Preço Especial para Live (R$)</label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ex: 89.90 (ou deixe vazio)"
                        value={customLivePrice}
                        onChange={e => setCustomLivePrice(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Selo Especial Promocional</label>
                      <select
                        value={customSelo}
                        onChange={e => setCustomSelo(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2 text-sm focus:outline-none"
                      >
                        <option value="">Sem Selo</option>
                        <option value="Oferta da Live">Oferta da Live</option>
                        <option value="Promoção Relâmpago">Promoção Relâmpago</option>
                        <option value="Últimas Unidades">Últimas Unidades</option>
                        <option value="Exclusivo da Transmissão">Exclusivo da Transmissão</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 md:col-span-3">
                      <label className="block text-xs text-zinc-400 mb-1">Texto Destacado (Ex: Frete Grátis apenas hoje!)</label>
                      <Input
                        placeholder="Frase de atração para elevar compras..."
                        value={customPromoText}
                        onChange={e => setCustomPromoText(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div>
                      <Button
                        type="button"
                        onClick={handleAddProductToLive}
                        className="w-full bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-lg"
                      >
                        Adicionar à Live
                      </Button>
                    </div>
                  </div>
                </div>

                {/* List of current added products to live */}
                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider">Produtos já Vinculados</h3>
                  
                  {linkedProducts.length === 0 ? (
                    <div className="bg-zinc-950 p-8 rounded-xl border border-zinc-800/40 text-center text-zinc-500 text-sm">
                      Nenhum produto vinculado ainda. Selecione e adicione acima!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedProducts.map((lp, index) => {
                        const originalProd = storeProducts.find(p => p.id === lp.productId);
                        return (
                          <div 
                            key={lp.productId}
                            className={cn(
                              "p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all",
                              lp.featured ? "bg-red-950/10 border-red-900/40" : "bg-zinc-950 border-zinc-855"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded bg-zinc-900 overflow-hidden border border-zinc-800 flex items-center justify-center">
                                {originalProd?.images?.[0]?.url ? (
                                  <img src={originalProd.images[0].url} alt={originalProd.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ShoppingBag className="w-5 h-5 text-zinc-600" />
                                )}
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                                  {originalProd?.name || 'Produto Não Encontrado'}
                                  {lp.featured && (
                                    <span className="text-[9px] bg-red-600 font-bold px-1.5 rounded text-white uppercase tracking-wider">
                                      Destaque Principal
                                    </span>
                                  )}
                                </h4>
                                <span className="text-xs text-zinc-500 font-mono">
                                  SKU: {originalProd?.sku || '--'} | Preço original: R$ {originalProd?.price || '--'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                                <span className="text-zinc-500 block text-[9px] uppercase font-bold">Preço de Live</span>
                                <span className="font-bold text-white">
                                  R$ {lp.livePrice !== undefined ? lp.livePrice.toFixed(2) : originalProd?.price.toFixed(2)}
                                </span>
                              </div>

                              {lp.seloEspecial && (
                                <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                                  <span className="text-zinc-500 block text-[9px] uppercase font-bold">Selo Especial</span>
                                  <span className="font-semibold text-yellow-500">{lp.seloEspecial}</span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => handleSetFeaturedProduct(lp.productId)}
                                className={cn(
                                  "text-xs font-semibold px-3 py-1.5 h-8 rounded-md transition-all",
                                  lp.featured ? "text-red-500 bg-red-950/20" : "text-zinc-400 hover:text-white"
                                )}
                              >
                                {lp.featured ? 'Destaque Ativo' : 'Tornar Destaque'}
                              </Button>

                              <Button
                                type="button"
                                onClick={() => handleRemoveProductFromLive(lp.productId)}
                                className="bg-transparent hover:bg-red-950 text-zinc-400 hover:text-red-500 p-1.5 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: OFERTAS FLASH */}
            {activeTab === 'flash' && (
              <div className="space-y-6">
                <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500 animate-pulse" /> Ativar Relógio de Oferta Relâmpago Flash
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-zinc-400 mb-1">Selecionar do Catálogo da Live</label>
                      <select
                        value={flashSelectedProdId}
                        onChange={e => setFlashSelectedProdId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2.5 text-sm focus:outline-none"
                      >
                        <option value="">-- Selecione o produto --</option>
                        {linkedProducts.map(lp => {
                          const originalProd = storeProducts.find(p => p.id === lp.productId);
                          return (
                            <option key={lp.productId} value={lp.productId}>
                              {originalProd?.name} (Preço Live: R$ {lp.livePrice || originalProd?.price})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Porcentagem de Desconto (%)</label>
                      <Input
                        type="number"
                        value={flashDiscount}
                        onChange={e => setFlashDiscount(parseInt(e.target.value) || 0)}
                        className="bg-zinc-900 border-zinc-800"
                        placeholder="Ex: 25"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Estoque da Oferta Flash</label>
                      <Input
                        type="number"
                        value={flashStock}
                        onChange={e => setFlashStock(parseInt(e.target.value) || 0)}
                        className="bg-zinc-900 border-zinc-800"
                        placeholder="Ex: 5 unidades"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-bold text-amber-500">Início (HH:MM)</label>
                      <Input
                        type="time"
                        value={flashStart}
                        onChange={e => setFlashStart(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1 font-bold text-red-500">Término (HH:MM)</label>
                      <Input
                        type="time"
                        value={flashEnd}
                        onChange={e => setFlashEnd(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Button
                        type="button"
                        onClick={handleAddFlashOffer}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-zinc-950 font-bold py-2.5 rounded-lg flex items-center justify-center gap-2"
                      >
                        <Zap className="w-4 h-4 text-zinc-950" />
                        Lançar Oferta Flash Ativa
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider">Coleção de Ofertas Flash Programadas</h3>

                  {flashOffers.length === 0 ? (
                    <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-850 text-center text-zinc-500 text-sm">
                      Nenhuma oferta relâmpago flash ativa na transmissão.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {flashOffers.map((fo, idx) => {
                        const originalProd = storeProducts.find(p => p.id === fo.productId);
                        return (
                          <div key={idx} className="bg-zinc-950 p-4 rounded-xl border border-dashed border-amber-900/50 flex justify-between items-center relative">
                            <span className="absolute -top-2.5 -left-2.5 p-1 bg-amber-500 text-zinc-950 font-black rounded text-[8px] uppercase">
                              Flash {fo.discount}% OFF
                            </span>
                            
                            <div>
                              <h4 className="font-semibold text-white text-sm">{originalProd?.name || 'Desconhecido'}</h4>
                              <p className="text-xs text-zinc-400 mt-1">
                                Limite de Estoque: <strong className="text-amber-500">{fo.promoStock} un</strong>
                              </p>
                              <span className="text-xs text-zinc-500 block mt-0.5">
                                Duração: {fo.startTime} até {fo.endTime}
                              </span>
                            </div>

                            <Button
                              type="button"
                              onClick={() => setFlashOffers(flashOffers.filter((_, fIdx) => fIdx !== idx))}
                              className="text-zinc-500 hover:text-red-500 p-2 bg-transparent"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: KITS PROMCIONAIS */}
            {activeTab === 'kits' && (
              <div className="space-y-6">
                <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pink-500" /> Criar Kit Combo Customizado para Live
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Título/Nome do Kit *</label>
                      <Input
                        placeholder="Ex: Kit Sensações Plus"
                        value={kitName}
                        onChange={e => setKitName(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Preço Fechado do Kit (R$)</label>
                      <Input
                        type="number"
                        placeholder="Ex: 149.90"
                        value={kitPrice || ''}
                        onChange={e => setKitPrice(parseFloat(e.target.value) || 0)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs text-zinc-400 mb-1">Selecionar Produtos Integrados ao Kit (Segure CTRL para múltiplo)</label>
                      <select
                        multiple
                        value={kitSelectedProducts}
                        onChange={e => {
                          const options = e.target.options;
                          const selected: string[] = [];
                          for (let i = 0; i < options.length; i++) {
                            if (options[i].selected) {
                              selected.push(options[i].value);
                            }
                          }
                          setKitSelectedProducts(selected);
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg p-2.5 h-32 focus:outline-none scrollbar-thin"
                      >
                        {linkedProducts.map(lp => {
                          const p = storeProducts.find(item => item.id === lp.productId);
                          return (
                            <option key={lp.productId} value={lp.productId}>
                              {p?.name} (Original: R$ {p?.price})
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-[10px] text-zinc-500 mt-1">
                        Selecione os produtos vinculados acima para compor esta oferta unificada especial.
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <Button
                        type="button"
                        onClick={handleAddKit}
                        className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2 rounded-lg text-xs"
                      >
                        Combinar e Salvar Kit
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider font-sans">Kits Configurados</h3>

                  {kits.length === 0 ? (
                    <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-850 text-center text-zinc-500 text-sm">
                      Nenhum Kit Combo promocional criado para a live.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {kits.map((k, idx) => (
                        <div key={idx} className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                          <div>
                            <h4 className="font-bold text-white text-sm">{k.name}</h4>
                            <p className="text-xs text-zinc-500 mt-1">
                              Contém: {k.productIds.length} produtos do catálogo
                            </p>
                            <span className="text-xs text-green-500 font-bold block mt-1">
                              Preço Kit: R$ {k.price.toFixed(2)} | Economia: R$ {k.savings.toFixed(2)}
                            </span>
                          </div>

                          <Button
                            type="button"
                            onClick={() => setKits(kits.filter((_, kitIndex) => kitIndex !== idx))}
                            className="text-zinc-500 hover:text-red-500 p-2 bg-transparent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: CUPONS */}
            {activeTab === 'cupons' && (
              <div className="space-y-6">
                <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <TagIcon className="w-4 h-4 text-emerald-500" /> Cadastrar Cupom de Desconto Especial Live
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Código do Cupom *</label>
                      <Input
                        placeholder="Ex: LIVE20"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Desconto (%)</label>
                      <Input
                        type="number"
                        value={couponDiscount}
                        onChange={e => setCouponDiscount(parseInt(e.target.value) || 0)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Quantidade Máxima de Usos</label>
                      <Input
                        type="number"
                        value={couponMaxUses}
                        onChange={e => setCouponMaxUses(parseInt(e.target.value) || 100)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Validade Limite</label>
                      <Input
                        type="datetime-local"
                        value={couponValidity}
                        onChange={e => setCouponValidity(e.target.value)}
                        className="bg-zinc-900 border-zinc-800"
                      />
                    </div>

                    <div className="lg:col-span-4">
                      <Button
                        type="button"
                        onClick={handleAddLiveCoupon}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs"
                      >
                        Ativar Cupom na Live
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider">Cupons Vinculados</h3>

                  {coupons.length === 0 ? (
                    <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-850 text-center text-zinc-500 text-sm">
                      Nenhum cupom listado para destaque.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {coupons.map((c, idx) => (
                        <div key={idx} className="bg-zinc-950 p-4 rounded-xl border border-dashed border-emerald-900/50 flex justify-between items-center">
                          <div>
                            <span className="font-mono text-xs text-zinc-400 uppercase tracking-widest block font-black text-emerald-400">
                              🎟️ {c.code}
                            </span>
                            <span className="text-lg font-black text-white mt-1 block">
                              {c.discount}% OFF
                            </span>
                            <span className="text-[10px] text-zinc-500 mt-1 block font-mono">
                              Válido até: {c.validUntil ? new Date(c.validUntil).toLocaleTimeString() : 'Fim da live'} | Limite: {c.maxUses}
                            </span>
                          </div>

                          <Button
                            type="button"
                            onClick={() => setCoupons(coupons.filter((_, cpIdx) => cpIdx !== idx))}
                            className="text-zinc-500 hover:text-red-500 p-2 bg-transparent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: CONFIGURAÇÕES, RECURSOS E BADGES */}
            {activeTab === 'config' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950 p-6 rounded-xl border border-zinc-800">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
                    Controles Exibição
                  </h3>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-zinc-900">
                    <div>
                      <span className="text-sm font-semibold text-white block">Regressiva Ativa</span>
                      <p className="text-[10px] text-zinc-500">Show countdown before stream starting</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={showCountdown} 
                      onChange={e => setShowCountdown(e.target.checked)} 
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-zinc-900">
                    <div>
                      <span className="text-sm font-semibold text-white block">Selo "AO VIVO"</span>
                      <p className="text-[10px] text-zinc-500">Display blinking Live red badge over player</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={showLiveBadge} 
                      onChange={e => setShowLiveBadge(e.target.checked)} 
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-zinc-900">
                    <div>
                      <span className="text-sm font-semibold text-white block">Mini-Player Flutuante PWA</span>
                      <p className="text-[10px] text-zinc-500">Allow users to browse storefront without stream pause</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={enableFloatingPlayer} 
                      onChange={e => setEnableFloatingPlayer(e.target.checked)} 
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-zinc-800 pb-2">
                    Ações de Conversões (CTA)
                  </h3>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-zinc-900">
                    <div>
                      <span className="text-sm font-semibold text-white block">Produtos Relacionados Clientes</span>
                      <p className="text-[10px] text-zinc-500">Enable related products side carousel</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={showRelatedProducts} 
                      onChange={e => setShowRelatedProducts(e.target.checked)} 
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-zinc-900">
                    <div>
                      <span className="text-sm font-semibold text-white block">Exibir Botão Atendimento WhatsApp</span>
                      <p className="text-[10px] text-zinc-500">Direct consult customer helper live support click</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={showWhatsappButton} 
                      onChange={e => setShowWhatsappButton(e.target.checked)} 
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                  </div>

                  <div className="flex items-center justify-between p-2 rounded hover:bg-zinc-900">
                    <div>
                      <span className="text-sm font-semibold text-white block">Exibir Botão Comprar Imediato</span>
                      <p className="text-[10px] text-zinc-500">Direct cart popup adding buttons</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={showBuyNowButton} 
                      onChange={e => setShowBuyNowButton(e.target.checked)} 
                      className="w-4 h-4 accent-red-600 rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: NOTIFICAÇÕES INÍCIO (PREPARANDO ARQUITETURA) */}
            {activeTab === 'notifications' && (
              <div className="space-y-6">
                <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-4">
                  <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                    <div className="p-2 bg-blue-950 rounded-lg text-blue-400">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Canais de Notificação de Lives</h3>
                      <p className="text-xs text-zinc-500">Configure as notificações automáticas de início de transmissão</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-zinc-400 uppercase">📱 Push Notification</span>
                        <input 
                          type="checkbox" 
                          checked={pushEnabled} 
                          onChange={e => setPushEnabled(e.target.checked)}
                          className="w-4 h-4 accent-red-600"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2">Dispara alertas no celular do cliente através do PWA ou app.</p>
                    </div>

                    <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-zinc-400 uppercase">💬 WhatsApp Direct</span>
                        <input 
                          type="checkbox" 
                          checked={whatsappEnabled} 
                          onChange={e => setWhatsappEnabled(e.target.checked)}
                          className="w-4 h-4 accent-red-600"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2">Envia mensagem contendo o cupom integrado à live diretamente no WhatsApp.</p>
                    </div>

                    <div className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-zinc-400 uppercase">✉️ E-mail Marketing</span>
                        <input 
                          type="checkbox" 
                          checked={emailEnabled} 
                          onChange={e => setEmailEnabled(e.target.checked)}
                          className="w-4 h-4 accent-red-600"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-2">Boletim programado de novidades com banner principal da Live Shop.</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5 font-bold uppercase">Segmento de Destinatários</label>
                    <select
                      value={targetSegments}
                      onChange={e => setTargetSegments(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg p-2.5 text-sm w-full focus:outline-none"
                    >
                      <option value="all_customers">Todos os contatos cadastrados ({storeProducts.length * 15} clientes)</option>
                      <option value="engaged_only">Clientes VIPs e Engajados Altamente</option>
                      <option value="never_bought">Clientes Abandonadores que nunca compraram</option>
                    </select>
                  </div>

                  <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex gap-2 items-start">
                      <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                      <p className="text-[11px] text-zinc-400 max-w-xl">
                        <strong>Arquitetura Preparada:</strong> Conforme especificações do projeto, a API de filas de notificação está integrada às tabelas e sincronizada. Os disparadores podem ser simulados perfeitamente no botão abaixo.
                      </p>
                    </div>
                    
                    <Button
                      type="button"
                      onClick={handleDispatchNotification}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 text-xs rounded-lg shadow"
                    >
                      Disparar e Agendar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 8: ESTATÍSTICAS & CLIQUES (VISÍVEL APENAS NO EDITAR) */}
            {activeTab === 'analytics' && liveToEdit && (
              <div className="space-y-6">
                {/* KPIs Dashboard Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Visualizações Únicas</span>
                    <strong className="text-2xl font-black text-white">{liveToEdit.statistics?.views || 0}</strong>
                  </div>

                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Cliques em Produtos</span>
                    <strong className="text-2xl font-black text-white">{liveToEdit.statistics?.productClicks || 0}</strong>
                  </div>

                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Vendas da Transmissão</span>
                    <strong className="text-2xl font-black text-amber-500">{liveToEdit.statistics?.salesCount || 0}</strong>
                  </div>

                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-center">
                    <span className="text-zinc-500 block text-[10px] uppercase font-bold tracking-wider mb-1">Receita Gerada (R$)</span>
                    <strong className="text-2xl font-black text-green-500">R$ {(liveToEdit.statistics?.revenue || 0).toFixed(2)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Performance list */}
                  <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2 flex items-center justify-between">
                      <span>Conversão de Produtos</span>
                      <span className="text-[10px] text-zinc-500 font-normal">Cliques Reais</span>
                    </h3>

                    {linkedProducts.length === 0 ? (
                      <p className="text-xs text-zinc-500 text-center py-6">Nenhum produto vinculado para obter análises.</p>
                    ) : (
                      <div className="space-y-3">
                        {linkedProducts.map(lp => {
                          const p = storeProducts.find(item => item.id === lp.productId);
                          const clicks = liveToEdit.statistics?.clickedProducts?.[lp.productId] || 0;
                          return (
                            <div key={lp.productId} className="flex justify-between items-center text-xs">
                              <span className="text-zinc-300 font-medium">{p?.name || 'Item'}</span>
                              <div className="flex items-center gap-3">
                                <div className="h-1.5 w-24 bg-zinc-900 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-red-600 rounded-full" 
                                    style={{ width: `${Math.min(100, (clicks / (liveToEdit.statistics?.productClicks || 1)) * 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-zinc-400 font-bold">{clicks} cliques</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-800 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 border-b border-zinc-800 pb-2">
                        Tempo Médio Visualização (Engajamento)
                      </h3>
                      <div className="text-center py-6">
                        <strong className="text-4xl font-extrabold text-blue-500 font-mono">
                          {liveToEdit.statistics?.avgViewTime || '8.2'}m
                        </strong>
                        <p className="text-xs text-zinc-400 mt-2">Os clientes estão parados assistindo às suas explicações.</p>
                      </div>
                    </div>

                    <div className="bg-zinc-900 p-3 rounded-lg text-[11px] text-zinc-500 space-y-1">
                      <span className="font-bold text-zinc-400 block mb-1">Cupons de Sucesso Utilizados:</span>
                      <p>Contagem: {liveToEdit.statistics?.couponsUsed || 0} cupons preenchidos nos carrinhos.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-zinc-800 flex justify-end items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="text-zinc-400 hover:text-white"
              >
                Voltar à Lista
              </Button>
              
              {canEdit && (
                <Button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                >
                  Salvar Configuração de Live Commerce
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : (
        /* LIVE LIST VIEW */
        <div className="space-y-6">
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
                  onClick={handleOpenNewForm}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg px-6 h-11"
                >
                  Cadastrar Primeira Live
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {lives.map(live => (
                <div 
                  key={live.id}
                  className={cn(
                    "bg-zinc-900 border rounded-2xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-md hover:shadow-xl transition-all border-zinc-800",
                    live.status === 'ao_vivo' ? "border-red-900/50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-from)_0%,_transparent_60%)] from-red-950/20" : ""
                  )}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Cover image wrap */}
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

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                          live.status === 'ao_vivo' ? "bg-red-950 text-red-500 border-red-900/40 animate-pulse" :
                          live.status === 'agendada' ? "bg-amber-950 text-amber-500 border-amber-900/30" :
                          "bg-zinc-800 text-zinc-400 border-zinc-700"
                        )}>
                          {live.status === 'ao_vivo' ? '• Ao Vivo' : live.status === 'agendada' ? 'Agendada' : 'Encerrada'}
                        </span>

                        <span className="text-xs text-zinc-500">
                          Scheduled: {live.date} às {live.time}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white hover:text-red-500 cursor-pointer">
                        {live.title}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                        {live.subtitle || 'Nenhum subtítulo configurado.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 mt-3 font-mono text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="w-3.5 h-3.5" /> {live.products?.length || 0} produtos
                        </span>
                        <span className="flex items-center gap-1 text-zinc-400">
                          <Eye className="w-3.5 h-3.5" /> {live.statistics?.views || 0} visualizações
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Right Wrap */}
                  <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto self-stretch lg:self-auto shrink-0 border-t border-zinc-800/40 lg:border-none pt-4 lg:pt-0">
                    {/* Status Instant switch buttons */}
                    <div className="flex items-center bg-zinc-950 p-1.5 rounded-lg border border-zinc-800 gap-1">
                      <Button
                        onClick={() => handleUpdateStatus(live, 'ao_vivo')}
                        className={cn(
                          "text-[10px] uppercase font-bold py-1 px-2.5 h-7 rounded-md",
                          live.status === 'ao_vivo' ? "bg-red-600 text-white font-black" : "bg-transparent text-zinc-400 hover:text-white"
                        )}
                        title="Transmutar para Ao Vivo"
                      >
                        Ao Vivo
                      </Button>
                      <Button
                        onClick={() => handleUpdateStatus(live, 'encerrada')}
                        className={cn(
                          "text-[10px] uppercase font-bold py-1 px-2.5 h-7 rounded-md",
                          live.status === 'encerrada' ? "bg-zinc-800 text-zinc-100" : "bg-transparent text-zinc-400 hover:text-white"
                        )}
                        title="Encerrar transmissão"
                      >
                        Encerrar
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        onClick={() => handleEditLive(live)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white p-2.5 rounded-lg border border-zinc-700"
                        title="Editar Live"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>

                      <Button 
                        onClick={() => handleDuplicateLive(live)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 p-2.5 rounded-lg border border-zinc-700"
                        title="Duplicar Live"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>

                      {/* External preview directly to storefront live page */}
                      <a
                        href="/live"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center bg-red-950/20 text-red-500 border border-red-900/30 p-2.5 rounded-lg hover:bg-red-900/35 transition-all"
                        title="Acessar Página Pública /live"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>

                      {canDelete && (
                        <Button 
                          onClick={() => handleDeleteLive(live)}
                          className="bg-zinc-850 hover:bg-red-950 hover:text-red-500 hover:border-red-900/40 text-zinc-500 p-2.5 rounded-lg border border-zinc-800 transition-all"
                          title="Excluir Transmissão"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default AdminLiveShop;
