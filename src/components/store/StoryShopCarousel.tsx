import { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { StoryShop } from '../../types/storyShop';
import { StoryShopModal } from './StoryShopModal';
import { ShoppingCart, Maximize2, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useNavigate } from 'react-router-dom';

interface StoryCardProps {
  story: StoryShop;
  isActive: boolean;
  sectionVisible: boolean;
  canRenderVideo: boolean;
  onActivate: () => void;
  onOpenModal: () => void;
}

export function StoryCard({ story, isActive, sectionVisible, canRenderVideo, onActivate, onOpenModal }: StoryCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Auto-play/pause based on active index + viewport presence
  useEffect(() => {
    if (!videoRef.current) return;

    if (isActive && sectionVisible) {
      setLoadError(false);
      videoRef.current.currentTime = 0;
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          if (import.meta.env.DEV) {
            console.warn('[STORY_SHOP] Video playback blocked or interrupted:', err.message);
          }
          setIsPlaying(false);
        });
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isActive, sectionVisible]);

  return (
    <div 
      onClick={onActivate}
      className={`relative flex-none flex flex-col transition-all duration-500 cursor-pointer snap-center select-none ${
        isActive 
          ? 'w-[240px] md:w-[300px] scale-100 z-10' 
          : 'w-[190px] md:w-[240px] scale-90 opacity-40 hover:opacity-60 z-0'
      }`}
    >
      <div 
        className={`w-full aspect-[9/16] rounded-3xl overflow-hidden bg-zinc-950 flex items-center justify-center relative transition-all duration-500 ${
          isActive 
            ? 'ring-4 ring-red-600 shadow-[0_0_30px_rgba(220,38,38,0.55)]' 
            : 'border border-zinc-900'
        }`}
      >
        
        {/* Render actual <video> tag ONLY for active & adjacent slots to keep low network footprint */}
        {canRenderVideo && story.videoUrl && !loadError ? (
          <video
            ref={videoRef}
            src={story.videoUrl}
            poster={story.thumbnailUrl}
            className="w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
            muted
            playsInline
            loop
            preload="metadata"
            onError={(e) => {
              if (import.meta.env.DEV) {
                console.warn('[STORY_SHOP] Failed to load MP4 video:', story.videoUrl);
              }
              setLoadError(true);
            }}
          />
        ) : (
          <img 
            src={story.thumbnailUrl} 
            alt={story.title} 
            className="w-full h-full object-cover" 
          />
        )}

        {/* Play Icon indicator when paused */}
        {isActive && !isPlaying && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="bg-black/60 p-3 rounded-full backdrop-blur-md">
              <Play className="text-white fill-white animate-pulse" size={18} />
            </div>
          </div>
        )}

        {/* Modal expand trigger on central active card */}
        {isActive && (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenModal();
            }}
            className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2.5 backdrop-blur-md transition-all z-10 border border-zinc-800"
            title="Ver em tela cheia"
          >
            <Maximize2 size={15} />
          </button>
        )}

        {/* Profile/avatar pulse overlay on central active card */}
        {isActive && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-none">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal();
              }}
              className="w-12 h-12 rounded-full border-2 border-red-600 overflow-hidden bg-black shadow-lg animate-pulse cursor-pointer pointer-events-auto"
            >
              <img 
                src={story.thumbnailUrl} 
                alt="Boutique Provador" 
                className="w-full h-full object-cover" 
              />
            </div>
          </div>
        )}

        {/* Overlay Title on non-active thumbnail cards */}
        {!isActive && (
          <div className="absolute bottom-4 left-3 right-3 p-2 bg-gradient-to-t from-black/80 to-transparent text-center rounded-xl backdrop-blur-[2px]">
            <p className="text-[10px] md:text-xs font-black text-white truncate">{story.title}</p>
          </div>
        )}

      </div>
    </div>
  );
}

