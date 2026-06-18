import React from 'react';
import { Sliders, ToggleLeft, Eye, Layout, ShieldAlert } from 'lucide-react';
import { Button } from '../../../../../components/ui/button';

interface Props {
  showCountdown: boolean;
  setShowCountdown: (v: boolean) => void;
  showRelatedProducts: boolean;
  setShowRelatedProducts: (v: boolean) => void;
  showFlashOffers: boolean;
  setShowFlashOffers: (v: boolean) => void;
  showWhatsappButton: boolean;
  setShowWhatsappButton: (v: boolean) => void;
  showBuyNowButton: boolean;
  setShowBuyNowButton: (v: boolean) => void;
  enableFloatingPlayer: boolean;
  setEnableFloatingPlayer: (v: boolean) => void;
  showLiveBadge: boolean;
  setShowLiveBadge: (v: boolean) => void;
}

export function LiveShopSettingsTab({
  showCountdown, setShowCountdown,
  showRelatedProducts, setShowRelatedProducts,
  showFlashOffers, setShowFlashOffers,
  showWhatsappButton, setShowWhatsappButton,
  showBuyNowButton, setShowBuyNowButton,
  enableFloatingPlayer, setEnableFloatingPlayer,
  showLiveBadge, setShowLiveBadge,
}: Props) {
  
  // Custom helper toggle layouts
  const ToggleRow = ({
    title,
    description,
    value,
    onToggle
  }: {
    title: string;
    description: string;
    value: boolean;
    onToggle: () => void;
  }) => (
    <div className="flex items-center justify-between p-4 bg-zinc-950 border border-zinc-850 rounded-xl hover:border-zinc-800 transition">
      <div className="space-y-0.5">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-zinc-500 max-w-md">{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 ${
          value ? 'bg-red-600 justify-end' : 'bg-zinc-800 justify-start'
        }`}
      >
        <div className="w-4 h-4 rounded-full bg-white shadow-md transition-all" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6" id="liveshop-settings-tab">
      <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
        <Sliders size={18} className="text-red-500" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configurar Exibição e Recursos no Storefront</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Toggle options */}
        <ToggleRow
          title="Exibir Cronômetro Regressivo"
          description="Mostra contagem regressiva para lives com status 'Agendada' na página principal."
          value={showCountdown}
          onToggle={() => setShowCountdown(!showCountdown)}
        />

        <ToggleRow
          title="Listar Produtos Relacionados"
          description="Mostra a grade de produtos vinculados na barra lateral ou rodapé do player."
          value={showRelatedProducts}
          onToggle={() => setShowRelatedProducts(!showRelatedProducts)}
        />

        <ToggleRow
          title="Habilitar Ofertas Relâmpago"
          description="Permite que caixas com ofertas limitadas saltem na tela durante o streaming."
          value={showFlashOffers}
          onToggle={() => setShowFlashOffers(!showFlashOffers)}
        />

        <ToggleRow
          title="Botão de Contato WhatsApp"
          description="Exibe um atalho de WhatsApp flutuante direto para o suporte de vendas."
          value={showWhatsappButton}
          onToggle={() => setShowWhatsappButton(!showWhatsappButton)}
        />

        <ToggleRow
          title="Ativar Botão de Compra Rápida"
          description="Insere links de finalização/adicionar ao carrinho rápidas abaixo dos produtos destacados."
          value={showBuyNowButton}
          onToggle={() => setShowBuyNowButton(!showBuyNowButton)}
        />

        <ToggleRow
          title="Habilitar Mini Player Flutuante"
          description="Se ativo, os clientes continuam assistindo à live em uma pequena janela enquanto navegam por outras páginas da loja."
          value={enableFloatingPlayer}
          onToggle={() => setEnableFloatingPlayer(!enableFloatingPlayer)}
        />

        <ToggleRow
          title="Selo de Live no Header / Menu"
          description="Mostra um indicador de status vermelho piscando 'AO VIVO' na barra de navegação global da loja."
          value={showLiveBadge}
          onToggle={() => setShowLiveBadge(!showLiveBadge)}
        />
      </div>

      <div className="bg-red-950/10 border border-red-900/40 p-4 rounded-xl flex gap-3 text-xs text-zinc-400">
        <ShieldAlert size={18} className="text-red-500 shrink-0" />
        <p>
          Configurações instantâneas: Mudar estas opções alterará a experiência de compra do cliente em tempo real no storefront da Discreta Boutique. Certifique-se de salvar o formulário para persistir estas preferências na nuvem.
        </p>
      </div>
    </div>
  );
}
export default LiveShopSettingsTab;
