import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface GlobalTypography {
  fontFamily: string;
  weight: string;
  sizeDesktop: string;
  sizeTablet: string;
  sizeMobile: string;
  lineHeight: string;
  letterSpacing: string;
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
}

export interface HeaderTypography {
  logoFont: string;
  logoWeight: string;
  logoSizeDesktop: string;
  logoSizeTablet: string;
  logoSizeMobile: string;
  menuFont: string;
  menuWeight: string;
  menuSizeDesktop: string;
  menuSizeTablet: string;
  menuSizeMobile: string;
  submenuFont: string;
  submenuWeight: string;
  submenuSizeDesktop: string;
  submenuSizeTablet: string;
  submenuSizeMobile: string;
  topbarFont: string;
  topbarWeight: string;
  topbarSizeDesktop: string;
  topbarSizeTablet: string;
  topbarSizeMobile: string;
  searchFont: string;
  searchWeight: string;
  searchSizeDesktop: string;
  searchSizeTablet: string;
  searchSizeMobile: string;
  buttonFont: string;
  buttonWeight: string;
  buttonSizeDesktop: string;
  buttonSizeTablet: string;
  buttonSizeMobile: string;
}

export interface LinksTypography {
  menuFont: string;
  menuSize: string;
  menuWeight: string;
  menuColor: string;
  menuHoverColor: string;
  internalFont: string;
  internalSize: string;
  internalWeight: string;
  internalColor: string;
  internalHoverColor: string;
  footerFont: string;
  footerSize: string;
  footerWeight: string;
  footerColor: string;
  footerHoverColor: string;
  promoFont: string;
  promoSize: string;
  promoWeight: string;
  promoColor: string;
  promoHoverColor: string;
}

export interface ProductCardsTypography {
  nameFont: string;
  nameWeight: string;
  nameSizeDesktop: string;
  nameSizeTablet: string;
  nameSizeMobile: string;
  priceFont: string;
  priceWeight: string;
  priceSizeDesktop: string;
  priceSizeTablet: string;
  priceSizeMobile: string;
  promoPriceFont: string;
  promoPriceWeight: string;
  promoPriceSizeDesktop: string;
  promoPriceSizeTablet: string;
  promoPriceSizeMobile: string;
  installmentsFont: string;
  installmentsWeight: string;
  installmentsSizeDesktop: string;
  installmentsSizeTablet: string;
  installmentsSizeMobile: string;
  badgesFont: string;
  badgesWeight: string;
  badgesSizeDesktop: string;
  badgesSizeTablet: string;
  badgesSizeMobile: string;
  reviewsFont: string;
  reviewsWeight: string;
  reviewsSizeDesktop: string;
  reviewsSizeTablet: string;
  reviewsSizeMobile: string;
}

export interface MiniBannerTypography {
  titleFont: string;
  titleWeight: string;
  titleSizeDesktop: string;
  titleSizeTablet: string;
  titleSizeMobile: string;
  subtitleFont: string;
  subtitleWeight: string;
  subtitleSizeDesktop: string;
  subtitleSizeTablet: string;
  subtitleSizeMobile: string;
  buttonFont: string;
  buttonWeight: string;
  buttonSizeDesktop: string;
  buttonSizeTablet: string;
  buttonSizeMobile: string;
  helperFont: string;
  helperWeight: string;
  helperSizeDesktop: string;
  helperSizeTablet: string;
  helperSizeMobile: string;
}

export interface HeroBannerTypography {
  titleFont: string;
  titleWeight: string;
  titleSizeDesktop: string;
  titleSizeTablet: string;
  titleSizeMobile: string;
  subtitleFont: string;
  subtitleWeight: string;
  subtitleSizeDesktop: string;
  subtitleSizeTablet: string;
  subtitleSizeMobile: string;
  buttonFont: string;
  buttonWeight: string;
  buttonSizeDesktop: string;
  buttonSizeTablet: string;
  buttonSizeMobile: string;
  helperFont: string;
  helperWeight: string;
  helperSizeDesktop: string;
  helperSizeTablet: string;
  helperSizeMobile: string;
}

export interface CatalogTypography {
  titleFont: string;
  titleWeight: string;
  titleSizeDesktop: string;
  titleSizeTablet: string;
  titleSizeMobile: string;
  descFont: string;
  descWeight: string;
  descSizeDesktop: string;
  descSizeTablet: string;
  descSizeMobile: string;
  filtersFont: string;
  filtersWeight: string;
  filtersSizeDesktop: string;
  filtersSizeTablet: string;
  filtersSizeMobile: string;
  sortFont: string;
  sortWeight: string;
  sortSizeDesktop: string;
  sortSizeTablet: string;
  sortSizeMobile: string;
  countFont: string;
  countWeight: string;
  countSizeDesktop: string;
  countSizeTablet: string;
  countSizeMobile: string;
}

export interface ProductDetailsTypography {
  nameFont: string;
  nameWeight: string;
  nameSizeDesktop: string;
  nameSizeTablet: string;
  nameSizeMobile: string;
  priceFont: string;
  priceWeight: string;
  priceSizeDesktop: string;
  priceSizeTablet: string;
  priceSizeMobile: string;
  shortDescFont: string;
  shortDescWeight: string;
  shortDescSizeDesktop: string;
  shortDescSizeTablet: string;
  shortDescSizeMobile: string;
  fullDescFont: string;
  fullDescWeight: string;
  fullDescSizeDesktop: string;
  fullDescSizeTablet: string;
  fullDescSizeMobile: string;
  specsFont: string;
  specsWeight: string;
  specsSizeDesktop: string;
  specsSizeTablet: string;
  specsSizeMobile: string;
  reviewsFont: string;
  reviewsWeight: string;
  reviewsSizeDesktop: string;
  reviewsSizeTablet: string;
  reviewsSizeMobile: string;
  faqFont: string;
  faqWeight: string;
  faqSizeDesktop: string;
  faqSizeTablet: string;
  faqSizeMobile: string;
}

export interface CartTypography {
  itemNameFont: string;
  itemNameWeight: string;
  itemNameSizeDesktop: string;
  itemNameSizeTablet: string;
  itemNameSizeMobile: string;
  summaryFont: string;
  summaryWeight: string;
  summarySizeDesktop: string;
  summarySizeTablet: string;
  summarySizeMobile: string;
  subtotalFont: string;
  subtotalWeight: string;
  subtotalSizeDesktop: string;
  subtotalSizeTablet: string;
  subtotalSizeMobile: string;
  totalFont: string;
  totalWeight: string;
  totalSizeDesktop: string;
  totalSizeTablet: string;
  totalSizeMobile: string;
  couponsFont: string;
  couponsWeight: string;
  couponsSizeDesktop: string;
  couponsSizeTablet: string;
  couponsSizeMobile: string;
  messagesFont: string;
  messagesWeight: string;
  messagesSizeDesktop: string;
  messagesSizeTablet: string;
  messagesSizeMobile: string;
  buttonsFont: string;
  buttonsWeight: string;
  buttonsSizeDesktop: string;
  buttonsSizeTablet: string;
  buttonsSizeMobile: string;
}

export interface CheckoutTypography {
  titlesFont: string;
  titlesWeight: string;
  titlesSizeDesktop: string;
  titlesSizeTablet: string;
  titlesSizeMobile: string;
  fieldsFont: string;
  fieldsWeight: string;
  fieldsSizeDesktop: string;
  fieldsSizeTablet: string;
  fieldsSizeMobile: string;
  labelsFont: string;
  labelsWeight: string;
  labelsSizeDesktop: string;
  labelsSizeTablet: string;
  labelsSizeMobile: string;
  validationFont: string;
  validationWeight: string;
  validationSizeDesktop: string;
  validationSizeTablet: string;
  validationSizeMobile: string;
  summaryFont: string;
  summaryWeight: string;
  summarySizeDesktop: string;
  summarySizeTablet: string;
  summarySizeMobile: string;
  totalsFont: string;
  totalsWeight: string;
  totalsSizeDesktop: string;
  totalsSizeTablet: string;
  totalsSizeMobile: string;
  buttonsFont: string;
  buttonsWeight: string;
  buttonsSizeDesktop: string;
  buttonsSizeTablet: string;
  buttonsSizeMobile: string;
}

