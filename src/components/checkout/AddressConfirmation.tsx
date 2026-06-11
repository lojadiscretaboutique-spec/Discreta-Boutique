import { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { MapPin, Navigation, ShoppingBag, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { State, City, DeliveryArea } from '../../services/deliveryAreaService';
import DeliveryAddressFormLegacy, { AddressDetails } from './DeliveryAddressForm';
import { DeliveryAddressForm as DeliveryAddressFormNew } from '../delivery/DeliveryAddressForm';
import { DeliveryCalculator, calculateShippingFee } from '../delivery/DeliveryCalculator';
import { deliveryRouteService, getHaversineDistance } from '../../utils/deliveryRouteService';
import { parseGoogleGeocode } from '../../utils/googleMapsUtils';

// Lazy load map components for maximum rendering speed and lazy overhead reductions
const LegacyDeliveryMap = lazy(() => import('./DeliveryMap'));
const NewDeliveryMap = lazy(() => import('../delivery/DeliveryMap').then(m => ({ default: m.DeliveryMap })));

interface AddressConfirmationProps {
  initialCoords: { lat: number; lng: number; accuracy: number };
  dbStates: State[];
  dbCities: City[];
  dbAreas: DeliveryArea[];
  cartSubtotal: number;
  initialAddressState?: any;
  onAddressConfirmed: (address: AddressDetails, deliveryArea: DeliveryArea, deliveryFee: number) => void;
  accentColor?: string;
  cardBg?: string;
  cardText?: string;
  subTextColor?: string;
  borderHex?: string;
  bgText?: string;

  // New Georeferencing iFood-style props
  deliverySettings?: any;
  calculatedDistance?: number | null;
  calculatedDuration?: number | null;
  routeGeometry?: any;
  onRouteCalculated?: (distanceKm: number, durationMinutes: number, routeGeometry: any) => void;
}

export default function AddressConfirmation({
  initialCoords,
  dbStates,
  dbCities,
  dbAreas,
  cartSubtotal,
  initialAddressState,
  onAddressConfirmed,
  accentColor = '#FF385C',
  cardBg = 'rgba(24, 24, 27, 0.5)',
  cardText = '#ffffff',
  subTextColor = 'rgba(255, 255, 255, 0.5)',
  borderHex = 'rgba(255, 255, 255, 0.08)',
  bgText = '#ffffff',

  deliverySettings,
  calculatedDistance = null,
  calculatedDuration = null,
  routeGeometry = null,
  onRouteCalculated,
}: AddressConfirmationProps) {
  // Main geographic coordinates
  const [lat, setLat] = useState(initialCoords.lat);
  const [lng, setLng] = useState(initialCoords.lng);
  const [accuracy] = useState(initialCoords.accuracy);

  // Store the real GPS coordinate separately to validate pin dragging distance
  const [realGpsCoords, setRealGpsCoords] = useState<{ lat: number, lng: number } | null>(() => {
    if (initialCoords.lat !== 0 && initialCoords.lng !== 0) {
      return { lat: initialCoords.lat, lng: initialCoords.lng };
    }
    return null;
  });

  // Debounce coordinates
  const [debouncedCoords, setDebouncedCoords] = useState({ lat: initialCoords.lat, lng: initialCoords.lng });

  // Address fields matching original schema
  const [addressDetails, setAddressDetails] = useState<AddressDetails>(() => {
    return initialAddressState || {
      latitude: initialCoords.lat,
      longitude: initialCoords.lng,
      cep: '',
      rua: '',
      numero: '',
      bairro: '',
      complemento: '',
      referencia: '',
      cidade: '',
      estado: '',
      pais: '',
      accuracy: initialCoords.accuracy,
    };
  });

  const [loadingGeocode, setLoadingGeocode] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [refreshingGps, setRefreshingGps] = useState(false);

  const refreshGPS = () => {
    if (!navigator.geolocation) return;
    setRefreshingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setRefreshingGps(false);
        userDraggedPinRef.current = true;
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setRealGpsCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      (err) => {
        setRefreshingGps(false);
        console.error("GPS refresh failed:", err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // States to control beautiful custom modal dialog for missing fields (especially Ponto de Referência)
  const [showMissingFieldsDialog, setShowMissingFieldsDialog] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Sync center/sync map of customer if login/lookup provides a new initial position
  useEffect(() => {
    if (initialCoords.lat !== 0 && initialCoords.lng !== 0) {
      setLat(initialCoords.lat);
      setLng(initialCoords.lng);
      setDebouncedCoords({ lat: initialCoords.lat, lng: initialCoords.lng });
      setRealGpsCoords({ lat: initialCoords.lat, lng: initialCoords.lng });
    }
  }, [initialCoords.lat, initialCoords.lng]);

  // Mandatory Validation: If the user moves the pin too far from their actual GPS location, reset it automatically.
  // This prevents fraud or "remote ordering" to bypass delivery zone restrictions or fees based on incorrect location.
  useEffect(() => {
    if (!realGpsCoords) return;

    // We use a threshold of 1.5km as "too far"
    const distance = getHaversineDistance(lat, lng, realGpsCoords.lat, realGpsCoords.lng);
    const MAX_ALLOWED_DISTANCE_DEVIATION = 1.5; // km

    if (distance > MAX_ALLOWED_DISTANCE_DEVIATION && userDraggedPinRef.current) {
        // Reset pin to actual GPS position
        setLat(realGpsCoords.lat);
        setLng(realGpsCoords.lng);
        userDraggedPinRef.current = false;
        // Optionally alert the user (or silently correct if they are just exploring but "lost" the pin)
    }
  }, [lat, lng, realGpsCoords]);

  const lastParentStateRef = useRef<any>(null);
  const userDraggedPinRef = useRef<boolean>(false);

  // Sync child state with parent address state if changed dynamically (e.g. lookup completed)
  // Smart comparison prevents overwriting active user typing edits on parent re-renders.
  useEffect(() => {
    if (!initialAddressState) return;

    const isSameAddress = (a: any, b: any) => {
      if (!a || !b) return false;
      return (
        a.latitude === b.latitude &&
        a.longitude === b.longitude &&
        a.rua === b.rua &&
        a.numero === b.numero &&
        a.bairro === b.bairro &&
        a.complemento === b.complemento &&
        a.referencia === b.referencia &&
        a.cidade === b.cidade &&
        a.estado === b.estado &&
        a.cep === b.cep &&
        a.pais === b.pais
      );
    };

    if (!isSameAddress(initialAddressState, lastParentStateRef.current)) {
      setAddressDetails(initialAddressState);
      lastParentStateRef.current = { ...initialAddressState };
    }
  }, [initialAddressState]);

  // Coords debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCoords({ lat, lng });
    }, 600);
    return () => clearTimeout(handler);
  }, [lat, lng]);

  const normalizeStr = (str: string) =>
    str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : '';

  // Reverse Geocoding Effect (Nominatim OSM)
  useEffect(() => {
    let active = true;
    const fetchAddressFromCoords = async () => {
      // Guard against invalid coordinates
      if (debouncedCoords.lat === 0 && debouncedCoords.lng === 0) return;

      // Smart protection: ONLY geocode if either:
      // 1. The user manually dragged the pin (explicit interaction),
      // 2. OR we have no street or neighborhood loaded yet (brand new search or fresh load).
      const hasRuaOrBairro = initialAddressState?.rua?.trim() || initialAddressState?.bairro?.trim();
      const shouldGeocode = userDraggedPinRef.current || !hasRuaOrBairro;

      if (!shouldGeocode) {
        return;
      }

      setLoadingGeocode(true);
      setGeocodeFailed(false);
      try {
        // Replace Nominatim with Google Geocoding Proxy
        const cacheKey = `geo_${debouncedCoords.lat.toFixed(4)}_${debouncedCoords.lng.toFixed(4)}`;
        const cached = localStorage.getItem(cacheKey);
        let data;

        if (cached) {
          data = JSON.parse(cached);
        } else {
          const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: debouncedCoords.lat, lng: debouncedCoords.lng })
          });
          if (!response.ok) throw new Error('Geocodificação reversa falhou');
          data = await response.json();
          if (data.status === 'OK') {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          }
        }
        
        // Map Google result to the structure expected by the following logic
        const addrGoogle = parseGoogleGeocode(data);
        const dataForParsing = addrGoogle ? { address: addrGoogle } : null;
        
        if (!dataForParsing) throw new Error('Geocodificação: sem resultados');
        const dataToUse = dataForParsing;
        
        if (!active) return;

        if (dataToUse && dataToUse.address) {
          const addr = dataToUse.address;
          const resolvedRua = addr.road || addr.street || addr.pedestrian || addr.avenue || '';
          const resolvedNumero = addr.house_number || '';
          const resolvedCidade = addr.city || addr.town || addr.municipality || addr.village || '';
          const resolvedEstadoName = addr.state || '';
          
          let resolvedEstado = resolvedEstadoName;
          const matchingStateInDb = dbStates.find(
            s => normalizeStr(s.nome) === normalizeStr(resolvedEstadoName) || 
                 normalizeStr(s.sigla) === normalizeStr(resolvedEstadoName)
          );
          if (matchingStateInDb) {
            resolvedEstado = matchingStateInDb.sigla;
          }

          // Smart Bairro (Neighborhood) Match against store database active delivery areas
          // Filter delivery areas by city and state to reduce search space to local candidates
          const cityAreas = dbAreas.filter(a => 
            normalizeStr(a.cityName) === normalizeStr(resolvedCidade) &&
            (normalizeStr(a.stateName) === normalizeStr(resolvedEstado) || 
             normalizeStr(a.stateName) === normalizeStr(resolvedEstadoName))
          );

          // Nominatim hierarchy of borough/neighborhood candidates
          const neighborhoodCandidates = [
            addr.neighbourhood,
            addr.suburb,
            addr.quarter,
            addr.city_district,
            addr.village,
            addr.hamlet
          ].filter(Boolean) as string[];

          let matchedBairroFromDb = '';
          
          // 1. First Pass: Attempt an exact normalized match
          for (const candItem of neighborhoodCandidates) {
            const normCand = normalizeStr(candItem);
            const foundArea = cityAreas.find(a => normalizeStr(a.bairro) === normCand);
            if (foundArea) {
              matchedBairroFromDb = foundArea.bairro;
              break;
            }
          }

          // 2. Second Pass: If still unmatched, try a partial substring / normalized match (must be dynamic and intelligent)
          if (!matchedBairroFromDb) {
            for (const candItem of neighborhoodCandidates) {
              const normCand = normalizeStr(candItem);
              const foundArea = cityAreas.find(a => {
                const normDbBairro = normalizeStr(a.bairro);
                return normDbBairro.includes(normCand) || normCand.includes(normDbBairro);
              });
              if (foundArea) {
                matchedBairroFromDb = foundArea.bairro;
                break;
              }
            }
          }

          // Fallback to the first available candidate if database doesn't have the match or if it's outside active zones
          const resolvedBairro = matchedBairroFromDb || addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || addr.village || '';

          const rawCep = addr.postcode || '';
          const resolvedCep = rawCep.replace(/\D/g, '').length === 8 
            ? rawCep.replace(/(\d{5})(\d{3})/, '$1-$2') 
            : rawCep;

          setAddressDetails((prev) => ({
            ...prev,
            latitude: debouncedCoords.lat,
            longitude: debouncedCoords.lng,
            accuracy,
            rua: resolvedRua || prev.rua,
            numero: resolvedNumero || prev.numero,
            bairro: resolvedBairro || prev.bairro,
            cidade: resolvedCidade || prev.cidade,
            estado: resolvedEstado || prev.estado,
            cep: resolvedCep || prev.cep,
            pais: addr.country || 'Brasil',
          }));
          userDraggedPinRef.current = false;
        } else {
          setGeocodeFailed(true);
        }
      } catch (err) {
        console.error('Error reverse geocoding:', err);
        if (active) {
          setGeocodeFailed(true);
        }
      } finally {
        if (active) {
          setLoadingGeocode(false);
        }
      }
    };

    fetchAddressFromCoords();

    return () => {
      active = false;
    };
  }, [debouncedCoords, dbStates]);

  // Route calculation triggers (if iFood georouting is active)
  useEffect(() => {
    if (!deliverySettings) return;

    let active = true;
    const getPhysicalRoute = async () => {
      try {
        const routeObj = await deliveryRouteService.calculateRoute(
          { lat: deliverySettings.storeLatitude, lng: deliverySettings.storeLongitude },
          { lat: debouncedCoords.lat, lng: debouncedCoords.lng }
        );
        if (active && onRouteCalculated) {
          onRouteCalculated(routeObj.distanceKm, routeObj.durationMinutes, routeObj.geometry);
        }
      } catch (err) {
        console.error("OSRM calculation failed:", err);
      }
    };

    getPhysicalRoute();

    return () => {
      active = false;
    };
  }, [debouncedCoords, deliverySettings, onRouteCalculated]);

  // Compute validation results
  const validationResult = useMemo(() => {
    // 1. Georeferenced iFood System Calculations
    if (deliverySettings) {
      if (calculatedDistance === null) {
        return {
          isValid: false,
          message: 'Processando traçado de rota...',
          area: null,
          fee: 0,
        };
      }

      const feeResult = calculateShippingFee({
        distanceKm: calculatedDistance,
        cartSubtotal,
        config: deliverySettings,
      });

      return {
        isValid: !feeResult.isBlocked,
        message: feeResult.isBlocked
          ? feeResult.blockReason
          : feeResult.isFree
          ? `Entrega liberada! ${feeResult.freeReason}`
          : 'Endereço atendido e calculado com sucesso!',
        fee: feeResult.finalFee,
        area: { id: 'georouting', name: addressDetails.bairro || 'Georreferenciada', tempoEntrega: String(Math.round(calculatedDuration || 30)), pedidoMinimo: 0 } as any,
      };
    }

    // 2. Traditional Area Legacy Calculations
    const normState = normalizeStr(addressDetails.estado);
    const normCity = normalizeStr(addressDetails.cidade);
    const normBairro = normalizeStr(addressDetails.bairro);

    const matchedState = dbStates.find(s => normalizeStr(s.sigla) === normState || normalizeStr(s.nome) === normState);
    const matchedCity = dbCities.find(c => normalizeStr(c.nome) === normCity);
    
    if (!matchedState || !matchedCity) {
      return {
        isValid: false,
        message: 'Cidade ou Estado de entrega não cadastrados nas áreas atendidas.',
        area: null,
        fee: 0,
      };
    }

    const matchedArea = dbAreas.find(a => 
      (normalizeStr(a.stateName) === normalizeStr(matchedState.sigla) || normalizeStr(a.stateName) === normalizeStr(matchedState.nome)) &&
      normalizeStr(a.cityName) === normalizeStr(matchedCity.nome) &&
      normalizeStr(a.bairro) === normBairro
    );

    if (!matchedArea) {
      return {
        isValid: false,
        message: `Infelizmente, ainda não atendemos o bairro "${addressDetails.bairro || 'não identificado'}" em ${addressDetails.cidade}.`,
        area: null,
        fee: 0,
      };
    }

    if (matchedArea.pedidoMinimo && cartSubtotal < matchedArea.pedidoMinimo) {
      return {
        isValid: false,
        message: `Pedido Mínimo não atingido! O mínimo para esta região é R$ ${matchedArea.pedidoMinimo.toFixed(2)}.`,
        area: matchedArea,
        fee: 0,
      };
    }

    const freeShipping = matchedArea.freteGratisAcima && cartSubtotal >= matchedArea.freteGratisAcima;
    const fee = freeShipping ? 0 : matchedArea.taxaEntrega;

    return {
      isValid: true,
      message: freeShipping ? 'Entrega disponível com FRETE GRÁTIS!' : 'Área de entrega atendida com sucesso!',
      fee,
      area: matchedArea,
    };
  }, [addressDetails, dbStates, dbCities, dbAreas, cartSubtotal, deliverySettings, calculatedDistance, calculatedDuration]);

  const handleFieldChange = (fields: Partial<AddressDetails>) => {
    setAddressDetails(prev => ({ ...prev, ...fields }));
  };

  const handleConfirm = () => {
    if (!validationResult.isValid || !validationResult.area) return;
    
    const missing: string[] = [];
    if (!addressDetails.rua?.trim()) missing.push('Rua / Logradouro');
    if (!addressDetails.numero?.trim()) missing.push('Número');
    if (!addressDetails.bairro?.trim()) missing.push('Bairro');
    if (!addressDetails.referencia?.trim()) missing.push('Ponto de Referência');

    if (missing.length > 0) {
      setMissingFields(missing);
      setShowMissingFieldsDialog(true);
      return;
    }

    onAddressConfirmed(
      {
        ...addressDetails,
        latitude: lat,
        longitude: lng,
        accuracy,
        atualizadoEm: new Date().toISOString() as any,
      },
      validationResult.area,
      validationResult.fee || 0
    );
  };

  return (
    <div className="space-y-8 animate-fade-in" id="address-confirmation-container">
      <div 
        className="rounded-[2rem] border p-6 sm:p-8 shadow-2xl relative overflow-hidden transition-all duration-300" 
        style={{ backgroundColor: cardBg, borderColor: borderHex }}
      >
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* MAP COLUMN */}
          <div className="w-full md:w-1/2 flex flex-col space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h4 className="text-sm font-black uppercase tracking-[3px] flex items-center gap-2" style={{ color: cardText }}>
                <MapPin size={16} style={{ color: accentColor }} /> Confirmar localização no mapa
              </h4>
              <button 
                type="button"
                id="my-location-btn"
                onClick={refreshGPS}
                disabled={refreshingGps}
                className="text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border hover:bg-white/5 active:scale-95 transition-all flex items-center gap-2"
                style={{ backgroundColor: `${accentColor}10`, color: accentColor, borderColor: `${accentColor}40` }}
              >
                {refreshingGps ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Navigation size={12} className="rotate-45" />
                )}
                {refreshingGps ? 'Buscando GPS...' : 'Minha Localização'}
              </button>
            </div>
            
            <div className="relative h-[300px] sm:h-[350px] overflow-hidden z-20 -mx-6 sm:-mx-8 md:mx-0 rounded-none md:rounded-2xl border-y md:border-x">
              <Suspense 
                fallback={
                  <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border rounded-2xl animate-pulse text-xs gap-3">
                    <Loader2 size={24} className="animate-spin text-zinc-500" />
                    <span className="font-mono text-[10px] uppercase text-zinc-400">Carregando Mapa...</span>
                  </div>
                }
              >
                {deliverySettings ? (
                  <NewDeliveryMap
                    storeLat={deliverySettings.storeLatitude}
                    storeLng={deliverySettings.storeLongitude}
                    customerLat={lat}
                    customerLng={lng}
                    routeGeometry={routeGeometry}
                    onCustomerPositionChange={(newLat, newLng) => {
                      userDraggedPinRef.current = true;
                      setLat(newLat);
                      setLng(newLng);
                    }}
                    accentColor={accentColor}
                    borderColor={borderHex}
                    backgroundColor={cardBg}
                  />
                ) : (
                  <LegacyDeliveryMap
                    latitude={lat}
                    longitude={lng}
                    accuracy={accuracy}
                    onPositionChange={(newLat, newLng) => {
                      userDraggedPinRef.current = true;
                      setLat(newLat);
                      setLng(newLng);
                    }}
                    accentColor={accentColor}
                    backgroundColor={cardBg}
                    borderColor={borderHex}
                  />
                )}
              </Suspense>
            </div>
            
            {/* Live Distance Info / Delivery Calculator */}
            {deliverySettings ? (
              <DeliveryCalculator
                distanceKm={calculatedDistance || 0}
                durationMinutes={calculatedDuration || 0}
                cartSubtotal={cartSubtotal}
                config={deliverySettings}
                accentColor={accentColor}
                cardBg={cardBg}
                cardText={cardText}
                borderHex={borderHex}
              />
            ) : (
              <div 
                className="px-4 py-3 rounded-xl border text-xs flex justify-between items-center transition-all animate-fade-in"
                style={{ borderColor: borderHex, backgroundColor: 'rgba(0,0,0,0.2)' }}
               >
                <span className="font-semibold text-zinc-400">Distância estimada por rota</span>
                <span className="font-mono font-bold" style={{ color: accentColor }}>
                  {(getHaversineDistance(lat, lng, deliverySettings?.storeLatitude || -23.55052, deliverySettings?.storeLongitude || -46.633308) * 1.35).toFixed(2)} km
                </span>
              </div>
            )}
          </div>

          {/* FIELDS AND VALIDATIONS COLUMN */}
          <div className="w-full md:w-1/2 flex flex-col space-y-6">
            <h4 className="text-sm font-black uppercase tracking-[3px] flex items-center gap-2" style={{ color: cardText }}>
              <ShoppingBag size={16} style={{ color: accentColor }} /> Complete seu endereço
            </h4>

            {loadingGeocode ? (
              <div className="h-[220px] flex flex-col items-center justify-center gap-3 border rounded-2xl animate-pulse" style={{ borderColor: borderHex }}>
                <Loader2 size={32} className="animate-spin" style={{ color: accentColor }} />
                <span className="text-xs uppercase tracking-widest font-black text-slate-400">Buscando endereço via GPS...</span>
              </div>
            ) : deliverySettings ? (
              <DeliveryAddressFormNew
                address={addressDetails}
                onChange={handleFieldChange}
                accentColor={accentColor}
                cardText={cardText}
                subTextCardColor={subTextColor}
                borderHex={borderHex}
                bgHex="rgba(0,0,0,0.15)"
                bgText={bgText}
              />
            ) : (
              <DeliveryAddressFormLegacy
                address={addressDetails}
                onChange={handleFieldChange}
                accentColor={accentColor}
                cardText={cardText}
                subTextCardColor={subTextColor}
                borderHex={borderHex}
                bgHex="rgba(0,0,0,0.15)"
                bgText={bgText}
                isGeocodeFailed={geocodeFailed}
              />
            )}

            {/* Alert banners if not georouting (which renders inside DeliveryCalculator) */}
            {!deliverySettings && (
              <div className="space-y-4">
                {validationResult.isValid ? (
                  <div className="flex gap-3 p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/25 text-emerald-300 animate-fade-in">
                    <CheckCircle className="shrink-0 mt-0.5" size={18} />
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-wider mb-0.5">Entrega Disponível</h5>
                      <p className="text-xs opacity-90">{validationResult.message}</p>
                      {validationResult.area && (
                        <div className="mt-2 text-[10px] font-mono uppercase tracking-wider flex flex-wrap gap-x-4 opacity-80">
                          <span>Tempo: {validationResult.area.tempoEntrega} min</span>
                          <span>Mínimo: R$ {validationResult.area.pedidoMinimo.toFixed(2)}</span>
                          <span>Taxa: {validationResult.fee === 0 ? 'FRETE GRÁTIS' : `R$ ${validationResult.fee.toFixed(2)}`}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 p-4 rounded-xl border bg-red-500/10 border-red-500/25 text-red-300 animate-fade-in">
                    <XCircle className="shrink-0 mt-0.5" size={18} />
                    <div>
                      <h5 className="text-xs font-black uppercase tracking-wider mb-0.5">Entrega indisponível</h5>
                      <p className="text-xs opacity-90">{validationResult.message}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Confirm button */}
            <Button
              id="confirm-gps-address-btn"
              onClick={handleConfirm}
              disabled={!validationResult.isValid || loadingGeocode}
              className="py-6 text-base font-black italic uppercase tracking-widest rounded-2xl w-full flex items-center justify-center gap-1.5 active:scale-95 transition-all text-white shadow-xl"
              style={{
                backgroundColor: validationResult.isValid && !loadingGeocode ? accentColor : 'rgba(255,255,255,0.05)',
                color: validationResult.isValid && !loadingGeocode ? '#ffffff' : 'rgba(255,255,255,0.3)',
                cursor: validationResult.isValid && !loadingGeocode ? 'pointer' : 'not-allowed',
              }}
            >
              Confirmar Endereço <CheckCircle size={18} />
            </Button>
          </div>

        </div>
      </div>

      {/* Beautiful dynamic missing fields alert dialog (highly requested!) */}
      {showMissingFieldsDialog && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-fade-in" id="missing-fields-dialog">
          <div className="bg-zinc-950 border-2 border-red-500/40 rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] text-left relative overflow-hidden animate-scale-up">
            <div className="absolute top-0 right-0 p-4">
              <button 
                onClick={() => setShowMissingFieldsDialog(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
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

            <Button
              onClick={() => setShowMissingFieldsDialog(false)}
              className="w-full py-5 text-sm font-black uppercase tracking-widest bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white rounded-xl shadow-lg shadow-red-600/20"
            >
              Completar meu Endereço
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
