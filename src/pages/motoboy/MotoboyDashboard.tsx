import { deliveryTrackingService } from "../../services/deliveryTrackingService";
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../lib/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  addDoc,
  limit
} from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { useFeedback } from '../../contexts/FeedbackContext';
import { useSettings } from '../../contexts/SettingsContext';
import { pdvFinancialService } from '../../services/pdvFinancialService';
import { 
  LogOut, 
  MapPin, 
  TrendingUp, 
  Bike, 
  CheckCircle, 
  Loader2, 
  RotateCw, 
  Navigation, 
  DollarSign, 
  Camera, 
  PenTool, 
  Trash2, 
  Smartphone, 
  Activity, 
  ArrowRight,
  Eye,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  CreditCard,
  CheckSquare
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseGoogleGeocode } from '../../utils/googleMapsUtils';

// Fix default Leaflet icon assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper for distance Calculation
function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

export function MotoboyDashboard() {
  const navigate = useNavigate();
  const { user, userData, checkAuth } = useAuthStore();
  const { toast, confirm } = useFeedback();
  const settings = useSettings();

  const [driverStatus, setDriverStatus] = useState<'active' | 'inactive'>('active');
  const [authChecking, setAuthChecking] = useState(true);
  
  // Deliveries State
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Active delivery GPS Tracking state
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [driverGPS, setDriverGPS] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsWatcherId, setGpsWatcherId] = useState<number | null>(null);
  const [gpsPermissionState, setGpsPermissionState] = useState<string>('unknown');

  // Stats
  const [completedTodayCount, setCompletedTodayCount] = useState(0);
  const [completedTodayEarnings, setCompletedTodayEarnings] = useState(0);

  // Layout tabs
  const [activeTab, setActiveTab] = useState<'disponiveis' | 'minhas' | 'concluidas'>('disponiveis');

  // Finalize Delivery modal/popup
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [payments, setPayments] = useState<{method: 'money' | 'pix' | 'debit' | 'credit', amount: number}[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<'money' | 'pix' | 'debit' | 'credit'>('pix');
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState<number>(0);
  
  // Pre-fill payments from activeOrder
  useEffect(() => {
    if (showFinalizeModal && activeOrder?.payments) {
      setPayments(activeOrder.payments);
    } else if (!showFinalizeModal) {
      setPayments([]);
    }
  }, [showFinalizeModal, activeOrder]);

  // Payment specifics
  const [changeFor, setChangeFor] = useState<number | undefined>(undefined);
  const [pixConfirmed, setPixConfirmed] = useState<boolean>(false);
  const [cardBrand, setCardBrand] = useState('Visa');

  // 1. Verify Authentication & Role
  useEffect(() => {
    if (authChecking && !user) return; // Wait until auth state is known
    
    // Check if user is motoboy
    const roleStr = (userData as any)?.role || '';
    const rolesArr = (userData as any)?.roles || [];
    const isMotoboy = rolesArr.includes('ROLE_MOTOBOY') || rolesArr.includes('motoboy') || roleStr === 'ROLE_MOTOBOY' || roleStr === 'motoboy' || rolesArr.includes('admin') || roleStr === 'admin';

    if (!user || (!isMotoboy || (userData as any)?.status !== 'ativo')) {
      auth.signOut();
      navigate('/motoboy/login');
      return;
    }
    
    // Initialize driver status only once
    const dDocRef = doc(db, 'delivery_drivers', user.uid);
    getDoc(dDocRef).then(dDoc => {
      if (dDoc.exists()) {
        setDriverStatus(dDoc.data().status === 'active' ? 'active' : 'inactive');
      } else {
        setDoc(dDocRef, {
          id: user.uid,
          name: (userData as any)?.name || 'Entregador',
          phone: (userData as any)?.phone || '',
          status: 'active',
          updatedAt: serverTimestamp()
        }).then(() => setDriverStatus('active'));
      }
      setAuthChecking(false);
    });
  }, [user, userData, authChecking]);

  // 2. Fetch/Stream Orders
  useEffect(() => {
    if (authChecking || !user) return;

    setLoadingOrders(true);
    const qO = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    
    // Listen in real-time
    const unsub = onSnapshot(qO, (snapshot) => {
      const allOrders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter out completed deliveries
      const filteredOrders = allOrders.filter(o => o.status !== 'ENTREGUE');
      setOrders(filteredOrders);

      // Find any order currently out for delivery assigned to "me"
      const active = allOrders.find(o => o.status === 'SAIU PARA ENTREGA' && o.driverId === user.uid);
      setActiveOrder(active || null);

      // Calc completes for today and earnings
      const today = new Date().toDateString();
      const completesToday = allOrders.filter(o => {
        if (o.status !== 'ENTREGUE' || o.driverId !== user.uid) return false;
        const oDate = o.updatedAt?.toDate ? o.updatedAt.toDate() : new Date();
        return oDate.toDateString() === today;
      });
      setCompletedTodayCount(completesToday.length);
      const totalEarn = completesToday.reduce((acc, current) => acc + (current.deliveryFee || 0), 0);
      setCompletedTodayEarnings(totalEarn);

      setLoadingOrders(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    return () => unsub();
  }, [authChecking, user]);

  // 3. Status Switch toggler
  const handleToggleStatus = async () => {
    if (!user) return;
    const newStatus = driverStatus === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'delivery_drivers', user.uid), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      setDriverStatus(newStatus);
      toast(`Você está agora ${newStatus === 'active' ? 'Online e Disponível' : 'Offline / Indisponível'}.`, "success");
    } catch (err) {
      toast("Falha ao atualizar status administrativo", "error");
    }
  };

  // 4. Accepting a Delivery
  const handleAcceptDelivery = async (orderId: string) => {
    if (!user) return;
    const confirmAccept = await confirm({
      title: "Iniciar Entrega",
      message: "Deseja aceitar este pedido e iniciar a rota de entrega agora?",
      confirmText: "Iniciar Rota",
      variant: "danger"
    });

    if (confirmAccept) {
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          status: 'SAIU PARA ENTREGA',
          driverId: user.uid,
          driverName: userData?.name || 'Entregador',
          updatedAt: serverTimestamp()
        });
        toast("Entrega iniciada! Direcione-se ao destino.", "success");
        setActiveTab('minhas');
      } catch (err) {
        toast("Erro ao iniciar entrega", "error");
      }
    }
  };


