import React from 'react';
import { 
  Tv, Eye, ShoppingCart, Tag, Settings, BarChart2, Bell, Sparkles, Zap, ArrowLeft, Loader2 
} from 'lucide-react';
import { Button } from '../../../../../components/ui/button';
import { LiveSession } from '../../../../../types/liveShop';
import { Product } from '../../../../../services/productService';
import { cn } from '../../../../../lib/utils';

// Import subtabs
import { LiveShopStreamingTab } from './LiveShopStreamingTab';
import { LiveShopProductsTab } from './LiveShopProductsTab';
import { LiveShopFlashOffersTab } from './LiveFlashOffersTab';
import { LiveShopCombosTab } from './LiveShopCombosTab';
import { LiveShopCouponsTab } from './LiveShopCouponsTab';
import { LiveShopSettingsTab } from './LiveShopSettingsTab';
import { LiveShopAnalyticsTab } from './LiveShopAnalyticsTab';

interface Props {
  liveToEdit: LiveSession | null;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  canEdit: boolean;
  storeProducts: Product[];

  activeTab: 'dados' | 'produtos' | 'flash' | 'kits' | 'cupons' | 'config' | 'analytics' | 'notifications';
  setActiveTab: (t: any) => void;

  // Form Fields
  title: string; setTitle: (v: string) => void;
  subtitle: string; setSubtitle: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  coverImage: string; setCoverImage: (v: string) => void;
  bannerImage: string; setBannerImage: (v: string) => void;
  date: string; setDate: (v: string) => void;
  time: string; setTime: (v: string) => void;
  status: LiveSession['status']; setStatus: (v: LiveSession['status']) => void;
  streamingUrl: string; setStreamingUrl: (v: string) => void;

  // Settings
  showCountdown: boolean; setShowCountdown: (v: boolean) => void;
  showRelatedProducts: boolean; setShowRelatedProducts: (v: boolean) => void;
  showFlashOffers: boolean; setShowFlashOffers: (v: boolean) => void;
  showWhatsappButton: boolean; setShowWhatsappButton: (v: boolean) => void;
  showBuyNowButton: boolean; setShowBuyNowButton: (v: boolean) => void;
  enableFloatingPlayer: boolean; setEnableFloatingPlayer: (v: boolean) => void;
  showLiveBadge: boolean; setShowLiveBadge: (v: boolean) => void;

  // Lists
  linkedProducts: any[]; setLinkedProducts: (v: any[]) => void;
  flashOffers: any[]; setFlashOffers: (v: any[]) => void;
  kits: any[]; setKits: (v: any[]) => void;
  coupons: any[]; setCoupons: (v: any[]) => void;
}

