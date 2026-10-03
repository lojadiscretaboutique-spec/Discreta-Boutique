import React, { useState } from 'react';
import { RaffleTicket } from '../../types/raffle';
import { printRaffleThermalTickets } from '../../utils/rafflePrintUtils';
import { 
  Printer, 
  X, 
  Gift, 
  Sparkles, 
  Copy, 
  Check, 
  Calendar, 
  ShoppingBag,
  ExternalLink 
} from 'lucide-react';

interface RaffleTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: RaffleTicket[];
  campaignTitle?: string;
  autoPrintAttempted?: boolean;
}

export function RaffleTicketModal({
  isOpen,
  onClose,
  tickets,
  campaignTitle,
  autoPrintAttempted = false,
}: RaffleTicketModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !tickets || tickets.length === 0) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await printRaffleThermalTickets(tickets);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopySummary = () => {
    const text = tickets.map(t => 
      `🎫 *CUPOM DE SORTEIO - DISCRETA BOUTIQUE*\n` +
      `Código: #${t.ticketCode}\n` +
      `Campanha: ${t.campaignTitle}\n` +
      `Prêmio: ${t.prize}\n` +
      `Pedido: #${t.orderId ? t.orderId.slice(-6).toUpperCase() : 'BALCAO'}\n` +
      `Data da compra: ${t.orderDate}\n` +
      `Valor da compra: R$ ${t.orderTotal.toFixed(2).replace('.', ',')}\n` +
      (t.drawDate ? `Data do Sorteio: ${t.drawDate}\n` : '') +
      `Boa sorte! Siga no Instagram @discretaico`
    ).join('\n\n-------------------------\n\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl max-w-xl w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-up">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-850 bg-zinc-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl shadow-lg shadow-rose-600/20 text-white">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                Bilhetes do Sorteio
                <span className="text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800/40 px-2 py-0.5 rounded-full">
                  {tickets.length} {tickets.length === 1 ? 'Cupom' : 'Cupons'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {campaignTitle || tickets[0]?.campaignTitle || 'Campanha de Sorteio'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {autoPrintAttempted && (
          <div className="px-5 py-2.5 bg-emerald-950/40 border-b border-emerald-900/30 text-emerald-400 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
            <span>Impressão térmica acionada automaticamente! Você também pode reimprimir abaixo se desejar.</span>
          </div>
        )}

        {/* Modal Body: Thermal 80mm Preview */}
        <div className="p-6 overflow-y-auto flex-1 bg-zinc-900/30 space-y-4">
          <div className="text-center text-xs text-zinc-400">
            Pré-visualização fiel na fita térmica contínua de <strong className="text-white">80mm (72mm útil)</strong>:
          </div>

          {/* Thermal Ticket Simulation */}
          <div className="max-w-[340px] mx-auto bg-white text-black p-5 rounded-2xl shadow-2xl font-mono text-[11px] leading-tight select-none border border-zinc-300">
            {tickets.map((t, idx) => (
              <div key={t.id || idx} className={idx > 0 ? "mt-6 pt-6 border-t-2 border-dashed border-zinc-400" : ""}>
                {idx > 0 && (
                  <div className="text-center text-[9px] font-bold text-zinc-600 mb-4">
                    ✂ - - - - - - DESTAQUE AQUI - - - - - - ✂
                  </div>
                )}
                
                <div className="text-center">
                  <div className="text-[14px] font-black tracking-wide">DISCRETA BOUTIQUE</div>
                  <div className="text-[8px] font-bold text-zinc-600">MODA ÍNTIMA & BEM-ESTAR</div>
                  <div className="border-t-2 border-black my-2"></div>
                  <div className="text-[12px] font-black uppercase">*** BILHETE DE SORTEIO ***</div>
                  <div className="text-[10.5px] font-extrabold mt-0.5 uppercase">{t.campaignTitle}</div>
                  
                  {tickets.length > 1 && (
                    <div className="mt-1 bg-black text-white text-[9px] font-bold px-2 py-0.5 inline-block">
                      CUPOM {t.ticketIndexInSale} DE {t.ticketsTotalInSale}
                    </div>
                  )}

                  <div className="border border-black p-2 my-2 w-[85%] mx-auto text-center">
                    <div className="text-[8px] font-bold tracking-wider">CÓDIGO DO BILHETE</div>
                    <div className="text-[15px] font-black tracking-wider">#{t.ticketCode}</div>
                  </div>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>

                <div>
                  <div className="text-[8.5px] font-black uppercase text-zinc-700">CONCORRA A:</div>
                  <div className="text-[11.5px] font-black leading-snug">🏆 {t.prize}</div>
                  {t.drawDate && (
                    <div className="text-[9px] mt-1 text-zinc-700">
                      Data do sorteio: <strong>{t.drawDate.split('-').reverse().join('/')}</strong>
                    </div>
                  )}
                </div>

                <div className="border-t border-dashed border-black my-2"></div>

                <div className="space-y-0.5 text-[9.5px]">
                  <div className="flex justify-between">
                    <span>PEDIDO PDV:</span>
                    <span className="font-bold">#{t.orderId ? t.orderId.slice(-6).toUpperCase() : 'BALCAO'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATA COMPRA:</span>
                    <span>{t.orderDate}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[10px] pt-1 border-t border-dotted border-zinc-400">
                    <span>VALOR:</span>
                    <span>R$ {Number(t.orderTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black my-2"></div>

                <div className="space-y-1.5">
                  <div className="text-[9px] font-black text-center uppercase">PREENCHA PARA A URNA:</div>
                  <div>
                    <span className="text-[8px] font-bold block">NOME:</span>
                    <div className="border-b border-black text-[10px] font-bold h-4">
                      {t.customerName ? t.customerName.toUpperCase() : ''}
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold block">WHATSAPP:</span>
                    <div className="border-b border-black text-[10px] font-bold h-4">
                      {t.customerWhatsapp || ''}
                    </div>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold block">ASSINATURA:</span>
                    <div className="border-b border-black h-4 mt-2"></div>
                  </div>
                </div>

                {t.rules && (
                  <>
                    <div className="border-t border-dashed border-black my-2"></div>
                    <div>
                      <div className="text-[8.5px] font-black uppercase text-zinc-700">REGRAS:</div>
                      <div className="text-[8px] leading-tight text-zinc-800 whitespace-pre-line">
                        {t.rules}
                      </div>
                    </div>
                  </>
                )}

                <div className="mt-3 text-center text-[8px] font-bold text-zinc-600">
                  ✂ DESTAQUE E DEPOSITE NA URNA ✂
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-zinc-850 bg-zinc-900/60 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-xs font-bold rounded-xl text-zinc-200 transition cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar Texto para WhatsApp'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-xs font-bold rounded-xl text-zinc-400 hover:text-white transition cursor-pointer"
            >
              Fechar
            </button>

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-xs font-black rounded-xl text-white shadow-lg shadow-red-600/30 transition cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {isPrinting ? 'Enviando...' : `Imprimir ${tickets.length} Bilhete(s) (80mm)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
