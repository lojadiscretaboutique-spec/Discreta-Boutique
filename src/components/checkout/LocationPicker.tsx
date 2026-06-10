import { useState, useEffect } from 'react';
import { MapPin, Navigation, AlertCircle, RefreshCw, Compass, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';

interface LocationPickerProps {
  onLocationSelected: (coords: { lat: number; lng: number; accuracy: number }) => void;
  accentColor?: string;
  cardBg?: string;
  cardText?: string;
  subTextColor?: string;
}

export default function LocationPicker({
  onLocationSelected,
  accentColor = '#FF385C',
  cardBg = 'rgba(24, 24, 27, 0.5)',
  cardText = '#ffffff',
  subTextColor = 'rgba(255, 255, 255, 0.5)',
}: LocationPickerProps) {
  const [showPrePrompt, setShowPrePrompt] = useState(true);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const requestLocation = () => {
    setStatus('requesting');
    setErrorMessage('');

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Seu navegador não oferece suporte para geolocalização.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus('idle');
        onLocationSelected({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        setStatus('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage('Permissão de localização negada pelo usuário. Ative a localização nas configurações do seu navegador.');
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMessage('A informação de localização do dispositivo não está disponível.');
            break;
          case error.TIMEOUT:
            setErrorMessage('Tempo limite esgotado ao buscar a localização GPS. Tente novamente.');
            break;
          default:
            setErrorMessage('Ocorreu um erro desconhecido ao obter a localização.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // We show a beautiful Portuguese pre-prompt before initiating the browser permission dialog, so we do not call requestLocation automatically on mount.
  useEffect(() => {
    // Left intentionally empty to wait for the user to tap "Solicitar GPS" on the local pre-prompt
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div 
        className="rounded-[2.5rem] border p-8 sm:p-12 shadow-2xl relative overflow-hidden transition-all duration-300 flex flex-col items-center text-center max-w-lg w-full"
        style={{ backgroundColor: cardBg, borderColor: 'rgba(255, 255, 255, 0.08)' }}
      >
        {/* Background Decorative Glow */}
        <div 
          className="absolute -right-32 -bottom-32 w-64 h-64 rounded-full blur-[80px] pointer-events-none opacity-20"
          style={{ backgroundColor: accentColor }}
        />
        <div 
          className="absolute -left-32 -top-32 w-64 h-64 rounded-full blur-[80px] pointer-events-none opacity-10"
          style={{ backgroundColor: accentColor }}
        />

        {status === 'requesting' && (
          <div className="space-y-6 py-6 w-full" id="location-picker-requesting">
            <div className="relative flex items-center justify-center">
              {/* Spinning background effect */}
              <div 
                className="absolute w-24 h-24 rounded-full border-t-2 border-r-2 animate-spin-slow opacity-60"
                style={{ borderColor: accentColor }}
              />
              {/* Pulsing ring */}
              <div 
                className="absolute w-20 h-20 rounded-full animate-ping opacity-25"
                style={{ backgroundColor: accentColor }}
              />
              {/* Centered MapPin icon */}
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center relative shadow-lg"
                style={{ backgroundColor: accentColor }}
              >
                <Navigation size={28} className="text-white animate-pulse" />
              </div>
            </div>
            
            <div>
              <h4 className="text-xl font-black uppercase tracking-wider mb-2" style={{ color: cardText }}>
                Detectando sua localização...
              </h4>
              <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: subTextColor }}>
                Buscando sinal GPS para encontrar seu endereço com a melhor precisão possível.
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6 py-4 w-full" id="location-picker-error">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto shadow-sm">
              <AlertCircle size={32} className="text-amber-500" />
            </div>

            <div className="space-y-2">
              <h4 className="text-lg font-black uppercase tracking-wider" style={{ color: cardText }}>
                Localização necessária
              </h4>
              <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: subTextColor }}>
                {errorMessage}
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs justify-center pt-2 mx-auto">
              <Button
                id="retry-gps-btn"
                onClick={requestLocation}
                style={{ backgroundColor: accentColor }}
                className="font-black text-xs uppercase tracking-widest py-5 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all text-white w-full"
              >
                <RefreshCw size={14} /> Tentar Novamente
              </Button>
              
              <button
                id="bypass-gps-btn"
                type="button"
                onClick={() => onLocationSelected({ lat: -23.55052, lng: -46.633308, accuracy: 150 })}
                className="font-black text-[10px] uppercase tracking-wider py-2 text-zinc-400 hover:text-white transition-all underline"
              >
                Inserir Localização no Mapa Manualmente
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && (
          <div className="space-y-6 py-6 w-full" id="location-picker-idle">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-md"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <MapPin size={30} style={{ color: accentColor }} />
            </div>

            <div>
              <h4 className="text-lg font-black uppercase tracking-wider mb-2" style={{ color: cardText }}>
                Permissão de Localização
              </h4>
              <p className="text-sm max-w-sm mx-auto leading-relaxed mb-6" style={{ color: subTextColor }}>
                Para entregarmos seu pedido com segurança, permita nosso acesso ao seu GPS.
              </p>
              <Button
                id="grant-gps-btn"
                onClick={requestLocation}
                style={{ backgroundColor: accentColor }}
                className="font-black text-xs uppercase tracking-widest py-5 px-8 rounded-2xl flex items-center justify-center gap-2 mx-auto hover:opacity-90 active:scale-95 transition-all text-white"
              >
                PERMITIR <Navigation size={14} className="rotate-45" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
