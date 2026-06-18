import React, { useState, useMemo } from 'react';
import { Plus, Search, ShoppingBag, Trash2, CheckCircle2, Star } from 'lucide-react';
import { LiveProduct } from '../../../../../types/liveShop';
import { Product } from '../../../../../services/productService';
import { Input } from '../../../../../components/ui/input';
import { Button } from '../../../../../components/ui/button';
import { cn } from '../../../../../lib/utils';
import { useFeedback } from '../../../../../contexts/FeedbackContext';

interface Props {
  storeProducts: Product[];
  linkedProducts: LiveProduct[];
  setLinkedProducts: (p: LiveProduct[]) => void;
}

export function LiveShopProductsTab({ storeProducts, linkedProducts, setLinkedProducts }: Props) {
  const { toast } = useFeedback();

  // Search parameters for linking
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customLivePrice, setCustomLivePrice] = useState('');
  const [customSelo, setCustomSelo] = useState('Oferta da Live');
  const [customPromoText, setCustomPromoText] = useState('');

  // Performance Optimization: Restrict listed products to avoid massive DOM trees (demand loading)
  const processedMatches = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    
    if (!query) {
      // Return first 10 items only to keep rendering fast initially
      return storeProducts.slice(0, 10);
    }

    return storeProducts.filter(p => {
      return (
        p.name?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query) ||
        p.internalCode?.toLowerCase().includes(query) ||
        p.gtin?.toLowerCase().includes(query)
      );
    }).slice(0, 15); // limit output length to 15 items to prevent DOM chokes
  }, [storeProducts, productQuery]);

  // Actions
  const handleAddProduct = () => {
    if (!selectedProductId) {
      toast('Selecione um produto correspondente no catálogo!', 'warning');
      return;
    }

    if (linkedProducts.some(p => p.productId === selectedProductId)) {
      toast('Este produto já está adicionado a esta lista de live!', 'warning');
      return;
    }

    const priceNum = customLivePrice ? parseFloat(customLivePrice) : undefined;
    
    // Create new linked entry
    const newEntry: LiveProduct = {
      productId: selectedProductId,
      livePrice: isNaN(priceNum as number) ? undefined : priceNum,
      seloEspecial: customSelo || undefined,
      textPromocional: customPromoText.trim() || undefined,
      featured: linkedProducts.length === 0, // Destaque first item if empty sequence
      order: linkedProducts.length + 1
    };

    setLinkedProducts([...linkedProducts, newEntry]);
    
    // Clear item selector
    setSelectedProductId('');
    setCustomLivePrice('');
    setCustomPromoText('');
    setProductQuery('');
    toast('Produto anexado com preço promocional exclusivo!', 'success');
  };

  const handleRemoveProduct = (pId: string) => {
    setLinkedProducts(linkedProducts.filter(p => p.productId !== pId));
    toast('Produto desvinculado do evento.', 'success');
  };

  const handleMakeFeatured = (pId: string) => {
    setLinkedProducts(linkedProducts.map(p => ({
      ...p,
      featured: p.productId === pId
    })));
    toast('Produto definido como destaque de vendas ao vivo!', 'success');
  };

  return (
    <div className="space-y-6" id="liveshop-products-tab">
      {/* Product Add Row */}
      <div className="bg-zinc-950/60 p-5 rounded-xl border border-zinc-800 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Plus className="w-4 h-4 text-red-500" /> Vincular Produto do Catálogo à Live
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          {/* Query input and Dropdown selector */}
          <div className="sm:col-span-1 md:col-span-2 space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs text-zinc-400">Buscar Produto *</label>
              {productQuery && (
                <button 
                  type="button" 
                  onClick={() => setProductQuery('')}
                  className="text-[10px] text-red-500 hover:underline"
                >
                  Limpar Pesquisa
                </button>
              )}
            </div>

            <Input
              type="text"
              placeholder="Digite o nome, SKU ou Código de barras..."
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-xs h-9 text-white placeholder-zinc-500"
            />

            <select
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2 text-sm focus:outline-none focus:border-red-600 h-10"
            >
              <option value="">
                {processedMatches.length === 0 
                  ? '-- Nenhum resultado localizado --' 
                  : `-- Selecione o Item correspondente (${processedMatches.length}) --`}
              </option>
              {processedMatches.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.sku ? `(SKU: ${p.sku})` : ''} - R$ {p.price.toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          {/* Special Price */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Preço com Oferta Live (R$)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="Vazio = Preço de catálogo"
              value={customLivePrice}
              onChange={e => setCustomLivePrice(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-sm h-10"
            />
          </div>

          {/* Special Badge/Selo */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Badge / Selo da Live</label>
            <select
              value={customSelo}
              onChange={e => setCustomSelo(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-lg p-2 text-sm focus:outline-none h-10"
            >
              <option value="">Sem Selo</option>
              <option value="Oferta da Live">Oferta da Live</option>
              <option value="Promoção Relâmpago">Promoção Relâmpago</option>
              <option value="Últimas Unidades">Últimas Unidades</option>
              <option value="Exclusivo">Exclusivo</option>
            </select>
          </div>

          {/* Promotional description */}
          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-xs text-zinc-400 mb-1">Texto de Apelo Comercial (Ex: Brinde exclusivo na compra!)</label>
            <Input
              placeholder="Digite frases chaves de incentivo para venda..."
              value={customPromoText}
              onChange={e => setCustomPromoText(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-sm"
            />
          </div>

          <div>
            <Button
              type="button"
              onClick={handleAddProduct}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-10 text-xs text-center"
            >
              Anexar à Transmissão
            </Button>
          </div>
        </div>
      </div>

      {/* Linked Products View List */}
      <div>
        <h3 className="text-sm font-black uppercase text-zinc-400 mb-3 tracking-wider">Produtos já Vinculados</h3>
        
        {linkedProducts.length === 0 ? (
          <div className="bg-zinc-950 p-8 rounded-xl border border-zinc-800/40 text-center text-zinc-500 text-sm">
            Nenhum produto vinculado ainda. Faça uma busca no painel acima para associar ofertas.
          </div>
        ) : (
          <div className="space-y-3">
            {linkedProducts.map((lp, idx) => {
              const original = storeProducts.find(p => p.id === lp.productId);
              return (
                <div 
                  key={lp.productId}
                  className={cn(
                    "p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all",
                    lp.featured ? "bg-red-950/10 border-red-900/40 shadow-sm" : "bg-zinc-950 border-zinc-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded bg-zinc-900 overflow-hidden border border-zinc-800 flex items-center justify-center shrink-0">
                      {original?.images?.[0]?.url ? (
                        <img src={original.images[0].url} alt={original.name} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-5 h-5 text-zinc-700" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm flex items-center gap-2">
                        {original?.name || 'Item Removido do Catálogo'}
                        {lp.featured && (
                          <span className="text-[9px] bg-red-600 font-bold px-2 py-0.5 rounded text-white uppercase tracking-wider flex items-center gap-1">
                            <Star size={8} className="fill-white" /> Destaque Ativo
                          </span>
                        )}
                      </h4>
                      <span className="text-xs text-zinc-500">
                        Preço original: R$ {original?.price?.toFixed(2) || '--'} {original?.sku ? `| SKU: ${original.sku}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Prices & Badges info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                      <span className="text-zinc-500 block text-[9px] uppercase font-bold">Valor na Live</span>
                      <span className="font-bold text-white">
                        R$ {lp.livePrice !== undefined ? lp.livePrice.toFixed(2) : original?.price?.toFixed(2) || '--'}
                      </span>
                    </div>

                    {lp.seloEspecial && (
                      <div className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                        <span className="text-zinc-500 block text-[9px] uppercase font-bold">Badge</span>
                        <span className="font-semibold text-yellow-500">{lp.seloEspecial}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleMakeFeatured(lp.productId)}
                      className={cn(
                        "text-xs font-semibold px-3 py-1.5 h-8 rounded-md transition-all",
                        lp.featured ? "text-red-500 bg-red-950/20" : "text-zinc-400 hover:text-white"
                      )}
                    >
                      {lp.featured ? 'Sendo Exibido' : 'Fixar no Vídeo'}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleRemoveProduct(lp.productId)}
                      className="bg-transparent hover:bg-red-950/40 text-zinc-500 hover:text-red-500 p-2 h-8 rounded"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
export default LiveShopProductsTab;
