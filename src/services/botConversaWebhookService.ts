import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Serviço frontend para interagir com o sistema de Webhooks da BotConversa.
 * Nota: O disparo principal ocorre via Listener no servidor para garantir confiabilidade.
 */
export const botConversaWebhookService = {
  /**
   * Registra uma solicitação de notificação.
   * Na prática, a atualização do campo 'status' no pedido já dispara o webhook via listener.
   * Este método pode ser usado para forçar um reenvio ou notificar eventos manuais.
   */
  async triggerManualNotification(order: any) {
    try {
      console.log(`[WebhookService] Solicitando notificação manual para pedido: ${order.id}`);
      
      // Enviamos para uma rota de API que processa no servidor para evitar exposição de chaves
      const response = await fetch('/api/botconversa/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: order })
      });
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error("Erro ao disparar webhook manual:", error);
      return false;
    }
  },

  /**
   * Adiciona um log diretamente via frontend (útil para auditoria de UI)
   */
  async logFrontendAction(action: string, details: any) {
    try {
      await addDoc(collection(db, 'webhook_logs'), {
        action,
        details,
        source: 'frontend',
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Erro ao logar ação do frontend:", e);
    }
  }
};
