import { useLocation, Link, Navigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, MessageCircle, Copy, Clock, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { motion } from 'motion/react';
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

  useEffect(() => {
    const s = location.state as { orderId: string, whatsapp?: string } | null;
    const idFromParam = searchParams.get('orderId') || searchParams.get('external_reference');
    const finalId = s?.orderId || idFromParam;

    if (finalId) {
      setOrderId(finalId);
      
      // Mark as recovered if we have the phone
      if (s?.whatsapp) {
        abandonedCartService.markAsRecovered(s.whatsapp);
      }
      
      // Fetch order details to see if payment was completed online
      const fetchOrder = async () => {
        try {
          const d = await getDoc(doc(db, 'orders', finalId));
          if (d.exists()) {
            const data = d.data();
            setOrderData(data);
            
            // Re-mark as recovered if we found the phone now
            if (data.customerWhatsapp) {
              abandonedCartService.markAsRecovered(data.customerWhatsapp);
            }
            
            // Track conversions for AI learning
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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-bold uppercase tracking-widest text-xs">Validando Pedido...</div>;

  if (!orderId) {
    return <Navigate to="/" replace />;
  }

  const mpStatus = searchParams.get('status'); // approved, pending, failure
  const isPaidOnline = mpStatus === 'approved' || orderData?.paymentStatus === 'approved' || orderData?.paymentStatus === 'pago';

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

  return (
    <div className="flex-1 bg-black text-white px-4 py-20 text-center flex flex-col justify-center items-center min-h-[70vh]">
      <motion.div 
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        className="flex justify-center mb-8"
      >
        <div className="w-28 h-28 bg-red-600 text-white rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.3)] border-4 border-red-500">
          <CheckCircle size={56} />
        </div>
      </motion.div>
      
      <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter italic mb-4">Pedido Aceito!</h1>
      <p className="text-xl text-zinc-500 font-medium mb-8 max-w-md mx-auto">Sua escolha foi registrada e estamos preparando tudo com sigilo absoluto.</p>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 md:p-12 mb-12 max-w-2xl w-full">
        <div className="mb-10">
          <span className="text-[10px] font-black uppercase tracking-[5px] text-zinc-600 block mb-2">Protocolo do Desejo</span>
          <div className="text-2xl md:text-4xl font-black text-red-500 tracking-tight bg-black py-4 px-8 rounded-full border border-zinc-800 inline-block shadow-inner">
            #{orderId.slice(-6).toUpperCase()}
          </div>
        </div>

        {isPaidOnline ? (
          <div className="space-y-6 text-left border-l-4 border-green-500 pl-8 mb-10">
            <h2 className="font-black text-xl uppercase tracking-tighter text-green-500 italic">Pagamento Confirmado!</h2>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              Recebemos seu pagamento online corretamente. Seu pedido está em fase de separação e será enviado o mais breve possível.
            </p>
          </div>
        ) : orderData?.paymentQrCode ? (
          <div className="space-y-6 text-left border-l-4 border-amber-500 pl-8 mb-10">
            <h2 className="font-black text-xl uppercase tracking-tighter text-amber-500 italic flex items-center gap-2">
              <Clock size={20} className="text-amber-500 shrink-0" />
              Aguardando Pagamento Pix
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              Utilize o QR Code oficial abaixo ou copie o código Pix "Copia e Cola" para concluir seu pedido de forma instantânea e segura:
            </p>
            
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-3xl max-w-xs mx-auto shadow-xl border border-zinc-200 mt-2">
              {orderData.paymentQrCodeBase64 ? (
                <img 
                  src={`data:image/png;base64,${orderData.paymentQrCodeBase64}`} 
                  alt="QR Code Pix"
                  className="w-44 h-44 object-contain"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-44 h-44 bg-zinc-150 flex items-center justify-center text-zinc-500 text-xs text-center p-4 font-mono font-bold">
                  Gerando QR Code...
                </div>
              )}
            </div>

            <div className="space-y-1.5 mt-4">
              <label className="block text-[10px] font-black uppercase tracking-[2px] text-zinc-500">Chave Pix Copia e Cola</label>
              <div className="flex gap-2 items-center bg-zinc-950 p-2.5 rounded-2xl border border-zinc-800">
                <input 
                  type="text" 
                  readOnly 
                  value={orderData.paymentQrCode} 
                  className="bg-transparent text-zinc-300 font-mono text-[10px] flex-1 border-none focus:outline-none focus:ring-0 leading-relaxed overflow-x-auto select-all" 
                />
                <button 
                  type="button" 
                  onClick={() => {
                    navigator.clipboard.writeText(orderData.paymentQrCode || '');
                    setPixCopied(true);
                    setTimeout(() => setPixCopied(false), 2000);
                  }}
                  className="p-2 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl transition-colors shrink-0 flex items-center gap-1.5 text-xs font-black font-sans"
                >
                  {pixCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{pixCopied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 text-left border-l-4 border-red-600 pl-8 mb-10">
            <h2 className="font-black text-xl uppercase tracking-tighter italic">O que acontece agora?</h2>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              <strong>1.</strong> Estamos separando seu pedido em embalagem blindada e neutra.<br/><br/>
              <strong>2.</strong> <strong>Atenção:</strong> {orderData?.paymentMethod === 'pix' ? 'Realize o PIX informado ou clique no botão abaixo para receber a chave e confirmar o pagamento.' : 'Clique no botão abaixo para falar conosco e agilizar sua entrega.'}
            </p>
          </div>
        )}
        
        <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-black h-20 rounded-full text-lg uppercase tracking-widest shadow-2xl border-b-4 border-green-800 active:border-b-0 active:translate-y-1 transition-all" asChild>
          <a href={`https://wa.me/${adminWhatsApp}?text=${wpMessage}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-3 w-6 h-6" /> {isPaidOnline ? 'Falar no WhatsApp' : 'Confirmar no WhatsApp'}
          </a>
        </Button>
      </div>

      <Button variant="ghost" className="text-zinc-600 hover:text-white font-bold uppercase tracking-widest text-xs" asChild>
        <Link to="/">Voltar para a Vitrine</Link>
      </Button>
    </div>
  );
}

