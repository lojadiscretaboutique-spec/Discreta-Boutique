import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  where, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { printerLogService } from './printerLogService';
import { printerSettingsService } from './printerSettingsService';

export interface PrinterJob {
  id?: string;
  orderId: string;
  orderNumber: string;
  status: 'pending' | 'printing' | 'printed' | 'failed' | 'cancelled';
  assignedDeviceId: string | null;
  printerName: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage: string;
  createdAt: any;
  updatedAt: any;
  startedAt?: any;
  printedAt?: any;
  cancelledAt?: any;
}

export const printerJobService = {
  async listJobs(maxCount = 100): Promise<PrinterJob[]> {
    try {
      const q = query(
        collection(db, 'printerJobs'), 
        orderBy('createdAt', 'desc'), 
        limit(maxCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as PrinterJob));
    } catch (e) {
      console.error("Erro ao listar fila de impressão:", e);
      return [];
    }
  },

  async createJobForOrder(orderId: string, orderNumber: string, isManualReprint = false): Promise<string> {
    try {
      // Avoid duplicate jobs for the same order if there is already a pending or printing one
      if (!isManualReprint) {
        const qPending = query(
          collection(db, 'printerJobs'),
          where('orderId', '==', orderId),
          where('status', 'in', ['pending', 'printing'])
        );
        const activeSnap = await getDocs(qPending);
        if (!activeSnap.empty) {
          console.log(`Job de impressão para pedido ${orderNumber} já existe ativo. Ignorando.`);
          return activeSnap.docs[0].id;
        }
      }

      // Read default configurations
      const settings = await printerSettingsService.getSettings();

      if (!isManualReprint && !settings.createJobOnNewOrder) {
        console.log(`Auto print job creation is disabled in the settings config.`);
        return '';
      }

      const docVal = {
        orderId,
        orderNumber,
        status: 'pending',
        assignedDeviceId: settings.defaultDeviceId || null,
        printerName: settings.defaultPrinterName || null,
        attempts: 0,
        maxAttempts: settings.maxRetries || 3,
        errorMessage: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'printerJobs'), docVal);

      // Log event
      await printerLogService.createLog({
        type: 'job_created',
        level: 'info',
        orderId,
        jobId: docRef.id,
        message: isManualReprint 
          ? `Pedido #${orderNumber} enviado manualmente para reimpressão na fila`
          : `Novo pedido #${orderNumber} inserido automaticamente na fila de impressão`,
        metadata: { isManualReprint }
      });

      return docRef.id;
    } catch (e) {
      console.error("Erro ao criar job de impressão:", e);
      throw e;
    }
  },

  async retryJob(jobId: string, orderNumber: string): Promise<void> {
    try {
      const docRef = doc(db, 'printerJobs', jobId);
      await updateDoc(docRef, {
        status: 'pending',
        errorMessage: '',
        updatedAt: serverTimestamp()
      });

      await printerLogService.createLog({
        type: 'job_reenviado',
        level: 'info',
        jobId,
        message: `Job para pedido #${orderNumber} reenviado manualmente para fila de impressão`
      });
    } catch (e) {
      console.error("Erro ao reenviar job de impressão:", e);
      throw e;
    }
  },

  async cancelJob(jobId: string, orderNumber: string): Promise<void> {
    try {
      const docRef = doc(db, 'printerJobs', jobId);
      await updateDoc(docRef, {
        status: 'cancelled',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await printerLogService.createLog({
        type: 'job_cancelled',
        level: 'warning',
        jobId,
        message: `Job para pedido #${orderNumber} cancelado pelo administrador`
      });
    } catch (e) {
      console.error("Erro ao cancelar job de impressão:", e);
      throw e;
    }
  },

  async createTestJob(isPrintTest = false): Promise<string> {
    try {
      const settings = await printerSettingsService.getSettings();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const testOrderId = `TEST_${Date.now()}`;
      const testOrderNumber = `TEST-${rand}`;

      const docVal = {
        orderId: testOrderId,
        orderNumber: testOrderNumber,
        status: 'pending',
        assignedDeviceId: settings.defaultDeviceId || null,
        printerName: settings.defaultPrinterName || null,
        attempts: 0,
        maxAttempts: settings.maxRetries || 3,
        errorMessage: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'printerJobs'), docVal);

      await printerLogService.createLog({
        type: 'job_created',
        level: 'info',
        orderId: testOrderId,
        jobId: docRef.id,
        message: isPrintTest 
          ? `Teste de impressão gerado como Job #${testOrderNumber}`
          : `Job de teste #${testOrderNumber} criado na fila de impressão`,
        metadata: { isTest: true, isPrintTest }
      });

      return docRef.id;
    } catch (e) {
      console.error("Erro ao criar job de teste:", e);
      throw e;
    }
  }
};
