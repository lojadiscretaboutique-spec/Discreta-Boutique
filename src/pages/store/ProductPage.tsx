import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCartStore } from '../../store/cartStore';
import { formatCurrency, cn, formatVariantName } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Check, ShoppingBag, Package, Zap, Share2, Truck, Tag, AlertCircle } from 'lucide-react';
import { Product, ProductVariant, productService } from '../../services/productService';
import { ProductVariationSelector } from '../../components/product/ProductVariationSelector';
import { motion } from 'motion/react';
import { usePromotion } from '../../contexts/PromotionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getAutoTextColor } from '../../utils/themeUtils';
import { getComboReservedStocks, adjustProductAndVariantsWithReservations } from '../../utils/comboStockHelper';

// Contrast color calculation helper
function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

function resolveThemeColor(colorVal: string | undefined, fallbackHex: string): string {
  if (!colorVal) return fallbackHex;
  const trimmed = colorVal.trim().toLowerCase();
  if (trimmed === 'light') return '#ffffff';
  if (trimmed === 'dark') return '#000000';
  if (trimmed.startsWith('#') || trimmed.startsWith('rgb') || trimmed.startsWith('hsl')) {
    return colorVal;
  }
  return fallbackHex;
}

export function ProductPage() {
  const { calculateProductPrice } = usePromotion();
  const { currentTheme } = useTheme();
  const { slug } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const searchId = searchParams.get('sid') || undefined;
  const productIdParam = searchParams.get('id') || undefined;
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{
    produtos: any[];
    mensagem: string;
  } | null>(null);
  const addItem = useCartStore(s => s.addItem);

  const triggerError = (msg: string) => {
    setErrorAlert(msg);
    setTimeout(() => setErrorAlert(null), 3000);
  };

  // Dynamic Theme Colors
  const bgText = resolveThemeColor(currentTheme.backgroundTextColor, getAutoTextColor(currentTheme.backgroundColor || '#0a0a0a'));
  const isBgDark = getAutoTextColor(currentTheme.backgroundColor || '#0a0a0a') === '#ffffff';
  const labelColor = isBgDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(9, 9, 11, 0.7)';
  const secondaryText = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.5)';
  const cardColorBg = currentTheme.cardColor || (isBgDark ? '#161616' : '#f4f4f5');
  const cardText = resolveThemeColor(currentTheme.cardTextColor, getAutoTextColor(cardColorBg));
  const cardBorderHex = isBgDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(9, 9, 11, 0.1)';

  // Button colors
  const primaryBtnBg = currentTheme.buttonColor || currentTheme.primaryColor || '#D32F2F';
  const primaryBtnText = resolveThemeColor(currentTheme.buttonTextColor, getAutoTextColor(primaryBtnBg));

  // Apply promotion logic
  const pricing = product ? calculateProductPrice({
    id: product.id!,
    categoryId: product.categoryId,
    price: selectedVariant?.price || product.price,
    promoPrice: selectedVariant ? undefined : product.promoPrice
  }) : { price: 0, originalPrice: 0, promotion: null, isFreeShipping: false };

  // Adjust currentPrice to use pricing from hook
  const currentPrice = pricing.price;
  const isPromoActive = pricing.price < pricing.originalPrice;
  const originalPrice = pricing.originalPrice;

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        let productData: Product | null = null;
        let productId: string = '';

        if (productIdParam) {
          // 1. Direct fetch by ID param to resolve exact match (handles duplicate slugs!)
          const exactSnap = await getDoc(doc(db, 'products', productIdParam));
          if (exactSnap.exists()) {
            productData = { id: exactSnap.id, ...exactSnap.data() } as Product;
            productId = exactSnap.id;
          }
        }

        // 2. If not loaded yet (no ID param or not found), search by slug
        if (!productData) {
          const pSnap = await getDocs(query(collection(db, 'products'), where('seo.slug', '==', slug)));
          if (!pSnap.empty) {
            productData = { id: pSnap.docs[0].id, ...pSnap.docs[0].data() } as Product;
            productId = pSnap.docs[0].id;
          }
        }

        // 3. Fallbacks
        if (!productData) {
          // Check by ID in products
          const fallbackSnap = await getDoc(doc(db, 'products', slug));
          if (fallbackSnap.exists()) {
            productData = { id: fallbackSnap.id, ...fallbackSnap.data() } as Product;
            productId = fallbackSnap.id;
            
            // Redirect to slug URL if it has a slug
            if (productData.seo?.slug) {
              const newSearch = new URLSearchParams(location.search);
              newSearch.set('id', fallbackSnap.id);
              navigate(`/produto/${productData.seo.slug}?${newSearch.toString()}`, { replace: true });
              return;
            }
          } else {
            // Check in combos
            const cSnap = await getDocs(query(collection(db, 'combos'), where('active', '==', true)));
            const foundCombo = cSnap.docs.find(d => d.id === slug);
            if (foundCombo) {
              const combo = foundCombo.data();
              productData = {
                id: foundCombo.id,
                name: combo.name,
                description: combo.description,
                price: combo.price,
                images: combo.images || (combo.imageUrl ? [{ url: combo.imageUrl, isMain: true }] : []),
                isCombo: true,
                categoryId: 'combos'
              } as any;
            }
          }
        }

        if (productData) {
          if (!(productData as any).isCombo) {
            productService.trackInteraction(productData.id!, 'view', searchId);
            
            const [vSnap, reservedStocks] = await Promise.all([
              getDocs(query(collection(db, `products/${productData.id}/variants`))),
              getComboReservedStocks()
            ]);
            const rawVData = vSnap.docs.map(d => ({id: d.id, ...d.data()})) as ProductVariant[];
            const { product: adjustedProduct, variants: adjustedVariants } = adjustProductAndVariantsWithReservations(
              productData,
              rawVData,
              reservedStocks
            );
            
            productData = adjustedProduct;
            setVariants(adjustedVariants);
            if (adjustedVariants.length > 0) {
              const firstInStock = adjustedVariants.find(v => v.stock > 0);
              setSelectedVariant(firstInStock || adjustedVariants[0]);
            }
          } else {
            // It's a combo, no variants
            setVariants([]);
            setSelectedVariant(null);
          }
          
          setProduct(productData);
          
          // Carregar Sugestões da IA (Only for regular products for now)
          if (!(productData as any).isCombo) {
            fetch('/api/ia/sugestao-produto', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ productId: productData.id })
            })
            .then(res => res.json())
            .then(data => {
              if (data.produtos && data.produtos.length > 0) {
                setAiSuggestions(data);
              }
            })
            .catch(err => console.error('[AI_SUGGEST_FETCH_ERROR]', err));
          }
        }
      } catch (error) {
        console.error("Error loading product:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug, productIdParam]);

  if (loading) {
    return (
      <div 
        className="flex-1 flex flex-col items-center justify-center py-20 transition-colors duration-300"
        style={{
          backgroundColor: currentTheme.backgroundColor,
          color: secondaryText
        }}
      >
        <div 
          className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mb-4" 
          style={{ borderColor: currentTheme.primaryColor, borderTopColor: 'transparent' }}
        />
        <p className="text-xs font-bold uppercase tracking-widest">Carregando desejo...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div 
        className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center transition-colors duration-300"
        style={{
          backgroundColor: currentTheme.backgroundColor,
          color: bgText
        }}
      >
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Produto não encontrado</h2>
        <Button 
          onClick={() => navigate('/catalogo')} 
          className="rounded-full font-bold"
          style={{
            backgroundColor: primaryBtnBg,
            color: primaryBtnText
          }}
        >
          Voltar para o Catálogo
        </Button>
      </div>
    );
  }

  const currentImage = selectedVariant?.imageUrl || (product.images && product.images.length > 0 ? product.images[0].url : null);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.name,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
       navigator.clipboard.writeText(window.location.href);
       alert('Link copiado!');
    }
  };

  const isOutOfStock = () => {
    if (!product.controlStock || product.allowBackorder) return false;
    if (product.hasVariants) {
      return selectedVariant ? selectedVariant.stock <= 0 : false;
    }
    return product.stock <= 0;
  };

  const handleAddToCart = (redirect = false) => {
    if (product.hasVariants) {
      const selectedItems = Object.entries(selectedQuantities).filter(([, qty]) => qty > 0);
      if (selectedItems.length === 0) {
        triggerError("Selecione pelo menos uma opção para continuar.");
        return;
      }

      selectedItems.forEach(([variantId, quantity]) => {
        const variant = variants.find(v => v.id === variantId);
        if (!variant) return;

        addItem({
          id: `${product.id}-${variantId}`,
          productId: product.id,
          name: product.name,
          price: Number(variant.price || currentPrice),
          quantity: quantity,
          sku: variant.sku || product.sku,
          gtin: variant.barcode || product.gtin,
          imageUrl: variant.imageUrl || currentImage,
          variantId: variant.id,
          variantName: variant.name,
          costPrice: variant.costPrice || product.costPrice || 0,
          searchId,
          isFreeShipping: pricing.isFreeShipping,
          categoryId: product.categoryId,
          originalPrice: originalPrice,
          promoPrice: undefined,
          promoAllowedPaymentMethods: pricing.promotion?.allowedPaymentMethods || [],
          promotionId: pricing.promotion?.id
        });
      });
      setSelectedQuantities({});
    } else {
      if (isOutOfStock()) {
        triggerError("Desculpe, este item ou opção está esgotado no momento.");
        return;
      }
      
      addItem({
        id: `${product.id}-base`,
        productId: product.id,
        name: product.name,
        price: Number(currentPrice),
        quantity: 1,
        sku: product.sku,
        gtin: product.gtin,
        imageUrl: currentImage,
        costPrice: product.costPrice || 0,
        searchId,
        isFreeShipping: pricing.isFreeShipping,
        categoryId: product.categoryId,
        originalPrice: originalPrice,
        promoPrice: product.promoPrice,
        promoAllowedPaymentMethods: pricing.promotion?.allowedPaymentMethods || [],
        promotionId: pricing.promotion?.id
      });
    }
    
    // Track conversion
    productService.trackInteraction(product.id!, 'conversion', searchId);
    
    if (redirect) {
      navigate('/carrinho');
    } else {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  return (
    <div 
      className="flex-1 transition-colors duration-300"
      style={{
        backgroundColor: currentTheme.backgroundColor,
        color: bgText
      }}
    >
      <div className="max-w-7xl mx-auto w-full px-4 pb-12 pt-4 md:pt-6">
        <Link 
          to="/catalogo" 
          className="inline-flex items-center text-xs font-bold uppercase tracking-widest transition-colors mb-8"
          style={{ color: labelColor }}
          onMouseEnter={(e) => { e.currentTarget.style.color = currentTheme.primaryColor; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = labelColor; }}
        >
          <ArrowLeft size={16} className="mr-2" style={{ color: currentTheme.primaryColor }} /> Voltar ao catálogo
        </Link>

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Gallery Area */}
          <div className="w-full lg:w-1/2 flex flex-col gap-4">
            <div 
              className="rounded-[3rem] border overflow-hidden aspect-[4/5] relative shadow-2xl transition-all"
              style={{
                backgroundColor: cardColorBg,
                borderColor: cardBorderHex
              }}
            >
              {currentImage ? (
                <>
                  <motion.img 
                    key={currentImage}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={currentImage || undefined} 
                    alt={`${product.name} | Discreta Boutique`} 
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-all duration-305",
                      isOutOfStock() && "grayscale blur-sm"
                    )}
                    style={isOutOfStock() ? { filter: 'grayscale(100%) blur(4px)' } : {}}
                    referrerPolicy="no-referrer"
                  />
                  {isOutOfStock() && (
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-10">
                      <span className="text-white text-2xl md:text-3xl font-black uppercase tracking-[0.25em] px-8 py-3 border-2 border-white/60 bg-black/70 rounded-2xl shadow-2xl">
                        ESGOTADO
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div 
                  className="absolute inset-0 flex items-center justify-center font-bold uppercase tracking-widest"
                  style={{ color: secondaryText }}
                >
                  Sem Imagem
                </div>
              )}
              
              {product.newRelease && (
                 <div 
                   className="absolute top-8 left-8 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[2px] z-10"
                   style={{
                     backgroundColor: currentTheme.primaryColor,
                     color: currentTheme.primaryTextColor || getContrastColor(currentTheme.primaryColor)
                   }}
                 >
                   Lançamento
                 </div>
              )}
            </div>
            
            {product.images && product.images.length > 1 && (
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                 {product.images.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setSelectedVariant(prev => ({...prev!, imageUrl: img.url}))}
                      className={cn(
                        "w-20 h-20 rounded-2xl border-2 overflow-hidden shrink-0 transition-all cursor-pointer relative",
                        currentImage === img.url ? "scale-105" : ""
                      )}
                      style={{
                        borderColor: currentImage === img.url ? currentTheme.primaryColor : cardBorderHex
                      }}
                    >
                      <img 
                        src={img.url || undefined} 
                        alt={`${product.name} - Imagem ${idx + 1} | Discreta Boutique`}
                        loading="lazy"
                        className={cn(
                          "w-full h-full object-cover transition-all",
                          isOutOfStock() && "grayscale blur-[2px]"
                        )}
                        style={isOutOfStock() ? { filter: 'grayscale(100%) blur(2px)' } : {}}
                        referrerPolicy="no-referrer" 
                      />
                      {isOutOfStock() && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                          <span className="text-[9px] text-white font-bold tracking-wider uppercase">Esgotado</span>
                        </div>
                      )}
                    </button>
                 ))}
              </div>
            )}
          </div>

          {/* Info Area */}
          <div className="w-full lg:w-1/2 flex flex-col lg:sticky lg:top-24">
            <div className="mb-8">
              <div className="flex justify-between items-start gap-4">
                  <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-4 italic" style={{ color: bgText }}>
                    {product.name}
                  </h1>
                  <button 
                    onClick={handleShare} 
                    className="transition-colors p-2 rounded-full border cursor-pointer"
                    style={{
                      borderColor: cardBorderHex,
                      color: labelColor
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = currentTheme.primaryColor; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = labelColor; }}
                  >
                    <Share2 size={20} />
                  </button>
              </div>
              {product.subtitle && (
                <p 
                  className="font-bold uppercase tracking-[4px] text-[10px] mb-4"
                  style={{ color: currentTheme.primaryColor }}
                >
                  {product.subtitle}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest" style={{ color: labelColor }}>
                 <span>SKU: {selectedVariant?.sku || product.sku}</span>
                 <div className="w-1 h-1 rounded-full" style={{ backgroundColor: cardBorderHex }} />
                 {isOutOfStock() ? (
                   <span style={{ color: secondaryText }}>Sem estoque disponível</span>
                 ) : (
                   <span style={{ color: currentTheme.primaryColor }}>Disponível em estoque</span>
                 )}
              </div>
            </div>

            {/* Price Box */}
            <div 
              className="border rounded-[2rem] p-8 mb-8 relative overflow-hidden"
              style={{
                backgroundColor: cardColorBg,
                borderColor: cardBorderHex,
                color: cardText
              }}
            >
              {errorAlert && (
                <div className="mb-4 flex items-center gap-2 p-3 rounded-xl text-xs font-bold text-white shadow-lg animate-in fade-in" style={{ backgroundColor: currentTheme.primaryColor || '#D32F2F' }}>
                  <AlertCircle size={16} />
                  {errorAlert}
                </div>
              )}
              {/* Promotion Badge Background Glow */}
              {isPromoActive && (
                <div 
                  className="absolute top-0 right-0 w-32 h-32 blur-3xl -z-0 pointer-events-none" 
                  style={{
                    background: `radial-gradient(circle, ${currentTheme.primaryColor}20 0%, transparent 70%)`
                  }}
                />
              )}
              
              <div className="flex flex-col gap-4 mb-6 relative z-10">
                <div className="flex flex-col gap-1">
                  {(isPromoActive && originalPrice > currentPrice) && (
                    <span className="text-xl md:text-2xl line-through font-bold tracking-tighter" style={{ color: secondaryText }}>
                      {formatCurrency(Number(originalPrice))}
                    </span>
                  )}
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl md:text-6xl font-black tracking-tighter" style={{ color: currentTheme.primaryColor }}>
                      {formatCurrency(Number(currentPrice))}
                    </span>
                    <span className="text-sm md:text-lg font-bold uppercase tracking-widest" style={{ color: currentTheme.primaryColor }}>
                      no pix
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs md:text-sm mt-1" style={{ color: labelColor }}>
                    <Zap className="fill-yellow-500 text-yellow-500" size={16} />
                    OU 10X DE {(() => {
                      const promo = pricing.promotion;
                      const isPromoRestrictedToCashOnly = !!(promo && promo.allowedPaymentMethods && promo.allowedPaymentMethods.length > 0 && !promo.allowedPaymentMethods.includes('credit_card'));
                      const installmentBasePrice = isPromoRestrictedToCashOnly ? originalPrice : currentPrice;
                      return formatCurrency(Number(installmentBasePrice) / 10);
                    })()} SEM JUROS
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {pricing.promotion && (
                    <div 
                      className="flex items-center gap-1.5 border px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: `${currentTheme.primaryColor}15`,
                        borderColor: `${currentTheme.primaryColor}30`,
                        color: currentTheme.primaryColor
                      }}
                    >
                      <Tag size={12} style={{ fill: currentTheme.primaryColor }} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{pricing.promotion.name}</span>
                    </div>
                  )}
                  {pricing.isFreeShipping && (
                    <div 
                      className="flex items-center gap-1.5 border px-3 py-1 rounded-full"
                      style={{
                        backgroundColor: `${currentTheme.highlightColor || '#10b981'}15`,
                        borderColor: `${currentTheme.highlightColor || '#10b981'}30`,
                        color: currentTheme.highlightColor || '#10b981'
                      }}
                    >
                      <Truck size={12} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Frete Grátis</span>
                    </div>
                  )}
                </div>
              </div>

              {variants.length > 0 && (
                <>
                  <ProductVariationSelector
                    variants={variants}
                    selectedQuantities={selectedQuantities}
                    onQuantityChange={(vId, qty) => setSelectedQuantities(prev => ({ ...prev, [vId]: qty }))}
                    accentColor={currentTheme.primaryColor || '#D32F2F'}
                    textColor={bgText}
                    cardColor={cardColorBg}
                    borderColor={cardBorderHex}
                  />
                  
                  {Object.values(selectedQuantities).reduce((acc, qty) => acc + qty, 0) > 0 && (
                    <div className="mt-4 flex items-center justify-between p-4 border rounded-2xl" style={{ borderColor: cardBorderHex }}>
                      <div>
                        <p className="text-xs font-bold" style={{ color: labelColor }}>
                          Selecionado: {Object.values(selectedQuantities).reduce((acc, qty) => acc + qty, 0)} itens
                        </p>
                        <p className="text-sm font-black" style={{ color: currentTheme.primaryColor }}>
                          Subtotal: {formatCurrency(
                            Object.entries(selectedQuantities).reduce((acc, [id, qty]) => {
                              const v = variants.find(variant => variant.id === id);
                              return acc + ((v?.price || currentPrice) * qty);
                            }, 0)
                          )}
                        </p>
                      </div>
                      <button 
                        onClick={() => setSelectedQuantities({})}
                        className="text-[10px] font-bold uppercase underline" 
                        style={{ color: secondaryText }}
                      >
                        Limpar seleção
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col gap-4">
                <Button 
                  size="lg" 
                  disabled={isOutOfStock()}
                  onClick={() => handleAddToCart(true)}
                  className={cn(
                    "w-full h-16 rounded-full font-black uppercase tracking-widest text-base shadow-xl transition-all border-b-4 active:border-b-0 active:translate-y-1",
                    isOutOfStock() && "opacity-50 grayscale cursor-not-allowed border-none translate-y-0"
                  )}
                  style={{
                    backgroundColor: primaryBtnBg,
                    color: primaryBtnText,
                    borderColor: `${primaryBtnBg}dd`,
                    borderBottomColor: 'rgba(0,0,0,0.3)',
                    boxShadow: isOutOfStock() ? 'none' : `0 10px 15px -3px ${primaryBtnBg}30, 0 4px 6px -4px ${primaryBtnBg}20`
                  }}
                >
                  <Zap className="mr-2" /> {isOutOfStock() ? 'Produto Esgotado' : 'Comprar Agora'}
                </Button>
                
                <button 
                  disabled={isOutOfStock()}
                  onClick={() => handleAddToCart(false)}
                  className={cn(
                    "inline-flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-650 disabled:pointer-events-none disabled:opacity-50",
                    "w-full h-16 rounded-full border-2 font-black uppercase text-xs tracking-widest",
                    isOutOfStock() && "opacity-50 grayscale cursor-not-allowed pointer-events-none"
                  )}
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: added ? '#10b981' : (currentTheme.buttonColor || currentTheme.primaryColor || '#D32F2F'),
                    color: added ? '#10b981' : (currentTheme.buttonColor || currentTheme.primaryColor || '#D32F2F')
                  }}
                >
                  {added ? (
                    <><Check className="mr-2" /> Adicionado!</>
                  ) : (
                    <><ShoppingBag className="mr-2" /> Adicionar ao Carrinho</>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-6">
               <div 
                 className="border-l-4 pl-6"
                 style={{ borderLeftColor: currentTheme.primaryColor }}
               >
                 <h4 className="text-sm font-black uppercase tracking-widest mb-2" style={{ color: bgText }}>Descrição dos Desejos</h4>
                 <div className="text-sm leading-relaxed font-medium" style={{ color: labelColor }}>
                    {product.fullDescription ? (
                      <div dangerouslySetInnerHTML={{__html: product.fullDescription.replace(/\n/g, '<br/>')}} />
                    ) : product.shortDescription ? (
                      <p>{product.shortDescription}</p>
                    ) : (
                      <p>Um item essencial para elevar sua experiência. Garantia de sofisticação e momentos marcantes.</p>
                    )}
                 </div>
               </div>

               <div 
                 className="p-6 rounded-2xl grid grid-cols-2 gap-4 border"
                 style={{
                   backgroundColor: cardColorBg,
                   borderColor: cardBorderHex
                 }}
               >
                  <div className="flex items-center gap-3">
                     <div 
                       className="w-10 h-10 rounded-full flex items-center justify-center border"
                       style={{
                         backgroundColor: currentTheme.backgroundColor,
                         borderColor: cardBorderHex,
                         color: currentTheme.primaryColor
                       }}
                     >
                        <Package size={18} />
                     </div>
                     <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: labelColor }}>Embalagem Discreta</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <div 
                       className="w-10 h-10 rounded-full flex items-center justify-center border"
                       style={{
                         backgroundColor: currentTheme.backgroundColor,
                         borderColor: cardBorderHex,
                         color: currentTheme.primaryColor
                       }}
                     >
                        <Zap size={18} />
                     </div>
                     <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: labelColor }}>Entrega Expressa</span>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>

      {/* IA Suggestions Section */}
      {aiSuggestions && aiSuggestions.produtos.length > 0 && (
        <div 
          className="py-20 border-t transition-all"
          style={{
            backgroundColor: cardColorBg,
            borderColor: cardBorderHex
          }}
        >
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-col mb-12">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="animate-pulse" size={16} style={{ color: currentTheme.primaryColor }} />
                <span className="text-xs font-black uppercase tracking-[4px]" style={{ color: currentTheme.primaryColor }}>Discreta AI Curadoria</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter italic" style={{ color: cardText }}>
                {aiSuggestions.mensagem}
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {aiSuggestions.produtos.map((p, idx) => {
                const sPricing = calculateProductPrice({
                  id: p.id,
                  categoryId: p.categoryId,
                  price: p.price,
                  promoPrice: p.promoPrice
                });
                const sHasPromo = !!sPricing.promotion || (p.promoPrice && p.promoPrice < p.price);

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    key={p.id}
                    onClick={() => {
                      navigate(`/produto/${p.seo?.slug || p.id}?id=${p.id}`);
                      window.scrollTo(0, 0);
                    }}
                    className="group cursor-pointer"
                  >
                    <div 
                      className="aspect-[3/4] rounded-[2rem] overflow-hidden mb-4 relative border"
                      style={{
                        backgroundColor: currentTheme.backgroundColor,
                        borderColor: cardBorderHex
                      }}
                    >
                      <img 
                        src={p.imageUrl || undefined} 
                        alt={`${p.name} | Discreta Boutique`} 
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[0.5] group-hover:grayscale-0"
                        referrerPolicy="no-referrer"
                      />
                      {sHasPromo && (
                        <div 
                          className="absolute top-4 left-4 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-xl z-20"
                          style={{
                            backgroundColor: currentTheme.primaryColor,
                            color: currentTheme.primaryTextColor || getContrastColor(currentTheme.primaryColor)
                          }}
                        >
                          {sPricing.promotion?.name || 'Oferta'}
                        </div>
                      )}
                      {sPricing.isFreeShipping && (
                        <div 
                          className="absolute top-4 right-4 p-1.5 rounded-full shadow-xl z-20 text-white"
                          style={{
                            backgroundColor: currentTheme.highlightColor || '#10b981'
                          }}
                        >
                          <Truck size={12} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                        <div 
                          className="text-[10px] font-black uppercase py-2 px-4 rounded-full w-fit tracking-widest"
                          style={{
                            backgroundColor: currentTheme.primaryColor,
                            color: currentTheme.primaryTextColor || getContrastColor(currentTheme.primaryColor)
                          }}
                        >
                          Ver Detalhes
                        </div>
                      </div>
                    </div>
                    <h3 
                      className="text-sm font-bold uppercase tracking-tight line-clamp-1 transition-colors"
                      style={{ color: cardText }}
                    >
                      {p.name}
                    </h3>
                    
                    <div className="flex flex-col gap-0.5 mt-1">
                      {sHasPromo && sPricing.originalPrice > sPricing.price && (
                        <p className="text-[10px] font-bold line-through tracking-tighter opacity-70" style={{ color: secondaryText }}>
                          {formatCurrency(sPricing.originalPrice)}
                        </p>
                      )}
                      
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-sm font-black uppercase tracking-widest" style={{ color: currentTheme.primaryColor }}>
                          {formatCurrency(sPricing.price)}
                        </p>
                        <p className="text-[8px] font-bold uppercase" style={{ color: currentTheme.primaryColor }}>no pix</p>
                      </div>
                      
                      <p className="text-[8px] font-black uppercase tracking-tight whitespace-nowrap" style={{ color: secondaryText }}>
                        OU 10X DE {(() => {
                          const sPromo = sPricing.promotion;
                          const sRestricted = !!(sPromo && sPromo.allowedPaymentMethods && sPromo.allowedPaymentMethods.length > 0 && !sPromo.allowedPaymentMethods.includes('credit_card'));
                          const sInstallmentPrice = sRestricted ? sPricing.originalPrice : sPricing.price;
                          return formatCurrency(sInstallmentPrice / 10);
                        })()} SEM JUROS
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
