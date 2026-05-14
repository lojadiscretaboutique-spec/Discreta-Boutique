import { useState } from 'react';
import { cn } from '../../lib/utils';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}

export function ResponsiveImage({ src, alt, className, loading = 'lazy', sizes = '(max-width: 768px) 100vw, 50vw' }: ResponsiveImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={cn("relative overflow-hidden bg-zinc-900", className)}>
      {/* Skeleton / Blur */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-zinc-800" />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        sizes={sizes}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-700",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
