import { useEffect, useState, useRef } from 'react';

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
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <div className="relative h-full w-full bg-zinc-900">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      
      <img
        ref={imgRef}
        src={banner.imageUrl}
        alt=""
        loading={isEager ? 'eager' : 'lazy'}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-700",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}
