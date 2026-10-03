import { RaffleTicket } from '../types/raffle';

export interface RafflePrintStoreInfo {
  storeName?: string;
  cnpj?: string;
  city?: string;
  instagram?: string;
  whatsapp?: string;
}

export function generateRaffleThermalHTML(
  tickets: RaffleTicket[],
  storeInfo: RafflePrintStoreInfo = {
    storeName: 'DISCRETA BOUTIQUE',
    instagram: '@discretaico',
    city: 'Icó - CE',
  }
): string {
  if (!tickets || tickets.length === 0) return '';

  const renderSingleTicket = (ticket: RaffleTicket, index: number, total: number) => {
    const isMultiple = total > 1;
    const cleanRules = (ticket.rules || '')
      .split('\n')
      .map(r => r.trim())
      .filter(Boolean);

    return `
      <div class="ticket-card" style="page-break-inside: avoid; margin-bottom: 22px;">
        <!-- Cabeçalho da Loja -->
        <div class="text-center">
          <div class="store-name">${storeInfo.storeName || 'DISCRETA BOUTIQUE'}</div>
          <div class="store-sub">MODA ÍNTIMA & BEM-ESTAR</div>
          ${storeInfo.cnpj ? `<div class="store-info">CNPJ: ${storeInfo.cnpj}</div>` : ''}
          ${storeInfo.city ? `<div class="store-info">${storeInfo.city}</div>` : ''}
        </div>

        <div class="double-line"></div>

        <!-- Título do Cupom -->
        <div class="text-center">
          <div class="ticket-badge">*** BILHETE DE SORTEIO ***</div>
          <div class="campaign-title">${ticket.campaignTitle || 'CAMPANHA PROMOCIONAL'}</div>
          ${isMultiple ? `<div class="multi-indicator">CUPOM ${ticket.ticketIndexInSale} DE ${ticket.ticketsTotalInSale} DESTA COMPRA</div>` : ''}
          <div class="ticket-code-box">
            <span class="ticket-code-label">CÓDIGO DO BILHETE</span>
            <span class="ticket-code-val">#${ticket.ticketCode}</span>
          </div>
        </div>

        <div class="dashed-line"></div>

        <!-- Prêmio / O que está sendo sorteado -->
        <div class="prize-section">
          <div class="section-title">O QUE ESTÁ SENDO SORTEADO:</div>
          <div class="prize-content">
            🏆 ${ticket.prize || 'Grande Prêmio Especial'}
          </div>
          ${ticket.drawDate ? `<div class="draw-date">Data do Sorteio: <strong>${ticket.drawDate.split('-').reverse().join('/')}</strong></div>` : ''}
        </div>

        <div class="dashed-line"></div>

        <!-- Dados da Compra -->
        <div class="purchase-box">
          <div class="info-row">
            <span>PEDIDO PDV:</span>
            <span><strong>#${ticket.orderId ? ticket.orderId.slice(-6).toUpperCase() : 'BALCAO'}</strong></span>
          </div>
          <div class="info-row">
            <span>DATA/HORA DA COMPRA:</span>
            <span><strong>${ticket.orderDate}</strong></span>
          </div>
          <div class="info-row highlight-row">
            <span>VALOR DA COMPRA:</span>
            <span><strong>R$ ${Number(ticket.orderTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
          </div>
        </div>

        <div class="dashed-line"></div>

        <!-- Campos para o Cliente Preencher / Confirmar -->
        <div class="client-section">
          <div class="client-box-title">DADOS PARA O SORTEIO / URNA:</div>
          
          <div class="field-item">
            <div class="field-label">NOME COMPLETO:</div>
            ${ticket.customerName ? `
              <div class="field-value-filled">${ticket.customerName.toUpperCase()}</div>
            ` : `
              <div class="field-line"></div>
            `}
          </div>

          <div class="field-item">
            <div class="field-label">WHATSAPP / TELEFONE:</div>
            ${ticket.customerWhatsapp ? `
              <div class="field-value-filled">${ticket.customerWhatsapp}</div>
            ` : `
              <div class="field-line"></div>
            `}
          </div>

          <div class="field-item">
            <div class="field-label">CIDADE / BAIRRO:</div>
            <div class="field-line"></div>
          </div>

          <div class="field-item" style="margin-top: 10px;">
            <div class="field-label">ASSINATURA DO CLIENTE:</div>
            <div class="field-line" style="border-bottom: 1.5px solid #000; margin-top: 18px;"></div>
          </div>
        </div>

        ${cleanRules.length > 0 ? `
          <div class="dashed-line"></div>
          <!-- Regras do Sorteio -->
          <div class="rules-section">
            <div class="section-title">REGRAS DO SORTEIO:</div>
            <ul class="rules-list">
              ${cleanRules.map(r => `<li>${r}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        <div class="cut-indicator">
          <span>- - - - - - - - - - - - - - - - - - - - - - - - - -</span>
          <div class="cut-text">✂ DESTAQUE E DEPOSITE NA URNA ✂</div>
          <span>- - - - - - - - - - - - - - - - - - - - - - - - - -</span>
        </div>

        <div class="footer-notice">
          Boa sorte! Acompanhe o resultado no Instagram:
          <br /><strong>${storeInfo.instagram || '@discretaico'}</strong>
        </div>
      </div>
    `;
  };

  const allTicketsHtml = tickets.map((t, i) => renderSingleTicket(t, i, tickets.length)).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <title>Bilhete de Sorteio - Discreta Boutique</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Courier New', Courier, Monaco, 'Lucida Console', monospace;
          font-size: 11px;
          line-height: 1.28;
          color: #000;
          background: #fff;
          width: 72mm; /* Largura padrão de cabeçote térmico de 80mm para zero cortes */
          max-width: 72mm;
          margin: 0 auto;
          padding: 2mm 1mm 18mm 1mm;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }

        .store-name {
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }
        .store-sub {
          font-size: 8.5px;
          font-weight: 700;
          margin-top: 1px;
          letter-spacing: 0.3px;
        }
        .store-info {
          font-size: 8.5px;
          margin-top: 1px;
        }

        .double-line {
          border-top: 2px solid #000;
          margin: 6px 0;
        }
        .dashed-line {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }

        .ticket-badge {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .campaign-title {
          font-size: 11.5px;
          font-weight: 800;
          margin-top: 2px;
          text-transform: uppercase;
        }
        .multi-indicator {
          font-size: 9.5px;
          font-weight: bold;
          margin-top: 2px;
          background: #000;
          color: #fff;
          padding: 1px 3px;
          display: inline-block;
        }

        .ticket-code-box {
          margin: 6px auto 2px auto;
          border: 1.5px solid #000;
          padding: 4px;
          text-align: center;
          width: 90%;
        }
        .ticket-code-label {
          display: block;
          font-size: 8px;
          font-weight: bold;
          letter-spacing: 1px;
        }
        .ticket-code-val {
          display: block;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .section-title {
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .prize-section {
          padding: 2px 0;
        }
        .prize-content {
          font-size: 12px;
          font-weight: 900;
          line-height: 1.25;
        }
        .draw-date {
          font-size: 9.5px;
          margin-top: 3px;
        }

        .purchase-box {
          font-size: 10px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .highlight-row {
          font-size: 11px;
          margin-top: 3px;
          padding-top: 2px;
          border-top: 1px dotted #000;
        }

        .client-section {
          padding: 2px 0;
        }
        .client-box-title {
          font-size: 9.5px;
          font-weight: 900;
          margin-bottom: 5px;
          text-align: center;
        }
        .field-item {
          margin-bottom: 5px;
        }
        .field-label {
          font-size: 8.5px;
          font-weight: bold;
        }
        .field-line {
          border-bottom: 1px solid #000;
          height: 14px;
          width: 100%;
        }
        .field-value-filled {
          font-size: 11px;
          font-weight: 900;
          border-bottom: 1px solid #000;
          padding-bottom: 1px;
        }

        .rules-section {
          padding: 2px 0;
        }
        .rules-list {
          list-style: none;
          padding-left: 0;
          font-size: 8.5px;
          line-height: 1.25;
        }
        .rules-list li {
          margin-bottom: 2px;
        }

        .cut-indicator {
          text-align: center;
          margin: 10px 0 6px 0;
          font-size: 8px;
          font-weight: bold;
        }
        .cut-text {
          font-size: 9px;
          font-weight: 900;
          margin: 2px 0;
        }

        .footer-notice {
          font-size: 8px;
          text-align: center;
          margin-top: 4px;
        }
      </style>
    </head>
    <body>
      ${allTicketsHtml}
      <!-- Espanço extra de avanço de papel para guilhotina não cortar o último bilhete -->
      <div style="height: 16mm;"></div>
    </body>
    </html>
  `;
}

/**
 * Triggers printing of the raffle tickets via an isolated, hidden iframe.
 * Avoids browser popup blockers and strictly targets thermal 80mm roll setup.
 */
export function printRaffleThermalTickets(
  tickets: RaffleTicket[],
  storeInfo?: RafflePrintStoreInfo
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!tickets || tickets.length === 0) {
      resolve(false);
      return;
    }

    try {
      const existing = document.getElementById('raffle-thermal-print-iframe');
      if (existing) {
        existing.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'raffle-thermal-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const html = generateRaffleThermalHTML(tickets, storeInfo);
      const doc = iframe.contentWindow?.document;

      if (!doc) {
        window.print();
        resolve(true);
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch (e) {
          console.error('Error invoking print inside iframe:', e);
          resolve(false);
        }
      }, 350);
    } catch (err) {
      console.error('Print thermal ticket error:', err);
      resolve(false);
    }
  });
}
