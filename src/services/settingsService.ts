import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cacheService } from './cacheService';

export interface MethodConfig {
  id: string;
  label: string;
  enabledDelivery: boolean;
  enabledPickup: boolean;
  useIntegration: boolean;
}

export interface PaymentSettings {
  methods: MethodConfig[];
}

export interface MercadoPagoSettings {
  accessToken: string;
  publicKey: string;
  active: boolean;
  testMode: boolean;
}

const SETTINGS_DOC_ID = 'payment_config';
const MP_DOC_ID = 'mercadopago_config';
const OPERATING_HOURS_DOC_ID = 'operating_hours';

export interface TimeSlot {
  from: string;
  to: string;
}

export interface DayConfig {
  day: string;
  isOpen: boolean;
  slots: TimeSlot[];
}

export interface ClosedDate {
  date: string;
  reason: string;
}

export interface OperatingHoursSettings {
  weekly: DayConfig[];
  closedDates: ClosedDate[];
}

export const settingsService = {
  // ... existing methods

  async getOperatingHours(): Promise<OperatingHoursSettings> {
    const d = await getDoc(doc(db, 'settings', OPERATING_HOURS_DOC_ID));
    if (d.exists()) {
      const data = d.data() as OperatingHoursSettings;
      
      // Self-healing: auto-correct 09:00 to 07:30 Wednesday typo
      let needsFix = false;
      const updatedWeekly = data.weekly.map(dayConfig => {
        if (dayConfig.day === 'quarta') {
          const updatedSlots = dayConfig.slots.map(slot => {
            if (slot.from === '09:00' && slot.to === '07:30') {
              needsFix = true;
              return { ...slot, to: '17:30' };
            }
            return slot;
          });
          return { ...dayConfig, slots: updatedSlots };
        }
        return dayConfig;
      });

      if (needsFix) {
        const repaired = { ...data, weekly: updatedWeekly };
        try {
          // Attempt to save corrected hours back to Firestore (works if admin is logged in)
          await setDoc(doc(db, 'settings', OPERATING_HOURS_DOC_ID), repaired);
          console.log('[Self-Healing] Wednesday operating hours corrected in Firestore!');
        } catch (e) {
          console.warn('[Self-Healing] In-memory operating hours corrected, but could not persist to Firestore:', e);
        }
        return repaired;
      }

      return data;
    }
    
    // Default config
    const days = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    return {
      weekly: days.map(day => ({
        day,
        isOpen: day !== 'domingo',
        slots: [{ from: '09:00', to: '18:00' }]
      })),
      closedDates: []
    };
  },

  async saveOperatingHours(settings: OperatingHoursSettings) {
    await setDoc(doc(db, 'settings', OPERATING_HOURS_DOC_ID), settings);
    await cacheService.notifyChange();
  },

  async getPaymentSettings(): Promise<PaymentSettings> {
    const d = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID));
    if (d.exists()) return d.data() as PaymentSettings;
    return {
      methods: [
        { id: 'pix', label: 'PIX', enabledDelivery: true, enabledPickup: true, useIntegration: true },
        { id: 'credit_card', label: 'Cartão de Crédito', enabledDelivery: true, enabledPickup: true, useIntegration: true },
        { id: 'debit_card', label: 'Cartão de Débito', enabledDelivery: true, enabledPickup: true, useIntegration: true },
        { id: 'cash', label: 'Dinheiro', enabledDelivery: true, enabledPickup: true, useIntegration: false },
      ]
    };
  },

  async savePaymentSettings(settings: PaymentSettings) {
    await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), settings);
    await cacheService.notifyChange();
  },

  async getMercadoPagoSettings(): Promise<MercadoPagoSettings> {
    const d = await getDoc(doc(db, 'settings', MP_DOC_ID));
    if (d.exists()) return d.data() as MercadoPagoSettings;
    return {
      accessToken: '',
      publicKey: '',
      active: false,
      testMode: true
    };
  },

  async saveMercadoPagoSettings(settings: MercadoPagoSettings) {
    await setDoc(doc(db, 'settings', MP_DOC_ID), settings);
    await cacheService.notifyChange();
  }
};
