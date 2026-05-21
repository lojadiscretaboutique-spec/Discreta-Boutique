import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Copy, Check, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface PopupBanner {
  id: string;
  name: string;
  imageUrl: string;
  linkUrl: string;
  actionType?: 'link' | 'coupon';
  couponCode?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
}

export function PopupOverlay() {
  const [popup, setPopup] = useState<PopupBanner | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Se o usuário já fechou o popup nesta sessão do navegador, não perturbar.
    const isClosed = sessionStorage.getItem('discreta_popup_closed');
    if (isClosed === 'true') return;

    const fetchActivePopup = async () => {
      try {
        const q = query(collection(db, 'popups'));
        const snap = await getDocs(q);
        const now = new Date();

        const activeList = snap.docs
          .map(d => {
            const data = d.data();
            return {
              id: d.id,
              name: data.name || '',
              imageUrl: data.imageUrl || '',
              linkUrl: data.linkUrl || '',
              actionType: data.actionType || 'link',
              couponCode: data.couponCode || '',
              active: data.active ?? true,
              startDate: data.startDate || '',
              endDate: data.endDate || '',
              createdAt: data.createdAt
            };
          })
          .filter(item => {
            // Deve estar ativo
            if (!item.active) return false;

            // Se possuir data de início, já deve ter começado
            if (item.startDate) {
              const start = new Date(item.startDate);
              if (now < start) return false;
            }

            // Se possuir data de fim, ainda não deve ter expirado
            if (item.endDate) {
              const end = new Date(item.endDate);
              if (now > end) return false;
            }

            return true;
          });

        if (activeList.length > 0) {
          // Ordena pelo mais recente criado para dar prioridade à última campanha criada
          activeList.sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });

          setPopup(activeList[0]);

          // Aguarda alguns segundos antes de exibir para uma experiência mais fluida
          const showTimer = setTimeout(() => {
            setIsOpen(true);
          }, 3000); // 3 segundos de delay solicitado

          return () => clearTimeout(showTimer);
        }
      } catch (err) {
        console.error("Erro ao carregar Popup Campanha:", err);
      }
    };

    fetchActivePopup();
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem('discreta_popup_closed', 'true');
  };

  const handleCopyCoupon = async () => {
    if (!popup || !popup.couponCode) return;
    try {
      await navigator.clipboard.writeText(popup.couponCode);
      setCopied(true);
      
      // Registra o clique no Firestore sem bloquear o UX
      try {
        const popupRef = doc(db, 'popups', popup.id);
        updateDoc(popupRef, {
          clickCount: increment(1)
        });
      } catch (err) {
        console.error("Erro ao computar clique no popup:", err);
      }

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar cupom:", err);
    }
  };

  const handleClick = async () => {
    if (!popup) return;

    if (popup.actionType === 'coupon') {
      // Se for cupom, clicar na imagem também aciona a cópia automática
      handleCopyCoupon();
      return;
    }

    // Registra o clique no Firestore sem bloquear o redirecionamento imediato
    try {
      const popupRef = doc(db, 'popups', popup.id);
      updateDoc(popupRef, {
        clickCount: increment(1)
      });
    } catch (err) {
      console.error("Erro ao computar clique no popup:", err);
    }

    sessionStorage.setItem('discreta_popup_closed', 'true');
    setIsOpen(false);

    // Redireciona
    if (popup.linkUrl) {
      setTimeout(() => {
        window.location.href = popup.linkUrl;
      }, 100);
    }
  };

  if (!popup) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          {/* Backdrop Click Closes Popup */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 cursor-default"
            onClick={handleClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-950 shadow-2xl flex flex-col z-10 select-none cursor-pointer"
          >
            {/* Visual Header Option Button (Close X inside or on top) */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 border border-white/10 text-white hover:text-red-500 hover:bg-black/80 flex items-center justify-center transition-all shadow-md focus:outline-none"
              aria-label="Fechar popup"
            >
              <X size={18} />
            </button>

            {/* Banner Creative Display Area */}
            <div onClick={handleClick} className="relative aspect-[3/4.5] sm:aspect-[3/4.2] w-full bg-black flex items-center justify-center">
              <img 
                src={popup.imageUrl} 
                alt={popup.name}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                referrerPolicy="no-referrer"
              />
              
              {/* Subtle Elegant Slogan Mask at very bottom */}
              <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black via-black/40 to-transparent flex items-end justify-center pb-4 pointer-events-none">
                <span className="text-[9px] font-black tracking-[4px] uppercase text-zinc-400 drop-shadow-md">
                  {popup.actionType === 'coupon' ? 'Toque para copiar o cupom' : 'Discreta Boutique • Toque para ver'}
                </span>
              </div>
            </div>

            {/* Coupon Code Display Field Bar (Exibe apenas para tipo cupom) */}
            {popup.actionType === 'coupon' && popup.couponCode && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyCoupon();
                }}
                className="bg-zinc-900/90 border-t border-white/5 px-6 py-5 flex flex-col items-center justify-center gap-2.5 transition-all hover:bg-zinc-900"
              >
                <div className="text-center">
                  <span className="text-[9px] font-black uppercase tracking-[2px] text-zinc-400">Cupom de Desconto Especial</span>
                </div>
                
                <div className="w-full flex items-center justify-between bg-black/60 rounded-2xl border border-dashed border-red-500/50 p-3 relative hover:border-red-500 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-2">
                    <Tag size={16} className="text-red-500 shrink-0 animate-pulse" />
                    <span className="text-base font-black tracking-widest text-white uppercase italic font-mono">
                      {popup.couponCode}
                    </span>
                  </div>
                  
                  <button 
                    className={cn(
                      "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1",
                      copied 
                        ? "bg-emerald-600 text-white" 
                        : "bg-red-650 hover:bg-red-700 text-white shadow-md shadow-red-600/10"
                    )}
                  >
                    {copied ? (
                      <>
                        <Check size={12} /> Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> Copiar
                      </>
                    )}
                  </button>
                </div>
                
                <p className="text-[9px] text-zinc-500 italic font-medium">Toque sobre o cupom para copiar e ganhar desconto!</p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
