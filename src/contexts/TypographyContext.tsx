import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TypographyConfig {
  titles: string;
  products: string;
  prices: string;
  buttons: string;
  menus: string;
  banners: string;
  general: string;
  
  // Brand Logo Customization Options
  brandColor: string;          // Hex e.g. '#D32F2F'
  brandSize: string;           // font-size e.g. '24px'
  brandLetterSpacing: string;  // e.g. '0.1em' or '-0.05em'
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

export const TYPOGRAPHY_PRESETS = [
  {
    id: 'original',
    name: 'Discreta Original',
    description: 'Estilo padrão com a elegância clássica da DM Sans.',
    config: {
      titles: 'DM Sans',
      products: 'DM Sans',
      prices: 'DM Sans',
      buttons: 'DM Sans',
      menus: 'DM Sans',
      banners: 'DM Sans',
      general: 'DM Sans',
      brandColor: '#D32F2F',
      brandSize: '24px',
      brandLetterSpacing: '-0.05em'
    }
  },
  {
    id: 'moderna',
    name: 'Discreta Moderna',
    description: 'Design fluido e geométrico com Poppins, Inter e Montserrat.',
    config: {
      titles: 'Poppins',
      products: 'Inter',
      prices: 'Montserrat',
      buttons: 'Montserrat',
      menus: 'Inter',
      banners: 'Poppins',
      general: 'Inter',
      brandColor: '#ef4444',
      brandSize: '24px',
      brandLetterSpacing: '0.05em'
    }
  },
  {
    id: 'premium',
    name: 'Discreta Premium',
    description: 'Visual requintado e sofisticado com Outfit.',
    config: {
      titles: 'Outfit',
      products: 'DM Sans',
      prices: 'Outfit',
      buttons: 'Poppins',
      menus: 'DM Sans',
      banners: 'Outfit',
      general: 'DM Sans',
      brandColor: '#D32F2F',
      brandSize: '26px',
      brandLetterSpacing: '0.15em'
    }
  },
  {
    id: 'elegance',
    name: 'Discreta Elegance',
    description: 'Equilíbrio sutil entre modernidade e seriedade via Manrope.',
    config: {
      titles: 'Manrope',
      products: 'Inter',
      prices: 'Manrope',
      buttons: 'DM Sans',
      menus: 'Inter',
      banners: 'Manrope',
      general: 'Inter',
      brandColor: '#e11d48',
      brandSize: '22px',
      brandLetterSpacing: '0.2em'
    }
  },
  {
    id: 'minimal',
    name: 'Discreta Minimal',
    description: 'Espaçamentos generosos e ultra minimalismo via Plus Jakarta Sans.',
    config: {
      titles: 'Plus Jakarta Sans',
      products: 'Inter',
      prices: 'Plus Jakarta Sans',
      buttons: 'DM Sans',
      menus: 'Inter',
      banners: 'Plus Jakarta Sans',
      general: 'Inter',
      brandColor: '#000000',
      brandSize: '26px',
      brandLetterSpacing: '-0.02em'
    }
  }
];

export const DEFAULT_TYPOGRAPHY: TypographyConfig = TYPOGRAPHY_PRESETS[0].config;

interface TypographyContextType {
  config: TypographyConfig;
  loading: boolean;
  saveTypography: (newConfig: TypographyConfig) => Promise<void>;
  resetToDefault: () => Promise<void>;
}

const TypographyContext = createContext<TypographyContextType | undefined>(undefined);

export function TypographyProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TypographyConfig>(DEFAULT_TYPOGRAPHY);
  const [loading, setLoading] = useState(true);

  // Load configuration from Firestore and set up real-time listener
  useEffect(() => {
    const docRef = doc(db, 'settings', 'typography');
    
    // Set up a real-time listener to instantly propagate changes across all screens
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<TypographyConfig>;
        setConfig({
          ...DEFAULT_TYPOGRAPHY,
          ...data
        });
      } else {
        setConfig(DEFAULT_TYPOGRAPHY);
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
      if (APPROVED_FONTS[font]) {
        userSelectedFonts.add(font);
      }
    };
    
    checkAndAdd(config.titles);
    checkAndAdd(config.products);
    checkAndAdd(config.prices);
    checkAndAdd(config.buttons);
    checkAndAdd(config.menus);
    checkAndAdd(config.banners);
    checkAndAdd(config.general);

    // 2. Build the Google Fonts URL parameter
    if (userSelectedFonts.size > 0) {
      const fontList = Array.from(userSelectedFonts);
      const fontQuery = fontList
        .map(font => {
          const formattedName = font.replace(/ /g, '+');
          // Fetch standard, medium, semi-bold and extra-bold/black text weights
          return `family=${formattedName}:wght@300;400;500;600;700;800;900`;
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

    // 3. Inject CSS custom properties (variables) onto documentElement
    const root = document.documentElement;
    if (root) {
      const getChain = (fontName: string) => APPROVED_FONTS[fontName] || APPROVED_FONTS['DM Sans'];

      root.style.setProperty('--font-titles', getChain(config.titles));
      root.style.setProperty('--font-products', getChain(config.products));
      root.style.setProperty('--font-prices', getChain(config.prices));
      root.style.setProperty('--font-buttons', getChain(config.buttons));
      root.style.setProperty('--font-menus', getChain(config.menus));
      root.style.setProperty('--font-banners', getChain(config.banners));
      root.style.setProperty('--font-general', getChain(config.general));

      // Brand logo updates
      root.style.setProperty('--brand-logo-color', config.brandColor || '#D32F2F');
      root.style.setProperty('--brand-logo-size', config.brandSize || '24px');
      root.style.setProperty('--brand-logo-spacing', config.brandLetterSpacing || '-0.05em');
    }

    // 4. Inject specific typography override CSS rules in head
    const styleId = 'dynamic-typography-overrides-style';
    let existingStyle = document.getElementById(styleId) as HTMLStyleElement | null;
    
    // We target pages under the storefront only, excluding paths matching /admin (handled cleanly)
    const customRules = `
      /* Storefront specific overrides targeting storefront tags specifically */
      .storefront-theme-container, .storefront-theme-container p, .storefront-theme-container span:not(.brand-logo-text), .storefront-theme-container div:not(.brand-logo-text):not(.no-typography), .storefront-theme-container a:not(.brand-logo-text), .storefront-theme-container label {
        font-family: var(--font-general, "DM Sans", sans-serif);
      }
      
      .storefront-theme-container h1, .storefront-theme-container h2:not(.brand-logo-text), .storefront-theme-container h3, .storefront-theme-container h4, .storefront-theme-container h5, .storefront-theme-container h6, .storefront-theme-container .title-font {
        font-family: var(--font-titles, "DM Sans", sans-serif) !important;
      }
      
      .storefront-theme-container .product-title-text {
        font-family: var(--font-products, "DM Sans", sans-serif) !important;
      }
      
      .storefront-theme-container .price-text-value, .storefront-theme-container .font-price-tag {
        font-family: var(--font-prices, "DM Sans", sans-serif) !important;
      }
      
      .storefront-theme-container button, .storefront-theme-container .btn-font {
        font-family: var(--font-buttons, "DM Sans", sans-serif) !important;
      }
      
      .storefront-theme-container .menu-link-text, .storefront-theme-container nav a {
        font-family: var(--font-menus, "DM Sans", sans-serif) !important;
      }

      .storefront-theme-container .banner-text-title {
        font-family: var(--font-banners, "Outfit", sans-serif) !important;
      }

      /* Specific brand logo locks */
      .brand-logo-text {
        font-family: "DM Sans", system-ui, -apple-system, sans-serif !important;
        color: var(--brand-logo-color) !important;
        font-size: var(--brand-logo-size) !important;
        letter-spacing: var(--brand-logo-spacing) !important;
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

  const saveTypography = async (newConfig: TypographyConfig) => {
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
    await saveTypography(DEFAULT_TYPOGRAPHY);
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
