import { doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/auth';
import { ThemeConfig } from '../types/theme';
import { cacheService } from './cacheService';
import { auditLogService, AuditLog } from './auditLogService';
import { getAutoTextColor } from '../utils/themeUtils';

const THEME_ACTIVE_DOC_ID = 'theme_active';

export const PREMADE_THEMES: ThemeConfig[] = [
  {
    id: 'default',
    name: 'Tema Padrão Discreta',
    isCustom: false,
    primaryColor: '#D32F2F',
    secondaryColor: '#0A0A0A',
    backgroundColor: '#0A0A0A',
    cardColor: '#161616',
    buttonColor: '#D32F2F',
    linkColor: '#FFFFFF',
    highlightColor: '#D32F2F',
    primaryTextColor: '#ffffff',
    secondaryTextColor: '#ffffff',
    backgroundTextColor: '#ffffff',
    cardTextColor: '#ffffff',
    buttonTextColor: '#ffffff',
    linkTextColor: '#ffffff',
    highlightTextColor: '#ffffff',
    scheduled: false,
  },
  {
    id: 'namorados',
    name: 'Tema Dia dos Namorados',
    isCustom: false,
    primaryColor: '#E11D48',
    secondaryColor: '#F472B6',
    backgroundColor: '#1F0510',
    cardColor: '#2E0A1B',
    buttonColor: '#E11D48',
    linkColor: '#F472B6',
    highlightColor: '#DB2777',
    primaryTextColor: '#ffffff',
    secondaryTextColor: '#000000',
    backgroundTextColor: '#ffffff',
    cardTextColor: '#ffffff',
    buttonTextColor: '#ffffff',
    linkTextColor: '#000000',
    highlightTextColor: '#ffffff',
    scheduled: false,
  },
  {
    id: 'blackfriday',
    name: 'Tema Black Friday',
    isCustom: false,
    primaryColor: '#000000',
    secondaryColor: '#FACC15',
    backgroundColor: '#050505',
    cardColor: '#141414',
    buttonColor: '#FACC15',
    linkColor: '#FACC15',
    highlightColor: '#EF4444',
    primaryTextColor: '#ffffff',
    secondaryTextColor: '#000000',
    backgroundTextColor: '#ffffff',
    cardTextColor: '#ffffff',
    buttonTextColor: '#000000',
    linkTextColor: '#000000',
    highlightTextColor: '#ffffff',
    scheduled: false,
  },
  {
    id: 'natal',
    name: 'Tema Natal',
    isCustom: false,
    primaryColor: '#B91C1C',
    secondaryColor: '#15803D',
    backgroundColor: '#06120C',
    cardColor: '#0C2417',
    buttonColor: '#B91C1C',
    linkColor: '#22C55E',
    highlightColor: '#FBBF24',
    primaryTextColor: '#ffffff',
    secondaryTextColor: '#ffffff',
    backgroundTextColor: '#ffffff',
    cardTextColor: '#ffffff',
    buttonTextColor: '#ffffff',
    linkTextColor: '#000000',
    highlightTextColor: '#000000',
    scheduled: false,
  },
  {
    id: 'luxo',
    name: 'Tema Luxo',
    isCustom: false,
    primaryColor: '#D97706',
    secondaryColor: '#111827',
    backgroundColor: '#09090B',
    cardColor: '#18181B',
    buttonColor: '#D97706',
    linkColor: '#F59E0B',
    highlightColor: '#FCD34D',
    primaryTextColor: '#ffffff',
    secondaryTextColor: '#ffffff',
    backgroundTextColor: '#ffffff',
    cardTextColor: '#ffffff',
    buttonTextColor: '#ffffff',
    linkTextColor: '#000000',
    highlightTextColor: '#000000',
    scheduled: false,
  }
];

export const themeService = {
  /**
   * Returns fallback default theme
   */
  getDefaultTheme(): ThemeConfig {
    return PREMADE_THEMES[0];
  },

  /**
   * Gathers all themes, premade and custom saved in Firestore collection 'themes'
   */
  async getThemes(): Promise<ThemeConfig[]> {
    try {
      const q = query(collection(db, 'themes'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const customThemes = snap.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        isCustom: true
      })) as ThemeConfig[];

      return [...PREMADE_THEMES, ...customThemes];
    } catch (e) {
      console.warn("Could not load custom themes from Firestore. Using premades only.", e);
      return PREMADE_THEMES;
    }
  },

  /**
   * Resolves currently active theme considering scheduled themes as well
   */
  async getActiveTheme(): Promise<ThemeConfig> {
    try {
      const allThemes = await this.getThemes();
      const now = new Date();

      // Look for a scheduled theme that falls inside active range
      const activeScheduled = allThemes.find(theme => {
        if (!theme.scheduled || !theme.startDate || !theme.endDate) return false;
        const start = new Date(theme.startDate);
        const end = new Date(theme.endDate);
        return now >= start && now <= end;
      });

      if (activeScheduled) {
        console.log(`[ThemeEngine] Scheduled theme "${activeScheduled.name}" is currently active.`);
        return activeScheduled;
      }

      // If no valid scheduled theme, check chosen custom active theme
      const d = await getDoc(doc(db, 'settings', THEME_ACTIVE_DOC_ID));
      if (d.exists()) {
        const activeData = d.data() as Partial<ThemeConfig>;
        
        // Match standard theme configurations
        const found = allThemes.find(t => t.id === activeData.id);
        if (found) {
          return found;
        }

        // Return inline custom values if saved directly in settings
        return {
          ...this.getDefaultTheme(),
          ...activeData,
        } as ThemeConfig;
      }
    } catch (e) {
      console.error("Error reading active theme:", e);
    }

    return this.getDefaultTheme();
  },

  async uploadImage(fileOrResult: File | any): Promise<any> {
    const { storage } = await import('../lib/storage');
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    
    // If it's a raw File
    let file = fileOrResult instanceof File ? fileOrResult : fileOrResult.file;
    if (!file) throw new Error("Invalid file provided");

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `themes/${Date.now()}_${sanitizedName}`;
    const fileRef = ref(storage, path);
    
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    
    // If we passed an OptimizedImageResult, return the full branding object
    if (fileOrResult.width && fileOrResult.format) {
      return {
        url,
        path,
        width: fileOrResult.width,
        height: fileOrResult.height,
        sizeKb: fileOrResult.sizeKb,
        format: fileOrResult.format,
        version: Date.now(),
        uploadDate: new Date().toISOString()
      };
    }

    return { url, path };
  },

  /**
   * Activates a theme by saving context inside firestore settings
   */
  async activateTheme(theme: ThemeConfig, userEmail?: string, userName?: string): Promise<void> {
    try {
      const activeRef = doc(db, 'settings', THEME_ACTIVE_DOC_ID);
      const previousThemeSnap = await getDoc(activeRef);
      const previousThemeName = previousThemeSnap.exists() 
        ? (previousThemeSnap.data()?.name || 'Tema Desconhecido') 
        : 'Tema Padrão Discreta';

      await setDoc(activeRef, {
        id: theme.id,
        name: theme.name,
        isCustom: theme.isCustom,
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.backgroundColor,
        cardColor: theme.cardColor,
        buttonColor: theme.buttonColor,
        linkColor: theme.linkColor,
        highlightColor: theme.highlightColor,
        primaryTextColor: theme.primaryTextColor || getAutoTextColor(theme.primaryColor),
        secondaryTextColor: theme.secondaryTextColor || getAutoTextColor(theme.secondaryColor),
        backgroundTextColor: theme.backgroundTextColor || getAutoTextColor(theme.backgroundColor),
        cardTextColor: theme.cardTextColor || getAutoTextColor(theme.cardColor),
        buttonTextColor: theme.buttonTextColor || getAutoTextColor(theme.buttonColor),
        linkTextColor: theme.linkTextColor || getAutoTextColor(theme.linkColor),
        highlightTextColor: theme.highlightTextColor || getAutoTextColor(theme.highlightColor),
        scheduled: theme.scheduled,
        startDate: theme.startDate || null,
        endDate: theme.endDate || null,
        branding: theme.branding || null,
      });

      // Track actions in audit log
      await auditLogService.logAction(
        'Ativou Tema', 
        'theme-manager', 
        theme.id, 
        { 
          themeId: theme.id,
          themeName: theme.name,
          previousTheme: previousThemeName,
          activatedBy: userEmail || userName || auth.currentUser?.email || 'Admin'
        }
      );

      await cacheService.notifyChange();
    } catch (e) {
      console.error("Critical error activating theme:", e);
      throw e;
    }
  },

  /**
   * Saves a custom theme in Firestore
   */
  async saveTheme(theme: ThemeConfig, userEmail?: string): Promise<string> {
    try {
      const themesRef = collection(db, 'themes');
      const isNew = !theme.id || theme.id === 'new' || theme.id.startsWith('temp-');
      const targetId = isNew ? doc(themesRef).id : theme.id;

      const themeData = {
        name: theme.name,
        primaryColor: theme.primaryColor,
        secondaryColor: theme.secondaryColor,
        backgroundColor: theme.backgroundColor,
        cardColor: theme.cardColor,
        buttonColor: theme.buttonColor,
        linkColor: theme.linkColor,
        highlightColor: theme.highlightColor,
        primaryTextColor: theme.primaryTextColor || getAutoTextColor(theme.primaryColor),
        secondaryTextColor: theme.secondaryTextColor || getAutoTextColor(theme.secondaryColor),
        backgroundTextColor: theme.backgroundTextColor || getAutoTextColor(theme.backgroundColor),
        cardTextColor: theme.cardTextColor || getAutoTextColor(theme.cardColor),
        buttonTextColor: theme.buttonTextColor || getAutoTextColor(theme.buttonColor),
        linkTextColor: theme.linkTextColor || getAutoTextColor(theme.linkColor),
        highlightTextColor: theme.highlightTextColor || getAutoTextColor(theme.highlightColor),
        scheduled: theme.scheduled || false,
        startDate: theme.startDate || null,
        endDate: theme.endDate || null,
        isCustom: true,
        branding: theme.branding || null,
      };

      await setDoc(doc(db, 'themes', targetId), themeData);

      await auditLogService.logAction(
        isNew ? 'Criar Tema' : 'Editar Tema', 
        'theme-manager', 
        targetId, 
        { 
          themeName: theme.name,
          details: themeData,
          user: userEmail || auth.currentUser?.email || 'Admin'
        }
      );

      await cacheService.notifyChange();
      return targetId;
    } catch (e) {
      console.error("Error saving theme in Firestore:", e);
      throw e;
    }
  },

  /**
   * Deletes a custom theme
   */
  async deleteTheme(id: string, themeName: string, userEmail?: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'themes', id));

      await auditLogService.logAction(
        'Excluir Tema', 
        'theme-manager', 
        id, 
        { 
          themeName,
          user: userEmail || auth.currentUser?.email || 'Admin'
        }
      );

      await cacheService.notifyChange();
    } catch (e) {
      console.error("Error deleting theme from Firestore:", e);
      throw e;
    }
  },

  /**
   * Lists the theme logs by reading general audit logs matching module 'theme-manager'
   */
  async getThemeLogs(pageSize = 30): Promise<AuditLog[]> {
    try {
      const q = query(
        collection(db, 'auditLogs'), 
        where('module', '==', 'theme-manager'),
        orderBy('createdAt', 'desc'), 
        limit(pageSize)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
    } catch (e) {
      console.warn("Error loading logs, checking if index needed.", e);
      // Fallback: list all audits and filter client-side to prevent crashing if compound index is missing
      try {
         const allLogs = await auditLogService.listLogs(100);
         return allLogs.filter(log => log.module === 'theme-manager');
      } catch (err) {
         console.error("Failed to query alternate audit log system:", err);
         return [];
      }
    }
  }
};
