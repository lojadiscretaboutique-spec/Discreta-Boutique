import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ThemeConfig } from '../types/theme';
import { themeService } from '../services/themeService';
import { hexToRgb } from '../utils/themeUtils';

interface ThemeContextType {
  currentTheme: ThemeConfig;
  allThemes: ThemeConfig[];
  loading: boolean;
  previewTheme: ThemeConfig | null;
  setPreviewTheme: (theme: ThemeConfig | null) => void;
  activateTheme: (theme: ThemeConfig) => Promise<void>;
  saveCustomTheme: (theme: ThemeConfig) => Promise<string>;
  deleteCustomTheme: (id: string, name: string) => Promise<void>;
  refreshThemes: () => Promise<void>;
  isUsingFallback?: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeConfig>(themeService.getDefaultTheme());
  const [allThemes, setAllThemes] = useState<ThemeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Theme used for live real-time previews before saving
  const [previewTheme, setPreviewTheme] = useState<ThemeConfig | null>(null);

  // References to keep track of current loaded stored active theme
  const storedThemeRef = useRef<ThemeConfig | null>(null);

  const [isUsingFallbackStatus, setIsUsingFallbackStatus] = useState(false);

  // Expose function to update list of loaded themes
  const refreshThemes = useCallback(async () => {
    try {
      const list = await themeService.getThemes();
      setAllThemes(list);
    } catch (e) {
      console.error("Failed to reload themes:", e);
    }
  }, []);