export interface FooterTypography {
  titleFont: string;
  titleWeight: string;
  titleSizeDesktop: string;
  titleSizeTablet: string;
  titleSizeMobile: string;
  menuFont: string;
  menuWeight: string;
  menuSizeDesktop: string;
  menuSizeTablet: string;
  menuSizeMobile: string;
  textsFont: string;
  textsWeight: string;
  textsSizeDesktop: string;
  textsSizeTablet: string;
  textsSizeMobile: string;
  copyrightFont: string;
  copyrightWeight: string;
  copyrightSizeDesktop: string;
  copyrightSizeTablet: string;
  copyrightSizeMobile: string;
  contactFont: string;
  contactWeight: string;
  contactSizeDesktop: string;
  contactSizeTablet: string;
  contactSizeMobile: string;
}

export interface AdvancedTypographyConfig {
  global: GlobalTypography;
  header: HeaderTypography;
  links: LinksTypography;
  productCards: ProductCardsTypography;
  miniBanner: MiniBannerTypography;
  heroBanner: HeroBannerTypography;
  catalog: CatalogTypography;
  productDetails: ProductDetailsTypography;
  cart: CartTypography;
  checkout: CheckoutTypography;
  footer: FooterTypography;
  
  // Brand rules
  brandColor: string;
  brandSize: string;
  brandLetterSpacing: string;
}

export const APPROVED_FONTS: Record<string, string> = {
  'DM Sans': '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
  'Inter': '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
  'Poppins': '"Poppins", "Helvetica Neue", Helvetica, Arial, sans-serif',
  'Outfit': '"Outfit", "Helvetica Neue", Helvetica, Arial, sans-serif',
  'Manrope': '"Manrope", "Helvetica Neue", Helvetica, Arial, sans-serif',
  'Plus Jakarta Sans': '"Plus Jakarta Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
  'Montserrat': '"Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif',
  'Nunito Sans': '"Nunito Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
};

export const INITIAL_DEFAULT_TYPOGRAPHY: AdvancedTypographyConfig = {
  global: {
    fontFamily: 'DM Sans',
    weight: '400',
    sizeDesktop: '15px',
    sizeTablet: '14px',
    sizeMobile: '13px',
    lineHeight: '1.6',
    letterSpacing: '0em',
    textTransform: 'none'
  },
  header: {
    logoFont: 'DM Sans', logoWeight: '700', logoSizeDesktop: '22px', logoSizeTablet: '20px', logoSizeMobile: '18px',
    menuFont: 'Inter', menuWeight: '500', menuSizeDesktop: '13px', menuSizeTablet: '12px', menuSizeMobile: '11px',
    submenuFont: 'Inter', submenuWeight: '400', submenuSizeDesktop: '12px', submenuSizeTablet: '11px', submenuSizeMobile: '11px',
    topbarFont: 'Inter', topbarWeight: '400', topbarSizeDesktop: '12px', topbarSizeTablet: '11px', topbarSizeMobile: '10px',
    searchFont: 'Inter', searchWeight: '400', searchSizeDesktop: '13px', searchSizeTablet: '12px', searchSizeMobile: '11px',
    buttonFont: 'DM Sans', buttonWeight: '600', buttonSizeDesktop: '13px', buttonSizeTablet: '12px', buttonSizeMobile: '11px',
  },
  links: {
    menuFont: 'Inter', menuSize: '13px', menuWeight: '500', menuColor: '#0f172a', menuHoverColor: '#dc2626',
    internalFont: 'Inter', internalSize: '14px', internalWeight: '400', internalColor: '#2563eb', internalHoverColor: '#1d4ed8',
    footerFont: 'Inter', footerSize: '13px', footerWeight: '400', footerColor: '#475569', footerHoverColor: '#dc2626',
    promoFont: 'Poppins', promoSize: '14px', promoWeight: '600', promoColor: '#b91c1c', promoHoverColor: '#991b1b',
  },
  productCards: {
    nameFont: 'DM Sans', nameWeight: '500', nameSizeDesktop: '15px', nameSizeTablet: '14px', nameSizeMobile: '13px',
    priceFont: 'Poppins', priceWeight: '700', priceSizeDesktop: '18px', priceSizeTablet: '17px', priceSizeMobile: '15px',
    promoPriceFont: 'Poppins', promoPriceWeight: '800', promoPriceSizeDesktop: '20px', promoPriceSizeTablet: '18px', promoPriceSizeMobile: '17px',
    installmentsFont: 'Inter', installmentsWeight: '400', installmentsSizeDesktop: '12px', installmentsSizeTablet: '11px', installmentsSizeMobile: '10px',
    badgesFont: 'Inter', badgesWeight: '600', badgesSizeDesktop: '10px', badgesSizeTablet: '9px', badgesSizeMobile: '8px',
    reviewsFont: 'Inter', reviewsWeight: '450', reviewsSizeDesktop: '11px', reviewsSizeTablet: '10px', reviewsSizeMobile: '9px',
  },
  miniBanner: {
    titleFont: 'DM Sans', titleWeight: '700', titleSizeDesktop: '18px', titleSizeTablet: '16px', titleSizeMobile: '15px',
    subtitleFont: 'Inter', subtitleWeight: '400', subtitleSizeDesktop: '13px', subtitleSizeTablet: '12px', subtitleSizeMobile: '11px',
    buttonFont: 'DM Sans', buttonWeight: '600', buttonSizeDesktop: '12px', buttonSizeTablet: '11px', buttonSizeMobile: '10px',
    helperFont: 'Inter', helperWeight: '400', helperSizeDesktop: '11px', helperSizeTablet: '10px', helperSizeMobile: '9px',
  },
  heroBanner: {
    titleFont: 'Outfit', titleWeight: '800', titleSizeDesktop: '40px', titleSizeTablet: '32px', titleSizeMobile: '24px',
    subtitleFont: 'DM Sans', subtitleWeight: '400', subtitleSizeDesktop: '16px', subtitleSizeTablet: '14px', subtitleSizeMobile: '13px',
    buttonFont: 'Poppins', buttonWeight: '600', buttonSizeDesktop: '14px', buttonSizeTablet: '13px', buttonSizeMobile: '12px',
    helperFont: 'Inter', helperWeight: '400', helperSizeDesktop: '11px', helperSizeTablet: '10px', helperSizeMobile: '9px',
  },
  catalog: {
    titleFont: 'Outfit', titleWeight: '700', titleSizeDesktop: '28px', titleSizeTablet: '24px', titleSizeMobile: '20px',
    descFont: 'Inter', descWeight: '400', descSizeDesktop: '14px', descSizeTablet: '13px', descSizeMobile: '12px',
    filtersFont: 'Inter', filtersWeight: '500', filtersSizeDesktop: '13px', filtersSizeTablet: '12px', filtersSizeMobile: '11px',
    sortFont: 'Inter', sortWeight: '400', sortSizeDesktop: '13px', sortSizeTablet: '12px', sortSizeMobile: '11px',
    countFont: 'Inter', countWeight: '400', countSizeDesktop: '12px', countSizeTablet: '11px', countSizeMobile: '10px',
  },
  productDetails: {
    nameFont: 'Outfit', nameWeight: '700', nameSizeDesktop: '26px', nameSizeTablet: '22px', nameSizeMobile: '18px',
    priceFont: 'Poppins', priceWeight: '800', priceSizeDesktop: '28px', priceSizeTablet: '24px', priceSizeMobile: '20px',
    shortDescFont: 'Inter', shortDescWeight: '400', shortDescSizeDesktop: '14px', shortDescSizeTablet: '13px', shortDescSizeMobile: '12px',
    fullDescFont: 'Inter', fullDescWeight: '400', fullDescSizeDesktop: '14px', fullDescSizeTablet: '13px', fullDescSizeMobile: '12px',
    specsFont: 'Inter', specsWeight: '400', specsSizeDesktop: '13px', specsSizeTablet: '12px', specsSizeMobile: '11px',
    reviewsFont: 'Inter', reviewsWeight: '400', reviewsSizeDesktop: '13px', reviewsSizeTablet: '12px', reviewsSizeMobile: '11px',
    faqFont: 'Inter', faqWeight: '400', faqSizeDesktop: '14px', faqSizeTablet: '13px', faqSizeMobile: '12px',
  },
  cart: {
    itemNameFont: 'DM Sans', itemNameWeight: '500', itemNameSizeDesktop: '15px', itemNameSizeTablet: '14px', itemNameSizeMobile: '13px',
    summaryFont: 'Inter', summaryWeight: '400', summarySizeDesktop: '14px', summarySizeTablet: '13px', summarySizeMobile: '12px',
    subtotalFont: 'Poppins', subtotalWeight: '600', subtotalSizeDesktop: '15px', subtotalSizeTablet: '14px', subtotalSizeMobile: '13px',
    totalFont: 'Poppins', totalWeight: '700', totalSizeDesktop: '20px', totalSizeTablet: '18px', totalSizeMobile: '16px',
    couponsFont: 'Inter', couponsWeight: '500', couponsSizeDesktop: '13px', couponsSizeTablet: '12px', couponsSizeMobile: '11px',
    messagesFont: 'Inter', messagesWeight: '400', messagesSizeDesktop: '12px', messagesSizeTablet: '11px', messagesSizeMobile: '10px',
    buttonsFont: 'DM Sans', buttonsWeight: '700', buttonsSizeDesktop: '13px', buttonsSizeTablet: '12px', buttonsSizeMobile: '11px',
  },
  checkout: {
    titlesFont: 'Outfit', titlesWeight: '700', titlesSizeDesktop: '18px', titlesSizeTablet: '17px', titlesSizeMobile: '16px',
    fieldsFont: 'Inter', fieldsWeight: '400', fieldsSizeDesktop: '14px', fieldsSizeTablet: '13px', fieldsSizeMobile: '12px',
    labelsFont: 'Inter', labelsWeight: '500', labelsSizeDesktop: '12px', labelsSizeTablet: '11px', labelsSizeMobile: '10px',
    validationFont: 'Inter', validationWeight: '400', validationSizeDesktop: '11px', validationSizeTablet: '10px', validationSizeMobile: '9px',
    summaryFont: 'Inter', summaryWeight: '400', summarySizeDesktop: '13px', summarySizeTablet: '12px', summarySizeMobile: '11px',
    totalsFont: 'Poppins', totalsWeight: '700', totalsSizeDesktop: '16px', totalsSizeTablet: '15px', totalsSizeMobile: '14px',
    buttonsFont: 'DM Sans', buttonsWeight: '700', buttonsSizeDesktop: '13px', buttonsSizeTablet: '12px', buttonsSizeMobile: '11px',
  },
  footer: {
    titleFont: 'DM Sans', titleWeight: '700', titleSizeDesktop: '15px', titleSizeTablet: '14px', titleSizeMobile: '13px',
    menuFont: 'Inter', menuWeight: '400', menuSizeDesktop: '12px', menuSizeTablet: '11px', menuSizeMobile: '10px',
    textsFont: 'Inter', textsWeight: '300', textsSizeDesktop: '12px', textsSizeTablet: '11px', textsSizeMobile: '10px',
    copyrightFont: 'Inter', copyrightWeight: '300', copyrightSizeDesktop: '11px', copyrightSizeTablet: '10px', copyrightSizeMobile: '9px',
    contactFont: 'Inter', contactWeight: '400', contactSizeDesktop: '12px', contactSizeTablet: '11px', contactSizeMobile: '10px',
  },
  brandColor: '#D32F2F',
  brandSize: '24px',
  brandLetterSpacing: '-0.05em'
};

