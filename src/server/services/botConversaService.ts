import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import axios from 'axios';

const WEBHOOK_URL = process.env.BOTCONVERSA_WEBHOOK_URL;

interface Pedido {
    id: string;
    telefone: string;
    nome: string;
    status: string;
    [key: string]: any;
}

const log = (message: string, data?: any) => {
    console.log(`[BotConversaService] ${new Date().toISOString()}: ${message}`, data ? JSON.stringify(data) : '');
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendWithRetry(payload: any, attempt: number = 1): Promise<any> {
    if (!WEBHOOK_URL) {
        log("Erro: BOTCONVERSA_WEBHOOK_URL não configurada");
        throw new Error("BOTCONVERSA_WEBHOOK_URL não configurada");
    }

    try {
        console.log("🚀 DISPARANDO WEBHOOK BOTCONVERSA");
        console.log("📦 PAYLOAD:", payload);
        console.log("🌐 URL:", WEBHOOK_URL);
        
        log(`Tentativa ${attempt} de envio...`);
        const response = await axios.post(WEBHOOK_URL, payload);
        
        console.log("📡 STATUS:", response.status);
        console.log("📨 RESPOSTA:", response.data);
        
        log("Webhook enviado e processado pelo BotConversa", { status: response.status });
        return response;
    } catch (error: any) {
        log(`Tentativa ${attempt} falhou: ${error.message}`);
        if (attempt < 3) {
            await delay(attempt * 2000); 
            return sendWithRetry(payload, attempt + 1);
        }
        log("Erro definitivo após 3 tentativas.", { payload });
        throw error;
    }
}

function gerarTitulo(status: string): string {
    return `Atualização de Pedido: ${status}`;
}

function gerarMensagem(status: string, pedido: Pedido): string {
    switch (status.toUpperCase()) {
        case 'CONFIRMADO':
            return `Olá ${pedido.nome}! Seu pedido #${pedido.id} foi confirmado com sucesso.`;
        case 'ENTREGUE':
            return `Olá ${pedido.nome}! Seu pedido #${pedido.id} já foi entregue.`;
        default:
            return `Olá ${pedido.nome}! O status do seu pedido #${pedido.id} foi atualizado para: ${status}.`;
    }
}

function identificarOrigemEvento(origem: string): string {
    return origem;
}

export async function sendOrderEvent(pedido: Pedido, origem: string) {
    if (!pedido.telefone || pedido.telefone.replace(/\D/g, '').length < 10) {
        log("Telefone inválido, ignorando envio", { pedidoId: pedido.id });
        return;
    }

    const pedidoRef = doc(db, 'orders', pedido.id);
    const pedidoSnap = await getDoc(pedidoRef);
    
    if (!pedidoSnap.exists()) {
        log("Pedido não encontrado no Firestore", { pedidoId: pedido.id });
        return;
    }
    
    const pedidoData = pedidoSnap.data() as any;
    log("Verificando pedido para envio", { 
        pedidoId: pedido.id, 
        statusAtual: pedido.status, 
        ultimoStatusEnviado: pedidoData.ultimo_status_enviado,
        statusComparison: pedidoData.ultimo_status_enviado === pedido.status
    });
    
    // Check duplication
    if (pedidoData.ultimo_status_enviado === pedido.status) {
        log("Status já enviado anteriormente, ignorando", { pedidoId: pedido.id, status: pedido.status });
        return;
    }

    const payload = {
        telefone: pedido.telefone,
        nome: pedido.nome,
        pedido_id: pedido.id,
        status: pedido.status,
        titulo: gerarTitulo(pedido.status),
        mensagem: gerarMensagem(pedido.status, pedido),
        origem: identificarOrigemEvento(origem)
    };
    log("Payload preparado para envio", { payload });

    try {
        await sendWithRetry(payload);
        
        // Update Firestore
        await updateDoc(pedidoRef, {
            ultimo_status_enviado: pedido.status,
            ultimo_envio_timestamp: serverTimestamp()
        });
        
    } catch (error) {
        log("Ocorreu um erro ao enviar e registrar evento no Firestore", { error });
    }
}
