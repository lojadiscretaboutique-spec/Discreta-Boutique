import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MEMORY_CACHE = new Map<string, any>();
const APP_CODE_VERSION = "1.0.1"; // Increment this manually when changing critical system code

export const cacheService = {
  /**
   * Valida se o cache ainda é válido comparando versões locais e remotas.
   * Se houver mudança no código ou nos dados (via Firestore), limpa o cache.
   */
  async validateCache() {
    const cachedCodeVersion = localStorage.getItem('app_code_version');
    const cachedDataVersion = localStorage.getItem('app_data_version');
    
    let needsClear = false;

    // 1. Verificação de versão do código (hardcoded)
    if (cachedCodeVersion !== APP_CODE_VERSION) {
      console.log("[Cache] Code version changed. Clearing...");
      needsClear = true;
    }
    
    // 2. Verificação de versão dos dados (Firestore)
    try {
      // Usamos um documento 'system_status' para rastrear a última modificação global de dados
      const snap = await getDoc(doc(db, 'settings', 'system_status'));
      const data = snap.data();
      const remoteVersion = data?.lastUpdate?.toMillis() || 0;
      
      if (cachedDataVersion !== String(remoteVersion)) {
        console.log("[Cache] Data version changed. Clearing...");
        needsClear = true;
        localStorage.setItem('app_data_version', String(remoteVersion));
      }
    } catch (e) {
      console.warn("[Cache] Failed to validate data version from Firestore", e);
    }

    if (needsClear) {
      this.clearAll();
      localStorage.setItem('app_code_version', APP_CODE_VERSION);
    }
  },

  /**
   * Define um valor no cache de memória
   */
  set(key: string, value: any) {
    MEMORY_CACHE.set(key, value);
  },

  /**
   * Obtém um valor do cache de memória
   */
  get(key: string) {
    return MEMORY_CACHE.get(key);
  },

  /**
   * Limpa o cache de memória
   */
  clearAll() {
    MEMORY_CACHE.clear();
  },

  /**
   * Notifica o sistema de que houve uma mudança nos dados.
   * Chamado por funções administrativas para invalidar o cache de todos os clientes.
   */
  async notifyChange() {
    try {
      await setDoc(doc(db, 'settings', 'system_status'), {
        lastUpdate: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("[Cache] Failed to notify change", e);
    }
  }
};
