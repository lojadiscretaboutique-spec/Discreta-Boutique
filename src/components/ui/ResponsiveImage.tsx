import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  isPriority?: boolean;
  width?: number;
  quality?: number;
}

/**
 * Optimizes an image URL for mobile, compressing its quality and resolution.
 * Uses images.weserv.nl for dynamic server-side resizing/compression to WebP.
 */
export function optimizeImageUrl(src: string, options?: { width?: number; quality?: number }) {
  if (!src) return '';
  
  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const targetWidth = options?.width || (isMobile ? 380 : 800);
  const targetQuality = options?.quality || (isMobile ? 65 : 80);

  try {
    if (src.includes('images.weserv.nl') || src.includes('wsrv.nl')) {
      return src;
    }
    const encodedUrl = encodeURIComponent(src);
    return `https://images.weserv.nl/?url=${encodedUrl}&w=${targetWidth}&q=${targetQuality}&output=webp`;
  } catch (e) {
    return src;
  }
}

export function ResponsiveImage({ 
  src, 
  alt, 
  className, 
  loading = 'lazy', 
  sizes = '(max-width: 768px) 100vw, 50vw',
  isPriority = false,
  width,
  quality
}: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(() => optimizeImageUrl(src, { width, quality }));

  // Update currentSrc if src changes
  useEffect(() => {
    setCurrentSrc(optimizeImageUrl(src, { width, quality }));
    setLoaded(false);
  }, [src, width, quality]);

  const handleError = () => {
    // If the optimizer CDN fails, fallback seamlessly to original raw file
    if (currentSrc !== src) {
      setCurrentSrc(src);
    }
  };

  return (
    <div className={cn("relative overflow-hidden bg-zinc-950", className)}>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-900" />
      )}
      <img
        src={currentSrc}
        alt={alt}
        loading={isPriority ? 'eager' : loading}
        fetchPriority={isPriority ? 'high' : 'auto'}
        sizes={sizes}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-1000",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
        onError={handleError}
      />
    </div>
  );
}
