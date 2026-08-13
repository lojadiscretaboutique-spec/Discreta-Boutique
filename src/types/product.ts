export interface ProductVariant {
  id?: string;
  variantId?: string;
  name?: string;
  variantName?: string;
  sku?: string;
  variantSku?: string;
  barcode?: string;
  variantBarcode?: string;
  gtin?: string;
  price?: number;
  promoPrice?: number;
  costPrice?: number;
  stock?: number;
  variantStock?: number | string;
  variantPrice?: number | string;
  imageUrl?: string;
  images?: ProductImageItem[];
  active?: boolean;
  attributes?: Record<string, string>; // e.g. { "Cor": "Preto", "Tamanho": "P" }
  lastBalanceDate?: Date | string | number | { toDate?: () => Date } | null;
  lastBalanceCode?: string;
  lastBalanceCounted?: number;
  lastBalanceUser?: string;
  ean?: string;
  codigoBarras?: string;
}

export interface ProductFashionInfo {
  gender?: 'Masculino' | 'Feminino' | 'Unissex' | 'Infantil';
  ageGroup?: string;
  pieceType?: string;
  material?: string;
  composition?: string;
  hasPadding?: boolean;
  hasUnderwire?: boolean;
  transparency?: string;
  elasticity?: string;
  fit?: string;
  occasion?: string;
  season?: string;
  sizeTable?: string;
  washingInstructions?: string;
  countryOfOrigin?: string;
  mainColor?: string;
  print?: string;
  sleeve?: string;
  waist?: string;
  length?: string;
  closure?: string;
}

export interface ProductCosmeticsInfo {
  type?: string;
  usageArea?: string;
  volume?: string;
  fragrance?: string;
  skinType?: string;
  hairType?: string;
  benefits?: string;
  usageMode?: string;
  precautions?: string;
  ingredients?: string;
  vegan?: boolean;
  crueltyFree?: boolean;
  dermatologicallyTested?: boolean;
  hypoallergenic?: boolean;
  anvisaRegister?: string;
  batch?: string;
  manufacturingDate?: Date | string | null;
  expiryDate?: Date | string | null;
  pao?: string;
}

export interface ProductLogisticsInfo {
  weightKg?: number;
  heightCm?: number;
  widthCm?: number;
  lengthCm?: number;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
  cubicVolume?: number;
  additionalProcessingTime?: number;
  fragile?: boolean;
  specialPackaging?: boolean;
}

export interface ProductSeoInfo {
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  googleCategory?: string;
  condition?: 'new' | 'used';
  title?: string;
  description?: string;
}

export interface ProductExtrasInfo {
  showInVitrine?: boolean;
  showInApp?: boolean;
  showInCatalog?: boolean;
  exclusiveOnline?: boolean;
  acceptsCoupon?: boolean;
  salesCommission?: number;
  displayOrder?: number;
  internalNotes?: string;
}

export interface ProductImageObject {
  url: string;
  path?: string;
  isMain?: boolean;
  variantId?: string;
  [key: string]: unknown;
}

export type ProductImageItem = ProductImageObject;

export interface Product {
  id?: string;
  
  // 1. Informações Gerais
  name: string;
  subtitle?: string;
  shortDescription?: string;
  fullDescription?: string;
  categoryId: string;
  categoryIds?: string[];
  subcategory?: string;
  brand?: string;
  collection?: string;
  tags?: string[];
  internalCode?: string;
  sku: string;
  gtin?: string;
  ncm?: string;
  origin?: string;
  active: boolean;
  featured: boolean;
  newRelease: boolean;
  onSale?: boolean;
  colecoes?: string[];

  // 2. Preço e Estoque
  costPrice?: number;
  price: number;
  promoPrice?: number;
  promoStart?: Date | string | null;
  promoEnd?: Date | string | null;
  stock: number;
  minStock?: number;
  controlStock: boolean;
  allowBackorder: boolean;
  maxQtyPerOrder?: number;
  unit: 'un' | 'kit' | 'cx' | 'ml' | 'g' | 'kg' | 'par' | 'peça';

  // 3. Variações
  hasVariants: boolean;
  variants?: ProductVariant[];

  // 4. Moda
  fashion?: ProductFashionInfo;

  // 5. Cosméticos
  cosmetics?: ProductCosmeticsInfo;

  // 6. Mídia
  images: ProductImageItem[];
  imageUrl?: string;
  imageThumb?: string;
  thumbnailUrl?: string;
  mainImage?: string;
  videoUrl?: string;

  // 7. Logística & Entrega
  logistics?: ProductLogisticsInfo;
  delivery?: ProductLogisticsInfo;
  dimensions?: ProductLogisticsInfo;

  // 8. SEO
  seo?: ProductSeoInfo;

  // 9. Extras
  extras?: ProductExtrasInfo;

  // 10. Ranking / Analytics
  cliques?: number;
  conversoes?: number;
  visualizacoes?: number;
  score?: number;
  homeClicks?: number;
  homeScore?: number;

  // IA Enhancement
  ai_keywords?: string[];
  ai_synonyms?: string[];
  embedding?: number[];

  searchTerms?: string[];
  variantIdentifiers?: string[];
  isCombo?: boolean;
  lastBalanceDate?: Date | string | number | { toDate?: () => Date } | null;
  lastBalanceCode?: string;
  lastBalanceCounted?: number;
  lastBalanceUser?: string;
  barcode?: string;
  ean?: string;
  codigoBarras?: string;
  createdAt?: Date | string | number | { toDate?: () => Date } | null;
  updatedAt?: Date | string | number | { toDate?: () => Date } | null;
}
