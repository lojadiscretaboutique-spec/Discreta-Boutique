import { ResponsiveImage } from '../ui/ResponsiveImage';

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
  return (
    <ResponsiveImage
      src={src}
      alt={alt}
      className={className}
      width={width}
      quality={quality}
      {...props}
    />
  );
}
