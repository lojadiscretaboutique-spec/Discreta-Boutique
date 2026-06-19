import { useState, useEffect, useRef } from 'react';
import { StoryShop } from '../../types/storyShop';
import { storyShopAnalyticsService } from '../../services/storyShopAnalyticsService';
import { X, ShoppingCart, ExternalLink, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useNavigate } from 'react-router-dom';

interface StorySlideProps {
  story: StoryShop;
  isActive: boolean;
  onAddToCart: (product: any) => void;
  onGoToProduct: (product: any) => void;
}

function StorySlide({ story, isActive, onAddToCart, onGoToProduct }: StorySlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        setLoadError(false);
        videoRef.current.currentTime = 0;
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.log('[STORY_SLIDE] Autoplay block detected, keeping muted state', err);
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  }, [isActive]);

  const product = {
    id: story.productId,
    name: story.productName,
    price: story.price || 0,
    promoPrice: story.promotionalPrice,
    imageUrl: story.productImageThumb,
    slug: story.productSlug,
    hasVariations: story.hasVariants || false
  };

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black select-none">
      
      {/* 9:16 Video Player with premium background fallback */}
      {!loadError ? (
        <video
          ref={videoRef}
          src={story.videoUrl}
          poster={story.thumbnailUrl}
          className="h-full w-full object-cover max-w-sm md:max-w-md max-h-screen"
          muted
          playsInline
          loop
          preload="metadata"
          onError={(e) => {
            console.warn("[STORY_SLIDE] Video playback error:", story.videoUrl);
            setLoadError(true);
          }}
        />
      ) : (
        <div className="relative h-full w-full max-w-sm md:max-w-md bg-zinc-950 flex items-center justify-center overflow-hidden">
          <img 
            src={story.thumbnailUrl} 
            alt={story.title} 
            className="absolute inset-0 w-full h-full object-cover opacity-60" 
          />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center text-center p-6">
            <HelpCircle className="text-zinc-500 mb-3" size={32} />
            <p className="text-[11px] text-zinc-405 max-w-xs leading-normal">
              O vídeo não pôde ser reproduzido, mas você ainda pode ver a capinha e o produto vinculado abaixo.
            </p>
          </div>
        </div>
      )}
      
      {/* Interactive Bottom Layer - Discreta Luxury */}
      <div className="absolute bottom-4 left-4 right-4 max-w-sm md:max-w-md md:mx-auto bg-gradient-to-t from-black via-black/90 to-transparent p-5 rounded-2xl border border-zinc-900/55 backdrop-blur-md z-10">
        <div className="space-y-4">
          <span className="text-zinc-500 text-[10px] uppercase font-black tracking-[3px] block">
            Discreta Boutique
          </span>

          <h2 className="text-white text-sm font-extrabold leading-tight">
            {story.title}
          </h2>

          {product.name ? (
            <div className="flex items-center gap-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-900 transition-all">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800">
                {(() => {
                  const src = (product.imageUrl || story.thumbnailUrl || '').trim();
                  return src ? (
                    <img 
                      src={src} 
                      alt={product.name || ''} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 animate-pulse" />
                  );
                })()}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-white text-xs font-black truncate">{product.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {product.promoPrice ? (
                    <>
                      <span className="text-[10px] text-zinc-500 line-through">
                        R$ {product.price.toFixed(2)}
                      </span>
                      <span className="text-xs font-black text-rose-500">
                        R$ {product.promoPrice.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-black text-zinc-300">
                      R$ {product.price.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-14 bg-zinc-950/45 animate-pulse rounded-xl" />
          )}

          {/* Action triggers with variations checker label */}
          {product.name && (
            <div className="grid grid-cols-2 gap-2.5 mt-1">
              <button
                onClick={() => onGoToProduct(product)}
                className="w-full text-center py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-200 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <ExternalLink size={13} />
                Ver Produto
              </button>
              <button
                onClick={() => onAddToCart(product)}
                className="w-full text-center py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(147,51,234,0.3)]"
              >
                <ShoppingCart size={13} />
                {product.hasVariations ? 'Ver opções' : 'Comprar'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  selectedId: string;
  stories: StoryShop[];
  onClose: () => void;
}

export function StoryShopModal({ selectedId, stories, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(stories.findIndex(s => s.id === selectedId));
  const containerRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCartStore();
  const { toast } = useFeedback();
  const navigate = useNavigate();

  useEffect(() => {
    if (stories[currentIndex]) {
      storyShopAnalyticsService.trackView(stories[currentIndex].id);
    }
  }, [currentIndex, stories]);

  // Handle keybindings for fast navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft;
    const clientWidth = e.currentTarget.clientWidth;
    if (clientWidth > 0) {
      const newIndex = Math.round(scrollLeft / clientWidth);
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < stories.length) {
        setCurrentIndex(newIndex);
      }
    }
  };

  const handleAddToCart = (product: any) => {
    if (product.hasVariations) {
      handleGoToProduct(product);
      toast('Este produto possui variações, selecione na página do produto!', 'info');
      return;
    }

    addItem({
      id: product.id,
      productId: product.id,
      name: product.name,
      price: product.promoPrice || product.price,
      quantity: 1,
      imageUrl: product.imageUrl || stories[currentIndex]?.thumbnailUrl,
      originalPrice: product.price,
      promoPrice: product.promoPrice
    });
    
    storyShopAnalyticsService.trackClick(stories[currentIndex].id);
    toast('Produto adicionado ao carrinho! 🛒', 'success');
  };

  const handleGoToProduct = (product: any) => {
    storyShopAnalyticsService.trackClick(stories[currentIndex].id);
    navigate(`/produto/${product.slug || product.id}?id=${product.id}`);
    onClose();
  };

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (containerRef.current) {
        containerRef.current.scrollTo({
          left: nextIdx * containerRef.current.clientWidth,
          behavior: 'smooth'
        });
      }
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      if (containerRef.current) {
        containerRef.current.scrollTo({
          left: prevIdx * containerRef.current.clientWidth,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center backdrop-blur-2xl">
      
      {/* Absolute close hover button */}
      <button 
        onClick={onClose} 
        className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur-md border border-zinc-800/80 transition active:scale-95"
      >
        <X size={20} />
      </button>

      {/* Snap horizontal container scroll snap with full swipe support */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full h-full flex overflow-x-scroll snap-x snap-mandatory no-scrollbar"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {stories.map((story, i) => (
          <div key={story.id} className="w-full h-full snap-center relative flex-shrink-0">
            <StorySlide 
              story={story}
              isActive={i === currentIndex}
              onAddToCart={handleAddToCart}
              onGoToProduct={handleGoToProduct}
            />
          </div>
        ))}
      </div>

      {/* Right dots controller */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40 bg-zinc-950/60 p-2.5 rounded-full border border-zinc-800/30 backdrop-blur-sm hidden md:flex">
        {stories.map((story, i) => (
          <button
            key={story.id}
            onClick={() => {
              setCurrentIndex(i);
              if (containerRef.current) {
                containerRef.current.scrollTo({
                  top: i * containerRef.current.clientHeight,
                  behavior: 'smooth'
                });
              }
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === currentIndex 
                ? 'bg-purple-550 scale-125 shadow-[0_0_8px_rgba(168,85,247,0.8)]' 
                : 'bg-zinc-650 hover:bg-zinc-400'
            }`}
            title={story.title}
          />
        ))}
      </div>

      {/* Desktop indicators arrows */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center z-40 hidden md:flex">
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="w-12 h-12 rounded-full bg-zinc-900/80 border border-zinc-800 text-white flex items-center justify-center disabled:opacity-25 hover:bg-zinc-850 active:scale-95 transition shadow-lg"
          title="Vídeo Anterior"
        >
          <ChevronLeft size={22} />
        </button>
      </div>

      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center z-40 hidden md:flex">
        <button 
          onClick={handleNext}
          disabled={currentIndex === stories.length - 1}
          className="w-12 h-12 rounded-full bg-zinc-900/80 border border-zinc-800 text-white flex items-center justify-center disabled:opacity-25 hover:bg-zinc-850 active:scale-95 transition shadow-lg"
          title="Próximo Vídeo"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Floating index tag */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-40 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-extrabold text-zinc-300 border border-zinc-800/40">
        {currentIndex + 1} / {stories.length}
      </div>

    </div>
  );
}
