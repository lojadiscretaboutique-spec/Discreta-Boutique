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
  }
): string {
  if (!tickets || tickets.length === 0) return '';

  const renderSingleTicket = (ticket: RaffleTicket, index: number, total: number) => {
    const isMultiple = total > 1;

    return `
      <div class="ticket-card">
        <!-- Cabeçalho Compacto -->
        <div class="text-center">
          <div class="store-name">${storeInfo.storeName || 'DISCRETA BOUTIQUE'}</div>
          <div class="ticket-badge">*** CUPOM DE SORTEIO ***</div>
          ${ticket.campaignTitle ? `<div class="campaign-name">${ticket.campaignTitle}</div>` : ''}
          ${isMultiple ? `<div class="multi-indicator">CUPOM ${ticket.ticketIndexInSale || (index + 1)} DE ${ticket.ticketsTotalInSale || total}</div>` : ''}
        </div>

        <div class="divider-solid"></div>

        <!-- Número do Cupom em Destaque -->
        <div class="code-container">
          <div class="code-title">NÚMERO DO CUPOM</div>
          <div class="code-value">#${ticket.ticketCode}</div>
        </div>

        <div class="divider-dashed"></div>

        <!-- Data da Compra -->
        <div class="field-row">
          <span class="field-title">DATA DA COMPRA:</span>
          <span class="field-val"><strong>${ticket.orderDate}</strong></span>
        </div>

        <div class="divider-dashed"></div>

        <!-- Dados do Cliente (Preenchido ou Linha para Caneta) -->
        <div class="client-container">
          <div class="field-block">
            <span class="field-title">NOME:</span>
            ${ticket.customerName ? `
              <span class="field-val-filled">${ticket.customerName.toUpperCase()}</span>
            ` : `
              <span class="field-pen-line">___________________________</span>
            `}
          </div>

          <div class="field-block">
            <span class="field-title">WHATSAPP:</span>
            ${ticket.customerWhatsapp ? `
              <span class="field-val-filled">${ticket.customerWhatsapp}</span>
            ` : `
              <span class="field-pen-line">___________________________</span>
            `}
          </div>
        </div>

        <div class="cut-indicator">
          ✂ - - - - - - - - - - - - - - - - - - ✂
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
      <title>Cupom de Sorteio - ${storeInfo.storeName || 'Discreta Boutique'}</title>
      <style>
        @page {
          size: 70mm auto;
          margin: 0mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Courier New', Courier, Monaco, monospace;
          font-size: 11px;
          line-height: 1.3;
          color: #000;
          background: #fff;
          width: 70mm;
          max-width: 70mm;
          margin: 0 auto;
          padding: 2mm 1.5mm 6mm 1.5mm;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }

        .ticket-card {
          page-break-inside: avoid;
          margin-bottom: 12px;
          padding-bottom: 4px;
        }

        .store-name {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.5px;
        }

        .ticket-badge {
          font-size: 11px;
          font-weight: 800;
          margin-top: 1px;
        }

        .campaign-name {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 1px;
        }

        .multi-indicator {
          font-size: 9px;
          font-weight: bold;
          margin-top: 2px;
          background: #000;
          color: #fff;
          padding: 1px 4px;
          display: inline-block;
        }

        .divider-solid {
          border-top: 1.5px solid #000;
          margin: 4px 0;
        }

        .divider-dashed {
          border-top: 1px dashed #000;
          margin: 4px 0;
        }

        .code-container {
          text-align: center;
          padding: 4px 0;
          margin: 2px auto;
          border: 1.5px solid #000;
          width: 96%;
        }

        .code-title {
          font-size: 9px;
          font-weight: bold;
          letter-spacing: 1px;
        }

        .code-value {
          font-size: 17px;
          font-weight: 900;
          letter-spacing: 1.5px;
          line-height: 1.2;
        }

        .field-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          padding: 2px 0;
        }

        .client-container {
          padding: 2px 0;
        }

        .field-block {
          display: flex;
          flex-direction: column;
          margin-bottom: 4px;
        }

        .field-title {
          font-size: 9px;
          font-weight: bold;
        }

        .field-val-filled {
          font-size: 11px;
          font-weight: 900;
          border-bottom: 1px solid #000;
          padding-bottom: 1px;
        }

        .field-pen-line {
          font-size: 11px;
          font-weight: normal;
          letter-spacing: -0.5px;
          overflow: hidden;
          line-height: 1.1;
        }

        .cut-indicator {
          text-align: center;
          font-size: 8px;
          font-weight: bold;
          margin-top: 8px;
          letter-spacing: 0.5px;
        }
      </style>
    </head>
    <body>
      ${allTicketsHtml}
      <div style="height: 8mm;"></div>
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
