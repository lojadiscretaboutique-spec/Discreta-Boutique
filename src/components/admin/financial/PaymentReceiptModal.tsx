import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, CheckCircle, FileText, Building2, UserCheck, ShieldCheck } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { Button } from '../../ui/button';
import { formatCurrency } from '../../../lib/utils';
import { formatCurrencyInWords } from '../../../utils/numberToWordsPtBr';
import { FinancialTransaction } from '../../../services/financialService';

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
  const [isPrinting, setIsPrinting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadStore() {
      try {
        const snap = await getDoc(doc(db, 'settings', 'store'));
        if (snap.exists()) {
          const data = snap.data();
          setStoreData(prev => ({
            ...prev,
            storeName: data.storeName || 'Discreta Boutique',
            address: data.address || prev.address,
            whatsapp: data.whatsapp || '',
            cnpj: data.cnpj || ''
          }));
        }
      } catch (err) {
        console.warn('Não foi possível carregar dados da loja para recibo:', err);
      }
    }
    if (isOpen) {
      loadStore();
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
      ? `Declaro para os devidos fins legais, em conformidade com o Artigo 464 da CLT (Consolidação das Leis do Trabalho), ter recebido da empresa ${storeData.storeName || 'Discreta Boutique'} a importância líquida de ${formatCurrency(netAmount)} (${amountInWords}), referente ao pagamento de ${paymentTypeLabel} relativo à competência de ${competence}, achado exato e conferido, dando plena, geral e irrevogável quitação de tais verbas para nada mais reclamar a este título.`
      : `Recebi(emos) de ${storeData.storeName || 'Discreta Boutique'} a importância líquida de ${formatCurrency(amount)} (${amountInWords}), referente a ${transaction.description || 'quitação de obrigações/serviços'}, dando plena, rasa e geral quitação pelo valor recebido.`
  );

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Estilos específicos de impressão: na hora de imprimir, exibe SOMENTE o container do recibo em fundo branco perfeito */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-payment-receipt, #printable-payment-receipt * {
            visibility: visible !important;
          }
          #printable-payment-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 15mm !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: 1px solid #999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-700 bg-slate-900 flex justify-between items-center text-white sticky top-0 z-10 no-print">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">
                {isSalary ? 'Recibo de Pagamento de Salário' : 'Recibo de Pagamento'}
              </h2>
              <p className="text-xs text-slate-400">
                Visualização formal e documento para impressão com termo legal e linha de assinatura
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-2 px-4 shadow-sm"
              size="sm"
            >
              <Printer size={16} /> Imprimir Recibo
            </Button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body: Papel do Recibo (fundo claro imitando documento real para fácil leitura) */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950 flex justify-center">
          <div
            id="printable-payment-receipt"
            ref={receiptRef}
            className="w-full bg-white text-slate-900 rounded-xl p-6 sm:p-8 shadow-md border border-slate-300 font-sans max-w-2xl text-sm leading-relaxed"
          >
            {/* Topo do Recibo: Cabeçalho com dados da Empresa e Identificador */}
            <div className="border-b-2 border-slate-800 pb-4 mb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 size={20} className="text-slate-800" />
                    <h1 className="text-xl font-black uppercase tracking-wide text-slate-900">
                      {storeData.storeName || 'Discreta Boutique'}
                    </h1>
                  </div>
                  {storeData.address && (
                    <p className="text-xs text-slate-600 font-medium mt-0.5">{storeData.address}</p>
                  )}
                  {storeData.cnpj && (
                    <p className="text-xs text-slate-600 font-medium">CNPJ: {storeData.cnpj}</p>
                  )}
                  {storeData.whatsapp && (
                    <p className="text-xs text-slate-600 font-medium">Contato: {storeData.whatsapp}</p>
                  )}
                </div>

                <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 w-full sm:w-auto">
                  <div className="inline-block bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-left sm:text-right">
                    <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                      Recibo / Protocolo
                    </span>
                    <span className="font-mono font-bold text-slate-800 text-sm">
                      Nº {receiptNumber}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    <span className="font-semibold">Data Pgto:</span> {paymentDateFormatted}
                  </div>
                </div>
              </div>

              {/* Título Centralizado do Recibo */}
              <div className="mt-4 pt-3 border-t border-slate-200 text-center">
                <span className="inline-block bg-slate-900 text-white font-extrabold px-4 py-1 rounded text-xs uppercase tracking-widest">
                  {isSalary
                    ? 'COMPROVANTE / RECIBO DE PAGAMENTO DE SALÁRIO'
                    : 'COMPROVANTE DE PAGAMENTO REALIZADO'}
                </span>
                {isSalary && (
                  <p className="text-[11px] text-slate-600 font-semibold mt-1">
                    Em conformidade com o Artigo 464 da Consolidação das Leis do Trabalho (CLT)
                  </p>
                )}
              </div>
            </div>

            {/* Destaque do Valor */}
            <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Valor Pago (Líquido)
                </span>
                <span className="text-2xl font-black text-slate-950">
                  {formatCurrency(netAmount)}
                </span>
              </div>
              <div className="sm:text-right max-w-sm">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Valor por Extenso
                </span>
                <span className="text-xs font-semibold text-slate-700 italic">
                  ({amountInWords})
                </span>
              </div>
            </div>

            {/* Informações do Favorecido / Colaborador */}
            <div className="border border-slate-300 rounded-xl p-4 mb-4 bg-white">
              <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider mb-2.5 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <UserCheck size={15} className="text-slate-700" />
                {isSalary ? 'Dados do(a) Colaborador(a) / Empregado(a)' : 'Dados do(a) Favorecido(a) / Fornecedor(a)'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div>
                  <span className="text-slate-500 font-medium block">Nome Completo:</span>
                  <span className="font-bold text-slate-900 text-sm">{collaboratorName}</span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">CPF / Documento:</span>
                  <span className="font-bold font-mono text-slate-900">{collaboratorCpf}</span>
                </div>

                {isSalary && (
                  <>
                    <div>
                      <span className="text-slate-500 font-medium block">Cargo / Função:</span>
                      <span className="font-semibold text-slate-800">{collaboratorRole}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-medium block">Competência / Mês Ref.:</span>
                      <span className="font-semibold text-slate-800">{competence}</span>
                    </div>

                    <div>
                      <span className="text-slate-500 font-medium block">Tipo de Pagamento:</span>
                      <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded inline-block">
                        {paymentTypeLabel}
                      </span>
                    </div>
                  </>
                )}

                <div>
                  <span className="text-slate-500 font-medium block">Forma de Pagamento:</span>
                  <span className="font-semibold text-slate-800">
                    {transaction.paymentMethod || 'Transferência / PIX / Dinheiro'}
                  </span>
                </div>
              </div>
            </div>

            {/* Se for Salário e tiver discriminação de proventos/descontos */}
            {isSalary && (grossAmount !== netAmount || deductions > 0) && (
              <div className="border border-slate-300 rounded-xl overflow-hidden mb-4 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 font-bold text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-300">
                    <tr>
                      <th className="px-3 py-2">Discriminação das Verbas</th>
                      <th className="px-3 py-2 text-right">Proventos (R$)</th>
                      <th className="px-3 py-2 text-right">Descontos (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {paymentTypeLabel} - Ref. {competence}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-900">
                        {formatCurrency(grossAmount)}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">-</td>
                    </tr>
                    {deductions > 0 && (
                      <tr>
                        <td className="px-3 py-2 text-slate-700">Descontos Legais / Adiantamentos Anteriores</td>
                        <td className="px-3 py-2 text-right text-slate-400">-</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600">
                          {formatCurrency(deductions)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-50 font-bold">
                      <td className="px-3 py-2 text-slate-900">LÍQUIDO A RECEBER</td>
                      <td colSpan={2} className="px-3 py-2 text-right text-sm font-black text-slate-950">
                        {formatCurrency(netAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Descrição Geral se não for salário ou notas adicionais */}
            {(!isSalary || transaction.description) && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs">
                <span className="font-bold text-slate-700 block mb-0.5">Descrição do Lançamento:</span>
                <p className="text-slate-800">{transaction.description}</p>
                {transaction.notes && (
                  <p className="text-slate-500 mt-1 italic font-sans text-[11px]">Obs: {transaction.notes}</p>
                )}
              </div>
            )}

            {/* Termo Jurídico de Quitação Formal (Legal Notice) */}
            <div className="border-l-4 border-slate-800 bg-slate-50 p-3.5 rounded-r-lg mb-6 text-xs text-slate-800 text-justify leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
                <ShieldCheck size={14} className="text-slate-700" />
                <span>Declaração e Termo de Quitação:</span>
              </div>
              <p>{defaultLegalNotice}</p>
            </div>

            {/* Data e Localidade */}
            <div className="text-right text-xs font-semibold text-slate-700 mb-8">
              São Paulo - SP, {paymentDateFormatted}.
            </div>

            {/* LINHAS PARA ASSINATURA (Requisito Formal) */}
            <div className="mt-8 pt-4 border-t border-slate-300">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-center">
                {/* Assinatura do Favorecido / Colaborador */}
                <div className="flex flex-col items-center">
                  <div className="w-4/5 border-b-2 border-slate-800 mb-1.5"></div>
                  <span className="font-bold text-xs text-slate-900 uppercase">{collaboratorName}</span>
                  <span className="text-[11px] text-slate-600">CPF: {collaboratorCpf}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {isSalary ? 'Assinatura do(a) Empregado(a)' : 'Assinatura do(a) Recebedor(a)'}
                  </span>
                </div>

                {/* Assinatura do Empregador / Empresa */}
                <div className="flex flex-col items-center">
                  <div className="w-4/5 border-b-2 border-slate-800 mb-1.5"></div>
                  <span className="font-bold text-xs text-slate-900 uppercase">
                    {storeData.storeName || 'Discreta Boutique'}
                  </span>
                  <span className="text-[11px] text-slate-600">
                    {storeData.cnpj ? `CNPJ: ${storeData.cnpj}` : 'Setor Financeiro / RH'}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Assinatura do Empregador / Empresa Pagadora
                  </span>
                </div>
              </div>
            </div>

            {/* Rodapé sutil de autenticação */}
            <div className="mt-8 pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400 font-mono">
              <span>Recibo gerado eletronicamente pelo Sistema de Gestão Discreta Boutique</span>
              <span>Doc: {receiptNumber} • {new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400 no-print">
          <span className="flex items-center gap-1.5 text-slate-400">
            <CheckCircle size={14} className="text-green-500" />
            Recibo apto para arquivo contábil, comprovação de pagamento e compliance trabalhista.
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="border-slate-700 text-slate-300">
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
            >
              <Printer size={15} /> Imprimir Recibo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
