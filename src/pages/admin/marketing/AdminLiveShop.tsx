import React from 'react';
import { Tv, Plus, Loader2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { useLiveShop } from '../../../hooks/useLiveShop';

// Custom subcomponents
import { LiveShopDashboardCards } from './components/live-shop/LiveShopDashboardCards';
import { LiveShopList } from './components/live-shop/LiveShopList';
import { LiveShopForm } from './components/live-shop/LiveShopForm';

export function AdminLiveShop() {
  const {
    lives,
    storeProducts,
    loading,

    showForm,
    liveToEdit,
    activeTab,
    setActiveTab,

    // Fields
    title, setTitle,
    subtitle, setSubtitle,
    description, setDescription,
    coverImage, setCoverImage,
    bannerImage, setBannerImage,
    date, setDate,
    time, setTime,
    status, setStatus,
    streamingUrl, setStreamingUrl,

    // Settings
    showCountdown, setShowCountdown,
    showRelatedProducts, setShowRelatedProducts,
    showFlashOffers, setShowFlashOffers,
    showWhatsappButton, setShowWhatsappButton,
    showBuyNowButton, setShowBuyNowButton,
    enableFloatingPlayer, setEnableFloatingPlayer,
    showLiveBadge, setShowLiveBadge,

    // Lists
    linkedProducts, setLinkedProducts,
    flashOffers, setFlashOffers,
    kits, setKits,
    coupons, setCoupons,

    // Actions
    handleOpenNewForm,
    handleEditLive,
    handleSaveLive,
    handleUpdateStatus,
    handleDuplicateLive,
    handleDeleteLive,

    // Permissions
    canCreate,
    canEdit,
    canDelete
  } = useLiveShop();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4" id="liveshop-admin-loader">
        <Loader2 className="w-10 h-10 text-red-650 animate-spin" />
        <p className="text-sm font-medium text-zinc-400">Carregando canal Live Commerce...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6" id="liveshop-admin-root">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Tv className="text-red-600 focus:animate-pulse" size={24} /> Live Shop Commerce
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">
            Crie transmissões interativas em tempo real integradas ao catálogo de lingeries da Discreta Boutique.
          </p>
        </div>

        {!showForm && canCreate && (
          <Button
            onClick={handleOpenNewForm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold h-11 px-5 rounded-lg shadow-lg shadow-red-950/40 transition-all flex items-center gap-2"
          >
            <Plus size={16} /> Cadastrar Nova Live
          </Button>
        )}
      </div>

      {/* Conditional Dashboard and listing views */}
      {!showForm ? (
        <>
          {/* Summary tiles cards */}
          <LiveShopDashboardCards lives={lives} />

          {/* List display matching live logs */}
          <div className="mt-8">
            <h2 className="text-sm font-black text-zinc-300 uppercase tracking-widest mb-4">Gerenciamento de Canais</h2>
            <LiveShopList
              lives={lives}
              onEdit={handleEditLive}
              onDuplicate={handleDuplicateLive}
              onUpdateStatus={handleUpdateStatus}
              onDelete={handleDeleteLive}
              onOpenNewForm={handleOpenNewForm}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          </div>
        </>
      ) : (
        /* Tabbed Workspace Form panel */
        <LiveShopForm
          liveToEdit={liveToEdit}
          onCancel={() => setShowForm(false)}
          onSubmit={handleSaveLive}
          canEdit={canEdit}
          storeProducts={storeProducts}
          activeTab={activeTab}
          setActiveTab={setActiveTab}

          // Fields mapping
          title={title} setTitle={setTitle}
          subtitle={subtitle} setSubtitle={setSubtitle}
          description={description} setDescription={setDescription}
          coverImage={coverImage} setCoverImage={setCoverImage}
          bannerImage={bannerImage} setBannerImage={setBannerImage}
          date={date} setDate={setDate}
          time={time} setTime={setTime}
          status={status} setStatus={setStatus}
          streamingUrl={streamingUrl} setStreamingUrl={setStreamingUrl}

          // Settings mapping
          showCountdown={showCountdown} setShowCountdown={setShowCountdown}
          showRelatedProducts={showRelatedProducts} setShowRelatedProducts={setShowRelatedProducts}
          showFlashOffers={showFlashOffers} setShowFlashOffers={setShowFlashOffers}
          showWhatsappButton={showWhatsappButton} setShowWhatsappButton={setShowWhatsappButton}
          showBuyNowButton={showBuyNowButton} setShowBuyNowButton={setShowBuyNowButton}
          enableFloatingPlayer={enableFloatingPlayer} setEnableFloatingPlayer={setEnableFloatingPlayer}
          showLiveBadge={showLiveBadge} setShowLiveBadge={setShowLiveBadge}

          // Lists mapping
          linkedProducts={linkedProducts} setLinkedProducts={setLinkedProducts}
          flashOffers={flashOffers} setFlashOffers={setFlashOffers}
          kits={kits} setKits={setKits}
          coupons={coupons} setCoupons={setCoupons}
        />
      )}
    </div>
  );
}
export default AdminLiveShop;
