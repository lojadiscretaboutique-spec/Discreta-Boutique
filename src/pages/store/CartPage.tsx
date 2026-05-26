import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { formatCurrency, cn, roundTo2, formatVariantName } from '../../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, Calendar, Clock as ClockIcon, Sparkles, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useFeedback } from '../../contexts/FeedbackContext';
import { motion, AnimatePresence } from 'motion/react';
import { customerService } from '../../services/customerService';
import { stockMovementService } from '../../services/stockMovementService';
import { abandonedCartService } from '../../services/abandonedCartService';
import { abandonedCartWebhookService } from '../../services/abandonedCartWebhookService';
import { couponService } from '../../services/couponService';
import { deliveryAreaService, State, City, DeliveryArea } from '../../services/deliveryAreaService';
import { settingsService, PaymentSettings, MercadoPagoSettings, OperatingHoursSettings } from '../../services/settingsService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

export function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, total, appliedCoupon, applyCoupon, removeCoupon } = useCartStore();
  const { currentCustomer, setCustomer } = useCustomerAuthStore();
  const navigate = useNavigate();
  const { toast } = useFeedback();

  const handleUpdateQuantity = async (id: string, productId: string, variantId: string | undefined, currentQty: number, newQty: number) => {
    if (newQty <= 0) {
      updateQuantity(id, 0);
      return;
    }

    if (newQty > currentQty) {
      setLoading(true);
      try {
        let targetRef;
        if (variantId) {
          targetRef = doc(db, `products/${productId}/variants/${variantId}`);
        } else {
          targetRef = doc(db, 'products', productId);
        }

        const snap = await getDoc(targetRef);
        if (!snap.exists()) {
          toast("Produto não encontrado no estoque.", "error");
          return;
        }

        const stock = snap.data().stock || 0;
        if (newQty > stock) {
          toast(`Saldo insuficiente! Estoque atual: ${stock}`, "error");
          return;
        }

        updateQuantity(id, newQty);
      } catch (error) {
        console.error("Erro ao verificar estoque:", error);
        toast("Erro ao verificar disponibilidade no estoque.", "error");
      } finally {
        setLoading(false);
      }
    } else {
      updateQuantity(id, newQty);
    }
  };
  
  // NEW CHECKOUT STEPS
  type CheckoutStep = 'IDENTIFICACAO' | 'RESUMO' | 'RECEBIMENTO' | 'ENDERECO' | 'AGENDAMENTO' | 'PAGAMENTO';
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('IDENTIFICACAO');
  
  const [receiveMethod, setReceiveMethod] = useState<'entrega' | 'retirada' | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  
  // Settings
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [mpSettings, setMpSettings] = useState<MercadoPagoSettings | null>(null);
  const [operatingHours, setOperatingHours] = useState<OperatingHoursSettings | null>(null);
  
  // Checkout form fields
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [stateName, setStateName] = useState('');
  const [cityName, setCityName] = useState('');
  const [areaName, setAreaName] = useState('');

  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [referencia, setReferencia] = useState('');

  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [hasLookedUp, setHasLookedUp] = useState(false);
  const [trocoPara, setTrocoPara] = useState('');

  const [dbStates, setDbStates] = useState<State[]>([]);
  const [dbCities, setDbCities] = useState<City[]>([]);
  const [dbAreas, setDbAreas] = useState<DeliveryArea[]>([]);

  // Memoized available locations
  const availableCities = useMemo(() => {
    if (!stateName) return dbCities;
    const currentState = dbStates.find(s => s.sigla.toLowerCase() === stateName.toLowerCase() || s.nome.toLowerCase() === stateName.toLowerCase());
    if (currentState) {
      return dbCities.filter(c => c.stateId === currentState.id);
    }
    return dbCities;
  }, [dbCities, dbStates, stateName]);

  const availableBairros = useMemo(() => {
    let filtered = dbAreas;
    if (stateName) {
      const currentState = dbStates.find(s => s.sigla.toLowerCase() === stateName.toLowerCase() || s.nome.toLowerCase() === stateName.toLowerCase());
      if (currentState) {
        filtered = filtered.filter(b => b.stateId === currentState.id);
      }
    }
    if (cityName) {
       const selectedCityName = cityName.toLowerCase();
       filtered = filtered.filter(b => b.cityName.toLowerCase() === selectedCityName);
    }
    return filtered;
  }, [dbAreas, dbStates, stateName, cityName]);
  
  const [aiSuggestions, setAiSuggestions] = useState<{ motivo: string, produtos: any[] } | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [showMpBrick, setShowMpBrick] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  
  // ABANDONED CART RECOVERY MONITOR
  useEffect(() => {
    if (name && whatsapp && whatsapp.replace(/\D/g, '').length >= 10 && items.length > 0) {
       // Debounce slightly to avoid many calls
       const timer = setTimeout(() => {
          abandonedCartService.monitorCartActivity(name, whatsapp, `CART_${Date.now()}`);
       }, 5000); // 5s debounce
       return () => clearTimeout(timer);
    }
  }, [name, whatsapp, items.length]);

  const lastSearchedPhone = useRef('');

  const generateSlots = useCallback((dateString: string) => {
    if (!operatingHours) return [];
    
    const dateParts = dateString.split('-');
    const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
    const dayName = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][date.getDay()];
    
    // Check if date is in closedDates
    const isClosedDate = operatingHours.closedDates.some(cd => cd.date === dateString);
    if (isClosedDate) return [];

    const dayConfig = operatingHours.weekly.find(d => d.day === dayName);
    if (!dayConfig || !dayConfig.isOpen) return [];

    const slots: string[] = [];
    dayConfig.slots.forEach(slot => {
      let current = parseInt(slot.from.split(':')[0]);
      const end = parseInt(slot.to.split(':')[0]);
      
      while(current <= end) {
        const time = `${current.toString().padStart(2, '0')}:00`;
        
        // If date is today, only show future slots
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
           const slotTime = new Date(date);
           slotTime.setHours(current, 0, 0, 0);
           // Ensure at least 1 hour gap
           if (slotTime.getTime() >= now.getTime() + 3600000) {
               slots.push(time);
           }
        } else {
          slots.push(time);
        }
        current++;
      }
    });

    return [...new Set(slots)].sort(); // Ensure unique and sorted
  }, [operatingHours]);

  const getAvailableDays = useCallback(() => {
    if (!operatingHours) return [];
    
    const days: { date: string, label: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Look ahead up to 14 days to find the next 2 business days with slots
    for (let i = 0; i < 14 && days.length < 2; i++) {
      const current = new Date(today);
      current.setDate(today.getDate() + i);
      const dateStr = current.toISOString().split('T')[0];
      const slots = generateSlots(dateStr);
      
      if (slots.length > 0) {
        let label = '';
        const dayDiff = i;
        
        if (dayDiff === 0) label = 'Hoje';
        else if (dayDiff === 1) label = 'Amanhã';
        else {
          label = current.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });
          label = label.charAt(0).toUpperCase() + label.slice(1);
        }
        
        days.push({ date: dateStr, label });
      }
    }
    return days;
  }, [operatingHours, generateSlots]);

  // Derived state selections
  const currentArea = dbAreas.find(a => a.id === selectedAreaId);

  useEffect(() => {
    if (operatingHours && !selectedDate) {
      const days = getAvailableDays();
      if (days.length > 0) {
        setSelectedDate(days[0].date);
      }
    }
  }, [operatingHours, selectedDate, getAvailableDays]);

  // Computed Totals
  const subTotal = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      let price = item.price;
      if (item.promoAllowedPaymentMethods && item.promoAllowedPaymentMethods.length > 0) {
        if (paymentMethod && !item.promoAllowedPaymentMethods.includes(paymentMethod)) {
          price = item.originalPrice ?? item.price;
        }
      }
      sum += price * item.quantity;
    }
    return roundTo2(sum);
  }, [items, paymentMethod]);
  let couponDiscount = 0;
  if (appliedCoupon) {
    const isPaymentAllowed = !appliedCoupon.allowedPaymentMethods || 
      appliedCoupon.allowedPaymentMethods.length === 0 || 
      !paymentMethod || 
      appliedCoupon.allowedPaymentMethods.includes(paymentMethod);

    if (isPaymentAllowed) {
      if (appliedCoupon.type === 'percentage') {
        couponDiscount = subTotal * (appliedCoupon.value / 100);
      } else if (appliedCoupon.type === 'fixed') {
        couponDiscount = appliedCoupon.value;
      }
    }
  }
  // Ensure discount does not exceed subtotal
  couponDiscount = Math.min(couponDiscount, subTotal);
  
  const hasFreeShippingPromo = items.some(i => i.isFreeShipping);
  
  const deliveryFee = roundTo2(receiveMethod === 'entrega' && currentArea ? (
    hasFreeShippingPromo ? 0 :
    (currentArea.freteGratisAcima && subTotal >= currentArea.freteGratisAcima ? 0 : currentArea.taxaEntrega)
  ) : 0);
  const orderTotal = roundTo2(subTotal - couponDiscount + deliveryFee);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [checkoutStep]);

  useEffect(() => {
    if (mpSettings?.publicKey && mpSettings.active) {
      initMercadoPago(mpSettings.publicKey, { locale: 'pt-BR' });
    }
  }, [mpSettings]);

  useEffect(() => {
    // Load all necessary address data at once for independent text fields
    const loadData = async () => {
      try {
        const [states, cities, areas, pSettings, mpData, opHours] = await Promise.all([
          deliveryAreaService.listStates(),
          deliveryAreaService.listCities(),
          deliveryAreaService.listDeliveryAreas(),
          settingsService.getPaymentSettings(),
          settingsService.getMercadoPagoSettings(),
          settingsService.getOperatingHours()
        ]);
        
        // Use more relaxed filter (include active or undefined status)
        const activeStates = states.filter(s => s.status !== 'inativo');
        const activeCities = cities.filter(c => c.status !== 'inativo');
        const activeAreas = areas.filter(a => a.status !== 'inativo');

        setDbStates(activeStates);
        setDbCities(activeCities);
        setDbAreas(activeAreas);
        setPaymentSettings(pSettings);
        setMpSettings(mpData);
        setOperatingHours(opHours);
      } catch (error) {
        console.error("Error loading cart data:", error);
      }
    };
    loadData();
  }, []);

  const normalizeStr = (str: string) => 
    str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : '';

  const handleStateBlur = () => {
    const val = normalizeStr(stateName);
    if (!val) return;
    const match = dbStates.find(s => normalizeStr(s.sigla) === val || normalizeStr(s.nome) === val);
    if (match) {
      setStateName(match.sigla);
    } else {
      // Don't clear immediately to allow typing, but we'll validate on next step
    }
  };

  const handleCityBlur = () => {
    const val = normalizeStr(cityName);
    if (!val) return;
    const match = availableCities.find(c => normalizeStr(c.nome) === val);
    if (match) {
      setCityName(match.nome);
    }
  };

  const handleAreaBlur = () => {
    const val = normalizeStr(areaName);
    if (!val) return;
    const match = availableBairros.find(a => normalizeStr(a.bairro) === val);
    if (match) {
      setAreaName(match.bairro);
    }
  };

  // Preload from customer storage if we have one
  useEffect(() => {
    if (currentCustomer) {
      setName(currentCustomer.nome || '');
      setWhatsapp(currentCustomer.whatsapp || '');
      setHasLookedUp(true);
      if (currentCustomer.email) setEmail(currentCustomer.email);
      if (currentCustomer.enderecoObj) {
         setStateName(currentCustomer.enderecoObj.estado || '');
         setCityName(currentCustomer.enderecoObj.cidade || '');
         setAreaName(currentCustomer.enderecoObj.bairro || '');
         setRua(currentCustomer.enderecoObj.rua || '');
         setNumero(currentCustomer.enderecoObj.numero || '');
         setComplemento(currentCustomer.enderecoObj.complemento || '');
         setReferencia(currentCustomer.enderecoObj.referencia || '');
      }
      lastSearchedPhone.current = currentCustomer.whatsapp.replace(/\D/g, '');
      
      // If identified, normally we go to RESUMO unless specifically navigating steps
      if (checkoutStep === 'IDENTIFICACAO') {
        setCheckoutStep('RESUMO');
      }
    }
  }, [currentCustomer]);

  // Handle auto-login/identification logic
  const handleApplyCoupon = async () => {
    if (!couponInput) return;
    setApplyingCoupon(true);
    try {
      const coupon = await couponService.getCouponByCode(couponInput);
      if (!coupon) {
        toast("Cupom inválido", "error");
        return;
      }
      if (!coupon.active) {
        toast("Cupom inativo", "error");
        return;
      }
      if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
        toast("Cupom esgotado", "error");
        return;
      }

      // Check dates
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      
      if (coupon.startDate) {
        const start = new Date(coupon.startDate);
        start.setHours(0, 0, 0, 0);
        if (now < start) {
          toast("Este cupom ainda não é válido", "warning");
          return;
        }
      }
      
      if (coupon.endDate) {
        const end = new Date(coupon.endDate);
        end.setHours(23, 59, 59, 999);
        if (now > end) {
          toast("Este cupom já expirou", "error");
          return;
        }
      }

      // Check usage per customer
      if (coupon.usageLimitPerCustomer && currentCustomer) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        const q = query(
          collection(db, 'orders'),
          where('customerWhatsapp', '==', currentCustomer.whatsapp.replace(/\D/g, '')),
          where('coupon.code', '==', coupon.code)
        );
        const orderSnap = await getDocs(q);
        if (orderSnap.size >= coupon.usageLimitPerCustomer) {
          toast(`Você já atingiu o limite de uso deste cupom (${coupon.usageLimitPerCustomer}x)`, "warning");
          return;
        }
      }

      if (coupon.minPurchaseAmount && subTotal < coupon.minPurchaseAmount) {
        toast(`O valor mínimo para este cupom é ${formatCurrency(coupon.minPurchaseAmount)}`, "warning");
        return;
      }
      
      if (coupon.allowedPaymentMethods && coupon.allowedPaymentMethods.length > 0 && paymentMethod) {
        if (!coupon.allowedPaymentMethods.includes(paymentMethod)) {
          toast(`Este cupom só é válido para pagamentos via: ${coupon.allowedPaymentMethods.map(id => paymentSettings?.methods.find(m => m.id === id)?.label || id).join(', ')}.`, "warning");
          return;
        }
      }

      applyCoupon({ 
        code: coupon.code, 
        type: coupon.type, 
        value: coupon.value,
        allowedPaymentMethods: coupon.allowedPaymentMethods || []
      });
      toast("Cupom aplicado!", "success");
      setCouponInput("");
    } catch (e) {
      toast("Erro ao aplicar", "error");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleIdentification = async (e?: any) => {
    if (e?.preventDefault) e.preventDefault();
    
    const cleanPhone = whatsapp.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      toast("Informe um WhatsApp válido.", "warning");
      return;
    }

    setLoading(true);
    try {
      const existing = await customerService.getCustomerByWhatsapp(cleanPhone);
      
      if (existing) {
        setCustomer({
          id: existing.id!,
          nome: existing.nome,
          whatsapp: existing.whatsapp,
          email: existing.email,
          enderecoObj: existing.endereco ? {
            rua: existing.endereco.rua,
            numero: existing.endereco.numero,
            bairro: existing.endereco.bairro,
            cidade: existing.endereco.cidade,
            estado: existing.endereco.estado,
            complemento: existing.endereco.complemento || '',
            referencia: existing.endereco.referencia,
          } : undefined
        });
        toast(`Bem-vindo(a) de volta, ${existing.nome.split(' ')[0]}!`, "success");
        setCheckoutStep('RESUMO');
        
        // Chamada imediata ao webhook de carrinho
        if (items && items.length > 0) {
           abandonedCartWebhookService.sendImmediateCartWebhook(existing.nome, cleanPhone, items).catch(err => console.error(err));
        }
      } else {
        if (!isNewCustomer) {
          setIsNewCustomer(true);
          setLoading(false);
          return;
        }

        if (!name) {
          toast("Por favor, informe seu nome ou apelido.", "warning");
          setLoading(false);
          return;
        }

        // Create new customer
        const newId = await customerService.registerFromCheckout({
          nome: name,
          whatsapp: cleanPhone,
          status: 'ativo'
        });
        setCustomer({
          id: newId,
          nome: name,
          whatsapp: cleanPhone
        });
        toast("Cadastro realizado com sucesso!", "success");
        setCheckoutStep('RESUMO');

        // Chamada imediata ao webhook de carrinho
        if (items && items.length > 0) {
           abandonedCartWebhookService.sendImmediateCartWebhook(name, cleanPhone, items).catch(err => console.error(err));
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      toast("Erro ao processar identificação.", "error");
    } finally {
      setLoading(false);
    }
  };

  const [isNewCustomer, setIsNewCustomer] = useState(false);

  // Sync selected area derived from names instead of selection-ripple
  useEffect(() => {
    if (!stateName || !cityName || !areaName) {
      setSelectedAreaId('');
      return;
    }

    const normalizedSt = stateName.trim().toUpperCase();
    const normalizedCt = cityName.trim().toLowerCase();
    const normalizedBa = areaName.trim().toLowerCase();

    // Find state sigla first
    const stateObj = dbStates.find(s => s.sigla === normalizedSt || s.nome.toLowerCase() === normalizedSt.toLowerCase());
    const sigla = stateObj?.sigla;
    const nome = stateObj?.nome;
    
    if (!sigla) {
      setSelectedAreaId('');
      return;
    }

    const exactMatch = dbAreas.find(a => 
      (a.stateName === sigla || a.stateName === nome) &&
      a.cityName.trim().toLowerCase() === normalizedCt &&
      a.bairro.trim().toLowerCase() === normalizedBa
    );

    if (exactMatch) {
      setSelectedAreaId(exactMatch.id!);
    } else {
      setSelectedAreaId('');
    }
  }, [stateName, cityName, areaName, dbAreas, dbStates]);

  // Lookup customer by WhatsApp
  useEffect(() => {
    const cleanPhone = whatsapp.replace(/\D/g, '');
    
    if (cleanPhone.length < 10) {
      if (hasLookedUp) setHasLookedUp(false);
      lastSearchedPhone.current = '';
      return;
    }

    // Only search if changed and >= 10 digits
    if (cleanPhone !== lastSearchedPhone.current && !lookingUp) {
      const timer = setTimeout(async () => {
        // Double check after timeout
        if (cleanPhone === lastSearchedPhone.current) return;

        setLookingUp(true);
        setHasLookedUp(false);
        lastSearchedPhone.current = cleanPhone;

        try {
          const cust = await customerService.getCustomerByWhatsapp(cleanPhone);
          
          if (cust) {
            toast(`Olá ${cust.nome.split(' ')[0]}, localizamos seu cadastro!`, 'success');
            setName(cust.nome);
            setIsNewCustomer(false);
            if (cust.email) setEmail(cust.email);
            
            if (cust.endereco) {
              const addr = cust.endereco;
              setStateName(addr.estado || '');
              setCityName(addr.cidade || '');
              setAreaName(addr.bairro || '');
              setRua(addr.rua || '');
              setNumero(addr.numero || '');
              setReferencia(addr.referencia || '');
              if (addr.complemento) setComplemento(addr.complemento);
            }
            if (cust.notes) setNotes(cust.notes);
          } else {
            setIsNewCustomer(true);
            toast('Ainda não temos seu cadastro. Informe seu nome para continuar!', 'info');
            // Clear fields for new registration if it wasn't pre-filled by a different lookup
            setName('');
            setEmail('');
            setStateName('');
            setCityName('');
            setAreaName('');
            setRua('');
            setNumero('');
            setReferencia('');
            setComplemento('');
          }
          setHasLookedUp(true);
        } catch (err) {
          console.error("Lookup error:", err);
          toast("Erro ao consultar cadastro.", "error");
        } finally {
          setLookingUp(false);
        }
      }, 1500); // 1.5s delay
      return () => clearTimeout(timer);
    }
  }, [whatsapp, lookingUp, toast]);

  const cartItemIds = useMemo(() => items.map(i => i.productId).join(','), [items]);

  useEffect(() => {
    // Fetch suggestions if has items
    if (items.length > 0 && !loadingSuggestions) {
      // Re-fetch if cart content changed significantly (different IDs)
      const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        try {
          const response = await fetch('/api/ia/sugerir-complementos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              items: items.map(i => ({ id: i.productId, name: i.name })) 
            })
          });
          if (response.ok) {
            const data = await response.json();
            setAiSuggestions(data);
          }
        } catch (error) {
          console.warn("Erro ao buscar sugestões:", error);
        } finally {
          setLoadingSuggestions(false);
        }
      };
      fetchSuggestions();
    } else if (items.length === 0) {
      setAiSuggestions(null);
    }
  }, [cartItemIds]); // Depende da string de IDs para atualizar quando o conteúdo muda
  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
          <Trash2 size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-4 text-slate-900">Seu carrinho está vazio</h2>
        <p className="text-slate-500 mb-8">Adicione produtos para continuar sua compra.</p>
        <Button size="lg" asChild>
          <Link to="/catalogo">Ir para o Catálogo</Link>
        </Button>
      </div>
    );
  }

  const validateIdentification = () => {
    if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) {
      toast("WhatsApp inválido.", 'warning');
      return false;
    }
    if (!name) {
      toast("Informe seu nome.", 'warning');
      return false;
    }
    
    // Se for retirada, não valida endereço
    if (receiveMethod === 'retirada') return true;

    const normState = normalizeStr(stateName);
    const normCity = normalizeStr(cityName);
    const normArea = normalizeStr(areaName);

    const validState = dbStates.find(s => normalizeStr(s.sigla) === normState || normalizeStr(s.nome) === normState);
    const validCity = dbCities.find(c => normalizeStr(c.nome) === normCity);

    if (!validState || !validCity) {
      toast("Por favor, selecione Estado e Cidade das sugestões.", 'warning');
      return false;
    }

    const validArea = dbAreas.find(a => 
      (normalizeStr(a.stateName) === normalizeStr(validState.sigla) || normalizeStr(a.stateName) === normalizeStr(validState.nome)) &&
      normalizeStr(a.cityName) === normalizeStr(validCity.nome) &&
      normalizeStr(a.bairro) === normArea
    );

    if (!validArea) {
      toast("Bairro não encontrado na cidade/estado informados.", 'warning');
      return false;
    }

    if (!rua || !numero || !referencia) {
      toast("Preencha o endereço completo.", 'warning');
      return false;
    }

    if (validArea.pedidoMinimo && subTotal < validArea.pedidoMinimo) {
      toast(`O pedido mínimo para sua região é de ${formatCurrency(validArea.pedidoMinimo)}`, 'error');
      return false;
    }

    return true;
  };

  const handleCheckout = async () => {
    if (!paymentMethod) {
      toast("Selecione uma forma de pagamento.", 'warning');
      return;
    }

    if (appliedCoupon && appliedCoupon.allowedPaymentMethods && appliedCoupon.allowedPaymentMethods.length > 0) {
      if (!appliedCoupon.allowedPaymentMethods.includes(paymentMethod)) {
        const methodLabel = paymentSettings?.methods.find(m => m.id === paymentMethod)?.label || paymentMethod;
        toast(`O cupom "${appliedCoupon.code}" não é válido para a forma de pagamento ${methodLabel}.`, "warning");
        return;
      }
    }

    let addressObj: any = null;
    let validArea: any = null;
    let fullAddressString = "Retirada na Loja";

    if (receiveMethod === 'entrega') {
      const normState = normalizeStr(stateName);
      const normCity = normalizeStr(cityName);
      const normArea = normalizeStr(areaName);

      const validState = dbStates.find(s => normalizeStr(s.sigla) === normState || normalizeStr(s.nome) === normState);
      const validCity = dbCities.find(c => normalizeStr(c.nome) === normCity);
      validArea = dbAreas.find(a => 
        (normalizeStr(a.stateName) === normalizeStr(validState?.sigla || '') || normalizeStr(a.stateName) === normalizeStr(validState?.nome || '')) &&
        normalizeStr(a.cityName) === normalizeStr(validCity?.nome || '') &&
        normalizeStr(a.bairro) === normArea
      );

      if (!validState || !validCity || !validArea) {
        toast("Erro ao validar endereço.", "error");
        return;
      }

      addressObj = { 
        estado: validState.sigla, 
        cidade: validCity.nome, 
        bairro: validArea.bairro, 
        rua, 
        numero, 
        complemento, 
        referencia 
      };
      fullAddressString = `${rua}, ${numero} - ${validArea.bairro}, ${validCity.nome}/${validState.sigla}. Ref: ${referencia}`;
    }
    
    setLoading(true);
    try {
      const customerId = await customerService.registerFromCheckout({
          nome: name,
          whatsapp: whatsapp,
          email: email,
          endereco: addressObj,
          status: 'ativo'
      });

      const selectedMethodConfig = paymentSettings?.methods.find(m => m.id === paymentMethod);
      const isCash = selectedMethodConfig?.label.toLowerCase().includes('dinheiro') || selectedMethodConfig?.id === 'cash';

      let finalNotes = notes;
      if (isCash && trocoPara) {
          finalNotes = `Precisa de troco para: R$ ${trocoPara}. ` + finalNotes;
      }

      const orderData = {
        customerId,
        customerName: name,
        customerWhatsapp: whatsapp,
        customerAddress: fullAddressString,
        fullAddress: addressObj,
        receiveMethod: receiveMethod,
        scheduledDate: selectedDate,
        scheduledTime: selectedSlot,
        notes: finalNotes,
        subTotal: subTotal,
        deliveryFee: receiveMethod === 'entrega' ? deliveryFee : 0,
        total: receiveMethod === 'entrega' ? orderTotal : subTotal - couponDiscount, // Ensure total considers discount even for store pickup
        coupon: appliedCoupon ? { code: appliedCoupon.code, discountValue: couponDiscount } : null,
        deliveryAreaId: validArea?.id || null,
        paymentMethod: paymentMethod,
        status: 'NOVO',
        type: 'online',
        items: items.map(i => {
          const isPromoInvalid = i.promoAllowedPaymentMethods && 
            i.promoAllowedPaymentMethods.length > 0 && 
            paymentMethod && 
            !i.promoAllowedPaymentMethods.includes(paymentMethod);
          const activeItemPrice = isPromoInvalid ? (i.originalPrice ?? i.price) : i.price;
          return {
            productId: i.productId,
            variantId: i.variantId || null,
            name: i.name + (i.variantName ? ` - ${i.variantName}` : ''),
            price: activeItemPrice,
            costPrice: i.costPrice || 0,
            quantity: i.quantity,
            sku: i.sku || '',
            gtin: i.gtin || '',
            searchId: i.searchId || null
          };
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        refAffiliate: localStorage.getItem('discreta_ref') || null
      };

      const response = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      const docRef = { id: data.orderId };
      
      // REGISTER STOCK RESERVATION
      for (const item of items) {
        try {
          await stockMovementService.registerMovement({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.name,
            variantName: item.variantName,
            sku: item.sku || '',
            quantity: item.quantity,
            type: 'out',
            status: 'reservado',
            reason: 'Pedido Online (Reservado)',
            channel: 'Loja Virtual',
            orderId: docRef.id
          });
        } catch (stockErr) {
          console.error("Error reserving stock for item:", item.name, stockErr);
          // We continue anyway as the order was already created, 
          // but in a real scenario we might want to handle this better.
        }
      }
      
      if (appliedCoupon) {
        couponService.recordCouponUse(appliedCoupon.code).catch(e => console.error("Error recording coupon usage", e));
      }

      // CHECK FOR ONLINE INTEGRATION
      const isOnlineMethod = selectedMethodConfig?.useIntegration;
      const useIntegration = mpSettings?.active && isOnlineMethod;

      if (useIntegration && mpSettings?.accessToken && mpSettings?.publicKey) {
         setCreatedOrderId(docRef.id);
         setShowMpBrick(true);
         setLoading(false);
         return; // Pause here to show native Brick
      }

      clearCart();
      navigate('/sucesso', { state: { orderId: docRef.id, whatsapp: whatsapp } });
    } catch (error) {
      console.error("Order error:", error);
      toast("Erro ao finalizar o pedido.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: 'Identificação', id: 'IDENTIFICACAO' as CheckoutStep },
    { title: 'Sacola', id: 'RESUMO' as CheckoutStep },
    { title: 'Recebimento', id: 'RECEBIMENTO' as CheckoutStep },
    { title: 'Endereço', id: 'ENDERECO' as CheckoutStep },
    { title: 'Agendamento', id: 'AGENDAMENTO' as CheckoutStep },
    { title: 'Pagamento', id: 'PAGAMENTO' as CheckoutStep },
  ];

  // Helper to check if a step is "active" or "completed"
  const getStepIndex = (sId: CheckoutStep) => steps.findIndex(s => s.id === sId);
  const currentStepIndex = getStepIndex(checkoutStep);

  const handleMpSubmit = async ({ formData }: any) => {
    if (!createdOrderId) return;
    
    try {
      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          formData, 
          accessToken: mpSettings?.accessToken, 
          orderId: createdOrderId 
        })
      });
      
      const data = await response.json();
      
      if (data.status === 'approved' || data.status === 'in_process' || data.status === 'pending') {
        clearCart();
        navigate('/sucesso', { state: { orderId: createdOrderId, whatsapp: whatsapp } });
      } else {
        toast(`Pagamento não aprovado. Status: ${data.status}`, "warning");
      }
    } catch (error) {
      console.error(error);
      toast("Ocorreu um erro ao processar o pagamento.", "error");
    }
  };

  const handleMpError = async (error: any) => {
    console.error("MP Error:", error);
  };

  if (showMpBrick && createdOrderId) {
    return (
      <div className="flex-1 bg-black text-white min-h-screen pb-20 justify-center">
         <div className="max-w-2xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-black uppercase italic text-center mb-6 text-white tracking-tighter">Concluir Pagamento</h2>
            <div className="bg-white rounded-[2rem] p-6 shadow-2xl relative">
              <Payment 
                initialization={{ 
                  amount: orderTotal
                }} 
                customization={{ 
                  paymentMethods: { 
                    creditCard: 'all',
                    bankTransfer: 'all'
                  } 
                }} 
                onSubmit={handleMpSubmit} 
                onError={handleMpError} 
                onReady={() => console.log('Brick ready')}
              />
            </div>
            <button 
              onClick={() => {
                setShowMpBrick(false);
                toast("O pedido foi registrado mas o pagamento pendente. Entre em contato.", "warning");
                clearCart();
                navigate('/sucesso', { state: { orderId: createdOrderId, whatsapp: whatsapp } });
              }}
              className="mt-6 text-zinc-500 hover:text-zinc-300 text-xs text-center w-full block uppercase font-bold tracking-widest font-sans"
            >
              Cancelar Pagamento
            </button>
         </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-black text-white min-h-screen pb-20">
      {/* Header / Progress bar */}
      <div className="bg-zinc-950 border-b border-zinc-900 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center justify-between gap-1 min-w-[500px] py-1">
            {steps.filter(s => receiveMethod === 'retirada' ? s.id !== 'ENDERECO' : true).map((s, idx, filteredSteps) => {
              const sIdx = getStepIndex(s.id);
              const isActive = s.id === checkoutStep;
              const isPast = sIdx < currentStepIndex;

              return (
                <div key={s.id} className="flex-1 flex items-center">
                  <button 
                    onClick={() => isPast && setCheckoutStep(s.id)}
                    disabled={!isPast && !isActive}
                    className={cn(
                      "flex flex-col items-center gap-1.5 transition-all duration-300",
                      isActive ? "text-red-500" : isPast ? "text-zinc-300" : "text-zinc-700"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black border-2 transition-all",
                      isActive ? "bg-red-600 border-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]" : 
                      isPast ? "bg-zinc-800 border-zinc-700 text-white" : "bg-transparent border-zinc-800"
                    )}>
                      {idx + 1}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest">{s.title}</span>
                  </button>
                  {idx < filteredSteps.length - 1 && (
                    <div className={cn(
                      "h-[1px] flex-1 mx-2",
                      isPast ? "bg-red-600" : "bg-zinc-800"
                    )}></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 lg:py-8 pb-40">
        <div className="flex flex-col gap-6 sm:gap-8 max-w-4xl mx-auto w-full">
          
          <div className="w-full">
            <AnimatePresence mode="wait">
              {checkoutStep === 'IDENTIFICACAO' && (
                <motion.div 
                  key="identificacao"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8"
                >
                  <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 sm:p-10 shadow-2xl text-center">
                    <div className="w-16 h-16 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <Search size={28} />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white mb-2">Identificação</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm font-medium mb-8 max-w-sm mx-auto">
                      Para continuar sua compra, precisamos saber quem você é.
                    </p>

                    <form onSubmit={handleIdentification} className="max-w-sm mx-auto space-y-4">
                      <div className="space-y-3">
                        <div className="relative">
                          <label className="block text-[10px] font-black mb-2 uppercase tracking-[3px] text-zinc-500 text-left px-2">WhatsApp *</label>
                          <input 
                            required 
                            type="tel"
                            value={whatsapp} 
                            onChange={e => setWhatsapp(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-red-600 transition-all font-black text-lg sm:text-xl"
                            placeholder="(00) 00000-0000" 
                          />
                        </div>
                        {isNewCustomer && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="relative"
                          >
                            <label className="block text-[10px] font-black mb-2 uppercase tracking-[3px] text-zinc-500 text-left px-2">Como podemos te chamar? *</label>
                            <input 
                              required 
                              value={name} 
                              onChange={e => setName(e.target.value)}
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-3 text-white focus:ring-2 focus:ring-red-600 transition-all font-bold text-base sm:text-lg"
                              placeholder="Seu Nome ou Apelido" 
                            />
                          </motion.div>
                        )}
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {checkoutStep === 'RESUMO' && (
                <motion.div 
                  key="resumo"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-8"
                >
                  {/* Items List */}
                  <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 shadow-2xl overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
                      <h2 className="text-lg font-black uppercase italic tracking-tighter">Sua Sacola</h2>
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{items.length} ITENS</span>
                    </div>
                    <ul className="divide-y divide-zinc-800/50">
                      <AnimatePresence initial={false}>
                        {items.map((item) => {
                          const isPromoInvalid = item.promoAllowedPaymentMethods && 
                            item.promoAllowedPaymentMethods.length > 0 && 
                            paymentMethod && 
                            !item.promoAllowedPaymentMethods.includes(paymentMethod);
                          const activeItemPrice = isPromoInvalid ? (item.originalPrice ?? item.price) : item.price;
                          return (
                            <motion.li 
                              key={item.id} 
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="p-5 sm:p-7 flex flex-col gap-5 group relative hover:bg-zinc-800/40 transition-all duration-500"
                            >
                              {/* Item Header: Title & Variations spanning the width */}
                              <div className="w-full flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 border-b border-zinc-800/30 pb-3">
                                <h3 className="font-medium text-[10px] sm:text-[11px] text-zinc-400 uppercase tracking-[0.15em] leading-relaxed group-hover:text-red-500 transition-colors duration-300">
                                  {item.name}
                                </h3>
                                {item.variantName && (
                                  <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest italic sm:text-right">
                                    {formatVariantName(item.variantName)}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-row gap-5 sm:gap-8 items-center">
                                {/* Product Image with glass effect on quantity tag */}
                                <div className="w-20 h-20 sm:w-28 sm:h-28 bg-zinc-950 rounded-[1.5rem] overflow-hidden shrink-0 border border-zinc-800 shadow-2xl relative group/img">
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl || undefined} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black border border-zinc-800">
                                      <Sparkles size={18} className="text-zinc-800 mb-1 animate-pulse" />
                                      <span className="text-[8px] font-black tracking-widest text-zinc-700 uppercase">Premium</span>
                                    </div>
                                  )}
                                  {/* Quantity Badge for Mobile */}
                                  {item.quantity > 1 && (
                                    <div className="absolute top-2 right-2 bg-red-600/90 backdrop-blur-md text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-lg sm:hidden border border-white/20">
                                      {item.quantity}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-500" />
                                </div>
                                
                                {/* Product Info */}
                                <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Preço Unitário</span>
                                      <span className="font-black text-lg sm:text-2xl text-white tracking-tighter">
                                        {formatCurrency(activeItemPrice)}
                                      </span>
                                      {isPromoInvalid && (
                                        <span className="text-[8px] text-red-500 font-bold uppercase tracking-wider mt-1">
                                          Promoção indisponível para esta forma de pagamento
                                        </span>
                                      )}
                                    </div>
                                    
                                    {item.quantity > 1 && (
                                      <div className="h-8 w-[1px] bg-zinc-800/50 hidden sm:block mx-1" />
                                    ) }
                                    {item.quantity > 1 && (
                                      <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-0.5">Subtotal Item</span>
                                        <span className="text-[11px] sm:text-[13px] font-black text-red-500 uppercase tracking-widest bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10">
                                          {formatCurrency(activeItemPrice * item.quantity)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                            {/* Actions & Quantity Selector */}
                            <div className="flex flex-col items-end gap-5 shrink-0">
                              <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-2xl border border-zinc-800 shadow-2xl relative overflow-hidden group/controls">
                                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-red-600 transform scale-x-0 group-hover/controls:scale-x-100 transition-transform duration-500" />
                                
                                <button 
                                  onClick={() => handleUpdateQuantity(item.id, item.productId, item.variantId, item.quantity, item.quantity - 1)} 
                                  className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white rounded-xl hover:bg-zinc-800 transition-all active:scale-90 group/minus"
                                  title="Diminuir"
                                >
                                  <Minus size={18} className="group-hover/minus:scale-110 transition-transform" />
                                </button>
                                
                                <div className="w-8 flex flex-col items-center">
                                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter mb-0.5">Qtd</span>
                                  <span className="font-black text-base text-white">{item.quantity}</span>
                                </div>
                                
                                <button 
                                  onClick={() => handleUpdateQuantity(item.id, item.productId, item.variantId, item.quantity, item.quantity + 1)} 
                                  className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-white rounded-xl hover:bg-zinc-800 transition-all active:scale-90 group/plus"
                                  title="Aumentar"
                                >
                                  <Plus size={18} className="group-hover/plus:scale-110 transition-transform" />
                                </button>
                              </div>
                              
                              <button 
                                onClick={() => removeItem(item.id)} 
                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 hover:text-red-500 hover:bg-red-500/5 transition-all duration-300 group/remove border border-transparent hover:border-red-500/10"
                              >
                                <Trash2 size={16} className="group-hover/remove:rotate-12 transition-transform duration-300" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-0 group-hover/remove:opacity-100 transition-opacity hidden sm:inline">Excluir Item</span>
                              </button>
                            </div>
                          </div>
                        </motion.li>
                        );
                        })}
                      </AnimatePresence>
                    </ul>
                  </div>

                  {aiSuggestions && aiSuggestions.produtos.length > 0 && (
                    <motion.div 
                      key="suggestions"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-zinc-900 border border-red-500/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative group"
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles size={120} className="text-red-500 animate-pulse" />
                      </div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/20">
                            <Sparkles size={16} className="text-white" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
                            Check-out Inteligente: Sugestões Exclusivas
                          </span>
                        </div>
                        
                        <h4 className="text-2xl font-black text-white mb-3 tracking-tighter leading-tight">
                          Complete sua experiência
                        </h4>
                        <p className="text-zinc-500 font-medium text-sm mb-10 max-w-md italic">
                          "{aiSuggestions.motivo}"
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {aiSuggestions.produtos.map((p) => (
                            <div 
                              key={p.id} 
                              onClick={() => navigate(`/produto/${p.seo?.slug || p.id}`)}
                              className="cursor-pointer flex flex-col p-5 bg-zinc-950/50 rounded-3xl border border-zinc-800 hover:border-red-600/30 transition-all duration-500 group/item"
                            >
                              <div className="flex gap-4 mb-4">
                                <div className="w-16 h-16 bg-zinc-900 rounded-2xl overflow-hidden shrink-0 border border-zinc-800">
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl || undefined} alt={p.name} className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-700" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[8px] uppercase font-bold">Sem foto</div>
                                  )}
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <h5 className="font-bold text-sm text-zinc-100 truncate uppercase tracking-tight mb-1">{p.name}</h5>
                                  <div className="font-black text-lg text-white">{formatCurrency(p.price)}</div>
                                </div>
                              </div>

                              {p.shortDescription && (
                                <p className="text-[10px] text-zinc-500 line-clamp-2 mb-4 leading-relaxed italic">{p.shortDescription}</p>
                              )}

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  useCartStore.getState().addItem({
                                    id: `${p.id}-base`,
                                    productId: p.id,
                                    name: p.name,
                                    price: p.price,
                                    costPrice: p.costPrice || 0,
                                    quantity: 1,
                                    sku: p.sku || '',
                                    gtin: p.gtin || '',
                                    imageUrl: p.imageUrl
                                  });
                                  toast(`${p.name} adicionado!`, "success");
                                }}
                                className="w-full py-3 bg-red-600/10 hover:bg-red-600 text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-white rounded-xl transition-all flex items-center justify-center gap-2"
                              >
                                <Plus size={14} /> ADICIONAR AO CARRINHO
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {!aiSuggestions && loadingSuggestions && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] p-12 flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">IA analisando seu carrinho...</p>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4 pt-10">
                    <Button variant="outline" asChild size="lg" className="flex-1 py-8 text-xs font-black uppercase tracking-widest rounded-2xl border-zinc-800 hover:bg-zinc-800">
                      <Link to="/catalogo">Escolher mais itens</Link>
                    </Button>
                    <Button 
                      onClick={() => setCheckoutStep('RECEBIMENTO')} 
                      size="lg" 
                      className="flex-[2] py-8 text-lg font-black italic uppercase tracking-widest rounded-2xl shadow-xl shadow-red-600/20"
                    >
                      Como deseja receber? <ArrowRight size={20} className="ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {checkoutStep === 'RECEBIMENTO' && (
                <motion.div 
                  key="recebimento"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                  <div className="text-center space-y-3">
                    <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter text-white">Como deseja receber?</h2>
                    <p className="text-zinc-500 text-xs sm:text-sm font-medium">Selecione o método de entrega de sua preferência.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
                    <button
                      onClick={() => {
                        setReceiveMethod('entrega');
                        setCheckoutStep('ENDERECO');
                      }}
                      className="group relative flex flex-col items-center justify-center p-8 sm:p-10 bg-zinc-900 border-2 border-zinc-800 hover:border-red-600 rounded-[2rem] transition-all duration-500"
                    >
                      <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-600 transition-colors">
                        <motion.div whileHover={{ x: [0, 5, -5, 0] }}>
                          <ArrowRight size={20} />
                        </motion.div>
                      </div>
                      <span className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter text-white">Entregar em Casa</span>
                      <p className="text-zinc-500 text-[10px] mt-2 uppercase font-bold tracking-widest">Enviamos para você</p>
                    </button>

                    <button
                      onClick={() => {
                        setReceiveMethod('retirada');
                        setCheckoutStep('AGENDAMENTO');
                      }}
                      className="group relative flex flex-col items-center justify-center p-8 sm:p-10 bg-zinc-900 border-2 border-zinc-800 hover:border-red-600 rounded-[2rem] transition-all duration-500"
                    >
                      <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-red-600 transition-colors">
                        <ClockIcon size={20} />
                      </div>
                      <span className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter text-white">Receber na Loja</span>
                      <p className="text-zinc-500 text-[10px] mt-2 uppercase font-bold tracking-widest">Você busca na loja</p>
                    </button>
                  </div>
                </motion.div>
              )}

              {checkoutStep === 'ENDERECO' && (
                <motion.div 
                  key="endereco"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                  <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
                    <h3 className="text-lg font-black uppercase tracking-[3px] text-zinc-100 mb-6 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                      Endereço de Entrega
                    </h3>
                    
                    <div className="space-y-4 sm:space-y-6">
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Estado *</label>
                          <input 
                            required 
                            list="estados-sugestoes" 
                            value={stateName} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white uppercase font-bold text-sm" 
                            onChange={e => setStateName(e.target.value.toUpperCase())} 
                            onBlur={handleStateBlur}
                            placeholder="UF" 
                          />
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Cidade *</label>
                          <input 
                            required 
                            list="cidades-sugestoes" 
                            value={cityName} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-sm" 
                            onChange={e => setCityName(e.target.value)} 
                            onBlur={handleCityBlur}
                            placeholder="Sua cidade" 
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Bairro *</label>
                          <input 
                            required 
                            list="bairros-sugestoes" 
                            value={areaName} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-sm" 
                            onChange={e => setAreaName(e.target.value)} 
                            onBlur={handleAreaBlur}
                            placeholder="Seu bairro" 
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Rua / Avenida *</label>
                          <input required value={rua} onChange={e => setRua(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-sm" placeholder="Nome da rua" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Número *</label>
                          <input required value={numero} onChange={e => setNumero(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-sm" placeholder="Nº" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Ponto de Referência *</label>
                          <input required value={referencia} onChange={e => setReferencia(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-sm" placeholder="Ex: Próximo à padaria..." />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Complemento (Opcional)</label>
                        <input value={complemento} onChange={e => setComplemento(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white font-bold text-sm" placeholder="Apto, Bloco, etc" />
                      </div>

                      <Button 
                        onClick={() => {
                          if (validateIdentification()) {
                            setCheckoutStep('AGENDAMENTO');
                          }
                        }}
                        size="lg" 
                        className="w-full py-6 text-base font-black italic uppercase tracking-widest rounded-2xl"
                      >
                        Agendar Entrega <Calendar size={18} className="ml-2" />
                      </Button>
                    </div>

                    <datalist id="estados-sugestoes">
                      {dbStates.map(state => <option key={state.id} value={state.sigla}>{state.nome}</option>)}
                    </datalist>
                    <datalist id="cidades-sugestoes">
                      {availableCities.map(city => <option key={city.id} value={city.nome} />)}
                    </datalist>
                    <datalist id="bairros-sugestoes">
                      {availableBairros.map(bairro => <option key={bairro.id} value={bairro.bairro} />)}
                    </datalist>
                  </div>
                </motion.div>
              )}

              {checkoutStep === 'AGENDAMENTO' && (
                <motion.div 
                  key="agendamento"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                  <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 sm:p-10 shadow-2xl">
                    <h3 className="text-lg font-black uppercase tracking-[3px] text-zinc-100 mb-6 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                      Agendamento do Pedido
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
                      <div className="space-y-3">
                        <label className="block text-[9px] font-black uppercase tracking-[3px] text-zinc-500">Selecione uma Data</label>
                        <div className="grid grid-cols-1 gap-2">
                          {getAvailableDays().map((day) => (
                            <button
                              key={day.date}
                              onClick={() => {
                                setSelectedDate(day.date);
                                setSelectedSlot('');
                              }}
                              className={cn(
                                "flex items-center justify-between px-5 py-3.5 rounded-xl border-2 transition-all group",
                                selectedDate === day.date
                                  ? "bg-red-600 border-red-600 text-white shadow-lg"
                                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                              )}
                            >
                              <div className="flex items-center gap-2.5">
                                <Calendar size={18} className={cn(selectedDate === day.date ? "text-white" : "text-zinc-600 group-hover:text-red-500")} />
                                <span className="font-bold text-base">{day.label}</span>
                              </div>
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                selectedDate === day.date ? "border-white bg-white/20" : "border-zinc-800"
                              )}>
                                {selectedDate === day.date && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-[9px] font-black uppercase tracking-[3px] text-zinc-500">Horário Disponível</label>
                        <div className="grid grid-cols-3 gap-2">
                          {generateSlots(selectedDate).map(slot => (
                            <button
                                key={slot}
                                onClick={() => setSelectedSlot(slot)}
                                className={cn(
                                    "py-2.5 rounded-xl border font-bold text-[10px] transition-all",
                                    selectedSlot === slot 
                                    ? "bg-red-600 border-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]" 
                                    : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                )}
                            >
                                {slot}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {checkoutStep === 'PAGAMENTO' && (
                <motion.div 
                  key="pagamento"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-12"
                >
                  <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 sm:p-10 shadow-2xl">
                    <h3 className="text-lg font-black uppercase tracking-[3px] text-zinc-100 mb-6 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                      Forma de Pagamento
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                      {paymentSettings?.methods
                        .filter(m => receiveMethod === 'entrega' ? m.enabledDelivery : m.enabledPickup)
                        .map(method => (
                          <button
                            key={method.id}
                            onClick={() => {
                              if (appliedCoupon && appliedCoupon.allowedPaymentMethods && appliedCoupon.allowedPaymentMethods.length > 0) {
                                if (!appliedCoupon.allowedPaymentMethods.includes(method.id)) {
                                  toast(`O cupom "${appliedCoupon.code}" não é válido para pagamentos via ${method.label}.`, "warning");
                                }
                              }
                              setPaymentMethod(method.id);
                            }}
                            className={cn(
                              "flex flex-col items-start p-5 rounded-2xl border-2 transition-all text-left",
                              paymentMethod === method.id 
                              ? "bg-red-600/10 border-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.1)]" 
                              : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                            )}
                          >
                            <span className="text-lg font-black italic tracking-tighter mb-0.5 uppercase">{method.label}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60 italic">Disponível</span>
                          </button>
                        ))
                      }
                    </div>

                    {paymentSettings?.methods.find(m => m.id === paymentMethod)?.label.toLowerCase().includes('dinheiro') && (
                      <div className="mb-6 space-y-3">
                        <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Troco para quanto?</label>
                        <input 
                          type="number"
                          className="w-full sm:w-1/2 bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-3 text-white font-bold text-sm"
                          value={trocoPara} 
                          onChange={e => setTrocoPara(e.target.value)} 
                          placeholder="Ex: 50 ou 100"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="block text-[9px] font-black mb-2 uppercase tracking-widest text-zinc-500">Observações do Pedido</label>
                      <textarea 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-5 text-white font-bold min-h-[80px] text-sm"
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        placeholder="Algo que devemos saber?"
                      />
                    </div>

                    <Button 
                      className="hidden"
                    >
                      Finalizar Pedido
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Checkout Summary - Now Below Content */}
          {(checkoutStep === 'RESUMO' || checkoutStep === 'PAGAMENTO') && (
            <div className="w-full">
              <div className="bg-zinc-900 rounded-[2rem] border border-zinc-800 p-6 sm:p-10 shadow-2xl">
                <h2 className="text-lg font-black tracking-tighter uppercase italic mb-6 flex items-center justify-between">
                  Resumo do Pedido
                  <span className="text-[10px] text-zinc-600 tracking-widest not-italic">{items.length} itens</span>
                </h2>

                {/* Coupon Input Area */}
                {checkoutStep === 'RESUMO' && (
                  <div className="mb-6 flex gap-2">
                    {appliedCoupon ? (
                      <div className="flex-1 flex justify-between items-center bg-green-500/10 border border-green-500/20 text-green-500 px-4 py-3 rounded-2xl">
                        <span className="text-xs font-bold uppercase tracking-widest">Cupom: {appliedCoupon.code}</span>
                        <button onClick={removeCoupon} className="text-green-500 hover:text-green-400 font-black text-[10px] uppercase">Remover</button>
                      </div>
                    ) : (
                      <>
                        <input 
                          type="text" 
                          placeholder="CÓDIGO DO CUPOM" 
                          value={couponInput}
                          onChange={e => setCouponInput(e.target.value.toUpperCase())}
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-4 text-sm font-bold placeholder:text-zinc-600 uppercase"
                        />
                        <Button 
                          onClick={handleApplyCoupon} 
                          disabled={!couponInput || applyingCoupon}
                          variant="outline" 
                          className="rounded-2xl border-zinc-800 text-zinc-300 hover:bg-zinc-800"
                        >
                          {applyingCoupon ? '...' : 'Usar'}
                        </Button>
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center py-6 border-y border-zinc-800 mb-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="text-[9px] font-black uppercase tracking-widest">Subtotal:</span>
                      <span className="font-bold text-sm text-white">{formatCurrency(subTotal)}</span>
                    </div>
                    {appliedCoupon && (
                      (couponDiscount > 0 || !paymentMethod) ? (
                        <div className="flex justify-between items-center text-green-500">
                          <span className="text-[9px] font-black uppercase tracking-widest">Desconto ({appliedCoupon.code}):</span>
                          <span className="font-bold text-sm">
                            {couponDiscount > 0 
                              ? `- ${formatCurrency(couponDiscount)}` 
                              : (appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}%` : formatCurrency(appliedCoupon.value))
                            }
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-red-500">
                          <span className="text-[9px] font-black uppercase tracking-widest">Desconto ({appliedCoupon.code}):</span>
                          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                            Inválido para {paymentSettings?.methods.find(m => m.id === paymentMethod)?.label || 'este pagamento'}
                          </span>
                        </div>
                      )
                    )}
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="text-[9px] font-black uppercase tracking-widest">Entrega:</span>
                      <span className="font-bold text-sm text-white">
                        {selectedAreaId ? (deliveryFee === 0 ? <span className="text-green-500 font-black">GRÁTIS</span> : formatCurrency(deliveryFee)) : '--'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase tracking-[3px] text-zinc-500 mb-1">Valor Final:</span>
                    <span className="text-4xl font-black text-red-500 tracking-tighter">{formatCurrency(orderTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 p-3 sm:p-4 z-[60] lg:z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex sm:flex-col items-center sm:items-start justify-between w-full sm:w-auto px-4 sm:px-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 sm:mb-1">Total:</span>
            <span className="text-xl sm:text-2xl font-black text-red-500 tracking-tighter italic">{formatCurrency(orderTotal)}</span>
          </div>
          
          <div className="w-full sm:w-auto min-w-[260px] sm:min-w-[280px]">
            {checkoutStep === 'IDENTIFICACAO' && (
              <Button 
                onClick={handleIdentification}
                disabled={loading || !whatsapp || (isNewCustomer && !name)}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all disabled:opacity-30"
              >
                {loading ? 'Processando...' : 'Continuar'} <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'RESUMO' && (
              <Button 
                onClick={() => setCheckoutStep('RECEBIMENTO')}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all"
              >
                Como deseja receber? <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'ENDERECO' && (
              <Button 
                onClick={() => validateIdentification() && setCheckoutStep('AGENDAMENTO')}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all"
              >
                Agendar Entrega <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'AGENDAMENTO' && (
              <Button 
                disabled={!selectedSlot}
                onClick={() => setCheckoutStep('PAGAMENTO')}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all disabled:opacity-50"
              >
                Escolher Pagamento <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'PAGAMENTO' && (
              <Button 
                disabled={loading || !paymentMethod}
                onClick={handleCheckout}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 bg-green-600 hover:bg-green-700 text-white font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all"
              >
                {loading ? 'Processando...' : (receiveMethod === 'retirada' ? 'Finalizar e Retirar' : 'Finalizar Pedido')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
