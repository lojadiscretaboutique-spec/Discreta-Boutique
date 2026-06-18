import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { printerLogService } from './printerLogService';

export interface PrinterSettings {
  autoPrint: boolean;
  paperWidth: '58mm' | '80mm';
  copies: number;
  allowReprint: boolean;
  maxRetries: number;
  soundNotification: boolean;
  createJobOnNewOrder: boolean;
  defaultDeviceId: string;
  defaultPrinterName: string;
  updatedAt?: any;
}

const DEFAULT_SETTINGS: PrinterSettings = {
  autoPrint: false,
  paperWidth: '80mm',
  copies: 1,
  allowReprint: true,
  maxRetries: 3,
  soundNotification: true,
  createJobOnNewOrder: true,
  defaultDeviceId: '',
  defaultPrinterName: ''
};

export const printerSettingsService = {
  async getSettings(): Promise<PrinterSettings> {
    try {
      const docRef = doc(db, 'printerSettings', 'global');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          ...DEFAULT_SETTINGS,
          ...data
        } as PrinterSettings;
      }
      return DEFAULT_SETTINGS;
    } catch (e) {
      console.error("Erro ao carregar configurações de impressão:", e);
      return DEFAULT_SETTINGS;
    }
  },

  async updateSettings(settings: PrinterSettings): Promise<void> {
    try {
      const docRef = doc(db, 'printerSettings', 'global');
      const dataToSave = {
        ...settings,
        updatedAt: serverTimestamp()
      };
      
      await setDoc(docRef, dataToSave);

      // Log config changed
      await printerLogService.createSystemLog(
        'config_changed',
        'info',
        'Configurações de impressão atualizadas pelo administrador',
        { settings }
      );
    } catch (e) {
      console.error("Erro ao atualizar configurações de impressão:", e);
      throw e;
    }
  }
};
