import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PrinterLog {
  id?: string;
  type: string; // e.g., 'system_token', 'job_status', 'device_status', 'config_changed'
  level: 'info' | 'warning' | 'error';
  deviceId?: string;
  orderId?: string;
  jobId?: string;
  message: string;
  metadata?: Record<string, any>;
  createdAt: any;
}

export const printerLogService = {
  async createLog(log: Omit<PrinterLog, 'createdAt'>): Promise<string> {
    try {
      // Clean undefined keys
      const cleanObj = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        const newObj: any = Array.isArray(obj) ? [] : {};
        for (const k in obj) {
          if (obj[k] !== undefined) {
            newObj[k] = cleanObj(obj[k]);
          }
        }
        return newObj;
      };

      const docVal = {
        type: log.type,
        level: log.level,
        deviceId: log.deviceId || null,
        orderId: log.orderId || null,
        jobId: log.jobId || null,
        message: log.message,
        metadata: log.metadata ? cleanObj(log.metadata) : null,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'printerLogs'), docVal);
      return docRef.id;
    } catch (e) {
      console.error("Erro ao criar log de impressão:", e);
      return '';
    }
  },

  async createSystemLog(type: string, level: 'info' | 'warning' | 'error', message: string, metadata?: Record<string, any>) {
    return this.createLog({
      type,
      level,
      message,
      metadata
    });
  },

  async listLogs(maxCount = 100): Promise<PrinterLog[]> {
    try {
      const q = query(
        collection(db, 'printerLogs'), 
        orderBy('createdAt', 'desc'), 
        limit(maxCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PrinterLog));
    } catch (e) {
      console.error("Erro ao listar logs de impressão:", e);
      return [];
    }
  }
};
