import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MEMORY_CACHE = new Map<string, any>();
let hasValidatedThisSession = false;
let isResetting = false;

export const cacheService = {
  /**
   * Valida se a versão do sistema no dispositivo bate com a última cadastrada no servidor.
   * Se houver mudança, limpa o cache de assets de forma segura e atômica
   * e reinicia a aplicação.
   */
  async validateCache() {
    if (hasValidatedThisSession) return;
    hasValidatedThisSession = true;

    try {
      // 1. Lê a última versão e data do Firestore silenciosamente
      const snap = await getDoc(doc(db, 'settings', 'system_status'));
      
      let serverCodeVersion = "1.1.0"; // Versão padrão fallback
      let lastRemoteUpdateTime = 0;

      if (snap.exists()) {
        const data = snap.data();
        serverCodeVersion = data.app_code_version || "1.1.0";
        lastRemoteUpdateTime = data.lastUpdate ? (data.lastUpdate.toMillis ? data.lastUpdate.toMillis() : Date.now()) : Date.now();
      } else {
        // Se o documento não existe ainda, nós o criamos para inicializar o versionamento
        try {
          await setDoc(doc(db, 'settings', 'system_status'), {
            app_code_version: "1.1.0",
            lastUpdate: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("[Cache] Não foi possível inicializar system_status no Firestore", err);
        }
      }

      const cachedCodeVersion = localStorage.getItem('app_code_version');
      const cachedDataVersion = localStorage.getItem('app_data_version');

      // Se não houver versão registrada localmente, inicializa sem recarregar
      if (!cachedCodeVersion) {
        localStorage.setItem('app_code_version', serverCodeVersion);
        localStorage.setItem('app_data_version', String(lastRemoteUpdateTime));
        console.log("[Cache] Inicializando primeira versão do app:", serverCodeVersion);
        return;
      }

      // 2. Se a versão armazenada diferir da versão do servidor
      if (cachedCodeVersion !== serverCodeVersion) {
        const RESET_SESSION_KEY = 'discreta_version_reset_attempted';
        if (!sessionStorage.getItem(RESET_SESSION_KEY)) {
          console.warn(`[Cache] Nova versão detectada (${cachedCodeVersion} -> ${serverCodeVersion}). Iniciando atualização segura...`);
          sessionStorage.setItem(RESET_SESSION_KEY, 'true');
          this.hardReset(serverCodeVersion, String(lastRemoteUpdateTime));
        } else {
          console.warn(`[Cache] Atualização de versão já realizada nesta sessão. Mantendo versão atual.`);
        }
        return;
      }

      // 3. Verificação de atualização dos dados do catálogo
      if (cachedDataVersion && cachedDataVersion !== String(lastRemoteUpdateTime)) {
        console.log(`[Cache] Dados de catálogo atualizados detectados. Limpando cache em memória...`);
        this.clearAll();
        localStorage.setItem('app_data_version', String(lastRemoteUpdateTime));
      }
    } catch (e) {
      console.warn("[Cache] Verificação de versão ignorada por conectividade:", e);
    }
  },

  /**
   * Força uma limpeza atômica dos caches de código/assets no dispositivo,
   * preservando a sessão de autenticação, carrinho e preferências do usuário.
   */
  async hardReset(newVersion: string, newDataTime: string) {
    if (isResetting) {
      console.warn("[Cache] Reset já está em andamento. Ignorando chamada duplicada.");
      return;
    }
    isResetting = true;

    console.log("[Cache] Executando atualização de cache atômica...");

    // 1. Limpa Cache de Memória
    this.clearAll();

    // 2. Atualiza Service Worker se disponível sem desregistrar permanentemente
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          registration.update().catch(() => {});
        }
      } catch (err) {
        console.warn("[Cache] Aviso ao atualizar Service Worker:", err);
      }
    }

    // 3. Limpa CacheStorage (Assets/Chunks PWA antigos)
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      } catch (err) {
        console.error("[Cache] Erro ao limpar CacheStorage:", err);
      }
    }

    // 4. Preserva autenticação do Firebase e preferências essenciais do usuário
    const preservedLocalKeys: Record<string, string | null> = {};
    const preservedSessionKeys: Record<string, string | null> = {};

    // Coleta chaves de localStorage a preservar
    const localKeysToKeep = [
      'discreta-cart',
      'discreta_ref',
      'admin-theme',
      'discreta_active_theme_cache',
      'wifi_lead_name',
      'wifi_lead_phone',
      'wifi_lead_submitted',
      'pending_labels',
      'discreta_financial_banks',
      'discreta_financial_machines',
      'discreta_financial_card_rates',
      'discreta_financial_receivables',
      'discreta_financial_reconciliations',
      'discreta_financial_configs'
    ];

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (localKeysToKeep.includes(k) || k.startsWith('firebase:') || k.startsWith('firebaseAuth:'))) {
        preservedLocalKeys[k] = localStorage.getItem(k);
      }
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('firebase:') || k.startsWith('firebaseAuth:') || k === 'discreta_version_reset_attempted')) {
        preservedSessionKeys[k] = sessionStorage.getItem(k);
      }
    }

    localStorage.clear();
    sessionStorage.clear();

    // Restaura chaves preservadas
    Object.entries(preservedLocalKeys).forEach(([k, v]) => {
      if (v !== null) localStorage.setItem(k, v);
    });
    Object.entries(preservedSessionKeys).forEach(([k, v]) => {
      if (v !== null) sessionStorage.setItem(k, v);
    });

    localStorage.setItem('app_code_version', newVersion);
    localStorage.setItem('app_data_version', newDataTime);

    // 5. Executa reload controlado único
    console.log('[Cache] Limpeza concluída. Executando recarregamento...');
    window.location.reload();
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
   * Notifica de mudanças globais de dados
   */
  async notifyChange() {
    try {
      this.clearAll();
      try {
        await setDoc(doc(db, 'settings', 'system_status'), {
          lastUpdate: serverTimestamp()
        }, { merge: true });
      } catch (docErr) {
        console.warn("[Cache] Não foi possível atualizar settings/system_status no Firestore:", docErr);
      }

      // Auto-regenerate lightweight public home cache in the background
      try {
        const { homeCacheService } = await import('./homeCacheService');
        homeCacheService.regenerateHomeCache().catch(err => {
          console.warn("⚠️ Background Home Cache regeneration:", err);
        });
      } catch (cacheErr) {
        console.warn("⚠️ Failed to import homeCacheService in notifyChange:", cacheErr);
      }
    } catch (e) {
      console.warn("[Cache] Notice on notifyChange:", e);
    }
  },

  /**
   * Atualiza a versão do app pelo administrador para purgar cache de todos os dispositivos ativos
   */
  async updateAppVersion(newVersion: string) {
    try {
      await setDoc(doc(db, 'settings', 'system_status'), {
        app_code_version: newVersion,
        lastUpdate: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("[Cache] Erro ao atualizar versão do app:", e);
      throw e;
    }
  }
};
