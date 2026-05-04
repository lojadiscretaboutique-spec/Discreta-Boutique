import axios from 'axios';

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
    const nome = pedido.nome;
    const pid = pedido.id;

    switch (pedido.status) {
        case 'NOVO':
        case 'PENDENTE':
            let agendamento = '';
            if (pedido.scheduledDate) {
                const [year, month, day] = pedido.scheduledDate.split('-');
                const dataFormatada = `${day}/${month}/${year}`;
                agendamento = `*agendado para:* ${dataFormatada}${pedido.scheduledTime ? ` às ${pedido.scheduledTime}` : ''}`;
            }

            return `Olá ${nome}! 💖

Recebemos seu pedido com sucesso ✨!
pedido: #${pid}

${agendamento}. 

Já iniciamos a preparação com todo o cuidado, atenção aos detalhes e total discrição — exatamente como você merece.

Em breve você receberá novas atualizações.

Se precisar de algo, estamos por aqui. 💬`;
        case 'AGUARDANDO_RETIRADA':
        case 'PRONTO':
            return `Olá ${nome}! ✨

Seu pedido #${pid} já está pronto e disponível para retirada 📦

Tudo foi preparado com cuidado e discrição para garantir a melhor experiência possível.

Fique à vontade para retirar no horário combinado.

Será um prazer te atender. 💖`;
        case 'SAIU_PARA_ENTREGA':
            return `Olá ${nome}! 🚚

Seu pedido #${pid} já está a caminho ✨

Preparamos tudo com atenção aos detalhes e ele segue com total discrição até você.

Agora é só aguardar…

Em breve estará em suas mãos. 💖`;
        case 'ENTREGUE':
            return `Olá ${nome}! 💖

Seu pedido #${pid} foi entregue com sucesso ✨

Esperamos que cada detalhe tenha sido exatamente como você imaginou — ou até melhor.

Na Discreta Boutique, acreditamos que experiências especiais começam nos pequenos cuidados… e continuam mesmo após a entrega.

Se quiser explorar novas possibilidades ou precisar de algo, estaremos sempre por aqui — com a mesma atenção e discrição de sempre.

Aproveite seu momento. 💎`;
        default:
            return `Olá ${nome}! O status do seu pedido #${pid} foi atualizado para: ${pedido.status}.`;
    }
}

function formatarTelefone(telefone: string): string {
    if (!telefone) return '';
    let num = telefone.replace(/\D/g, '');
    if (num.startsWith('55')) {
        return num;
    }
    return `55${num}`;
}

export async function sendWebhook(pedido: Pedido) {
    if (!WEBHOOK_URL) {
        console.error("❌ ERRO BOTCONVERSA: Webhook URL não configurada");
        return;
    }

    if (pedido.last_status_sent === pedido.status) {
        console.log(`⚠️ Pedido ${pedido.id} já enviado com status ${pedido.status}. Ignorando.`);
        return;
    }

    const nome = pedido.nome || pedido.customerName || 'Cliente';
    const telefone = pedido.telefone || pedido.customerWhatsapp || '';

    const payload = {
        telefone: formatarTelefone(telefone),
        nome: nome,
        pedido_id: pedido.id,
        status: pedido.status,
        mensagem: gerarMensagem({ ...pedido, nome })
    };

    console.log("🚀 ENVIANDO WEBHOOK", pedido.id, payload);

    try {
        const response = await axios.post(WEBHOOK_URL, payload);
        console.log("📡 STATUS:", response.status);
    } catch (error: any) {
        console.error("❌ ERRO BOTCONVERSA:", error.response?.data || error.message);
    }
}
