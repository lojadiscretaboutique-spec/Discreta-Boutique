import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../ui/button';
import { MapPin, Navigation, Compass, Loader2 } from 'lucide-react';

// Fix pathing with leaflet icons if needed
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface StoreLocationPickerProps {
  latitude: number;
  longitude: number;
  onLocationSave: (coords: { latitude: number; longitude: number }) => void;
  accentColor?: string;
  borderColor?: string;
  cardBg?: string;
}

export function StoreLocationPicker({
  latitude,
  longitude,
  onLocationSave,
  accentColor = '#DC2626',
  borderColor = 'rgba(255, 255, 255, 0.08)',
  cardBg = 'rgba(24, 24, 27, 0.5)',
}: StoreLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [currentLat, setCurrentLat] = useState(latitude);
  const [currentLng, setCurrentLng] = useState(longitude);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Sync state if initial props change
  useEffect(() => {
    setCurrentLat(latitude);
    setCurrentLng(longitude);
  }, [latitude, longitude]);

  // Handle map creation
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [currentLat, currentLng],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    // High visibility CartoDB Voyager Light tiles for premium light mode
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    // Create marker
    const marker = L.marker([currentLat, currentLng], {
      draggable: true,
    }).addTo(map);

    markerRef.current = marker;
    mapRef.current = map;
    setMapLoaded(true);

    // Marker drag listeners
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setCurrentLat(position.lat);
      setCurrentLng(position.lng);
    });

    // Map click listener to reposition
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      setCurrentLat(lat);
      setCurrentLng(lng);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Sync coords back into map
  useEffect(() => {
    if (mapRef.current && markerRef.current && mapLoaded) {
      const curLatLng = markerRef.current.getLatLng();
      if (Math.abs(curLatLng.lat - currentLat) > 0.0001 || Math.abs(curLatLng.lng - currentLng) > 0.0001) {
        markerRef.current.setLatLng([currentLat, currentLng]);
        mapRef.current.setView([currentLat, currentLng], mapRef.current.getZoom());
      }
    }
  }, [currentLat, currentLng, mapLoaded]);

  // GPS request handler
  const handleGPSLocation = () => {
    if (!navigator.geolocation) {
      alert('Seu navegador não suporta geolocalização por GPS.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        setCurrentLat(lat);
        setCurrentLng(lng);
        setGpsLoading(false);
      },
      (error) => {
        console.error('GPS error:', error);
        alert('Erro ao obter sua localização de GPS. Por favor, verifique suas permissões de navegador.');
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSave = () => {
    onLocationSave({
      latitude: currentLat,
      longitude: currentLng,
    });
  };

  return (
    <div className="space-y-4">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Coordenadas da Loja</span>
          <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">
            Lat: {currentLat.toFixed(6)} | Lng: {currentLng.toFixed(6)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleGPSLocation}
            disabled={gpsLoading}
            className="text-xs px-3 py-2 h-9 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            {gpsLoading ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5 mr-1.5 rotate-45" />
            )}
            Usar minha localização
          </Button>

          <Button
            type="button"
            onClick={handleSave}
            style={{ backgroundColor: accentColor }}
            className="text-xs text-white px-4 py-2 h-9 font-bold active:scale-95"
          >
            <MapPin className="w-3.5 h-3.5 mr-1.5" />
            Salvar Origem
          </Button>
        </div>
      </div>

      {/* Map visualizer container */}
      <div 
        className="relative h-[280px] sm:h-[350px] rounded-2xl overflow-hidden border shadow-inner"
        style={{ borderColor: borderColor }}
      >
        <div ref={mapContainerRef} className="w-full h-full z-10" />
        
        {/* Floating guidance banner */}
        <div className="absolute top-3 left-3 right-3 z-20 bg-black/75 backdrop-blur-md px-3 py-2 rounded-xl border border-white/5 flex items-center justify-center gap-1.5 pointer-events-none text-[10px] sm:text-xs">
          <Compass className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span className="font-bold text-white uppercase tracking-wider">
            Arraste o pin ou clique no mapa para redefinir o ponto de origem das entregas
          </span>
        </div>
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
      `}</style>
    </div>
  );
}
