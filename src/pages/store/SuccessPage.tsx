import { useLocation, Link, Navigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, MessageCircle, Copy, Clock, Check, ShieldCheck, ArrowRight, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useEffect, useState } from 'react';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { productService } from '../../services/productService';
import { abandonedCartService } from '../../services/abandonedCartService';

export function SuccessPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<DocumentData | null>(null);
  const [pixCopied, setPixCopied] = useState(false);

  const [isExpired, setIsExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newPixLoading, setNewPixLoading] = useState(false);

  useEffect(() => {
    if (!orderData?.paymentExpiresAt) return;
    const interval = setInterval(() => {
      const expTime = new Date(orderData.paymentExpiresAt).getTime();
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
  }, [orderData?.paymentExpiresAt]);

  const handleCheckPaymentStatus = async () => {
    if (!orderId) return;
    setCheckingStatus(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/payments/mercadopago/check-status/${orderId}`);
      const data = await res.json();
      if (data.status === 'approved') {
        setStatusMessage("Seu pagamento foi confirmado com sucesso!");
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

  const handleGenerateNewPix = async () => {
    if (!orderId) return;
    setNewPixLoading(true);
    try {
      const res = await fetch('/api/payments/mercadopago/create-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, paymentMethodId: orderData?.paymentMethodId || 'online_payment' })
      });
      const data = await res.json();
      if (data.success) {
        const d = await getDoc(doc(db, 'orders', orderId));
        if (d.exists()) {
          setOrderData(d.data());
          setIsExpired(false);
        }
      } else {
        alert(data.error || "Não foi possível gerar novo Pix. Confira seus dados ou tente novamente.");
      }
    } catch (err) {
      console.error("Generate Pix error:", err);
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setNewPixLoading(false);
    }
  };

  useEffect(() => {
    const s = location.state as { orderId: string, whatsapp?: string } | null;
    const idFromParam = searchParams.get('orderId') || searchParams.get('external_reference');
    const finalId = s?.orderId || idFromParam;

    if (finalId) {
      setOrderId(finalId);
      
      if (s?.whatsapp) {
        abandonedCartService.markAsRecovered(s.whatsapp);
      }
      
      const fetchOrder = async () => {
        try {
          const d = await getDoc(doc(db, 'orders', finalId));
          if (d.exists()) {
            const data = d.data();
            setOrderData(data);
            
            if (data.customerWhatsApp || data.customerWhatsapp) {
              abandonedCartService.markAsRecovered(data.customerWhatsApp || data.customerWhatsapp);
            }
            
            if (data.items && Array.isArray(data.items)) {
              data.items.forEach((item: any) => {
                if (item.productId && (item.searchId || item.id)) {
                   productService.trackInteraction(item.productId, 'conversion', item.searchId);
                }
              });
            }
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchOrder();
    } else {
      setLoading(false);
    }
  }, [location.state, searchParams]);

  const mpStatus = searchParams.get('status');
  const isPaidOnline = mpStatus === 'approved' || orderData?.paymentStatus === 'approved' || orderData?.paymentStatus === 'pago';

  // Background status check loop (Auto-polling every 6 seconds)
  useEffect(() => {
    if (!orderId || isPaidOnline || isExpired) return;

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
  }, [orderId, isPaidOnline, isExpired]);

  if (loading) return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center text-white space-y-4">
      <div className="h-8 w-8 border-4 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
      <span className="font-bold uppercase tracking-widest text-[11px] text-zinc-400">Processando Pedido...</span>
    </div>
  );

  if (!orderId) {
    return <Navigate to="/" replace />;
  }

  const adminWhatsApp = "5588992340317";
  
  let wpMessageBase = `Olá! Acabei de fazer um pedido no site.\n\n*Nº do Pedido:* #${orderId.slice(-6).toUpperCase()}`;
  
  if (orderData) {
    wpMessageBase += `\n*Nome:* ${orderData.customerName || ''}`;
    wpMessageBase += `\n*Endereço:* ${orderData.customerAddress || ''}`;
    if (orderData.notes) {
      wpMessageBase += `\n*Obs:* ${orderData.notes}`;
    }
    
    wpMessageBase += `\n\n*Itens:*`;
    if (orderData.items && Array.isArray(orderData.items)) {
      orderData.items.forEach((item: any) => {
        wpMessageBase += `\n- ${item.quantity}x ${item.name} (R$ ${item.price?.toFixed(2).replace('.', ',')})`;
      });
    }

    if (orderData.deliveryFee > 0) {
      wpMessageBase += `\n\n*Subtotal:* R$ ${orderData.subTotal?.toFixed(2).replace('.', ',')}`;
      wpMessageBase += `\n*Taxa de Entrega:* R$ ${orderData.deliveryFee?.toFixed(2).replace('.', ',')}`;
    }
    wpMessageBase += `\n*Total:* R$ ${orderData.total?.toFixed(2).replace('.', ',')}`;
    wpMessageBase += `\n*Pagamento:* ${String(orderData.paymentMethod).toUpperCase()}`;
  } else {
    wpMessageBase += `\nGostaria de confirmar o envio.`;
  }

  const wpMessage = encodeURIComponent(wpMessageBase);

  // Determinar se tem os dados do Pix Online do Mercado Pago
  const isMPPix = !!(
    orderData?.paymentProvider === "mercado_pago" ||
    orderData?.gatewayProvider === "mercado_pago" ||
    orderData?.mercadoPagoPaymentId ||
    orderData?.mercadopagoPaymentId ||
    orderData?.paymentQrCode ||
    orderData?.paymentCopyPaste ||
    orderData?.pixQrCode ||
    orderData?.pixCopyPaste
  );

  const hasPixOnline = isMPPix;
  
  if (hasPixOnline && !isPaidOnline) {
    return <Navigate to={`/checkout-pix?orderId=${orderId}`} replace />;
  }
  
  const pixCode = 
    orderData?.paymentQrCode || 
    orderData?.paymentCopyPaste || 
    orderData?.pixQrCode || 
    orderData?.pixCopyPaste || 
    '';

  const qrCodeBase64 = 
    orderData?.paymentQrCodeBase64 || 
    orderData?.pixQrCodeBase64 || 
    '';

  if (hasPixOnline && !isPaidOnline) {
    return (
      <div className="flex-1 bg-[#09090b] text-white min-h-[92vh] flex flex-col justify-center items-center py-6 px-4 md:px-8 font-sans animate-fade-in">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center text-center space-y-6">
          {/* Subtle Background Glow Accent */}
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/5 rounded-full blur-[100px] pointer-events-none" />

          {/* Icon and Title */}
          <div className="flex flex-col items-center space-y-2">
            <div className="p-3.5 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <Clock size={28} className="animate-pulse" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-wider text-zinc-100 mt-2">Pague com Pix</h1>
            <p className="text-xs text-zinc-400 font-medium max-w-xs">
              Sua compra está reservada. Conclua o pagamento para envio imediato.
            </p>
          </div>

          {/* Valor do Pedido */}
          <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800/80 px-6 py-4 w-full flex flex-col items-center">
            <span className="text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Valor do Pedido</span>
            <span className="text-2xl font-black text-white mt-1">R$ {orderData?.total?.toFixed(2).replace('.', ',') || '0,00'}</span>
          </div>

          {/* Timer / Validade */}
          <div className="text-xs text-zinc-400">
            {isExpired ? (
              <span className="text-red-500 font-bold">O código Pix expirou.</span>
            ) : orderData?.paymentExpiresAt ? (
              <p className="font-medium">
                Este Pix expira em até 30 minutos. <br />
                <span className="text-amber-500 font-bold block mt-1">
                  Tempo restante: {timeRemaining || "Calculando..."}
                </span>
              </p>
            ) : (
              <span className="text-amber-500 font-bold">Este Pix expira em até 30 minutos</span>
            )}
          </div>

          {isExpired ? (
            <div className="w-full space-y-3">
              <p className="text-xs text-zinc-500">Gere um novo código Pix para prosseguir com o pagamento de forma segura.</p>
              <Button
                type="button"
                disabled={newPixLoading}
                onClick={handleGenerateNewPix}
                className="w-full h-11 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition duration-300 flex items-center justify-center gap-2"
              >
                {newPixLoading ? (
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Gerar Novo Código Pix
              </Button>
            </div>
          ) : (
            <>
              {/* QR Code */}
              <div className="bg-white p-3.5 rounded-2xl max-w-[180px] mx-auto shadow-xl border border-zinc-200">
                {qrCodeBase64 ? (
                  <img 
                    src={`data:image/png;base64,${qrCodeBase64}`} 
                    alt="QR Code Pix"
                    className="w-36 h-36 object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-36 h-36 bg-zinc-100 flex flex-col items-center justify-center text-zinc-500 text-[10px] text-center p-3 font-mono font-bold space-y-2">
                    {pixCode ? (
                      <>
                        <ShieldCheck size={20} className="text-zinc-400" />
                        <span>QR Code indisponível. Use o código Pix Copia e Cola.</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={18} className="animate-spin text-zinc-400" />
                        <span>Gerando QR...</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Instructions */}
              <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs">
                Abra o app do seu banco, escolha <strong>Pix</strong> e aponte a câmera para o QR Code acima.
              </p>

              {/* Pix Copia e Cola */}
              <div className="w-full space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-[2px] text-zinc-500">Ou copie e cole o código abaixo:</label>
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
                      if (pixCode) {
                        navigator.clipboard.writeText(pixCode);
                        setPixCopied(true);
                        setTimeout(() => setPixCopied(false), 2000);
                      }
                    }}
                    className="py-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-colors shrink-0 flex items-center gap-1 text-[10px] font-bold"
                  >
                    {pixCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{pixCopied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="w-full pt-4 border-t border-zinc-800/50 space-y-3">
                {/* Status indicator */}
                <div className="text-center">
                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 py-1.5 px-3 rounded-full border border-amber-500/20 block w-full text-center">
                    Aguardando confirmação do Mercado Pago
                  </span>
                </div>

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
                      <span>Já paguei, verificar pagamento</span>
                    </>
                  )}
                </Button>

                {statusMessage && <p className="text-emerald-500 font-bold text-[11px] mt-1">{statusMessage}</p>}
                {errorMessage && <p className="text-zinc-500 text-[11px] mt-1">{errorMessage}</p>}

                {/* Auto checking status animation */}
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 pt-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  <span>Verificação automática ativa</span>
                </div>
              </div>
            </>
          )}

          {/* Secondary support link (WhatsApp and back button) */}
          <div className="w-full pt-4 border-t border-zinc-800/50 flex flex-col items-center space-y-2">
            <a 
              href={`https://wa.me/${adminWhatsApp}?text=${wpMessage}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors py-1.5"
            >
              <MessageCircle size={13} className="text-[#25D366]" />
              <span>Precisa de ajuda? Suporte via WhatsApp</span>
            </a>

            <Button variant="ghost" className="text-zinc-500 hover:text-zinc-300 font-bold uppercase tracking-widest text-[9px] hover:bg-transparent" asChild>
              <Link to="/" className="flex items-center gap-1">
                Voltar para meus pedidos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#09090b] text-white min-h-[92vh] flex flex-col justify-center items-center py-6 px-4 md:px-8 font-sans">
      <div className="w-full max-w-5xl bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden animate-fade-in">
        
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Outer Layout split: Left Info / Right Pix or details */}
        <div className={`grid grid-cols-1 ${hasPixOnline && !isPaidOnline ? 'md:grid-cols-12' : 'md:grid-cols-1'} gap-8 items-stretch`}>
          
          {/* Main Column (Always Left) */}
          <div className={`${hasPixOnline && !isPaidOnline ? 'md:col-span-7' : 'md:col-span-1'} flex flex-col justify-between space-y-6`}>
            
            {/* Success Header */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-600/10 text-red-500 rounded-2xl border border-red-500/20 shadow-[0_0_20px_rgba(220,38,38,0.15)] shrink-0">
                <CheckCircle size={28} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-[3px] text-zinc-500 block">Pedido Realizado</span>
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic text-zinc-100">
                  {isPaidOnline ? "Pagamento Confirmado!" : "Aguardando Pagamento"}
                </h1>
                <p className="text-xs text-zinc-400 font-medium">
                  Seu desejo foi registrado com total privacidade e embalagem blindada.
                </p>
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-zinc-950/60 rounded-2xl border border-zinc-800/80 p-5 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-zinc-800/50">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[2px] text-zinc-500 block">Código do Pedido</span>
                  <span className="text-sm font-bold text-red-500">#{orderId.slice(-6).toUpperCase()}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black uppercase tracking-[2px] text-zinc-500 block">Valor Total</span>
                  <span className="text-lg font-black text-white">R$ {orderData?.total?.toFixed(2).replace('.', ',') || '0,00'}</span>
                </div>
              </div>

              {/* Secure Info Footer */}
              <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
                <ShieldCheck size={14} className="text-red-500" />
                <span>Embalagem 100% neutra, sem qualquer menção de sexshop na etiqueta ou fatura.</span>
              </div>
            </div>

            {/* Instruction block */}
            {!isPaidOnline && (
              <div className="text-left space-y-2">
                <h3 className="font-bold text-sm text-zinc-200">Próximos passos:</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {hasPixOnline 
                    ? "Faça o pagamento via Pix utilizando as informações ao lado. O sistema detectará automaticamente em alguns segundos e liberará o pedido para separação."
                    : "Seu pedido foi registrado. Realize a transferência ou fale conosco no botão abaixo para concluir o pagamento de forma manual e segura."
                  }
                </p>
              </div>
            )}

            {/* WhatsApp Contact & Action Center */}
            <div className="space-y-3 pt-2">
              {!hasPixOnline ? (
                <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white font-bold h-12 rounded-xl text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all shrink-0" asChild>
                  <a href={`https://wa.me/${adminWhatsApp}?text=${wpMessage}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={16} />
                    Falar no WhatsApp / Enviar Comprovante
                  </a>
                </Button>
              ) : (
                <div className="text-center py-2">
                  <a 
                    href={`https://wa.me/${adminWhatsApp}?text=${wpMessage}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-200 transition-colors bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 px-4 py-2 rounded-xl font-medium"
                  >
                    <MessageCircle size={14} className="text-[#25D366]" />
                    Precisa de ajuda? Suporte via WhatsApp
                  </a>
                </div>
              )}

              <div className="flex justify-center">
                <Button variant="ghost" className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/30 font-bold uppercase tracking-widest text-[10px]" asChild>
                  <Link to="/" className="flex items-center gap-1">
                    Voltar para a Vitrine <ArrowRight size={10} />
                  </Link>
                </Button>
              </div>
            </div>

          </div>

          {/* Right Column (Pix Specific - Only if Pix online active & not paid) */}
          {hasPixOnline && !isPaidOnline && (
            <div className="md:col-span-5 bg-zinc-950 rounded-2xl border border-zinc-800/80 p-5 flex flex-col justify-between space-y-4">
              
              {/* Timer Header */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[2px] text-amber-500 flex items-center gap-1">
                  <Clock size={12} className="animate-pulse" />
                  Pague com Pix
                </span>
                {orderData?.paymentExpiresAt && !isExpired && (
                  <span className="text-[11px] font-mono bg-amber-500/10 text-amber-500 py-1 px-2.5 rounded-full border border-amber-500/20">
                    Expira em: <strong className="font-bold text-white">{timeRemaining}</strong>
                  </span>
                )}
              </div>

              {isExpired ? (
                <div className="text-center py-6 space-y-3 flex flex-col items-center justify-center flex-1">
                  <p className="text-xs text-zinc-400">O QR Code Pix anterior expirou.</p>
                  <Button
                    type="button"
                    disabled={newPixLoading}
                    onClick={handleGenerateNewPix}
                    className="h-10 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition duration-300 px-4"
                  >
                    {newPixLoading ? (
                      <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block" />
                    ) : null}
                    Gerar Novo Código Pix
                  </Button>
                </div>
              ) : (
                <>
                  {/* QR Code Graphic Frame */}
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl max-w-[170px] mx-auto shadow-xl border border-zinc-200">
                    {qrCodeBase64 ? (
                      <img 
                        src={`data:image/png;base64,${qrCodeBase64}`} 
                        alt="QR Code Pix"
                        className="w-36 h-36 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-36 h-36 bg-zinc-100 flex flex-col items-center justify-center text-zinc-500 text-[10px] text-center p-3 font-mono font-bold space-y-2">
                        <RefreshCw size={18} className="animate-spin text-zinc-400" />
                        <span>Gerando QR...</span>
                      </div>
                    )}
                  </div>

                  {/* Scan Instruction */}
                  <p className="text-[11px] text-zinc-400 text-center leading-relaxed font-medium">
                    Abra o app do seu banco, escolha <strong>Pix</strong> e aponte a câmera para a imagem acima.
                  </p>

                  {/* Copy Paste Code input */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-black uppercase tracking-[2px] text-zinc-500 text-center">Ou copie e cole o código abaixo:</label>
                    <div className="flex gap-2 items-center bg-zinc-900 p-2 rounded-xl border border-zinc-800">
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
                        className="py-1 px-2.5 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg transition-colors shrink-0 flex items-center gap-1 text-[10px] font-bold font-sans"
                      >
                        {pixCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        <span>{pixCopied ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Manual verification button */}
                  <div className="pt-2 border-t border-zinc-800/50 space-y-2">
                    {/* Status element */}
                    <div className="text-center py-1">
                      <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 py-1 px-3 rounded-full border border-amber-500/20 block w-full text-center mb-2">
                        Aguardando confirmação do Mercado Pago
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={checkingStatus}
                      onClick={handleCheckPaymentStatus}
                      className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] text-white rounded-xl text-[11px] font-bold tracking-wider uppercase transition duration-300 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {checkingStatus ? (
                        <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Smartphone size={12} />
                          <span>Já paguei, verificar agora</span>
                        </>
                      )}
                    </button>
                    
                    {statusMessage && <p className="text-emerald-500 font-bold text-[10px] text-center">{statusMessage}</p>}
                    {errorMessage && <p className="text-zinc-500 text-[10px] text-center">{errorMessage}</p>}
                    
                    {/* Auto status check banner */}
                    <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      <span>Verificação automática ativa</span>
                    </div>
                  </div>

                </>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
