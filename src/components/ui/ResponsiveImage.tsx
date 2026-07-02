import { useState, useEffect, useRef } from 'react';
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

export const DISCRETA_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'><rect width='100%' height='100%' fill='%2309090b'/><text x='50%' y='50%' font-family='sans-serif' font-size='12' font-weight='bold' fill='%2327272a' dominant-baseline='middle' text-anchor='middle' letter-spacing='4'>DISCRETA BOUTIQUE</text></svg>";

export function optimizeImageUrl(src: string, _options?: { width?: number; quality?: number }) {
  return src || DISCRETA_PLACEHOLDER;
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
  };

  return (
    <div className={cn("relative overflow-hidden bg-zinc-950 w-full h-full flex items-center justify-center")}>
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
          "opacity-100",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
