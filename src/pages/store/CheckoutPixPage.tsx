import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  QrCode, Copy, Check, Clock, ShieldCheck, MessageCircle, 
  Smartphone, RefreshCw, AlertCircle, ArrowLeft, CheckCircle2, ShoppingBag 
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

export function CheckoutPixPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId');

  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<DocumentData | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newPixLoading, setNewPixLoading] = useState(false);

  // Auto-polling interval reference
  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const d = await getDoc(doc(db, 'orders', orderId));
        if (d.exists()) {
          const data = d.data();
          setOrderData(data);

          const orderCreatedAt = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : null);
          const isOrderExpired = orderCreatedAt ? (Date.now() - orderCreatedAt.getTime() > 30 * 60 * 1000) : false;

          if (isOrderExpired) {
              setIsExpired(true);
          }

          // If payment details (Pix) are not generated yet, try generating them automatically
          const hasPixData = !!(data.paymentQrCodeBase64 || data.pixQrCodeBase64);
          const isPaid = data.paymentStatus === 'approved' || data.paymentStatus === 'pago' || data.status === 'PAGO';
          
          if (!hasPixData && !isPaid && !isOrderExpired) {
            await handleGeneratePixAutomatic();
          }
        }
      } catch (err) {
        console.error("Error fetching order on init:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  // Automatic Pix Generation helper
  const handleGeneratePixAutomatic = async () => {
    if (!orderId) return;
    try {
      console.log("[CheckoutPix] Automatically triggering create-pix...");
      const res = await fetch('/api/payments/mercadopago/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId, 
          paymentMethodId: 'online_payment' 
        })
      });
      const data = await res.json();
      if (data.success) {
        const d = await getDoc(doc(db, 'orders', orderId));
        if (d.exists()) {
          setOrderData(d.data());
          setIsExpired(false);
        }
      }
    } catch (err) {
      console.error("[CheckoutPix] Error generating automatic Pix:", err);
    }
  };

  // Timer / Countdown management
  useEffect(() => {
    if (!orderData) return;
    const orderCreatedAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt ? new Date(orderData.createdAt) : null);
    if (!orderCreatedAt) return;
    
    const interval = setInterval(() => {
      const expTime = orderCreatedAt.getTime() + (30 * 60 * 1000);
      const now = Date.now();
      const diff = expTime - now;
      
      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining('');
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
        setIsExpired(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [orderData?.createdAt]);

  // Check Payment Status Manually
  const handleCheckPaymentStatus = async () => {
    if (!orderId) return;
    setCheckingStatus(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/payments/mercadopago/check-status/${orderId}`);
      const data = await res.json();
      if (data.status === 'approved') {
        setStatusMessage("Pagamento confirmado com sucesso!");
        const d = await getDoc(doc(db, 'orders', orderId));
        if (d.exists()) {
          setOrderData(d.data());
        }
      } else {
        setErrorMessage("Pagamento pendente de confirmação. A verificação é automática.");
      }
    } catch (err) {
      console.error("Check status error:", err);
      setErrorMessage("Erro ao verificar status. Tente novamente.");
    } finally {
      setCheckingStatus(false);
    }
  };

  // Generate a New Pix code if expired
  const handleGenerateNewPix = async () => {
    if (!orderId) return;
    setNewPixLoading(true);
    try {
      const res = await fetch('/api/payments/mercadopago/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId, 
          paymentMethodId: orderData?.paymentMethodId || 'online_payment' 
        })
      });
      const data = await res.json();
      if (data.success) {
        const d = await getDoc(doc(db, 'orders', orderId));
        if (d.exists()) {
          setOrderData(d.data());
          setIsExpired(false);
          setStatusMessage("Novo código Pix gerado com sucesso!");
        }
      } else {
        setErrorMessage(data.error || "Não foi possível gerar novo Pix. Confira seus dados ou tente novamente.");
      }
    } catch (err) {
      console.error("Generate Pix error:", err);
      setErrorMessage("Erro de conexão. Tente novamente.");
    } finally {
      setNewPixLoading(false);
    }
  };

  // Auto-polling payment status loop (Every 6 seconds)
  useEffect(() => {
    if (!orderId || isExpired) return;
    
    const isPaid = orderData?.paymentStatus === 'approved' || orderData?.paymentStatus === 'pago' || orderData?.status === 'PAGO';
    if (isPaid) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/mercadopago/check-status/${orderId}`);
        const data = await res.json();
        if (data.status === 'approved') {
          const d = await getDoc(doc(db, 'orders', orderId));
          if (d.exists()) {
            setOrderData(d.data());
          }
          clearInterval(interval);
        }
      } catch (err) {
        console.error("Auto-polling status error:", err);
      }
    }, 6000);

    return () => clearInterval(interval);
  }, [orderId, isExpired, orderData?.paymentStatus, orderData?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white space-y-4 font-sans">
        <div className="h-10 w-10 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
        <span className="font-bold uppercase tracking-[3px] text-[10px] text-zinc-500">Iniciando pagamento seguro...</span>
      </div>
    );
  }

  if (!orderId || !orderData) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white p-4 font-sans text-center">
        <div className="p-4 bg-red-600/10 text-red-500 rounded-full border border-red-500/20 mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-xl font-black uppercase tracking-wider mb-2">Pedido Não Encontrado</h1>
        <p className="text-zinc-500 text-xs max-w-sm mb-6">
          Não conseguimos localizar as informações deste pagamento. Por favor, acesse sua área de cliente ou tente novamente.
        </p>
        <Button asChild className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl">
          <Link to="/area-cliente/pedidos">Meus Pedidos</Link>
        </Button>
      </div>
    );
  }

  const isPaid = orderData.paymentStatus === 'approved' || orderData.paymentStatus === 'pago' || orderData.status === 'PAGO';

  const adminWhatsApp = "5588992340317";
  const orderShortId = orderId.slice(-6).toUpperCase();
  
  const wpMessageBase = `Olá! Preciso de ajuda com o Pix do meu pedido.\n\n*Nº do Pedido:* #${orderShortId}\n*Nome:* ${orderData.customerName || ''}\n*Valor:* R$ ${orderData.total?.toFixed(2).replace('.', ',')}`;
  const wpMessage = encodeURIComponent(wpMessageBase);

  const pixCode = orderData.paymentQrCode || orderData.paymentCopyPaste || orderData.pixQrCode || orderData.pixCopyPaste || '';
  const qrCodeBase64 = orderData.paymentQrCodeBase64 || orderData.pixQrCodeBase64 || '';

  // SUCCESS STATE
  if (isPaid) {
    return (
      <div className="flex-1 bg-[#09090b] text-white min-h-[92vh] flex flex-col justify-center items-center py-10 px-4 md:px-8 font-sans">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-6 animate-fade-in">
          
          {/* Subtle Background Glow Accent */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/5 rounded-full blur-[100px] pointer-events-none" />

          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-bounce">
            <CheckCircle2 size={42} />
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-[3px] text-emerald-500">Transação Confirmada</span>
            <h1 className="text-2xl font-black uppercase tracking-tight italic text-zinc-100">Pagamento Recebido!</h1>
            <p className="text-xs text-zinc-400 font-medium">
              Detectamos o recebimento do seu Pix. Seu pedido foi encaminhado para separação com total sigilo.
            </p>
          </div>

          <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800/80 p-5 w-full space-y-3 text-left">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Código do Pedido</span>
              <span className="text-xs font-bold text-red-500">#{orderShortId}</span>
            </div>
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Forma de Envio</span>
              <span className="text-xs font-bold text-zinc-300 uppercase">
                {orderData.shippingMethod === 'entrega' || orderData.receiveMethod === 'entrega' ? 'Entrega Discreta' : 'Retirada Discreta'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Valor Pago</span>
              <span className="text-sm font-black text-white">R$ {orderData.total?.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800/50 w-full justify-center">
            <ShieldCheck size={13} className="text-emerald-500 shrink-0" />
            <span>Fatura discreta. Embalagem sem logos ou menção de sexshop.</span>
          </div>

          <div className="w-full pt-4 border-t border-zinc-800/50 space-y-2">
            <Button asChild className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 rounded-xl text-xs uppercase tracking-wider">
              <Link to="/area-cliente/pedidos">Acompanhar Despacho</Link>
            </Button>
            
            <Button variant="ghost" asChild className="w-full text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-widest text-[9px] hover:bg-transparent">
              <Link to="/">Voltar ao Catálogo</Link>
            </Button>
          </div>

        </div>
      </div>
    );
  }

  // ACTIVE PAYMENT STATE
  return (
    <div className="flex-1 bg-[#09090b] text-white min-h-[92vh] flex flex-col justify-center items-center py-8 px-4 md:px-8 font-sans animate-fade-in">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-6">
        
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Back Link */}
        <div className="w-full flex justify-between items-center">
          <Link 
            to="/area-cliente/pedidos" 
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-[10px] font-black uppercase tracking-wider transition-colors"
          >
            <ArrowLeft size={12} />
            <span>Meus Pedidos</span>
          </Link>
          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Pedido #{orderShortId}</span>
        </div>

        {/* Icon & Heading */}
        <div className="flex flex-col items-center space-y-2 w-full">
          <div className="p-3.5 bg-red-600/10 text-red-500 rounded-2xl border border-red-500/20 shadow-[0_0_15px_rgba(220,38,38,0.1)]">
            <QrCode size={28} className={isExpired ? "text-zinc-500" : "animate-pulse"} />
          </div>
          <h1 className="text-xl font-black uppercase tracking-wider text-zinc-100 mt-2">Pagamento por Pix</h1>
          <p className="text-xs text-zinc-400 font-medium max-w-xs leading-relaxed">
            Sua compra está garantida e reservada. Finalize o Pix para faturamento e despacho imediato.
          </p>
        </div>

        {/* Amount Box */}
        <div className="bg-zinc-950 rounded-2xl border border-zinc-850 px-6 py-4 w-full flex justify-between items-center">
          <div className="text-left">
            <span className="text-[9px] font-black uppercase tracking-[1.5px] text-zinc-500">Valor do Pedido</span>
            <span className="text-xl font-black text-white block mt-0.5">R$ {orderData.total?.toFixed(2).replace('.', ',')}</span>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-black uppercase tracking-[1.5px] text-zinc-500 block">Status</span>
            <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 py-1 px-2.5 rounded-full border border-amber-500/20 inline-block mt-1">
              Pendente
            </span>
          </div>
        </div>

        {/* Timer Box */}
        <div className="text-xs text-zinc-400">
          {isExpired ? (
            <span className="text-red-500 font-bold">O tempo de pagamento expirou. O pedido foi cancelado.</span>
          ) : orderData.createdAt ? (
            <p className="font-medium">
              Este pedido expira em 30 minutos. <br />
              <span className="text-red-500 font-black text-sm block mt-1 tracking-wider">
                TEMPO RESTANTE: {timeRemaining || "calculando..."}
              </span>
            </p>
          ) : (
            <span className="text-red-500 font-bold">Este pedido expira em até 30 minutos.</span>
          )}
        </div>

        {/* QR Code Graphic or Generation */}
        {isExpired ? (
          <div className="w-full space-y-3">
            <p className="text-xs text-red-500 font-medium">O prazo de 30 minutos para pagamento foi excedido. Por favor, faça um novo pedido caso ainda queira os itens.</p>
            <Link to="/">
                <Button
                type="button"
                className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition duration-300 flex items-center justify-center mt-4"
                >
                Voltar para a Loja
                </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* QR Image Box */}
            <div className="bg-white p-4 rounded-2xl max-w-[190px] mx-auto shadow-2xl border border-zinc-200">
              {qrCodeBase64 ? (
                <img 
                  src={`data:image/png;base64,${qrCodeBase64}`} 
                  alt="QR Code Pix"
                  className="w-40 h-40 object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-40 h-40 bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 text-[10px] text-center p-3 font-mono font-bold space-y-2">
                  {pixCode ? (
                    <>
                      <ShieldCheck size={20} className="text-zinc-400" />
                      <span>QR Code indisponível. Utilize o Pix Copia e Cola.</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} className="animate-spin text-zinc-400" />
                      <span>Gerando QR Code...</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs">
              Abra o aplicativo de pagamentos ou banco de sua preferência, selecione a opção <strong>Pix QR Code</strong> e aponte a câmera.
            </p>

            {/* Copy-paste Box */}
            {pixCode && (
              <div className="w-full space-y-1.5 text-left">
                <label className="block text-[9px] font-black uppercase tracking-[1.5px] text-zinc-500">Ou copie e cole o código abaixo:</label>
                <div className="flex gap-2 items-center bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <input 
                    type="text" 
                    readOnly 
                    value={pixCode} 
                    className="bg-transparent text-zinc-400 font-mono text-[9px] flex-1 border-none focus:outline-none focus:ring-0 leading-relaxed overflow-x-auto select-all scrollbar-none" 
                  />
                  <button 
                    type="button" 
                    onClick={() => {
                      navigator.clipboard.writeText(pixCode);
                      setPixCopied(true);
                      setTimeout(() => setPixCopied(false), 2000);
                    }}
                    className="py-1 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5 text-[10px] font-bold"
                  >
                    {pixCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{pixCopied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Verification Button & Status */}
            <div className="w-full pt-4 border-t border-zinc-800/50 space-y-3">
              <Button
                type="button"
                disabled={checkingStatus}
                onClick={handleCheckPaymentStatus}
                className="w-full h-11 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold tracking-wider uppercase transition duration-300 flex items-center justify-center gap-2 rounded-xl text-xs"
              >
                {checkingStatus ? (
                  <div className="h-4 w-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                ) : (
                  <>
                    <Smartphone size={13} />
                    <span>Já paguei, confirmar pagamento</span>
                  </>
                )}
              </Button>

              {statusMessage && <p className="text-emerald-500 font-bold text-[11px]">{statusMessage}</p>}
              {errorMessage && <p className="text-zinc-500 text-[11px]">{errorMessage}</p>}

              {/* Ping automatic verify indicator */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 pt-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span>Varredura automática ativa no servidor</span>
              </div>
            </div>
          </>
        )}

        {/* Privacy badge and help block */}
        <div className="w-full pt-4 border-t border-zinc-800/50 flex flex-col items-center space-y-2">
          <a 
            href={`https://wa.me/${adminWhatsApp}?text=${wpMessage}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors py-1.5"
          >
            <MessageCircle size={13} className="text-[#25D366]" />
            <span>Precisa de ajuda? Suporte no WhatsApp</span>
          </a>

          <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
            <ShieldCheck size={11} className="text-red-500" />
            <span>Ambiente Blindado de Alta Segurança</span>
          </div>
        </div>

      </div>
    </div>
  );
}
