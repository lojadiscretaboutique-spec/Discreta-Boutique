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
    loading: true
  });

  useEffect(() => {
    const docRef = doc(db, 'settings', 'store');
    const isAdmin = window.location.pathname.includes('/admin');

    if (isAdmin) {
      // Use onSnapshot for real-time updates when admin changes settings
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            storeName: data.storeName || 'Discreta Boutique',
            whatsapp: data.whatsapp || '5511999999999',
            deliveryFee: Number(data.deliveryFee || 15),
            address: data.address || '',
            instagram: data.instagram || '',
            logoUrl: data.logoUrl || undefined,
            loading: false
          });
        } else {
          setSettings(prev => ({ ...prev, loading: false }));
        }
      }, (error) => {
        console.error("Error listening to settings:", error);
        setSettings(prev => ({ ...prev, loading: false }));
      });

      return () => unsubscribe();
    } else {
      // Use getDoc for visitors to reduce concurrent Firestore connections and reads
      getDoc(docRef).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            storeName: data.storeName || 'Discreta Boutique',
            whatsapp: data.whatsapp || '5511999999999',
            deliveryFee: Number(data.deliveryFee || 15),
            address: data.address || '',
            instagram: data.instagram || '',
            logoUrl: data.logoUrl || undefined,
            loading: false
          });
        } else {
          setSettings(prev => ({ ...prev, loading: false }));
        }
      }).catch((error) => {
        console.error("Error fetching settings with getDoc:", error);
        setSettings(prev => ({ ...prev, loading: false }));
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
