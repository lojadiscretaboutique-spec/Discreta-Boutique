import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { optimizeImageUrl } from '../ui/ResponsiveImage';

export function SafeOptimizedImage({ 
  src, 
  alt, 
  className, 
  width, 
  quality = 65, 
  ...props 
}: { 
  src: string; 
  alt: string; 
  className?: string; 
  width?: number; 
  quality?: number; 
  [key: string]: any; 
}) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(() => optimizeImageUrl(src, { width, quality }));

  useEffect(() => {
    setCurrentSrc(optimizeImageUrl(src, { width, quality }));
    setLoaded(false);
  }, [src, width, quality]);

  const handleError = () => {
    if (currentSrc !== src) {
      setCurrentSrc(src);
    }
  };

  return (
    <div className={cn("relative w-full h-full bg-zinc-950 overflow-hidden flex items-center justify-center", !loaded && "animate-pulse")}>
      <img
        src={currentSrc}
        alt={alt}
        loading="lazy"
        className={cn(
          "transition-opacity duration-1000",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        referrerPolicy="no-referrer"
        {...props}
      />
    </div>
  );
}
