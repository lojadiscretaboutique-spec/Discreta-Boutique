import axios from 'axios';

const API_KEY = process.env.BOTCONVERSA_API_KEY;

const STATUS_MESSAGES: Record<string, (pedido: any) => string> = {
  novo: (pedido) => `Olá ${pedido.customerName ? pedido.customerName.split(' ')[0] : 'querida cliente'}! Recebemos seu pedido #${pedido.id}. Estamos com todos os detalhes aqui e logo daremos início ao preparo!`,
  novo_pedido: (pedido) => `Olá ${pedido.customerName ? pedido.customerName.split(' ')[0] : 'querida cliente'}! Recebemos seu pedido #${pedido.id}. Estamos conferindo tudo com carinho e logo daremos início ao preparo!`,
  confirmado: (pedido) => `Boa notícia, ${pedido.customerName ? pedido.customerName.split(' ')[0] : 'querida cliente'}! Seu pedido #${pedido.id} foi confirmado. Estamos preparando tudo para você. 💖`,
  em_separacao: (pedido) => `Seu pedido #${pedido.id} está sendo preparado por nossa equipe! 📦 Estamos selecionando cada peça com o cuidado que você merece.`,
  enviado: (pedido) => `Seu pedido #${pedido.id} já está viajando! 🚚 Acompanhe por aqui: ${pedido.trackLink || 'verifique no seu painel do cliente'}. Qualquer dúvida, conte conosco!`,
  saiu_para_entrega: (pedido) => `A espera está acabando! Seu pedido #${pedido.id} saiu para entrega hoje. 🎉 Fique de olho, estamos chegando!`,
  aguardando_retirada: (pedido) => `Seu pedido #${pedido.id} já está pronto para retirada! 🎉 Pode vir buscar quando quiser.`,
  entregue: (pedido) => `Seu pedido #${pedido.id} foi entregue! 🎉 Esperamos que você ame cada detalhe. Ficou com alguma dúvida ou quer compartilhar sua experiência?`
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function sendOrderStatus(contact_id: string, status: string, pedido: any, retries = 3) {
  if (!API_KEY) {
    console.error(`[BotConversa] Falha: Chave de API ausente para pedido ${pedido.id}`);
    return;
  }

  // Validação básica do WhatsApp
  if (!contact_id || contact_id.trim().length < 8) {
    console.error(`[BotConversa] Falha: WhatsApp inválido (${contact_id}) para pedido ${pedido.id}`);
    return;
  }

  const normalizedStatus = status.toLowerCase().replace(/ /g, '_');
  const message = STATUS_MESSAGES[normalizedStatus]?.(pedido);
  if (!message) {
    console.warn(`[BotConversa] Aviso: Nenhuma mensagem definida para status: ${status}`);
    return;
  }

  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[BotConversa] Tentativa ${i + 1}/${retries} para pedido ${pedido.id}, status ${status}`);
      
      const response = await axios.post(
        'https://api.botconversa.com.br/v1/send-message',
        { contact_id, message },
        {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[BotConversa] Sucesso: Pedido ${pedido.id}, status ${status}. Resposta: ${JSON.stringify(response.data)}`);
      return;
    } catch (error: any) {
      console.error(`[BotConversa] Erro na tentativa ${i + 1} para pedido ${pedido.id}: ${error.message}`);
      if (i < retries - 1) await delay(1000 * (i + 1));
      else console.error(`[BotConversa] Falha final após ${retries} tentativas para pedido ${pedido.id}`);
    }
  }
}
