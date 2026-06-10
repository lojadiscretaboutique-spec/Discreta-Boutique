import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker assets in standard packagers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface DeliveryMapProps {
  latitude: number;
  longitude: number;
  accuracy?: number;
  onPositionChange: (lat: number, lng: number) => void;
  accentColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}

export default function DeliveryMap({
  latitude,
  longitude,
  accuracy,
  onPositionChange,
  accentColor = '#FF385C', // iFood red or custom
  backgroundColor = 'rgba(24, 24, 27, 0.5)',
  borderColor = 'rgba(255, 255, 255, 0.08)',
}: DeliveryMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const isInternalMoveRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState(false);
  const onPositionChangeRef = useRef(onPositionChange);

  // Keep callback ref updated to prevent effect re-runs
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  // Handle map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Use a clean, elegant styling for the map
    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 16,
      zoomControl: false, // Hide default controls for a clean app look
      attributionControl: false, // Cleaner UI
    });

    // High visibility CartoDB Voyager Light tiles for premium light mode
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    // Zoom buttons in a nicer position
    L.control.zoom({
      position: 'bottomright',
    }).addTo(map);

    mapRef.current = map;

    // Track dragging/moving states to animate the central pointer
    map.on('movestart', () => {
      setIsDragging(true);
    });

    map.on('moveend', () => {
      setIsDragging(false);
      if (isInternalMoveRef.current) {
        isInternalMoveRef.current = false;
        return;
      }
      const center = map.getCenter();
      onPositionChangeRef.current(center.lat, center.lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Sync outside coordinate changes to map view
  useEffect(() => {
    if (mapRef.current) {
      const currentCenter = mapRef.current.getCenter();
      const distance = currentCenter.distanceTo(L.latLng(latitude, longitude));
      
      // If distance is significant (more than 5 meters), adjust center
      if (distance > 5) {
        isInternalMoveRef.current = true;
        mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
      }
    }
  }, [latitude, longitude]);

  // Draw accuracy circle
  useEffect(() => {
    if (!mapRef.current) return;

    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    if (accuracy && accuracy < 200) {
      circleRef.current = L.circle([latitude, longitude], {
        radius: accuracy,
        color: accentColor,
        fillColor: accentColor,
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(mapRef.current);
    }
  }, [latitude, longitude, accuracy, accentColor]);

  const handleCenterToGPS = () => {
    if (mapRef.current) {
      mapRef.current.setView([latitude, longitude], 17);
    }
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border shadow-inner group" style={{ borderColor }}>
      {/* Map Container */}
      <div id="leaflet-delivery-map animate-fade-in" ref={mapContainerRef} className="w-full h-full min-h-[220px] sm:min-h-[300px] z-10" />

      {/* FIXED PIN OVERLAY (iFood style) */}
      <div 
        id="delivery-map-pin"
        className="absolute top-1/2 left-1/2 z-20 pointer-events-none -translate-x-1/2 select-none flex flex-col items-center"
        style={{
          transform: `translate(-50%, ${isDragging ? '-60%' : '-50%'})`,
          transition: 'transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {/* Modern styled pin with custom theme color */}
        <div className="relative flex flex-col items-center">
          {/* Outer Ring / Pin Body */}
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce-short"
            style={{ backgroundColor: accentColor }}
          >
            {/* Inner White Dot */}
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-inner" />
          </div>
          {/* Triangular pointer */}
          <div 
            className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent -mt-[2px] filter drop-shadow-[0_2px_1px_rgba(0,0,0,0.15)]"
            style={{ borderTopColor: accentColor }}
          />
        </div>

        {/* Pin Shadow */}
        <div 
          className="w-4 h-1.5 rounded-full bg-black/30 blur-[1px] transition-all duration-200 mt-0.5" 
          style={{
            transform: `scale(${isDragging ? '0.6' : '1'})`,
            opacity: isDragging ? 0.4 : 1,
          }}
        />
      </div>

      {/* Recenter button */}
      <button
        id="recenter-gps-btn"
        type="button"
        onClick={handleCenterToGPS}
        className="absolute bottom-4 left-4 z-20 p-2.5 rounded-xl bg-zinc-950 shadow-md border hover:bg-zinc-900 active:scale-95 transition-all flex items-center justify-center text-red-500"
        style={{ borderColor: 'rgba(239, 68, 68, 0.25)' }}
        title="Centralizar na minha localização"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="#ef4444" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
        </svg>
      </button>

      {/* Tip Banner */}
      <div 
        id="delivery-map-tip"
        className="absolute top-4 left-4 right-4 z-20 px-4 py-2 rounded-xl text-center shadow-md border backdrop-blur-md flex items-center justify-center gap-1.5 pointer-events-none animate-fade-in"
        style={{
          backgroundColor,
          borderColor,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <p className="text-[11px] font-bold tracking-wide uppercase text-zinc-100">
          Arrastar o mapa ajusta o endereço
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

        /* Force high contrast popup styling */
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
