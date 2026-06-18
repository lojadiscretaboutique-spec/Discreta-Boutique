import React, { useMemo } from 'react';
import { Tv, Calendar, ShoppingBag, Eye, Zap } from 'lucide-react';
import { LiveSession } from '../../../../../types/liveShop';

interface Props {
  lives: LiveSession[];
}

export function LiveShopDashboardCards({ lives }: Props) {
  const stats = useMemo(() => {
    let liveCount = 0;
    let scheduledCount = 0;
    let totalLinkedProducts = 0;
    let totalViews = 0;
    let totalActiveOffers = 0;

    lives.forEach((l) => {
      if (l.status === 'ao_vivo') liveCount++;
      if (l.status === 'agendada') scheduledCount++;
      totalLinkedProducts += l.products?.length || 0;
      totalViews += l.statistics?.views || 0;
      totalActiveOffers += l.flashOffers?.filter(o => o.active).length || 0;
    });

    return { liveCount, scheduledCount, totalLinkedProducts, totalViews, totalActiveOffers };
  }, [lives]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4" id="live-shop-dashboard-cards">
      {/* Live Now Card */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-sm relative overflow-hidden group">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Lives Transmitindo</p>
          <Tv className={`text-red-500 ${stats.liveCount > 0 ? 'animate-pulse' : ''}`} size={18} />
        </div>
        <p className="text-3xl font-black text-white">{stats.liveCount}</p>
        <p className="text-xs text-zinc-500 mt-1">
          {stats.liveCount > 0 ? 'Exibindo player ativo no site' : 'Nenhuma transmissão ativa'}
        </p>
        {stats.liveCount > 0 && (
          <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-red-500 m-3 animate-ping" />
        )}
      </div>

      {/* Scheduled Card */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Eventos Agendados</p>
          <Calendar className="text-amber-500" size={18} />
        </div>
        <p className="text-3xl font-black text-white">{stats.scheduledCount}</p>
        <p className="text-xs text-zinc-500 mt-1">Aguardando temporizador na Home</p>
      </div>

      {/* Linked Products Card */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Produtos Vinculados</p>
          <ShoppingBag className="text-blue-500" size={18} />
        </div>
        <p className="text-3xl font-black text-white">{stats.totalLinkedProducts}</p>
        <p className="text-xs text-zinc-500 mt-1">itens com valor exclusivo de Live</p>
      </div>

      {/* Total view-count / active flash sales */}
      <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Ofertas Relâmpago / Cliques</p>
          <Zap className="text-yellow-500" size={18} />
        </div>
        <p className="text-3xl font-black text-white">{stats.totalActiveOffers}</p>
        <p className="text-xs text-zinc-500 mt-1">Ofertas com temporizador ativadas</p>
      </div>
    </div>
  );
}
export default LiveShopDashboardCards;