  // Set standard HTML CSS Custom Variables dynamically on document.documentElement
  const applyVariables = useCallback((theme: ThemeConfig) => {
    const root = document.documentElement;
    if (!root) return;

    const setSafe = (prop: string, val: string | undefined, fallback: string) => {
      if (val && String(val) !== 'undefined' && String(val) !== 'null' && String(val) !== 'NaN') {
        root.style.setProperty(prop, val);
      } else if (fallback) {
        root.style.setProperty(prop, fallback);
      }
    };

    // Standard client requested CSS variables
    setSafe('--primary-color', theme.primaryColor, '#D32F2F');
    setSafe('--secondary-color', theme.secondaryColor, '#0A0A0A');
    setSafe('--button-color', theme.buttonColor, theme.primaryColor || '#D32F2F');
    setSafe('--background-color', theme.backgroundColor, '#0A0A0A');
    setSafe('--card-color', theme.cardColor, '#161616');
    setSafe('--text-color', theme.backgroundTextColor, '#ffffff');
    setSafe('--link-color', theme.linkColor, theme.primaryColor || '#D32F2F');
    setSafe('--highlight-color', theme.highlightColor, theme.primaryColor || '#D32F2F');

    // Contrasting text colors
    setSafe('--primary-color-text', theme.primaryTextColor, '#ffffff');
    setSafe('--secondary-color-text', theme.secondaryTextColor, '#ffffff');
    setSafe('--button-color-text', theme.buttonTextColor, '#ffffff');
    setSafe('--card-color-text', theme.cardTextColor, '#ffffff');
    setSafe('--link-color-text', theme.linkTextColor, '#ffffff');
    setSafe('--highlight-color-text', theme.highlightTextColor, '#ffffff');

    // Map to legacy index.css classes for transparent compatibility
    setSafe('--color-primary', theme.primaryColor, '#D32F2F');
    setSafe('--color-bg', theme.backgroundColor, '#0A0A0A');
    setSafe('--color-surface', theme.cardColor, '#161616');
    setSafe('--color-text-main', theme.backgroundTextColor, '#ffffff');

    // Compute glow shade: rgba representation
    if (theme.primaryColor) {
      const rgb = hexToRgb(theme.primaryColor);
      root.style.setProperty('--color-primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
    } else {
      root.style.setProperty('--color-primary-glow', `rgba(211, 47, 47, 0.25)`);
    }
  }, []);

  // Fetch saved configuration on mount and schedule check on periodic loop.
  useEffect(() => {
    let completed = false;
    const cacheKey_theme = 'discreta_active_theme_cache';
    const cacheKey_list = 'discreta_all_themes_cache';
    
    // Check old caches to migrate
    const oldCacheTheme = 'cached_active_theme';
    const oldCacheList = 'cached_all_themes';
    
    let cachedTheme: any = null;
    let cachedList: any = null;
    const isAdmin = window.location.pathname.includes('/admin');

    if (!isAdmin && typeof window !== 'undefined' && window.localStorage) {
      try {
        let tStr = localStorage.getItem(cacheKey_theme);
        let lStr = localStorage.getItem(cacheKey_list);
        if (!tStr && localStorage.getItem(oldCacheTheme)) {
           // migrate
           tStr = localStorage.getItem(oldCacheTheme);
           lStr = localStorage.getItem(oldCacheList);
           if (tStr) localStorage.setItem(cacheKey_theme, tStr);
           if (lStr) localStorage.setItem(cacheKey_list, lStr);
        }
        if (tStr) cachedTheme = JSON.parse(tStr);
        if (lStr) cachedList = JSON.parse(lStr);
      } catch (e) {
        console.warn("Error parsing cached themes from localStorage:", e);
      }
    }

    if (cachedTheme) {
      storedThemeRef.current = cachedTheme;
      setCurrentTheme(cachedTheme);
      if (cachedList) setAllThemes(cachedList);
      applyVariables(cachedTheme);
      setIsUsingFallbackStatus(false);
      setLoading(false);
    }

    const init = async () => {
      const timeoutDuration = cachedTheme ? 8000 : 6000;
      const timeoutId = setTimeout(() => {
        if (completed) return;
        if (!cachedTheme) {
          console.warn("[ThemeEngine] Initialization took too long (2s). Falling back with default theme in background.");
          storedThemeRef.current = themeService.getDefaultTheme();
          setCurrentTheme(themeService.getDefaultTheme());
          setAllThemes([themeService.getDefaultTheme()]);
          applyVariables(themeService.getDefaultTheme());
          setIsUsingFallbackStatus(true);
          setLoading(false);
        } else {
          setLoading(false);
        }
      }, timeoutDuration);

      try {
        if (!cachedTheme) {
          setLoading(true);
        }
        const [activeTheme, list] = await Promise.all([
          themeService.getActiveTheme(),
          themeService.getThemes()
        ]);
        
        if (!completed) {
          clearTimeout(timeoutId);
          storedThemeRef.current = activeTheme;
          setCurrentTheme(activeTheme);
          setAllThemes(list);
          applyVariables(activeTheme);
          setIsUsingFallbackStatus(false);

          if (!isAdmin && typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem(cacheKey_theme, JSON.stringify(activeTheme));
              localStorage.setItem(cacheKey_list, JSON.stringify(list));
            } catch (e) {
              console.warn("Failed saving themes to local storage:", e);
            }
          }
        }
      } catch (err) {
        console.error("Failed initializing ThemeEngine:", err);
      } finally {
        completed = true;
        setLoading(false);
      }
    };

    init();

    // 15-second loop to check if a scheduled theme interval starts or ends (Only for admin panel)
    let interval: any = null;
    if (window.location.pathname.includes('/admin')) {
      interval = setInterval(async () => {
        try {
          const activeTheme = await themeService.getActiveTheme();
          if (JSON.stringify(activeTheme) !== JSON.stringify(storedThemeRef.current)) {
            storedThemeRef.current = activeTheme;
            setCurrentTheme(activeTheme);
            // If not in preview mode, apply version directly
            if (!previewTheme) {
              applyVariables(activeTheme);
            }
          }
        } catch (e) {
          console.warn("Silent scheduling theme refresh check failed:", e);
        }
      }, 15000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [applyVariables, previewTheme]);

  // Handle preview themes applied in real time 
  useEffect(() => {
    if (previewTheme) {
      applyVariables(previewTheme);
    } else if (storedThemeRef.current) {
      applyVariables(storedThemeRef.current);
    }
  }, [previewTheme, applyVariables]);

  // Activate theme globally
  const activateTheme = async (theme: ThemeConfig) => {
    try {
      await themeService.activateTheme(theme);
      storedThemeRef.current = theme;
      setCurrentTheme(theme);
      setPreviewTheme(null); // Clear preview once saved
      await refreshThemes();
    } catch (e) {
      console.error("Failed inside ThemeProvider activation:", e);
      throw e;
    }
  };

  // Create or Edit personalized theme
  const saveCustomTheme = async (theme: ThemeConfig) => {
    try {
      const generatedId = await themeService.saveTheme(theme);
      await refreshThemes();
      return generatedId;
    } catch (e) {
      console.error("Failed inside ThemeProvider save:", e);
      throw e;
    }
  };

  // Delete custom theme
  const deleteCustomTheme = async (id: string, name: string) => {
    try {
      await themeService.deleteTheme(id, name);
      await refreshThemes();
    } catch (e) {
      console.error("Failed inside ThemeProvider delete:", e);
      throw e;
    }
  };

  const valObject: ThemeContextType = {
    currentTheme: previewTheme || currentTheme,
    allThemes,
    loading,
    previewTheme,
    setPreviewTheme,
    activateTheme,
    saveCustomTheme,
    deleteCustomTheme,
    refreshThemes,
    isUsingFallback: isUsingFallbackStatus,
  };

  return (
    <ThemeContext.Provider value={valObject}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
