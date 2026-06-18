export interface LiveProduct {
  productId: string;
  livePrice?: number;
  textPromocional?: string;
  seloEspecial?: string;
  featured?: boolean;
  order: number;
}

export interface LiveFlashOffer {
  productId: string;
  discount: number; // percentual
  promoStock: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface LiveKit {
  id: string;
  name: string;
  productIds: string[];
  price: number;
  originalPrice: number;
  savings: number;
}

export interface LiveCoupon {
  code: string;
  discount: number; // percentual ou valor fixo
  validUntil: string;
  maxUses: number;
  usedCount: number;
  highlighted: boolean;
}

export interface LiveStatistics {
  views: number;
  productClicks: number;
  clickedProducts?: Record<string, number>;
  conversions: number;
  salesCount: number;
  revenue: number;
  couponsUsed: number;
  avgViewTime: number; // minutes
}

export interface LiveSettings {
  showCountdown: boolean;
  showRelatedProducts: boolean;
  showFlashOffers: boolean;
  showWhatsappButton: boolean;
  showBuyNowButton: boolean;
  enableFloatingPlayer: boolean;
  showLiveBadge: boolean;
}

export interface LiveSession {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  coverImage?: string;
  bannerImage?: string;
  date: string;
  time: string;
  status: 'agendada' | 'ao_vivo' | 'encerrada';
  streamingUrl: string;
  settings: LiveSettings;
  products: LiveProduct[];
  flashOffers: LiveFlashOffer[];
  kits: LiveKit[];
  coupons: LiveCoupon[];
  statistics: LiveStatistics;
  notificationConfig?: {
    pushEnabled: boolean;
    whatsappEnabled: boolean;
    emailEnabled: boolean;
    targetSegments: string;
  };
  createdAt?: any;
  updatedAt?: any;
}
