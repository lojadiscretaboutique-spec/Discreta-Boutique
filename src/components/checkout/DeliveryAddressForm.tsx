import { useState, useEffect } from 'react';

export interface AddressDetails {
  latitude: number;
  longitude: number;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  complemento: string;
  referencia: string;
  cidade: string;
  estado: string;
  pais: string;
  accuracy: number;
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
  isGeocodeFailed?: boolean;
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
  isGeocodeFailed = false,
}: DeliveryAddressFormProps) {
  // We can let the user edit the CEP if it failed to geocode or if explicitly specified as empty.
  const isCepEditable = isGeocodeFailed || !address.cep;

  return (
    <div className="space-y-4 sm:space-y-6" id="delivery-address-form">
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

      {/* RUA & NUMERO */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="sm:col-span-3">
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Rua / Avenida (Bloqueado por GPS) *
          </label>
          <input 
            type="text" 
            readOnly
            required 
            value={address.rua} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all opacity-60 cursor-not-allowed select-none" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="Nome da rua pelo GPS" 
          />
        </div>
        <div>
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Número *
          </label>
          <input 
            type="text" 
            required 
            value={address.numero} 
            onChange={e => onChange({ numero: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-bold text-sm border focus:ring-1 transition-all text-center" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="Nº" 
          />
        </div>
      </div>

      {/* BAIRRO & COMPLEMENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Bairro (Bloqueado por GPS) *
          </label>
          <input 
            type="text" 
            readOnly
            required 
            value={address.bairro} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all opacity-60 cursor-not-allowed select-none" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="Seu bairro pelo GPS" 
          />
        </div>
        <div>
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Complemento
          </label>
          <input 
            type="text" 
            value={address.complemento} 
            onChange={e => onChange({ complemento: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="Ex: Apto, Bloco, Casa" 
          />
        </div>
      </div>

      {/* PONTO DE REFERENCIA & CEP (ONLY CEP EDITABLE IF BLOCKED IS FALSE DEFINED BY CHECKS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Ponto de Referência *
          </label>
          <input 
            type="text" 
            required 
            value={address.referencia} 
            onChange={e => onChange({ referencia: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="Ex: Próximo ao mercado, vizinho ao..." 
          />
        </div>
        <div>
          <label className="block text-[9px] font-black mb-2 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            CEP (Bloqueado)
          </label>
          <input 
            type="text" 
            readOnly
            value={address.cep} 
            className="w-full rounded-xl px-4 py-3 text-sm border focus:ring-1 transition-all font-mono font-bold text-center opacity-60 cursor-not-allowed select-none" 
            style={{ 
              backgroundColor: bgHex, 
              color: bgText, 
              borderColor: borderHex,
            }}
            placeholder="00000-000" 
          />
        </div>
      </div>

      {/* READONLY BLOCKED FIELDS (GEOGRAPHICAL METADATA) */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-[9px] font-black mb-1.5 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Cidade (GPS)
          </label>
          <div 
            className="w-full rounded-xl px-4 py-3 text-sm border font-semibold select-none opacity-50 cursor-not-allowed text-ellipsis overflow-hidden whitespace-nowrap"
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
          >
            {address.cidade || '---'}
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-black mb-1.5 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Estado (GPS)
          </label>
          <div 
            className="w-full rounded-xl px-4 py-3 text-sm border font-bold text-center select-none opacity-50 cursor-not-allowed"
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
          >
            {address.estado || '---'}
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-black mb-1.5 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            País (GPS)
          </label>
          <div 
            className="w-full rounded-xl px-4 py-3 text-sm border font-semibold text-center select-none opacity-50 cursor-not-allowed"
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
          >
            {address.pais || '---'}
          </div>
        </div>
      </div>
    </div>
  );
}
