import { lazy, ComponentType } from 'react';

/**
 * Wrapper seguro para React.lazy com recuperação automática de falhas de chunk (PWA / novas versões).
 */
export function safeLazy<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | T | any>,
  moduleName?: string
) {
  return lazy(async () => {
    const key = `discreta_lazy_retry_${moduleName || 'unknown'}`;
    try {
      const res = await factory();
      // Em caso de sucesso, remove a chave de tentativa de recuperação
      sessionStorage.removeItem(key);
      if (res && typeof res === 'object' && 'default' in res) {
        return res as { default: T };
      }
      return { default: res as T };
    } catch (error: any) {
      const isChunkError =
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('failed to load module script') ||
        error?.message?.includes('Loading chunk') ||
        error?.message?.includes('Loading CSS chunk');

      if (isChunkError) {
        const attempted = sessionStorage.getItem(key);
        if (!attempted) {
          sessionStorage.setItem(key, 'true');
          console.warn(`[Discreta SafeLazy] Recurso desatualizado/ausente para (${moduleName}). Recarregando a aplicação...`);
          
          if (typeof caches !== 'undefined') {
            try {
              const cacheKeys = await caches.keys();
              await Promise.all(cacheKeys.map(k => caches.delete(k)));
            } catch (e) {
              // ignora falhas ao limpar cache
            }
          }
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    }
  });
}