export function StoryShopCarousel() {
  const [stories, setStories] = useState<StoryShop[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [sectionVisible, setSectionVisible] = useState(false);

  const { addItem } = useCartStore();
  const { toast } = useFeedback();
  const navigate = useNavigate();

  // 1. Fetch exactly the cache items document
  useEffect(() => {
    async function fetchCarousel() {
      try {
        const docRef = doc(db, 'public_story_shop_cache', 'items');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const list = data.items || [];
          setStories(list);
          setActiveIndex(0);
          
          if (import.meta.env.DEV) {
            console.log(`[STORY_SHOP] Story Shop cache carregado: ${list.length} items`);
          }
        }
      } catch (err) {
        console.error('[STORY_SHOP] Error loading stories public cache', err);
      }
    }
    fetchCarousel();
  }, []);

  // 2. Intersection observer on the whole viewport section
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setSectionVisible(entry.isIntersecting);
    }, { threshold: 0.1 });

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  if (stories.length === 0) return null;

  // Active story payload
  const activeStory = stories[activeIndex];
  const activeProduct = activeStory ? {
    id: activeStory.productId,
    name: activeStory.productName,
    price: activeStory.price || 0,
    promoPrice: activeStory.promotionalPrice,
    imageUrl: activeStory.productImageThumb,
    slug: activeStory.productSlug,
    hasVariations: activeStory.hasVariants || false
  } : null;

  // Auto scroll to active center element helper
  const scrollToActive = (index: number) => {
    if (containerRef.current) {
      const container = containerRef.current;
      const child = container.children[index] as HTMLElement;
      if (child) {
        const scrollLeft = child.offsetLeft - (container.offsetWidth / 2) + (child.offsetWidth / 2);
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });
      }
    }
  };

  // 3. Horizontal Snapping scroll calculative detection
  const handleScrollAndDetect = () => {
    if (!containerRef.current || stories.length === 0) return;
    const container = containerRef.current;
    const scrollLeft = container.scrollLeft;
    const containerWidth = container.offsetWidth;
    
    const children = Array.from(container.children) as HTMLElement[];
    let closestIndex = 0;
    let minDistance = Infinity;
    
    const containerCenter = scrollLeft + (containerWidth / 2);
    
    children.forEach((child, idx) => {
      const childCenter = child.offsetLeft + (child.offsetWidth / 2);
      const distance = Math.abs(containerCenter - childCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });
    
    if (closestIndex !== activeIndex) {
      setActiveIndex(closestIndex);
    }
  };

  const navigatePrev = () => {
    if (activeIndex > 0) {
      const nextIdx = activeIndex - 1;
      setActiveIndex(nextIdx);
      scrollToActive(nextIdx);
    }
  };

  const navigateNext = () => {
    if (activeIndex < stories.length - 1) {
      const nextIdx = activeIndex + 1;
      setActiveIndex(nextIdx);
      scrollToActive(nextIdx);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProduct?.id) return;
    
    if (activeProduct.hasVariations) {
      handleGoToProduct(e);
      toast('Este produto possui variações, escolha seu tamanho na página!', 'info');
      return;
    }

    addItem({
      id: activeProduct.id,
      productId: activeProduct.id,
      name: activeProduct.name || '',
      price: activeProduct.promoPrice || activeProduct.price,
      quantity: 1,
      imageUrl: activeProduct.imageUrl || activeStory.thumbnailUrl,
      originalPrice: activeProduct.price,
      promoPrice: activeProduct.promoPrice
    });
    
    toast('Adicionado ao carrinho! 🛒', 'success');
  };

  const handleGoToProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProduct?.id) return;
    navigate(`/produto/${activeProduct.slug || activeProduct.id}?id=${activeProduct.id}`);
  };

  return (
    <section 
      ref={sectionRef}
      className="bg-black py-8 md:py-14 border-b border-zinc-950 overflow-hidden relative"
    >
      <div className="max-w-7xl mx-auto px-4 relative">
        
        <div 
          ref={containerRef}
          onScroll={handleScrollAndDetect}
          className="flex gap-4 md:gap-7 overflow-x-auto no-scrollbar py-8 items-center cursor-grab active:cursor-grabbing snap-x snap-mandatory"
          style={{ 
            scrollSnapType: 'x mandatory',
            // Centering padding tricks: calculates dynamically based on card size
            paddingLeft: 'calc(50% - 120px)', 
            paddingRight: 'calc(50% - 120px)'
          }}
        >
          {stories.map((story, idx) => {
            const isCenter = idx === activeIndex;
            // Lazy load limits: only render actual video if adjacent or active
            const canRenderVideo = Math.abs(idx - activeIndex) <= 1;

            return (
              <StoryCard 
                key={story.id}
                story={story}
                isActive={isCenter}
                sectionVisible={sectionVisible}
                canRenderVideo={canRenderVideo}
                onActivate={() => {
                  setActiveIndex(idx);
                  scrollToActive(idx);
                }}
                onOpenModal={() => setSelectedStoryId(story.id || null)}
              />
            );
          })}
        </div>

        {/* BOTTOM ACTIVE CARD DETAILS DRAWER */}
        {activeStory && activeProduct && (
          <div className="max-w-md mx-auto mt-6 px-2">
            <div className="bg-zinc-950 border border-zinc-900 text-white rounded-3xl p-3.5 flex items-center justify-between gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.85)] animate-slideUp">
              
              <div 
                className="flex items-center gap-3 min-w-0 cursor-pointer"
                onClick={handleGoToProduct}
              >
                <div className="w-11 h-11 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800">
                  {(() => {
                    const src = (activeProduct.imageUrl || activeStory.thumbnailUrl || '').trim();
                    return src ? (
                      <img 
                        src={src} 
                        alt={activeProduct.name || ''} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-900" />
                    );
                  })()}
                </div>

                <div className="min-w-0 flex flex-col justify-center">
                  <h3 className="text-xs font-black text-white truncate leading-snug max-w-[200px] md:max-w-[240px]">
                    {activeProduct.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 leading-none">
                    {activeProduct.promoPrice ? (
                      <>
                        <span className="text-[10px] text-zinc-500 line-through">
                          R$ {activeProduct.price.toFixed(2)}
                        </span>
                        <span className="text-xs font-extrabold text-red-600">
                          R$ {activeProduct.promoPrice.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-extrabold text-zinc-300">
                        R$ {activeProduct.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAddToCart}
                  className="px-4 h-10 rounded-xl bg-red-600 hover:bg-red-700 flex items-center justify-center text-white flex-shrink-0 shadow transition-transform active:scale-95 text-[11px] font-black uppercase tracking-tight gap-2"
                  title={activeProduct.hasVariations ? 'Ver opções' : 'Adicionar ao Carrinho'}
                >
                  <ShoppingCart size={15} />
                  {activeProduct.hasVariations ? 'Opções' : 'Comprar'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* CAROUSEL BOTTOM DOTS/PAGE INDICATORS */}
        <div className="flex justify-center gap-2 mt-8">
          {stories.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setActiveIndex(idx);
                scrollToActive(idx);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === activeIndex 
                  ? 'w-6 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.8)]' 
                  : 'w-1.5 bg-zinc-800 hover:bg-zinc-650'
              }`}
            />
          ))}
        </div>

      </div>

      {/* DETAILED EXPAND PANEL (FULL SCREEN REELS) */}
      {selectedStoryId && (
        <StoryShopModal 
          selectedId={selectedStoryId} 
          stories={stories}
          onClose={() => setSelectedStoryId(null)} 
        />
      )}
    </section>
  );
}
