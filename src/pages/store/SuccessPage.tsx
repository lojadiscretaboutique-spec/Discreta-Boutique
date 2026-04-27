import { useLocation, Link, Navigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, MessageCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function SuccessPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<DocumentData | null>(null);

  useEffect(() => {
    const s = location.state as { orderId: string } | null;
    const idFromParam = searchParams.get('orderId') || searchParams.get('external_reference');
    const finalId = s?.orderId || idFromParam;

    if (finalId) {
      setOrderId(finalId);
      // Fetch order details to see if payment was completed online
      const fetchOrder = async () => {
        try {
          const d = await getDoc(doc(db, 'orders', finalId));
          if (d.exists()) {
            setOrderData(d.data());
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
  const isPaidOnline = mpStatus === 'approved' || orderData?.paymentStatus === 'pago';

  const adminWhatsApp = "5588992340317";
  
  let wpMessageBase = `Olá! Acabei de fazer um pedido no site.\n\n*Nº do Pedido:* #${orderId}`;
  
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
            #{orderId}
          </div>
        </div>

        {isPaidOnline ? (
          <div className="space-y-6 text-left border-l-4 border-green-500 pl-8 mb-10">
            <h2 className="font-black text-xl uppercase tracking-tighter text-green-500 italic">Pagamento Confirmado!</h2>
            <p className="text-zinc-400 text-sm leading-relaxed font-medium">
              Recebemos seu pagamento online corretamente. Seu pedido está em fase de separação e será enviado o mais breve possível.
            </p>
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

