import { useEffect, useState, useRef } from 'react';
import { optimizeImageUrl } from './ResponsiveImage';

interface HeroBannerProps {
  banner: {
    id: string;
    imageUrl: string;
    linkUrl: string;
  };
  isEager: boolean;
  onLoad?: () => void;
}

export function HeroBanner({ banner, isEager, onLoad }: HeroBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(() => optimizeImageUrl(banner.imageUrl, { width: 1000, quality: 75 }));
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentSrc(optimizeImageUrl(banner.imageUrl, { width: 1000, quality: 75 }));
    setLoaded(false);
  }, [banner.imageUrl]);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
      if (onLoad) onLoad();
    }
  }, [currentSrc, onLoad]);

  const handleError = () => {
    if (currentSrc !== banner.imageUrl) {
      setCurrentSrc(banner.imageUrl);
    }
  };

  const handleLoad = () => {
    setLoaded(true);
    if (onLoad) onLoad();
  };

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-transparent" style={{ aspectRatio: '16/9' }} />
      )}
      
      <img
        ref={imgRef}
        src={currentSrc}
        alt=""
        loading={isEager ? 'eager' : 'lazy'}
        decoding={isEager ? 'async' : 'auto'}
        {...(isEager ? { fetchPriority: 'high' } : {})}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-700",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={handleLoad}
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}


function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
