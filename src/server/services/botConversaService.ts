import axios from 'axios';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const WEBHOOK_URL = process.env.BOTCONVERSA_WEBHOOK_URL;

interface Pedido {
    id: string;
    telefone: string;
    nome: string;
    status: string;
    last_status_sent?: string;
    [key: string]: any;
}

function gerarMensagem(pedido: Pedido): string {
    const nome = pedido.nome || 'Cliente';
    const pid = pedido.id ? pedido.id.slice(-6).toUpperCase() : '000000';
    const status = (pedido.status || '').toUpperCase().replace(/\s+/g, '_');

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

            return `Olá ${nome}! 💖\n\nRecebemos seu pedido com sucesso ✨!\npedido: #${pid}\n\n${agendamento}\n\nJá iniciamos a preparação com todo o cuidado, atenção aos detalhes e total discrição — exatamente como você merece.\n\nEm breve você receberá novas atualizações.\n\nSe precisar de algo, estamos por aqui. 💬`;
        
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
            return `Olá ${nome}! 💖\n\nSeu pedido #${pid} foi entregue com sucesso ✨\n\nEsperamos que cada detalhe tenha sido exatamente como você imaginou.\n\nNa Discreta Boutique, acreditamos que experiências especiais começam nos pequenos cuidados…\n\nAproveite seu momento. 💎`;
        
        case 'CANCELADO':
            return `Olá ${nome}! Seu pedido #${pid} foi CANCELADO. ❌\n\nSe houver alguma dúvida ou se quiser realizar uma nova escolha, nossa equipe está à disposição.\n\nAgradecemos o contato.`;
        
        default:
            return `Olá ${nome}! Informamos que o status do seu pedido #${pid} foi atualizado para: *${pedido.status}*. ✨`;
    }
}

function formatarTelefone(telefone: string): string {
    if (!telefone) return '';
    let num = telefone.replace(/\D/g, '');
    
    // Se tiver menos de 10 dígitos, provavelmente está incompleto
    if (num.length < 10) return '';

    // Se já começar com 55 e tiver 12 ou 13 dígitos, mantém
    if (num.startsWith('55') && (num.length === 12 || num.length === 13)) {
        return num;
    }

    // Se tiver 10 ou 11 dígitos (DDD + número), adiciona 55
    if (num.length === 10 || num.length === 11) {
        return `55${num}`;
    }

    return num;
}

export async function sendWebhook(pedido: Pedido, attempts = 1) {
    if (!WEBHOOK_URL) {
        console.error("❌ ERRO BOTCONVERSA: Webhook URL não configurada");
        return;
    }

    const nome = pedido.nome || pedido.customerName || 'Cliente';
    const telefoneBruto = pedido.telefone || pedido.customerWhatsapp || '';
    const telefoneFormatado = formatarTelefone(telefoneBruto);

    if (!telefoneFormatado) {
        console.warn(`⚠️ Pedido ${pedido.id} sem telefone válido (${telefoneBruto}). Pulando webhook.`);
        return;
    }

    const payload = {
        telefone: telefoneFormatado,
        nome: nome,
        pedido_id: pedido.id,
        status: pedido.status,
        mensagem: gerarMensagem({ ...pedido, nome })
    };

    console.log(`🚀 [Attempt ${attempts}] ENVIANDO WEBHOOK`, pedido.id, payload);

    try {
        const response = await axios.post(WEBHOOK_URL, payload, { timeout: 10000 });
        
        // Log Success
        await addDoc(collection(db, 'webhook_logs'), {
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
            attempts: attempts,
            timestamp: serverTimestamp()
        });

        console.log(`✅ WEBHOOK ENVIADO: ${pedido.id} - Status: ${response.status}`);
        return true;
    } catch (error: any) {
        const errorMsg = error.response?.data || error.message;
        console.error(`❌ ERRO WEBHOOK [Attempt ${attempts}]:`, errorMsg);

        // Log Failure
        await addDoc(collection(db, 'webhook_logs'), {
            orderId: pedido.id,
            customerName: nome,
            customerWhatsapp: telefoneFormatado,
            status: pedido.status,
            payload: payload,
            error: JSON.stringify(errorMsg),
            success: false,
            attempts: attempts,
            timestamp: serverTimestamp()
        });

        // Retry logic (max 3 attempts)
        if (attempts < 3) {
            console.log(`🔄 Retrying in 5 seconds... (${attempts + 1}/3)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return sendWebhook(pedido, attempts + 1);
        }
        
        return false;
    }
}