// 5. GPS Realtime tracking cycle
  useEffect(() => {
    if (!activeOrder || !user) {
      // Clear tracking watch if active delivery ceases
      if (gpsWatcherId !== null) {
        navigator.geolocation.clearWatch(gpsWatcherId);
        setGpsWatcherId(null);
      }
      return;
    }

    // Start watching position
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const speed = position.coords.speed || 0;
          setDriverGPS({ lat, lng });
          setGpsPermissionState('granted');

          // Log location using service
          try {
            await deliveryTrackingService.updateDriverLocation(activeOrder.id, user.uid, userData?.name || 'Entregador', lat, lng, speed);
            await deliveryTrackingService.logTrackingPoint(activeOrder.id, user.uid, lat, lng, speed);
          } catch (trackerErr) {
            console.error("Tracking error:", trackerErr);
          }
        },
        (error) => {
          console.error("GPS Watcher error:", error);
          setGpsPermissionState('denied');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );

      setGpsWatcherId(watchId);
    } else {
      setGpsPermissionState('unsupported');
    }

    return () => {
      if (gpsWatcherId !== null) {
        navigator.geolocation.clearWatch(gpsWatcherId);
      }
    };
  }, [activeOrder, user, userData]);

  // 6. Embedded leaflet map rendering inside dashboard (Removed)
  
  // Auto-fill address components
  useEffect(() => {
    if (!activeOrder) return;

    // If address info is missing, try to fetch it
    const lat = activeOrder.addressCoords?.lat || activeOrder.latitude;
    const lng = activeOrder.addressCoords?.lng || activeOrder.longitude;
    
    // Only attempt fetch if key info is missing
    if (!activeOrder.customerAddress || !activeOrder.customerCity) {
        if (lat && lng) {
            fetch("/api/geocode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng }),
            })
            .then(res => res.json())
            .then(data => {
                const parsed = parseGoogleGeocode(data);
                if (parsed) {
                    console.log("Parsed address:", parsed);
                    
                    updateDoc(doc(db, 'orders', activeOrder.id), {
                        customerAddress: parsed.road,
                        customerBairro: parsed.suburb,
                        customerCity: parsed.city,
                        customerCep: parsed.postcode,
                        customerState: parsed.state
                    });
                }
            })
            .catch(err => console.error("Geocoding fetch error:", err));
        }
    }
  }, [activeOrder]);

  // Google Maps / Waze External link launch helpers
  const handleOpenGoogleMaps = () => {
    if (!activeOrder) return;
    const customerLat = activeOrder.addressCoords?.lat || activeOrder.latitude || -3.7319;
    const customerLng = activeOrder.addressCoords?.lng || activeOrder.longitude || -38.5267;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${customerLat},${customerLng}&travelmode=driving`, '_blank');
  };

  const handleOpenWaze = () => {
    if (!activeOrder) return;
    const customerLat = activeOrder.addressCoords?.lat || activeOrder.latitude || -3.7319;
    const customerLng = activeOrder.addressCoords?.lng || activeOrder.longitude || -38.5267;
    window.open(`https://waze.com/ul?ll=${customerLat},${customerLng}&navigate=yes`, '_blank');
  };


  // 8. Submit order completion
  const handleFinalizeDeliverySubmit = async () => {
    if (!activeOrder || !user) return;
    if (!receiverName.trim()) {
      toast("Por favor, preencha o Nome de Quem Recebeu.", "warning");
      return;
    }
    
    // Payment Verification
    const totalPayments = payments.reduce((acc, p) => acc + p.amount, 0);
    const orderTotal = activeOrder.total || 0;
    if (totalPayments < orderTotal) {
      toast(`O valor recebido (R$ ${totalPayments.toFixed(2)}) é menor que o total do pedido (R$ ${orderTotal.toFixed(2)}).`, "warning");
      return;
    }

    try {
      // 2. Automate Financials & Stock (PDV-like)
      await pdvFinancialService.finalizeSaleFinancials({
        orderId: activeOrder.id,
        orderRefTag: activeOrder.id.slice(-6).toUpperCase(),
        customerName: activeOrder.customerName,
        totalVenda: orderTotal,
        totalRecebido: totalPayments,
        paymentMethod: payments.map(p => p.method).join(','),
        payments: payments,
        userId: user.uid,
        sessionId: 'motoboy-' + new Date().toISOString().split('T')[0]
      });

      // 3. Update order document status in system
      await updateDoc(doc(db, 'orders', activeOrder.id), {
        status: 'ENTREGUE',
        updatedAt: serverTimestamp()
      });

      // 4. Remove live tracking node
      await setDoc(doc(db, 'delivery_locations', activeOrder.id), {
        finished: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Clean modals
      setShowFinalizeModal(false);
      setReceiverName('');
      setPayments([]);
      
      toast("Sensacional! Entrega finalizada, financeiro e estoque atualizados com sucesso.", "success");
      setActiveTab('concluidas');
    } catch (finalizeErr) {
      console.error(finalizeErr);
      toast("Inconveniente ao salvar encerramento", "error");
    }
  };


  const handleLogout = async () => {
    const ok = await confirm({
      title: "Desconectar",
      message: "Deseja realmente sair da conta do entregador?",
      confirmText: "Desconectar",
      variant: "danger"
    });
    if (ok) {
      await auth.signOut();
      navigate('/motoboy/login');
    }
  };

  // Grouped lists for tabs
  const availableDeliveries = orders.filter(o => {
    const isDelivery = o.receiveMethod === 'entrega' || !o.receiveMethod || o.receiveMethod === "PEDIDO PARA ENTREGA (DELIVERY)";
    const unclaimed = o.status === 'NOVO' || o.status === 'AGUARDANDO RETIRADA' || o.status === 'PAGO' || o.status === 'PREPARACAO';
    return isDelivery && unclaimed && !o.driverId;
  });

  const myActiveDeliveries = orders.filter(o => o.driverId === user?.uid && o.status !== 'ENTREGUE');
  const myCompletedDeliveries = orders.filter(o => o.driverId === user?.uid && o.status === 'ENTREGUE');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (authChecking && !user) {
        navigate('/motoboy/login');
      }
    }, 10000); // 10s timeout
    return () => clearTimeout(timer);
  }, [authChecking, user, navigate]);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white font-bold gap-3">
        <Loader2 className="animate-spin text-red-500 w-8 h-8" />
        <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">Autenticando Conexão... (Se demorar, verifique sua conexão)</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-10">
      
      {/* 1. Header Navigation bar */}
      <header className="p-4 bg-zinc-950 border-b border-zinc-900 sticky top-0 z-40 flex justify-between items-center h-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-650 rounded-xl flex items-center justify-center font-black italic border border-red-500">
            D
          </div>
          <div>
            <h1 className="text-md font-black tracking-tighter uppercase italic text-red-500">Discreta Entregas</h1>
            <p className="text-[9px] text-zinc-500 tracking-wider font-semibold uppercase">{userData?.name || 'ENTREGADOR'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5">
          {/* Online/Offline Badge toggle slider */}
          <button 
            type="button"
            onClick={handleToggleStatus}
            className={`px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border ${
              driverStatus === 'active' 
                ? 'bg-zinc-950 text-green-500 border-green-500/30' 
                : 'bg-zinc-950 text-zinc-600 border-zinc-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${driverStatus === 'active' ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
            {driverStatus === 'active' ? 'Disponível' : 'Indisponível'}
          </button>

          <button 
            type="button"
            onClick={handleLogout}
            className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* 2. Quick stats review */}
      <section className="p-4 grid grid-cols-2 gap-3 shrink-0">
        <div className="bg-zinc-950 rounded-[1.5rem] p-4 border border-zinc-900 shadow-xl flex items-center gap-3">
          <div className="w-12 h-12 bg-red-650/10 rounded-2xl flex items-center justify-center border border-red-650/20 text-red-500">
            <Bike size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Ganhos Hoje</span>
            <span className="text-xl font-black">R$ {completedTodayEarnings.toFixed(2).replace('.', ',')}</span>
          </div>
        </div>

        <div className="bg-zinc-950 rounded-[1.5rem] p-4 border border-zinc-900 shadow-xl flex items-center gap-3">
          <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20 text-green-500">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Realizadas</span>
            <span className="text-xl font-black">{completedTodayCount} entregas</span>
          </div>
        </div>
      </section>

      {/* 3. GPS and system diagnostic bars */}
      {activeOrder && (
        <section className="mx-4 mb-2 p-3.5 bg-red-950/20 border border-red-950 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-red-500 animate-pulse animate-duration-1000" />
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Monitoramento GPS Ativo</span>
          </div>
          <span className="text-[10px] font-black text-zinc-500 bg-black px-2.5 py-1 rounded-full border border-zinc-900 uppercase">
            Sincronizando 15s
          </span>
        </section>
      )}

      {/* 4. Active Delivery prominently featured */}
      {activeOrder && (
        <section className="p-4">
          <div className="bg-zinc-950 rounded-[2rem] border border-red-600/30 overflow-hidden shadow-2xl relative">
            
            {/* Top header badge */}
            <div className="bg-gradient-to-r from-red-650 to-rose-700 py-3 px-6 flex justify-between items-center">
              <span className="text-xs font-black uppercase tracking-widest text-white">Entrega Ativa em Andamento</span>
              <span className="text-[11px] font-black italic text-black bg-white px-3 py-0.5 rounded-full">
                #{activeOrder.id.slice(-6).toUpperCase()}
              </span>
            </div>

            {/* Address cards metadata */}
            <div className="p-6 space-y-4">
              <div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Destino do Cliente</span>
                <p className="text-base font-black tracking-tight">{activeOrder.customerName}</p>
                <p className="text-xs text-zinc-400 mt-1 font-semibold leading-relaxed">
                  {activeOrder.customerAddress}
                  {activeOrder.customerBairro ? ` - ${activeOrder.customerBairro}` : ''}
                  {activeOrder.customerCity ? ` - ${activeOrder.customerCity}` : ''}
                  {activeOrder.customerState ? `/${activeOrder.customerState}` : ''}
                  {activeOrder.customerCep ? ` - CEP: ${activeOrder.customerCep}` : ''}
                </p>
                {activeOrder.customerReference && (
                  <p className="text-[11px] font-bold text-red-400 mt-1.5 bg-red-950/20 px-3 py-1.5 rounded-xl inline-block border border-red-950">
                    Ref: {activeOrder.customerReference}
                  </p>
                )}
              </div>

              {/* Dynamic calculations */}
              {driverGPS && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-900">
                  <div className="bg-black/50 p-3 rounded-2xl border border-zinc-900">
                    <span className="text-[10px] font-black text-zinc-500 uppercase block">Distância do Percurso</span>
                    <span className="text-base font-black text-white">
                      {calcDistance(
                        driverGPS.lat, 
                        driverGPS.lng, 
                        activeOrder.addressCoords?.lat || activeOrder.latitude || -3.7319, 
                        activeOrder.addressCoords?.lng || activeOrder.longitude || -38.5267
                      ).toFixed(2)} km
                    </span>
                  </div>

                  <div className="bg-black/50 p-3 rounded-2xl border border-zinc-900">
                    <span className="text-[10px] font-black text-zinc-500 uppercase block">Tempo Estimado</span>
                    <span className="text-base font-black text-white">
                      {~~(calcDistance(
                        driverGPS.lat, 
                        driverGPS.lng, 
                        activeOrder.addressCoords?.lat || activeOrder.latitude || -3.7319, 
                        activeOrder.addressCoords?.lng || activeOrder.longitude || -38.5267
                      ) * 3) + 4} mins
                    </span>
                  </div>
                </div>
              )}

              {/* Action routing operations buttons */}
              <div className="pt-3 flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button 
                    type="button"
                    onClick={() => {
                        if (!activeOrder) return;
                        const lat = activeOrder.addressCoords?.lat || activeOrder.latitude;
                        const lng = activeOrder.addressCoords?.lng || activeOrder.longitude;
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank');
                    }}
                    className="h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
                  >
                    <MapIcon size={14} className="text-red-500" /> Google Maps
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                        if (!activeOrder) return;
                        const lat = activeOrder.addressCoords?.lat || activeOrder.latitude;
                        const lng = activeOrder.addressCoords?.lng || activeOrder.longitude;
                        window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
                    }}
                    className="h-12 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
                  >
                    <Navigation size={14} className="text-blue-400" /> Waze GPS
                  </button>
                </div>

                <button 
                  type="button"
                  onClick={() => setShowFinalizeModal(true)}
                  className="w-full h-15 bg-green-600 hover:bg-green-700 text-white font-black rounded-xl text-xs uppercase tracking-widest border-b-4 border-green-800 flex items-center justify-center gap-2 cursor-pointer shadow-[0_4px_15px_rgba(74,222,128,0.15)]"
                >
                  <CheckSquare size={16} /> Finalizar e Cobrar Entrega
                </button>
              </div>

            </div>

          </div>
        </section>
      )}

      {/* 5. Main lists navigation tabs */}
      <section className="p-4 shrink-0">
        <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900">
          <button 
            type="button"
            onClick={() => setActiveTab('disponiveis')}
            className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              activeTab === 'disponiveis' 
                ? 'bg-red-650 text-white' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            Disponíveis ({availableDeliveries.length})
          </button>
          
          <button 
            type="button"
            onClick={() => setActiveTab('minhas')}
            className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              activeTab === 'minhas' 
                ? 'bg-red-650 text-white' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            Minhas Ativas ({myActiveDeliveries.length})
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('concluidas')}
            className={`flex-1 py-3 text-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
              activeTab === 'concluidas' 
                ? 'bg-red-650 text-white' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            Concluídas ({myCompletedDeliveries.length})
          </button>
        </div>
      </section>

      {/* 6. Tabs Content container */}
      <main className="flex-1 px-4 overflow-y-auto">
        
        {loadingOrders ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-zinc-500">
            <Loader2 className="animate-spin text-red-500 w-6 h-6" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Minerando Pedidos...</span>
          </div>
        ) : (
          <div className="space-y-3.5 pb-20">
            
            {/* View - Available courier deliveries */}
            {activeTab === 'disponiveis' && (
              <>
                {availableDeliveries.length === 0 ? (
                  <div className="py-16 text-center text-zinc-600 flex flex-col items-center justify-center gap-3">
                    <Bike size={32} className="text-zinc-800" />
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">Nenhuma entrega disponível</p>
                      <p className="text-[10px] mt-1 text-zinc-600">Aguarde novos pedidos prontos no painel.</p>
                    </div>
                  </div>
                ) : (
                  availableDeliveries.map(o => (
                    <div 
                      key={o.id}
                      className="bg-zinc-950 rounded-[1.5rem] border border-zinc-900 shadow-lg p-5 overflow-hidden transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-[10px] font-black text-red-500 uppercase bg-red-950/20 px-2.5 py-1 rounded-full border border-red-950">
                            Pronto para Retirada
                          </span>
                          <span className="text-xs text-zinc-500 ml-2 font-bold uppercase">{o.paymentMethod}</span>
                        </div>
                        <span className="font-mono text-xs font-black text-zinc-400">
                          #{o.id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      <p className="text-base font-black tracking-tight mt-1">{o.customerName}</p>
                      <p className="text-xs text-zinc-400 mt-1 font-medium leading-relaxed mb-4">
                        {o.customerAddress}
                        {o.customerBairro ? ` - ${o.customerBairro}` : ''}
                      </p>

                      <div className="flex items-center justify-between border-t border-zinc-900 pt-4.5">
                        <div>
                          <span className="text-[10px] text-zinc-500 font-bold block uppercase">Valor da Entrega</span>
                          <span className="text-base font-black text-white">R$ {(o.deliveryFee || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => handleAcceptDelivery(o.id)}
                          className="h-10 px-6 bg-red-650 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 cursor-pointer border-b-2 border-red-800"
                        >
                          Pegar Entrega <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* View - Assigned deliveries to current driver */}
            {activeTab === 'minhas' && (
              <>
                {myActiveDeliveries.length === 0 ? (
                  <div className="py-16 text-center text-zinc-600 flex flex-col items-center justify-center gap-3">
                    <CheckCircle size={32} className="text-zinc-800" />
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">Sem entregas ativas</p>
                      <p className="text-[10px] mt-1 text-zinc-600">Selecione uma entrega na aba 'Disponíveis'.</p>
                    </div>
                  </div>
                ) : (
                  myActiveDeliveries.map(o => (
                    <div 
                      key={o.id}
                      className="bg-zinc-950 rounded-[1.5rem] border border-zinc-900 shadow-lg p-5 overflow-hidden transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-[10px] font-black text-rose-500 uppercase bg-rose-950/20 px-2.5 py-1 rounded-full border border-rose-950">
                            A Caminho
                          </span>
                          <span className="text-xs text-zinc-500 ml-2 font-bold uppercase">{o.paymentMethod}</span>
                        </div>
                        <span className="font-mono text-xs font-black text-zinc-400">
                          #{o.id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      <p className="text-base font-black tracking-tight mt-1">{o.customerName}</p>
                      <p className="text-xs text-zinc-400 mt-1 font-medium leading-relaxed mb-4">
                        {o.customerAddress}
                        {o.customerBairro ? ` - ${o.customerBairro}` : ''}
                      </p>

                      <div className="flex items-center justify-between border-t border-zinc-900 pt-4.5">
                        <div>
                          <span className="text-[10px] text-zinc-500 font-bold block uppercase">Total a Receber</span>
                          <span className="text-base font-black text-white">R$ {(o.total || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                        
                        <button 
                          type="button"
                          onClick={() => {
                            setActiveOrder(o);
                            toast("Rota ativa sincronizada no topo da tela", "success");
                            window.scrollTo({ top: 150, behavior: 'smooth' });
                          }}
                          className="h-10 px-5 bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 cursor-pointer border border-zinc-800"
                        >
                          <Eye size={12} /> Exibir Rota
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* View - Driver concluded deliveries of the current day */}
            {activeTab === 'concluidas' && (
              <>
                {myCompletedDeliveries.length === 0 ? (
                  <div className="py-16 text-center text-zinc-600 flex flex-col items-center justify-center gap-3">
                    <TrendingUp size={32} className="text-zinc-800" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Sem histórico hoje</p>
                      <p className="text-[10px] mt-1 text-zinc-650 font-bold uppercase">Comece a fazer entregas para encher a carteira!</p>
                    </div>
                  </div>
                ) : (
                  myCompletedDeliveries.map(o => (
                    <div 
                      key={o.id}
                      className="bg-zinc-950 rounded-[1.5rem] border border-zinc-900 shadow-md p-5 opacity-70 transition-all hover:opacity-100"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <span className="text-[10px] font-bold text-green-500 uppercase bg-green-950/20 px-2.5 py-1 rounded-full border border-green-950">
                            Entregue com Sucesso
                          </span>
                        </div>
                        <span className="font-mono text-xs font-black text-zinc-500">
                          #{o.id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      <p className="text-base font-black tracking-tight mt-1 text-zinc-300">{o.customerName}</p>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                        {o.customerAddress}
                      </p>

                      <div className="flex items-center justify-between border-t border-zinc-900 pt-4 mt-3">
                        <div>
                          <span className="text-[9px] text-zinc-600 font-bold block uppercase">Sua Comissão</span>
                          <span className="text-sm font-black text-zinc-400">R$ {(o.deliveryFee || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                        
                        <span className="text-[10px] font-bold text-zinc-600 mt-1 block uppercase">
                          Finalizado às {o.updatedAt?.toDate ? o.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

          </div>
        )}

      </main>

      {/* 7. Operations completion Dialog (Finalize modal overlay) */}
      {showFinalizeModal && activeOrder && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-zinc-950 border-t sm:border border-zinc-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 max-h-[92vh] overflow-y-auto relative shadow-2xl">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-black italic uppercase text-red-500 tracking-tighter">Concluir Entrega</h3>
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block">Pedido #{activeOrder.id.slice(-6).toUpperCase()}</span>
              </div>
              <button 
                type="button"
                onClick={() => setShowFinalizeModal(false)}
                className="w-9 h-9 rounded-full bg-zinc-900 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              
              {/* Delivery Stats in Finalize Modal */}
              <div className="flex justify-between items-center bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
                <div>
                  <span className="text-[10px] text-zinc-500 font-bold block uppercase">Total a Cobrar</span>
                  <span className="text-xl font-black text-white">R$ {(activeOrder.total || 0).toFixed(2).replace('.', ',')}</span>
                </div>
                {activeOrder.paymentMethod && (
                   <div className="text-right">
                    <span className="text-[10px] text-zinc-500 font-bold block uppercase">Forma Pagamento</span>
                    <span className="text-xs font-black text-red-500 uppercase">{activeOrder.paymentMethod}</span>
                   </div>
                )}
              </div>

              {/* Receiver's Name input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">Nome de Quem Recebeu *</label>
                <input 
                  type="text"
                  required
                  value={receiverName}
                  onChange={e => setReceiverName(e.target.value)}
                  placeholder="Ex: O próprio cliente, Porteiro, Vizinho"
                  className="w-full h-12 bg-zinc-950 border-zinc-800 text-sm font-semibold rounded-xl px-4 text-white focus:border-red-500 placeholder:text-zinc-700"
                />
              </div>

              {/* Delivery Payment details selectors */}
              <div className="space-y-3 border-t border-zinc-900 pt-3">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">Registrar Pagamentos Recebidos</label>
                
                {/* List of registered payments */}
                {payments.length > 0 && (
                  <div className="space-y-2">
                    {payments.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                        <span className="font-bold uppercase text-zinc-300">
                          {p.method === 'money' ? 'Dinheiro' : p.method === 'pix' ? 'PIX' : p.method === 'debit' ? 'Débito' : 'Crédito'}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-black text-white">R$ {p.amount.toFixed(2).replace('.', ',')}</span>
                          <button onClick={() => setPayments(prev => prev.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between items-center font-black pt-2 border-t border-zinc-800 text-sm">
                      <span>Total Recebido:</span>
                      <span className={payments.reduce((acc, p) => acc + p.amount, 0) >= (activeOrder.total || 0) ? "text-green-500" : "text-red-500"}>
                        R$ {payments.reduce((acc, p) => acc + p.amount, 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                )}

                {/* Add new payment */}
                <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="number"
                      value={currentPaymentAmount || ''}
                      onChange={e => setCurrentPaymentAmount(Number(e.target.value))}
                      placeholder="Valor"
                      className="h-11 bg-zinc-900 border-zinc-800 rounded-lg px-3 text-xs text-white"
                    />
                    <select 
                      value={currentPaymentMethod}
                      onChange={e => setCurrentPaymentMethod(e.target.value as any)}
                      className="h-11 bg-zinc-900 border-zinc-800 rounded-lg px-3 text-xs text-white uppercase font-bold"
                    >
                      <option value="money">Dinheiro</option>
                      <option value="pix">PIX</option>
                      <option value="debit">Débito</option>
                      <option value="credit">Crédito</option>
                    </select>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    if (currentPaymentAmount > 0) {
                      setPayments([...payments, { method: currentPaymentMethod, amount: currentPaymentAmount }]);
                      setCurrentPaymentAmount(0);
                    }
                  }}
                  className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-lg text-xs uppercase tracking-widest border border-zinc-700"
                >
                  Adicionar Pagamento
                </button>

              </div>

            </div>

            {/* Footer triggers */}
            <div className="pt-6 border-t border-zinc-900 mt-6 grid grid-cols-2 gap-3.5">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowFinalizeModal(false)}
                className="w-full h-13 text-zinc-400 border-zinc-900 rounded-xl font-bold uppercase tracking-widest text-xs"
              >
                Voltar
              </Button>

              <Button 
                type="button" 
                onClick={handleFinalizeDeliverySubmit}
                className="w-full h-13 bg-green-600 hover:bg-green-700 text-white border-b-2 border-green-800 rounded-xl font-black uppercase tracking-widest text-xs"
              >
                Finalizar
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
