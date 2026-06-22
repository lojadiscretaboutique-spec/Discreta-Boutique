import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cacheService } from './cacheService';

export interface MethodConfig {
  id: string;
  name: string;
  label: string; // compatibility mapping
  type: 'pix' | 'dinheiro' | 'debito' | 'credito' | 'transferencia' | 'link_pagamento' | 'gateway_online' | 'outro';
  icon?: string;
  active: boolean;
  showOnSite: boolean;
  showOnPDV: boolean;
  availableForDelivery: boolean;
  availableForPickup: boolean;
  allowInstallments: boolean;
  maxInstallments: number;
  requiresProof: boolean;
  requiresChange: boolean;
  gatewayProvider: 'manual' | 'mercado_pago' | 'maquininha' | 'outro';
  sortOrder: number;
  enabledDelivery: boolean; // compatibility mapping
  enabledPickup: boolean; // compatibility mapping
  useIntegration: boolean; // compatibility mapping
  createdAt?: any;
  updatedAt?: any;
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
    await cacheService.notifyChange();
  },

  async getPaymentSettings(): Promise<PaymentSettings> {
    const defaultMethods: MethodConfig[] = [
      {
        id: 'pix',
        name: 'Pix',
        label: 'Pix',
        type: 'pix',
        icon: 'smartphone',
        active: true,
        showOnSite: true,
        showOnPDV: true,
        availableForDelivery: true,
        availableForPickup: true,
        allowInstallments: false,
        maxInstallments: 1,
        requiresProof: true,
        requiresChange: false,
        gatewayProvider: 'manual',
        sortOrder: 1,
        enabledDelivery: true,
        enabledPickup: true,
        useIntegration: false,
      },
      {
        id: 'credit_card',
        name: 'Cartão de Crédito',
        label: 'Cartão de Crédito',
        type: 'credito',
        icon: 'card',
        active: true,
        showOnSite: true,
        showOnPDV: true,
        availableForDelivery: true,
        availableForPickup: true,
        allowInstallments: true,
        maxInstallments: 12,
        requiresProof: false,
        requiresChange: false,
        gatewayProvider: 'maquininha',
        sortOrder: 2,
        enabledDelivery: true,
        enabledPickup: true,
        useIntegration: false,
      },
      {
        id: 'debit_card',
        name: 'Cartão de Débito',
        label: 'Cartão de Débito',
        type: 'debito',
        icon: 'wallet',
        active: true,
        showOnSite: true,
        showOnPDV: true,
        availableForDelivery: true,
        availableForPickup: true,
        allowInstallments: false,
        maxInstallments: 1,
        requiresProof: false,
        requiresChange: false,
        gatewayProvider: 'maquininha',
        sortOrder: 3,
        enabledDelivery: true,
        enabledPickup: true,
        useIntegration: false,
      },
      {
        id: 'cash',
        name: 'Dinheiro',
        label: 'Dinheiro',
        type: 'dinheiro',
        icon: 'banknote',
        active: true,
        showOnSite: true,
        showOnPDV: true,
        availableForDelivery: true,
        availableForPickup: true,
        allowInstallments: false,
        maxInstallments: 1,
        requiresProof: false,
        requiresChange: true,
        gatewayProvider: 'manual',
        sortOrder: 4,
        enabledDelivery: true,
        enabledPickup: true,
        useIntegration: false,
      }
    ];

    try {
      const snap = await getDocs(collection(db, 'financial_payment_methods'));
      if (!snap.empty) {
        const methods: MethodConfig[] = [];
        snap.docs.forEach(doc => {
          const d = doc.data();
          const id = doc.id;
          const name = d.name || d.label || id;
          const type = d.type || 'outro';
          const active = d.active !== undefined ? d.active : true;
          const showOnSite = d.showOnSite !== undefined ? d.showOnSite : true;
          const showOnPDV = d.showOnPDV !== undefined ? d.showOnPDV : true;
          
          // Use provided values or fallback
          const availableForDelivery = d.availableForDelivery !== undefined ? d.availableForDelivery : (d.enabledDelivery !== undefined ? d.enabledDelivery : true);
          const availableForPickup = d.availableForPickup !== undefined ? d.availableForPickup : (d.enabledPickup !== undefined ? d.enabledPickup : true);
          
          const allowInstallments = d.allowInstallments !== undefined ? d.allowInstallments : false;
          const maxInstallments = d.maxInstallments !== undefined ? Number(d.maxInstallments) : 1;
          const requiresProof = d.requiresProof !== undefined ? d.requiresProof : false;
          const requiresChange = d.requiresChange !== undefined ? d.requiresChange : false;
          const gatewayProvider = d.gatewayProvider || (d.useIntegration ? 'mercado_pago' : 'manual');
          const sortOrder = d.sortOrder !== undefined ? Number(d.sortOrder) : 99;
          const icon = d.icon || 'card';

          methods.push({
            id,
            name,
            label: name, // map name to label
            type,
            icon,
            active,
            showOnSite,
            showOnPDV,
            availableForDelivery,
            availableForPickup,
            allowInstallments,
            maxInstallments,
            requiresProof,
            requiresChange,
            gatewayProvider,
            sortOrder,
            // Backwards compatibility mappings for checkout/cart
            enabledDelivery: availableForDelivery,
            enabledPickup: availableForPickup,
            useIntegration: gatewayProvider !== 'manual',
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
          });
        });

        // Sort by order
        methods.sort((a, b) => a.sortOrder - b.sortOrder);
        return { methods };
      }
    } catch (e) {
      console.warn("Could not load from financial_payment_methods, loading settings/payment_config...", e);
    }

    // Try fallback document
    try {
      const docSnap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID));
      if (docSnap.exists()) {
        const d = docSnap.data();
        if (d.methods && Array.isArray(d.methods)) {
          const methods = d.methods.map((m: any) => {
            const name = m.name || m.label || m.id;
            const availableForDelivery = m.availableForDelivery !== undefined ? m.availableForDelivery : (m.enabledDelivery !== undefined ? m.enabledDelivery : true);
            const availableForPickup = m.availableForPickup !== undefined ? m.availableForPickup : (m.enabledPickup !== undefined ? m.enabledPickup : true);
            const gatewayProvider = m.gatewayProvider || (m.useIntegration ? 'mercado_pago' : 'manual');
            
            return {
              id: m.id,
              name,
              label: name,
              type: m.type || 'outro',
              icon: m.icon || 'card',
              active: m.active !== undefined ? m.active : true,
              showOnSite: m.showOnSite !== undefined ? m.showOnSite : true,
              showOnPDV: m.showOnPDV !== undefined ? m.showOnPDV : true,
              availableForDelivery,
              availableForPickup,
              allowInstallments: m.allowInstallments !== undefined ? m.allowInstallments : false,
              maxInstallments: m.maxInstallments !== undefined ? Number(m.maxInstallments) : 1,
              requiresProof: m.requiresProof !== undefined ? m.requiresProof : false,
              requiresChange: m.requiresChange !== undefined ? m.requiresChange : false,
              gatewayProvider,
              sortOrder: m.sortOrder !== undefined ? Number(m.sortOrder) : 99,
              enabledDelivery: availableForDelivery,
              enabledPickup: availableForPickup,
              useIntegration: gatewayProvider !== 'manual',
            } as MethodConfig;
          });
          return { methods };
        }
      }
    } catch (e) {
      console.warn("Could not load settings document:", e);
    }

    return { methods: defaultMethods };
  },

  async savePaymentSettings(settings: PaymentSettings) {
    // Save to the settings document for backwards compatibility
    
    // Clean undefined values
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    await setDoc(doc(db, 'settings', SETTINGS_DOC_ID), cleanSettings);

    // Save each separate method to financial_payment_methods collection
    try {
      for (const m of settings.methods) {
        const cleanMethod = {
          id: m.id,
          name: m.name || m.label,
          label: m.name || m.label,
          type: m.type || 'outro',
          icon: m.icon || 'card',
          active: m.active !== undefined ? m.active : true,
          showOnSite: m.showOnSite !== undefined ? m.showOnSite : true,
          showOnPDV: m.showOnPDV !== undefined ? m.showOnPDV : true,
          availableForDelivery: m.availableForDelivery !== undefined ? m.availableForDelivery : (m.enabledDelivery !== undefined ? m.enabledDelivery : true),
          availableForPickup: m.availableForPickup !== undefined ? m.availableForPickup : (m.enabledPickup !== undefined ? m.enabledPickup : true),
          allowInstallments: m.allowInstallments !== undefined ? m.allowInstallments : false,
          maxInstallments: m.maxInstallments !== undefined ? Number(m.maxInstallments) : 1,
          requiresProof: m.requiresProof !== undefined ? m.requiresProof : false,
          requiresChange: m.requiresChange !== undefined ? m.requiresChange : false,
          gatewayProvider: m.gatewayProvider || (m.useIntegration ? 'mercado_pago' : 'manual'),
          sortOrder: m.sortOrder !== undefined ? Number(m.sortOrder) : 99,
          updatedAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'financial_payment_methods', m.id), cleanMethod);
      }
    } catch (e) {
      console.error("Error writing to financial_payment_methods collection:", e);
    }

    await cacheService.notifyChange();
  },

  async getMercadoPagoSettings(): Promise<MercadoPagoSettings> {
    const d = await getDoc(doc(db, 'settings', MP_DOC_ID));
    if (d.exists()) {
      const data = d.data();
      return {
        accessToken: '', // NEVER return actual token to the client/frontend
        publicKey: data.publicKey || '',
        active: data.active || false,
        testMode: data.testMode !== undefined ? data.testMode : true
      };
    }
    return {
      accessToken: '',
      publicKey: '',
      active: false,
      testMode: true
    };
  },

  async saveMercadoPagoSettings(settings: MercadoPagoSettings) {
    // Securely route settings save to backend API instead of a public document write
    const res = await fetch('/api/admin/mercadopago/save-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: settings.active,
        environment: settings.testMode ? 'sandbox' : 'production',
        publicKey: settings.publicKey,
        accessToken: settings.accessToken,
        pixEnabled: true,
        creditCardEnabled: true,
        debitEnabled: false,
        webhookUrl: `${window.location.origin}/api/webhooks/mercadopago`
      })
    });
    if (!res.ok) {
      throw new Error('Falha ao salvar as configurações no servidor');
    }
    await cacheService.notifyChange();
  }
};