interface TypographyContextType {
  config: AdvancedTypographyConfig;
  loading: boolean;
  saveTypography: (newConfig: AdvancedTypographyConfig) => Promise<void>;
  resetToDefault: () => Promise<void>;
}

const TypographyContext = createContext<TypographyContextType | undefined>(undefined);

export function TypographyProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AdvancedTypographyConfig>(INITIAL_DEFAULT_TYPOGRAPHY);
  const [loading, setLoading] = useState(true);

  // Load configuration from Firestore and set up real-time listener
  useEffect(() => {
    const docRef = doc(db, 'settings', 'typography');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        
        // Ensure robust structural merge with fallback defaults
        const parsed: AdvancedTypographyConfig = {
          global: { ...INITIAL_DEFAULT_TYPOGRAPHY.global, ...rawData.global },
          header: { ...INITIAL_DEFAULT_TYPOGRAPHY.header, ...rawData.header },
          links: { ...INITIAL_DEFAULT_TYPOGRAPHY.links, ...rawData.links },
          productCards: { ...INITIAL_DEFAULT_TYPOGRAPHY.productCards, ...rawData.productCards },
          miniBanner: { ...INITIAL_DEFAULT_TYPOGRAPHY.miniBanner, ...rawData.miniBanner },
          heroBanner: { ...INITIAL_DEFAULT_TYPOGRAPHY.heroBanner, ...rawData.heroBanner },
          catalog: { ...INITIAL_DEFAULT_TYPOGRAPHY.catalog, ...rawData.catalog },
          productDetails: { ...INITIAL_DEFAULT_TYPOGRAPHY.productDetails, ...rawData.productDetails },
          cart: { ...INITIAL_DEFAULT_TYPOGRAPHY.cart, ...rawData.cart },
          checkout: { ...INITIAL_DEFAULT_TYPOGRAPHY.checkout, ...rawData.checkout },
          footer: { ...INITIAL_DEFAULT_TYPOGRAPHY.footer, ...rawData.footer },
          brandColor: rawData.brandColor || INITIAL_DEFAULT_TYPOGRAPHY.brandColor,
          brandSize: rawData.brandSize || INITIAL_DEFAULT_TYPOGRAPHY.brandSize,
          brandLetterSpacing: rawData.brandLetterSpacing || INITIAL_DEFAULT_TYPOGRAPHY.brandLetterSpacing
        };
        
        setConfig(parsed);
      } else {
        setConfig(INITIAL_DEFAULT_TYPOGRAPHY);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to typography updates:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Update dynamic font loads and root CSS variables whenever configuration changes
  useEffect(() => {
    if (loading) return;

    // 1. Gather all required font families for dynamic load
    const userSelectedFonts = new Set<string>();
    const checkAndAdd = (font: string) => {
      if (font && APPROVED_FONTS[font]) {
        userSelectedFonts.add(font);
      }
    };
    
    // Check all font entries across the layout nested configs
    checkAndAdd(config.global.fontFamily);
    
    checkAndAdd(config.header.logoFont);
    checkAndAdd(config.header.menuFont);
    checkAndAdd(config.header.submenuFont);
    checkAndAdd(config.header.topbarFont);
    checkAndAdd(config.header.searchFont);
    checkAndAdd(config.header.buttonFont);

    checkAndAdd(config.links.menuFont);
    checkAndAdd(config.links.internalFont);
    checkAndAdd(config.links.footerFont);
    checkAndAdd(config.links.promoFont);

    checkAndAdd(config.productCards.nameFont);
    checkAndAdd(config.productCards.priceFont);
    checkAndAdd(config.productCards.promoPriceFont);
    checkAndAdd(config.productCards.installmentsFont);
    checkAndAdd(config.productCards.badgesFont);
    checkAndAdd(config.productCards.reviewsFont);

    checkAndAdd(config.miniBanner.titleFont);
    checkAndAdd(config.miniBanner.subtitleFont);
    checkAndAdd(config.miniBanner.buttonFont);
    checkAndAdd(config.miniBanner.helperFont);

    checkAndAdd(config.heroBanner.titleFont);
    checkAndAdd(config.heroBanner.subtitleFont);
    checkAndAdd(config.heroBanner.buttonFont);
    checkAndAdd(config.heroBanner.helperFont);

    checkAndAdd(config.catalog.titleFont);
    checkAndAdd(config.catalog.descFont);
    checkAndAdd(config.catalog.filtersFont);
    checkAndAdd(config.catalog.sortFont);
    checkAndAdd(config.catalog.countFont);

    checkAndAdd(config.productDetails.nameFont);
    checkAndAdd(config.productDetails.priceFont);
    checkAndAdd(config.productDetails.shortDescFont);
    checkAndAdd(config.productDetails.fullDescFont);
    checkAndAdd(config.productDetails.specsFont);
    checkAndAdd(config.productDetails.reviewsFont);
    checkAndAdd(config.productDetails.faqFont);

    checkAndAdd(config.cart.itemNameFont);
    checkAndAdd(config.cart.summaryFont);
    checkAndAdd(config.cart.subtotalFont);
    checkAndAdd(config.cart.totalFont);
    checkAndAdd(config.cart.couponsFont);
    checkAndAdd(config.cart.messagesFont);
    checkAndAdd(config.cart.buttonsFont);

    checkAndAdd(config.checkout.titlesFont);
    checkAndAdd(config.checkout.fieldsFont);
    checkAndAdd(config.checkout.labelsFont);
    checkAndAdd(config.checkout.validationFont);
    checkAndAdd(config.checkout.summaryFont);
    checkAndAdd(config.checkout.totalsFont);
    checkAndAdd(config.checkout.buttonsFont);

    checkAndAdd(config.footer.titleFont);
    checkAndAdd(config.footer.menuFont);
    checkAndAdd(config.footer.textsFont);
    checkAndAdd(config.footer.copyrightFont);
    checkAndAdd(config.footer.contactFont);

    // 2. Build the Google Fonts URL parameter
    if (userSelectedFonts.size > 0) {
      const fontList = Array.from(userSelectedFonts);
      const fontQuery = fontList
        .map(font => {
          const formattedName = font.replace(/ /g, '+');
          return `family=${formattedName}:wght@300;450;500;600;700;800;900`;
        })
        .join('&');
      
      const linkId = 'dynamic-storefront-fonts';
      let existingLink = document.getElementById(linkId) as HTMLLinkElement | null;
      const fontUrl = `https://fonts.googleapis.com/css2?${fontQuery}&display=swap`;
      
      if (existingLink) {
        existingLink.href = fontUrl;
      } else {
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = fontUrl;
        document.head.appendChild(link);
      }
    }

    const getChain = (fontName: string) => APPROVED_FONTS[fontName] || APPROVED_FONTS['DM Sans'];

    // 3. Inject CSS rules dynamically into document head under storefront & global scope to allow 100% accurate device response
    const styleId = 'dynamic-typography-overrides-style';
    let existingStyle = document.getElementById(styleId) as HTMLStyleElement | null;
    
    const customRules = `
      :root {
        --brand-logo-color: ${config.brandColor};
        --brand-logo-size: ${config.brandSize};
        --brand-logo-spacing: ${config.brandLetterSpacing};
      }

      /* Fixed brand logo styling lock across the layout */
      .brand-logo-text {
        font-family: "DM Sans", system-ui, sans-serif !important;
        font-weight: 900 !important;
        color: var(--brand-logo-color) !important;
        font-size: var(--brand-logo-size) !important;
        letter-spacing: var(--brand-logo-spacing) !important;
      }

      /* Core Global Styles Responsive Ranges */
      .storefront-theme-container, .storefront-text-normal {
        font-family: ${getChain(config.global.fontFamily)} !important;
        font-weight: ${config.global.weight} !important;
        line-height: ${config.global.lineHeight} !important;
        letter-spacing: ${config.global.letterSpacing} !important;
        text-transform: ${config.global.textTransform} !important;
      }

      /* Responsive Custom Media Rules */
      @media (min-width: 1024px) {
        .storefront-theme-container, .storefront-text-normal { font-size: ${config.global.sizeDesktop} !important; }
        
        /* Header Selector Overrides */
        .storefront-header-logo { font-size: ${config.header.logoSizeDesktop}; font-family: ${getChain(config.header.logoFont)}; font-weight: ${config.header.logoWeight}; }
        .storefront-header-menu { font-size: ${config.header.menuSizeDesktop}; font-family: ${getChain(config.header.menuFont)}; font-weight: ${config.header.menuWeight}; }
        .storefront-header-submenu { font-size: ${config.header.submenuSizeDesktop}; font-family: ${getChain(config.header.submenuFont)}; font-weight: ${config.header.submenuWeight}; }
        .storefront-header-topbar { font-size: ${config.header.topbarSizeDesktop}; font-family: ${getChain(config.header.topbarFont)}; font-weight: ${config.header.topbarWeight}; }
        .storefront-header-search { font-size: ${config.header.searchSizeDesktop}; font-family: ${getChain(config.header.searchFont)}; font-weight: ${config.header.searchWeight}; }
        .storefront-header-button { font-size: ${config.header.buttonSizeDesktop}; font-family: ${getChain(config.header.buttonFont)}; font-weight: ${config.header.buttonWeight}; }

        /* Links styling */
        .storefront-link-menu { font-family: ${getChain(config.links.menuFont)}; font-weight: ${config.links.menuWeight}; font-size: ${config.links.menuSize}; color: ${config.links.menuColor}; }
        .storefront-link-menu:hover { color: ${config.links.menuHoverColor} !important; }
        .storefront-link-internal { font-family: ${getChain(config.links.internalFont)}; font-weight: ${config.links.internalWeight}; font-size: ${config.links.internalSize}; color: ${config.links.internalColor}; }
        .storefront-link-internal:hover { color: ${config.links.internalHoverColor} !important; }
        .storefront-link-footer { font-family: ${getChain(config.links.footerFont)}; font-weight: ${config.links.footerWeight}; font-size: ${config.links.footerSize}; color: ${config.links.footerColor}; }
        .storefront-link-footer:hover { color: ${config.links.footerHoverColor} !important; }
        .storefront-link-promo { font-family: ${getChain(config.links.promoFont)}; font-weight: ${config.links.promoWeight}; font-size: ${config.links.promoSize}; color: ${config.links.promoColor}; }
        .storefront-link-promo:hover { color: ${config.links.promoHoverColor} !important; }

        /* Product Cards */
        .storefront-card-name { font-family: ${getChain(config.productCards.nameFont)}; font-weight: ${config.productCards.nameWeight}; font-size: ${config.productCards.nameSizeDesktop}; }
        .storefront-card-price { font-family: ${getChain(config.productCards.priceFont)}; font-weight: ${config.productCards.priceWeight}; font-size: ${config.productCards.priceSizeDesktop}; }
        .storefront-card-promo { font-family: ${getChain(config.productCards.promoPriceFont)}; font-weight: ${config.productCards.promoPriceWeight}; font-size: ${config.productCards.promoPriceSizeDesktop}; }
        .storefront-card-installments { font-family: ${getChain(config.productCards.installmentsFont)}; font-weight: ${config.productCards.installmentsWeight}; font-size: ${config.productCards.installmentsSizeDesktop}; }
        .storefront-card-badge { font-family: ${getChain(config.productCards.badgesFont)}; font-weight: ${config.productCards.badgesWeight}; font-size: ${config.productCards.badgesSizeDesktop}; }
        .storefront-card-reviews { font-family: ${getChain(config.productCards.reviewsFont)}; font-weight: ${config.productCards.reviewsWeight}; font-size: ${config.productCards.reviewsSizeDesktop}; }

        /* Banners */
        .storefront-mini-title { font-family: ${getChain(config.miniBanner.titleFont)}; font-weight: ${config.miniBanner.titleWeight}; font-size: ${config.miniBanner.titleSizeDesktop}; }
        .storefront-mini-subtitle { font-family: ${getChain(config.miniBanner.subtitleFont)}; font-weight: ${config.miniBanner.subtitleWeight}; font-size: ${config.miniBanner.subtitleSizeDesktop}; }
        .storefront-mini-button { font-family: ${getChain(config.miniBanner.buttonFont)}; font-weight: ${config.miniBanner.buttonWeight}; font-size: ${config.miniBanner.buttonSizeDesktop}; }
        .storefront-mini-helper { font-family: ${getChain(config.miniBanner.helperFont)}; font-weight: ${config.miniBanner.helperWeight}; font-size: ${config.miniBanner.helperSizeDesktop}; }

        .storefront-super-title { font-family: ${getChain(config.heroBanner.titleFont)}; font-weight: ${config.heroBanner.titleWeight}; font-size: ${config.heroBanner.titleSizeDesktop}; }
        .storefront-super-subtitle { font-family: ${getChain(config.heroBanner.subtitleFont)}; font-weight: ${config.heroBanner.subtitleWeight}; font-size: ${config.heroBanner.subtitleSizeDesktop}; }
        .storefront-super-button { font-family: ${getChain(config.heroBanner.buttonFont)}; font-weight: ${config.heroBanner.buttonWeight}; font-size: ${config.heroBanner.buttonSizeDesktop}; }
        .storefront-super-helper { font-family: ${getChain(config.heroBanner.helperFont)}; font-weight: ${config.heroBanner.helperWeight}; font-size: ${config.heroBanner.helperSizeDesktop}; }

        /* Catalog */
        .storefront-catalog-title { font-family: ${getChain(config.catalog.titleFont)}; font-weight: ${config.catalog.titleWeight}; font-size: ${config.catalog.titleSizeDesktop}; }
        .storefront-catalog-desc { font-family: ${getChain(config.catalog.descFont)}; font-weight: ${config.catalog.descWeight}; font-size: ${config.catalog.descSizeDesktop}; }
        .storefront-catalog-filter { font-family: ${getChain(config.catalog.filtersFont)}; font-weight: ${config.catalog.filtersWeight}; font-size: ${config.catalog.filtersSizeDesktop}; }
        .storefront-catalog-sort { font-family: ${getChain(config.catalog.sortFont)}; font-weight: ${config.catalog.sortWeight}; font-size: ${config.catalog.sortSizeDesktop}; }
        .storefront-catalog-count { font-family: ${getChain(config.catalog.countFont)}; font-weight: ${config.catalog.countWeight}; font-size: ${config.catalog.countSizeDesktop}; }

        /* Product Details page */
        .storefront-det-name { font-family: ${getChain(config.productDetails.nameFont)}; font-weight: ${config.productDetails.nameWeight}; font-size: ${config.productDetails.nameSizeDesktop}; }
        .storefront-det-price { font-family: ${getChain(config.productDetails.priceFont)}; font-weight: ${config.productDetails.priceWeight}; font-size: ${config.productDetails.priceSizeDesktop}; }
        .storefront-det-shortdesc { font-family: ${getChain(config.productDetails.shortDescFont)}; font-weight: ${config.productDetails.shortDescWeight}; font-size: ${config.productDetails.shortDescSizeDesktop}; }
        .storefront-det-fulldesc { font-family: ${getChain(config.productDetails.fullDescFont)}; font-weight: ${config.productDetails.fullDescWeight}; font-size: ${config.productDetails.fullDescSizeDesktop}; }
        .storefront-det-specs { font-family: ${getChain(config.productDetails.specsFont)}; font-weight: ${config.productDetails.specsWeight}; font-size: ${config.productDetails.specsSizeDesktop}; }
        .storefront-det-reviews { font-family: ${getChain(config.productDetails.reviewsFont)}; font-weight: ${config.productDetails.reviewsWeight}; font-size: ${config.productDetails.reviewsSizeDesktop}; }
        .storefront-det-faq { font-family: ${getChain(config.productDetails.faqFont)}; font-weight: ${config.productDetails.faqWeight}; font-size: ${config.productDetails.faqSizeDesktop}; }

        /* Cart Page */
        .storefront-cart-title { font-family: ${getChain(config.cart.itemNameFont)}; font-weight: ${config.cart.itemNameWeight}; font-size: ${config.cart.itemNameSizeDesktop}; }
        .storefront-cart-summary { font-family: ${getChain(config.cart.summaryFont)}; font-weight: ${config.cart.summaryWeight}; font-size: ${config.cart.summarySizeDesktop}; }
        .storefront-cart-subtotal { font-family: ${getChain(config.cart.subtotalFont)}; font-weight: ${config.cart.subtotalWeight}; font-size: ${config.cart.subtotalSizeDesktop}; }
        .storefront-cart-total { font-family: ${getChain(config.cart.totalFont)}; font-weight: ${config.cart.totalWeight}; font-size: ${config.cart.totalSizeDesktop}; }
        .storefront-cart-coupons { font-family: ${getChain(config.cart.couponsFont)}; font-weight: ${config.cart.couponsWeight}; font-size: ${config.cart.couponsSizeDesktop}; }
        .storefront-cart-messages { font-family: ${getChain(config.cart.messagesFont)}; font-weight: ${config.cart.messagesWeight}; font-size: ${config.cart.messagesSizeDesktop}; }
        .storefront-cart-btn { font-family: ${getChain(config.cart.buttonsFont)}; font-weight: ${config.cart.buttonsWeight}; font-size: ${config.cart.buttonsSizeDesktop}; }

        /* Checkout Page */
        .storefront-check-title { font-family: ${getChain(config.checkout.titlesFont)}; font-weight: ${config.checkout.titlesWeight}; font-size: ${config.checkout.titlesSizeDesktop}; }
        .storefront-check-field { font-family: ${getChain(config.checkout.fieldsFont)}; font-weight: ${config.checkout.fieldsWeight}; font-size: ${config.checkout.fieldsSizeDesktop}; }
        .storefront-check-label { font-family: ${getChain(config.checkout.labelsFont)}; font-weight: ${config.checkout.labelsWeight}; font-size: ${config.checkout.labelsSizeDesktop}; }
        .storefront-check-valid { font-family: ${getChain(config.checkout.validationFont)}; font-weight: ${config.checkout.validationWeight}; font-size: ${config.checkout.validationSizeDesktop}; }
        .storefront-check-summary { font-family: ${getChain(config.checkout.summaryFont)}; font-weight: ${config.checkout.summaryWeight}; font-size: ${config.checkout.summarySizeDesktop}; }
        .storefront-check-total { font-family: ${getChain(config.checkout.totalsFont)}; font-weight: ${config.checkout.totalsWeight}; font-size: ${config.checkout.totalsSizeDesktop}; }
        .storefront-check-btn { font-family: ${getChain(config.checkout.buttonsFont)}; font-weight: ${config.checkout.buttonsWeight}; font-size: ${config.checkout.buttonsSizeDesktop}; }

        /* Footer styling */
        .storefront-foot-title { font-family: ${getChain(config.footer.titleFont)}; font-weight: ${config.footer.titleWeight}; font-size: ${config.footer.titleSizeDesktop}; }
        .storefront-foot-menu { font-family: ${getChain(config.footer.menuFont)}; font-weight: ${config.footer.menuWeight}; font-size: ${config.footer.menuSizeDesktop}; }
        .storefront-foot-text { font-family: ${getChain(config.footer.textsFont)}; font-weight: ${config.footer.textsWeight}; font-size: ${config.footer.textsSizeDesktop}; }
        .storefront-foot-copyright { font-family: ${getChain(config.footer.copyrightFont)}; font-weight: ${config.footer.copyrightWeight}; font-size: ${config.footer.copyrightSizeDesktop}; }
        .storefront-foot-contact { font-family: ${getChain(config.footer.contactFont)}; font-weight: ${config.footer.contactWeight}; font-size: ${config.footer.contactSizeDesktop}; }
      }

      @media (min-width: 768px) and (max-width: 1023px) {
        .storefront-theme-container, .storefront-text-normal { font-size: ${config.global.sizeTablet} !important; }

        /* Header Selector Overrides */
        .storefront-header-logo { font-size: ${config.header.logoSizeTablet}; font-family: ${getChain(config.header.logoFont)}; font-weight: ${config.header.logoWeight}; }
        .storefront-header-menu { font-size: ${config.header.menuSizeTablet}; font-family: ${getChain(config.header.menuFont)}; font-weight: ${config.header.menuWeight}; }
        .storefront-header-submenu { font-size: ${config.header.submenuSizeTablet}; font-family: ${getChain(config.header.submenuFont)}; font-weight: ${config.header.submenuWeight}; }
        .storefront-header-topbar { font-size: ${config.header.topbarSizeTablet}; font-family: ${getChain(config.header.topbarFont)}; font-weight: ${config.header.topbarWeight}; }
        .storefront-header-search { font-size: ${config.header.searchSizeTablet}; font-family: ${getChain(config.header.searchFont)}; font-weight: ${config.header.searchWeight}; }
        .storefront-header-button { font-size: ${config.header.buttonSizeTablet}; font-family: ${getChain(config.header.buttonFont)}; font-weight: ${config.header.buttonWeight}; }

        /* Product Cards */
        .storefront-card-name { font-family: ${getChain(config.productCards.nameFont)}; font-weight: ${config.productCards.nameWeight}; font-size: ${config.productCards.nameSizeTablet}; }
        .storefront-card-price { font-family: ${getChain(config.productCards.priceFont)}; font-weight: ${config.productCards.priceWeight}; font-size: ${config.productCards.priceSizeTablet}; }
        .storefront-card-promo { font-family: ${getChain(config.productCards.promoPriceFont)}; font-weight: ${config.productCards.promoPriceWeight}; font-size: ${config.productCards.promoPriceSizeTablet}; }
        .storefront-card-installments { font-family: ${getChain(config.productCards.installmentsFont)}; font-weight: ${config.productCards.installmentsWeight}; font-size: ${config.productCards.installmentsSizeTablet}; }
        .storefront-card-badge { font-family: ${getChain(config.productCards.badgesFont)}; font-weight: ${config.productCards.badgesWeight}; font-size: ${config.productCards.badgesSizeTablet}; }
        .storefront-card-reviews { font-family: ${getChain(config.productCards.reviewsFont)}; font-weight: ${config.productCards.reviewsWeight}; font-size: ${config.productCards.reviewsSizeTablet}; }

        /* Banners */
        .storefront-mini-title { font-family: ${getChain(config.miniBanner.titleFont)}; font-weight: ${config.miniBanner.titleWeight}; font-size: ${config.miniBanner.titleSizeTablet}; }
        .storefront-mini-subtitle { font-family: ${getChain(config.miniBanner.subtitleFont)}; font-weight: ${config.miniBanner.subtitleWeight}; font-size: ${config.miniBanner.subtitleSizeTablet}; }
        .storefront-mini-button { font-family: ${getChain(config.miniBanner.buttonFont)}; font-weight: ${config.miniBanner.buttonWeight}; font-size: ${config.miniBanner.buttonSizeTablet}; }
        .storefront-mini-helper { font-family: ${getChain(config.miniBanner.helperFont)}; font-weight: ${config.miniBanner.helperWeight}; font-size: ${config.miniBanner.helperSizeTablet}; }

        .storefront-super-title { font-family: ${getChain(config.heroBanner.titleFont)}; font-weight: ${config.heroBanner.titleWeight}; font-size: ${config.heroBanner.titleSizeTablet}; }
        .storefront-super-subtitle { font-family: ${getChain(config.heroBanner.subtitleFont)}; font-weight: ${config.heroBanner.subtitleWeight}; font-size: ${config.heroBanner.subtitleSizeTablet}; }
        .storefront-super-button { font-family: ${getChain(config.heroBanner.buttonFont)}; font-weight: ${config.heroBanner.buttonWeight}; font-size: ${config.heroBanner.buttonSizeTablet}; }
        .storefront-super-helper { font-family: ${getChain(config.heroBanner.helperFont)}; font-weight: ${config.heroBanner.helperWeight}; font-size: ${config.heroBanner.helperSizeTablet}; }

        /* Catalog */
        .storefront-catalog-title { font-family: ${getChain(config.catalog.titleFont)}; font-weight: ${config.catalog.titleWeight}; font-size: ${config.catalog.titleSizeTablet}; }
        .storefront-catalog-desc { font-family: ${getChain(config.catalog.descFont)}; font-weight: ${config.catalog.descWeight}; font-size: ${config.catalog.descSizeTablet}; }
        .storefront-catalog-filter { font-family: ${getChain(config.catalog.filtersFont)}; font-weight: ${config.catalog.filtersWeight}; font-size: ${config.catalog.filtersSizeTablet}; }
        .storefront-catalog-sort { font-family: ${getChain(config.catalog.sortFont)}; font-weight: ${config.catalog.sortWeight}; font-size: ${config.catalog.sortSizeTablet}; }
        .storefront-catalog-count { font-family: ${getChain(config.catalog.countFont)}; font-weight: ${config.catalog.countWeight}; font-size: ${config.catalog.countSizeTablet}; }

        /* Product Details page */
        .storefront-det-name { font-family: ${getChain(config.productDetails.nameFont)}; font-weight: ${config.productDetails.nameWeight}; font-size: ${config.productDetails.nameSizeTablet}; }
        .storefront-det-price { font-family: ${getChain(config.productDetails.priceFont)}; font-weight: ${config.productDetails.priceWeight}; font-size: ${config.productDetails.priceSizeTablet}; }
        .storefront-det-shortdesc { font-family: ${getChain(config.productDetails.shortDescFont)}; font-weight: ${config.productDetails.shortDescWeight}; font-size: ${config.productDetails.shortDescSizeTablet}; }
        .storefront-det-fulldesc { font-family: ${getChain(config.productDetails.fullDescFont)}; font-weight: ${config.productDetails.fullDescWeight}; font-size: ${config.productDetails.fullDescSizeTablet}; }
        .storefront-det-specs { font-family: ${getChain(config.productDetails.specsFont)}; font-weight: ${config.productDetails.specsWeight}; font-size: ${config.productDetails.specsSizeTablet}; }
        .storefront-det-reviews { font-family: ${getChain(config.productDetails.reviewsFont)}; font-weight: ${config.productDetails.reviewsWeight}; font-size: ${config.productDetails.reviewsSizeTablet}; }
        .storefront-det-faq { font-family: ${getChain(config.productDetails.faqFont)}; font-weight: ${config.productDetails.faqWeight}; font-size: ${config.productDetails.faqSizeTablet}; }

        /* Cart Page */
        .storefront-cart-title { font-family: ${getChain(config.cart.itemNameFont)}; font-weight: ${config.cart.itemNameWeight}; font-size: ${config.cart.itemNameSizeTablet}; }
        .storefront-cart-summary { font-family: ${getChain(config.cart.summaryFont)}; font-weight: ${config.cart.summaryWeight}; font-size: ${config.cart.summarySizeTablet}; }
        .storefront-cart-subtotal { font-family: ${getChain(config.cart.subtotalFont)}; font-weight: ${config.cart.subtotalWeight}; font-size: ${config.cart.subtotalSizeTablet}; }
        .storefront-cart-total { font-family: ${getChain(config.cart.totalFont)}; font-weight: ${config.cart.totalWeight}; font-size: ${config.cart.totalSizeTablet}; }
        .storefront-cart-coupons { font-family: ${getChain(config.cart.couponsFont)}; font-weight: ${config.cart.couponsWeight}; font-size: ${config.cart.couponsSizeTablet}; }
        .storefront-cart-messages { font-family: ${getChain(config.cart.messagesFont)}; font-weight: ${config.cart.messagesWeight}; font-size: ${config.cart.messagesSizeTablet}; }
        .storefront-cart-btn { font-family: ${getChain(config.cart.buttonsFont)}; font-weight: ${config.cart.buttonsWeight}; font-size: ${config.cart.buttonsSizeTablet}; }

        /* Checkout Page */
        .storefront-check-title { font-family: ${getChain(config.checkout.titlesFont)}; font-weight: ${config.checkout.titlesWeight}; font-size: ${config.checkout.titlesSizeTablet}; }
        .storefront-check-field { font-family: ${getChain(config.checkout.fieldsFont)}; font-weight: ${config.checkout.fieldsWeight}; font-size: ${config.checkout.fieldsSizeTablet}; }
        .storefront-check-label { font-family: ${getChain(config.checkout.labelsFont)}; font-weight: ${config.checkout.labelsWeight}; font-size: ${config.checkout.labelsSizeTablet}; }
        .storefront-check-valid { font-family: ${getChain(config.checkout.validationFont)}; font-weight: ${config.checkout.validationWeight}; font-size: ${config.checkout.validationSizeTablet}; }
        .storefront-check-summary { font-family: ${getChain(config.checkout.summaryFont)}; font-weight: ${config.checkout.summaryWeight}; font-size: ${config.checkout.summarySizeTablet}; }
        .storefront-check-total { font-family: ${getChain(config.checkout.totalsFont)}; font-weight: ${config.checkout.totalsWeight}; font-size: ${config.checkout.totalsSizeTablet}; }
        .storefront-check-btn { font-family: ${getChain(config.checkout.buttonsFont)}; font-weight: ${config.checkout.buttonsWeight}; font-size: ${config.checkout.buttonsSizeTablet}; }

        /* Footer styling */
        .storefront-foot-title { font-family: ${getChain(config.footer.titleFont)}; font-weight: ${config.footer.titleWeight}; font-size: ${config.footer.titleSizeTablet}; }
        .storefront-foot-menu { font-family: ${getChain(config.footer.menuFont)}; font-weight: ${config.footer.menuWeight}; font-size: ${config.footer.menuSizeTablet}; }
        .storefront-foot-text { font-family: ${getChain(config.footer.textsFont)}; font-weight: ${config.footer.textsWeight}; font-size: ${config.footer.textsSizeTablet}; }
        .storefront-foot-copyright { font-family: ${getChain(config.footer.copyrightFont)}; font-weight: ${config.footer.copyrightWeight}; font-size: ${config.footer.copyrightSizeTablet}; }
        .storefront-foot-contact { font-family: ${getChain(config.footer.contactFont)}; font-weight: ${config.footer.contactWeight}; font-size: ${config.footer.contactSizeTablet}; }
      }

      @media (max-width: 767px) {
        .storefront-theme-container, .storefront-text-normal { font-size: ${config.global.sizeMobile} !important; }

        /* Header Selector Overrides */
        .storefront-header-logo { font-size: ${config.header.logoSizeMobile}; font-family: ${getChain(config.header.logoFont)}; font-weight: ${config.header.logoWeight}; }
        .storefront-header-menu { font-size: ${config.header.menuSizeMobile}; font-family: ${getChain(config.header.menuFont)}; font-weight: ${config.header.menuWeight}; }
        .storefront-header-submenu { font-size: ${config.header.submenuSizeMobile}; font-family: ${getChain(config.header.submenuFont)}; font-weight: ${config.header.submenuWeight}; }
        .storefront-header-topbar { font-size: ${config.header.topbarSizeMobile}; font-family: ${getChain(config.header.topbarFont)}; font-weight: ${config.header.topbarWeight}; }
        .storefront-header-search { font-size: ${config.header.searchSizeMobile}; font-family: ${getChain(config.header.searchFont)}; font-weight: ${config.header.searchWeight}; }
        .storefront-header-button { font-size: ${config.header.buttonSizeMobile}; font-family: ${getChain(config.header.buttonFont)}; font-weight: ${config.header.buttonWeight}; }

        /* Product Cards */
        .storefront-card-name { font-family: ${getChain(config.productCards.nameFont)}; font-weight: ${config.productCards.nameWeight}; font-size: ${config.productCards.nameSizeMobile}; }
        .storefront-card-price { font-family: ${getChain(config.productCards.priceFont)}; font-weight: ${config.productCards.priceWeight}; font-size: ${config.productCards.priceSizeMobile}; }
        .storefront-card-promo { font-family: ${getChain(config.productCards.promoPriceFont)}; font-weight: ${config.productCards.promoPriceWeight}; font-size: ${config.productCards.promoPriceSizeMobile}; }
        .storefront-card-installments { font-family: ${getChain(config.productCards.installmentsFont)}; font-weight: ${config.productCards.installmentsWeight}; font-size: ${config.productCards.installmentsSizeMobile}; }
        .storefront-card-badge { font-family: ${getChain(config.productCards.badgesFont)}; font-weight: ${config.productCards.badgesWeight}; font-size: ${config.productCards.badgesSizeMobile}; }
        .storefront-card-reviews { font-family: ${getChain(config.productCards.reviewsFont)}; font-weight: ${config.productCards.reviewsWeight}; font-size: ${config.productCards.reviewsSize_mobile || config.productCards.reviewsSizeMobile}; }

        /* Banners */
        .storefront-mini-title { font-family: ${getChain(config.miniBanner.titleFont)}; font-weight: ${config.miniBanner.titleWeight}; font-size: ${config.miniBanner.titleSizeMobile}; }
        .storefront-mini-subtitle { font-family: ${getChain(config.miniBanner.subtitleFont)}; font-weight: ${config.miniBanner.subtitleWeight}; font-size: ${config.miniBanner.subtitleSizeMobile}; }
        .storefront-mini-button { font-family: ${getChain(config.miniBanner.buttonFont)}; font-weight: ${config.miniBanner.buttonWeight}; font-size: ${config.miniBanner.buttonSizeMobile}; }
        .storefront-mini-helper { font-family: ${getChain(config.miniBanner.helperFont)}; font-weight: ${config.miniBanner.helperWeight}; font-size: ${config.miniBanner.helperSizeMobile}; }

        .storefront-super-title { font-family: ${getChain(config.heroBanner.titleFont)}; font-weight: ${config.heroBanner.titleWeight}; font-size: ${config.heroBanner.titleSizeMobile}; }
        .storefront-super-subtitle { font-family: ${getChain(config.heroBanner.subtitleFont)}; font-weight: ${config.heroBanner.subtitleWeight}; font-size: ${config.heroBanner.subtitleSizeMobile}; }
        .storefront-super-button { font-family: ${getChain(config.heroBanner.buttonFont)}; font-weight: ${config.heroBanner.buttonWeight}; font-size: ${config.heroBanner.buttonSizeMobile}; }
        .storefront-super-helper { font-family: ${getChain(config.heroBanner.helperFont)}; font-weight: ${config.heroBanner.helperWeight}; font-size: ${config.heroBanner.helperSizeMobile}; }

        /* Catalog */
        .storefront-catalog-title { font-family: ${getChain(config.catalog.titleFont)}; font-weight: ${config.catalog.titleWeight}; font-size: ${config.catalog.titleSizeMobile}; }
        .storefront-catalog-desc { font-family: ${getChain(config.catalog.descFont)}; font-weight: ${config.catalog.descWeight}; font-size: ${config.catalog.descSizeMobile}; }
        .storefront-catalog-filter { font-family: ${getChain(config.catalog.filtersFont)}; font-weight: ${config.catalog.filtersWeight}; font-size: ${config.catalog.filtersSizeMobile}; }
        .storefront-catalog-sort { font-family: ${getChain(config.catalog.sortFont)}; font-weight: ${config.catalog.sortWeight}; font-size: ${config.catalog.sortSizeMobile}; }
        .storefront-catalog-count { font-family: ${getChain(config.catalog.countFont)}; font-weight: ${config.catalog.countWeight}; font-size: ${config.catalog.countSizeMobile}; }

        /* Product Details page */
        .storefront-det-name { font-family: ${getChain(config.productDetails.nameFont)}; font-weight: ${config.productDetails.nameWeight}; font-size: ${config.productDetails.nameSizeMobile}; }
        .storefront-det-price { font-family: ${getChain(config.productDetails.priceFont)}; font-weight: ${config.productDetails.priceWeight}; font-size: ${config.productDetails.priceSizeMobile}; }
        .storefront-det-shortdesc { font-family: ${getChain(config.productDetails.shortDescFont)}; font-weight: ${config.productDetails.shortDescWeight}; font-size: ${config.productDetails.shortDescSizeMobile}; }
        .storefront-det-fulldesc { font-family: ${getChain(config.productDetails.fullDescFont)}; font-weight: ${config.productDetails.fullDescWeight}; font-size: ${config.productDetails.fullDescSizeMobile}; }
        .storefront-det-specs { font-family: ${getChain(config.productDetails.specsFont)}; font-weight: ${config.productDetails.specsWeight}; font-size: ${config.productDetails.specsSizeMobile}; }
        .storefront-det-reviews { font-family: ${getChain(config.productDetails.reviewsFont)}; font-weight: ${config.productDetails.reviewsWeight}; font-size: ${config.productDetails.reviewsSizeMobile}; }
        .storefront-det-faq { font-family: ${getChain(config.productDetails.faqFont)}; font-weight: ${config.productDetails.faqWeight}; font-size: ${config.productDetails.faqSizeMobile}; }

        /* Cart Page */
        .storefront-cart-title { font-family: ${getChain(config.cart.itemNameFont)}; font-weight: ${config.cart.itemNameWeight}; font-size: ${config.cart.itemNameSizeMobile}; }
        .storefront-cart-summary { font-family: ${getChain(config.cart.summaryFont)}; font-weight: ${config.cart.summaryWeight}; font-size: ${config.cart.summarySizeMobile}; }
        .storefront-cart-subtotal { font-family: ${getChain(config.cart.subtotalFont)}; font-weight: ${config.cart.subtotalWeight}; font-size: ${config.cart.subtotalSizeMobile}; }
        .storefront-cart-total { font-family: ${getChain(config.cart.totalFont)}; font-weight: ${config.cart.totalWeight}; font-size: ${config.cart.totalSizeMobile}; }
        .storefront-cart-coupons { font-family: ${getChain(config.cart.couponsFont)}; font-weight: ${config.cart.couponsWeight}; font-size: ${config.cart.couponsSizeMobile}; }
        .storefront-cart-messages { font-family: ${getChain(config.cart.messagesFont)}; font-weight: ${config.cart.messagesWeight}; font-size: ${config.cart.messagesSizeMobile}; }
        .storefront-cart-btn { font-family: ${getChain(config.cart.buttonsFont)}; font-weight: ${config.cart.buttonsWeight}; font-size: ${config.cart.buttonsSizeMobile}; }

        /* Checkout Page */
        .storefront-check-title { font-family: ${getChain(config.checkout.titlesFont)}; font-weight: ${config.checkout.titlesWeight}; font-size: ${config.checkout.titlesSizeMobile}; }
        .storefront-check-field { font-family: ${getChain(config.checkout.fieldsFont)}; font-weight: ${config.checkout.fieldsWeight}; font-size: ${config.checkout.fieldsSizeMobile}; }
        .storefront-check-label { font-family: ${getChain(config.checkout.labelsFont)}; font-weight: ${config.checkout.labelsWeight}; font-size: ${config.checkout.labelsSizeMobile}; }
        .storefront-check-valid { font-family: ${getChain(config.checkout.validationFont)}; font-weight: ${config.checkout.validationWeight}; font-size: ${config.checkout.validationSizeMobile}; }
        .storefront-check-summary { font-family: ${getChain(config.checkout.summaryFont)}; font-weight: ${config.checkout.summaryWeight}; font-size: ${config.checkout.summarySizeMobile}; }
        .storefront-check-total { font-family: ${getChain(config.checkout.totalsFont)}; font-weight: ${config.checkout.totalsWeight}; font-size: ${config.checkout.totalsSizeMobile}; }
        .storefront-check-btn { font-family: ${getChain(config.checkout.buttonsFont)}; font-weight: ${config.checkout.buttonsWeight}; font-size: ${config.checkout.buttonsSizeMobile}; }

        /* Footer styling */
        .storefront-foot-title { font-family: ${getChain(config.footer.titleFont)}; font-weight: ${config.footer.titleWeight}; font-size: ${config.footer.titleSizeMobile}; }
        .storefront-foot-menu { font-family: ${getChain(config.footer.menuFont)}; font-weight: ${config.footer.menuWeight}; font-size: ${config.footer.menuSizeMobile}; }
        .storefront-foot-text { font-family: ${getChain(config.footer.textsFont)}; font-weight: ${config.footer.textsWeight}; font-size: ${config.footer.textsSizeMobile}; }
        .storefront-foot-copyright { font-family: ${getChain(config.footer.copyrightFont)}; font-weight: ${config.footer.copyrightWeight}; font-size: ${config.footer.copyrightSizeMobile}; }
        .storefront-foot-contact { font-family: ${getChain(config.footer.contactFont)}; font-weight: ${config.footer.contactWeight}; font-size: ${config.footer.contactSizeMobile}; }
      }
    `;

    if (existingStyle) {
      existingStyle.textContent = customRules;
    } else {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = customRules;
      document.head.appendChild(style);
    }
  }, [config, loading]);

  const saveTypography = async (newConfig: AdvancedTypographyConfig) => {
    try {
      const docRef = doc(db, 'settings', 'typography');
      await setDoc(docRef, newConfig);
      setConfig(newConfig);
    } catch (e) {
      console.error('Failed to save typography settings:', e);
      throw e;
    }
  };

  const resetToDefault = async () => {
    await saveTypography(INITIAL_DEFAULT_TYPOGRAPHY);
  };

  return (
    <TypographyContext.Provider value={{ config, loading, saveTypography, resetToDefault }}>
      {children}
    </TypographyContext.Provider>
  );
}

export function useTypography() {
  const context = useContext(TypographyContext);
  if (context === undefined) {
    throw new Error('useTypography must be used within a TypographyProvider');
  }
  return context;
}
