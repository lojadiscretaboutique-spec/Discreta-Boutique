import { AddressDetails } from '../checkout/DeliveryAddressForm';

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

export function DeliveryAddressForm({
  address,
  onChange,
  accentColor = '#DC2626',
  cardText = '#ffffff',
  subTextCardColor = 'rgba(255, 255, 255, 0.5)',
  borderHex = 'rgba(255, 255, 255, 0.08)',
  bgHex = '#0c0c0e',
  bgText = '#ffffff',
}: DeliveryAddressFormProps) {
  return (
    <div className="space-y-4 sm:space-y-5" id="delivery-address-form-new">
      {/* RUA & NUMERO */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="sm:col-span-3">
          <label className="block text-[10px] font-black mb-1 px-1 uppercase tracking-widest" style={{ color: subTextCardColor }}>
            Rua / Avenida (Bloqueado por GPS) *
          </label>
          <input 
            type="text" 
            readOnly 
            required 
            value={address.rua} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all opacity-60 cursor-not-allowed select-none" 
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
            placeholder="Nome da rua pelo GPS" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-black mb-1 px-1 uppercase tracking-widest text-slate-400" style={{ color: subTextCardColor }}>
            Número *
          </label>
          <input 
            type="text" 
            required 
            value={address.numero} 
            onChange={e => onChange({ numero: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-bold text-sm border focus:ring-1 transition-all text-center" 
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
            placeholder="Nº" 
          />
        </div>
      </div>

      {/* BAIRRO & COMPLEMENTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-black mb-1 px-1 uppercase tracking-widest text-slate-400" style={{ color: subTextCardColor }}>
            Bairro (Bloqueado por GPS) *
          </label>
          <input 
            type="text" 
            readOnly 
            required 
            value={address.bairro} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all opacity-60 cursor-not-allowed select-none" 
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
            placeholder="Seu bairro pelo GPS" 
          />
        </div>
        <div>
          <label className="block text-[10px] font-black mb-1 px-1 uppercase tracking-widest text-slate-400" style={{ color: subTextCardColor }}>
            Complemento
          </label>
          <input 
            type="text" 
            value={address.complemento} 
            onChange={e => onChange({ complemento: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all" 
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
            placeholder="Ex: Apto, Bloco, Casa" 
          />
        </div>
      </div>

      {/* PONTO DE REFERENCIA & CEP */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-[10px] font-black mb-1 px-1 uppercase tracking-widest text-slate-400" style={{ color: subTextCardColor }}>
            Ponto de Referência *
          </label>
          <input 
            type="text" 
            required 
            value={address.referencia} 
            onChange={e => onChange({ referencia: e.target.value })} 
            className="w-full rounded-xl px-4 py-3 font-semibold text-sm border focus:ring-1 transition-all" 
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
            placeholder="Ex: Próximo ao mercado, vizinho ao..." 
          />
        </div>
        <div>
          <label className="block text-[10px] font-black mb-1 px-1 uppercase tracking-widest text-slate-400" style={{ color: subTextCardColor }}>
            CEP (Bloqueado)
          </label>
          <input 
            type="text" 
            readOnly
            value={address.cep} 
            className="w-full rounded-xl px-4 py-3 text-sm border font-mono font-bold text-center opacity-65 cursor-not-allowed select-none" 
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
            placeholder="00000-000" 
          />
        </div>
      </div>

      {/* GEOGRAPHICAL READ-ONLY LOCKS */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[9px] font-black mb-1 px-1 uppercase tracking-wider text-slate-400" style={{ color: subTextCardColor }}>
            Cidade (GPS)
          </label>
          <div 
            className="w-full rounded-xl px-3 py-2 text-xs border font-semibold select-none opacity-60 cursor-not-allowed text-ellipsis overflow-hidden whitespace-nowrap"
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
          >
            {address.cidade || '---'}
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-black mb-1 px-1 uppercase tracking-wider text-slate-400" style={{ color: subTextCardColor }}>
            Estado (GPS)
          </label>
          <div 
            className="w-full rounded-xl px-2 py-2 text-xs border font-bold text-center select-none opacity-60 cursor-not-allowed"
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
          >
            {address.estado || '---'}
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-black mb-1 px-1 uppercase tracking-wider text-slate-400" style={{ color: subTextCardColor }}>
            País (GPS)
          </label>
          <div 
            className="w-full rounded-xl px-2 py-2 text-xs border font-semibold text-center select-none opacity-60 cursor-not-allowed"
            style={{ backgroundColor: bgHex, color: bgText, borderColor: borderHex }}
          >
            {address.pais || '---'}
          </div>
        </div>
      </div>
    </div>
  );
}
export default DeliveryAddressForm;
