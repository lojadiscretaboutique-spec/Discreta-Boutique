import { useState, useEffect, useMemo } from 'react';
import { LiveSession, LiveProduct, LiveFlashOffer, LiveKit, LiveCoupon } from '../types/liveShop';
import { liveShopService } from '../services/liveShopService';
import { productService, Product } from '../services/productService';
import { useFeedback } from '../contexts/FeedbackContext';
import { useAuthStore } from '../store/authStore';

const DEFAULT_STATS = {
  views: 0,
  productClicks: 0,
  conversions: 0,
  salesCount: 0,
  revenue: 0,
  couponsUsed: 0,
  avgViewTime: 0,
  clickedProducts: {}
};

export function useLiveShop() {
  const { hasPermission } = useAuthStore();
  const { toast, confirm } = useFeedback();

  const [lives, setLives] = useState<LiveSession[]>([]);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // UI states
  const [showForm, setShowForm] = useState(false);
  const [liveToEdit, setLiveToEdit] = useState<LiveSession | null>(null);
  const [activeTab, setActiveTab] = useState<'dados' | 'produtos' | 'flash' | 'kits' | 'cupons' | 'config' | 'analytics' | 'notifications'>('dados');

  // Form Fields
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState<LiveSession['status']>('agendada');
  const [streamingUrl, setStreamingUrl] = useState('');

  // Settings tab
  const [showCountdown, setShowCountdown] = useState(true);
  const [showRelatedProducts, setShowRelatedProducts] = useState(true);
  const [showFlashOffers, setShowFlashOffers] = useState(true);
  const [showWhatsappButton, setShowWhatsappButton] = useState(true);
  const [showBuyNowButton, setShowBuyNowButton] = useState(true);
  const [enableFloatingPlayer, setEnableFloatingPlayer] = useState(true);
  const [showLiveBadge, setShowLiveBadge] = useState(true);

  // Arrays
  const [linkedProducts, setLinkedProducts] = useState<LiveProduct[]>([]);
  const [flashOffers, setFlashOffers] = useState<LiveFlashOffer[]>([]);
  const [kits, setKits] = useState<LiveKit[]>([]);
  const [coupons, setCoupons] = useState<LiveCoupon[]>([]);

  // Notifications
  const [pushEnabled, setPushEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [targetSegments, setTargetSegments] = useState('all_customers');

  // Permissions
  const canCreate = hasPermission('banners', 'criar');
  const canEdit = hasPermission('banners', 'editar');
  const canDelete = hasPermission('banners', 'excluir');

  // Initial Sync
  useEffect(() => {
    // Subscribe to lives real-time
    const unsubscribe = liveShopService.subscribeToLives(
      (data) => {
        setLives(data);
        setLoading(false);
      },
      () => {
        toast('Erro ao carregar transmissões do Live Shop', 'error');
        setLoading(false);
      }
    );

    // List products
    productService.listProducts().then((prods) => {
      setStoreProducts(prods || []);
    }).catch((err) => {
      console.error('Error fetching catalog products for Live Shop:', err);
    });

    return () => unsubscribe();
  }, []);

  const handleOpenNewForm = () => {
    setLiveToEdit(null);
    setTitle('');
    setSubtitle('');
    setDescription('');
    
    // Clear mock default cover and banner URIs to enforce blank/custom data as requested
    setCoverImage('');
    setBannerImage('');

    const today = new Date();
    setDate(today.toISOString().split('T')[0]);
    setTime(`${String(today.getHours() + 1).padStart(2, '0')}:00`);
    setStatus('agendada');
    
    // Clear placeholder flow to meet requirement: "Remover dados fictícios como link padrão..."
    setStreamingUrl('');

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
    setStreamingUrl(live.streamingUrl || '');

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

  const handleSaveLive = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !streamingUrl.trim()) {
      toast('Preencha o título e a URL da transmissão!', 'warning');
      return;
    }

    try {
      const embedStreamUrl = liveShopService.getEmbedUrl(streamingUrl);
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
        statistics: liveToEdit?.statistics || DEFAULT_STATS,
        notificationConfig: {
          pushEnabled,
          whatsappEnabled,
          emailEnabled,
          targetSegments
        }
      };

      await liveShopService.saveLive({
        ...payload,
        id: liveToEdit?.id
      });

      toast('Transmissão de Live Shop salva com sucesso!', 'success');
      setShowForm(false);
    } catch (err: any) {
      console.error(err);
      toast('Falha ao salvar transmissão: ' + err.message, 'error');
    }
  };

  const handleUpdateStatus = async (live: LiveSession, newStatus: LiveSession['status']) => {
    try {
      await liveShopService.updateStatus(live.id, newStatus);
      const readable = newStatus === 'ao_vivo' ? 'Ao Vivo' : newStatus === 'agendada' ? 'Agendada' : 'Encerrada';
      toast(`Status da live atualizado para "${readable}"`, 'success');
    } catch (error: any) {
      toast('Erro ao alterar status: ' + error.message, 'error');
    }
  };

  const handleDuplicateLive = async (live: LiveSession) => {
    try {
      const duplicated: Omit<LiveSession, 'id'> = {
        title: `Cópia - ${live.title}`,
        subtitle: live.subtitle || '',
        description: live.description || '',
        coverImage: live.coverImage || '',
        bannerImage: live.bannerImage || '',
        date: live.date,
        time: live.time,
        status: 'agendada',
        streamingUrl: live.streamingUrl,
        settings: { ...live.settings },
        products: [...live.products],
        flashOffers: [...live.flashOffers],
        kits: [...live.kits],
        coupons: [...live.coupons],
        statistics: { ...DEFAULT_STATS },
        notificationConfig: live.notificationConfig ? { ...live.notificationConfig } : undefined
      };

      await liveShopService.saveLive(duplicated);
      toast('Transmissão duplicada com sucesso!', 'success');
    } catch (err: any) {
      toast('Erro ao duplicar transmissão: ' + err.message, 'error');
    }
  };

  const handleDeleteLive = async (live: LiveSession) => {
    const ok = await confirm({
      title: 'Excluir Transmissão',
      message: 'Deseja realmente excluir esta transmissão de Live Shop? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      variant: 'danger'
    });
    
    if (!ok) return;

    try {
      await liveShopService.deleteLive(live.id);
      toast('Transmissão excluída definitivamente.', 'success');
    } catch (err: any) {
      toast('Falha ao deletar: ' + err.message, 'error');
    }
  };

  return {
    // Master data
    lives,
    storeProducts,
    loading,

    // Form/UI trigger state
    showForm,
    setShowForm,
    liveToEdit,
    activeTab,
    setActiveTab,

    // Form getters/setters
    title, setTitle,
    subtitle, setSubtitle,
    description, setDescription,
    coverImage, setCoverImage,
    bannerImage, setBannerImage,
    date, setDate,
    time, setTime,
    status, setStatus,
    streamingUrl, setStreamingUrl,

    // Settings getters/setters
    showCountdown, setShowCountdown,
    showRelatedProducts, setShowRelatedProducts,
    showFlashOffers, setShowFlashOffers,
    showWhatsappButton, setShowWhatsappButton,
    showBuyNowButton, setShowBuyNowButton,
    enableFloatingPlayer, setEnableFloatingPlayer,
    showLiveBadge, setShowLiveBadge,

    // Nested structures
    linkedProducts, setLinkedProducts,
    flashOffers, setFlashOffers,
    kits, setKits,
    coupons, setCoupons,

    // Notifications state
    pushEnabled, setPushEnabled,
    whatsappEnabled, setWhatsappEnabled,
    emailEnabled, setEmailEnabled,
    targetSegments, setTargetSegments,

    // Action handlers
    handleOpenNewForm,
    handleEditLive,
    handleSaveLive,
    handleUpdateStatus,
    handleDuplicateLive,
    handleDeleteLive,

    // Permissions helpers
    canCreate,
    canEdit,
    canDelete
  };
}
