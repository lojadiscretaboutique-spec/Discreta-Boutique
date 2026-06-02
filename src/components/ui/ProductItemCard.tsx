import { memo, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Minus, Truck } from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { Product, productService } from '../../services/productService';
import { useCartStore } from '../../store/cartStore';
import { ResponsiveImage } from './ResponsiveImage';
import { usePromotion } from '../../contexts/PromotionContext';

export const ProductItemCard = memo(({ product, isPriority = false }: { product: Product, isPriority?: boolean }) => {
  const { calculateProductPrice } = usePromotion();
  const pricing = calculateProductPrice({
    id: product.id!,
    categoryId: product.categoryId,
    price: product.price,
    promoPrice: product.promoPrice
  });

  const mainImage = product.images?.find(i => i.isMain)?.url || product.images?.[0]?.url;
  const isOut = product.controlStock && !product.allowBackorder && product.stock <= 0;
  
  // Use calculated promotion if available
  const hasPromo = (!!product.promoPrice && product.promoPrice < product.price) || !!pricing.promotion;
  const finalPrice = pricing.price;
  const originalPrice = pricing.originalPrice;
  
  const hasVariants = !!product.hasVariants;
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore(s => s.addItem);
  const navigate = useNavigate();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if ((product as any).isCombo) {
      addItem({
        id: `combo-${product.id}`,
        productId: product.id!,
        name: product.name,
        price: finalPrice,
        quantity: quantity,
        sku: product.sku || '',
        gtin: product.gtin || '',
        imageUrl: mainImage || '',
        isCombo: true,
        comboId: product.id,
        isFreeShipping: pricing.isFreeShipping
      });
      navigate('/carrinho');
      return;
    }

    if (hasVariants) {
      navigate(`/produto/${product.seo?.slug || product.id}?id=${product.id}`);
    } else {
      addItem({
        id: `${product.id}-base`,
        productId: product.id!,
        name: product.name,
        price: finalPrice,
        quantity: quantity,
        sku: product.sku,
        gtin: product.gtin,
        imageUrl: mainImage || '',
        variantId: undefined,
        variantName: undefined,
        isFreeShipping: pricing.isFreeShipping,
        categoryId: product.categoryId,
        originalPrice: originalPrice,
        promoPrice: product.promoPrice,
        promoAllowedPaymentMethods: pricing.promotion?.allowedPaymentMethods || [],
        promotionId: pricing.promotion?.id
      });
      navigate('/carrinho');
    }
  };
  
  return (
    <Link 
      to={`/produto/${product.seo?.slug || product.id}?id=${product.id}`} 
      onClick={() => {
        if (product.id) {
          productService.trackInteraction(product.id, 'click');
        }
      }}
      className={cn(
        "group relative bg-zinc-950/40 rounded-[2.5rem] overflow-hidden flex flex-col border border-zinc-900 transition-all duration-700 h-full",
        isOut ? "grayscale opacity-40 shadow-none border-zinc-950" : "hover:border-red-600/30 hover:bg-zinc-950 hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] hover:shadow-red-900/10"
      )}
    >
      <div className="aspect-[3/4] relative bg-white overflow-hidden group-hover:bg-zinc-50 transition-colors duration-500">
        {mainImage ? (
          <ResponsiveImage 
            src={mainImage} 
            alt={product.name} 
            isPriority={isPriority}
            className={cn(
              "w-full h-full object-cover transition-transform duration-1000 ease-out",
              !isOut && "group-hover:scale-105"
            )}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-zinc-800 text-[10px] font-black uppercase tracking-widest text-center px-4 italic">Sem Imagem</div>
        )}
        
        {/* Organic Floating Badges */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
          {product.newRelease && !isOut && (
            <motion.span 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-red-600 text-white text-[7px] md:text-[8px] font-black uppercase tracking-[3px] px-3 py-1.5 rounded-full shadow-[0_5px_15px_rgba(220,38,38,0.4)] backdrop-blur-sm"
            >
              Novo
            </motion.span>
          )}
          {hasPromo && (
            <motion.span 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-red-600 text-white text-[7px] md:text-[8px] font-black uppercase tracking-[3px] px-3 py-1.5 rounded-full shadow-xl"
            >
              {pricing.promotion?.name || 'Oferta'}
            </motion.span>
          )}
        </div>

        {isOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-[4px] z-20">
            <span className="bg-transparent text-white text-[10px] font-black uppercase tracking-[4px] border-b-2 border-white/20 pb-1">Esgotado</span>
          </div>
        )}
        
        {/* Soft Glow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      </div>
      
      <div className="p-3 md:p-5 flex flex-col flex-1 relative bg-zinc-950">
        <h3 className="text-[11px] md:text-base font-bold text-zinc-100 group-hover:text-white transition-colors duration-300 line-clamp-4 leading-snug min-h-[4rem] md:min-h-[6rem] mb-2 md:mb-3 capitalize">
          {product.name.toLowerCase()}
        </h3>

        {/* Frete Grátis Label - Positioning between Title and Price */}
        {pricing.isFreeShipping && (
          <div className="mb-2 md:mb-3">
            <span className="inline-flex items-center gap-1 bg-emerald-600 text-white text-[7px] md:text-[9px] font-black uppercase tracking-[2px] px-2.5 py-1 rounded-md shadow-lg shadow-emerald-900/20">
              <Truck size={10} className="md:w-3 md:h-3" /> Frete Grátis
            </span>
          </div>
        )}

        <div className="mt-auto flex flex-col w-full relative">
          <div className="flex flex-col gap-0.5 mb-2 md:mb-3">
            {/* Preço Anterior (Riscado) - Agora acima e maior */}
            {hasPromo && (
              <span className="text-[10px] md:text-xs text-zinc-500 font-bold line-through opacity-70 tracking-tighter">
                {formatCurrency(originalPrice)}
              </span>
            )}
            
            {/* Preço Atual */}
            <div className="flex items-baseline gap-1 md:gap-1.5">
              <span className="text-base md:text-2xl font-black text-red-600 tracking-tighter">
                {formatCurrency(finalPrice)}
              </span>
              <span className="text-[9px] md:text-xs font-bold text-red-600 tracking-tight uppercase">no pix</span>
            </div>
            
            {/* Parcelamento */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[8px] md:text-[10px] text-zinc-400 font-black tracking-tight uppercase leading-none">
                OU 10X DE {(() => {
                  const promo = pricing.promotion;
                  const isPromoRestrictedToCashOnly = !!(promo && promo.allowedPaymentMethods && promo.allowedPaymentMethods.length > 0 && !promo.allowedPaymentMethods.includes('credit_card'));
                  const installmentBasePrice = isPromoRestrictedToCashOnly ? originalPrice : finalPrice;
                  return formatCurrency(installmentBasePrice / 10);
                })()} SEM JUROS
              </span>
            </div>
          </div>
          
          {/* Bottom Actions */}
          {!isOut && (
            <div className="flex items-stretch gap-1.5 md:gap-2 w-full h-8 md:h-10 relative z-20" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              {!hasVariants && (
                <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded px-1 w-14 md:w-20 shrink-0">
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuantity(Math.max(1, quantity - 1)); }} className="text-zinc-400 hover:text-white p-0.5 transition-colors"><Minus size={12} className="md:w-[14px] md:h-[14px]" /></button>
                  <span className="text-[10px] md:text-xs font-bold text-white">{quantity}</span>
                  <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQuantity(quantity + 1); }} className="text-zinc-400 hover:text-white p-0.5 transition-colors"><Plus size={12} className="md:w-[14px] md:h-[14px]" /></button>
                </div>
              )}
              <button 
                onClick={handleAddToCart}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-[9px] md:text-xs uppercase tracking-wider rounded transition-colors flex items-center justify-center whitespace-nowrap"
              >
                Comprar
              </button>
            </div>
          )}
        </div>
        
        {/* Decoration line */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />
      </div>
    </Link>
  );
});

export function SkeletonCard() {
  return (
    <div className="bg-zinc-950/40 rounded-[2.5rem] border border-zinc-900 animate-pulse overflow-hidden h-full">
      <div className="aspect-[3/4] bg-zinc-900" />
      <div className="p-5 space-y-4">
        <div className="h-4 bg-zinc-900 rounded-full w-3/4" />
        <div className="h-4 bg-zinc-900 rounded-full w-1/2" />
        <div className="space-y-2 pt-4">
          <div className="h-6 bg-zinc-900 rounded-full w-2/3" />
          <div className="h-10 bg-zinc-900 rounded w-full mt-4" />
        </div>
      </div>
    </div>
  );
}
