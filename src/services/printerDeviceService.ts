import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { printerLogService } from './printerLogService';

export interface DetectedPrinter {
  name: string;
  isDefault: boolean;
  status: string;
  isThermalCandidate: boolean;
}

export interface PrinterDevice {
  id?: string;
  deviceId: string;
  deviceName: string;
  authorized: boolean;
  blocked: boolean;
  online: boolean;
  lastSeenAt: any;
  appVersion: string;
  os: string;
  printers: DetectedPrinter[];
  defaultPrinter: string;
  createdAt: any;
  updatedAt: any;
}

export const printerDeviceService = {
  async listDevices(): Promise<PrinterDevice[]> {
    try {
      const q = query(
        collection(db, 'printerDevices'), 
        orderBy('deviceName', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          lastSeenAt: data.lastSeenAt,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        } as PrinterDevice;
      });
    } catch (e) {
      console.error("Erro ao listar dispositivos AC-Printer:", e);
      return [];
    }
  },

  async toggleDeviceBlock(deviceId: string, deviceName: string, currentlyBlocked: boolean): Promise<void> {
    try {
      const docRef = doc(db, 'printerDevices', deviceId);
      const blocked = !currentlyBlocked;
      const authorized = !blocked;
      
      await updateDoc(docRef, {
        blocked,
        authorized,
        updatedAt: serverTimestamp()
      });

      await printerLogService.createSystemLog(
        'device_status',
        blocked ? 'warning' : 'info',
        `Dispositivo AC-Printer '${deviceName || deviceId}' foi ${blocked ? 'bloqueado' : 'desbloqueado'} pelo administrador`,
        { deviceId }
      );
    } catch (e) {
      console.error("Erro ao alterar bloqueio do dispositivo:", e);
      throw e;
    }
  },

  async setDefaultPrinter(deviceId: string, deviceName: string, printerName: string): Promise<void> {
    try {
      const docRef = doc(db, 'printerDevices', deviceId);
      await updateDoc(docRef, {
        defaultPrinter: printerName,
        updatedAt: serverTimestamp()
      });

      await printerLogService.createSystemLog(
        'device_status',
        'info',
        `Dispositivo '${deviceName || deviceId}' teve a impressora padrão definida como '${printerName}'`,
        { deviceId, printerName }
      );
    } catch (e) {
      console.error("Erro ao definir impressora padrão do dispositivo:", e);
      throw e;
    }
  }
};
