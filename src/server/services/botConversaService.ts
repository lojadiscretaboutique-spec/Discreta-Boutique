import axios from 'axios';
import { db } from '../../lib/firebase';
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    doc, 
    getDoc 
} from 'firebase/firestore';

// Removing the fixed WEBHOOK_URL to fetch it dynamically
// const WEBHOOK_URL = process.env.BOTCONVERSA_WEBHOOK_URL;

interface Pedido {
    id: string;
    telefone?: string;
    customerWhatsapp?: string;
    nome?: string;
    customerName?: string;
    status: string;
    scheduledDate?: string;
    scheduledTime?: string;
    [key: string]: any;
}

async function getStoreSettings(): Promise<{ webhook: string | null; template: string | null }> {
    try {
        // First try the new unified webhooks settings
        const webhookSnap = await getDoc(doc(db, 'settings', 'webhooks'));
        if (webhookSnap.exists()) {
            const data = webhookSnap.data();
            if (data.statusWebhookUrl) {
                return {
                    webhook: data.statusWebhookUrl,
                    template: data.statusTemplate || null
                };
            }
        }

        // Fallback to old path
        const snap = await getDoc(doc(db, 'settings', 'store'));
        if (snap.exists()) {
            const data = snap.data();
            return {
                webhook: data?.botConversaWebhook || process.env.BOTCONVERSA_WEBHOOK_URL || null,
                template: data?.orderMessageTemplate || null
            };
        }
    } catch (e) {
        console.error("Erro ao buscar configurações da loja no Firestore:", e);
    }
    return {
        webhook: process.env.BOTCONVERSA_WEBHOOK_URL || null,
        template: null
    };
}

function gerarMensagem(pedido: Pedido, customTemplate?: string | null): string {
    const nome = pedido.nome || pedido.customerName || 'Cliente';
    const pid = pedido.id ? pedido.id.slice(-6).toUpperCase() : '000000';
    const statusLabel = pedido.status || 'Pendente';
    const status = statusLabel.toUpperCase().replace(/\s+/g, '_');

    // Se houver um template personalizado, usa ele ignorando o switch
    if (customTemplate) {
        return customTemplate
            .replace(/{nome}/g, nome)
            .replace(/{pedido_id}/g, pid)
            .replace(/{status}/g, statusLabel);
    }

    switch (status) {
        case 'NOVO':
        case 'RECEBIDO':
        case 'PENDENTE':
            let agendamento = '';
            if (pedido.scheduledDate) {
                const [year, month, day] = pedido.scheduledDate.split('-');
                const dataFormatada = `${day}/${month}/${year}`;
                agendamento = `*agendado para:* ${dataFormatada}${pedido.scheduledTime ? ` às ${pedido.scheduledTime}` : ''}`;
            }

            return `Olá ${nome}! 💖\n\nRecebemos seu pedido com sucesso ✨!\nPedido: #${pid}\n\n${agendamento}\n\nJá iniciamos a preparação com todo o cuidado, atenção aos detalhes e total discrição — exatamente como você merece.\n\nEm breve você receberá novas atualizações.\n\nSe precisar de algo, estamos por aqui. 💬`;
        
        case 'PAGO':
        case 'APROVADO':
            return `Olá ${nome}! 💳✨\n\nConfirmamos o pagamento do seu pedido #${pid}.\n\nAgora ele segue para a fase de preparação final e embalagem discreta.\n\nVocê será notificado assim que ele sair para entrega ou estiver pronto para retirada. 💖`;

        case 'PREPARANDO':
            return `Olá ${nome}! ✨\n\nSeu pedido #${pid} está em fase de preparação!\n\nEstamos cuidando de cada detalhe com carinho e total discrição. 💖`;

        case 'AGUARDANDO_RETIRADA':
        case 'PRONTO':
        case 'PRONTO_PARA_RETIRADA':
            return `Olá ${nome}! ✨\n\nSeu pedido #${pid} já está pronto e disponível para retirada 📦\n\nTudo foi preparado com cuidado e discrição.\n\nFique à vontade para retirar no horário combinado. Será um prazer te atender. 💖`;
        
        case 'SAIU_PARA_ENTREGA':
        case 'EM_TRANSPORTE':
            return `Olá ${nome}! 🚚\n\nSeu pedido #${pid} já está a caminho ✨\n\nPreparamos tudo com atenção e ele segue com total discrição até você.\n\nAgora é só aguardar… em breve estará em suas mãos. 💖`;
        
        case 'ENTREGUE':
        case 'FINALIZADO':
            return `Olá ${nome}! 💖\n\nSeu pedido #${pid} foi entregue com sucesso ✨\n\nEsperamos que cada detalhe tenha sido exatamente como você imaginou.\n\nAcredito que experiências especiais começam nos pequenos cuidados… Discreta Boutique. ✨\n\nAproveite seu momento. 💎`;
        
        case 'CANCELADO':
            return `Olá ${nome}! Seu pedido #${pid} foi CANCELADO. ❌\n\nSe houver alguma dúvida ou se quiser realizar uma nova escolha, nossa equipe está à disposição.\n\nAgradecemos o contato.`;
        
        default:
            return `Olá ${nome}! Informamos que o status do seu pedido #${pid} foi atualizado para: *${pedido.status}*. ✨`;
    }
}