export function LiveShopForm(props: Props) {
  const {
    liveToEdit,
    onCancel,
    onSubmit,
    canEdit,
    storeProducts,
    activeTab,
    setActiveTab,

    title, setTitle,
    subtitle, setSubtitle,
    description, setDescription,
    coverImage, setCoverImage,
    bannerImage, setBannerImage,
    date, setDate,
    time, setTime,
    status, setStatus,
    streamingUrl, setStreamingUrl,

    showCountdown, setShowCountdown,
    showRelatedProducts, setShowRelatedProducts,
    showFlashOffers, setShowFlashOffers,
    showWhatsappButton, setShowWhatsappButton,
    showBuyNowButton, setShowBuyNowButton,
    enableFloatingPlayer, setEnableFloatingPlayer,
    showLiveBadge, setShowLiveBadge,

    linkedProducts, setLinkedProducts,
    flashOffers, setFlashOffers,
    kits, setKits,
    coupons, setCoupons,
  } = props;

  // List tabs configuration
  const tabs = [
    { id: 'dados', label: '1. Vídeo & Transmissão', icon: Tv },
    { id: 'produtos', label: '2. Catálogo & Preços', icon: ShoppingCart },
    { id: 'flash', label: '3. Ofertas Flash', icon: Zap },
    { id: 'kits', label: '4. Combos Compre Junto', icon: Sparkles },
    { id: 'cupons', label: '5. Cupons Promocionais', icon: Tag },
    { id: 'config', label: '6. Exibição no Site', icon: Settings },
    { id: 'analytics', label: '7. Métricas & Cliques', icon: BarChart2 }
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-805 rounded-2xl overflow-hidden shadow-xl" id="liveshop-form-container">
      {/* Form Header */}
      <div className="p-5 border-b border-zinc-800 bg-zinc-950/40 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onCancel}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider">
              {liveToEdit ? `Editar Evento: ${liveToEdit.title}` : 'Cadastrar Nova Live Commerce'}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">Defina mídias, preços e automações de vendas ao vivo.</p>
          </div>
        </div>

        {canEdit && (
          <Button 
            type="button" 
            onClick={onSubmit}
            className="bg-red-650 hover:bg-red-750 text-white font-bold h-9 px-4 text-xs shadow-md shadow-red-950/40 transition-all rounded-lg"
          >
            Salvar Alterações
          </Button>
        )}
      </div>

      {/* Tab select row */}
      <div className="flex overflow-x-auto border-b border-zinc-800 bg-zinc-950/20 scrollbar-none scroll-smooth select-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              type="button"
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 outline-none shrink-0",
                active 
                  ? "border-red-600 text-red-500 bg-red-950/5" 
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-zinc-850/20"
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Primary Tab Body form wrapper */}
      <form onSubmit={onSubmit} className="p-6">
        {activeTab === 'dados' && (
          <LiveShopStreamingTab
            title={title} setTitle={setTitle}
            subtitle={subtitle} setSubtitle={setSubtitle}
            description={description} setDescription={setDescription}
            date={date} setDate={setDate}
            time={time} setTime={setTime}
            status={status} setStatus={setStatus}
            streamingUrl={streamingUrl} setStreamingUrl={setStreamingUrl}
            coverImage={coverImage} setCoverImage={setCoverImage}
            bannerImage={bannerImage} setBannerImage={setBannerImage}
          />
        )}

        {activeTab === 'produtos' && (
          <LiveShopProductsTab
            storeProducts={storeProducts}
            linkedProducts={linkedProducts}
            setLinkedProducts={setLinkedProducts}
          />
        )}

        {activeTab === 'flash' && (
          <LiveShopFlashOffersTab
            storeProducts={storeProducts}
            linkedProducts={linkedProducts}
            flashOffers={flashOffers}
            setFlashOffers={setFlashOffers}
          />
        )}

        {activeTab === 'kits' && (
          <LiveShopCombosTab
            storeProducts={storeProducts}
            linkedProducts={linkedProducts}
            kits={kits}
            setKits={setKits}
          />
        )}

        {activeTab === 'cupons' && (
          <LiveShopCouponsTab
            coupons={coupons}
            setCoupons={setCoupons}
          />
        )}

        {activeTab === 'config' && (
          <LiveShopSettingsTab
            showCountdown={showCountdown} setShowCountdown={setShowCountdown}
            showRelatedProducts={showRelatedProducts} setShowRelatedProducts={setShowRelatedProducts}
            showFlashOffers={showFlashOffers} setShowFlashOffers={setShowFlashOffers}
            showWhatsappButton={showWhatsappButton} setShowWhatsappButton={setShowWhatsappButton}
            showBuyNowButton={showBuyNowButton} setShowBuyNowButton={setShowBuyNowButton}
            enableFloatingPlayer={enableFloatingPlayer} setEnableFloatingPlayer={setEnableFloatingPlayer}
            showLiveBadge={showLiveBadge} setShowLiveBadge={setShowLiveBadge}
          />
        )}

        {activeTab === 'analytics' && (
          <LiveShopAnalyticsTab
            live={liveToEdit}
            storeProducts={storeProducts}
          />
        )}

        {/* Footer Area with actions */}
        <div className="mt-8 pt-5 border-t border-zinc-800 flex justify-between items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0 h-10 px-5"
          >
            Voltar ao Painel
          </Button>

          {canEdit && (
            <div className="flex gap-2">
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white font-bold h-10 px-6 rounded-lg transition-all"
              >
                Salvar Configurações da Live
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
export default LiveShopForm;
