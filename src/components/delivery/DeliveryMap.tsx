import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker assets
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Store Icon (e.g., Red Pin or elegant symbol)
const createStoreIcon = (color: string) => {
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center">
        <div class="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-lg" style="background-color: ${color}">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3h3"/><path d="m14 18 1 .5.5-.5M15 15l2 2-2 2-2-2z"/><path d="M19 19c1.5-1.5 1.5-4 0-5.5s-4-1.5-5.5 0"/><path d="M21 21c2-2 2-5 0-7l-7 7z"/></svg>
        </div>
        <div class="w-3 h-3 rotate-45 -mt-1.5" style="background-color: ${color}; transform: translateY(-3px) rotate(45deg);"></div>
      </div>`,
    className: 'custom-store-pin',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  });
};

interface DeliveryMapProps {
  storeLat: number;
  storeLng: number;
  customerLat: number;
  customerLng: number;
  routeGeometry?: any;
  onCustomerPositionChange: (lat: number, lng: number) => void;
  accentColor?: string;
  borderColor?: string;
  backgroundColor?: string;
  isDragging?: boolean;
}

export function DeliveryMap({
  storeLat,
  storeLng,
  customerLat,
  customerLng,
  routeGeometry,
  onCustomerPositionChange,
  accentColor = '#DC2626',
  borderColor = 'rgba(255, 255, 255, 0.08)',
  backgroundColor = 'rgba(24, 24, 27, 0.5)',
}: DeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const storeMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const isInternalMoveRef = useRef<boolean>(false);
  const [mapDragging, setMapDragging] = useState(false);

  const onPositionChangeRef = useRef(onCustomerPositionChange);
  useEffect(() => {
    onPositionChangeRef.current = onCustomerPositionChange;
  }, [onCustomerPositionChange]);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center map exactly on customer pos (fixed pin will point here)
    const map = L.map(mapContainerRef.current, {
      center: [customerLat, customerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Store marker (un-draggable origin)
    const storeMarker = L.marker([storeLat, storeLng], {
      icon: createStoreIcon(accentColor),
    }).addTo(map);
    // Dark-themed styled popup for the origin to be visible on any theme, with name in RED as requested
    const popupContent = `<div style="color: #ef4444; font-family: sans-serif; font-weight: bold; font-size: 13px; text-transform: uppercase; text-align: center;"><b>Discreta Boutique</b><br/><span style="color: #ffffff; font-size: 10px; opacity: 0.8;">Ponto de Origem</span></div>`;
    storeMarker.bindPopup(popupContent).openPopup();
    storeMarkerRef.current = storeMarker;

    // We no longer create a draggable user marker. The blue pin is fixed in DOM by CSS.
    
    mapRef.current = map;

    // Movement listeners on map itself
    map.on('movestart', () => {
      setMapDragging(true);
    });

    map.on('moveend', () => {
      setMapDragging(false);
      const pos = map.getCenter();
      onPositionChangeRef.current(pos.lat, pos.lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        storeMarkerRef.current = null;
        routeLineRef.current = null;
      }
    };
  }, []);

  // Sync store coords
  useEffect(() => {
    if (storeMarkerRef.current && mapRef.current) {
      storeMarkerRef.current.setLatLng([storeLat, storeLng]);
    }
  }, [storeLat, storeLng]);

  // Sync map center externally if prop changes (not triggered by internal drag)
  useEffect(() => {
    if (mapRef.current && !mapDragging) {
      const currentCenter = mapRef.current.getCenter();
      const dist = currentCenter.distanceTo(L.latLng(customerLat, customerLng));
      if (dist > 5) {
        mapRef.current.setView([customerLat, customerLng], mapRef.current.getZoom());
      }
    }
  }, [customerLat, customerLng]);

  // Update Route geometry line
  useEffect(() => {
    // Route drawing entirely removed per user request
    if (routeLineRef.current) {
      routeLineRef.current.remove();
      routeLineRef.current = null;
    }
  }, [routeGeometry]);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.setView([customerLat, customerLng], 16);
    }
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border shadow-inner group" style={{ borderColor }}>
      <div ref={mapContainerRef} className="w-full h-full min-h-[250px] sm:min-h-[350px] z-10 cursor-move" />

      {/* Fixed Target Pin */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none pb-8 flex flex-col items-center drop-shadow-2xl">
        <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center shadow-lg" style={{ backgroundColor: accentColor }}>
          <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
        </div>
        <div className="w-3 h-3 rotate-45 -mt-1.5" style={{ backgroundColor: accentColor }}></div>
      </div>

      {/* Recenter viewport */}
      <button
        id="delivery-recenter-btn"
        type="button"
        onClick={handleRecenter}
        className="absolute bottom-4 left-4 z-20 p-2.5 rounded-xl bg-zinc-950 shadow-md border hover:bg-zinc-900 active:scale-95 transition-all flex items-center justify-center text-red-500"
        style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}
        title="Ver rota completa"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="3" fill="#ef4444" />
        </svg>
      </button>

      {/* Tip Banner */}
      <div 
        id="delivery-map-tip"
        className="absolute top-4 left-4 right-4 z-20 px-4 py-2 rounded-xl text-center shadow-md border backdrop-blur-md flex items-center justify-center gap-1.5 pointer-events-none"
        style={{
          backgroundColor,
          borderColor,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <p className="text-[10px] font-bold tracking-wide uppercase text-zinc-100">
          Arraste o mapa para corrigir seu local exato
        </p>
      </div>

      {/* High contrast style overrides for map controls and markers */}
      <style>{`
        /* Force high-visibility dark & red zoom buttons */
        .leaflet-container .leaflet-control-zoom {
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5) !important;
          background-color: #0c0a09 !important;
          border-radius: 8px !important;
          overflow: hidden !important;
        }
        .leaflet-container .leaflet-control-zoom a, 
        .leaflet-container .leaflet-control-zoom a:visited,
        .leaflet-container .leaflet-control-zoom a:hover {
          background-color: #0c0a09 !important;
          color: #ef4444 !important;
          width: 34px !important;
          height: 34px !important;
          line-height: 34px !important;
          font-size: 20px !important;
          font-weight: 900 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-bottom: 1px solid rgba(239, 68, 68, 0.2) !important;
          text-decoration: none !important;
        }
        .leaflet-container .leaflet-control-zoom a:hover {
          background-color: #1c1917 !important;
          color: #fca5a5 !important;
        }
        .leaflet-container .leaflet-control-zoom a:last-child {
          border-bottom: none !important;
        }

        /* Force high contrast popup styling for the boutique's origin label */
        .leaflet-popup-content-wrapper {
          background: #0c0a09 !important;
          color: #ef4444 !important;
          font-family: inherit !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6) !important;
          border: 1px solid rgba(239, 68, 68, 0.25) !important;
        }
        .leaflet-popup-content {
          margin: 12px 16px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          line-height: 1.4 !important;
        }
        .leaflet-popup-tip {
          background: #0c0a09 !important;
          border: 1px solid rgba(239, 68, 68, 0.25) !important;
        }
      `}</style>
    </div>
  );
}
