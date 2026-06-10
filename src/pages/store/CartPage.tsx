import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useCartStore } from '../../store/cartStore';
import { useCustomerAuthStore } from '../../store/customerAuthStore';
import { formatCurrency, cn, roundTo2, formatVariantName } from '../../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, Trash2, ArrowRight, Calendar, Clock as ClockIcon, Sparkles, Search, MapPin } from 'lucide-react';
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
import LocationPicker from '../../components/checkout/LocationPicker';
import AddressConfirmation from '../../components/checkout/AddressConfirmation';

import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTypography } from '../../contexts/TypographyContext';
import { getComboReservedStocks } from '../../utils/comboStockHelper';

function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

export function CartPage() {
  const { currentTheme } = useTheme();
  const { config: typographyConfig } = useTypography();

  // Color combinations derived from the active admin theme configuration
  const bgText = currentTheme.backgroundTextColor || getContrastColor(currentTheme.backgroundColor);
  const isBgDark = bgText === '#ffffff';

  const cardBg = currentTheme.cardColor || (isBgDark ? 'rgba(24, 24, 27, 0.5)' : 'rgba(244, 244, 245, 0.5)');
  const cardText = currentTheme.cardTextColor || getContrastColor(cardBg);
  const isCardDark = cardText === '#ffffff';

  const borderHex = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';
  const borderCardHex = isCardDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(9, 9, 11, 0.08)';

  const subTextColor = isBgDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.5)';
  const subTextCardColor = isCardDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(9, 9, 11, 0.5)';

  const labelTextColor = isCardDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(9, 9, 11, 0.6)';

  const primaryColorText = currentTheme.primaryTextColor || getContrastColor(currentTheme.primaryColor);
  const highlightColor = currentTheme.highlightColor || currentTheme.primaryColor;

  const actionButtonBg = currentTheme.buttonColor || currentTheme.primaryColor;
  const actionButtonText = currentTheme.buttonTextColor || getContrastColor(actionButtonBg);

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
  
  // GPS/Geocoding structured states
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [cep, setCep] = useState<string>('');
  const [pais, setPais] = useState<string>('Brasil');

  const [showMissingFieldsDialog, setShowMissingFieldsDialog] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  
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

  // New Georeferencing State variables (iFood-Style)
  const [deliverySettings, setDeliverySettings] = useState<any>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(null);
  const [routeGeometry, setRouteGeometry] = useState<any>(null);

  // Out of stock validation states
  const [outOfStockItems, setOutOfStockItems] = useState<{
    id: string;
    name: string;
    requestedQty: number;
    availableStock: number;
    status: 'out_of_stock' | 'insufficient';
  }[]>([]);
  const [checkingStock, setCheckingStock] = useState(false);

  const checkCartStock = async () => {
    if (items.length === 0) return true;
    setCheckingStock(true);
    const problems: typeof outOfStockItems = [];

    try {
      const reservedStocks = await getComboReservedStocks();
      for (const item of items) {
        let availableStock = 9999;
        let controlStock = true;

        if (item.isCombo) {
          const comboRef = doc(db, 'combos', item.productId);
          const comboSnap = await getDoc(comboRef);
          if (comboSnap.exists()) {
            const comboData = comboSnap.data();
            const comboItems = comboData.items || [];
            const stocks: number[] = [];
            for (const cItem of comboItems) {
              const pRef = doc(db, 'products', cItem.productId);
              const pSnap = await getDoc(pRef);
              if (!pSnap.exists()) {
                stocks.push(0);
                continue;
              }
              const pData = pSnap.data();
              if (pData.active === false) {
                stocks.push(0);
                continue;
              }
              if (!pData.controlStock) {
                stocks.push(9999);
                continue;
              }

              if (cItem.variantId) {
                const vRef = doc(db, `products/${cItem.productId}/variants/${cItem.variantId}`);
                const vSnap = await getDoc(vRef);
                if (vSnap.exists()) {
                  const vData = vSnap.data();
                  stocks.push(Math.floor((Number(vData.stock) || 0) / cItem.quantity));
                } else {
                  stocks.push(0);
                }
              } else {
                stocks.push(Math.floor((Number(pData.stock) || 0) / cItem.quantity));
              }
            }
            availableStock = stocks.length > 0 ? Math.min(...stocks) : 0;
          } else {
            availableStock = 0;
          }
        } else {
          const pRef = doc(db, 'products', item.productId);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists()) {
            const pData = pSnap.data();
            controlStock = pData.controlStock ?? true;

            if (pData.active === false) {
              availableStock = 0;
            } else if (!controlStock || pData.allowBackorder) {
              availableStock = 9999;
            } else if (item.variantId) {
              const vRef = doc(db, `products/${item.productId}/variants/${item.variantId}`);
              const vSnap = await getDoc(vRef);
              if (vSnap.exists()) {
                const vData = vSnap.data();
                const realStock = Number(vData.stock) || 0;
                const key = `${item.productId}_${item.variantId}`;
                const reservedQty = reservedStocks.variants[key] || 0;
                availableStock = Math.max(0, realStock - reservedQty);
              } else {
                availableStock = 0;
              }
            } else {
              const realStock = Number(pData.stock) || 0;
              const reservedQty = reservedStocks.products[item.productId] || 0;
              availableStock = Math.max(0, realStock - reservedQty);
            }
          } else {
            availableStock = 0;
          }
        }

        if (availableStock < item.quantity) {
          problems.push({
            id: item.id,
            name: item.name + (item.variantName ? ` - ${item.variantName}` : ''),
            requestedQty: item.quantity,
            availableStock: Math.max(0, availableStock),
            status: availableStock <= 0 ? 'out_of_stock' : 'insufficient'
          });
        }
      }

      setOutOfStockItems(problems);
      return problems.length === 0;
    } catch (err) {
      console.error("Erro ao verificar estoque de itens:", err);
      return false;
    } finally {
      setCheckingStock(false);
    }
  };

  const handleResolveStockProblems = () => {
    outOfStockItems.forEach(prob => {
      if (prob.availableStock <= 0) {
        removeItem(prob.id);
      } else {
        updateQuantity(prob.id, prob.availableStock);
      }
    });
    setOutOfStockItems([]);
  };

  useEffect(() => {
    if (items.length > 0) {
      checkCartStock();
    } else {
      setOutOfStockItems([]);
    }
  }, [items]);
  
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
      const [fromH, fromM] = slot.from.split(':').map(Number);
      const [toH, toM] = slot.to.split(':').map(Number);
      
      let currentMinutes = fromH * 60 + fromM;
      const endMinutes = toH * 60 + toM;
      
      while (currentMinutes <= endMinutes) {
        const h = Math.floor(currentMinutes / 60);
        const m = currentMinutes % 60;
        const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        
        // If date is today, only show future slots
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
           const slotTime = new Date(date);
           slotTime.setHours(h, m, 0, 0);
           
           if (receiveMethod === 'retirada') {
              // For store pickup, allow scheduling any slot that is in the future
              if (slotTime.getTime() >= now.getTime()) {
                  slots.push(time);
              }
           } else {
              // For delivery, keep the original 1 hour gap
              if (slotTime.getTime() >= now.getTime() + 3600000) {
                  slots.push(time);
              }
           }
        } else {
          slots.push(time);
        }
        currentMinutes += 30; // 30-minute intervals
      }
    });

    return [...new Set(slots)].sort(); // Ensure unique and sorted
  }, [operatingHours, receiveMethod]);

  const getAvailableDays = useCallback(() => {
    if (!operatingHours) return [];
    
    const days: { date: string, label: string }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Look ahead up to 14 days to find the next 2 business days with slots
    for (let i = 0; i < 14 && days.length < 2; i++) {
      const current = new Date(today);
      current.setDate(today.getDate() + i);
      
      const yearStr = current.getFullYear();
      const monthStr = String(current.getMonth() + 1).padStart(2, '0');
      const dayStr = String(current.getDate()).padStart(2, '0');
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
      
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

  const tableSubTotal = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      const originalPrice = (item.originalPrice && item.originalPrice > 0) ? item.originalPrice : item.price;
      sum += originalPrice * item.quantity;
    }
    return roundTo2(sum);
  }, [items]);

  let couponDiscount = 0;
  if (appliedCoupon) {
    const isPaymentAllowed = !appliedCoupon.allowedPaymentMethods || 
      appliedCoupon.allowedPaymentMethods.length === 0 || 
      !paymentMethod || 
      appliedCoupon.allowedPaymentMethods.includes(paymentMethod);

    if (isPaymentAllowed) {
      if (appliedCoupon.type === 'percentage') {
        couponDiscount = tableSubTotal * (appliedCoupon.value / 100);
      } else if (appliedCoupon.type === 'fixed') {
        couponDiscount = appliedCoupon.value;
      }
    }
  }
  // Ensure discount does not exceed subtotal
  couponDiscount = Math.min(couponDiscount, subTotal);
  
  const hasFreeShippingPromo = items.some(i => i.isFreeShipping);
  
  const deliveryFee = useMemo(() => {
    if (receiveMethod !== 'entrega') return 0;
    if (hasFreeShippingPromo) return 0;

    // 1. Georeferenced iFood System (if deliverySettings is active)
    if (deliverySettings) {
      if (calculatedDistance === null) return 0;

      // Distance blockage checks
      if (calculatedDistance > deliverySettings.maxRadiusKm) return 0;

      // Free shipping eligibility
      const isValFree = deliverySettings.freeShippingAbove > 0 && subTotal >= deliverySettings.freeShippingAbove;
      const isDistFree = deliverySettings.freeShippingRadiusKm > 0 && calculatedDistance <= deliverySettings.freeShippingRadiusKm;
      if (isValFree || isDistFree) {
        return 0;
      }

      // Base formula: fixedFee + distanceKm * pricePerKm, subjected to minimumDeliveryFee
      const baseCost = deliverySettings.fixedFee + (calculatedDistance * deliverySettings.pricePerKm);
      return roundTo2(Math.max(baseCost, deliverySettings.minimumDeliveryFee));
    }

    // 2. Traditional Area System (Legacy Fallback)
    if (currentArea) {
      const isFree = currentArea.freteGratisAcima && subTotal >= currentArea.freteGratisAcima;
      return isFree ? 0 : currentArea.taxaEntrega;
    }

    return 0;
  }, [receiveMethod, hasFreeShippingPromo, deliverySettings, calculatedDistance, subTotal, currentArea]);

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

        // Fetch deliverySettings georeferencing configurations
        try {
          const dRef = doc(db, 'deliverySettings', 'config');
          const dSnap = await getDoc(dRef);
          if (dSnap.exists()) {
            setDeliverySettings(dSnap.data());
          }
        } catch (err) {
          console.warn("Could not load deliverySettings, fallback active:", err);
        }
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
         
         const cachedCep = currentCustomer.enderecoObj.cep || '';
         const cachedLat = currentCustomer.enderecoObj.latitude;
         const cachedLng = currentCustomer.enderecoObj.longitude;
         const cachedAcc = currentCustomer.enderecoObj.accuracy || 50;

         if (cachedCep) setCep(cachedCep);

         if (typeof cachedLat === 'number' && typeof cachedLng === 'number' && cachedLat !== 0) {
           setLatitude(cachedLat);
           setLongitude(cachedLng);
           setAccuracy(cachedAcc);
           setGpsCoords({ lat: cachedLat, lng: cachedLng, accuracy: cachedAcc });
         } else if (currentCustomer.enderecoObj.rua && currentCustomer.enderecoObj.bairro) {
           const addressQuery = `${currentCustomer.enderecoObj.rua}, ${currentCustomer.enderecoObj.numero}, ${currentCustomer.enderecoObj.bairro}, ${currentCustomer.enderecoObj.cidade}, ${currentCustomer.enderecoObj.estado}, Brasil`;
           fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressQuery)}`)
             .then(res => res.json())
             .then(data => {
               if (data && data.length > 0) {
                 const best = data[0];
                 const latVal = parseFloat(best.lat);
                 const lngVal = parseFloat(best.lon);
                 setLatitude(latVal);
                 setLongitude(lngVal);
                 setAccuracy(100);
                 setGpsCoords({ lat: latVal, lng: lngVal, accuracy: 100 });
               } else if (deliverySettings) {
                 setLatitude(deliverySettings.storeLatitude);
                 setLongitude(deliverySettings.storeLongitude);
                 setGpsCoords({ lat: deliverySettings.storeLatitude, lng: deliverySettings.storeLongitude, accuracy: 200 });
               }
             })
             .catch(err => {
               console.warn("Auto-geocoding of saved text address failed:", err);
               if (deliverySettings) {
                 setLatitude(deliverySettings.storeLatitude);
                 setLongitude(deliverySettings.storeLongitude);
                 setGpsCoords({ lat: deliverySettings.storeLatitude, lng: deliverySettings.storeLongitude, accuracy: 200 });
               }
             });
         }
      }
      lastSearchedPhone.current = currentCustomer.whatsapp.replace(/\D/g, '');
      
      // If identified, normally we go to RESUMO unless specifically navigating steps
      if (checkoutStep === 'IDENTIFICACAO') {
        setCheckoutStep('RESUMO');
      }
    }
  }, [currentCustomer, deliverySettings]);

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
            cep: (existing.endereco as any).cep || '',
            latitude: (existing.endereco as any).latitude || 0,
            longitude: (existing.endereco as any).longitude || 0,
            accuracy: (existing.endereco as any).accuracy || 0,
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

              const cachedCep = (addr as any).cep || '';
              const cachedLat = (addr as any).latitude;
              const cachedLng = (addr as any).longitude;
              const cachedAcc = (addr as any).accuracy || 50;

              if (cachedCep) setCep(cachedCep);

              if (typeof cachedLat === 'number' && typeof cachedLng === 'number' && cachedLat !== 0) {
                 setLatitude(cachedLat);
                 setLongitude(cachedLng);
                 setAccuracy(cachedAcc);
                 setGpsCoords({ lat: cachedLat, lng: cachedLng, accuracy: cachedAcc });
              } else if (addr.rua && addr.bairro) {
                 const addressQuery = `${addr.rua}, ${addr.numero}, ${addr.bairro}, ${addr.cidade}, ${addr.estado}, Brasil`;
                 fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addressQuery)}`)
                   .then(res => res.json())
                   .then(data => {
                     if (data && data.length > 0) {
                       const best = data[0];
                       const latVal = parseFloat(best.lat);
                       const lngVal = parseFloat(best.lon);
                       setLatitude(latVal);
                       setLongitude(lngVal);
                       setAccuracy(100);
                       setGpsCoords({ lat: latVal, lng: lngVal, accuracy: 100 });
                     } else if (deliverySettings) {
                       setLatitude(deliverySettings.storeLatitude);
                       setLongitude(deliverySettings.storeLongitude);
                       setGpsCoords({ lat: deliverySettings.storeLatitude, lng: deliverySettings.storeLongitude, accuracy: 200 });
                     }
                   })
                   .catch(() => {
                     if (deliverySettings) {
                       setLatitude(deliverySettings.storeLatitude);
                       setLongitude(deliverySettings.storeLongitude);
                       setGpsCoords({ lat: deliverySettings.storeLatitude, lng: deliverySettings.storeLongitude, accuracy: 200 });
                     }
                   });
              }
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
      <div className="max-w-4xl mx-auto px-4 py-20 text-center transition-colors duration-300" style={{ color: bgText }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 transition-all" style={{ backgroundColor: cardBg, color: subTextColor }}>
          <Trash2 size={40} />
        </div>
        <h2 className="text-2xl font-bold mb-4 storefront-check-title" style={{ color: bgText }}>Seu carrinho está vazio</h2>
        <p className="mb-8 storefront-check-summary" style={{ color: subTextColor }}>Adicione produtos para continuar sua compra.</p>
        <Button size="lg" asChild className="storefront-cart-btn" style={{ backgroundColor: actionButtonBg, color: actionButtonText }}>
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

    // Check for empty mandatory address fields (e.g. rua, numero, areaName/bairro, and crucial referencia)
    const missing: string[] = [];
    if (!rua?.trim()) missing.push('Rua / Logradouro');
    if (!numero?.trim()) missing.push('Número');
    if (!areaName?.trim()) missing.push('Bairro');
    if (!referencia?.trim()) missing.push('Ponto de Referência');

    if (missing.length > 0) {
      setMissingFields(missing);
      setShowMissingFieldsDialog(true);
      return false;
    }

    // Se estiver usando o modelo de georreferenciamento (estilo iFood)
    if (deliverySettings) {
      if (calculatedDistance === null) {
        toast("Calcule o traçado de rota primeiro.", 'warning');
        return false;
      }
      if (calculatedDistance > deliverySettings.maxRadiusKm) {
        toast(`Desculpe, ainda não entregamos nessa região. A distância máxima permitida é de ${deliverySettings.maxRadiusKm} km (Sua distância: ${calculatedDistance.toFixed(2)} km).`, 'error');
        return false;
      }
      return true;
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

    if (validArea.pedidoMinimo && subTotal < validArea.pedidoMinimo) {
      toast(`O pedido mínimo para sua região é de ${formatCurrency(validArea.pedidoMinimo)}`, 'error');
      return false;
    }

    return true;
  };

  const handleCheckout = async () => {
    const isStockOk = await checkCartStock();
    if (!isStockOk) {
      toast("Não foi possível finalizar o pedido. Alguns itens no seu carrinho estão com estoque insuficiente.", "error");
      return;
    }

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
      if (deliverySettings) {
        addressObj = { 
          estado: stateName, 
          cidade: cityName, 
          bairro: areaName, 
          rua, 
          numero, 
          complemento, 
          referencia,
          latitude: latitude || 0,
          longitude: longitude || 0,
          cep: cep || '',
          pais: pais || 'Brasil',
          accuracy: accuracy || 0,
          distanciaKm: calculatedDistance || 0,
          duracaoMinutos: calculatedDuration || 0,
          atualizadoEm: new Date().toISOString()
        };
        fullAddressString = `${rua}, ${numero} - ${areaName}, ${cityName}/${stateName}. CEP: ${cep || 'n/a'}. Ref: ${referencia}`;
      } else {
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
          referencia,
          latitude: latitude || 0,
          longitude: longitude || 0,
          cep: cep || '',
          pais: pais || 'Brasil',
          accuracy: accuracy || 0,
          atualizadoEm: new Date().toISOString()
        };
        fullAddressString = `${rua}, ${numero} - ${validArea.bairro}, ${validCity.nome}/${validState.sigla}. CEP: ${cep || 'n/a'}. Ref: ${referencia}`;
      }
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

      setCustomer({
          id: customerId,
          nome: name,
          whatsapp: whatsapp,
          email: email,
          enderecoObj: addressObj
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
      <div className="flex-1 min-h-screen pb-20 justify-center transition-colors duration-300" style={{ backgroundColor: currentTheme.backgroundColor, color: bgText }}>
         <div className="max-w-2xl mx-auto px-4 py-12">
            <h2 className="text-2xl font-black uppercase italic text-center mb-6 tracking-tighter storefront-check-title" style={{ color: bgText }}>Concluir Pagamento</h2>
            <div className="rounded-[2rem] p-6 shadow-2xl relative border" style={{ backgroundColor: cardBg, borderColor: borderCardHex }}>
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
              className="mt-6 hover:opacity-80 text-xs text-center w-full block uppercase font-bold tracking-widest font-sans transition-all"
              style={{ color: subTextColor }}
            >
              Cancelar Pagamento
            </button>
         </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-screen pb-20 transition-colors duration-300" style={{ backgroundColor: currentTheme.backgroundColor, color: bgText }}>
      {/* Header / Progress bar */}
      <div className="sticky top-16 z-40 border-b transition-colors duration-300" style={{ backgroundColor: currentTheme.backgroundColor, borderColor: borderHex }}>
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
                    className="flex flex-col items-center gap-1.5 transition-all duration-300 storefront-check-label"
                    style={{
                      color: isActive ? currentTheme.primaryColor : isPast ? cardText : subTextColor
                    }}
                  >
                    <div 
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all"
                      style={
                        isActive ? {
                          backgroundColor: currentTheme.primaryColor,
                          borderColor: currentTheme.primaryColor,
                          color: primaryColorText,
                          boxShadow: `0 0 10px ${currentTheme.primaryColor}40`
                        } : isPast ? {
                          backgroundColor: cardBg,
                          borderColor: borderCardHex,
                          color: cardText
                        } : {
                          backgroundColor: 'transparent',
                          borderColor: borderHex,
                          color: subTextColor
                        }
                      }
                    >
                      {idx + 1}
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest">{s.title}</span>
                  </button>
                  {idx < filteredSteps.length - 1 && (
                    <div 
                      className="h-[1px] flex-1 mx-2"
                      style={{
                        backgroundColor: isPast ? currentTheme.primaryColor : borderHex
                      }}
                    ></div>
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
                  <div className="rounded-[2rem] border p-6 sm:p-10 shadow-2xl text-center transition-all duration-300" style={{ backgroundColor: cardBg, borderColor: borderCardHex }}>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner transition-colors duration-300" style={{ backgroundColor: `${currentTheme.primaryColor}20`, color: currentTheme.primaryColor }}>
                      <Search size={28} />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter mb-2 storefront-check-title" style={{ color: cardText }}>Identificação</h2>
                    <p className="text-xs sm:text-sm font-medium mb-8 max-w-sm mx-auto storefront-check-summary" style={{ color: subTextCardColor }}>
                      Para continuar sua compra, precisamos saber quem você é.
                    </p>

                    <form onSubmit={handleIdentification} className="max-w-sm mx-auto space-y-4">
                      <div className="space-y-3">
                        <div className="relative">
                          <label className="block text-[10px] font-black mb-2 uppercase tracking-[3px] text-left px-2 storefront-check-label" style={{ color: subTextCardColor }}>WhatsApp *</label>
                          <input 
                            required 
                            type="tel"
                            value={whatsapp} 
                            onChange={e => setWhatsapp(e.target.value)}
                            className="w-full rounded-xl px-5 py-3 transition-all font-black text-lg sm:text-xl border storefront-check-field"
                            style={{ 
                              backgroundColor: currentTheme.backgroundColor, 
                              color: bgText, 
                              borderColor: borderHex 
                            }}
                            placeholder="(00) 00000-0000" 
                          />
                        </div>
                        {isNewCustomer && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="relative"
                          >
                            <label className="block text-[10px] font-black mb-2 uppercase tracking-[3px] text-left px-2 storefront-check-label" style={{ color: subTextCardColor }}>Como podemos te chamar? *</label>
                            <input 
                              required 
                              value={name} 
                              onChange={e => setName(e.target.value)}
                              className="w-full rounded-xl px-5 py-3 transition-all font-bold text-base sm:text-lg border storefront-check-field"
                              style={{ 
                                backgroundColor: currentTheme.backgroundColor, 
                                color: bgText, 
                                borderColor: borderHex 
                              }}
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
                  <div className="rounded-[2rem] border shadow-2xl overflow-hidden transition-all duration-300" style={{ backgroundColor: cardBg, borderColor: borderCardHex, color: cardText }}>
                    <div className="p-4 sm:p-6 border-b flex items-center justify-between" style={{ backgroundColor: `${currentTheme.backgroundColor}40`, borderColor: borderCardHex }}>
                      <h2 className="text-lg font-black uppercase italic tracking-tighter storefront-check-title" style={{ color: cardText }}>Sua Sacola</h2>
                      <span className="text-[9px] font-black uppercase tracking-widest storefront-check-label" style={{ color: subTextCardColor }}>{items.length} ITENS</span>
                    </div>
                    <ul className="divide-y" style={{ borderColor: borderCardHex }}>
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
                              className="p-5 sm:p-7 flex flex-col gap-5 group relative hover:opacity-95 transition-all duration-500"
                              style={{ borderBottom: `1px solid ${borderCardHex}` }}
                            >
                              {/* Item Header: Title & Variations spanning the width */}
                              <div className="w-full flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 border-b pb-3" style={{ borderColor: borderCardHex }}>
                                <h3 className="font-medium text-[10px] sm:text-[11px] uppercase tracking-[0.15em] leading-relaxed transition-colors duration-300 storefront-cart-title" style={{ color: cardText }}>
                                  {item.name}
                                </h3>
                                {item.variantName && (
                                  <span className="text-[9px] font-bold uppercase tracking-widest italic sm:text-right storefront-check-label" style={{ color: subTextCardColor }}>
                                    {formatVariantName(item.variantName)}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-row gap-5 sm:gap-8 items-center">
                                {/* Product Image with glass effect on quantity tag */}
                                <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-[1.5rem] overflow-hidden shrink-0 border shadow-2xl relative group/img" style={{ backgroundColor: currentTheme.backgroundColor, borderColor: borderHex }}>
                                  {item.imageUrl ? (
                                    <img src={item.imageUrl || undefined} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center border" style={{ backgroundColor: currentTheme.backgroundColor, borderColor: borderHex }}>
                                      <Sparkles size={18} className="mb-1 animate-pulse" style={{ color: currentTheme.primaryColor }} />
                                      <span className="text-[8px] font-black tracking-widest uppercase" style={{ color: subTextColor }}>Premium</span>
                                    </div>
                                  )}
                                  {/* Quantity Badge for Mobile */}
                                  {item.quantity > 1 && (
                                    <div className="absolute top-2 right-2 text-white w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shadow-lg sm:hidden border border-white/20" style={{ backgroundColor: currentTheme.primaryColor }}>
                                      {item.quantity}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity duration-500" />
                                </div>
                                
                                {/* Product Info */}
                                <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
                                  <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase tracking-widest mb-0.5 storefront-check-label" style={{ color: subTextCardColor }}>Preço Unitário</span>
                                      <span className="font-black text-lg sm:text-2xl tracking-tighter storefront-cart-subtotal" style={{ color: cardText }}>
                                        {formatCurrency(activeItemPrice)}
                                      </span>
                                      {isPromoInvalid && (
                                        <span className="text-[8px] text-red-500 font-bold uppercase tracking-wider mt-1">
                                          Promoção indisponível para esta forma de pagamento
                                        </span>
                                      )}
                                    </div>
                                    
                                    {item.quantity > 1 && (
                                      <div className="h-8 w-[1px] hidden sm:block mx-1" style={{ backgroundColor: borderCardHex }} />
                                    ) }
                                    {item.quantity > 1 && (
                                      <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase tracking-widest mb-0.5 storefront-check-label" style={{ color: subTextCardColor }}>Subtotal Item</span>
                                        <span className="text-[11px] sm:text-[13px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border storefront-cart-total" style={{ backgroundColor: `${currentTheme.primaryColor}10`, color: currentTheme.primaryColor, borderColor: `${currentTheme.primaryColor}20` }}>
                                          {formatCurrency(activeItemPrice * item.quantity)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                            {/* Actions & Quantity Selector */}
                            <div className="flex flex-col items-end gap-5 shrink-0">
                              <div className="flex items-center gap-1.5 p-1 rounded-2xl border shadow-2xl relative overflow-hidden group/controls" style={{ backgroundColor: currentTheme.backgroundColor, borderColor: borderHex }}>
                                <div className="absolute inset-x-0 bottom-0 h-[2px] transform scale-x-0 group-hover/controls:scale-x-100 transition-transform duration-500" style={{ backgroundColor: currentTheme.primaryColor }} />
                                
                                <button 
                                  onClick={() => handleUpdateQuantity(item.id, item.productId, item.variantId, item.quantity, item.quantity - 1)} 
                                  className="w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 group/minus" style={{ color: subTextColor }}
                                  title="Diminuir"
                                >
                                  <Minus size={18} className="group-hover/minus:scale-110 transition-transform" />
                                </button>
                                
                                <div className="w-8 flex flex-col items-center">
                                  <span className="text-[8px] font-black uppercase tracking-tighter mb-0.5" style={{ color: subTextColor }}>Qtd</span>
                                  <span className="font-black text-base" style={{ color: bgText }}>{item.quantity}</span>
                                </div>
                                
                                <button 
                                  onClick={() => handleUpdateQuantity(item.id, item.productId, item.variantId, item.quantity, item.quantity + 1)} 
                                  className="w-10 h-10 flex items-center justify-center rounded-xl transition-all active:scale-90 group/plus" style={{ color: subTextColor }}
                                  title="Aumentar"
                                >
                                  <Plus size={18} className="group-hover/plus:scale-110 transition-transform" />
                                </button>
                              </div>
                              
                              <button 
                                onClick={() => removeItem(item.id)} 
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 group/remove border animate-none" style={{ color: subTextColor, borderColor: 'transparent' }}
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
                      className="border rounded-[2.5rem] p-8 shadow-2xl overflow-hidden relative group transition-all duration-500" style={{ backgroundColor: cardBg, borderColor: `${currentTheme.primaryColor}20`, color: cardText }}
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Sparkles size={120} className="animate-pulse" style={{ color: currentTheme.primaryColor }} />
                      </div>
                      
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: currentTheme.primaryColor, boxShadow: `0 4px 14px ${currentTheme.primaryColor}40` }}>
                            <Sparkles size={16} style={{ color: primaryColorText }} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] storefront-cart-messages" style={{ color: currentTheme.primaryColor }}>
                            Check-out Inteligente: Sugestões Exclusivas
                          </span>
                        </div>
                        
                        <h4 className="text-2xl font-black mb-3 tracking-tighter leading-tight storefront-check-title" style={{ color: cardText }}>
                          Complete sua experiência
                        </h4>
                        <p className="font-medium text-sm mb-10 max-w-md italic storefront-check-summary" style={{ color: subTextCardColor }}>
                          "{aiSuggestions.motivo}"
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {aiSuggestions.produtos.map((p) => (
                            <div 
                              key={p.id} 
                              onClick={() => navigate(`/produto/${p.seo?.slug || p.id}?id=${p.id}`)}
                              className="cursor-pointer flex flex-col p-5 rounded-3xl border transition-all duration-500 group/item" style={{ backgroundColor: currentTheme.backgroundColor, borderColor: borderHex }}
                            >
                              <div className="flex gap-4 mb-4">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border" style={{ backgroundColor: currentTheme.backgroundColor, borderColor: borderHex }}>
                                  {p.imageUrl ? (
                                    <img src={p.imageUrl || undefined} alt={p.name} className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-700" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-800 text-[8px] uppercase font-bold">Sem foto</div>
                                  )}
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                  <h5 className="font-bold text-sm truncate uppercase tracking-tight mb-1" style={{ color: bgText }}>{p.name}</h5>
                                  <div className="font-black text-lg" style={{ color: currentTheme.primaryColor }}>{formatCurrency(p.price)}</div>
                                </div>
                              </div>

                              {p.shortDescription && (
                                <p className="text-[10px] line-clamp-2 mb-4 leading-relaxed italic" style={{ color: subTextColor }}>{p.shortDescription}</p>
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
                                className="w-full py-3 text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 rounded-xl storefront-cart-btn" style={{ backgroundColor: `${currentTheme.primaryColor}20`, color: currentTheme.primaryColor }}
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
                    <div className="border rounded-[2.5rem] p-12 flex flex-col items-center justify-center space-y-4 shadow-xl text-center" style={{ backgroundColor: cardBg, borderColor: borderCardHex }}>
                      <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: currentTheme.primaryColor, borderTopColor: 'transparent' }} />
                      <p className="text-[10px] font-black uppercase tracking-widest storefront-check-summary" style={{ color: subTextCardColor }}>IA analisando seu carrinho...</p>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-4 pt-10">
                    <Link 
                      to="/catalogo"
                      className="flex-1 py-8 text-xs font-black uppercase tracking-widest rounded-2xl border transition-all hover:opacity-80 flex items-center justify-center text-center leading-none" 
                      style={{ 
                        borderColor: currentTheme.primaryColor, 
                        backgroundColor: 'transparent', 
                        color: currentTheme.primaryColor 
                      }}
                    >
                      Escolher mais itens
                    </Link>
                    <Button 
                      onClick={() => setCheckoutStep('RECEBIMENTO')} 
                      size="lg" 
                      className="flex-[2] py-8 text-lg font-black italic uppercase tracking-widest rounded-2xl transition-all shadow-xl storefront-check-btn hover:opacity-90 border-0"
                      style={{ 
                        backgroundColor: currentTheme.primaryColor, 
                        color: primaryColorText,
                        boxShadow: `0 10px 25px ${currentTheme.primaryColor}30` 
                      }}
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
                    <h2 className="text-2xl sm:text-3xl font-black italic uppercase tracking-tighter storefront-check-title" style={{ color: bgText }}>Como deseja receber?</h2>
                    <p className="text-xs sm:text-sm font-medium storefront-check-summary" style={{ color: subTextColor }}>Selecione o método de entrega de sua preferência.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-2xl mx-auto">
                    <button
                      onClick={() => {
                        setReceiveMethod('entrega');
                        setCheckoutStep('ENDERECO');
                      }}
                      className="group relative flex flex-col items-center justify-center p-8 sm:p-10 border-2 rounded-[2rem] transition-all duration-500 hover:opacity-90"
                      style={{ backgroundColor: cardBg, borderColor: borderCardHex, color: cardText }}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors" style={{ backgroundColor: `${currentTheme.primaryColor}20`, color: currentTheme.primaryColor }}>
                        <motion.div whileHover={{ x: [0, 5, -5, 0] }}>
                          <ArrowRight size={20} />
                        </motion.div>
                      </div>
                      <span className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter storefront-check-title" style={{ color: cardText }}>Entregar em Casa</span>
                      <p className="text-[10px] mt-2 uppercase font-bold tracking-widest storefront-check-label" style={{ color: subTextCardColor }}>Enviamos para você</p>
                    </button>

                    <button
                      onClick={() => {
                        setReceiveMethod('retirada');
                        setCheckoutStep('AGENDAMENTO');
                      }}
                      className="group relative flex flex-col items-center justify-center p-8 sm:p-10 border-2 rounded-[2rem] transition-all duration-500 hover:opacity-90"
                      style={{ backgroundColor: cardBg, borderColor: borderCardHex, color: cardText }}
                    >
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors" style={{ backgroundColor: `${currentTheme.primaryColor}20`, color: currentTheme.primaryColor }}>
                        <ClockIcon size={20} />
                      </div>
                      <span className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter storefront-check-title" style={{ color: cardText }}>Receber na Loja</span>
                      <p className="text-[10px] mt-2 uppercase font-bold tracking-widest storefront-check-label" style={{ color: subTextCardColor }}>Você busca na loja</p>
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
                  className="space-y-6"
                >
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xl sm:text-2xl font-black uppercase italic tracking-tighter flex items-center gap-2 storefront-check-title" style={{ color: cardText }}>
                      <MapPin size={24} style={{ color: currentTheme.primaryColor }} /> Endereço de Entrega
                    </h3>
                    <p className="text-xs uppercase tracking-widest font-bold" style={{ color: subTextCardColor }}>
                      Priorizamos a precisão do GPS do seu dispositivo para evitar falhas de entrega.
                    </p>
                  </div>

                  {!gpsCoords ? (
                    <LocationPicker
                      onLocationSelected={(coords) => {
                        setGpsCoords(coords);
                        setLatitude(coords.lat);
                        setLongitude(coords.lng);
                        setAccuracy(coords.accuracy);
                      }}
                      accentColor={currentTheme.primaryColor}
                      cardBg={cardBg}
                      cardText={cardText}
                      subTextColor={subTextCardColor}
                    />
                  ) : (
                    <AddressConfirmation
                      initialCoords={gpsCoords}
                      dbStates={dbStates}
                      dbCities={dbCities}
                      dbAreas={dbAreas}
                      cartSubtotal={subTotal}
                      deliverySettings={deliverySettings}
                      calculatedDistance={calculatedDistance}
                      calculatedDuration={calculatedDuration}
                      routeGeometry={routeGeometry}
                      onRouteCalculated={(dist, dur, geom) => {
                        setCalculatedDistance(dist);
                        setCalculatedDuration(dur);
                        setRouteGeometry(geom);
                      }}
                      initialAddressState={{
                        latitude: latitude || gpsCoords.lat,
                        longitude: longitude || gpsCoords.lng,
                        accuracy: accuracy || gpsCoords.accuracy,
                        cep: cep,
                        rua: rua,
                        numero: numero,
                        bairro: areaName,
                        complemento: complemento,
                        referencia: referencia,
                        cidade: cityName,
                        estado: stateName,
                        pais: pais,
                      }}
                      onAddressConfirmed={(confirmedAddress, matchedArea, calculatedFee) => {
                        // Set standard checkout fields based on confirmed GPS attributes
                        setStateName(confirmedAddress.estado);
                        setCityName(confirmedAddress.cidade);
                        setAreaName(confirmedAddress.bairro);
                        setRua(confirmedAddress.rua);
                        setNumero(confirmedAddress.numero);
                        setComplemento(confirmedAddress.complemento || '');
                        setReferencia(confirmedAddress.referencia);
                        setLatitude(confirmedAddress.latitude);
                        setLongitude(confirmedAddress.longitude);
                        setCep(confirmedAddress.cep);
                        setAccuracy(confirmedAddress.accuracy);
                        setPais(confirmedAddress.pais);
                        setSelectedAreaId(matchedArea.id);
                        
                        // Advance to next Checkout session
                        setCheckoutStep('AGENDAMENTO');
                      }}
                      accentColor={currentTheme.primaryColor}
                      cardBg={cardBg}
                      cardText={cardText}
                      subTextColor={subTextCardColor}
                      borderHex={borderCardHex}
                      bgText={bgText}
                    />
                  )}
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
                  <div className="rounded-[2rem] border p-6 sm:p-10 shadow-2xl transition-all duration-300" style={{ backgroundColor: cardBg, borderColor: borderCardHex }}>
                    <h3 className="text-lg font-black uppercase tracking-[3px] mb-6 flex items-center gap-2 storefront-check-title" style={{ color: cardText }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.primaryColor }}></div>
                      Agendamento do Pedido
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
                      <div className="space-y-3">
                        <label className="block text-[9px] font-black uppercase tracking-[3px] storefront-check-label" style={{ color: subTextCardColor }}>Selecione uma Data</label>
                        <div className="grid grid-cols-1 gap-2">
                          {getAvailableDays().map((day) => (
                            <button
                              key={day.date}
                              onClick={() => {
                                setSelectedDate(day.date);
                                setSelectedSlot('');
                              }}
                              className="flex items-center justify-between px-5 py-3.5 rounded-xl border-2 transition-all group"
                              style={selectedDate === day.date
                                ? { backgroundColor: currentTheme.primaryColor, borderColor: currentTheme.primaryColor, color: primaryColorText }
                                : { backgroundColor: currentTheme.backgroundColor, borderColor: borderHex, color: bgText }
                              }
                            >
                              <div className="flex items-center gap-2.5">
                                <Calendar size={18} style={{ color: selectedDate === day.date ? primaryColorText : currentTheme.primaryColor }} />
                                <span className="font-bold text-base">{day.label}</span>
                              </div>
                              <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors"
                                style={selectedDate === day.date
                                  ? { borderColor: primaryColorText, backgroundColor: `${primaryColorText}20` }
                                  : { borderColor: borderHex }
                                }
                              >
                                {selectedDate === day.date && <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColorText }} />}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-[9px] font-black uppercase tracking-[3px] storefront-check-label" style={{ color: subTextCardColor }}>Horário Disponível</label>
                        <div className="grid grid-cols-3 gap-2">
                          {generateSlots(selectedDate).map(slot => (
                            <button
                                key={slot}
                                onClick={() => setSelectedSlot(slot)}
                                className="py-2.5 rounded-xl border font-bold text-[10px] transition-all"
                                 style={selectedSlot === slot 
                                   ? { backgroundColor: currentTheme.primaryColor, borderColor: currentTheme.primaryColor, color: primaryColorText, boxShadow: `0 4px 12px ${currentTheme.primaryColor}30` } 
                                   : { backgroundColor: currentTheme.backgroundColor, borderColor: borderHex, color: subTextColor }
                                 }
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
                  <div className="rounded-[2rem] border p-6 sm:p-10 shadow-2xl transition-all duration-300" style={{ backgroundColor: cardBg, borderColor: borderCardHex }}>
                    <h3 className="text-lg font-black uppercase tracking-[3px] mb-6 flex items-center gap-2 storefront-check-title" style={{ color: cardText }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.primaryColor }}></div>
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
                            className="flex flex-col items-start p-5 rounded-2xl border-2 transition-all text-left"
                            style={paymentMethod === method.id 
                              ? { backgroundColor: `${currentTheme.primaryColor}15`, borderColor: currentTheme.primaryColor, color: bgText, boxShadow: `0 4px 15px ${currentTheme.primaryColor}15` } 
                              : { backgroundColor: currentTheme.backgroundColor, borderColor: borderHex, color: subTextColor }
                            }
                          >
                            <span className="text-lg font-black italic tracking-tighter mb-0.5 uppercase storefront-check-title" style={{ color: paymentMethod === method.id ? currentTheme.primaryColor : cardText }}>{method.label}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60 italic storefront-check-label" style={{ color: subTextCardColor }}>Disponível</span>
                          </button>
                        ))
                      }
                    </div>

                    {paymentSettings?.methods.find(m => m.id === paymentMethod)?.label.toLowerCase().includes('dinheiro') && (
                      <div className="mb-6 space-y-3">
                        <label className="block text-[9px] font-black mb-2 uppercase tracking-widest storefront-check-label" style={{ color: subTextCardColor }}>Troco para quanto?</label>
                        <input 
                          type="number"
                          className="w-full sm:w-1/2 rounded-xl px-5 py-3 font-bold text-sm border storefront-check-field"
                          style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: borderHex }}
                          value={trocoPara} 
                          onChange={e => setTrocoPara(e.target.value)} 
                          placeholder="Ex: 50 ou 100"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      <label className="block text-[9px] font-black mb-2 uppercase tracking-widest storefront-check-label" style={{ color: subTextCardColor }}>Observações do Pedido</label>
                      <textarea 
                        className="w-full rounded-2xl px-5 py-5 font-bold min-h-[80px] text-sm border storefront-check-field"
                        style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: borderHex }}
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
              <div className="rounded-[2rem] border p-6 sm:p-10 shadow-2xl transition-all duration-300" style={{ backgroundColor: cardBg, borderColor: borderCardHex }}>
                <h2 className="text-lg font-black tracking-tighter uppercase italic mb-6 flex items-center justify-between storefront-check-title" style={{ color: cardText }}>
                  Resumo do Pedido
                  <span className="text-[10px] tracking-widest not-italic storefront-check-summary" style={{ color: subTextCardColor }}>{items.length} itens</span>
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
                          className="flex-1 rounded-2xl px-4 py-3 text-sm font-bold border storefront-check-field uppercase outline-none"
                          style={{ backgroundColor: currentTheme.backgroundColor, color: bgText, borderColor: borderHex }}
                        />
                        <button 
                          onClick={handleApplyCoupon} 
                          disabled={!couponInput || applyingCoupon}
                          className="rounded-2xl font-bold text-sm px-6 py-3 transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98] shrink-0"
                          style={{ 
                            backgroundColor: currentTheme.primaryColor, 
                            color: primaryColorText 
                          }}
                        >
                          {applyingCoupon ? '...' : 'Usar'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center py-6 border-y mb-6" style={{ borderColor: borderHex }}>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center storefront-check-summary" style={{ color: subTextCardColor }}>
                      <span className="text-[9px] font-black uppercase tracking-widest">Subtotal:</span>
                      <span className="font-bold text-sm storefront-check-title" style={{ color: cardText }}>{formatCurrency(subTotal)}</span>
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
                    <div className="flex justify-between items-center storefront-check-summary" style={{ color: subTextCardColor }}>
                      <span className="text-[9px] font-black uppercase tracking-widest">Entrega:</span>
                      <span className="font-bold text-sm storefront-check-title" style={{ color: cardText }}>
                        {selectedAreaId ? (deliveryFee === 0 ? <span className="text-green-500 font-black">GRÁTIS</span> : formatCurrency(deliveryFee)) : '--'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-black uppercase tracking-[3px] storefront-check-label mb-1" style={{ color: subTextCardColor }}>Valor Final:</span>
                    <span className="text-4xl font-black tracking-tighter" style={{ color: currentTheme.primaryColor }}>{formatCurrency(orderTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 w-full backdrop-blur-xl border-t p-3 sm:p-4 z-[60] lg:z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] transition-all duration-300"
        style={{ backgroundColor: `${currentTheme.backgroundColor}dd`, borderColor: borderHex }}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <div className="flex sm:flex-col items-center sm:items-start justify-between w-full sm:w-auto px-4 sm:px-0">
            <span className="text-[9px] font-black uppercase tracking-widest storefront-check-label sm:mb-1" style={{ color: subTextCardColor }}>Total:</span>
            <span className="text-xl sm:text-2xl font-black tracking-tighter italic storefront-check-title" style={{ color: currentTheme.primaryColor }}>{formatCurrency(orderTotal)}</span>
          </div>
          
          <div className="w-full sm:w-auto min-w-[260px] sm:min-w-[280px]">
            {checkoutStep === 'IDENTIFICACAO' && (
              <Button 
                onClick={handleIdentification}
                disabled={loading || !whatsapp || (isNewCustomer && !name)}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all disabled:opacity-30 storefront-cart-btn hover:opacity-90"
                style={{ backgroundColor: currentTheme.primaryColor, color: primaryColorText }}
              >
                {loading ? 'Processando...' : 'Continuar'} <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'RESUMO' && (
              <Button 
                onClick={async () => {
                  const isStockOk = await checkCartStock();
                  if (isStockOk) {
                    setCheckoutStep('RECEBIMENTO');
                  } else {
                    toast("Por favor, solucione os problemas de estoque no seu carrinho para continuar.", "error");
                  }
                }}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all storefront-cart-btn hover:opacity-90"
                style={{ backgroundColor: currentTheme.primaryColor, color: primaryColorText }}
              >
                Como deseja receber? <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'ENDERECO' && (
              <Button 
                onClick={async () => {
                  const isStockOk = await checkCartStock();
                  if (!isStockOk) {
                    toast("Por favor, solucione os problemas de estoque no seu carrinho para continuar.", "error");
                    return;
                  }
                  if (validateIdentification()) {
                    setCheckoutStep('AGENDAMENTO');
                  }
                }}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all storefront-cart-btn hover:opacity-90"
                style={{ backgroundColor: currentTheme.primaryColor, color: primaryColorText }}
              >
                Agendar Entrega <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'AGENDAMENTO' && (
               <Button 
                disabled={!selectedSlot}
                onClick={async () => {
                  const isStockOk = await checkCartStock();
                  if (!isStockOk) {
                    toast("Por favor, solucione os problemas de estoque no seu carrinho para continuar.", "error");
                    return;
                  }
                  setCheckoutStep('PAGAMENTO');
                }}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all disabled:opacity-50 storefront-cart-btn hover:opacity-90"
                style={{ backgroundColor: currentTheme.primaryColor, color: primaryColorText }}
              >
                Escolher Pagamento <ArrowRight className="ml-2 w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}

            {checkoutStep === 'PAGAMENTO' && (
              <Button 
                disabled={loading || !paymentMethod}
                onClick={handleCheckout}
                className="w-full h-12 sm:h-14 px-8 sm:px-12 font-black rounded-full text-xs sm:text-sm uppercase tracking-[2px] shadow-xl transition-all storefront-cart-btn hover:opacity-90"
                style={{ backgroundColor: currentTheme.primaryColor, color: primaryColorText }}
              >
                {loading ? 'Processando...' : (receiveMethod === 'retirada' ? 'Finalizar e Retirar' : 'Finalizar Pedido')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Alerta de Estoque */}
      <AnimatePresence>
        {outOfStockItems.length > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {}} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden border transition-all duration-300"
              style={{ backgroundColor: cardBg, borderColor: borderHex, color: cardText }}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-red-500/20 text-red-500">
                  <span className="text-3xl font-black">!</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight storefront-check-title" style={{ color: currentTheme.primaryColor }}>
                  Aviso de Estoque
                </h3>
                <p className="text-xs sm:text-sm mt-2" style={{ color: subTextCardColor }}>
                  Identificamos que alguns produtos no seu carrinho não possuem estoque disponível suficiente para a venda.
                </p>
              </div>

              <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2 mb-6">
                {outOfStockItems.map(item => (
                  <div key={item.id} className="p-4 rounded-2xl border flex flex-col gap-1" style={{ backgroundColor: `${currentTheme.backgroundColor}70`, borderColor: borderHex }}>
                    <span className="font-bold text-sm" style={{ color: cardText }}>{item.name}</span>
                    <div className="flex justify-between items-center text-xs" style={{ color: subTextCardColor }}>
                      <span>Qtd. no Carrinho: <strong className="font-black" style={{ color: cardText }}>{item.requestedQty}</strong></span>
                      <span>Disponível: <strong className="font-black text-red-500">{item.availableStock > 0 ? item.availableStock : 'Esgotado'}</strong></span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleResolveStockProblems}
                  className="w-full py-4 text-xs font-black uppercase tracking-[2px] rounded-full shadow-lg transition-all active:scale-[0.98] hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: currentTheme.primaryColor, color: primaryColorText }}
                >
                  Ajustar Carrinho Automaticamente
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showMissingFieldsDialog && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
              onClick={() => setShowMissingFieldsDialog(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md rounded-[2rem] p-6 sm:p-8 shadow-[0_0_50px_rgba(239,68,68,0.25)] border transition-all duration-300 text-left"
              style={{ backgroundColor: '#09090b', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ffffff' }}
            >
              <div className="flex items-center gap-3 mb-6 border-b border-red-500/10 pb-4">
                <div className="p-3 bg-red-500/10 rounded-2xl text-red-500">
                  <MapPin size={28} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-red-500 leading-none">Endereço Incompleto</h3>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Atenção aos detalhes do envio</span>
                </div>
              </div>

              <p className="text-zinc-300 text-sm mb-6 leading-relaxed">
                Para realizarmos sua entrega com o **sigilo, rapidez e discrição** que você merece, identificamos que as seguintes informações importantes ainda não foram preenchidas no seu endereço:
              </p>

              <ul className="space-y-3 mb-8 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800 animate-fade-in">
                {missingFields.map((field) => (
                  <li key={field} className="flex items-center gap-2.5 text-sm text-zinc-100 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span>{field}</span>
                    {field === 'Ponto de Referência' && (
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 font-bold ml-auto shrink-0">
                        Crucial / Obrigatório
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              <button 
                onClick={() => setShowMissingFieldsDialog(false)}
                className="w-full py-4 text-xs font-black uppercase tracking-[2px] rounded-full shadow-lg transition-all active:scale-[0.98] bg-red-600 text-white hover:bg-red-700 cursor-pointer"
              >
                Completar meu Endereço
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
