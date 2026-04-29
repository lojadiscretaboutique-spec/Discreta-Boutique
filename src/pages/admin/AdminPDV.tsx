import { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Minus, 
  Plus, 
  CreditCard, 
  Banknote, 
  QrCode, 
  X, 
  Package, 
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Hash
} from 'lucide-react';
import { collection, query, where, getDocs, limit, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Button } from '../../components/ui/button';
import { cn, formatCurrency, roundTo2 } from '../../lib/utils';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useAuthStore } from '../../store/authStore';
import { Product, ProductVariant } from '../../services/productService';
import { Customer } from '../../services/customerService';
import { stockMovementService } from '../../services/stockMovementService';
import { cashService, CashSession } from '../../services/cashService';
import { financialService } from '../../services/financialService';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface CartItem {
  productId: string;
  variantId?: string;
  name: string;
  variantName?: string;
  price: number;
  quantity: number;
  sku: string;
  imageUrl?: string;
  discount?: number;
}

// Utility for POS beep sound
const playBeep = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime); 
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  } catch (e) {
    // Ignore
  }
};

export function AdminPDV() {
  const { user, hasPermission } = useAuthStore();
  const { toast } = useFeedback();
  const navigate = useNavigate();
  
  const canPDV = hasPermission('caixa', 'visualizar') || hasPermission('orders', 'criar');

  useEffect(() => {
    if (!canPDV) {
      toast("Você não tem permissão para acessar o PDV", "error");
      navigate("/admin");
    }
  }, [canPDV, navigate, toast]);

  const [searchParams] = useSearchParams();
  const editingOrderId = searchParams.get('orderId');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [modalVariants, setModalVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [stockWarningModal, setStockWarningModal] = useState<{productName: string, stock: number} | null>(null);
  
  // Customer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
  
  // States/Cities/Areas for Customer Registration
  const [availableStates, setAvailableStates] = useState<{ id?: string, nome: string, sigla: string }[]>([]);
  const [availableCities, setAvailableCities] = useState<{ id?: string, nome: string }[]>([]);
  const [availableNeighborhoods, setAvailableNeighborhoods] = useState<{ id?: string, bairro: string }[]>([]);

  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    nome: '',
    whatsapp: '',
    dataNascimento: '',
    status: 'ativo',
    endereco: {
      estado: '',
      cidade: '',
      bairro: '',
      rua: '',
      numero: '',
      complemento: '',
      referencia: ''
    }
  });
  
  // Checkout state
  const [step, setStep] = useState<'cart' | 'payment' | 'success'>('cart');
  const [activeTab, setActiveTab] = useState<'pdv' | 'customer'>('pdv');
  const [payments, setPayments] = useState<{ method: string; amount: number }[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const [lastOrderId, setLastOrderId] = useState('');
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [shipping, setShipping] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [editingOrderType, setEditingOrderType] = useState<string | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check for open session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await cashService.getCurrentSession();
        setCurrentSession(session);
      } catch (err) {
        console.error("Erro ao verificar sessão do caixa:", err);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  // Load order for editing
  useEffect(() => {
    if (editingOrderId) {
      const loadOrder = async () => {
        try {
          const docRef = doc(db, 'orders', editingOrderId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            setEditingOrderType(data.type || 'pdv');
            
            // Set cart
            const loadedCart: CartItem[] = data.items.map((item: any) => ({
              productId: item.productId,
              variantId: item.variantId || undefined,
              name: item.name,
              variantName: item.variantName || undefined,
              price: item.price,
              quantity: item.quantity,
              sku: item.sku || '',
              discount: item.discount || 0,
            }));
            setCart(loadedCart);
            
            // Set Customer
            if (data.customerId) {
              const custSnap = await getDoc(doc(db, 'customers', data.customerId));
              if (custSnap.exists()) {
                setSelectedCustomer({ id: custSnap.id, ...custSnap.data() } as Customer);
              }
            } else if (data.customerName) {
               setSelectedCustomer({ 
                 id: '', 
                 nome: data.customerName, 
                 whatsapp: data.customerWhatsapp || '',
                 status: 'ativo',
                 endereco: { rua: data.customerAddress || '' } 
               } as any);
            }

            // Set global discount if total differs from subtotal - item discounts + shipping
            const subtotal = loadedCart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            const itemsDisc = loadedCart.reduce((acc, item) => acc + (item.discount || 0), 0);
            const shippingVal = data.shipping || data.deliveryFee || 0;
            setShipping(shippingVal);
            
            const calculatedTotal = subtotal - itemsDisc + shippingVal;
            
            if (Math.abs(data.total - calculatedTotal) > 0.01) {
              setGlobalDiscount(Math.max(0, calculatedTotal - data.total));
            }

            // Set Payments
            if (data.payments && Array.isArray(data.payments)) {
              setPayments(data.payments);
            } else if (data.paymentMethod) {
              setPayments([{ method: data.paymentMethod, amount: data.total }]);
            }

            toast("Resumo do pedido carregado para edição.");
          } else {
            toast("Pedido não encontrado.", "error");
            navigate('/admin/pedidos');
          }
        } catch (err) {
          console.error(err);
          toast("Erro ao carregar pedido.", "error");
        }
      };
      loadOrder();
    }
  }, [editingOrderId, navigate, toast]);

  // Focus search input on mount
  useEffect(() => {
    if (searchInputRef.current && activeTab === 'pdv') searchInputRef.current.focus();
  }, [activeTab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        if (cart.length > 0 && step === 'cart') setStep('payment');
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setStep('cart');
        setCart([]);
        setSelectedCustomer(null);
        setPaymentMethod('');
        setReceivedAmount('');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && step === 'cart') {
        setSearchTerm('');
        setSearchResults([]);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, step]);

  // Load delivery areas data when customer tab is active
  useEffect(() => {
    if (activeTab === 'customer') {
      import('../../services/deliveryAreaService').then(({ deliveryAreaService }) => {
        deliveryAreaService.listStates().then(setAvailableStates).catch(console.error);
        deliveryAreaService.listCities().then(setAvailableCities).catch(console.error);
        deliveryAreaService.listDeliveryAreas().then(setAvailableNeighborhoods).catch(console.error);
      }).catch(console.error);
    }
  }, [activeTab]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;

    setSearching(true);
    try {
      const productsRef = collection(db, 'products');
      let exactMatches: Product[] = [];
      const upperTerm = term.toUpperCase();
      const termsToSearch = Array.from(new Set([term, upperTerm]));

      // 1. Check SKU (exact or uppercase) in products
      let q = query(productsRef, where('sku', 'in', termsToSearch), limit(1));
      let snap = await getDocs(q);
      
      if (snap.empty) {
        // 2. Check Barcode / GTIN in products
        q = query(productsRef, where('gtin', '==', term), limit(1));
        snap = await getDocs(q);
      }
      
      if (!snap.empty) {
        const product = { id: snap.docs[0].id, ...snap.docs[0].data() } as Product;
        exactMatches.push(product);
      }

      if (exactMatches.length > 0) {
        playBeep();
        addToCart(exactMatches[0]);
        setSearchTerm('');
        setSearchResults([]);
        return;
      }

      // If not found in main products, search in variantIdentifiers
      const pQ = query(productsRef, where('variantIdentifiers', 'array-contains', term), limit(1));
      const pSnap = await getDocs(pQ);

      if (!pSnap.empty) {
        const productDoc = pSnap.docs[0];
        const product = { id: productDoc.id, ...productDoc.data() } as Product;
        
        // Load its variants
        const vSnap = await getDocs(collection(db, `products/${product.id}/variants`));
        const variantDoc = vSnap.docs.find(d => {
           const v = d.data();
           return v.barcode === term || v.sku === term || termsToSearch.includes(v.sku);
        });

        if (variantDoc) {
           const variant = { id: variantDoc.id, ...variantDoc.data() } as ProductVariant;
           playBeep();
           addToCart(product, variant);
           setSearchTerm('');
           setSearchResults([]);
           return;
        }
      }

      // 4. Se chegou aqui, não achou o EAN/SKU exato. Tentar buscar pelo nome ou pesquisar no termo de busca exato no firebase
      // Se não houver nada no searchResults (pois o usuário bateu enter antes de 300ms), faz a busca aqui
      let currentResults = searchResults;
      if (currentResults.length === 0) {
        const qAll = query(productsRef, where('active', '==', true), limit(1000));
        const snapAll = await getDocs(qAll);
        const allProds = snapAll.docs.map(d => ({id: d.id, ...d.data()} as Product));
        currentResults = allProds.filter(p => {
          return p.name.toLowerCase().includes(term) || 
                 p.sku?.toLowerCase().includes(term) ||
                 p.gtin?.toLowerCase().includes(term) ||
                 p.internalCode?.toLowerCase().includes(term) ||
                 p.variantIdentifiers?.some(vi => vi.toLowerCase().includes(term)) ||
                 p.searchTerms?.some(st => st.includes(term));
        }).slice(0, 15);
        // Atualiza a lista na tela para que, se não houver um exact match e sim múltiplos,
        // o usuário possa clicar na lista.
        setSearchResults(currentResults);
      }

      const exactNameMatch = currentResults.find(p => p.name.toLowerCase().trim() === term);
      if (exactNameMatch) {
         playBeep();
         addToCart(exactNameMatch);
         setSearchTerm('');
         setSearchResults([]);
         return;
      }

      // Check remaining internal codes if local search was tracking it
      const localMatch = currentResults.find(p => 
        p.gtin === term || p.sku === term || p.sku === upperTerm || p.internalCode === term || p.internalCode === upperTerm
      );

      if (localMatch) {
         playBeep();
         addToCart(localMatch);
         setSearchTerm('');
         setSearchResults([]);
         return;
      }

      // Checking current results if it's the only one
      if (currentResults.length === 1) {
        playBeep();
        addToCart(currentResults[0]);
        setSearchTerm('');
        setSearchResults([]);
      } else if (currentResults.length > 1) {
         toast("Múltiplos produtos. Clique em um da lista abaixo.", "warning");
      } else {
         toast("EAN/SKU não encontrado no sistema.", "error");
      }
    } catch (err: unknown) {
      const error = err as any;
      if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
         toast("Índice de busca para variantes não criado no Firebase.", "warning");
         console.warn("Firebase precisa de um index collectionGroup para buscar variantes. Clique no link do console de erro.");
      } else {
         toast("Erro ao buscar produto.", "error");
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSearchCustomer = async () => {
    const cleanPhone = customerSearchTerm.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast("Digite um número de WhatsApp válido (com DDD).", "warning");
      return;
    }

    setIsSearchingCustomer(true);
    setCustomerNotFound(false);
    try {
      const snap = await getDoc(doc(db, 'customers', cleanPhone));
      if (snap.exists()) {
        const c = { id: snap.id, ...snap.data() } as Customer;
        setSelectedCustomer(c);
        toast(`Cliente ${c.nome} encontrado!`, "success");
        // Pre-fill form with existing data for possible editions
        setNewCustomer({
          id: c.id,
          nome: c.nome || '',
          whatsapp: c.whatsapp || cleanPhone,
          dataNascimento: c.dataNascimento || '',
          status: c.status || 'ativo',
          endereco: c.endereco || { estado: '', cidade: '', bairro: '', rua: '', numero: '', complemento: '', referencia: '' }
        });
        setCustomerNotFound(true); // Reusing this boolean to show the form
      } else {
        setSelectedCustomer(null);
        setCustomerNotFound(true);
        setNewCustomer({
          id: '',
          nome: '',
          whatsapp: cleanPhone,
          dataNascimento: '',
          status: 'ativo',
          endereco: { estado: '', cidade: '', bairro: '', rua: '', numero: '', complemento: '', referencia: '' }
        });
        toast("Cliente não encontrado. Preencha os dados para cadastrar.", "info");
      }
    } catch (err) {
      console.error(err);
      toast("Erro ao buscar cliente.", "error");
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.nome || !newCustomer.whatsapp) {
      toast("Nome e WhatsApp são obrigatórios.", "warning");
      return;
    }
    
    setIsRegisteringCustomer(true);
    try {
      const { customerService } = await import('../../services/customerService');
      const cId = await customerService.saveCustomer(newCustomer as Customer);
      const c = await customerService.getCustomerByWhatsapp(cId);
      if (c) {
        setSelectedCustomer(c);
        toast("Cliente salvo com sucesso!", "success");
        setCustomerNotFound(false);
        setCustomerSearchTerm('');
        setNewCustomer({
          nome: '',
          whatsapp: '',
          dataNascimento: '',
          status: 'ativo',
          endereco: { estado: '', cidade: '', bairro: '', rua: '', numero: '', complemento: '', referencia: '' }
        });
        setStep('payment');
      }
    } catch (err: any) {
      console.error(err);
      toast(err.message || "Erro ao cadastrar cliente.", "error");
    } finally {
      setIsRegisteringCustomer(false);
    }
  };

  // Search products
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearching(true);
      try {
        const q = query(
          collection(db, 'products'),
          where('active', '==', true),
          limit(1000) // Increase limits so standard store sizes are fully searched by client-filter
        );
        const snap = await getDocs(q);
        const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        
        // Client side filtering for better UX with partial terms
        const filtered = products.filter(p => {
          const s = searchTerm.toLowerCase();
          return p.name.toLowerCase().includes(s) || 
                 p.sku?.toLowerCase().includes(s) ||
                 p.gtin?.toLowerCase().includes(s) ||
                 p.internalCode?.toLowerCase().includes(s) ||
                 p.variantIdentifiers?.some(vi => vi.toLowerCase().includes(s)) ||
                 p.searchTerms?.some(st => st.includes(s));
        }).slice(0, 15); // Cap displayed items
        
        setSearchResults(filtered);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const openVariantModal = async (product: Product) => {
    setSelectedProduct(product);
    setIsVariantModalOpen(true);
    setLoadingVariants(true);
    setModalVariants([]);
    try {
       const snap = await getDocs(collection(db, `products/${product.id}/variants`));
       const fetchedVariants = snap.docs.map(d => ({id: d.id, ...d.data()} as ProductVariant));
       setModalVariants(fetchedVariants);
    } catch(err) {
       console.error("Erro listando variações:", err);
       toast("Erro ao listar as variações desse produto.", "error");
    } finally {
       setLoadingVariants(false);
    }
  };

  const addToCart = (product: Product, variant?: ProductVariant) => {
    if (product.hasVariants && !variant) {
      openVariantModal(product);
      return;
    }

    const currentStock = variant ? (variant.stock || 0) : (product.stock || 0);
    if (currentStock <= 0) {
      setStockWarningModal({
        productName: variant ? `${product.name} - ${variant.name}` : product.name,
        stock: currentStock
      });
      return;
    }

    const productId = product.id!;
    const variantId = variant?.id;
    const price = variant?.price || product.promoPrice || product.price;
    const name = product.name;
    const variantName = variant?.name;
    const sku = variant?.sku || product.sku;
    const imageUrl = variant?.imageUrl || product.images?.[0]?.url;

    setCart(prev => {
      const existingIndex = prev.findIndex(item => 
        item.productId === productId && item.variantId === variantId
      );

      if (existingIndex > -1) {
        const newCart = [...prev];
        newCart[existingIndex].quantity += 1;
        return newCart;
      }

      return [...prev, {
        productId,
        variantId,
        name,
        variantName,
        price,
        quantity: 1,
        sku,
        imageUrl,
        discount: 0
      }];
    });

    setSearchTerm('');
    setSearchResults([]);
    setIsVariantModalOpen(false);
    setSelectedProduct(null);
    if (searchInputRef.current) searchInputRef.current.focus();
    
    toast(`Adicionado: ${name} ${variantName ? `(${variantName})` : ''}`, 'success');
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateQty = (index: number, delta: number) => {
    setCart(prev => {
      const newCart = [...prev];
      const newQty = newCart[index].quantity + delta;
      if (newQty < 1) return prev;
      newCart[index].quantity = newQty;
      return newCart;
    });
  };

  const updateItemDiscount = (index: number, value: number) => {
    setCart(prev => {
      const newCart = [...prev];
      newCart[index].discount = value;
      return newCart;
    });
  };

  const cartSubtotal = roundTo2(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0));
  const itemsDiscountTotal = roundTo2(cart.reduce((sum, item) => sum + (item.discount || 0), 0));
  const calculatedTotal = roundTo2(cartSubtotal - itemsDiscountTotal + shipping - globalDiscount);
  const total = Math.max(0, calculatedTotal);
  
  const totalDiscount = roundTo2((cartSubtotal + shipping) - total);
  
  const totalPaid = roundTo2(payments.reduce((acc, p) => acc + p.amount, 0));
  const totalCashPaid = roundTo2(payments
    .filter(p => p.method === 'Dinheiro')
    .reduce((acc, p) => acc + p.amount, 0));
  const change = totalPaid > total ? roundTo2(totalPaid - total) : 0;
  
  useEffect(() => {
    if (step === 'payment') {
      const paid = payments.reduce((acc, p) => acc + p.amount, 0);
      const remaining = total - paid;
      
      if (remaining > 0) {
        setPartialAmount(roundTo2(remaining).toString());
      } else {
        setPartialAmount('0.00');
      }
    }
  }, [step, total, payments]);

  const handleFinishOrder = async () => {
    if (cart.length === 0) return;

    if (!currentSession) {
      toast("Para realizar vendas, o caixa deve estar ABERTO.", "error");
      navigate("/admin/caixa");
      return;
    }
    
    const paidTotal = payments.reduce((acc, p) => acc + p.amount, 0);
    if (Math.abs(paidTotal - total) > 0.01) {
      toast(`O total pago (${formatCurrency(paidTotal)}) deve ser igual ao total do pedido (${formatCurrency(total)})`, "error");
      return;
    }

    setIsFinishing(true);
    try {
      // 1. Prepare order data
      const orderData: any = {
        sessionId: currentSession?.id, // Tie order to cash session
        items: cart.map(item => ({
          productId: item.productId,
          variantId: item.variantId || null,
          name: item.name,
          variantName: item.variantName || null,
          price: item.price,
          quantity: item.quantity,
          sku: item.sku,
          discount: item.discount || 0,
          subtotal: roundTo2((item.price * item.quantity) - (item.discount || 0))
        })),
        subtotal: cartSubtotal,
        total,
        discount: totalDiscount,
        shipping: shipping,
        paymentMethod: payments.map(p => p.method).join(' + '),
        payments: payments,
        status: 'ENTREGUE',
        type: editingOrderId ? editingOrderType : 'pdv',
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.nome || 'Cliente Balcão',
        customerWhatsapp: selectedCustomer?.whatsapp || null,
        customerAddress: selectedCustomer?.endereco?.rua || (selectedCustomer as any)?.customerAddress || '',
        sellerId: user?.uid,
        sellerName: user?.email,
        updatedAt: serverTimestamp(),
      };

      let currentOrderId = editingOrderId;

      if (editingOrderId) {
        // UPDATE EXISTING
        await updateDoc(doc(db, 'orders', editingOrderId), orderData);
        
        if (editingOrderType === 'online') {
            await stockMovementService.realizeMovementsByOrderId(editingOrderId, 'Venda (Loja Online/Site)');
        } else {
            // For pdv orders that somehow were edited and need realizing
            await stockMovementService.realizeMovementsByOrderId(editingOrderId);
        }
        
        // Se estiver editando, limpamos os lançamentos financeiros antigos associados a este pedido
        // para regerar os novos (caso tenha mudado valor ou forma de pagto)
        await financialService.deleteTransactionsByOrderId(editingOrderId);
        await cashService.deleteTransactionsByOrderId(editingOrderId);
        
        toast("Pedido atualizado com sucesso!", "success");
      } else {
        // CREATE NEW
        orderData.createdAt = serverTimestamp();
        const orderRef = await addDoc(collection(db, 'orders'), orderData);
        currentOrderId = orderRef.id;

        // Update stock only for NEW orders to avoid double deduction 
        for (const item of cart) {
          await stockMovementService.registerMovement({
            productId: item.productId,
            productName: item.name,
            variantId: item.variantId || undefined,
            sku: item.sku,
            quantity: item.quantity,
            type: 'out',
            reason: 'Venda PDV',
            channel: 'Loja Física',
            orderId: orderRef.id
          });
        }
      }

      // ==========================================
      // LANÇAMENTO FINANCEIRO INTELIGENTE (AUTOMÁTICO)
      // ==========================================
      const todayISO = new Date().toISOString().split('T')[0];
      const orderRefTag = currentOrderId!.slice(-6).toUpperCase();

      // 1. Registro no Módulo Financeiro Global (DRE / Fluxo de Caixa Geral)
      await financialService.saveTransaction({
        type: 'income',
        description: `PDV: Venda #${orderRefTag} | ${orderData.customerName}`,
        amount: total,
        dueDate: todayISO,
        paymentDate: todayISO,
        status: 'paid',
        category: 'Vendas',
        orderId: currentOrderId!,
        paymentMethod: orderData.paymentMethod,
        notes: `Venda balcão realizada por ${user?.email}. Itens: ${cart.length}.`
      });

      // 2. Registro no Controle de Caixa Atual (Shift balance / Movimentações de Turno)
      // Gravamos cada pagamento separadamente para conferência cega do operador no fechamento
      for (const p of payments) {
        if (p.amount > 0) {
          await cashService.addTransaction({
            sessionId: currentSession.id!,
            type: 'entrada',
            category: 'VENDA_PDV',
            amount: p.amount,
            description: `Venda PDV #${orderRefTag}`,
            paymentMethod: p.method,
            userId: user!.uid,
            source: 'loja_fisica',
            orderId: currentOrderId!
          });
        }
      }
      // ==========================================

      setLastOrderId(currentOrderId!);
      setStep('success');
      setCart([]);
      setSelectedCustomer(null);
      setPayments([]);
      setPaymentMethod('');
      setReceivedAmount('');
    } catch (error) {
      console.error("PDV Order error:", error);
      toast("Erro ao processar pedido. Verifique sua conexão.", "error");
    } finally {
      setIsFinishing(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-3xl p-12 max-w-md w-full text-center shadow-2xl overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-full h-2 bg-green-500"></div>
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">VENDA REALIZADA!</h1>
          <p className="text-slate-400 mb-8 font-medium italic">Pedido #{lastOrderId.slice(-6).toUpperCase()}</p>
          
          <div className="space-y-3">
             <Button 
                onClick={() => setStep('cart')}
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold uppercase tracking-widest"
             >
                Nova Venda (F2)
             </Button>
             <Button 
                variant="outline"
                className="w-full h-14 border-2 border-slate-700 text-slate-300 rounded-xl font-bold uppercase tracking-widest"
                onClick={() => navigate('/admin/pedidos')}
             >
                Ver Pedidos
             </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (checkingSession) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
           <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
           <span className="text-xs font-black uppercase tracking-widest text-slate-400">Verificando Caixa...</span>
        </div>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-4 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 rounded-[2.5rem] p-12 max-w-md w-full shadow-2xl"
        >
           <div className="w-20 h-20 bg-red-600/10 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
             <AlertCircle size={40} />
           </div>
           <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Caixa Fechado!</h2>
           <p className="text-slate-400 font-medium leading-relaxed mb-8">
             O PDV está bloqueado porque não há nenhum caixa aberto no momento. 
             Para começar a vender, você precisa abrir o caixa primeiro.
           </p>
           <div className="flex flex-col gap-3">
             <Button 
              onClick={() => navigate('/admin/caixa')}
              className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest h-14 px-8 rounded-2xl shadow-xl shadow-red-600/20"
             >
               Ir para Gerenciar Caixa
             </Button>
             <Button 
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="text-slate-400 font-bold uppercase tracking-widest"
             >
               Voltar ao Início
             </Button>
           </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Header PDV */}
      <header className="h-16 bg-slate-900 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/admin')}
            className="p-2 hover:bg-slate-900/10 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.3)]">
              <Package size={16} className="text-white" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-tighter italic">Discreta PDV <span className="text-xs font-normal not-italic text-slate-400 ml-2">v1.0</span></h1>
          </div>
          {editingOrderId && (
             <div className="flex items-center gap-3 ml-6 bg-amber-500/10 border border-amber-500/20 px-4 py-1.5 rounded-full animate-in fade-in slide-in-from-left-4">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Editando Pedido #{editingOrderId.slice(-6).toUpperCase()}</span>
                <button 
                   onClick={() => navigate('/admin/pdv')} 
                   className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors border-l border-white/10 pl-3 ml-1"
                >
                   Descartar
                </button>
             </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <Button 
            className="lg:hidden h-10 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] items-center gap-2"
            onClick={() => setShowMobileCart(true)}
          >
            <ShoppingCart size={16} />
            {cart.length} ITENS
          </Button>

          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Operador</span>
            <span className="text-sm font-bold text-white uppercase">{user?.email?.split('@')[0]}</span>
          </div>
          <div className="h-8 w-px bg-slate-900/10"></div>
          <div className="flex items-center gap-3 text-red-500 font-mono text-xl font-bold">
             {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </header>
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* LEFT: Search & Products */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 p-4 lg:p-6 overflow-hidden">
          
          {/* Tabs header mimicking Bling */}
          <div className="flex gap-1 mb-6 border-b border-white/10 pb-4">
             <button onClick={() => setActiveTab('pdv')} className={cn("flex-1 py-3 px-4 text-center font-black uppercase text-xs tracking-widest rounded-l-xl transition-all", activeTab === 'pdv' ? "bg-red-600 text-white" : "bg-slate-900/5 text-slate-400")}>
               1. Produto / Leitor
             </button>
             <button onClick={() => setActiveTab('customer')} className={cn("flex-1 py-3 px-4 text-center font-black uppercase text-xs tracking-widest rounded-r-xl transition-all", activeTab === 'customer' ? "bg-red-600 text-white" : "bg-slate-900/5 text-slate-400")}>
               2. Cliente (Opcional)
             </button>
          </div>
          
          {(activeTab === 'pdv') && (
            <>
              <div className="flex justify-between items-center mb-4 px-2">
                 <h3 className="text-[10px] font-black tracking-widest uppercase text-slate-400">Venda Direta</h3>
                 <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-500 bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                   <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                   Leitor de Código de Barras Ativado
                 </div>
              </div>

              <form onSubmit={handleSearchSubmit} className="relative mb-6">
                 <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                   <Search size={22} />
                 </div>
                 <input 
                   ref={searchInputRef}
                   type="text"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Pesquise por Nome, SKU ou GTIN (Esc para limpar)"
                   className="w-full h-16 bg-slate-900/5 border-2 border-white/10 rounded-2xl pl-14 pr-6 text-xl font-medium focus:border-red-600 focus:bg-slate-900/10 outline-none transition-all placeholder:text-slate-300"
                   autoFocus
                 />
                 {searching && (
                   <div className="absolute right-4 top-1/2 -translate-y-1/2">
                     <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                   </div>
                 )}
              </form>

              {/* Results Area */}
              <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
                {searchResults.length > 0 ? (
                   <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                     {searchResults.map(p => {
                       const mainImg = p.images?.find(i => i.isMain)?.url || p.images?.[0]?.url;
                       return (
                        <button 
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="bg-slate-900/5 border border-white/10 rounded-2xl p-3 flex flex-col items-center text-center hover:bg-slate-900/10 hover:border-red-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all group"
                        >
                          <div className="w-full aspect-square bg-slate-800 rounded-xl mb-3 overflow-hidden relative">
                             {mainImg ? (
                               <img src={mainImg} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={24} /></div>
                             )}
                             <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-white uppercase tracking-tighter">
                                Est: {p.stock}
                             </div>
                          </div>
                          <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-tight h-8 mb-2 group-hover:text-red-500 transition-colors">{p.name}</h3>
                          <p className="text-sm font-black text-white">{formatCurrency(p.promoPrice || p.price)}</p>
                        </button>
                       );
                     })}
                   </div>
                ) : searchTerm.length >= 2 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-30">
                    <AlertCircle size={64} className="mb-4" />
                    <p className="text-lg font-bold">Nenhum produto encontrado</p>
                  </div>
                ) : cart.length > 0 ? (
                  <div className="flex flex-col items-center justify-center h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="w-[280px] h-[280px] bg-slate-800 rounded-3xl overflow-hidden mb-8 border border-white/10 shadow-2xl relative group">
                      {cart[cart.length - 1].imageUrl ? (
                         <img src={cart[cart.length - 1].imageUrl} alt="Último item" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={80} /></div>
                      )}
                      <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-500/20">
                        Último Adicionado
                      </div>
                    </div>
                    <h2 className="text-3xl font-black text-white text-center px-8 mb-2 tracking-tighter leading-tight max-w-xl">
                       {cart[cart.length - 1].name}
                    </h2>
                    {cart[cart.length - 1].variantName && (
                      <p className="text-red-500 font-bold uppercase tracking-widest mb-4">
                         {cart[cart.length - 1].variantName}
                      </p>
                    )}
                <div className="text-6xl font-[900] text-white tracking-tighter mt-4">
                   {formatCurrency(cart[cart.length - 1].price)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full opacity-10">
                <Hash size={120} className="mb-4" />
                <p className="text-2xl font-black italic uppercase tracking-widest">Aguardando entrada...</p>
              </div>
            )}
            </div>
            </>
          )}

            {activeTab === 'customer' && (
              <div className="p-6 text-white bg-slate-900/5 rounded-2xl border border-white/10 m-2 flex flex-col h-full overflow-y-auto no-scrollbar">
                <h2 className="text-2xl font-bold mb-4">Cliente</h2>
                
                <label className="text-sm font-bold text-slate-400 uppercase mb-2 block">Buscar por WhatsApp</label>
                <div className="flex gap-2 mb-8">
                  <input 
                    value={customerSearchTerm}
                    onChange={(e) => setCustomerSearchTerm(e.target.value)}
                    placeholder="Ex: 11999998888"
                    className="flex-1 h-12 bg-black/20 border border-white/10 rounded-xl px-4 text-lg focus:border-red-600 outline-none transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchCustomer()}
                  />
                  <Button 
                    onClick={handleSearchCustomer} 
                    className="h-12 px-8 bg-red-600 hover:bg-red-700 font-bold"
                    disabled={isSearchingCustomer}
                  >
                    {isSearchingCustomer ? "Buscando..." : "Buscar"}
                  </Button>
                </div>

                {selectedCustomer && !customerNotFound && (
                  <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-xl mb-6 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-bold text-green-500 mb-2">Cliente Selecionado</h3>
                      <p className="text-lg"><strong>Nome:</strong> {selectedCustomer.nome}</p>
                      <p className="text-lg"><strong>WhatsApp:</strong> {selectedCustomer.whatsapp}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button 
                        variant="outline" 
                        className="border-green-500 text-green-500 hover:bg-green-500/10"
                        onClick={() => {
                          setNewCustomer({
                            id: selectedCustomer.id,
                            nome: selectedCustomer.nome || '',
                            whatsapp: selectedCustomer.whatsapp || '',
                            dataNascimento: selectedCustomer.dataNascimento || '',
                            status: selectedCustomer.status || 'ativo',
                            endereco: selectedCustomer.endereco || { estado: '', cidade: '', bairro: '', rua: '', numero: '', complemento: '', referencia: '' }
                          });
                          setCustomerNotFound(true); // Reusing this to show form
                        }}
                      >
                        Editar Cliente
                      </Button>
                      <Button 
                        variant="outline" 
                        className="border-red-500 text-red-500 hover:bg-red-500/10"
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerNotFound(false);
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                )}

                {customerNotFound && (
                  <form onSubmit={handleRegisterCustomer} className="flex-1 animate-in fade-in slide-in-from-bottom-4">
                    <div className="space-y-4 bg-black/20 p-6 rounded-xl border border-white/5">
                      <h3 className="text-lg font-bold text-red-500">
                        {newCustomer.id ? 'Alterar Dados do Cliente' : 'Cadastrar Novo Cliente'}
                      </h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Nome Completo *</label>
                          <input 
                            required
                            value={newCustomer.nome}
                            onChange={e => setNewCustomer(prev => ({...prev, nome: e.target.value}))}
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            placeholder="João da Silva"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">WhatsApp *</label>
                          <input 
                            required
                            value={newCustomer.whatsapp}
                            onChange={e => setNewCustomer(prev => ({...prev, whatsapp: e.target.value}))}
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            placeholder="11999998888"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Data de Nascimento (Opcional)</label>
                          <input 
                            type="date"
                            value={newCustomer.dataNascimento}
                            onChange={e => setNewCustomer(prev => ({...prev, dataNascimento: e.target.value}))}
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4 text-white"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10 mt-4">
                        <h4 className="text-sm font-bold text-white mb-4">Endereço (Obrigatório)</h4>
                        
                        <datalist id="estados-sugestoes">
                          {availableStates.map(state => (
                            <option key={state.id || state.sigla} value={state.sigla} />
                          ))}
                        </datalist>

                        <datalist id="cidades-sugestoes">
                          {availableCities.map(city => (
                            <option key={city.id || city.nome} value={city.nome} />
                          ))}
                        </datalist>

                        <datalist id="bairros-sugestoes">
                          {availableNeighborhoods.map(hood => (
                            <option key={hood.id || hood.bairro} value={hood.bairro} />
                          ))}
                        </datalist>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Estado *</label>
                            <input 
                              required
                              list="estados-sugestoes"
                              placeholder="SP" 
                              value={newCustomer.endereco?.estado}
                              onChange={e => setNewCustomer(prev => ({...prev, endereco: {...prev.endereco!, estado: e.target.value}}))}
                              className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Cidade *</label>
                            <input 
                              required
                              list="cidades-sugestoes"
                              placeholder="São Paulo"
                              value={newCustomer.endereco?.cidade}
                              onChange={e => setNewCustomer(prev => ({...prev, endereco: {...prev.endereco!, cidade: e.target.value}}))}
                              className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Bairro *</label>
                            <input 
                              required
                              list="bairros-sugestoes"
                              placeholder="Centro"
                              value={newCustomer.endereco?.bairro}
                              onChange={e => setNewCustomer(prev => ({...prev, endereco: {...prev.endereco!, bairro: e.target.value}}))}
                              className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Rua *</label>
                            <input 
                              required
                              placeholder="Nome da rua"
                              value={newCustomer.endereco?.rua}
                              onChange={e => setNewCustomer(prev => ({...prev, endereco: {...prev.endereco!, rua: e.target.value}}))}
                              className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Número *</label>
                            <input 
                              required
                              placeholder="123"
                              value={newCustomer.endereco?.numero}
                              onChange={e => setNewCustomer(prev => ({...prev, endereco: {...prev.endereco!, numero: e.target.value}}))}
                              className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Complemento</label>
                            <input 
                              placeholder="Apto 45"
                              value={newCustomer.endereco?.complemento}
                              onChange={e => setNewCustomer(prev => ({...prev, endereco: {...prev.endereco!, complemento: e.target.value}}))}
                              className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Ponto de Referência *</label>
                          <input 
                            required
                            placeholder="Próximo ao mercado X"
                            value={newCustomer.endereco?.referencia}
                            onChange={e => setNewCustomer(prev => ({...prev, endereco: {...prev.endereco!, referencia: e.target.value}}))}
                            className="w-full h-12 bg-slate-900/5 border border-white/10 rounded-xl px-4 mb-4"
                          />
                        </div>

                      </div>

                      <div className="flex gap-4 mt-6">
                        {newCustomer.id && (
                          <Button 
                            type="button"
                            variant="outline"
                            className="h-14 flex-1 border-white/20 text-white hover:bg-slate-900/10 font-bold"
                            onClick={() => {
                              setCustomerNotFound(false);
                            }}
                          >
                            Cancelar
                          </Button>
                        )}
                        <Button 
                          type="submit" 
                          className="h-14 flex-[2] bg-green-600 hover:bg-green-700 text-white font-bold text-lg"
                          disabled={isRegisteringCustomer}
                        >
                          {isRegisteringCustomer ? "Salvando..." : (newCustomer.id ? "Atualizar e Continuar" : "Cadastrar e Continuar")}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}

          </div>

        {/* RIGHT: Cart & Actions */}
        <div className={cn(
          "fixed inset-0 lg:relative lg:inset-auto z-[110] lg:z-auto w-full lg:w-[450px] bg-slate-900 flex flex-col shrink-0 overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.5)] lg:shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-300",
          showMobileCart ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}>
           {/* Mobile Close Button */}
           <button 
             onClick={() => setShowMobileCart(false)}
             className="lg:hidden absolute top-4 left-4 z-[120] w-10 h-10 bg-slate-900/10 rounded-full flex items-center justify-center text-white"
           >
             <X size={20} />
           </button>

           <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 pl-16 lg:pl-6 shrink-0 bg-slate-950/50">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-red-500" />
                <h2 className="font-black uppercase tracking-widest text-xs">Cesto de Compras</h2>
              </div>
              <span className="bg-red-600/20 text-red-500 px-3 py-1 rounded-full text-[10px] font-black">{cart.length} ITENS</span>
           </div>

           {/* Cart List */}
           <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
              {cart.length > 0 ? cart.map((item, idx) => (
                <div key={`${item.productId}-${item.variantId}-${idx}`} className="bg-slate-900/5 border border-white/10 rounded-2xl p-4 flex gap-4 animate-in fade-in slide-in-from-right-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-xl overflow-hidden shrink-0">
                    {item.imageUrl ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <div className="w-full h-full flex items-center justify-center"><Package size={20} /></div>}
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{item.name}</h4>
                    {item.variantName && <span className="text-[10px] text-red-500 font-bold uppercase">{item.variantName}</span>}
                    <div className="mt-2 flex justify-between items-center">
                       <div className="flex items-center gap-3">
                         <button onClick={() => updateQty(idx, -1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900/10 hover:bg-red-600 transition-colors"><Minus size={12} /></button>
                         <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                         <button onClick={() => updateQty(idx, 1)} className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-900/10 hover:bg-red-600 transition-colors"><Plus size={12} /></button>
                       </div>
                       <div className="flex flex-col items-end">
                         <span className="text-sm font-black text-white">{formatCurrency(item.price * item.quantity)}</span>
                         <div className="flex items-center gap-1 mt-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Desc Reais:</span>
                            <input 
                              type="number"
                              value={item.discount || 0}
                              onChange={(e) => updateItemDiscount(idx, parseFloat(e.target.value) || 0)}
                              onBlur={(e) => updateItemDiscount(idx, roundTo2(parseFloat(e.target.value)) || 0)}
                              className="w-16 bg-slate-900/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] font-black text-green-500 outline-none focus:border-green-500 transition-colors"
                            />
                         </div>
                       </div>
                    </div>
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="self-center p-2 text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-8">
                  <ShoppingCart size={48} className="mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">Seu carrinho está vazio</p>
                </div>
              )}
           </div>

           {/* Totals & Main Action */}
           <div className="p-6 bg-slate-950 border-t border-white/20">
              <div className="space-y-2 mb-6">
                 <div className="flex justify-between text-sm">
                   <span className="text-slate-400 font-medium">Subtotal</span>
                   <span className="text-white font-bold">{formatCurrency(cartSubtotal)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-slate-400 font-medium">Descontos (Pedido)</span>
                   <div className="flex items-center gap-2">
                      <span className="text-green-500 font-bold">-</span>
                      <input 
                        type="number"
                        value={globalDiscount}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setGlobalDiscount(val);
                        }}
                        onBlur={(e) => {
                          const val = roundTo2(parseFloat(e.target.value)) || 0;
                          setGlobalDiscount(val);
                        }}
                        className="w-20 bg-slate-900/5 border border-white/10 rounded px-2 py-1 text-xs font-black text-green-500 text-right outline-none focus:border-green-500 transition-colors"
                        placeholder="0,00"
                      />
                   </div>
                 </div>
                 {itemsDiscountTotal > 0 && (
                   <div className="flex justify-between text-sm">
                     <span className="text-slate-400 font-medium">Desc. nos Itens</span>
                     <span className="text-green-500 font-bold">- {formatCurrency(itemsDiscountTotal)}</span>
                   </div>
                 )}
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-slate-400 font-medium">Frete (Manual)</span>
                   <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-bold">+</span>
                      <input 
                        type="number"
                        value={shipping}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setShipping(val);
                        }}
                        onBlur={(e) => {
                          const val = roundTo2(parseFloat(e.target.value)) || 0;
                          setShipping(val);
                        }}
                        className="w-20 bg-slate-900/5 border border-white/10 rounded px-2 py-1 text-xs font-black text-white text-right outline-none focus:border-red-500 transition-colors"
                        placeholder="0,00"
                      />
                   </div>
                 </div>
                 <div className="h-px bg-slate-900/10 my-2"></div>
                 <div className="flex justify-between items-end">
                   <span className="text-sm font-black uppercase text-slate-400">Total a Pagar</span>
                   <span className="text-4xl font-[900] text-red-600 tracking-tighter shadow-red-600/20 drop-shadow-lg">{formatCurrency(total)}</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                 <Button 
                    variant="outline" 
                    className="h-12 border-slate-700 text-slate-400 font-bold uppercase text-[10px] hover:bg-slate-800"
                    onClick={() => {
                        if (confirm('Limpar venda atual?')) setCart([]);
                    }}
                 >
                    Cancelar
                 </Button>
                 <Button 
                    className="h-12 bg-slate-900 text-white hover:bg-slate-200 font-bold uppercase text-[10px]"
                    onClick={() => setStep('payment')}
                    disabled={cart.length === 0}
                 >
                    Pagamento (F5)
                 </Button>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {step === 'payment' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-slate-950/50">
                 <h2 className="text-xl font-black italic uppercase tracking-tighter">FINALIZAR VENDA</h2>
                 <button onClick={() => setStep('cart')} className="p-2 hover:bg-slate-900/10 rounded-full"><X size={24} /></button>
              </div>

              <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                 {/* Methods & Payment Inputs */}
                 <div className="flex-1 p-8 overflow-y-auto no-scrollbar border-b lg:border-b-0 lg:border-r border-white/10">
                    <div className="flex justify-between items-center mb-6">
                       <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Adicionar Pagamento</h3>
                       <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Restante</span>
                          <div className={cn("text-2xl font-black italic tracking-tighter", (total - roundTo2(payments.reduce((acc, p) => acc + p.amount, 0))) > 0 ? "text-red-500" : "text-green-500")}>
                             {formatCurrency(Math.max(0, roundTo2(total - payments.reduce((acc, p) => acc + p.amount, 0))))}
                          </div>
                       </div>
                    </div>

                    <div className="bg-slate-900/5 p-6 rounded-2xl mb-8 border border-white/10">
                       <div className="flex flex-col md:flex-row gap-6 items-end">
                          <div className="flex-1 w-full">
                             <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Valor a Lançar</label>
                             <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl italic">R$</span>
                                <input 
                                  type="number" 
                                  step="0.01"
                                  value={partialAmount}
                                  onChange={(e) => setPartialAmount(e.target.value)}
                                  onBlur={(e) => setPartialAmount(roundTo2(parseFloat(e.target.value)).toString())}
                                  className="w-full h-16 bg-black/40 border-2 border-white/10 rounded-2xl pl-14 pr-4 text-3xl font-black text-white outline-none focus:border-red-600 focus:bg-black/60 transition-all placeholder:text-slate-100"
                                  placeholder="0,00"
                                />
                             </div>
                          </div>
                          <Button 
                            variant="outline"
                            className="h-16 px-6 border-2 border-white/10 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-900/5 hover:text-white"
                            onClick={() => {
                               const rem = total - payments.reduce((acc, p) => acc + p.amount, 0);
                               setPartialAmount(rem > 0 ? rem.toFixed(2) : '0.00');
                            }}
                          >
                            Total Restante
                          </Button>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                       <PaymentBtn 
                         icon={<QrCode size={24} />} 
                         label="PIX" 
                         active={paymentMethod === 'pix'} 
                         onClick={() => {
                            setPaymentMethod('pix');
                            const val = parseFloat(partialAmount || '0');
                            if (val > 0) {
                               setPayments([...payments, { method: 'Pix', amount: val }]);
                               toast(`Lançado: ${formatCurrency(val)} no Pix`, 'success');
                            } else {
                               toast("Informe um valor maior que zero", "warning");
                            }
                         }} 
                       />
                       <PaymentBtn 
                         icon={<CreditCard size={24} />} 
                         label="Crédito" 
                         active={paymentMethod === 'credito'} 
                         onClick={() => {
                            setPaymentMethod('credito');
                            const val = parseFloat(partialAmount || '0');
                            if (val > 0) {
                               setPayments([...payments, { method: 'Cartão Crédito', amount: val }]);
                               toast(`Lançado: ${formatCurrency(val)} no Crédito`, 'success');
                            } else {
                               toast("Informe um valor maior que zero", "warning");
                            }
                         }} 
                       />
                       <PaymentBtn 
                         icon={<CreditCard size={24} />} 
                         label="Débito" 
                         active={paymentMethod === 'debito'} 
                         onClick={() => {
                            setPaymentMethod('debito');
                            const val = parseFloat(partialAmount || '0');
                            if (val > 0) {
                               setPayments([...payments, { method: 'Cartão Débito', amount: val }]);
                               toast(`Lançado: ${formatCurrency(val)} no Débito`, 'success');
                            } else {
                               toast("Informe um valor maior que zero", "warning");
                            }
                         }} 
                       />
                       <PaymentBtn 
                         icon={<Banknote size={24} />} 
                         label="Dinheiro" 
                         active={paymentMethod === 'dinheiro'} 
                         onClick={() => {
                            setPaymentMethod('dinheiro');
                            const val = parseFloat(partialAmount || '0');
                            if (val > 0) {
                               setPayments([...payments, { method: 'Dinheiro', amount: val }]);
                               toast(`Lançado: ${formatCurrency(val)} em Dinheiro`, 'success');
                            } else {
                               toast("Informe um valor maior que zero", "warning");
                            }
                         }} 
                       />
                    </div>

                    {paymentMethod === 'dinheiro' && (
                       <div className="p-6 bg-slate-900/5 rounded-2xl border border-white/10 animate-in fade-in slide-in-from-top-2">
                          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Calculadora de Troco (Opcional)</label>
                          <div className="flex gap-4 items-center">
                             <div className="flex-1">
                                <span className="text-[10px] font-bold text-slate-300 block mb-1">Mão do Cliente (Cédula)</span>
                                <input 
                                  type="number"
                                  value={receivedAmount}
                                  onChange={(e) => setReceivedAmount(e.target.value)}
                                  onBlur={(e) => setReceivedAmount(roundTo2(parseFloat(e.target.value)).toString())}
                                  className="bg-transparent border-b border-white/10 w-full text-3xl font-black text-white outline-none focus:border-red-600 transition-colors pb-2"
                                  placeholder="0,00"
                                />
                             </div>
                             {receivedAmount && parseFloat(receivedAmount) > (totalCashPaid + roundTo2(parseFloat(partialAmount || '0'))) && (
                               <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20 text-right shrink-0">
                                  <span className="text-[10px] font-black text-green-500 uppercase italic block mb-1">Troco a devolver:</span>
                                  <span className="text-2xl font-black text-green-500">{formatCurrency(roundTo2(parseFloat(receivedAmount) - (totalCashPaid + roundTo2(parseFloat(partialAmount || '0')))))}</span>
                               </div>
                             )}
                          </div>
                       </div>
                    )}
                 </div>

                 {/* Summary & Payments List */}
                 <div className="w-full lg:w-[400px] bg-black p-8 flex flex-col">
                    <div className="text-center mb-6 bg-slate-900/5 p-6 rounded-3xl border border-white/10">
                       <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2 block">Total da Venda</span>
                       
                       <div className="relative inline-block">
                          <h4 className="text-5xl font-black text-red-600 leading-none tracking-tighter transition-transform">
                             {formatCurrency(total)}
                          </h4>
                       </div>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0 bg-slate-900/5 rounded-3xl border border-white/10 p-6 mb-6">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center justify-between">
                          Pagamentos Lançados
                          <span className="text-white bg-red-600/20 px-2 py-0.5 rounded italic">{payments.length}</span>
                       </h4>
                       <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                          {payments.length > 0 ? payments.map((p, i) => (
                            <div key={i} className="flex justify-between items-center bg-slate-900/5 p-3 rounded-xl border border-white/5 group animate-in slide-in-from-right-4">
                               <div className="flex flex-col flex-1">
                                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{p.method}</span>
                                  <div className="flex items-center gap-1 group/input">
                                     <span className="text-xs font-black text-slate-400">R$</span>
                                     <input 
                                       type="number"
                                       step="0.01"
                                       value={p.amount}
                                       onChange={(e) => {
                                          const newVal = parseFloat(e.target.value) || 0;
                                          const newPayments = [...payments];
                                          newPayments[i] = { ...newPayments[i], amount: newVal };
                                          setPayments(newPayments);
                                       }}
                                       onBlur={(e) => {
                                          const newVal = roundTo2(parseFloat(e.target.value)) || 0;
                                          const newPayments = [...payments];
                                          newPayments[i] = { ...newPayments[i], amount: newVal };
                                          setPayments(newPayments);
                                       }}
                                       className="bg-transparent border-none p-0 text-sm font-black text-white outline-none focus:text-red-500 transition-colors w-full"
                                     />
                                  </div>
                               </div>
                               <button 
                                 onClick={() => setPayments(payments.filter((_, idx) => idx !== i))}
                                 className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-600/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white shrink-0 ml-2"
                               >
                                  <Trash2 size={14} />
                               </button>
                            </div>
                          )) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center">
                               <Banknote size={32} className="mb-2" />
                               <p className="text-[10px] font-bold uppercase">Nenhum pagamento<br/>adicionado</p>
                            </div>
                          )}
                       </div>
                       
                       <div className="pt-4 border-t border-white/10 mt-4 space-y-2">
                          <div className="flex justify-between items-center">
                             <span className="text-[10px] font-black uppercase text-slate-400">Total Pago</span>
                             <span className="text-xl font-black text-white">{formatCurrency(totalPaid)}</span>
                          </div>
                          {change > 0 && (
                            <div className="flex justify-between items-center bg-green-500/10 p-3 rounded-xl border border-green-500/20 animate-in zoom-in-95">
                               <span className="text-[10px] font-black uppercase text-green-500">Troco a Devolver</span>
                               <span className="text-xl font-black text-green-500">{formatCurrency(change)}</span>
                            </div>
                          )}
                       </div>
                    </div>

                    <Button 
                      onClick={handleFinishOrder}
                      disabled={isFinishing || totalPaid < total - 0.01}
                      className="w-full h-16 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-lg font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(34,197,94,0.3)] disabled:opacity-30 disabled:bg-slate-800 disabled:shadow-none transition-all"
                    >
                      {isFinishing ? (
                        <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>Quitar Pedido <CheckCircle2 size={24} /></>
                      )}
                    </Button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Variant Selection Modal (Simplified for speed) */}
      <AnimatePresence>
        {isVariantModalOpen && selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 text-white"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 rounded-3xl w-full max-w-xl overflow-hidden p-8"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic">{selectedProduct.name}</h3>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Escolha a cor ou tamanho abaixo</p>
                </div>
                <button onClick={() => setIsVariantModalOpen(false)} className="p-2 hover:bg-slate-950 rounded-full text-slate-400"><X size={24} /></button>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                 {loadingVariants ? (
                   <p className="col-span-2 text-center text-slate-400 py-10 font-bold italic">Carregando variações do estoque físico...</p>
                 ) : modalVariants.length > 0 ? (
                   modalVariants.map(v => (
                     <button
                       key={v.id}
                       onClick={() => {
                         addToCart(selectedProduct, v);
                         setIsVariantModalOpen(false);
                       }}
                       disabled={v.stock <= 0 || !v.active}
                       className="border-2 border-slate-100 rounded-xl p-4 text-left hover:border-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                     >
                       <h4 className="font-bold text-white leading-tight mb-1 group-hover:text-red-700">{v.name}</h4>
                       <div className="flex justify-between items-end mt-2">
                         <span className="text-xs font-black text-slate-400 uppercase">{v.sku}</span>
                         <span className="text-lg font-black text-white">{formatCurrency(v.price || selectedProduct.promoPrice || selectedProduct.price)}</span>
                       </div>
                       <div className="mt-2 text-[10px] font-bold uppercase tracking-widest">
                         {v.stock > 0 ? <span className="text-green-600">Estoque: {v.stock}</span> : <span className="text-red-600">Sem Estoque</span>}
                       </div>
                     </button>
                   ))
                 ) : (
                   <div className="col-span-2 text-center">
                     <p className="text-slate-400 py-6 font-bold italic">Nenhuma variação encontrada.</p>
                     <Button 
                       onClick={() => {
                         addToCart(selectedProduct, { name: 'Padrão', sku: selectedProduct.sku, stock: selectedProduct.stock, active: true, price: selectedProduct.promoPrice || selectedProduct.price, attributes: {} });
                         setIsVariantModalOpen(false);
                       }}
                       className="w-full h-14 bg-slate-900 hover:bg-black text-white rounded-xl"
                     >
                       Continuar com Produto Principal
                     </Button>
                   </div>
                 )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stock Warning Modal */}
      <AnimatePresence>
        {stockWarningModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden text-center p-8 shadow-2xl"
            >
              <div className="flex justify-center mb-6 text-red-500">
                <AlertCircle size={64} className="opacity-80" />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white mb-2">Estoque Insuficiente</h3>
              <p className="text-slate-300 font-bold mb-6">
                Não é permitido vender produtos sem estoque no PDV.
              </p>
              <div className="bg-slate-800 rounded-xl p-4 mb-8">
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Produto</p>
                <p className="text-lg font-black text-white leading-tight mb-4">{stockWarningModal.productName}</p>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-1">Estoque Atual</p>
                <p className="text-3xl font-black text-red-500">{stockWarningModal.stock}</p>
              </div>
              <Button 
                onClick={() => setStockWarningModal(null)} 
                className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-xl text-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                ENTENDI
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PaymentBtn({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "h-24 rounded-2xl flex flex-col items-center justify-center gap-2 border-2 transition-all duration-300 transform relative",
        active 
          ? "bg-red-600 border-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.4)] scale-[1.02] z-10" 
          : "bg-slate-900/5 border-white/10 text-slate-400 hover:bg-slate-900/10 hover:border-white/20 hover:scale-[1.01]"
      )}
    >
      <div className={cn("transition-all duration-500", active ? "scale-110" : "scale-100")}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {active && (
        <motion.div 
          layoutId="activePayment" 
          className="absolute -top-1 -right-1 bg-slate-900 text-red-600 p-1 rounded-full shadow-lg"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <CheckCircle2 size={12} />
        </motion.div>
      )}
    </button>
  );
}
