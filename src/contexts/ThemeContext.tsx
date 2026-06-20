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

    // Standard client requested CSS variables
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--secondary-color', theme.secondaryColor);
    root.style.setProperty('--button-color', theme.buttonColor);
    root.style.setProperty('--background-color', theme.backgroundColor);
    root.style.setProperty('--card-color', theme.cardColor);
    root.style.setProperty('--text-color', theme.backgroundTextColor);
    root.style.setProperty('--link-color', theme.linkColor);
    root.style.setProperty('--highlight-color', theme.highlightColor);

    // Contrasting text colors
    root.style.setProperty('--primary-color-text', theme.primaryTextColor);
    root.style.setProperty('--secondary-color-text', theme.secondaryTextColor);
    root.style.setProperty('--button-color-text', theme.buttonTextColor);
    root.style.setProperty('--card-color-text', theme.cardTextColor);
    root.style.setProperty('--link-color-text', theme.linkTextColor);
    root.style.setProperty('--highlight-color-text', theme.highlightTextColor);

    // Map to legacy index.css classes for transparent compatibility
    root.style.setProperty('--color-primary', theme.primaryColor);
    root.style.setProperty('--color-bg', theme.backgroundColor);
    root.style.setProperty('--color-surface', theme.cardColor);
    root.style.setProperty('--color-text-main', theme.backgroundTextColor);

    // Compute glow shade: rgba representation
    const rgb = hexToRgb(theme.primaryColor);
    root.style.setProperty('--color-primary-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
  }, []);

  // Fetch saved configuration on mount and schedule check on periodic loop.
  useEffect(() => {
    let completed = false;
    const cacheKey_theme = 'cached_active_theme';
    const cacheKey_list = 'cached_all_themes';
    
    let cachedTheme: any = null;
    let cachedList: any = null;
    const isAdmin = window.location.pathname.includes('/admin');

    if (!isAdmin && typeof window !== 'undefined' && window.localStorage) {
      try {
        const tStr = localStorage.getItem(cacheKey_theme);
        const lStr = localStorage.getItem(cacheKey_list);
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
