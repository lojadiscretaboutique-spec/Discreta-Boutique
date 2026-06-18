import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp, 
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { auth } from '../lib/auth';
import { printerLogService } from './printerLogService';

export interface PrinterToken {
  id?: string;
  tokenHash: string;
  tokenPreview: string;
  active: boolean;
  used: boolean;
  revoked: boolean;
  createdAt: any;
  expiresAt: any;
  usedAt?: any;
  usedByDeviceId?: string;
  createdBy: string;
}

// Simple SHA-256 browser-friendly hash function
export async function hashToken(token: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const printerTokenService = {
  async generateToken(createdByEmail: string): Promise<{ token: string; id: string }> {
    // Generate secure random values
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    const token = `acp_${hex}`;
    
    const preview = `acp_${hex.substring(0, 4)}...${hex.substring(hex.length - 4)}`;
    const hashed = await hashToken(token);
    
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    
    const docRef = await addDoc(collection(db, 'printerIntegrationTokens'), {
      tokenHash: hashed,
      tokenPreview: preview,
      active: true,
      used: false,
      revoked: false,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expires),
      createdBy: createdByEmail || auth.currentUser?.email || 'Admin'
    });

    // Create a print log
    await printerLogService.createSystemLog(
      'token_created',
      'info',
      `Novo token de integração gerado (${preview}) por ${createdByEmail}`
    );

    return {
      token,
      id: docRef.id
    };
  },

  async listTokens(): Promise<PrinterToken[]> {
    const q = query(
      collection(db, 'printerIntegrationTokens'), 
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        usedAt: data.usedAt
      } as PrinterToken;
    });
  },

  async revokeToken(tokenId: string, tokenPreview: string): Promise<void> {
    const docRef = doc(db, 'printerIntegrationTokens', tokenId);
    await updateDoc(docRef, {
      revoked: true,
      active: false,
      updatedAt: serverTimestamp()
    });

    await printerLogService.createSystemLog(
      'token_revoked',
      'warning',
      `Token de integração ${tokenPreview} revogado pelo administrador`
    );
  }
};
