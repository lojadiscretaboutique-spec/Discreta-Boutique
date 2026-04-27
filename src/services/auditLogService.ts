import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface AuditLog {
  id?: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  targetId: string;
  details: any;
  createdAt: any;
}

export const auditLogService = {
  async logAction(action: string, module: string, targetId: string, details: any) {
    try {
      const user = auth.currentUser;
      
      // Sanitizer to completely remove undefined values
      const sanitize = (obj: any): any => {
        if (obj === null || typeof obj !== 'object') return obj;
        
        const newObj = Array.isArray(obj) ? [] : {};
        
        for (const key in obj) {
          if (obj[key] !== undefined) {
            (newObj as any)[key] = sanitize(obj[key]);
          }
        }
        return newObj;
      };

      const sanitizedDetails = sanitize(details);

      await addDoc(collection(db, 'auditLogs'), {
        userId: user?.uid || 'system',
        userName: user?.email || 'System',
        action,
        module,
        targetId,
        details: sanitizedDetails || {},
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Erro ao registrar log de auditoria:", e);
    }
  },
  
  async listLogs(pageSize = 50) {
    const q = query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(pageSize));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
  }
};
