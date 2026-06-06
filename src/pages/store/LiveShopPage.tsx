import { useEffect, useState } from 'react';
import { collection, doc, updateDoc, onSnapshot, increment } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCartStore, CartItem } from '../../store/cartStore';
import { useUIStore } from '../../store/uiStore';
import { 
  Radio, Eye, ShoppingCart, ShoppingBag, Zap, Sparkles, 
  Share2, MessageSquare, ShieldAlert, 
  ChevronRight, ArrowRight, Clock
} from 'lucide-react';
import { productService, Product } from '../../services/productService';
import { Button } from '../../components/ui/button';
import { useFeedback } from '../../contexts/FeedbackContext';

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
    discount: number;
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
    discount: number;
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
    avgViewTime: number;
  };
}

export function LiveShopPage() {
  const { toast } = useFeedback();
  const addItem = useCartStore(state => state.addItem);
  const applyCoupon = useCartStore(state => state.applyCoupon);
  const { setFloatingLiveUrl, setFloatingLiveTitle } = useUIStore();

  const [lives, setLives] = useState<LiveSession[]>([]);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected live for main stage view
  const [activeLive, setActiveLive] = useState<LiveSession | null>(null);

  // Simulated live metrics
  const [liveViewers, setLiveViewers] = useState(45);
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const [seconds, setSeconds] = useState('00');

  // Load datasets on mount
  useEffect(() => {
    // Pre-clear floating player upon landing on /live to prevent audio echoes
    setFloatingLiveUrl(null);

    // 1. Listen to lives collection
    const livesRef = collection(db, 'lives');
    const unsubscribe = onSnapshot(livesRef, (snapshot) => {
      const liveList = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as LiveSession[];
      setLives(liveList);
      
      // Determine active target: live or agendada sequence
      const liveRunning = liveList.find(l => l.status === 'ao_vivo');
      const liveScheduled = liveList.find(l => l.status === 'agendada');
      const liveFinished = liveList.find(l => l.status === 'encerrada');
      
      if (liveRunning) {
        setActiveLive(liveRunning);
      } else if (liveScheduled) {
        setActiveLive(liveScheduled);
      } else if (liveFinished) {
        setActiveLive(liveFinished);
      } else if (liveList.length > 0) {
        setActiveLive(liveList[0]);
      }
      setLoading(false);
    });

    // 2. Fetch products details for visual resolved mappings
    productService.listProducts().then(prods => {
      setStoreProducts(prods || []);
    }).catch(err => {
      console.error(err);
    });

    return () => unsubscribe();
  }, []);

  // Sync and launch global floating player if exit and livestream was active
  useEffect(() => {
    return () => {
      if (activeLive && activeLive.status === 'ao_vivo' && activeLive.settings?.enableFloatingPlayer) {
        setFloatingLiveUrl(activeLive.streamingUrl);
        setFloatingLiveTitle(activeLive.title);
      }
    };
  }, [activeLive]);

  // Handle Increments to Views Statistic (Firestore throttle simulation)
  useEffect(() => {
    if (activeLive && activeLive.status === 'ao_vivo') {
      // Small simulated increment of live analytics views locally & on firestore
      try {
        const liveDocRef = doc(db, 'lives', activeLive.id);
        updateDoc(liveDocRef, {
          'statistics.views': increment(1)
        });
      } catch (e) {
        // silent safe catch
      }

      // Viewer simulation
      const interval = setInterval(() => {
        setLiveViewers(prev => {
          const delta = Math.floor(Math.random() * 5) - 2; // -2 to +2
          const next = prev + delta;
          return next > 10 ? next : 12;
        });
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [activeLive?.id, activeLive?.status]);

  // Countdown timer calculation for scheduled pages
  useEffect(() => {
    if (activeLive && activeLive.status === 'agendada') {
      const calcTimer = () => {
        const targetStr = `${activeLive.date}T${activeLive.time || '20:00'}:00`;
        const target = new Date(targetStr).getTime();
        const now = new Date().getTime();
        const difference = target - now;

        if (difference <= 0) {
          setHours('00');
          setMinutes('00');
          setSeconds('00');
          return;
        }

        const hrs = Math.floor(difference / (1000 * 60 * 60));
        const mins = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((difference % (1000 * 60)) / 1000);

        setHours(String(hrs).padStart(2, '0'));
        setMinutes(String(mins).padStart(2, '0'));
        setSeconds(String(secs).padStart(2, '0'));
      };

      calcTimer();
      const interval = setInterval(calcTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [activeLive?.id, activeLive?.status, activeLive?.date, activeLive?.time]);

  // Action Button Fast Add To Cart
  const handleAddToCart = async (product: Product, specialPrice?: number) => {
    if (!product || !product.id) return;
    
    // Increment product click count on live document statistics
    if (activeLive) {
      try {
        const liveDocRef = doc(db, 'lives', activeLive.id);
        const clicksKey = `statistics.clickedProducts.${product.id}`;
        updateDoc(liveDocRef, {
          'statistics.productClicks': increment(1),
          [clicksKey]: increment(1)
        });
      } catch (err) {
        // silent safe
      }
    }

    const cartItem: CartItem = {
      id: `${product.id}_live`, // Unique cart key
      productId: product.id,
      name: `[Live Special] ${product.name}`,
      price: specialPrice !== undefined ? specialPrice : product.promoPrice || product.price,
      originalPrice: product.price,
      imageUrl: product.images?.[0]?.url || '',
      quantity: 1,
      sku: product.sku
    };

    addItem(cartItem);
    toast({
      type: 'success',
      text: `🛒 "${product.name}" adicionado ao carrinho com preço exclusivo de Live!`
    });
  };

  // Fast Apply live Coupon to shopping cart helper
  const handleClaimCoupon = (code: string, pctDiscount: number) => {
    // Claim analytics update doc
    if (activeLive) {
      try {
        const liveDocRef = doc(db, 'lives', activeLive.id);
        updateDoc(liveDocRef, {
          'statistics.couponsUsed': increment(1)
        });
      } catch (e) {}
    }

    applyCoupon({
      code: code.toUpperCase(),
      type: 'percentage',
      value: pctDiscount
    });

    toast({
      type: 'success',
      text: `🎟️ Cupom "${code}" aplicado automaticamente ao seu carrinho com ${pctDiscount}% de desconto final!`
    });
  };

  // Combo kit purchase action
  const handleClaimKitCombo = (kit: LiveSession['kits']) => {
    kit.productIds.forEach(pId => {
      const prod = storeProducts.find(p => p.id === pId);
      if (prod) {
        // Add individual products but customized with kit discount share
        const fairSharePrice = prod.price * (kit.price / kit.originalPrice);
        const cartItem: CartItem = {
          id: `${prod.id}_kit_${kit.id}`,
          productId: prod.id,
          name: `[Kit ${kit.name}] ${prod.name}`,
          price: Math.round(fairSharePrice * 100) / 100,
          originalPrice: prod.price,
          imageUrl: prod.images?.[0]?.url || '',
          quantity: 1,
          sku: prod.sku
        };
        addItem(cartItem);
      }
    });

    toast({
      type: 'success',
      text: `🎁 Impressionante! Todos os itens do Combo "${kit.name}" foram inseridos no seu carrinho pelo valor promocional!`
    });
  };

  const handleShareLive = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({ type: 'success', text: 'Enlace de transmissão copiado para compartilhamento!' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-36 gap-4 bg-zinc-950 text-white min-h-screen">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 font-medium font-sans">Sintonizando canais Discreta Live Shop...</p>
      </div>
    );
  }

  // Fallback if truly no live database document was loaded
  if (!activeLive) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-500 mb-4">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white italic uppercase tracking-wider">Nenhuma Transmissão no Ar</h2>
        <p className="text-zinc-500 text-sm max-w-md mt-2">
          Não há transmissões agendadas ou gravadas no momento. Retorne em breve para assistir a ofertas exclusivas!
        </p>
        <Button onClick={() => window.location.href = '/catalogo'} className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-8 rounded-lg mt-6">
          Navegar no Catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans select-none" id="store-liveshop-public-screen">
      
      {/* Banner Principal Top Header (Desktop layout decor) */}
      {activeLive.bannerImage && (
        <div className="hidden lg:block h-60 w-full relative overflow-hidden border-b border-zinc-900 bg-zinc-950">
          <img 
            src={activeLive.bannerImage} 
            alt={activeLive.title} 
            className="w-full h-full object-cover opacity-35 filter blur-xs" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          <div className="absolute bottom-8 left-10 max-w-4xl">
            <span className="text-[10px] bg-red-600 text-white font-extrabold tracking-[4px] py-1 px-3 rounded uppercase mb-2 inline-block">
              Live Commerce Exclusivo
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-white uppercase drop-shadow-md">
              {activeLive.title}
            </h1>
            <p className="text-zinc-400 mt-2 text-sm">{activeLive.subtitle}</p>
          </div>
        </div>
      )}

      {/* Main Responsive Layout Wrapper */}
      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN/MIDCOLUMN - Player and Countdown controls */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main live title display (Mobile visible top) */}
          <div className="lg:hidden">
            <div className="flex items-center gap-2 mb-1.5">
              {activeLive.status === 'ao_vivo' ? (
                <span className="flex items-center gap-1.5 bg-red-600 text-white text-[9px] font-black px-2.5 py-0.5 rounded uppercase tracking-widest animate-pulse">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                  AO VIVO
                </span>
              ) : (
                <span className="bg-zinc-800 text-zinc-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                  {activeLive.status === 'agendada' ? 'Breve' : 'Encerrada'}
                </span>
              )}
              <span className="text-xs text-zinc-500 font-medium">Programação: {activeLive.date} às {activeLive.time}</span>
            </div>
            <h1 className="text-xl font-bold text-white uppercase tracking-tight">{activeLive.title}</h1>
          </div>

          {/* PLAYER COMPONENT */}
          <div className="bg-black rounded-2xl overflow-hidden border border-zinc-900 shadow-2xl relative aspect-video" id="live-main-player-stage">
            {activeLive.status === 'ao_vivo' ? (
              /* IFRAME STREAM PLAYER */
              <div className="w-full h-full relative">
                <iframe
                  src={activeLive.streamingUrl}
                  title="Discreta Live Shop Stream"
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />

                {/* Overlaid Indicators (e.g. viewers bar and Live Badge) */}
                <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none select-none">
                  {activeLive.settings?.showLiveBadge && (
                    <span className="bg-red-600 text-white font-black text-[10px] tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5 shadow-[0_4px_12px_rgba(220,38,38,0.5)] uppercase animate-pulse">
                      <span className="w-2 h-2 bg-white rounded-full animate-ping" />
                      • AO VIVO
                    </span>
                  )}

                  <span className="bg-black/60 backdrop-blur-md text-white font-mono text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5 text-zinc-400" /> {liveViewers} assistindo
                  </span>
                </div>

                <button 
                  onClick={handleShareLive}
                  className="absolute top-4 right-4 bg-black/60 hover:bg-black/85 backdrop-blur-md text-white p-2 rounded-full transition-all border border-zinc-800/60"
                  title="Compartilhar Link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            ) : activeLive.status === 'agendada' ? (
              /* COUNTDOWN PREPARATION SCREEN */
              <div 
                className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-950 border border-zinc-900 bg-cover bg-center"
                style={{ 
                  backgroundImage: activeLive.coverImage ? `linear-gradient(rgba(9, 9, 11, 0.9), rgba(9, 9, 11, 0.98)), url(${activeLive.coverImage})` : 'none' 
                }}
              >
                <div className="p-3 bg-zinc-900 text-red-500 rounded-full mb-4 animate-bounce">
                  <Clock className="w-8 h-8" />
                </div>
                
                <h3 className="text-zinc-400 text-xs font-black tracking-[4px] uppercase mb-2">A Transmissão Começará Em</h3>
                
                {/* Timer Clock */}
                <div className="flex items-center gap-3 md:gap-5 mb-6">
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl min-w-[70px]">
                    <span className="block text-3xl font-black text-white font-mono">{hours}</span>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-widest">Horas</span>
                  </div>
                  <span className="text-xl text-zinc-500 font-bold">:</span>
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl min-w-[70px]">
                    <span className="block text-3xl font-black text-white font-mono">{minutes}</span>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-widest">Minutos</span>
                  </div>
                  <span className="text-xl text-zinc-500 font-bold">:</span>
                  <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl min-w-[70px]">
                    <span className="block text-3xl font-black text-white font-mono">{seconds}</span>
                    <span className="text-[9px] text-zinc-500 block uppercase font-bold tracking-widest">Segundos</span>
                  </div>
                </div>

                <p className="text-zinc-500 text-xs max-w-sm">
                  Programe seu despertador! Esta live irá desvendar cupons de até 50% de descontos relâmpago.
                </p>

                <div className="mt-6 flex flex-wrap gap-4 justify-center">
                  <Button 
                    onClick={handleShareLive}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Compartilhar Convite
                  </Button>
                </div>
              </div>
            ) : (
              /* ENCLOSED REPLAY SCREEN */
              <div 
                className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-zinc-950"
                style={{ 
                  backgroundImage: activeLive.coverImage ? `linear-gradient(rgba(9, 9, 11, 0.85), rgba(9, 9, 11, 0.95)), url(${activeLive.coverImage})` : 'none',
                  backgroundSize: 'cover'
                }}
              >
                <div className="w-14 h-14 bg-zinc-900/40 rounded-full flex items-center justify-center border border-zinc-800 mb-4 text-zinc-400">
                  <Radio className="w-6 h-6 text-zinc-400" />
                </div>
                <h3 className="text-xl font-black text-white uppercase italic tracking-wider">Transmissão Encerrada</h3>
                <p className="text-zinc-400 text-xs mt-1 max-w-sm mx-auto">
                  Esta live shop terminou, mas as ofertas integradas abaixo continuam disponíveis por tempo promocional limitado. Aproveite!
                </p>
                
                <iframe
                  src={activeLive.streamingUrl}
                  title="Discreta Replay Stream"
                  className="w-0 h-0 hidden"
                />
              </div>
            )}
          </div>

          {/* Description Block */}
          <div className="bg-zinc-900 p-5 rounded-2xl border border-zinc-850 space-y-3">
            <div className="hidden lg:block">
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">{activeLive.title}</h1>
              <p className="text-red-500 font-semibold text-xs mt-1">{activeLive.subtitle}</p>
            </div>
            
            <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap">
              {activeLive.description || 'Assista nossa live transmitida e confira abaixo as ofertas sensuais e peças de boutique exclusivas com frete garantido e sigilo absoluto.'}
            </p>

            {/* Simulated Live Interactions panel (only active on Live session) */}
            {activeLive.status === 'ao_vivo' && (
              <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-855 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" /> Chat exclusivo no app ativo
                </span>
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  Conexão segura ponto-a-ponto
                </span>
              </div>
            )}
          </div>

          {/* FLASH OFFERS TIMER MODULE */}
          {activeLive.settings?.showFlashOffers && activeLive.flashOffers?.length > 0 && (
            <div className="bg-gradient-to-r from-red-600/10 to-transparent p-5 rounded-2xl border border-red-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-red-950/40 pb-2">
                <h3 className="text-zinc-100 font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 animate-pulse" /> OFERTA RELÂMPAGO FLASH ATIVA!
                </h3>
                <span className="text-[9px] bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded uppercase">
                  Estoque Extremamente Limitado
                </span>
              </div>

              <div className="space-y-4">
                {activeLive.flashOffers.map((fo, idx) => {
                  const prod = storeProducts.find(p => p.id === fo.productId);
                  if (!prod) return null;
                  
                  const livePrice = activeLive.products.find(p => p.productId === fo.productId)?.livePrice || prod.price;
                  const discountedPrice = Math.round(livePrice * (1 - fo.discount / 100) * 100) / 100;

                  return (
                    <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-zinc-950 rounded-xl border border-zinc-900 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 bg-zinc-900 border border-zinc-800 rounded overflow-hidden flex items-center justify-center shrink-0">
                          {prod.images?.[0]?.url ? (
                            <img src={prod.images[0].url} alt={prod.name} className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-5 h-5 text-zinc-600" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{prod.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-500 line-through">R$ {livePrice.toFixed(2)}</span>
                            <span className="text-sm font-black text-amber-500">R$ {discountedPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-500 block uppercase font-bold">Apenas Restantes</span>
                          <span className="text-xs font-black text-red-500 font-mono">2 de {fo.promoStock} unidades</span>
                        </div>
                        
                        <Button 
                          onClick={() => handleAddToCart(prod, discountedPrice)}
                          className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black h-9 text-xs px-4 rounded-lg shadow-md"
                        >
                          Pegar Oferta!
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KITS E COMBOS DA LIVE LIST */}
          {activeLive.kits && activeLive.kits.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase text-white tracking-widest flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-500" /> COMBOS PROMOCIONAIS EXCLUSIVOS
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeLive.kits.map((k, idx) => (
                  <div key={idx} className="bg-zinc-90 w bg-zinc-900 p-5 rounded-2xl border border-zinc-850 flex flex-col justify-between relative overflow-hidden group">
                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[8px] font-black tracking-widest px-3 py-1 rounded-bl uppercase">
                      Combo Casal
                    </span>

                    <div>
                      <h4 className="font-extrabold text-white text-base mb-1 group-hover:text-red-500 transition-colors">
                        {k.name}
                      </h4>
                      <p className="text-xs text-zinc-400">
                        Kit consolidando {k.productIds.length} produtos premium da live.
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-4 text-xs font-mono">
                        <span className="text-zinc-500 line-through">Soma: R$ {k.originalPrice.toFixed(2)}</span>
                        <span className="text-green-500 font-bold bg-green-950/25 px-2 py-0.5 rounded">
                          Economize: R$ {k.savings.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-zinc-800/40 pt-4">
                      <strong className="text-xl font-black text-white font-mono">R$ {k.price.toFixed(2)}</strong>
                      
                      <Button
                        onClick={() => handleClaimKitCombo(k)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-9 px-4 rounded-lg flex items-center gap-1 transition-all"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Adicionar Kit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - PRODUCTS LIST & WhatsApp Supports */}
        <div className="space-y-6">
          
          {/* LIVE STREAM EXCLUSIVE COUPONS */}
          {activeLive.coupons && activeLive.coupons.length > 0 && (
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 rounded-2xl border border-dashed border-zinc-800 space-y-4">
              <span className="text-[9px] bg-emerald-950 text-emerald-400 font-black border border-emerald-900/50 px-2 py-0.5 rounded uppercase tracking-widest inline-block">
                Cupom Exclusivo
              </span>
              
              <div className="space-y-3">
                {activeLive.coupons.map((c, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleClaimCoupon(c.code, c.discount)}
                    className="bg-zinc-900 hover:bg-zinc-850 p-4 rounded-xl border border-zinc-800 flex justify-between items-center cursor-pointer transition-all hover:scale-[1.02] select-none"
                    title="Clique para copiar e aplicar automaticamente ao carrinho!"
                  >
                    <div>
                      <span className="font-mono text-xs uppercase tracking-widest font-black text-emerald-400 block">🎟️ {c.code}</span>
                      <strong className="text-2xl font-black text-white mt-1 block">{c.discount}% OFF</strong>
                      <span className="text-[10px] text-zinc-500 block mt-1 uppercase font-bold tracking-wider">Clique para Aplicar</span>
                    </div>

                    <div className="p-2 bg-emerald-950/20 text-emerald-400 rounded-lg">
                      <ChevronRight className="w-5 h-5 text-emerald-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DESTACADO PRINCIPAL CARD */}
          {activeLive.settings?.showRelatedProducts && activeLive.products?.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-zinc-500 tracking-widest">PRODUTOS VINCULADOS À LIVE</h3>
              
              <div className="grid grid-cols-1 gap-4">
                {activeLive.products.map(lp => {
                  const product = storeProducts.find(p => p.id === lp.productId);
                  if (!product) return null;

                  const finalPrice = lp.livePrice !== undefined ? lp.livePrice : product.promoPrice || product.price;
                  const discountPct = Math.round(((product.price - finalPrice) / product.price) * 100);

                  return (
                    <div 
                      key={lp.productId}
                      className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-850 p-4 hover:shadow-lg transition-all flex gap-3 relative group"
                    >
                      {/* Badge special label overlay */}
                      {lp.seloEspecial && (
                        <span className="absolute top-2 right-2 bg-red-600 text-white font-black text-[7px] tracking-wider py-0.5 px-2 rounded uppercase font-mono z-10 animate-pulse">
                          {lp.seloEspecial}
                        </span>
                      )}

                      {/* Product image */}
                      <div className="h-24 w-20 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden shrink-0 flex items-center justify-center relative">
                        {product.images?.[0]?.url ? (
                          <img src={product.images[0].url} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <ShoppingBag className="w-6 h-6 text-zinc-700" />
                        )}

                        {discountPct > 0 && (
                          <span className="absolute bottom-1 left-1 bg-amber-500 text-zinc-950 text-[8px] font-black px-1.5 rounded">
                            {discountPct}% OFF
                          </span>
                        )}
                      </div>

                      {/* Product copy info */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-white text-xs leading-snug line-clamp-2">
                            {product.name}
                          </h4>
                          {lp.textPromocional && (
                            <span className="text-[10px] text-zinc-400 font-semibold italic mt-0.5 block">{lp.textPromocional}</span>
                          )}
                          
                          <div className="flex items-baseline gap-2 mt-2">
                            <span className="text-xs text-zinc-500 line-through font-mono">R$ {product.price.toFixed(2)}</span>
                            <span className="text-sm font-black text-white font-mono">R$ {finalPrice.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* CTA Options */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-800/40">
                          <Button
                            onClick={() => handleAddToCart(product, finalPrice)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold h-7 rounded px-2"
                          >
                            Comprar Agora
                          </Button>
                          <a
                            href={`/produto/${product.id}`}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold h-7 rounded px-2 inline-flex items-center justify-center"
                          >
                            Ver Detalhes
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WHATSAPP CONSULTANT CTA HELPERS */}
          {activeLive.settings?.showWhatsappButton && (
            <div className="bg-emerald-950/20 border border-emerald-900/40 p-5 rounded-2xl flex flex-col items-center text-center gap-3">
              <span className="p-3 bg-emerald-950/40 text-emerald-400 rounded-full border border-emerald-900/30">
                <MessageSquare className="w-6 h-6" />
              </span>
              <div>
                <h4 className="font-bold text-white text-sm">Fale com nossas consultoras ao vivo!</h4>
                <p className="text-[11px] text-zinc-500 mt-1">Dúvidas sobre tamanhos ou sigilo da embalagem? Clique e inicie um atendimento prioritário.</p>
              </div>
              <a
                href="https://wa.me/5588992340317?text=Oi! Estou assistindo a Live Shop da Discreta e quero tirar uma dúvida!"
                target="_blank"
                rel="noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 rounded-lg text-center shadow-lg transition-all"
              >
                Atendimento no WhatsApp
              </a>
            </div>
          )}

          {/* PREVIOUS REPLAYS LIST */}
          {lives.filter(l => l.id !== activeLive.id).length > 0 && (
            <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-850 space-y-4">
              <h4 className="text-xs font-black uppercase text-zinc-500 tracking-wider">Outras Transmissões (Gravadas)</h4>
              
              <div className="space-y-3">
                {lives.filter(l => l.id !== activeLive.id).map(live => (
                  <div 
                    key={live.id}
                    onClick={() => setActiveLive(live)}
                    className="p-3 bg-zinc-900 hover:bg-zinc-850 rounded-xl border border-zinc-800 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="h-10 w-8 bg-zinc-950 border border-zinc-800 rounded overflow-hidden shrink-0">
                        {live.coverImage ? (
                          <img src={live.coverImage} alt={live.title} className="h-full w-full object-cover" />
                        ) : (
                          <Radio className="w-5 h-5 text-zinc-700 m-2" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <span className="text-[8px] bg-zinc-800 text-zinc-400 font-bold px-1.5 rounded uppercase">{live.status}</span>
                        <h5 className="font-bold text-white text-xs whitespace-nowrap overflow-hidden text-ellipsis mt-1">{live.title}</h5>
                      </div>
                    </div>

                    <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default LiveShopPage;
