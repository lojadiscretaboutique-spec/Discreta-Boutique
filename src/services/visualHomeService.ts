import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  writeBatch, 
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cacheService } from './cacheService';

export interface VisualHomeSettings {
  id: string;
  title: string;
  subtitle?: string;
  emoji?: string;
  alignment: 'left' | 'center' | 'right';
  active: boolean;
  source: 'auto' | 'custom_products' | 'categories' | 'brands' | 'promo' | 'best_seller' | 'views' | 'recent' | 'ai_recs' | 'stock' | 'random';
  sourceDetails?: string[];
  orderByField?: 'recent' | 'sales' | 'discount' | 'price_asc' | 'price_desc' | 'random' | 'manual';
  buttonText?: string;
  buttonUrl?: string;
  showButton?: boolean;
  themeColor?: string;
  themeBg?: string;
  bannerImageUrl?: string;
}

export interface VisualHomeLayout {
  id: string;
  orientation: 'horizontal' | 'vertical';
  colsDesktop: number; // 1, 2, 3, 4
  limit: number;
  style: 'compact' | 'standard' | 'highlight' | 'premium';
  mobileOrientation: 'horizontal' | 'vertical';
  mobileCols: number; // 1, 2
}

export interface VisualHomeSchedule {
  id: string;
  hasSchedule: boolean;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
}

export interface CustomSection {
  id: string;
  title: string;
  active: boolean;
  createdAt: any;
}

// Fixed keys for the 7 standard sections
export const STANDARD_SECTION_IDS = [
  'ofertas',
  'lancamentos',
  'destaques',
  'maisVendidos',
  'emAlta',
  'ia_exclusivos',
  'recomendados'
];

export const STANDARD_SECTIONS_DEFAULTS: Record<string, { title: string; subtitle: string; emoji: string; source: any }> = {
  ofertas: { title: 'Ofertas do Dia', subtitle: 'Aproveite agora com descontos imperdíveis', emoji: '🎉', source: 'promo' },
  lancamentos: { title: 'Lançamentos', subtitle: 'Novidades quentíssimas prontas para você', emoji: '✨', source: 'recent' },
  destaques: { title: 'Destaques', subtitle: 'Os preferidos que você precisa conhecer', emoji: '💎', source: 'auto' },
  maisVendidos: { title: 'Mais Vendidos', subtitle: 'Os queridinhos que estão esgotando', emoji: '❤️', source: 'best_seller' },
  emAlta: { title: 'Em Alta', subtitle: 'Atraindo todos os olhares esta semana', emoji: '🔥', source: 'views' },
  ia_exclusivos: { title: 'Exclusividade Ofertas Imperdíveis (IA)', subtitle: 'Sugestões de inteligência para o seu desejo', emoji: '🤖', source: 'ai_recs' },
  recomendados: { title: 'Recomendados', subtitle: 'Perfeito para o seu estilo e descoberta', emoji: '✨', source: 'random' },
};

