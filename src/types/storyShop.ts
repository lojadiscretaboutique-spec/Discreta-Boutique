import { Timestamp } from 'firebase/firestore';

export interface StoryShop {
  id?: string;
  title: string;
  description: string;
  productId: string;
  thumbnailUrl: string;
  videoUrl: string;
  active: boolean;
  featured: boolean;
  order: number;
  tags: string[];
  startDate: Timestamp | Date;
  endDate: Timestamp | Date;
  views: number;
  clicks: number;
  // Product details cached in the story
  productName?: string | null;
  productSlug?: string | null;
  productImageThumb?: string | null;
  price?: number | null;
  promotionalPrice?: number | null;
  inStock?: boolean;
  hasVariants?: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface PublicStoryShopCache {
  items: StoryShop[];
  updatedAt: Timestamp | Date;
  totalItems: number;
}
