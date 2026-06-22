import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

// Module-level cache to disable the CDN if it fails once during the current session
let isWeservDisabled = false;

try {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    isWeservDisabled = window.sessionStorage.getItem('disable_weserv_cdn') === 'true';
  }
} catch (e) {
  // Ignore
}

export function disableWeservGlobally() {
  isWeservDisabled = true;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem('disable_weserv_cdn', 'true');
    }
  } catch (e) {
    // Ignore
  }
}

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
export const DISCRETA_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='100%' height='100%' fill='%2309090b'/><text x='50%' y='50%' font-family='sans-serif' font-size='12' font-weight='bold' fill='%2327272a' dominant-baseline='middle' text-anchor='middle' letter-spacing='4'>DISCRETA BOUTIQUE</text></svg>";

export function optimizeImageUrl(src: string, options?: { width?: number; quality?: number }) {
  if (!src) return '';
  
  if (src.startsWith('/') || src.startsWith('data:') || src.startsWith('blob:')) {
    return src;
  }

  if (isWeservDisabled) {
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

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  isPriority?: boolean;
  width?: number;
  quality?: number;
  fallbackUrls?: string[];
}

export function ResponsiveImage({ 
  src, 
  alt, 
  className, 
  loading = 'lazy', 
  sizes = '(max-width: 768px) 100vw, 50vw',
  isPriority = false,
  width,
  quality,
  fallbackUrls = []
}: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // Compile full fallback list including the initial src and fallbackUrls
  const urlsToTry = [src, ...fallbackUrls, DISCRETA_PLACEHOLDER].filter(
    (url): url is string => typeof url === 'string' && url.trim() !== ''
  );
  
  const uniqueUrlsToTry = Array.from(new Set(urlsToTry));
  const activeUrl = uniqueUrlsToTry[attemptIndex] || DISCRETA_PLACEHOLDER;
  const [currentSrc, setCurrentSrc] = useState(() => optimizeImageUrl(activeUrl, { width, quality }));

  // Check if image is already cached or complete in browser
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
    }
  }, [currentSrc]);

  // Update currentSrc if src changes
  useEffect(() => {
    setAttemptIndex(0);
    setLoaded(false);
    setCurrentSrc(optimizeImageUrl(src || DISCRETA_PLACEHOLDER, { width, quality }));
  }, [src, width, quality]);

  const handleError = () => {
    // If the optimizer CDN fails, fallback seamlessly to original raw file first
    const isUrlOptimized = currentSrc.includes('images.weserv.nl') || currentSrc.includes('wsrv.nl');
    if (isUrlOptimized && activeUrl) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Image Optimizer Error / Dev Mode] Optimized URL failed for "${alt}". Trying raw URL: ${activeUrl}`);
      }
      disableWeservGlobally(); // Fail-safe to avoid other images failing
      setCurrentSrc(activeUrl);
    } else {
      // Move to the next fallback URL in the sequence
      const nextIndex = attemptIndex + 1;
      if (nextIndex < uniqueUrlsToTry.length) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Image Fallback / Dev Mode] Image failed for "${alt}". Advancing to fallback #${nextIndex}: ${uniqueUrlsToTry[nextIndex]}`);
        }
        setAttemptIndex(nextIndex);
        setLoaded(false);
        setCurrentSrc(optimizeImageUrl(uniqueUrlsToTry[nextIndex], { width, quality }));
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error(`[Image Error / Dev Mode] All fallback options and raw URLs failed for: "${alt}"`);
        }
      }
    }
  };

  return (
    <div className={cn("relative overflow-hidden bg-zinc-950 w-full h-full flex items-center justify-center", !loaded && "animate-pulse")}>
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        loading={isPriority ? 'eager' : loading}
        fetchPriority={isPriority ? 'high' : 'auto'}
        sizes={sizes}
        decoding="async"
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
