import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCartStore } from '../../store/cartStore';
import { formatCurrency, cn } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Check, ShoppingBag, Package, Zap } from 'lucide-react';
import { Product, ProductVariant } from '../../services/productService';
import { motion } from 'motion/react';

export function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore(s => s.addItem);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;
      try {
        const pSnap = await getDocs(query(collection(db, 'products'), where('seo.slug', '==', slug)));
        if (pSnap.empty) {
          const fallbackSnap = await getDocs(query(collection(db, 'products')));
          const found = fallbackSnap.docs.find(d => d.id === slug);
          
          if (!found) {
            setProduct(null);
            return;
          }
          
          const fallbackData = { id: found.id, ...found.data() } as Product;
          
          // Track view
          productService.trackInteraction(fallbackData.id!, 'view');
          
          setProduct(fallbackData);
          
          const vSnap = await getDocs(query(collection(db, `products/${found.id}/variants`)));
          const vData = vSnap.docs.map(d => ({id: d.id, ...d.data()})) as ProductVariant[];
          setVariants(vData);
          if (vData.length > 0) {
            setSelectedVariant(vData[0]);
          }
        } else {
          const pData = { id: pSnap.docs[0].id, ...pSnap.docs[0].data() } as Product;
          
          // Track view
          productService.trackInteraction(pData.id!, 'view');
          
          setProduct(pData);

          const vSnap = await getDocs(query(collection(db, `products/${pData.id}/variants`)));
          const vData = vSnap.docs.map(d => ({id: d.id, ...d.data()})) as ProductVariant[];
          setVariants(vData);
          if (vData.length > 0) {
            setSelectedVariant(vData[0]);
          }
        }
      } catch (error) {
        console.error("Error loading product:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center py-20 text-zinc-500">
        <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-bold uppercase tracking-widest">Carregando desejo...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center py-20 px-4 text-center">
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Produto não encontrado</h2>
        <Button onClick={() => navigate('/catalogo')} className="rounded-full font-bold">Voltar para o Catálogo</Button>
      </div>
    );
  }

  const currentPrice = selectedVariant?.price || product.promoPrice || product.price;
  const currentImage = selectedVariant?.imageUrl || (product.images && product.images.length > 0 ? product.images[0].url : null);

  const isOutOfStock = () => {
    if (!product.controlStock || product.allowBackorder) return false;
    if (product.hasVariants) {
      return selectedVariant ? selectedVariant.stock <= 0 : false;
    }
    return product.stock <= 0;
  };

  const handleAddToCart = (redirect = false) => {
    if (product.hasVariants && !selectedVariant) {
      alert("Selecione uma opção (Cor/Tamanho/etc) antes de adicionar ao carrinho.");
      return;
    }

    if (isOutOfStock()) {
      alert("Desculpe, este item ou opção está esgotado no momento.");
      return;
    }
    
    addItem({
      id: `${product.id}-${selectedVariant?.id || 'base'}`,
      productId: product.id,
      name: product.name,
      price: Number(currentPrice),
      quantity: 1,
      sku: selectedVariant?.sku || product.sku,
      imageUrl: currentImage,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name
    });
    
    // Track conversion
    productService.trackInteraction(product.id!, 'conversion');
    
    if (redirect) {
      navigate('/carrinho');
    } else {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  return (
    <div className="flex-1 bg-black text-white">
      <div className="max-w-7xl mx-auto w-full px-4 py-8">
        <Link to="/catalogo" className="inline-flex items-center text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-colors mb-8">
          <ArrowLeft size={16} className="mr-2" /> Voltar ao catálogo
        </Link>

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Gallery Area */}
          <div className="w-full lg:w-1/2 flex flex-col gap-4">
            <div className="bg-zinc-900 rounded-[3rem] border border-zinc-800 overflow-hidden aspect-[4/5] relative shadow-2xl">
              {currentImage ? (
                 <motion.img 
                   key={currentImage}
                   initial={{ opacity: 0, scale: 1.1 }}
                   animate={{ opacity: 1, scale: 1 }}
                   src={currentImage || undefined} 
                   alt={product.name} 
                   className="absolute inset-0 w-full h-full object-cover" 
                   referrerPolicy="no-referrer"
                 />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-700 font-bold uppercase tracking-widest">Sem Imagem</div>
              )}
              
              {product.newRelease && (
                 <div className="absolute top-8 left-8 bg-red-600 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[2px]">Lançamento</div>
              )}
            </div>
            
            {product.images && product.images.length > 1 && (
              <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                 {product.images.map((img, idx) => (
                   <button 
                     key={idx}
                     onClick={() => setSelectedVariant(prev => ({...prev!, imageUrl: img.url}))}
                     className={cn(
                       "w-20 h-20 rounded-2xl border-2 overflow-hidden shrink-0 transition-all",
                       currentImage === img.url ? "border-red-600 scale-105" : "border-zinc-800 opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                     )}
                   >
                     <img src={img.url || undefined} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                   </button>
                 ))}
              </div>
            )}
          </div>

          {/* Info Area */}
          <div className="w-full lg:w-1/2 flex flex-col lg:sticky lg:top-24">
            <div className="mb-8">
              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none mb-4 italic">{product.name}</h1>
              {product.subtitle && <p className="text-red-500 font-bold uppercase tracking-[4px] text-[10px] mb-4">{product.subtitle}</p>}
              <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                 <span>SKU: {selectedVariant?.sku || product.sku}</span>
                 <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
                 {isOutOfStock() ? (
                   <span className="text-zinc-600">Sem estoque disponível</span>
                 ) : (
                   <span className="text-red-600">Disponível em estoque</span>
                 )}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 mb-8">
              <div className="flex items-end gap-3 mb-6">
                <span className="text-4xl font-black text-white tracking-tighter">{formatCurrency(Number(currentPrice))}</span>
                {!!product.promoPrice && product.promoPrice < product.price && !selectedVariant && (
                  <span className="text-xl text-zinc-600 line-through mb-1">{formatCurrency(Number(product.price))}</span>
                )}
              </div>

              {variants.length > 0 && (
                <div className="mb-8 p-6 bg-zinc-950 rounded-2xl border border-zinc-800">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[3px] text-zinc-500">Escolha a Opção</h3>
                    {product.controlStock && selectedVariant && (
                      <span className={cn("text-[10px] font-bold uppercase", selectedVariant.stock > 0 ? "text-green-500" : "text-red-500")}>
                        {selectedVariant.stock > 0 ? `Estoque: ${selectedVariant.stock}` : 'Esgotado'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variants.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        className={cn(
                          "px-6 py-3 text-xs font-bold uppercase tracking-widest rounded-full border transition-all",
                          selectedVariant?.id === v.id 
                            ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-900/40" 
                            : "border-zinc-800 text-zinc-400 hover:border-red-600",
                          product.controlStock && !product.allowBackorder && v.stock <= 0 && "opacity-50 grayscale cursor-not-allowed"
                        )}
                      >
                        {v.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <Button 
                  size="lg" 
                  disabled={isOutOfStock()}
                  onClick={() => handleAddToCart(true)}
                  className={cn(
                    "w-full h-16 rounded-full font-black uppercase tracking-widest text-base shadow-xl transition-all bg-red-600 hover:bg-red-700 border-b-4 border-red-900 active:border-b-0 active:translate-y-1",
                    isOutOfStock() && "opacity-50 grayscale cursor-not-allowed border-none translate-y-0"
                  )}
                >
                  <Zap className="mr-2" /> {isOutOfStock() ? 'Produto Esgotado' : 'Comprar Agora'}
                </Button>
                
                <Button 
                  variant="outline"
                  size="lg" 
                  disabled={isOutOfStock()}
                  onClick={() => handleAddToCart(false)}
                  className={cn(
                    "w-full h-16 rounded-full border-2 border-zinc-800 hover:bg-zinc-800/50 font-black uppercase text-xs tracking-widest transition-all",
                    added && "border-green-600 text-green-500",
                    isOutOfStock() && "opacity-50 grayscale cursor-not-allowed pointer-events-none"
                  )}
                >
                  {added ? (
                    <><Check className="mr-2" /> Adicionado!</>
                  ) : (
                    <><ShoppingBag className="mr-2" /> Adicionar ao Carrinho</>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-6">
               <div className="border-l-4 border-red-600 pl-6">
                 <h4 className="text-sm font-black uppercase tracking-widest mb-2">Descrição dos Desejos</h4>
                 <div className="text-sm text-zinc-400 leading-relaxed font-medium">
                    {product.fullDescription ? (
                      <div dangerouslySetInnerHTML={{__html: product.fullDescription.replace(/\n/g, '<br/>')}} />
                    ) : product.shortDescription ? (
                      <p>{product.shortDescription}</p>
                    ) : (
                      <p>Um item essencial para elevar sua experiência. Garantia de sofisticação e momentos marcantes.</p>
                    )}
                 </div>
               </div>

               <div className="bg-zinc-950 p-6 rounded-2xl grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-red-500 border border-zinc-800">
                        <Package size={18} />
                     </div>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Embalagem Discreta</span>
                  </div>
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-red-500 border border-zinc-800">
                        <Zap size={18} />
                     </div>
                     <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Entrega Expressa</span>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