function formatarTelefone(telefone: string): string {
    if (!telefone) return '';
    let num = telefone.replace(/\D/g, '');
    
    // Remove leading zeros if present
    num = num.replace(/^0+/, '');

    if (num.length < 10) return '';

    // If starts with 55 and has 12 or 13, it's already properly formatted (DDI + DDD + Number)
    if (num.length === 12 || num.length === 13) {
        return num;
    }

    // Otherwise assume DDD + Number
    return `55${num}`;
}

const logToFirestore = async (data: any) => {
    try {
        await addDoc(collection(db, 'webhook_logs'), {
            ...data,
            timestamp: serverTimestamp()
        });
    } catch (e) {
        console.error("Erro ao salvar log no Firestore (Client SDK):", e);
    }
};

export async function sendWebhook(pedido: Pedido, attempts = 1) {
    const { webhook: webhookUrl, template: customTemplate } = await getStoreSettings();
    
    if (!webhookUrl) {
        console.error("❌ ERRO BOTCONVERSA: Webhook URL não configurada");
        return false;
    }

    const nome = pedido.nome || pedido.customerName || 'Cliente';
    const telefoneBruto = pedido.telefone || pedido.customerWhatsapp || '';
    const telefoneFormatado = formatarTelefone(telefoneBruto);

    if (!telefoneFormatado) {
        console.warn(`⚠️ Pedido ${pedido.id} sem telefone válido (${telefoneBruto}). Pulando webhook.`);
        return false;
    }

    const payload = {
        telefone: telefoneFormatado,
        whatsapp: telefoneFormatado,
        nome: nome,
        status: pedido.status,
        pedido_id: pedido.id,
        order_id: pedido.id, // Keeping for compatibility
        pedido_id_curto: pedido.id ? pedido.id.slice(-6).toUpperCase() : 'N/A',
        data_agendamento: pedido.scheduledDate || '',
        hora_agendamento: pedido.scheduledTime || '',
        mensagem: gerarMensagem({ ...pedido, nome }, customTemplate),
        source: 'DiscretaBoutique_Status_Notification'
    };

    console.log(`🚀 [Attempt ${attempts}] ENVIANDO WEBHOOK`, pedido.id, payload);

    try {
        const response = await axios.post(webhookUrl, payload, { 
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        await logToFirestore({
            orderId: pedido.id,
            customerName: nome,
            customerWhatsapp: telefoneFormatado,
            status: pedido.status,
            payload: payload,
            response: {
                status: response.status,
                data: response.data
            },
            success: true,
            attempts: attempts
        });

        console.log(`✅ WEBHOOK ENVIADO: ${pedido.id} - Status: ${response.status}`);
        return true;
    } catch (error: any) {
        const errorMsg = error.response ? { status: error.response.status, data: error.response.data } : error.message;
        console.error(`❌ ERRO WEBHOOK [Attempt ${attempts}]:`, errorMsg);

        await logToFirestore({
            orderId: pedido.id,
            customerName: nome,
            customerWhatsapp: telefoneFormatado,
            status: pedido.status,
            payload: payload,
            error: JSON.stringify(errorMsg),
            success: false,
            attempts: attempts
        });

        if (attempts < 3) {
            const delay = Math.pow(2, attempts) * 2000; // Exponential backoff: 4s, 8s, 16s...
            console.log(`🔄 Retrying in ${delay/1000} seconds... (${attempts + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendWebhook(pedido, attempts + 1);
        }
        
        return false;
    }
}