export const visualHomeService = {
  // Seeds default structures if database is empty
  async seedIfNeeded() {
    try {
      const orderRef = doc(db, 'home_section_order', 'main');
      const orderSnap = await getDoc(orderRef);
      
      // If order already exists, it means we are seeded
      if (orderSnap.exists()) {
        return;
      }

      console.log('Seeding default home sections and visual system settings...');
      const batch = writeBatch(db);

      // 1. Create order
      batch.set(orderRef, { order: [...STANDARD_SECTION_IDS] });

      // 2. Loop and create custom details for standard sections
      STANDARD_SECTION_IDS.forEach(id => {
        const def = STANDARD_SECTIONS_DEFAULTS[id];

        // settings
        const settingsRef = doc(db, 'home_section_settings', id);
        batch.set(settingsRef, {
          id,
          title: def.title,
          subtitle: def.subtitle,
          emoji: def.emoji,
          alignment: 'left',
          active: true,
          source: def.source,
          sourceDetails: [],
          orderByField: 'recent',
          buttonText: 'Ver Tudo',
          buttonUrl: `/catalogo?secao=${id}`,
          showButton: true,
          themeColor: '#ef4444', // red-500 default
          themeBg: '#050505',
        });

        // layouts
        const layoutRef = doc(db, 'home_section_layouts', id);
        batch.set(layoutRef, {
          id,
          orientation: 'horizontal',
          colsDesktop: 4,
          limit: 12,
          style: id === 'ofertas' ? 'highlight' : 'standard',
          mobileOrientation: 'horizontal',
          mobileCols: 2
        });

        // schedules
        const scheduleRef = doc(db, 'home_section_schedules', id);
        batch.set(scheduleRef, {
          id,
          hasSchedule: false,
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: ''
        });
      });

      await batch.commit();
      console.log('Seeding of visual home settings succeeded!');
    } catch (e) {
      console.error('Error seeding visual home configurations:', e);
    }
  },

  // Get full merged state of all homepage sections
  async getFullHomeStructure() {
    const cached = cacheService.get('full_home_structure');
    if (cached) return cached;

    await this.seedIfNeeded();

    const [settingsSnap, layoutsSnap, schedulesSnap, customSnap, orderSnap] = await Promise.all([
      getDocs(collection(db, 'home_section_settings')),
      getDocs(collection(db, 'home_section_layouts')),
      getDocs(collection(db, 'home_section_schedules')),
      getDocs(collection(db, 'home_custom_sections')),
      getDoc(doc(db, 'home_section_order', 'main'))
    ]);

    const settingsMap: Record<string, VisualHomeSettings> = {};
    settingsSnap.docs.forEach(d => {
      settingsMap[d.id] = { id: d.id, ...d.data() } as VisualHomeSettings;
    });

    const layoutsMap: Record<string, VisualHomeLayout> = {};
    layoutsSnap.docs.forEach(d => {
      layoutsMap[d.id] = { id: d.id, ...d.data() } as VisualHomeLayout;
    });

    const schedulesMap: Record<string, VisualHomeSchedule> = {};
    schedulesSnap.docs.forEach(d => {
      schedulesMap[d.id] = { id: d.id, ...d.data() } as VisualHomeSchedule;
    });

    const customSections = customSnap.docs.map(d => ({ id: d.id, ...d.data() } as CustomSection));

    const orderData = orderSnap.data();
    let order: string[] = orderData?.order || [];

    // Make sure all standard and custom sections are present in order
    const allKnownIds = [...STANDARD_SECTION_IDS, ...customSections.map(c => c.id)];
    
    // Add missing IDs to the bottom of the list
    allKnownIds.forEach(id => {
      if (!order.includes(id)) {
        order.push(id);
      }
    });

    // Remove obsolete IDs from order list (that aren't standard or custom)
    order = order.filter(id => allKnownIds.includes(id));

    const result = {
      settings: settingsMap,
      layouts: layoutsMap,
      schedules: schedulesMap,
      customSections,
      order
    };
    cacheService.set('full_home_structure', result);
    return result;
  },

  // Save the full configuration in a transaction/batch
  async saveSection(
    id: string, 
    settings: Partial<VisualHomeSettings>, 
    layout: Partial<VisualHomeLayout>, 
    schedule: Partial<VisualHomeSchedule>
  ) {
    const batch = writeBatch(db);

    batch.set(doc(db, 'home_section_settings', id), { id, ...settings }, { merge: true });
    batch.set(doc(db, 'home_section_layouts', id), { id, ...layout }, { merge: true });
    batch.set(doc(db, 'home_section_schedules', id), { id, ...schedule }, { merge: true });

    await batch.commit();
    await cacheService.notifyChange();
  },

  // Update order list
  async saveSectionOrder(order: string[]) {
    await setDoc(doc(db, 'home_section_order', 'main'), { order });
    await cacheService.notifyChange();
  },

  // Add custom section
  async createCustomSection(title: string) {
    const customId = 'custom_' + Math.random().toString(36).substring(2, 9);
    
    const batch = writeBatch(db);

    // Initial default settings
    batch.set(doc(db, 'home_custom_sections', customId), {
      id: customId,
      title,
      active: true,
      createdAt: serverTimestamp()
    });

    batch.set(doc(db, 'home_section_settings', customId), {
      id: customId,
      title,
      subtitle: '',
      emoji: '✨',
      alignment: 'left',
      active: true,
      source: 'auto',
      sourceDetails: [],
      orderByField: 'recent',
      buttonText: 'Ver Tudo',
      buttonUrl: '/catalogo',
      showButton: false,
      themeColor: '#ef4444',
      themeBg: '#050505',
    });

    batch.set(doc(db, 'home_section_layouts', customId), {
      id: customId,
      orientation: 'horizontal',
      colsDesktop: 4,
      limit: 8,
      style: 'standard',
      mobileOrientation: 'horizontal',
      mobileCols: 2
    });

    batch.set(doc(db, 'home_section_schedules', customId), {
      id: customId,
      hasSchedule: false,
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: ''
    });

    // Fetch existing order to append
    const orderRef = doc(db, 'home_section_order', 'main');
    const orderSnap = await getDoc(orderRef);
    const existingOrder = orderSnap.data()?.order || [];
    batch.set(orderRef, { order: [...existingOrder, customId] });

    await batch.commit();
    await cacheService.notifyChange();
    return customId;
  },

  // Delete custom section
  async deleteCustomSection(id: string) {
    const batch = writeBatch(db);

    batch.delete(doc(db, 'home_custom_sections', id));
    batch.delete(doc(db, 'home_section_settings', id));
    batch.delete(doc(db, 'home_section_layouts', id));
    batch.delete(doc(db, 'home_section_schedules', id));

    // Also update order
    const orderRef = doc(db, 'home_section_order', 'main');
    const orderSnap = await getDoc(orderRef);
    if (orderSnap.exists()) {
      const existingOrder = orderSnap.data()?.order || [];
      batch.set(orderRef, { order: existingOrder.filter((oid: string) => oid !== id) });
    }

    await batch.commit();
    await cacheService.notifyChange();
  },

  // Duplicate custom or standard section as a new custom section
  async duplicateSection(id: string) {
    const customId = 'custom_' + Math.random().toString(36).substring(2, 9);
    
    // Get doc references for old section
    const oldSettingsRef = doc(db, 'home_section_settings', id);
    const oldLayoutRef = doc(db, 'home_section_layouts', id);
    const oldScheduleRef = doc(db, 'home_section_schedules', id);
    
    const [oldSettingsSnap, oldLayoutSnap, oldScheduleSnap] = await Promise.all([
      getDoc(oldSettingsRef),
      getDoc(oldLayoutRef),
      getDoc(oldScheduleRef)
    ]);
    
    const oldSettings = oldSettingsSnap.exists() ? oldSettingsSnap.data() : {};
    const oldLayout = oldLayoutSnap.exists() ? oldLayoutSnap.data() : {};
    const oldSchedule = oldScheduleSnap.exists() ? oldScheduleSnap.data() : {};
    
    const originalTitle = oldSettings.title || 'Seção Copiada';
    const newTitle = originalTitle.endsWith(' (Cópia)') ? originalTitle : `${originalTitle} (Cópia)`;
    
    const batch = writeBatch(db);
    
    // Save as home_custom_sections
    batch.set(doc(db, 'home_custom_sections', customId), {
      id: customId,
      title: newTitle,
      active: true,
      createdAt: serverTimestamp()
    });
    
    // Save settings
    batch.set(doc(db, 'home_section_settings', customId), {
      ...oldSettings,
      id: customId,
      title: newTitle,
      active: true, // start active
    });
    
    // Save layout
    batch.set(doc(db, 'home_section_layouts', customId), {
      ...oldLayout,
      id: customId
    });
    
    // Save schedule
    batch.set(doc(db, 'home_section_schedules', customId), {
      ...oldSchedule,
      id: customId
    });
    
    // Update order right after the original section id if exists, otherwise at the end
    const orderRef = doc(db, 'home_section_order', 'main');
    const orderSnap = await getDoc(orderRef);
    const existingOrder: string[] = orderSnap.data()?.order || [];
    
    const oriIndex = existingOrder.indexOf(id);
    let newOrder = [...existingOrder];
    if (oriIndex !== -1) {
      newOrder.splice(oriIndex + 1, 0, customId);
    } else {
      newOrder.push(customId);
    }
    
    batch.set(orderRef, { order: newOrder });
    await batch.commit();
    await cacheService.notifyChange();
    return customId;
  }
};
