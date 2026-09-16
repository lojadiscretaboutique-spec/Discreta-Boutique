import React, { useEffect, useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  CheckCircle, 
  FileText, 
  Building2, 
  UserCheck, 
  ShieldCheck, 
  Copy, 
  Check, 
  SlidersHorizontal,
  Scissors
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Button } from '../../ui/button';
import { formatCurrency, cn } from '../../../lib/utils';
import { formatCurrencyInWords } from '../../../utils/numberToWordsPtBr';
import { FinancialTransaction } from '../../../services/financialService';
import { printerSettingsService } from '../../../services/printerSettingsService';

interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FinancialTransaction | null;
}

interface StoreData {
  storeName?: string;
  address?: string;
  whatsapp?: string;
  instagram?: string;
  cnpj?: string;
}

export function PaymentReceiptModal({ isOpen, onClose, transaction }: PaymentReceiptModalProps) {
  const [storeData, setStoreData] = useState<StoreData>({
    storeName: 'Discreta Boutique',
    address: 'Av. Principal, São Paulo - SP',
    whatsapp: '',
    cnpj: ''
  });

  // Opções de Impressão Inteligentes
  const [paperFormat, setPaperFormat] = useState<'80mm' | '58mm' | 'a4'>('80mm');
  const [copiesCount, setCopiesCount] = useState<1 | 2>(1); // 1 = Via Única, 2 = Empresa + Colaborador
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    async function loadConfig() {
      try {
        // Carrega dados da loja
        const storeSnap = await getDoc(doc(db, 'settings', 'store'));
        if (storeSnap.exists()) {
          const data = storeSnap.data();
          setStoreData(prev => ({
            ...prev,
            storeName: data.storeName || 'Discreta Boutique',
            address: data.address || prev.address,
            whatsapp: data.whatsapp || '',
            cnpj: data.cnpj || ''
          }));
        }

        // Carrega configuração de impressora padrão do sistema se existir
        const printSettings = await printerSettingsService.getSettings();
        if (printSettings && printSettings.paperWidth) {
          setPaperFormat(printSettings.paperWidth === '58mm' ? '58mm' : '80mm');
        }
      } catch (err) {
        console.warn('Erro ao carregar configurações para o recibo:', err);
      }
    }

    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  if (!isOpen || !transaction) return null;

  const isSalary = transaction.category?.toLowerCase().includes('salár') || 
                  transaction.category?.toLowerCase().includes('salar') ||
                  Boolean(transaction.salaryDetails);

  const salaryDetails = transaction.salaryDetails || {};
  const collaboratorName = salaryDetails.collaboratorName || transaction.contact || 'Colaborador(a) / Favorecido(a)';
  const collaboratorCpf = salaryDetails.collaboratorCpf || transaction.documentNumber || 'Não informado';
  const collaboratorRole = salaryDetails.collaboratorRole || 'Colaborador(a)';
  const paymentTypeLabel = salaryDetails.paymentTypeLabel || 
    (salaryDetails.paymentType === 'quinzena' ? 'Adiantamento Salarial (1ª Quinzena)' : 
     salaryDetails.paymentType === 'saldo' ? 'Saldo de Salário (2ª Quinzena)' : 
     salaryDetails.paymentType === 'pro_labore' ? 'Pró-Labore' : 
     salaryDetails.paymentType === 'comissao' ? 'Comissões de Vendas' : 'Salário Mensal');

  // Competência formatada
  const formatCompetence = (rawComp?: string) => {
    if (!rawComp) {
      const dateRef = transaction.paymentDate || transaction.dueDate || '';
      if (dateRef.includes('-')) {
        const [yyyy, mm] = dateRef.split('-');
        return `${mm}/${yyyy}`;
      }
      return 'Competência Atual';
    }
    if (rawComp.includes('-')) {
      const [yyyy, mm] = rawComp.split('-');
      return `${mm}/${yyyy}`;
    }
    return rawComp;
  };

  const competence = formatCompetence(salaryDetails.referenceMonth);

  // Data do pagamento formatada
  const paymentDateFormatted = (() => {
    const raw = transaction.paymentDate || transaction.dueDate;
    if (!raw) return new Date().toLocaleDateString('pt-BR');
    if (raw.includes('-')) {
      return raw.split('-').reverse().join('/');
    }
    return raw;
  })();

  const receiptNumber = transaction.id ? transaction.id.replace('FIN_', '').toUpperCase() : String(Date.now()).slice(-8);

  const amount = transaction.amount || 0;
  const amountInWords = formatCurrencyInWords(amount);

  // Proventos e Descontos
  const grossAmount = salaryDetails.grossAmount && salaryDetails.grossAmount > 0 
    ? salaryDetails.grossAmount 
    : amount;
  const deductions = salaryDetails.deductions || 0;
  const netAmount = salaryDetails.netAmount || amount;

  // Texto legal padrão de quitação (CLT Artigo 464)
  const defaultLegalNotice = salaryDetails.legalNotice || (
    isSalary 
      ? `Declaro para os devidos fins legais, em conformidade com o Artigo 464 da CLT (Consolidação das Leis do Trabalho), ter recebido da empresa empregadora ${storeData.storeName || 'Discreta Boutique'} a importância líquida supra discriminada de ${formatCurrency(netAmount)} (${amountInWords}), referente ao pagamento de ${paymentTypeLabel} relativo à competência de ${competence}, conferido e achado exato, pelo que firmo o presente dando plena, geral e rasa quitação dos referidos valores.`
      : `Recebi(emos) de ${storeData.storeName || 'Discreta Boutique'} a importância líquida supra discriminada de ${formatCurrency(amount)} (${amountInWords}), referente a ${transaction.description || 'quitação de obrigações/serviços'}, dando plena, geral e rasa quitação pelo valor recebido.`
  );

  // GERAÇÃO DO DOCUMENTO HTML PARA IMPRESSÃO ISOLADA
  const generatePrintHTML = () => {
    const is80 = paperFormat === '80mm';
    const is58 = paperFormat === '58mm';
    const isA4 = paperFormat === 'a4';

    // Largura útil para não cortar no cabeçote térmico
    const printableWidth = is58 ? '48mm' : is80 ? '72mm' : '180mm';
    const baseFontSize = is58 ? '9.5px' : is80 ? '11px' : '12.5px';
    const titleFontSize = is58 ? '11px' : is80 ? '13px' : '16px';
    const headerFontSize = is58 ? '12px' : is80 ? '14px' : '18px';

    const renderSingleReceiptBody = (viaLabel: string) => `
      <div class="receipt-container" style="page-break-inside: avoid; margin-bottom: 25px;">
        <!-- Cabeçalho -->
        <div class="text-center">
          <div class="store-name">${storeData.storeName || 'DISCRETA BOUTIQUE'}</div>
          ${storeData.cnpj ? `<div class="store-info">CNPJ: ${storeData.cnpj}</div>` : ''}
          ${storeData.address ? `<div class="store-info">${storeData.address}</div>` : ''}
          ${storeData.whatsapp ? `<div class="store-info">Contato: ${storeData.whatsapp}</div>` : ''}
        </div>

        <div class="double-line"></div>

        <!-- Título do Recibo -->
        <div class="text-center">
          <div class="receipt-title">
            ${isSalary ? 'RECIBO DE PAGAMENTO DE SALÁRIO' : 'COMPROVANTE DE PAGAMENTO'}
          </div>
          ${isSalary ? '<div class="legal-badge">ART. 464 CLT - COMPROVAÇÃO FORMAL</div>' : ''}
          <div class="info-row" style="margin-top: 4px;">
            <span>DOC: <strong>#${receiptNumber}</strong></span>
            <span>DATA: <strong>${paymentDateFormatted}</strong></span>
          </div>
          <div class="via-tag">${viaLabel}</div>
        </div>

        <div class="dashed-line"></div>

        <!-- Favorecido / Colaborador -->
        <div class="section-title">FAVORECIDO / BENEFICIÁRIO:</div>
        <div class="info-block">
          <div class="strong-text">${collaboratorName}</div>
          <div class="info-row">
            <span>CPF:</span>
            <span class="font-mono"><strong>${collaboratorCpf}</strong></span>
          </div>
          ${isSalary ? `
            <div class="info-row">
              <span>CARGO:</span>
              <span>${collaboratorRole}</span>
            </div>
            <div class="info-row">
              <span>COMPETÊNCIA:</span>
              <span><strong>${competence}</strong></span>
            </div>
            <div class="info-row">
              <span>TIPO:</span>
              <span><strong>${paymentTypeLabel}</strong></span>
            </div>
          ` : ''}
          <div class="info-row">
            <span>FORMA PGTO:</span>
            <span>${transaction.paymentMethod || 'Transferência / PIX / Dinheiro'}</span>
          </div>
          <div class="info-row">
            <span>SITUAÇÃO:</span>
            <span><strong>${transaction.status === 'paid' ? 'PAGO / QUITADO' : 'PENDENTE'}</strong></span>
          </div>
        </div>

        <div class="dashed-line"></div>

        <!-- Discriminação de Valores -->
        ${isSalary && (grossAmount !== netAmount || deductions > 0) ? `
          <div class="section-title">DISCRIMINAÇÃO DAS VERBAS:</div>
          <div class="info-row">
            <span>Salário Bruto / Proventos:</span>
            <span>${formatCurrency(grossAmount)}</span>
          </div>
          ${deductions > 0 ? `
            <div class="info-row" style="color: #000;">
              <span>(-) Descontos Legais / Vales:</span>
              <span>- ${formatCurrency(deductions)}</span>
            </div>
          ` : ''}
          <div class="solid-line"></div>
        ` : ''}

        <!-- Total Líquido em Destaque Térmico -->
        <div class="total-box">
          <div class="total-label">VALOR LÍQUIDO PAGO</div>
          <div class="total-value">${formatCurrency(netAmount)}</div>
        </div>

        <div class="amount-in-words">
          <strong>VALOR POR EXTENSO:</strong> ${amountInWords}.
        </div>

        ${(!isSalary || transaction.description) ? `
          <div class="dashed-line"></div>
          <div style="font-size: 10px; margin: 3px 0;">
            <strong>DESCRIÇÃO:</strong> ${transaction.description || ''}
            ${transaction.notes ? `<br><em>Obs: ${transaction.notes}</em>` : ''}
          </div>
        ` : ''}

        <div class="dashed-line"></div>

        <!-- Termo de Quitação CLT Art. 464 -->
        <div class="section-title">DECLARAÇÃO E TERMO DE QUITAÇÃO:</div>
        <div class="legal-text">
          ${defaultLegalNotice}
        </div>

        <div class="location-date">
          São Paulo - SP, ${paymentDateFormatted}.
        </div>

        <div class="solid-line"></div>

        <!-- Assinaturas Verticais (Específicas para Bobina Térmica 80mm/58mm) -->
        <div class="signatures-wrapper">
          <!-- Assinatura do Favorecido -->
          <div class="signature-item">
            <div class="signature-line"></div>
            <div class="sign-name">${collaboratorName}</div>
            <div class="sign-doc">CPF: ${collaboratorCpf}</div>
            <div class="sign-role">${isSalary ? 'Assinatura do(a) Empregado(a)' : 'Assinatura do(a) Recebedor(a)'}</div>
          </div>

          <!-- Assinatura da Empresa -->
          <div class="signature-item" style="margin-top: 18px;">
            <div class="signature-line"></div>
            <div class="sign-name">${storeData.storeName || 'DISCRETA BOUTIQUE'}</div>
            <div class="sign-doc">${storeData.cnpj ? `CNPJ: ${storeData.cnpj}` : 'Setor Financeiro / RH'}</div>
            <div class="sign-role">Empregador / Responsável Financeiro</div>
          </div>
        </div>

        <div class="footer-note">
          Autenticação: FIN-${receiptNumber}-${Date.now().toString().slice(-4)} • Sistema Discreta Boutique
        </div>
      </div>
    `;

    let allReceiptsHtml = renderSingleReceiptBody(
      copiesCount === 2 ? '1ª VIA - EMPRESA / ARQUIVO CONTÁBIL' : 'VIA ÚNICA - COMPROVANTE'
    );

    if (copiesCount === 2) {
      allReceiptsHtml += `
        <div class="cut-indicator">
          <span>- - - - - - - - - - - - - - - - - - - - - - - - - - - - -</span>
          <div class="cut-text">✂ DESTAQUE AQUI (2ª VIA DO COLABORADOR) ✂</div>
          <span>- - - - - - - - - - - - - - - - - - - - - - - - - - - - -</span>
        </div>
        ${renderSingleReceiptBody('2ª VIA - COLABORADOR / BENEFICIÁRIO')}
      `;
    }

    return `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Recibo de Pagamento - #${receiptNumber}</title>
        <style>
          @page {
            size: ${isA4 ? 'A4 portrait' : `${paperFormat} auto`};
            margin: ${isA4 ? '10mm' : '0mm'};
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, Monaco, 'Lucida Console', monospace;
            font-size: ${baseFontSize};
            line-height: 1.28;
            color: #000;
            background: #fff;
            width: ${printableWidth};
            max-width: ${printableWidth};
            margin: 0 auto;
            padding: ${isA4 ? '5mm' : '3mm 2mm 18mm 2mm'}; /* Espaço no final para a guilhotina da impressora não cortar o texto */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-mono { font-family: monospace; }

          .store-name {
            font-size: ${headerFontSize};
            font-weight: 900;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
          }
          .store-info {
            font-size: ${is58 ? '8.5px' : '9.5px'};
            line-height: 1.2;
          }
          .receipt-title {
            font-size: ${titleFontSize};
            font-weight: 900;
            margin-top: 4px;
            letter-spacing: 0.3px;
          }
          .legal-badge {
            font-size: ${is58 ? '8px' : '9px'};
            font-weight: bold;
            margin-top: 2px;
            border: 1px solid #000;
            display: inline-block;
            padding: 1px 4px;
            border-radius: 2px;
          }
          .via-tag {
            font-size: 8.5px;
            font-weight: bold;
            margin-top: 3px;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }

          .double-line {
            border-top: 2px double #000;
            margin: 5px 0;
          }
          .dashed-line {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .solid-line {
            border-top: 1px solid #000;
            margin: 6px 0;
          }

          .info-row {
            display: flex;
            justify-content: space-between;
            font-size: ${baseFontSize};
            margin-bottom: 2px;
          }
          .section-title {
            font-size: ${is58 ? '9px' : '10px'};
            font-weight: 900;
            margin-bottom: 3px;
            text-transform: uppercase;
          }
          .strong-text {
            font-size: ${is58 ? '10px' : '11.5px'};
            font-weight: 900;
            margin-bottom: 2px;
          }
          .info-block {
            margin-bottom: 3px;
          }

          .total-box {
            border: 2px solid #000;
            padding: 5px 4px;
            text-align: center;
            margin: 6px 0;
            background: #fff;
          }
          .total-label {
            font-size: ${is58 ? '8.5px' : '9.5px'};
            font-weight: 900;
            letter-spacing: 0.5px;
          }
          .total-value {
            font-size: ${is58 ? '14px' : '17px'};
            font-weight: 900;
            letter-spacing: -0.3px;
          }
          .amount-in-words {
            font-size: ${is58 ? '8.5px' : '9.5px'};
            margin: 4px 0;
            line-height: 1.25;
            text-align: justify;
          }

          .legal-text {
            font-size: ${is58 ? '8px' : '9px'};
            line-height: 1.25;
            text-align: justify;
            margin: 4px 0;
          }
          .location-date {
            text-align: right;
            font-size: ${is58 ? '8.5px' : '9.5px'};
            font-weight: bold;
            margin-top: 5px;
            margin-bottom: 6px;
          }

          .signatures-wrapper {
            margin-top: 16px;
            margin-bottom: 8px;
          }
          .signature-item {
            text-align: center;
            margin-bottom: 12px;
          }
          .signature-line {
            border-top: 1.5px solid #000;
            width: 88%;
            margin: 0 auto 3px auto;
          }
          .sign-name {
            font-size: ${is58 ? '9px' : '10.5px'};
            font-weight: 900;
            text-transform: uppercase;
          }
          .sign-doc {
            font-size: ${is58 ? '8px' : '9px'};
          }
          .sign-role {
            font-size: ${is58 ? '7.5px' : '8.5px'};
            text-transform: uppercase;
            letter-spacing: 0.2px;
          }

          .footer-note {
            font-size: 7.5px;
            text-align: center;
            opacity: 0.85;
            margin-top: 10px;
            border-top: 1px dotted #666;
            padding-top: 3px;
          }

          .cut-indicator {
            text-align: center;
            margin: 20px 0;
            font-size: 9px;
            font-weight: bold;
            letter-spacing: 0.5px;
          }
          .cut-text {
            margin: 2px 0;
          }
        </style>
      </head>
      <body>
        ${allReceiptsHtml}
        <!-- Espaço em branco no final para o avanço da bobina térmica antes do corte -->
        <div style="height: 15mm;"></div>
      </body>
      </html>
    `;
  };

  // Disparo de impressão limpa e isolada via iframe oculto (padrão de PDV / ERP)
  const handlePrint = () => {
    setIsPrinting(true);

    try {
      // Remove iframe anterior se existir
      const existingIframe = document.getElementById('receipt-thermal-print-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'receipt-thermal-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const content = generatePrintHTML();
      const iframeDoc = iframe.contentWindow?.document;

      if (!iframeDoc) {
        window.print();
        setIsPrinting(false);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(content);
      iframeDoc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setIsPrinting(false);

        // Remove após a conclusão
        setTimeout(() => {
          iframe.remove();
        }, 2000);
      }, 300);
    } catch (err) {
      console.error('Erro na impressão térmica isolada:', err);
      window.print();
      setIsPrinting(false);
    }
  };

  // Copia comprovante como texto puro formatado (perfeito para WhatsApp ou e-mail)
  const handleCopyPlainText = () => {
    const divider = '==========================================';
    const subDivider = '------------------------------------------';

    let txt = '';
    txt += `${storeData.storeName || 'DISCRETA BOUTIQUE'}\n`;
    if (storeData.cnpj) txt += `CNPJ: ${storeData.cnpj}\n`;
    if (storeData.address) txt += `${storeData.address}\n`;
    txt += `${divider}\n`;
    txt += `${isSalary ? 'RECIBO DE PAGAMENTO DE SALÁRIO' : 'COMPROVANTE DE PAGAMENTO'}\n`;
    if (isSalary) txt += `(Art. 464 CLT - Quitação Trabalhista)\n`;
    txt += `Nº: ${receiptNumber} | Data: ${paymentDateFormatted}\n`;
    txt += `${subDivider}\n`;
    txt += `BENEFICIÁRIO: ${collaboratorName}\n`;
    txt += `CPF: ${collaboratorCpf}\n`;
    if (isSalary) {
      txt += `CARGO: ${collaboratorRole}\n`;
      txt += `COMPETÊNCIA: ${competence}\n`;
      txt += `TIPO: ${paymentTypeLabel}\n`;
    }
    txt += `FORMA PGTO: ${transaction.paymentMethod || 'PIX / Transferência'}\n`;
    txt += `${subDivider}\n`;
    if (isSalary && (grossAmount !== netAmount || deductions > 0)) {
      txt += `Salário Bruto: ${formatCurrency(grossAmount)}\n`;
      if (deductions > 0) txt += `(-) Descontos: -${formatCurrency(deductions)}\n`;
      txt += `${subDivider}\n`;
    }
    txt += `VALOR LÍQUIDO PAGO: ${formatCurrency(netAmount)}\n`;
    txt += `EXTENSO: ${amountInWords}\n`;
    txt += `${subDivider}\n`;
    txt += `TERMO DE QUITAÇÃO:\n${defaultLegalNotice}\n`;
    txt += `${subDivider}\n`;
    txt += `São Paulo - SP, ${paymentDateFormatted}\n\n`;
    txt += `__________________________________________\n`;
    txt += `${collaboratorName} (Assinatura)\n\n`;
    txt += `__________________________________________\n`;
    txt += `${storeData.storeName || 'Discreta Boutique'} (Empregador)\n`;
    txt += `${divider}\n`;

    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header do Modal */}
        <div className="p-4 border-b border-slate-700 bg-slate-900/90 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-white sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
              <Printer size={22} className="text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base sm:text-lg text-white">
                  {isSalary ? 'Recibo Salarial Térmico (Art. 464 CLT)' : 'Recibo de Pagamento Térmico'}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  80mm Bobina
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Formatado especificamente para impressora térmica de 80mm com avanço de bobina e assinaturas verticais
              </p>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyPlainText}
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs flex items-center gap-1.5"
              title="Copiar texto puro para WhatsApp ou e-mail"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Copiado!' : 'Copiar Texto'}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-2 px-4 shadow-lg shadow-blue-600/30"
            >
              <Printer size={16} />
              {isPrinting ? 'Preparando...' : `Imprimir ${paperFormat.toUpperCase()}`}
            </Button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Ajuste de Formato e Vias */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-slate-400 flex items-center gap-1.5 font-semibold">
              <SlidersHorizontal size={14} className="text-blue-400" />
              Tipo de Impressão:
            </span>

            {/* Seletor de Largura da Bobina */}
            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setPaperFormat('80mm')}
                className={cn(
                  "px-3 py-1 rounded-md font-bold transition-all text-xs",
                  paperFormat === '80mm'
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Térmica 80mm (Padrão)
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('58mm')}
                className={cn(
                  "px-3 py-1 rounded-md font-bold transition-all text-xs",
                  paperFormat === '58mm'
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Térmica 58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('a4')}
                className={cn(
                  "px-3 py-1 rounded-md font-bold transition-all text-xs",
                  paperFormat === 'a4'
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Folha A4
              </button>
            </div>

            {/* Seletor de Vias */}
            <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-700">
              <button
                type="button"
                onClick={() => setCopiesCount(1)}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold transition-all text-xs",
                  copiesCount === 1
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                Via Única
              </button>
              <button
                type="button"
                onClick={() => setCopiesCount(2)}
                className={cn(
                  "px-3 py-1 rounded-md font-semibold transition-all text-xs flex items-center gap-1",
                  copiesCount === 2
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                )}
                title="Imprime a 1ª Via para a Empresa e a 2ª Via para o Empregado"
              >
                <Scissors size={12} />
                2 Vias (Empresa + Colab.)
              </button>
            </div>
          </div>

          <div className="text-slate-500 text-[11px] hidden md:block">
            Largura útil ajustada: <span className="text-slate-300 font-mono font-bold">{paperFormat === '58mm' ? '48mm' : paperFormat === '80mm' ? '72mm' : '180mm'}</span> (anti-corte de margem)
          </div>
        </div>

        {/* Visualização da Bobina Térmica (Preview fiel em tela) */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950 flex flex-col items-center justify-start flex-1 min-h-[400px]">
          <div className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Pré-visualização fiel da fita térmica de {paperFormat.toUpperCase()}
          </div>

          {/* Envelope visual da Fita de Cupom Térmico */}
          <div 
            className={cn(
              "bg-white text-black shadow-2xl border border-slate-300 rounded-sm font-mono text-[11px] leading-[1.28] transition-all p-4 select-text relative",
              paperFormat === '58mm' ? "w-[260px] text-[10px]" : paperFormat === '80mm' ? "w-[340px] text-[11px]" : "w-full max-w-xl font-sans"
            )}
            style={{
              boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 0, 0, 0.05)'
            }}
          >
            {/* Topo Serrilhado / Fita */}
            <div className="border-b-2 border-dashed border-slate-300 -mt-2 pb-2 mb-3 text-center text-[9px] text-slate-400 uppercase tracking-widest">
              --- FITA TÉRMICA DE CONTROLE ---
            </div>

            {/* 1ª Via */}
            <div>
              {/* Header */}
              <div className="text-center">
                <div className="font-black text-sm uppercase tracking-wide text-black">
                  {storeData.storeName || 'DISCRETA BOUTIQUE'}
                </div>
                {storeData.cnpj && <div className="text-[10px]">CNPJ: {storeData.cnpj}</div>}
                {storeData.address && <div className="text-[9.5px]">{storeData.address}</div>}
                {storeData.whatsapp && <div className="text-[9.5px]">Contato: {storeData.whatsapp}</div>}
              </div>

              <div className="border-t-2 border-black my-2 border-double"></div>

              {/* Título */}
              <div className="text-center my-1">
                <div className="font-black text-xs uppercase tracking-wider text-black">
                  {isSalary ? 'RECIBO DE PAGAMENTO DE SALÁRIO' : 'COMPROVANTE DE PAGAMENTO'}
                </div>
                {isSalary && (
                  <div className="text-[9px] font-bold border border-black inline-block px-1.5 py-0.5 rounded mt-0.5">
                    ART. 464 CLT - QUITAÇÃO FORMAL
                  </div>
                )}
                <div className="flex justify-between text-[10px] mt-1 font-bold">
                  <span>DOC: #{receiptNumber}</span>
                  <span>DATA: {paymentDateFormatted}</span>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider mt-0.5 text-slate-700">
                  {copiesCount === 2 ? '1ª VIA - EMPRESA / ARQUIVO' : 'VIA ÚNICA'}
                </div>
              </div>

              <div className="border-t border-dashed border-black my-2"></div>

              {/* Dados do Colaborador / Favorecido */}
              <div className="space-y-0.5 text-[10.5px]">
                <div className="text-[9px] font-black uppercase text-slate-800">
                  {isSalary ? 'DADOS DO(A) COLABORADOR(A):' : 'BENEFICIÁRIO / CONTATO:'}
                </div>
                <div className="font-black text-xs text-black">{collaboratorName}</div>
                <div className="flex justify-between">
                  <span>CPF:</span>
                  <span className="font-bold">{collaboratorCpf}</span>
                </div>

                {isSalary && (
                  <>
                    <div className="flex justify-between">
                      <span>Cargo/Função:</span>
                      <span>{collaboratorRole}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Competência:</span>
                      <span className="font-bold">{competence}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tipo Remuneração:</span>
                      <span className="font-bold">{paymentTypeLabel}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between">
                  <span>Forma Pgto:</span>
                  <span>{transaction.paymentMethod || 'PIX / Transferência'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Situação:</span>
                  <span className="font-bold">{transaction.status === 'paid' ? 'PAGO / QUITADO' : 'PENDENTE'}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-black my-2"></div>

              {/* Discriminação de Verbas */}
              {isSalary && (grossAmount !== netAmount || deductions > 0) && (
                <div className="space-y-0.5 text-[10px] mb-2">
                  <div className="text-[9px] font-black uppercase text-slate-800">DISCRIMINAÇÃO:</div>
                  <div className="flex justify-between">
                    <span>Salário Bruto:</span>
                    <span>{formatCurrency(grossAmount)}</span>
                  </div>
                  {deductions > 0 && (
                    <div className="flex justify-between font-bold">
                      <span>(-) Descontos / Vales:</span>
                      <span>- {formatCurrency(deductions)}</span>
                    </div>
                  )}
                  <div className="border-t border-black my-1"></div>
                </div>
              )}

              {/* Caixa Destaque de Valor */}
              <div className="border-2 border-black p-2 text-center my-2 bg-slate-50">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-700">
                  VALOR LÍQUIDO PAGO
                </div>
                <div className="text-base sm:text-lg font-black text-black">
                  {formatCurrency(netAmount)}
                </div>
              </div>

              <div className="text-[9.5px] leading-tight text-justify my-1">
                <strong>VALOR POR EXTENSO:</strong> {amountInWords}.
              </div>

              {(!isSalary || transaction.description) && (
                <div className="text-[9.5px] mt-1 pt-1 border-t border-dotted border-slate-400">
                  <strong>DESCRIÇÃO:</strong> {transaction.description}
                  {transaction.notes && <div className="italic text-[9px]">Obs: {transaction.notes}</div>}
                </div>
              )}

              <div className="border-t border-dashed border-black my-2"></div>

              {/* Termo Legal CLT Art. 464 */}
              <div className="text-[9px] leading-relaxed text-justify my-1">
                <div className="font-bold uppercase text-[8.5px] mb-0.5">DECLARAÇÃO E TERMO DE QUITAÇÃO:</div>
                {defaultLegalNotice}
              </div>

              <div className="text-right font-bold text-[9.5px] my-2">
                São Paulo - SP, {paymentDateFormatted}.
              </div>

              <div className="border-t border-black my-2"></div>

              {/* Assinaturas Verticais */}
              <div className="space-y-4 my-3 text-center">
                <div>
                  <div className="w-[85%] border-b border-black mx-auto mb-1"></div>
                  <div className="font-bold text-[10px] uppercase text-black">{collaboratorName}</div>
                  <div className="text-[9px] text-slate-700">CPF: {collaboratorCpf}</div>
                  <div className="text-[8.5px] text-slate-600 uppercase font-semibold">
                    {isSalary ? 'Assinatura do(a) Empregado(a)' : 'Assinatura do(a) Favorecido(a)'}
                  </div>
                </div>

                <div>
                  <div className="w-[85%] border-b border-black mx-auto mb-1"></div>
                  <div className="font-bold text-[10px] uppercase text-black">
                    {storeData.storeName || 'DISCRETA BOUTIQUE'}
                  </div>
                  <div className="text-[9px] text-slate-700">
                    {storeData.cnpj ? `CNPJ: ${storeData.cnpj}` : 'Setor Financeiro'}
                  </div>
                  <div className="text-[8.5px] text-slate-600 uppercase font-semibold">
                    Empregador / Responsável Pagador
                  </div>
                </div>
              </div>

              <div className="text-[8px] text-center text-slate-500 pt-1 border-t border-dotted border-slate-400">
                Autenticação: FIN-{receiptNumber} • Sistema de Gestão Discreta Boutique
              </div>
            </div>

            {/* 2ª Via Se selecionada */}
            {copiesCount === 2 && (
              <div className="mt-4 pt-3 border-t-2 border-dashed border-black">
                <div className="text-center text-[9px] font-bold my-2 text-slate-600">
                  ✂ CORTE AQUI - 2ª VIA DO COLABORADOR ✂
                </div>
                <div className="text-center text-[10px] font-bold uppercase text-slate-700">
                  (Mesmo teor do documento original impresso para o colaborador)
                </div>
              </div>
            )}

            {/* Margem inferior de corte visual */}
            <div className="border-b-2 border-dashed border-slate-300 mt-4 pt-2 text-center text-[9px] text-slate-400 uppercase tracking-widest">
              --- AVANÇO DE BOBINA / CORTE ---
            </div>
          </div>
        </div>

        {/* Footer do Modal */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle size={15} className="text-emerald-400" />
            <span>
              Imprime sem margens externas e sem cabeçalhos do navegador, calibrado para papel contínuo.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Fechar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 px-4 shadow-lg shadow-blue-600/30"
            >
              <Printer size={15} />
              {isPrinting ? 'Imprimindo...' : 'Imprimir Recibo (80mm)'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
