import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Timer, Flame, ChevronLeft, ChevronRight, TrendingUp, Sparkles, Plus, Minus, ShieldCheck, Truck, ArrowRight } from 'lucide-react';
import { Product } from '../../services/productService';
import { ProductItemCard } from '../ui/ProductItemCard';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { useCartStore } from '../../store/cartStore';
import { usePromotion } from '../../contexts/PromotionContext';
import { formatCurrency, cn } from '../../lib/utils';
import { productService } from '../../services/productService';
import { useTheme } from '../../contexts/ThemeContext';

interface LimitedPromoSectionProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  products: Product[];
  endDate?: string;
  endTime?: string;
  themeColor?: string;
  themeBg?: string;
  layout?: any;
}

export function LimitedPromoSection({
  title,
  subtitle,
  emoji = '⚡',
  products,
  endDate,
  endTime,
  themeColor = '#ef4444',
  themeBg = '#0c0202',
  layout
}: LimitedPromoSectionProps) {
  const { currentTheme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [simulatedSales, setSimulatedSales] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore(s => s.addItem);
  const { calculateProductPrice } = usePromotion();
  const navigate = useNavigate();

  // 1. Live Countdown Timer Calculation
  useEffect(() => {
    if (!endDate) {
      setTimeLeft(null);
      return;
    }

    const endStr = `${endDate}T${endTime || '23:59'}:59`;
    const targetDate = new Date(endStr).getTime();

    const calculate = () => {
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (diff <= 0) {
        setTimeLeft(null);
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ d, h, m, s });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [endDate, endTime]);

  // 2. Mock sales progress bars depending on product IDs (to create high-fidelity purchase urgency)
  useEffect(() => {
    const freshSales: Record<string, number> = {};
    products.forEach(p => {
      if (p.id) {
        // Deterministic pseudo-random progress based on the ID hash
        let hash = 0;
        for (let i = 0; i < p.id.length; i++) {
          hash = p.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        const percentage = Math.abs(hash % 35) + 55; // between 55% and 90%
        freshSales[p.id] = percentage;
      }
    });
    setSimulatedSales(freshSales);
  }, [products]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth : scrollLeft + clientWidth;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!products || products.length === 0) return null;

  const isVertical = layout?.orientation === 'vertical';
  const isSingleProduct = products.length === 1;

  const formatUnit = (num: number) => String(num).padStart(2, '0');

  // Logic for Single Product Highlight
  const singleProduct = products[0];
  const solvePercentSingle = singleProduct?.id ? (simulatedSales[singleProduct.id] || 82) : 82;
  const stockLeftSingle = Math.max(2, Math.ceil((100 - solvePercentSingle) / 5));

  const pricingSingle = singleProduct ? calculateProductPrice({
    id: singleProduct.id!,
    categoryId: singleProduct.categoryId,
    price: singleProduct.price,
    promoPrice: singleProduct.promoPrice
  }) : null;

  const mainImageSingle = singleProduct ? (singleProduct.images?.find(i => i.isMain)?.url || singleProduct.images?.[0]?.url) : undefined;
  const originalPriceSingle = pricingSingle?.originalPrice || 0;
  const finalPriceSingle = pricingSingle?.price || 0;
  const hasPromoSingle = singleProduct && ((!!singleProduct.promoPrice && singleProduct.promoPrice < singleProduct.price) || !!pricingSingle?.promotion);
  const discountPctSingle = originalPriceSingle && finalPriceSingle 
    ? Math.round(((originalPriceSingle - finalPriceSingle) / originalPriceSingle) * 100) 
    : 0;

  const handleSingleBuyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!singleProduct) return;

    if (singleProduct.id) {
      productService.trackInteraction(singleProduct.id, 'click');
    }

    if ((singleProduct as any).isCombo) {
      addItem({
        id: `combo-${singleProduct.id}`,
        productId: singleProduct.id!,
        name: singleProduct.name,
        price: finalPriceSingle,
        quantity,
        sku: singleProduct.sku || '',
        gtin: singleProduct.gtin || '',
        imageUrl: mainImageSingle || '',
        isCombo: true,
        comboId: singleProduct.id,
        isFreeShipping: pricingSingle?.isFreeShipping
      });
      navigate('/carrinho');
      return;
    }

    if (singleProduct.hasVariants) {
      navigate(`/produto/${singleProduct.seo?.slug || singleProduct.id}?id=${singleProduct.id}`);
    } else {
      addItem({
        id: `${singleProduct.id}-base`,
        productId: singleProduct.id!,
        name: singleProduct.name,
        price: finalPriceSingle,
        quantity,
        sku: singleProduct.sku,
        gtin: singleProduct.gtin,
        imageUrl: mainImageSingle || '',
        variantId: undefined,
        variantName: undefined,
        isFreeShipping: pricingSingle?.isFreeShipping,
        categoryId: singleProduct.categoryId,
        originalPrice: originalPriceSingle,
        promoPrice: singleProduct.promoPrice,
        promoAllowedPaymentMethods: pricingSingle?.promotion?.allowedPaymentMethods || [],
        promotionId: pricingSingle?.promotion?.id
      });
      navigate('/carrinho');
    }
  };

  return (
    <section
      style={{ backgroundColor: themeBg }}
      className="relative py-10 md:py-16 border-y border-zinc-900/60 overflow-hidden w-full select-none"
    >
      {/* Visual glowing accents */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-zinc-900/30 rounded-full blur-[180px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
        
        {/* UPPER HEADER */}
        <div 
          style={{ borderColor: `${currentTheme.backgroundTextColor}15` }}
          className="flex flex-col lg:flex-row items-center justify-between gap-6 mb-10 pb-8 border-b"
        >
          <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
            {/* Glowing Flame Badge */}
            <div 
              style={{ 
                backgroundColor: currentTheme.primaryColor,
                boxShadow: `0 0 30px ${currentTheme.primaryColor}40`
              }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white animate-pulse"
            >
              <Flame size={28} style={{ color: currentTheme.primaryTextColor, fill: currentTheme.primaryTextColor }} />
            </div>

            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start">
                {emoji && <span className="text-xl md:text-2xl">{emoji}</span>}
                <h2 
                  style={{ color: currentTheme.primaryColor }}
                  className="text-2xl md:text-4xl font-extrabold uppercase italic tracking-tighter text-shadow-glow"
                >
                  {title}
                </h2>
                <span 
                  style={{ backgroundColor: currentTheme.primaryColor, color: currentTheme.primaryTextColor }}
                  className="text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full animate-bounce"
                >
                  Flash Sale
                </span>
              </div>
              {subtitle && (
                <p 
                  style={{ color: currentTheme.backgroundTextColor, opacity: 0.7 }}
                  className="text-sm mt-2 max-w-lg tracking-wide leading-relaxed"
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* DYNAMIC TIMEOUT TIMER */}
          {timeLeft ? (
            <div 
              style={{ 
                backgroundColor: currentTheme.cardColor, 
                borderColor: `${currentTheme.cardTextColor}15` 
              }}
              className="flex flex-col sm:flex-row items-center gap-3.5 border px-6 py-3.5 rounded-3xl shadow-2xl backdrop-blur-md"
            >
              <div 
                style={{ color: currentTheme.primaryColor }}
                className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest shrink-0"
              >
                <Timer size={15} className="animate-spin" style={{ animationDuration: '8s' }} />
                <span>Encerra em:</span>
              </div>

              <div className="flex items-center gap-2 font-mono font-extrabold text-xs">
                {timeLeft.d > 0 && (
                  <>
                    <div className="flex flex-col items-center">
                      <div 
                        style={{ backgroundColor: currentTheme.primaryColor, color: currentTheme.primaryTextColor }}
                        className="font-black text-sm md:text-base rounded-xl px-2.5 py-1.5 shadow-md w-10 text-center"
                      >
                        {formatUnit(timeLeft.d)}
                      </div>
                      <span style={{ color: currentTheme.cardTextColor, opacity: 0.6 }} className="text-[7px] font-bold uppercase mt-1">Dias</span>
                    </div>
                    <span style={{ color: currentTheme.primaryColor }} className="opacity-70 -mt-4 text-sm font-bold animate-pulse">:</span>
                  </>
                )}
                <div className="flex flex-col items-center">
                  <div 
                    style={{ backgroundColor: currentTheme.backgroundColor, borderColor: `${currentTheme.cardTextColor}15`, color: currentTheme.primaryColor }}
                    className="border font-black text-sm md:text-base rounded-xl px-2.5 py-1.5 shadow-md w-10 text-center"
                  >
                    {formatUnit(timeLeft.h)}
                  </div>
                  <span style={{ color: currentTheme.cardTextColor, opacity: 0.6 }} className="text-[7px] font-bold uppercase mt-1">Horas</span>
                </div>
                <span style={{ color: currentTheme.cardTextColor, opacity: 0.4 }} className="-mt-4 text-sm font-bold animate-pulse">:</span>
                <div className="flex flex-col items-center">
                  <div 
                    style={{ backgroundColor: currentTheme.backgroundColor, borderColor: `${currentTheme.cardTextColor}15`, color: currentTheme.primaryColor }}
                    className="border font-black text-sm md:text-base rounded-xl px-2.5 py-1.5 shadow-md w-10 text-center"
                  >
                    {formatUnit(timeLeft.m)}
                  </div>
                  <span style={{ color: currentTheme.cardTextColor, opacity: 0.6 }} className="text-[7px] font-bold uppercase mt-1">Min</span>
                </div>
                <span style={{ color: currentTheme.cardTextColor, opacity: 0.4 }} className="-mt-4 text-sm font-bold animate-pulse">:</span>
                <div className="flex flex-col items-center">
                  <div 
                    style={{ backgroundColor: currentTheme.backgroundColor, borderColor: `${currentTheme.cardTextColor}15`, color: currentTheme.primaryColor }}
                    className="border font-black text-sm md:text-base rounded-xl px-2.5 py-1.5 shadow-md w-10 text-center"
                  >
                    {formatUnit(timeLeft.s)}
                  </div>
                  <span style={{ color: currentTheme.cardTextColor, opacity: 0.6 }} className="text-[7px] font-bold uppercase mt-1">Seg</span>
                </div>
              </div>
            </div>
          ) : (
            <div 
              style={{ backgroundColor: currentTheme.cardColor, borderColor: `${currentTheme.cardTextColor}12` }}
              className="border px-6 py-3 rounded-2xl text-zinc-400 font-extrabold text-xs uppercase tracking-wider flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-zinc-500 animate-ping" />
              Oferta encerrada ou indisponível
            </div>
          )}
        </div>

        {/* SINGLE FEATURED PRODUCT SHOWCASE */}
        {isSingleProduct && singleProduct ? (
          <div className="w-full">
            <div 
              style={{ 
                backgroundColor: currentTheme.cardColor, 
                color: currentTheme.cardTextColor,
                borderColor: `${currentTheme.primaryColor}20`
              }}
              className="border rounded-[2.5rem] overflow-hidden backdrop-blur-md relative shadow-3xl p-6 md:p-12 transition-all duration-700"
            >
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center">
                
                {/* Product Image Stage */}
                <div className="lg:col-span-5 relative w-full flex items-center justify-center">
                  <Link 
                    to={`/produto/${singleProduct.seo?.slug || singleProduct.id}?id=${singleProduct.id}`}
                    style={{ 
                      backgroundColor: currentTheme.backgroundColor, 
                      borderColor: `${currentTheme.cardTextColor}10` 
                    }}
                    className="relative w-full aspect-square rounded-[2rem] overflow-hidden border group block"
                  >
                    {mainImageSingle ? (
                      <ResponsiveImage 
                        src={mainImageSingle} 
                        alt={singleProduct.name} 
                        className="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-zinc-650 text-xs uppercase tracking-widest font-black italic">Sem imagem</div>
                    )}

                    {/* Highly dynamic discount badge on image */}
                    {discountPctSingle > 0 && (
                      <div 
                        style={{ backgroundColor: currentTheme.primaryColor, color: currentTheme.primaryTextColor }}
                        className="absolute top-4 left-4 z-10 font-black text-xs uppercase tracking-widest px-4 py-2 rounded-2xl shadow-xl animate-pulse"
                      >
                        SÓ HOJE -{discountPctSingle}%
                      </div>
                    )}

                    {/* Atmosphere overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </Link>

                  {/* Tiny glowing asset underneath */}
                  <div 
                    style={{ backgroundColor: `${currentTheme.primaryColor}15` }}
                    className="absolute -bottom-6 w-3/4 h-6 rounded-full blur-2xl pointer-events-none" 
                  />
                </div>

                {/* Product Selling Area */}
                <div className="lg:col-span-7 flex flex-col justify-center w-full">
                  
                  {/* Status Indicator Bar */}
                  <div className="flex flex-wrap items-center gap-2.5 mb-4">
                    <span 
                      style={{ 
                        backgroundColor: currentTheme.backgroundColor, 
                        color: currentTheme.primaryColor,
                        borderColor: `${currentTheme.primaryColor}30`
                      }}
                      className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-xl border"
                    >
                      <Sparkles size={11} className="animate-spin" style={{ color: currentTheme.primaryColor, animationDuration: '4s' }} />
                      DESTAQUE EXCLUSIVO
                    </span>

                    {pricingSingle?.isFreeShipping && (
                      <span 
                        style={{ 
                          backgroundColor: `${currentTheme.primaryColor}10`,
                          borderColor: `${currentTheme.primaryColor}40`,
                          color: currentTheme.primaryColor
                        }}
                        className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl border"
                      >
                        <Truck size={12} /> Frete Grátis
                      </span>
                    )}
                  </div>

                  {/* Main Product Title */}
                  <Link 
                    to={`/produto/${singleProduct.seo?.slug || singleProduct.id}?id=${singleProduct.id}`}
                    style={{ color: currentTheme.cardTextColor }}
                    className="hover:opacity-85 transition-opacity"
                  >
                    <h3 className="text-xl md:text-3xl lg:text-4xl font-extrabold uppercase tracking-tight leading-tight line-clamp-3 mb-4">
                      {singleProduct.name.toLowerCase()}
                    </h3>
                  </Link>

                  {/* Interactive urgency indicator */}
                  <div 
                    style={{ 
                      backgroundColor: currentTheme.backgroundColor, 
                      borderColor: `${currentTheme.cardTextColor}10` 
                    }}
                    className="border p-4 rounded-2xl mb-6"
                  >
                    <div 
                      style={{ color: currentTheme.cardTextColor }}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 text-xs font-bold mb-3"
                    >
                      <span className="flex items-center gap-1.5 opacity-90">
                        <TrendingUp size={14} style={{ color: currentTheme.primaryColor }} className="shrink-0 animate-pulse" />
                        Apenas <span style={{ color: currentTheme.primaryColor }} className="font-extrabold">{stockLeftSingle} unidades</span> em estoque
                      </span>
                      <span className="flex items-center gap-1 opacity-90 sm:self-auto self-start">
                        <span style={{ color: currentTheme.primaryColor }} className="font-extrabold">{solvePercentSingle}%</span> resgatado
                      </span>
                    </div>

                    <div 
                      style={{ backgroundColor: `${currentTheme.cardTextColor}15` }}
                      className="w-full h-2 rounded-full overflow-hidden"
                    >
                      <div 
                        style={{ 
                          width: `${solvePercentSingle}%`,
                          backgroundColor: currentTheme.primaryColor,
                          boxShadow: `0 0 10px ${currentTheme.primaryColor}60`
                        }}
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                      />
                    </div>
                  </div>

                  {/* Full pricing cluster optimized for conversion */}
                  <div className="flex flex-col gap-1 mb-8">
                    {hasPromoSingle && (
                      <span 
                        style={{ color: currentTheme.cardTextColor, opacity: 0.5 }}
                        className="text-xs md:text-sm font-bold line-through tracking-wider"
                      >
                        De {formatCurrency(originalPriceSingle)}
                      </span>
                    )}

                    <div className="flex items-baseline gap-2">
                      <span style={{ color: currentTheme.cardTextColor, opacity: 0.6 }} className="text-xs font-bold uppercase tracking-wide">Por apenas</span>
                      <span style={{ color: currentTheme.primaryColor }} className="text-3xl md:text-5xl font-black tracking-tighter">
                        {formatCurrency(finalPriceSingle)}
                      </span>
                      <span 
                        style={{ 
                          backgroundColor: `${currentTheme.primaryColor}15`, 
                          color: currentTheme.primaryColor,
                          borderColor: `${currentTheme.primaryColor}30`
                        }}
                        className="border text-[9px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider"
                      >
                        no PIX
                      </span>
                    </div>

                    <p style={{ color: currentTheme.cardTextColor, opacity: 0.8 }} className="text-xs font-bold uppercase tracking-wide mt-1">
                      Ou até <span className="font-extrabold">10x sem juros de {formatCurrency(finalPriceSingle / 10)}</span>
                    </p>
                  </div>

                  {/* Interactive dynamic cart controls */}
                  <div className="flex flex-col sm:flex-row items-stretch gap-4 w-full">
                    
                    {!singleProduct.hasVariants && (
                      <div 
                        style={{ 
                          backgroundColor: currentTheme.backgroundColor, 
                          borderColor: `${currentTheme.cardTextColor}15` 
                        }}
                        className="flex items-center justify-between border rounded-2xl px-4 py-3 h-14 sm:w-32 shrink-0"
                      >
                        <button 
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          style={{ color: currentTheme.cardTextColor }}
                          className="hover:opacity-75 p-1 transition-colors"
                        >
                          <Minus size={16} />
                        </button>
                        <span style={{ color: currentTheme.cardTextColor }} className="text-sm font-black">{quantity}</span>
                        <button 
                          onClick={() => setQuantity(quantity + 1)}
                          style={{ color: currentTheme.cardTextColor }}
                          className="hover:opacity-75 p-1 transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleSingleBuyClick}
                      style={{
                        backgroundColor: currentTheme.buttonColor,
                        color: currentTheme.buttonTextColor,
                        boxShadow: `0 10px 25px ${currentTheme.buttonColor}25`
                      }}
                      className="flex-1 hover:brightness-110 active:scale-95 font-extrabold text-sm md:text-base uppercase tracking-widest rounded-2xl transition-all duration-300 h-14 flex items-center justify-center gap-3 select-none cursor-pointer"
                    >
                      <span>Aproveitar Desconto Limitado</span>
                      <ArrowRight size={18} className="animate-pulse" />
                    </button>
                  </div>

                </div>

              </div>

            </div>
          </div>
        ) : (
          /* MULTIPLE PRODUCTS CAROUSEL / GRID */
          <div className="relative w-full">
            {/* Carousel navigation controls */}
            {!isVertical && (
              <>
                <button 
                  onClick={() => scroll('left')}
                  style={{ 
                    backgroundColor: currentTheme.cardColor, 
                    borderColor: `${currentTheme.cardTextColor}15`,
                    color: currentTheme.cardTextColor 
                  }}
                  className="absolute left-[-15px] top-[40%] -translate-y-1/2 w-12 h-12 hover:scale-105 rounded-full flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 shadow-[0_5px_15px_rgba(0,0,0,0.6)] cursor-pointer"
                >
                  <ChevronLeft size={22} />
                </button>
                <button 
                  onClick={() => scroll('right')}
                  style={{ 
                    backgroundColor: currentTheme.cardColor, 
                    borderColor: `${currentTheme.cardTextColor}15`,
                    color: currentTheme.cardTextColor 
                  }}
                  className="absolute right-[-15px] top-[40%] -translate-y-1/2 w-12 h-12 hover:scale-105 rounded-full flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 shadow-[0_5px_15px_rgba(0,0,0,0.6)] cursor-pointer"
                >
                  <ChevronRight size={22} />
                </button>
              </>
            )}

            {/* Carousel display pipeline */}
            <div 
              ref={scrollRef}
              className={cn(
                "w-full scrollbar-none no-scrollbar",
                isVertical 
                  ? "grid gap-4 sm:gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4" 
                  : "flex gap-4 sm:gap-6 overflow-x-auto scroll-p-6 pb-6 snap-x snap-mandatory"
              )}
            >
              {products.map(product => {
                const solvePercent = simulatedSales[product.id!] || 72;
                const hasCriticalStock = solvePercent > 80;

                return (
                  <div 
                    key={product.id}
                    className={cn(
                      "flex flex-col h-full bg-transparent shrink-0 focus-visible:outline-none snap-start",
                      !isVertical && "w-[170px] xs:w-[220px] sm:w-[260px] md:w-[280px]"
                    )}
                  >
                    {/* Primary item stage */}
                    <div 
                      style={{ 
                        backgroundColor: currentTheme.cardColor, 
                        borderColor: `${currentTheme.cardTextColor}12`
                      }}
                      className="flex-1 rounded-[2.5rem] overflow-hidden border hover:border-red-500/20 transition-all duration-500 shadow-md"
                    >
                      <ProductItemCard product={product} />
                    </div>

                    {/* Stock tracker styled appropriately */}
                    <div className="mt-3.5 px-3">
                      <div 
                        style={{ color: currentTheme.backgroundTextColor, opacity: 0.8 }}
                        className="flex justify-between items-center text-[10px] font-bold mb-1.5"
                      >
                        <span className="flex items-center gap-1.5">
                          <TrendingUp size={12} style={{ color: hasCriticalStock ? currentTheme.primaryColor : undefined }} className={cn(hasCriticalStock ? "animate-pulse animate-bounce" : "opacity-60")} />
                          {hasCriticalStock ? 'Estoque Crítico!' : 'Muito Procurado'}
                        </span>
                        <span style={{ color: currentTheme.primaryColor }} className="font-extrabold">
                          {solvePercent}% Vendido
                        </span>
                      </div>

                      <div 
                        style={{ backgroundColor: `${currentTheme.cardTextColor}15` }}
                        className="w-full h-1.5 rounded-full overflow-hidden"
                      >
                        <div 
                          style={{ 
                            width: `${solvePercent}%`,
                            backgroundColor: currentTheme.primaryColor,
                            boxShadow: `0 0 8px ${currentTheme.primaryColor}55`
                          }}
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </section>
  );
}

