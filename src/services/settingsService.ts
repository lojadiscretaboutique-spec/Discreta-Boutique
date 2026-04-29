import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

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

export interface StoreSettings {
  storeName: string;
  logoUrl?: string;
  primaryColor?: string;
  terms?: string;
  privacyPolicy?: string;
}

const STORE_DOC_ID = 'store';

export const settingsService = {
  async getStoreSettings(): Promise<StoreSettings> {
    const d = await getDoc(doc(db, 'settings', STORE_DOC_ID));
    if (d.exists()) return d.data() as StoreSettings;
    return {
      storeName: 'Discreta Boutique',
      logoUrl: ''
    };
  },

  async saveStoreSettings(settings: StoreSettings) {
    await setDoc(doc(db, 'settings', STORE_DOC_ID), settings);
  },

  async getOperatingHours(): Promise<OperatingHoursSettings> {
    const d = await getDoc(doc(db, 'settings', OPERATING_HOURS_DOC_ID));
    if (d.exists()) return d.data() as OperatingHoursSettings;
    
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
  }
};
