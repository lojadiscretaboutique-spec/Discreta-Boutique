import React, { useMemo } from 'react';
import { BarChart3, Eye, ShoppingCart, DollarSign, Tag, TrendingUp } from 'lucide-react';
import { LiveSession } from '../../../../../types/liveShop';
import { Product } from '../../../../../services/productService';

interface Props {
  live: LiveSession | null;
  storeProducts: Product[];
}

export function LiveShopAnalyticsTab({ live, storeProducts }: Props) {
  if (!live) {
    return (
      <div className="bg-zinc-950 p-8 rounded-xl border border-zinc-800/40 text-center text-zinc-500 text-sm italic" id="liveshop-analytics-tab">
        Hospede ou grave sua transmissão primeiro para iniciar o monitoramento de métricas e conversões em tempo real.
      </div>
    );
  }

  const { statistics } = live;

  // Map clickedProducts keys to names
  const clickedProductsList = useMemo(() => {
    if (!statistics?.clickedProducts) return [];
    
    return Object.entries(statistics.clickedProducts).map(([pId, count]) => {
      const p = storeProducts.find(item => item.id === pId);
      return {
        id: pId,
        name: p?.name || 'Item do catálogo',
        count
      };
    }).sort((a, b) => b.count - a.count);
  }, [statistics?.clickedProducts, storeProducts]);

  return (
    <div className="space-y-6" id="liveshop-analytics-tab">
      <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
        <BarChart3 size={18} className="text-red-500" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Métricas de Engajamento e Desempenho</h3>
      </div>

      {/* Grid displays */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Views */}
        <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-900 shadow-sm">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase mb-1">
            <span>Visualizações</span>
            <Eye size={14} className="text-zinc-650" />
          </div>
          <p className="text-2xl font-black text-white">{statistics?.views || 0}</p>
          <span className="text-[10px] text-zinc-650 font-semibold mt-1 block">Acessos à página /live</span>
        </div>

        {/* Product Clicks */}
        <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-900 shadow-sm">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase mb-1">
            <span>Cliques em Itens</span>
            <ShoppingCart size={14} className="text-zinc-650" />
          </div>
          <p className="text-2xl font-black text-white">{statistics?.productClicks || 0}</p>
          <span className="text-[10px] text-zinc-650 font-semibold mt-1 block">Cliques em Ver Produto</span>
        </div>

        {/* Conversions */}
        <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-900 shadow-sm">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase mb-1">
            <span>Pedidos Criados</span>
            <TrendingUp size={14} className="text-zinc-650" />
          </div>
          <p className="text-2xl font-black text-white">{statistics?.salesCount || 0}</p>
          <span className="text-[10px] text-zinc-650 font-semibold mt-1 block">Vendas fechadas em live</span>
        </div>

        {/* Total revenue */}
        <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-900 shadow-sm">
          <div className="flex justify-between items-center text-zinc-500 text-xs font-bold uppercase mb-1">
            <span>Receita Gerada</span>
            <DollarSign size={14} className="text-zinc-650" />
          </div>
          <p className="text-2xl font-black text-white">R$ {(statistics?.revenue || 0).toFixed(2)}</p>
          <span className="text-[10px] text-zinc-650 font-semibold mt-1 block">Vendas faturadas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Click Breakdown List */}
        <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-900">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Interesse do Público (Cliques em Produtos)</h4>
          
          {clickedProductsList.length === 0 ? (
            <p className="text-xs text-zinc-600 italic p-4 text-center">
              Sem dados de cliques gravados de momento. Divulgue seu link para receber acessos ativos.
            </p>
          ) : (
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
              {clickedProductsList.map((cp) => (
                <div key={cp.id} className="flex justify-between items-center text-xs p-2 bg-zinc-900/60 rounded-lg border border-zinc-850">
                  <span className="font-medium text-white truncate max-w-[240px]">{cp.name}</span>
                  <span className="font-mono bg-zinc-950 text-red-500 font-bold px-2 py-0.5 rounded border border-red-950">
                    {cp.count} cliques
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coupons used details */}
        <div className="bg-zinc-950 p-5 rounded-xl border border-zinc-900 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Uso de Cupons</h4>
            <div className="flex items-center gap-3 p-4 bg-zinc-900/60 rounded-xl border border-zinc-850">
              <Tag size={24} className="text-green-500" />
              <div>
                <p className="text-xs text-zinc-400 font-semibold">Redenções do Copom Ativo</p>
                <p className="text-xl font-black text-white mt-1">
                  {statistics?.couponsUsed || 0} cupons aplicados no checkout
                </p>
              </div>
            </div>
          </div>
          
          <p className="text-[10px] text-zinc-600 mt-4 leading-relaxed font-medium">
            * As estatísticas são sincronizadas periodicamente conforme as ações tomadas pelos compradores no e-commerce da Boutitque Discreta.
          </p>
        </div>
      </div>
    </div>
  );
}
export default LiveShopAnalyticsTab;
