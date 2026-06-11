import { useState, useEffect } from 'react';

export interface AddressDetails {
  latitude: number;
  longitude: number;
  pontoReferencia: string;
  observacoes: string;
  accuracy: number;
  rua?: string; // Optional metadata only
  cidade?: string; // Optional metadata only
}

interface DeliveryAddressFormProps {
  address: AddressDetails;
  onChange: (fields: Partial<AddressDetails>) => void;
  accentColor?: string;
  cardText?: string;
  subTextCardColor?: string;
  borderHex?: string;
  bgHex?: string;
  bgText?: string;
}

export default function DeliveryAddressForm({
  address,
  onChange,
  accentColor = '#FF385C',
  cardText = '#ffffff',
  subTextCardColor = 'rgba(255, 255, 255, 0.5)',
  borderHex = 'rgba(255, 255, 255, 0.08)',
  bgHex = '#0c0c0e',
  bgText = '#ffffff',
}: DeliveryAddressFormProps) {
  return (
    <div className="space-y-4" id="delivery-address-form">
      {/* Geolocation feedback (Readonly metadata) */}
      <div 
        className="flex justify-between items-center px-4 py-2.5 rounded-xl border text-[10px] uppercase font-mono tracking-wider"
        style={{ borderColor: borderHex, backgroundColor: `${bgHex}80`, color: subTextCardColor }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>GPS Ativo ({address.accuracy ? `${Math.round(address.accuracy)}m` : 'Alta Precisão'})</span>
        </div>
        <div className="text-right">
          <span>{address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Ponto de Referência *
          </label>
          <input 
            type="text" 
            required 
            value={address.pontoReferencia} 
            onChange={e => onChange({ pontoReferencia: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="Ex: Casa azul, ao lado da farmácia..." 
          />
        </div>
        
        <div>
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Observações (Opcional)
          </label>
          <textarea
            value={address.observacoes} 
            onChange={e => onChange({ observacoes: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="Ex: Entregar na recepção, tocar campainha..."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
