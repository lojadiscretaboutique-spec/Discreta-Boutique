import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface StoreSettings {
  storeName: string;
  whatsapp: string;
  deliveryFee: number;
  address: string;
  instagram: string;
  logoUrl?: string;
  loading: boolean;
  isUsingFallback?: boolean;
}

const SettingsContext = createContext<StoreSettings | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings>({
    storeName: 'Discreta Boutique',
    whatsapp: '5511999999999',
    deliveryFee: 15,
    address: '',
    instagram: '',
    logoUrl: undefined,
    loading: true,
    isUsingFallback: false
  });

  useEffect(() => {
    const docRef = doc(db, 'settings', 'store');
    const isAdmin = window.location.pathname.includes('/admin');
    const cacheKey_settings = 'cached_store_settings';

    let cachedSettings: any = null;
    if (!isAdmin && typeof window !== 'undefined' && window.localStorage) {
      try {
        const sStr = localStorage.getItem(cacheKey_settings);
        if (sStr) cachedSettings = JSON.parse(sStr);
      } catch (e) {
        console.warn("Error parsing cached settings from localStorage:", e);
      }
    }

    if (cachedSettings) {
      setSettings({
        ...cachedSettings,
        loading: false,
        isUsingFallback: false
      });
    }

    const timeoutDuration = cachedSettings ? 8500 : 6000;
    const timeoutId = setTimeout(() => {
      if (!cachedSettings) {
        console.warn("[Settings] Initialization took too long (2s). Using fallback settings in background.");
        setSettings(prev => {
          if (prev.loading) {
            return { ...prev, loading: false, isUsingFallback: true };
          }
          return prev;
        });
      }
    }, timeoutDuration);

    if (isAdmin) {
      // Use onSnapshot for real-time updates when admin changes settings
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        clearTimeout(timeoutId);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const freshSettings = {
            storeName: data.storeName || 'Discreta Boutique',
            whatsapp: data.whatsapp || '5511999999999',
            deliveryFee: Number(data.deliveryFee || 15),
            address: data.address || '',
            instagram: data.instagram || '',
            logoUrl: data.logoUrl || undefined,
            loading: false,
            isUsingFallback: false
          };
          setSettings(freshSettings);
        } else {
          setSettings(prev => ({ ...prev, loading: false, isUsingFallback: false }));
        }
      }, (error) => {
        clearTimeout(timeoutId);
        console.error("Error listening to settings:", error);
        setSettings(prev => ({ ...prev, loading: false, isUsingFallback: true }));
      });

      return () => {
        clearTimeout(timeoutId);
        unsubscribe();
      };
    } else {
      // Use getDoc for visitors to reduce concurrent Firestore connections and reads
      getDoc(docRef).then((docSnap) => {
        clearTimeout(timeoutId);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const freshSettings = {
            storeName: data.storeName || 'Discreta Boutique',
            whatsapp: data.whatsapp || '5511999999999',
            deliveryFee: Number(data.deliveryFee || 15),
            address: data.address || '',
            instagram: data.instagram || '',
            logoUrl: data.logoUrl || undefined,
            loading: false,
            isUsingFallback: false
          };
          setSettings(freshSettings);

          if (typeof window !== 'undefined' && window.localStorage) {
            try {
              localStorage.setItem(cacheKey_settings, JSON.stringify(freshSettings));
            } catch (e) {
              console.warn("Failed saving settings to local storage:", e);
            }
          }
        } else {
          setSettings(prev => ({ ...prev, loading: false, isUsingFallback: false }));
        }
      }).catch((error) => {
        clearTimeout(timeoutId);
        console.error("Error fetching settings with getDoc:", error);
        if (!cachedSettings) {
          setSettings(prev => ({ ...prev, loading: false, isUsingFallback: true }));
        }
      });
    }
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
