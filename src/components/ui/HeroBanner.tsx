import { useEffect, useState, useRef } from 'react';
import { optimizeImageUrl } from './ResponsiveImage';

interface HeroBannerProps {
  banner: {
    id: string;
    imageUrl: string;
    linkUrl: string;
  };
  isEager: boolean;
}

export function HeroBanner({ banner, isEager }: HeroBannerProps) {
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
    }
  }, [currentSrc]);

  const handleError = () => {
    if (currentSrc !== banner.imageUrl) {
      setCurrentSrc(banner.imageUrl);
    }
  };

  return (
    <div className="relative h-full w-full bg-zinc-950">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-900" />
      )}
      
      <img
        ref={imgRef}
        src={currentSrc}
        alt=""
        loading={isEager ? 'eager' : 'lazy'}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-1000",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
        onError={handleError}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
