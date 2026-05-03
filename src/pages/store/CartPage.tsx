import { useState, useEffect, useRef, useCallback } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { formatCurrency, cn, roundTo2 } from '../../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, Calendar, Clock as ClockIcon, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFeedback } from '../../contexts/FeedbackContext';
import { motion, AnimatePresence } from 'motion/react';
import { customerService } from '../../services/customerService';
import { stockMovementService } from '../../services/stockMovementService';
import { deliveryAreaService, State, City, DeliveryArea } from '../../services/deliveryAreaService';
import { settingsService, PaymentSettings, MercadoPagoSettings, OperatingHoursSettings } from '../../services/settingsService';

import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

export function CartPage() {
  const { items, updateQuantity, removeItem, clearCart, total } = useCartStore();
  const { currentCustomer } = useCustomerAuthStore();
  const navigate = useNavigate();
  const { toast } = useFeedback();
  
  const [step, setStep] = useState(1);
  const [paymentMode, setPaymentMode] = useState<'entrega' | 'retirada' | 'online'>('entrega');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  
  // Settings
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [mpSettings, setMpSettings] = useState<MercadoPagoSettings | null>(null);
  const [operatingHours, setOperatingHours] = useState<OperatingHoursSettings | null>(null);
  
  // Checkout form fields
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');

  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  
  // Endereco
  const [dbStates, setDbStates] = useState<State[]>([]);
  const [dbCities, setDbCities] = useState<City[]>([]);
  const [dbAreas, setDbAreas] = useState<DeliveryArea[]>([]);

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
  const [trocoPara, setTrocoPara] = useState('');
  
  const [aiSuggestions, setAiSuggestions] = useState<{ motivo: string, produtos: any[] } | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [showMpBrick, setShowMpBrick] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

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
  const subTotal = roundTo2(total());
  const deliveryFee = roundTo2(currentArea ? (currentArea.freteGratisAcima && subTotal >= currentArea.freteGratisAcima ? 0 : currentArea.taxaEntrega) : 0);
  const orderTotal = roundTo2(subTotal + deliveryFee);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

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
      setStateName('');
      setCityName('');
      setAreaName('');
      toast("Por favor, selecione um Estado da lista.", "warning");
    }
  };

  const handleCityBlur = () => {
    const val = normalizeStr(cityName);
    if (!val) return;
    const normState = normalizeStr(stateName);
    const st = dbStates.find(s => normalizeStr(s.sigla) === normState || normalizeStr(s.nome) === normState);
    const match = dbCities.find(c => normalizeStr(c.nome) === val && (st ? c.stateId === st.id : true));
    if (match) {
      setCityName(match.nome);
    } else {
      setCityName('');
      setAreaName('');
      toast("Por favor, selecione uma Cidade da lista.", "warning");
    }
  };

  const handleAreaBlur = () => {
    const val = normalizeStr(areaName);
    if (!val) return;
    const normCity = normalizeStr(cityName);
    const ct = dbCities.find(c => normalizeStr(c.nome) === normCity);
    const match = dbAreas.find(a => normalizeStr(a.bairro) === val && (ct ? a.cityId === ct.id : true));
    if (match) {
      setAreaName(match.bairro);
    } else {
      setAreaName('');
      toast("Por favor, selecione um Bairro atendido da lista.", "warning");
    }
  };

  // Preload from customer storage if we have one
  useEffect(() => {
    if (currentCustomer && whatsapp === '') {
      setName(currentCustomer.nome || '');
      setWhatsapp(currentCustomer.whatsapp || '');
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
    }
  }, [currentCustomer, whatsapp]);

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
    
    // Only search if changed and >= 10 digits
    if (cleanPhone.length >= 10 && cleanPhone !== lastSearchedPhone.current && !lookingUp) {
      const timer = setTimeout(async () => {
        // Double check after timeout
        if (cleanPhone === lastSearchedPhone.current) return;

        setLookingUp(true);
        lastSearchedPhone.current = cleanPhone;

        try {
          const cust = await customerService.getCustomerByWhatsapp(cleanPhone);
          
          if (cust && cust.endereco) {
            setName(cust.nome);
            if (cust.email) setEmail(cust.email);
            
            const addr = cust.endereco;
            const states = await deliveryAreaService.listStates();
            const state = states.find(s => 
               s.sigla.trim().toUpperCase() === addr.estado.trim().toUpperCase()
            );
            
            if (state) {
              // 1. SELECT STATE
              setStateName(state.sigla);
              
              // Load cities manually to ensure we find the right one
              const cities = await deliveryAreaService.listCities(state.id!);
              const activeCities = cities.filter(ci => ci.status === 'ativo');
              
              const city = activeCities.find(c => 
                 c.nome.trim().toLowerCase() === addr.cidade.trim().toLowerCase()
              );
              
              if (city) {
                // Wait for State selection to settle
                await new Promise(resolve => setTimeout(resolve, 800));
                
                // 3. SELECT CITY
                setCityName(city.nome);
                
                // Load areas manually to ensure we find the right one
                const areas = await deliveryAreaService.listActiveDeliveryAreasForCity(city.id!);
                
                const area = areas.find(a => 
                   a.bairro.trim().toLowerCase() === addr.bairro.trim().toLowerCase()
                );
                
                if (area) {
                  // Wait for City selection to settle
                  await new Promise(resolve => setTimeout(resolve, 800));
                  
                  // 5. SELECT AREA
                  setSelectedAreaId(area.id!);
                  setAreaName(area.bairro);
                }
              }
            }
            
            setRua(addr.rua);
            setNumero(addr.numero);
            setReferencia(addr.referencia);
            if (addr.complemento) setComplemento(addr.complemento);
            if (cust.notes) setNotes(cust.notes);
            
            toast(`Olá ${cust.nome.split(' ')[0]}, bem-vindo(a) de volta!`, 'success');
          }
        } catch (err) {
          console.error("Lookup error:", err);
        } finally {
          setLookingUp(false);
        }
      }, 1000); 
      return () => clearTimeout(timer);
    }
  }, [whatsapp, lookingUp, toast]);

  useEffect(() => {
    // Only fetch if has items and haven't fetched yet for this session/cart
    if (items.length > 0 && !aiSuggestions && !loadingSuggestions) {
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
  }, [items.length, aiSuggestions, loadingSuggestions]); // Run only when starting a new cart or items count changes from 0 

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

    const normState = normalizeStr(stateName);
    const normCity = normalizeStr(cityName);
    const normArea = normalizeStr(areaName);

    const validState = dbStates.find(s => normalizeStr(s.sigla) === normState || normalizeStr(s.nome) === normState);
    const validCity = dbCities.find(c => normalizeStr(c.nome) === normCity);
    const validArea = dbAreas.find(a => 
      (normalizeStr(a.stateName) === normalizeStr(validState?.sigla || '') || normalizeStr(a.stateName) === normalizeStr(validState?.nome || '')) &&
      normalizeStr(a.cityName) === normalizeStr(validCity?.nome || '') &&
      normalizeStr(a.bairro) === normArea
    );

    if (!validState || !validCity || !validArea) return;
    
    setLoading(true);
    try {
      const addressObj = { 
        estado: validState.sigla, 
        cidade: validCity.nome, 
        bairro: validArea.bairro, 
        rua, 
        numero, 
        complemento, 
        referencia 
      };
      
      const customerId = await customerService.registerFromCheckout({
          nome: name,
          whatsapp: whatsapp,
          email: email,
          endereco: addressObj,
          status: 'ativo'
      });

      const exactNow = serverTimestamp();

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
        customerAddress: `${rua}, ${numero} - ${validArea.bairro}, ${validCity.nome}/${validState.sigla}. Ref: ${referencia}`,
        fullAddress: addressObj,
        scheduledDate: selectedDate,
        scheduledTime: selectedSlot,
        notes: finalNotes,
        subTotal: subTotal,
        deliveryFee: deliveryFee,
        total: orderTotal,
        deliveryAreaId: validArea.id,
        paymentMethod: paymentMethod,
        status: 'NOVO',
        type: 'online',
        items: items.map(i => ({
          productId: i.productId,
          variantId: i.variantId || null,
          name: i.name + (i.variantName ? ` - ${i.variantName}` : ''),
          price: i.price,
          quantity: i.quantity,
          sku: i.sku || ''
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    { title: 'Carrinho', id: 1 },
    { title: 'Identificação', id: 2 },
    { title: 'Agendamento', id: 3 },
    { title: 'Pagamento', id: 4 },
  ];

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
      {/* Header / Tabs */}
      <div className="bg-zinc-950 border-b border-zinc-900 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-2">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex-1 flex items-center">
                <button 
                  onClick={() => s.id < step && setStep(s.id)}
                  disabled={s.id > step}
                  className={cn(
                    "flex flex-col items-center gap-2 transition-all duration-300",
                    s.id === step ? "text-red-500" : s.id < step ? "text-zinc-300" : "text-zinc-700"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all",
                    s.id === step ? "bg-red-600 border-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]" : 
                    s.id < step ? "bg-zinc-800 border-zinc-700 text-white" : "bg-transparent border-zinc-800"
                  )}>
                    {s.id}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">{s.title}</span>
                </button>
                {idx < steps.length - 1 && (
                  <div className={cn(
                    "h-[1px] flex-1 mx-4 sm:mx-8",
                    s.id < step ? "bg-red-600" : "bg-zinc-800"
                  )}></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12 pb-40">
        <div className="flex flex-col gap-12 max-w-4xl mx-auto w-full">
          
          <div className="w-full">
            <div className="flex justify-between border-b border-zinc-800 mb-8 sm:mb-12 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setStep(1)} 
                className={cn(
                  "pb-4 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap", 
                  step === 1 ? "border-b-2 border-red-600 text-white" : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                1. Sacola
              </button>
              <button 
                onClick={() => setStep(2)} 
                className={cn(
                  "pb-4 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap", 
                  step === 2 ? "border-b-2 border-red-600 text-white" : "text-zinc-600 hover:text-zinc-400"
                )}
              >
                2. Entrega
              </button>
              <button 
                onClick={() => items.length > 0 && name && setStep(3)} 
                disabled={items.length === 0 || !name}
                className={cn(
                  "pb-4 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap", 
                  step === 3 ? "border-b-2 border-red-600 text-white" : "text-zinc-600 hover:text-zinc-400 disabled:opacity-30"
                )}
              >
                3. Agendamento
              </button>
              <button 
                onClick={() => items.length > 0 && name && selectedSlot && setStep(4)} 
                disabled={items.length === 0 || !name || !selectedSlot}
                className={cn(
                  "pb-4 px-6 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap", 
                  step === 4 ? "border-b-2 border-red-600 text-white" : "text-zinc-600 hover:text-zinc-400 disabled:opacity-30"
                )}
              >
                4. Pagamento
              </button>
            </div>

            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-8"
                >
                  <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 shadow-2xl overflow-hidden">
                    <ul className="divide-y divide-zinc-800">
                      {items.map((item) => (
                        <li key={item.id} className="p-6 sm:p-8 flex flex-col sm:flex-row gap-6 sm:items-center group">
                          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-zinc-800 rounded-3xl overflow-hidden shrink-0 border border-zinc-700">
                            {item.imageUrl ? (
                              <img src={item.imageUrl || undefined} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[10px] text-center uppercase font-bold px-2">Sem Imagem</div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-zinc-100 uppercase tracking-tight">{item.name}</h3>
                            {item.variantName && <p className="text-xs font-bold text-red-500 uppercase tracking-widest mt-1">{item.variantName}</p>}
                            <div className="font-black text-xl text-white mt-1">{formatCurrency(item.price)}</div>
                          </div>
                          <div className="flex items-center gap-4 bg-zinc-950 p-1.5 rounded-full border border-zinc-800 w-max">
                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white rounded-full hover:bg-zinc-800">
                              <Minus size={16} />
                            </button>
                            <span className="w-6 text-center font-black text-sm">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-zinc-500 hover:text-white rounded-full hover:bg-zinc-800">
                              <Plus size={16} />
                            </button>
                          </div>
                          <button onClick={() => removeItem(item.id)} className="w-10 h-10 flex items-center justify-center text-zinc-600 hover:text-red-500 rounded-full border border-zinc-800">
                            <Trash2 size={18} />
                          </button>
                        </li>
                      ))}
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
                                    quantity: 1,
                                    sku: p.sku || '',
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
                  <Link to="/catalogo" className="inline-flex items-center text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-red-500 transition-colors">
                    <Plus size={14} className="mr-2" /> Escolher mais itens
                  </Link>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                >
                  <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 sm:p-12 shadow-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div>
                        <label className="block text-[10px] font-black mb-3 uppercase tracking-[3px] text-zinc-500">WhatsApp *</label>
                        <div className="relative">
                          <input 
                            required type="tel" value={whatsapp} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-5 text-white focus:ring-2 focus:ring-red-600 transition-all font-bold text-lg"
                            onChange={e => setWhatsapp(e.target.value)} 
                            placeholder="(00) 00000-0000" 
                          />
                          {lookingUp && <div className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black mb-3 uppercase tracking-[3px] text-zinc-500">Como prefere ser chamado? *</label>
                        <input 
                          required value={name} 
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-5 text-white focus:ring-2 focus:ring-red-600 transition-all font-bold text-lg"
                          onChange={e => setName(e.target.value)} 
                          placeholder="Seu nome ou apelido" 
                        />
                      </div>
                    </div>

                    <div className="space-y-8">
                      <h3 className="text-sm font-black uppercase tracking-[4px] text-zinc-100 flex items-center gap-3">
                        <div className="w-2 h-2 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.6)]"></div>
                        Endereço para entrega
                      </h3>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">UF *</label>
                          <input 
                            required 
                            list="states-list" 
                            value={stateName} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white uppercase font-bold" 
                            onChange={e => setStateName(e.target.value.toUpperCase())} 
                            onBlur={handleStateBlur}
                            placeholder="UF" 
                          />
                          <datalist id="states-list">
                            {dbStates.map(s => <option value={s.sigla} key={s.id}>{s.nome}</option>)}
                            {dbStates.map(s => <option value={s.nome} key={`name-${s.id}`}>{s.sigla}</option>)}
                          </datalist>
                        </div>
                        <div className="col-span-1 sm:col-span-2">
                          <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">Cidade *</label>
                          <input 
                            required 
                            list="cities-list" 
                            value={cityName} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold" 
                            onChange={e => setCityName(e.target.value)} 
                            onBlur={handleCityBlur}
                            placeholder="Cidade" 
                          />
                          <datalist id="cities-list">
                            {dbCities
                              .filter(c => { 
                                const normState = normalizeStr(stateName);
                                const st = dbStates.find(s => normalizeStr(s.sigla) === normState || normalizeStr(s.nome) === normState); 
                                return st ? c.stateId === st.id : true; 
                              })
                              .map(c => <option value={c.nome} key={c.id}>{c.stateName}</option>)
                            }
                          </datalist>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">Bairro *</label>
                          <input 
                            required 
                            list="areas-list" 
                            value={areaName} 
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold" 
                            onChange={e => setAreaName(e.target.value)} 
                            onBlur={handleAreaBlur}
                            placeholder="Bairro" 
                          />
                          <datalist id="areas-list">
                            {dbAreas
                              .filter(a => { 
                                const normCity = normalizeStr(cityName);
                                const ct = dbCities.find(c => normalizeStr(c.nome) === normCity); 
                                return ct ? a.cityId === ct.id : true; 
                              })
                              .map(a => <option value={a.bairro} key={a.id}>{a.cityName}</option>)
                            }
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">Rua *</label>
                          <input required value={rua} onChange={e => setRua(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold" placeholder="Nome da rua" />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">Número *</label>
                          <input required value={numero} onChange={e => setNumero(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold" placeholder="Nº" />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">Referência *</label>
                          <input required value={referencia} onChange={e => setReferencia(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold" placeholder="Lado de..." />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                >
                  <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 sm:p-12 shadow-2xl">
                    <h3 className="text-xl font-black uppercase tracking-[4px] text-zinc-100 mb-8 flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      Quando deseja receber seu pedido?
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div className="space-y-4">
                        <label className="block text-[10px] font-black uppercase tracking-[3px] text-zinc-500">Selecione uma Data</label>
                        <div className="grid grid-cols-1 gap-3">
                          {getAvailableDays().map((day) => (
                            <button
                              key={day.date}
                              onClick={() => {
                                setSelectedDate(day.date);
                                setSelectedSlot('');
                              }}
                              className={cn(
                                "flex items-center justify-between px-6 py-5 rounded-2xl border-2 transition-all group",
                                selectedDate === day.date
                                  ? "bg-red-600 border-red-600 text-white shadow-lg"
                                  : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Calendar size={20} className={cn(selectedDate === day.date ? "text-white" : "text-zinc-600 group-hover:text-red-500")} />
                                <span className="font-bold text-lg">{day.label}</span>
                              </div>
                              <div className={cn(
                                "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                selectedDate === day.date ? "border-white bg-white/20" : "border-zinc-800"
                              )}>
                                {selectedDate === day.date && <div className="w-2 h-2 bg-white rounded-full" />}
                              </div>
                            </button>
                          ))}
                          {getAvailableDays().length === 0 && (
                            <div className="p-6 bg-zinc-950/50 border border-dashed border-zinc-800 rounded-2xl text-center">
                              <p className="text-zinc-500 text-sm font-medium">Nenhuma data disponível para entrega no momento.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-[10px] font-black uppercase tracking-[3px] text-zinc-500">Horário Disponível</label>
                        {generateSlots(selectedDate).length > 0 ? (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {generateSlots(selectedDate).map(slot => (
                                    <button
                                        key={slot}
                                        onClick={() => setSelectedSlot(slot)}
                                        className={cn(
                                            "py-3 rounded-xl border font-bold text-xs transition-all",
                                            selectedSlot === slot 
                                            ? "bg-red-600 border-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]" 
                                            : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                                        )}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl text-center">
                                <p className="text-xs text-zinc-500 font-bold italic">Não há horários disponíveis para esta data.</p>
                            </div>
                        )}
                      </div>
                    </div>

                    {selectedSlot && (
                        <div className="bg-red-600/10 border border-red-600/20 p-6 rounded-3xl flex items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                            <ClockIcon className="text-red-500 shrink-0" size={24} />
                            <div>
                                <p className="text-xs font-bold text-zinc-300">Você selecionou a entrega para às <span className="text-red-500 font-black">{selectedSlot}h</span> do dia <span className="font-black text-white">{selectedDate.split('-').reverse().join('/')}</span>.</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mt-1">Aviso: Você poderá receber seu pedido até 60min antes do horário desejado.</p>
                            </div>
                        </div>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-12"
                >
                  <div className="bg-zinc-900 rounded-[2.5rem] border border-zinc-800 p-8 sm:p-12 shadow-2xl">
                    <h3 className="text-xl font-black uppercase tracking-[4px] text-zinc-100 mb-8 flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      Como deseja receber?
                    </h3>

                    <div className="grid grid-cols-2 gap-4 mb-12">
                      <button
                        onClick={() => setPaymentMode('entrega')}
                        className={cn(
                          "flex flex-col items-center p-6 rounded-3xl border-2 transition-all",
                          paymentMode === 'entrega' 
                          ? "bg-red-600/10 border-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.1)]" 
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        )}
                      >
                        <span className="text-lg font-black italic tracking-tighter mb-1 uppercase">Entregar em Casa</span>
                      </button>
                      <button
                        onClick={() => setPaymentMode('retirada')}
                        className={cn(
                          "flex flex-col items-center p-6 rounded-3xl border-2 transition-all",
                          paymentMode === 'retirada' 
                          ? "bg-red-600/10 border-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.1)]" 
                          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        )}
                      >
                        <span className="text-lg font-black italic tracking-tighter mb-1 uppercase">Retirar na Loja</span>
                      </button>
                    </div>

                    <h3 className="text-xl font-black uppercase tracking-[4px] text-zinc-100 mb-8 flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      Forma de Pagamento
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {paymentSettings && paymentSettings.methods
                        .filter(m => paymentMode === 'entrega' ? m.enabledDelivery : m.enabledPickup)
                        .map(method => {
                          const isSelected = paymentMethod === method.id;
                          return (
                            <button
                              key={method.id}
                              onClick={() => setPaymentMethod(method.id)}
                              className={cn(
                                "flex flex-col items-start p-6 rounded-3xl border-2 transition-all text-left",
                                isSelected 
                                ? "bg-red-600/10 border-red-600 text-white shadow-[0_0_30px_rgba(220,38,38,0.1)]" 
                                : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              )}
                            >
                              <span className="text-xl font-black italic tracking-tighter mb-1 uppercase">{method.label}</span>
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-60 text-current italic">Disponível</span>
                            </button>
                          );
                        })
                      }
                      {!paymentSettings && <p className="text-zinc-600 italic">Carregando opções...</p>}
                    </div>

                    <AnimatePresence>
                      {paymentSettings?.methods.find(m => m.id === paymentMethod)?.label.toLowerCase().includes('dinheiro') && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 space-y-4 overflow-hidden"
                        >
                          <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">Troco para quanto?</label>
                          <input 
                            type="number"
                            className="w-full sm:w-1/2 bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white font-bold focus:ring-2 focus:ring-red-600"
                            value={trocoPara} 
                            onChange={e => setTrocoPara(e.target.value)} 
                            onBlur={e => setTrocoPara(e.target.value ? roundTo2(parseFloat(e.target.value)).toString() : '')}
                            placeholder="Ex: 50 ou 100 (Deixe em branco se não precisar)"
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-12 space-y-4">
                      <label className="block text-[10px] font-black mb-3 uppercase tracking-widest text-zinc-500">Algum detalhe especial?</label>
                      <textarea 
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-3xl px-6 py-6 text-white font-bold min-h-[100px] focus:ring-2 focus:ring-red-600"
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                        placeholder="Ex: Não tocar o interfone, embalagem neutra..."
                      />
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-4 text-zinc-600 p-8 border border-zinc-900 rounded-[2.5rem] bg-zinc-950/50">
                    <span className="text-[10px] font-black uppercase tracking-[4px] flex items-center gap-2">
                       <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                       Ambiente Oficial e Seguro
                    </span>
                    <p className="text-[10px] text-center font-bold px-4 leading-relaxed uppercase opacity-40">
                      Seu pedido será entregue em embalagem lacrada sem qualquer identificação de sexshop.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Checkout Summary - Now Below Content */}
          <div className="w-full">
            <div className="bg-zinc-900 rounded-[3rem] border border-zinc-800 p-8 sm:p-12 shadow-2xl">
              <h2 className="text-xl font-black tracking-tighter uppercase italic mb-8 flex items-center justify-between">
                Resumo do Pedido
                <span className="text-xs text-zinc-600 tracking-widest not-italic">{items.length} itens no total</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center py-8 border-y border-zinc-800 mb-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-zinc-500">
                    <span className="text-[10px] font-black uppercase tracking-widest">Subtotal:</span>
                    <span className="font-bold text-white">{formatCurrency(subTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-500">
                    <span className="text-[10px] font-black uppercase tracking-widest">Entrega:</span>
                    <span className="font-bold text-white">
                      {selectedAreaId ? (deliveryFee === 0 ? <span className="text-green-500 font-black">GRÁTIS</span> : formatCurrency(deliveryFee)) : '--'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black uppercase tracking-[4px] text-zinc-500 mb-1">Valor Final:</span>
                  <span className="text-5xl font-black text-red-500 tracking-tighter">{formatCurrency(orderTotal)}</span>
                </div>
              </div>
              {/* Buttons removed from here as they are now fixed at the bottom */}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-900 p-4 sm:p-6 z-[60] lg:z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total do Pedido</span>
            <span className="text-2xl font-black text-red-500 tracking-tighter italic">{formatCurrency(orderTotal)}</span>
          </div>
          
          <div className="w-full sm:w-auto min-w-[280px]">
            {step === 1 && (
              <Button 
                onClick={() => setStep(2)}
                className="w-full h-16 sm:h-14 px-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-full text-sm uppercase tracking-[2px] shadow-xl transition-all"
              >
                Seguir para Entrega <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}

            {step === 2 && (
              <Button 
                onClick={() => validateIdentification() && setStep(3)}
                className="w-full h-16 sm:h-14 px-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-full text-sm uppercase tracking-[2px] shadow-xl transition-all"
              >
                Agendar Entrega <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}

            {step === 3 && (
              <Button 
                disabled={!selectedSlot}
                onClick={() => setStep(4)}
                className="w-full h-16 sm:h-14 px-12 bg-red-600 hover:bg-red-700 text-white font-black rounded-full text-sm uppercase tracking-[2px] shadow-xl transition-all disabled:opacity-50"
              >
                Escolher Pagamento <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            )}

            {step === 4 && (
              <Button 
                disabled={loading || !paymentMethod}
                onClick={handleCheckout}
                className="w-full h-16 sm:h-14 px-12 bg-green-600 hover:bg-green-700 text-white font-black rounded-full text-sm uppercase tracking-[2px] shadow-xl transition-all"
              >
                {loading ? 'Processando...' : (paymentMode === 'retirada' ? 'Finalizar e aguardar retirada' : 'Finalizar e Receber em Casa')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
