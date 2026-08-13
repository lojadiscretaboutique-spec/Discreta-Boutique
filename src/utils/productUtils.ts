import { ProductImageItem } from '../types/product';

export function getProductImageUrl(img?: ProductImageItem | null): string {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (typeof img === 'object' && img !== null && 'url' in img) {
    return (img as any).url || '';
  }
  return '';
}

export function getProductMainImageUrl(images?: ProductImageItem[] | null): string {
  if (!images || !Array.isArray(images) || images.length === 0) return '';
  const main = images.find(img => typeof img === 'object' && img !== null && (img as any).isMain);
  if (main) return getProductImageUrl(main);
  return getProductImageUrl(images[0]);
}
