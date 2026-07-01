import { useState, useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { StoryShop } from '../../types/storyShop';
import { StoryShopModal } from './StoryShopModal';
import { ShoppingCart, Maximize2, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

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

  // Auto-play/pause safe flow
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive && sectionVisible && canRenderVideo) {
      setLoadError(false);
      
      // Explicitly configure muted/playsInline properties on DOM node before trigger
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.currentTime = 0;
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((err) => {
            if (import.meta.env.DEV) {
              console.warn('[STORY_SHOP] Autoplay blocked, showing poster/thumbnail:', err?.message || err);
            }
            setIsPlaying(false);
          });
      }
    } else {
      try {
        video.pause();
      } catch (err) {
        // Safe catch
      }
      setIsPlaying(false);
    }

    return () => {
      if (video) {
        try {
          video.pause();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isActive, sectionVisible, canRenderVideo]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActive) {
      if (videoRef.current) {
        if (videoRef.current.paused) {
          videoRef.current.play()
            .then(() => setIsPlaying(true))
            .catch((err) => {
              if (import.meta.env.DEV) {
                console.warn('[STORY_SHOP] Manual playback blocked:', err?.message || err);
              }
            });
        } else {
          onOpenModal();
        }
      } else {
        onOpenModal();
      }
    } else {
      onActivate();
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`relative flex-none flex flex-col transition-all duration-500 cursor-pointer snap-center select-none ${
        isActive 
          ? 'w-[240px] md:w-[300px] scale-100 z-10' 
          : 'w-[190px] md:w-[240px] scale-90 opacity-40 hover:opacity-60 z-0'
      }`}
    >
      <div 
        className={`w-full aspect-[9/16] rounded-3xl overflow-hidden flex items-center justify-center relative transition-all duration-500 ${
          isActive 
            ? 'ring-4 ring-[var(--primary-color)] shadow-[0_0_30px_var(--color-primary-glow)]' 
            : 'border'
        }`}
        style={{ 
          backgroundColor: 'var(--card-color)', 
          borderColor: isActive ? 'var(--primary-color)' : 'var(--card-color)' 
        }}
      >
        
        {/* Render actual <video> tag ONLY for active slot when the whole section is visible */}
        {canRenderVideo && story.videoUrl && !loadError ? (
          <video
            ref={videoRef}
            src={story.videoUrl}
            poster={story.thumbnailUrl}
            className="w-full h-full object-cover transition-opacity duration-300 pointer-events-none"
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
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
            className="w-full h-full object-cover animate-fadeIn" 
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
            className="absolute top-4 right-4 text-white rounded-full p-2.5 backdrop-blur-md transition-all z-10 border cursor-pointer hover:scale-105 active:scale-95"
            style={{ 
              backgroundColor: 'rgba(0,0,0,0.6)', 
              borderColor: 'rgba(255,255,255,0.1)' 
            }}
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
              className="w-12 h-12 rounded-full border-2 border-[var(--primary-color)] overflow-hidden shadow-lg animate-pulse cursor-pointer pointer-events-auto"
              style={{ backgroundColor: 'var(--card-color)' }}
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
          <div 
            className="absolute bottom-4 left-3 right-3 p-2 text-center rounded-xl backdrop-blur-[2px]" 
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            <p className="text-[10px] md:text-xs font-black truncate">{story.title}</p>
          </div>
        )}

      </div>
    </div>
  );
}

