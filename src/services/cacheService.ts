import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MEMORY_CACHE = new Map<string, any>();
let hasValidatedThisSession = false;

export const cacheService = {
  /**
   * Valida se a versão do sistema no dispositivo bate com a última cadastrada no servidor.
   * Se houver mudança, limpa totalmente o cache (localStorage, sessionStorage, caches do navegador e PWA) 
   * e reinicia de forma fluida.
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

      let needsReset = false;

      // Se não houver versão registrada localmente, inicializa ela sem recarregar o app
      if (!cachedCodeVersion) {
        localStorage.setItem('app_code_version', serverCodeVersion);
        localStorage.setItem('app_data_version', String(lastRemoteUpdateTime));
        console.log("[Cache] Inicializando primeira versão do app:", serverCodeVersion);
        return;
      }

      // 2. Se a versão armazenada diferir da versão do servidor, força a limpeza total
      if (cachedCodeVersion !== serverCodeVersion) {
        console.warn(`[Cache] Versão antiga do código detectada (${cachedCodeVersion} vs ${serverCodeVersion}). Iniciando limpeza...`);
        needsReset = true;
      }

      // 3. Verificação de atualização sutil dos dados de catálogo
      if (cachedDataVersion && cachedDataVersion !== String(lastRemoteUpdateTime)) {
        console.log(`[Cache] Dados atualizados detectados. Limpando cache de memória...`);
        this.clearAll();
        localStorage.setItem('app_data_version', String(lastRemoteUpdateTime));
      }

      if (needsReset) {
        this.hardReset(serverCodeVersion, String(lastRemoteUpdateTime));
      }
    } catch (e) {
      console.warn("[Cache] Verificação oculta de versão ignorada por conectividade:", e);
    }
  },

  /**
   * Força uma limpeza robusta de todo vestígio de armazenamento no dispositivo
   * e reinicia limpíssimo, preservando as chaves essenciais do usuário (carrinho, afiliados, preferências).
   */
  async hardReset(newVersion: string, newDataTime: string) {
    console.log("[Cache] Executando Hard Reset para total consistência...");

    // 1. Limpa Cache de Memória
    this.clearAll();

    // 2. Limpa Service Workers
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      } catch (err) {
        console.error("[Cache] Erro ao resolver Service Workers:", err);
      }
    }

    // 3. Limpa CacheStorage (Imagens, Códigos PWA)
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

    // 4. Limpa localStorage e sessionStorage preservando com segurança os dados e carrinho do usuário
    const savedCart = localStorage.getItem('discreta-cart');
    const savedRef = localStorage.getItem('discreta_ref');
    const savedAdminTheme = localStorage.getItem('admin-theme');
    const savedWifiLeadName = localStorage.getItem('wifi_lead_name');
    const savedWifiLeadPhone = localStorage.getItem('wifi_lead_phone');
    const savedWifiLeadSubmitted = localStorage.getItem('wifi_lead_submitted');
    const savedPendingLabels = localStorage.getItem('pending_labels');
    const savedFinancialBanks = localStorage.getItem('discreta_financial_banks');
    const savedFinancialMachines = localStorage.getItem('discreta_financial_machines');
    const savedFinancialRates = localStorage.getItem('discreta_financial_card_rates');
    const savedFinancialReceivables = localStorage.getItem('discreta_financial_receivables');
    const savedFinancialReconciliations = localStorage.getItem('discreta_financial_reconciliations');
    const savedFinancialConfigs = localStorage.getItem('discreta_financial_configs');

    localStorage.clear();
    sessionStorage.clear();

    if (savedCart) localStorage.setItem('discreta-cart', savedCart);
    if (savedRef) localStorage.setItem('discreta_ref', savedRef);
    if (savedAdminTheme) localStorage.setItem('admin-theme', savedAdminTheme);
    if (savedWifiLeadName) localStorage.setItem('wifi_lead_name', savedWifiLeadName);
    if (savedWifiLeadPhone) localStorage.setItem('wifi_lead_phone', savedWifiLeadPhone);
    if (savedWifiLeadSubmitted) localStorage.setItem('wifi_lead_submitted', savedWifiLeadSubmitted);
    if (savedPendingLabels) localStorage.setItem('pending_labels', savedPendingLabels);
    if (savedFinancialBanks) localStorage.setItem('discreta_financial_banks', savedFinancialBanks);
    if (savedFinancialMachines) localStorage.setItem('discreta_financial_machines', savedFinancialMachines);
    if (savedFinancialRates) localStorage.setItem('discreta_financial_card_rates', savedFinancialRates);
    if (savedFinancialReceivables) localStorage.setItem('discreta_financial_receivables', savedFinancialReceivables);
    if (savedFinancialReconciliations) localStorage.setItem('discreta_financial_reconciliations', savedFinancialReconciliations);
    if (savedFinancialConfigs) localStorage.setItem('discreta_financial_configs', savedFinancialConfigs);

    localStorage.setItem('app_code_version', newVersion);
    localStorage.setItem('app_data_version', newDataTime);

    // 5. Reinicia o sistema na raiz como primeira vez
    window.location.replace('/');
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
      await setDoc(doc(db, 'settings', 'system_status'), {
        lastUpdate: serverTimestamp()
      }, { merge: true });

      // Auto-regenerate lightweight public home cache in the background
      try {
        const { homeCacheService } = await import('./homeCacheService');
        homeCacheService.regenerateHomeCache().catch(err => {
          console.error("⚠️ Background Home Cache regeneration failed:", err);
        });
      } catch (cacheErr) {
        console.error("⚠️ Failed to import homeCacheService in notifyChange:", cacheErr);
      }
    } catch (e) {
      console.error("[Cache] Failed to notify change", e);
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