export function StoryShopCarousel() {
  const [stories, setStories] = useState<StoryShop[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [sectionVisible, setSectionVisible] = useState(true);

  // Responsive padding calculation through ResizeObserver of the container width
  const [paddingLeftRight, setPaddingLeftRight] = useState('calc(50% - 120px)');
  
  // Programmatic scrolling flags to prevent jumping indices during animation transitions
  const isScrollingProgrammatically = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { addItem } = useCartStore();
  const { toast } = useFeedback();
  const navigate = useNavigate();

  // Auto scroll to active center element helper
  const scrollToActive = (index: number) => {
    if (containerRef.current) {
      const container = containerRef.current;
      const child = container.children[index] as HTMLElement;
      if (child) {
        isScrollingProgrammatically.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

        const containerWidth = container.offsetWidth;
        const isMobileSize = containerWidth < 768;
        const childWidth = isMobileSize ? 240 : 300;
        
        const scrollLeft = child.offsetLeft - (containerWidth / 2) + (childWidth / 2);
        
        container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
        });

        // Set safety lock timeout so scrolling momentum doesn't override active index
        scrollTimeoutRef.current = setTimeout(() => {
          isScrollingProgrammatically.current = false;
        }, 600);
      }
    }
  };

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

          // Center the first item after layout render
          setTimeout(() => {
            scrollToActive(0);
          }, 150);
        }
      } catch (err) {
        console.error('[STORY_SHOP] Error loading stories public cache', err);
      } finally {
        setHasLoaded(true);
      }
    }
    fetchCarousel();
  }, []);

  // 1.1 DEV logging for active item parameters
  useEffect(() => {
    if (import.meta.env.DEV && stories.length > 0) {
      const activeStory = stories[activeIndex];
      if (activeStory) {
        console.log('[StoryShop] item ativo', {
          id: activeStory.id,
          title: activeStory.title,
          videoUrl: activeStory.videoUrl,
          thumbnailUrl: activeStory.thumbnailUrl,
          activeIndex,
          isSectionVisible: sectionVisible
        });
      }
    }
  }, [stories, activeIndex, sectionVisible]);

  // 2. Intersection observer on the whole viewport section to play/pause intelligently
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setSectionVisible(entry.isIntersecting);
    }, { threshold: 0.1 });

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // 3. Compute dynamic center padding on container element resize
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        // On mobile (width < 768px), cards are w-[240px] (half is 120px). On desktop, cards are w-[300px] (half is 150px)
        const isMobileSize = width < 768;
        const cardHalf = isMobileSize ? 120 : 150;
        setPaddingLeftRight(`calc(50% - ${cardHalf}px)`);
      }
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // 4. Programmatic scrolling cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  if (hasLoaded && stories.length === 0) {
    return null;
  }

  if (stories.length === 0) {
    return (
      <section 
        className="pt-8 pb-10 md:pt-12 md:pb-14 border-b overflow-hidden relative h-[660px] md:h-[820px]"
        style={{ 
          backgroundColor: 'var(--background-color)', 
          borderColor: 'rgba(128,128,128,0.1)' 
        }}
      >
        <div className="max-w-7xl mx-auto px-4 relative select-none">
          <div 
            className="flex gap-4 md:gap-7 overflow-x-hidden py-8 items-center justify-center"
          >
            {/* Center loader card matching aspect-[9/16] sizes */}
            <div 
              className="w-[190px] md:w-[240px] aspect-[9/16] rounded-3xl animate-pulse border shrink-0 opacity-40" 
              style={{ backgroundColor: 'var(--card-color)', borderColor: 'rgba(128,128,128,0.1)' }}
            />
            <div 
              className="w-[240px] md:w-[300px] aspect-[9/16] rounded-3xl animate-pulse border-4 shrink-0 shadow-[0_0_20px_var(--color-primary-glow)]" 
              style={{ backgroundColor: 'var(--card-color)', borderColor: 'var(--primary-color)' }}
            />
            <div 
              className="w-[190px] md:w-[240px] aspect-[9/16] rounded-3xl animate-pulse border shrink-0 opacity-40" 
              style={{ backgroundColor: 'var(--card-color)', borderColor: 'rgba(128,128,128,0.1)' }}
            />
          </div>

          {/* Loader details drawer block to maintain height */}
          <div className="max-w-md mx-auto mt-6 px-2 h-[82px] md:h-[92px]">
            <div 
              className="border rounded-3xl p-3.5 flex items-center justify-between animate-pulse h-full" 
              style={{ backgroundColor: 'var(--card-color)', borderColor: 'rgba(128,128,128,0.1)' }}
            />
          </div>

          <div className="flex justify-center gap-2 mt-8 h-1.5" />
        </div>
      </section>
    );
  }

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

  // 5. Horizontal Snapping scroll calculative detection
  const handleScrollAndDetect = () => {
    if (isScrollingProgrammatically.current) return;
    if (!containerRef.current || stories.length === 0) return;
    
    // Use requestAnimationFrame to offset layout query costs
    requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;
      
      const scrollLeft = container.scrollLeft;
      const containerWidth = container.offsetWidth;
      const containerCenter = scrollLeft + (containerWidth / 2);
      
      const children = Array.from(container.children) as HTMLElement[];
      let closestIndex = activeIndex;
      let minDistance = Infinity;
      
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
    });
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
    handleGoToProduct(e);
  };

  const handleGoToProduct = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeProduct?.id) return;
    navigate(`/produto/${activeProduct.slug || activeProduct.id}?id=${activeProduct.id}`);
  };

  return (
    <section 
      ref={sectionRef}
      className="pt-8 pb-10 md:pt-12 md:pb-14 border-b overflow-hidden relative h-[660px] md:h-[820px]"
      style={{ 
        backgroundColor: 'var(--background-color)', 
        borderColor: 'var(--card-color)' 
      }}
    >
      <div className="max-w-7xl mx-auto px-4 relative">
        
        {/* Navigation Buttons: Side Chevrons (Desktop only) */}
        <button
          type="button"
          onClick={navigatePrev}
          disabled={activeIndex === 0}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-20 disabled:opacity-20 disabled:pointer-events-none p-3.5 rounded-full backdrop-blur-md transition-all shadow-[0_4px_24px_rgba(0,0,0,0.3)] active:scale-95 hidden md:flex items-center justify-center cursor-pointer border hover:scale-105"
          style={{ 
            backgroundColor: 'var(--card-color)', 
            borderColor: 'var(--primary-color)',
            color: 'var(--card-color-text)' 
          }}
          title="Anterior"
        >
          <ChevronLeft size={20} className="stroke-[2.5px]" />
        </button>

        <button
          type="button"
          onClick={navigateNext}
          disabled={activeIndex === stories.length - 1}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-20 disabled:opacity-20 disabled:pointer-events-none p-3.5 rounded-full backdrop-blur-md transition-all shadow-[0_4px_24px_rgba(0,0,0,0.3)] active:scale-95 hidden md:flex items-center justify-center cursor-pointer border hover:scale-105"
          style={{ 
            backgroundColor: 'var(--card-color)', 
            borderColor: 'var(--primary-color)',
            color: 'var(--card-color-text)' 
          }}
          title="Próximo"
        >
          <ChevronRight size={20} className="stroke-[2.5px]" />
        </button>

        <div 
          ref={containerRef}
          onScroll={handleScrollAndDetect}
          className="flex gap-4 md:gap-7 overflow-x-auto no-scrollbar py-8 items-center cursor-grab active:cursor-grabbing snap-x snap-mandatory"
          style={{ 
            scrollSnapType: 'x mandatory',
            paddingLeft: paddingLeftRight,
            paddingRight: paddingLeftRight,
            scrollBehavior: 'smooth'
          }}
        >
          {stories.map((story, idx) => {
            const isCenter = idx === activeIndex;
            // Strict condition: Render video ONLY for the active card when the section viewport is visible
            const canRenderVideo = isCenter && sectionVisible;

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
        <div className="max-w-md mx-auto mt-6 px-2 h-[82px] md:h-[92px]">
          {activeStory && activeProduct ? (
            <div 
              className="border rounded-3xl p-3.5 flex items-center justify-between gap-3 shadow-[0_12px_32px_rgba(0,0,0,0.35)] animate-slideUp h-full"
              style={{
                backgroundColor: 'var(--card-color)',
                borderColor: 'var(--primary-color)',
                color: 'var(--card-color-text)'
              }}
            >
              <div 
                className="flex items-center gap-3 min-w-0 cursor-pointer"
                onClick={handleGoToProduct}
              >
                <div 
                  className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border"
                  style={{
                    backgroundColor: 'var(--background-color)',
                    borderColor: 'rgba(128,128,128,0.15)'
                  }}
                >
                  {(() => {
                    const src = (activeProduct.imageUrl || activeStory.thumbnailUrl || '').trim();
                    return src ? (
                      <img 
                        src={src} 
                        alt={activeProduct.name || ''} 
                        className="w-full h-full object-cover animate-fadeIn" 
                      />
                    ) : (
                      <div className="w-full h-full opacity-20" style={{ backgroundColor: 'var(--background-color)' }} />
                    );
                  })()}
                </div>

                <div className="min-w-0 flex flex-col justify-center">
                  <h3 
                    className="text-xs font-black truncate leading-snug max-w-[200px] md:max-w-[240px]"
                    style={{ color: 'var(--card-color-text)' }}
                  >
                    {activeProduct.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1 leading-none">
                    {activeProduct.promoPrice ? (
                      <>
                        <span className="text-[10px] line-through opacity-40">
                          R$ {activeProduct.price.toFixed(2)}
                        </span>
                        <span className="text-xs font-extrabold text-[var(--primary-color)]">
                          R$ {activeProduct.promoPrice.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-extrabold opacity-75">
                        R$ {activeProduct.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={handleAddToCart}
                  className="px-4 h-10 rounded-xl hover:opacity-90 flex items-center justify-center flex-shrink-0 shadow transition-transform active:scale-95 text-[11px] font-black uppercase tracking-tight gap-2 cursor-pointer"
                  style={{ backgroundColor: 'var(--primary-color)', color: 'var(--button-text-color)' }}
                  title={activeProduct.hasVariations ? 'Ver opções' : 'Adicionar ao Carrinho'}
                >
                  <ShoppingCart size={15} />
                  {activeProduct.hasVariations ? 'Opções' : 'Comprar'}
                </button>
              </div>

            </div>
          ) : (
            <div 
              className="border rounded-3xl p-3.5 flex items-center justify-between gap-3 opacity-20 h-full animate-pulse"
              style={{
                backgroundColor: 'var(--card-color)',
                borderColor: 'var(--border-color)',
                color: 'var(--card-color-text)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gray-500/20" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-3 w-28 bg-gray-500/20 rounded" />
                  <div className="h-2.5 w-16 bg-gray-500/20 rounded" />
                </div>
              </div>
              <div className="h-10 w-24 bg-gray-500/25 rounded-xl" />
            </div>
          )}
        </div>

        {/* CAROUSEL BOTTOM DOTS/PAGE INDICATORS */}
        <div className="flex justify-center gap-2 mt-8">
          {stories.map((_, idx) => {
            const isCurrent = idx === activeIndex;
            return (
              <button
                key={idx}
                onClick={() => {
                  setActiveIndex(idx);
                  scrollToActive(idx);
                }}
                className="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  width: isCurrent ? '24px' : '6px',
                  backgroundColor: isCurrent ? 'var(--primary-color)' : 'rgba(128,128,128,0.25)',
                  boxShadow: isCurrent ? '0 0 8px var(--color-primary-glow)' : 'none'
                }}
              />
            );
          })}
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
