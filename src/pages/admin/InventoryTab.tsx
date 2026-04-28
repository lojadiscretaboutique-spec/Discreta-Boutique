import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useFeedback } from '../../contexts/FeedbackContext';
import { productService, Product, ProductVariant } from '../../services/productService';
import { stockMovementService } from '../../services/stockMovementService';
import { categoryService } from '../../services/categoryService';
import { Download, Upload, CheckCircle2, AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export function InventoryTab() {
  const { toast } = useFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [processedRows, setProcessedRows] = useState<ProcessedRow[]>([]);
  const [step, setStep] = useState<1 | 2>(1); // 1: Upload, 2: Preview & Confirm

  interface ProcessedRow {
    sku: string;
    gtin: string;
    brand: string;
    name: string;
    subtitle: string;
    fullDescription: string;
    price: number;
    costPrice: number;
    promoPrice: number;
    categoryId?: string;
    stock: number;
    unit: string;
    active: boolean;
    featured: boolean;
    controlStock: boolean;
    allowBackorder: boolean;
    hasVariants: boolean;
    condition: 'new' | 'used';
    imageUrl: string;

    status: 'novo' | 'atualizacao' | 'erro';
    errorMsg?: string;
    productEntity?: Product;
    variantEntity?: ProductVariant;
    diff?: number;
    currentStock?: number;
  }

  const downloadTemplate = async () => {
    try {
      setLoading(true);
      const products = await productService.listProducts();
      
      const rows = products.map((p) => {
        const imageUrl = p.images && p.images.length > 0 
           ? p.images.find(img => img.isMain)?.url || p.images[0].url
           : '';

        return {
          gtin: p.gtin || '',
          sku: p.sku || '',
          brand: p.brand || '',
          name: p.name || '',
          subtitle: p.subtitle || '',
          fullDescription: p.fullDescription || '',
          categoryId: p.categoryId || '',
          costPrice: p.costPrice || 0,
          price: p.price || 0,
          promoPrice: p.promoPrice || '',
          stock: p.stock || 0,
          unit: p.unit || 'un',
          active: p.active !== false,
          featured: p.featured === true,
          controlStock: p.controlStock !== false,
          allowBackorder: p.allowBackorder === true,
          hasVariants: p.hasVariants === true,
          condition: p.seo?.condition || 'new',
          imageUrl: imageUrl
        };
      });

      // Se não houver produtos, colocamos uma linha de exemplo
      if (rows.length === 0) {
        rows.push({
          gtin: '13243435643456',
          sku: 'HL773',
          brand: 'Hot Flowers',
          name: 'Conjunto Anitta Rendado',
          subtitle: 'Hot Love',
          fullDescription: 'descrição completa',
          categoryId: 'Cosméticos',
          costPrice: 17.68,
          price: 119.90,
          promoPrice: 89.90,
          stock: 0,
          unit: 'un',
          active: true,
          featured: true,
          controlStock: true,
          allowBackorder: false,
          hasVariants: false,
          condition: 'new',
          imageUrl: 'https://...'
        });
      }

      const csvContent = Papa.unparse(rows);
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // Added BOM for excel compatibility
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", "inventario_atual.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('Inventário atual baixado com sucesso.', 'success');
    } catch (error) {
      console.error(error);
      toast('Erro ao gerar CSV de produtos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const parseBool = (val: any, defaultVal = false): boolean => {
    if (val === undefined || val === null || val === '') return defaultVal;
    const s = String(val).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'sim' || s === 's' || s === 'yes' || s === 'y';
  };

  const parseNum = (val: any, defaultVal = 0): number => {
    if (val === undefined || val === null || val === '') return defaultVal;
    const n = parseFloat(String(val).replace(',', '.'));
    return isNaN(n) ? defaultVal : n;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
        let content = e.target?.result as string;

        // If the text contains the Unicode replacement character, it's highly likely 
        // a Windows-1252 / ISO-8859-1 file read as UTF-8 (Standard Excel CSV behavior).
        // Let's re-read it with the correct encoding.
        if (content.includes('\uFFFD')) {
            const fallbackReader = new FileReader();
            fallbackReader.onload = (fallbackE) => {
                const fallbackContent = fallbackE.target?.result as string;
                parseCSVString(fallbackContent);
            };
            fallbackReader.readAsText(file, 'ISO-8859-1');
        } else {
            parseCSVString(content);
        }
    };

    reader.readAsText(file, 'UTF-8');

    const parseCSVString = (csvText: string) => {
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                if (results.errors.length > 0) {
                    toast("Erro ao ler algumas linhas do CSV. Verifique a formatação.", "error");
                    console.error(results.errors);
                }
                await processPreview(results.data as any[]);
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (error) => {
                toast("Erro ao processar o arquivo CSV.", "error");
                console.error(error);
            }
        });
    };
  };

  const processPreview = async (csvRows: any[]) => {
    setLoading(true);
    try {
      const allProducts = await productService.listProducts();

      const gtinMap = new Map<string, { product: Product, variant?: ProductVariant }>();

      for (const p of allProducts) {
        if (p.hasVariants) {
          const res = await productService.getProduct(p.id!);
          if (res?.variants) {
             res.variants.forEach(v => {
               const vGtin = ((v as any).gtin || v.barcode || '').trim().toLowerCase();
               if (vGtin) gtinMap.set(vGtin, { product: p, variant: v });
             });
          }
        } else {
          const pGtin = (p.gtin || '').trim().toLowerCase();
          if (pGtin) gtinMap.set(pGtin, { product: p });
        }
      }

      const rows: ProcessedRow[] = [];

      for (let i = 0; i < csvRows.length; i++) {
        const row = csvRows[i];
        
        const rawGtin = row['gtin'] || row['GTIN'] || '';
        const gtin = String(rawGtin).trim();
        
        const rawSku = row['sku'] || row['SKU'] || '';
        const sku = String(rawSku).trim();
        const name = String(row['name'] || row['Nome'] || '').trim();
        
        if (!gtin) {
           rows.push({ sku, gtin: '', brand: '', name: name || 'N/A', subtitle: '', fullDescription: '', price: 0, costPrice: 0, promoPrice: 0, stock: 0, unit: 'un', active: true, featured: false, controlStock: true, allowBackorder: false, hasVariants: false, condition: 'new', imageUrl: '', status: 'erro', errorMsg: 'GTIN ausente.' });
           continue;
        }

        const parsedRow: ProcessedRow = {
          sku,
          gtin,
          brand: String(row['brand'] || row['Brand'] || row['Marca'] || '').trim(),
          name,
          subtitle: String(row['subtitle'] || '').trim(),
          fullDescription: String(row['fullDescription'] || '').trim(),
          price: parseNum(row['price'], 0),
          costPrice: parseNum(row['costPrice'], 0),
          promoPrice: parseNum(row['promoPrice'], 0),
          categoryId: String(row['categoryId'] || row['Categoria'] || '').trim(),
          stock: parseNum(row['stock'] || row['Estoque Contado'] || row['Estoque'], 0),
          unit: String(row['unit'] || 'un').trim(),
          active: parseBool(row['active'] || row['Active'], true),
          featured: parseBool(row['featured'] || row['Featured'], false),
          controlStock: parseBool(row['controlStock'] || row['ControlStock'], true),
          allowBackorder: parseBool(row['allowBackorder'] || row['AllowBackorder'], false),
          hasVariants: parseBool(row['hasVariants'] || row['HasVariants'], false),
          condition: String(row['condition'] || 'new').trim().toLowerCase() === 'used' ? 'used' : 'new',
          imageUrl: String(row['imageUrl'] || row['images'] || row['url'] || '').trim(),
          status: 'novo'
        };

        const exactGtinLower = gtin.toLowerCase();
        const match = gtinMap.get(exactGtinLower);

        if (match) {
           parsedRow.currentStock = match.variant ? match.variant.stock : match.product.stock;
           parsedRow.diff = parsedRow.stock - parsedRow.currentStock;
           parsedRow.status = 'atualizacao';
           parsedRow.productEntity = match.product;
           parsedRow.variantEntity = match.variant;
           
           if (!parsedRow.name && match.product.name) {
               parsedRow.name = match.product.name;
           }
        } else {
           if (!name) {
             parsedRow.status = 'erro';
             parsedRow.errorMsg = 'Nome ausente para novo produto.';
           } else {
             parsedRow.diff = parsedRow.stock;
             parsedRow.currentStock = 0;
           }
        }

        rows.push(parsedRow);
      }

      setProcessedRows(rows);
      setStep(2);
    } catch (error) {
      console.error(error);
      toast("Erro ao cruzar dados do CSV com o sistema.", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirmInventory = async () => {
    setLoading(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      let defaultCategoryId = '';
      const categories = await categoryService.listCategories();
      if (categories.length > 0) {
        defaultCategoryId = categories[0].id;
      } else {
        defaultCategoryId = await categoryService.createCategory({
          name: "Inventário Geral",
          slug: "inventario-geral",
          parentId: null,
          level: 0,
          sortOrder: 0,
          isActive: true,
          isFeatured: false,
          showInMenu: false,
          showInHome: false,
          productCount: 0
        } as any);
      }

      const toProcess = processedRows.filter(r => r.status !== 'erro');

      for (const row of toProcess) {
        try {
          if (row.status === 'atualizacao') {
             
             // Update standard fields for the base Product based on the CSV row
             if (row.productEntity?.id) {
                 const pRef = doc(db, 'products', row.productEntity.id);
                 const updatePayload: any = {
                   active: row.active,
                   allowBackorder: row.allowBackorder,
                   controlStock: row.controlStock,
                   hasVariants: row.hasVariants,
                   featured: row.featured
                 };

                 if (row.name) updatePayload.name = row.name;
                 if (row.gtin) updatePayload.gtin = row.gtin;
                 if (row.brand) updatePayload.brand = row.brand;
                 if (row.subtitle) updatePayload.subtitle = row.subtitle;
                 if (row.fullDescription) updatePayload.fullDescription = row.fullDescription;
                 
                 if (row.categoryId) {
                     const matchedCat = categories.find(c => c.name.toLowerCase() === row.categoryId!.toLowerCase() || c.id === row.categoryId);
                     if (matchedCat) {
                         updatePayload.categoryId = matchedCat.id;
                     } else {
                         const newCatId = await categoryService.createCategory({
                             name: row.categoryId,
                             slug: row.categoryId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                             parentId: null,
                             level: 0,
                             sortOrder: 0,
                             isActive: true,
                             isFeatured: false,
                             showInMenu: true,
                             showInHome: false,
                             productCount: 0
                         } as any);
                         updatePayload.categoryId = newCatId;
                         categories.push({ id: newCatId, name: row.categoryId } as any);
                     }
                 }

                 if (row.costPrice > 0) updatePayload.costPrice = row.costPrice;
                 if (row.price > 0) updatePayload.price = row.price;
                 if (row.promoPrice > 0) updatePayload.promoPrice = row.promoPrice;
                 if (row.unit) updatePayload.unit = row.unit;
                 if (row.condition) updatePayload['seo.condition'] = row.condition;
                 
                 // Overwrite or append the main image from CSV
                 if (row.imageUrl) {
                     const existingImages = row.productEntity.images || [];
                     const alreadyHasThisUrl = existingImages.some(img => img.url === row.imageUrl);
                     if (!alreadyHasThisUrl) {
                        updatePayload.images = [{ url: row.imageUrl, path: `products/imported_${row.gtin}_${Date.now()}`, isMain: true }];
                     }
                 }

                 await updateDoc(pRef, updatePayload);
                 
                 // If the item specifically matched a variant, we update the price on the variant as well
                 if (row.variantEntity?.id) {
                    const vRef = doc(db, `products/${row.productEntity.id}/variants`, row.variantEntity.id);
                    const vPayload: any = {};
                    if (row.price > 0) vPayload.price = row.price;
                    if (row.promoPrice > 0) vPayload.promoPrice = row.promoPrice;
                    if (Object.keys(vPayload).length > 0) {
                      await updateDoc(vRef, vPayload);
                    }
                 }
             }

             // Register Stock Movement if there is diff (which naturally updates the product/variant 'stock' property safely)
             if (row.diff !== 0) {
               await stockMovementService.registerMovement({
                 productId: row.productEntity!.id!,
                 productName: row.productEntity!.name,
                 variantId: row.variantEntity?.id,
                 variantName: row.variantEntity?.name,
                 sku: row.sku,
                 type: row.diff! > 0 ? 'in' : 'out',
                 quantity: Math.abs(row.diff!),
                 reason: row.diff! > 0 ? 'inventario_positivo' : 'ajuste_negativo',
                 channel: 'N/A',
                 notes: 'Ajuste via Planilha de Inventário CSV',
               });
             }
             successCount++;
          } else if (row.status === 'novo') {
             let resolvedCategoryId = defaultCategoryId;
             if (row.categoryId) {
                 const matchedCat = categories.find(c => c.name.toLowerCase() === row.categoryId!.toLowerCase() || c.id === row.categoryId);
                 if (matchedCat) {
                     resolvedCategoryId = matchedCat.id;
                 } else {
                     const newCatId = await categoryService.createCategory({
                         name: row.categoryId,
                         slug: row.categoryId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                         parentId: null,
                         level: 0,
                         sortOrder: 0,
                         isActive: true,
                         isFeatured: false,
                         showInMenu: true,
                         showInHome: false,
                         productCount: 0
                     } as any);
                     resolvedCategoryId = newCatId;
                     categories.push({ id: newCatId, name: row.categoryId } as any);
                 }
             }

             const newProduct: any = {
               name: row.name,
               sku: row.sku,
               gtin: row.gtin,
               brand: row.brand,
               subtitle: row.subtitle,
               fullDescription: row.fullDescription,
               price: row.price || 0,
               costPrice: row.costPrice || 0,
               promoPrice: row.promoPrice || 0,
               categoryId: resolvedCategoryId,
               active: row.active,
               featured: row.featured,
               newRelease: false,
               stock: 0, // Starts at 0, initialized via stockMovementService below cleanly
               controlStock: row.controlStock,
               allowBackorder: row.allowBackorder,
               hasVariants: row.hasVariants,
               unit: row.unit || 'un',
               images: row.imageUrl ? [{ url: row.imageUrl, path: `products/imported_${row.gtin}_${Date.now()}`, isMain: true }] : [],
               seo: {
                 slug: row.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''),
                 condition: row.condition || 'new'
               }
             };
             
             const createdId = await productService.createProduct(newProduct, []);
             
             if (row.stock > 0) {
               await stockMovementService.registerMovement({
                 productId: createdId,
                 productName: row.name,
                 sku: row.sku,
                 type: 'in',
                 quantity: row.stock,
                 reason: 'inventario_positivo',
                 channel: 'N/A',
                 notes: 'Entrada Inicial via Planilha de Inventário CSV',
               });
             }
             successCount++;
          }
        } catch (itemErr) {
          console.error("Item Error:", row.sku, itemErr);
          errorCount++;
        }
      }

      if (errorCount === 0) {
         toast(`Inventário concluído! ${successCount} intens processados com sucesso.`, 'success');
      } else {
         toast(`Inventário processado com alguns erros. Sucessos: ${successCount}, Erros: ${errorCount}.`, 'warning');
      }
      
      setStep(1);
      setProcessedRows([]);
    } catch (error) {
      console.error(error);
      toast("Ocorreu um erro fatal durante a importação.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 p-4 md:p-6 rounded-2xl border shadow-sm w-full overflow-hidden">
      {step === 1 && (
        <div className="space-y-8">
          <div className="flex flex-col items-center justify-center p-12 bg-slate-800 border-2 border-dashed border-slate-700 rounded-3xl gap-6">
            <div className="w-20 h-20 bg-slate-950 rounded-full flex items-center justify-center text-slate-400">
               <Upload size={32} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-bold text-slate-100">Faça o upload do seu inventário</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Envie um arquivo CSV com as colunas completas. O sistema atualizará automaticamente os dados/estoque dos itens existentes, e criará como novo os não existentes.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-4 mt-2">
              <Button disabled={loading} variant="outline" onClick={downloadTemplate} className="h-12 px-6 rounded-xl font-bold border-green-600 text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800 w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap">
                 {loading ? <RefreshCcw className="mr-2 animate-spin" size={18} /> : <Download className="mr-2" size={18} />}
                 Baixar Modelo CSV
              </Button>
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                className="h-12 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap"
                disabled={loading}
              >
                 {loading ? <RefreshCcw className="mr-2 animate-spin" size={18} /> : <Upload className="mr-2" size={18} />}
                 {loading ? 'Processando CSV...' : 'Selecionar Arquivo'}
              </Button>
              <input 
                type="file" 
                accept=".csv" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
              />
            </div>
          </div>
          
          <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50">
            <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
               <AlertCircle size={18} className="text-blue-500" /> Colunas Suportadas no CSV (Mantenha o cabeçalho idêntico)
            </h4>
            <div className="text-sm text-blue-800 opacity-80 grid md:grid-cols-2 gap-4 mt-4">
              <ul className="space-y-1 list-disc pl-5">
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">gtin</code> <span className="opacity-70">(Obrigatório - Código de Barras / Chave de Busca)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">sku</code> <span className="opacity-70">(Opcional - Código interno)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">brand</code> <span className="opacity-70">(Marca)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">name</code> <span className="opacity-70">(Obrigatório para item novo)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">price</code> <span className="opacity-70">(0.00 Decimal ponto)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">costPrice</code> <span className="opacity-70">(Custo Decimal ponto)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">promoPrice</code> <span className="opacity-70">(Promo Decimal ponto)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">stock</code> <span className="opacity-70">(Saldo Final contado em estoque)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">active</code> <span className="opacity-70">(true / false)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">featured</code> <span className="opacity-70">(true / false)</span></li>
              </ul>
              <ul className="space-y-1 list-disc pl-5">
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">controlStock</code> <span className="opacity-70">(true / false)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">allowBackorder</code> <span className="opacity-70">(true / false)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">hasVariants</code> <span className="opacity-70">(true / false)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">unit</code> <span className="opacity-70">("un", "g", "kg"...)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">condition</code> <span className="opacity-70">("new" ou "used")</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">imageUrl</code> <span className="opacity-70">(Link HTTP direto Ex: Firebasestorage)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">subtitle</code> <span className="opacity-70">(Texto Subtítulo)</span></li>
                <li><code className="bg-slate-900/50 px-1.5 py-0.5 rounded font-bold">fullDescription</code> <span className="opacity-70">(Texto Descrição Completa)</span></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-bold text-slate-100">Revisão do Inventário</h3>
              <p className="text-slate-400 text-sm">Validamos os dados do seu arquivo. Revise as alterações abaixo antes de aplicar em lote.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} disabled={loading} className="font-bold border-slate-600">
                Cancelar e Voltar
              </Button>
              <Button onClick={confirmInventory} disabled={loading || processedRows.every(r => r.status === 'erro')} className="font-bold bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-900/10">
                {loading ? <RefreshCcw className="mr-2 animate-spin" size={18} /> : <CheckCircle2 className="mr-2" size={18} />}
                {loading ? 'Aplicando no Sistema...' : 'Confirmar Lote de Importação'}
              </Button>
            </div>
          </div>

          <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900 w-full">
            <div className="max-h-[500px] overflow-auto w-full">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                <thead className="bg-slate-800 sticky top-0 border-b border-slate-700 shadow-sm z-10">
                  <tr>
                    <th className="px-5 py-4 font-bold text-slate-300 uppercase tracking-wider text-[11px]">Ação / Status</th>
                    <th className="px-5 py-4 font-bold text-slate-300 uppercase tracking-wider text-[11px]">GTIN</th>
                    <th className="px-5 py-4 font-bold text-slate-300 uppercase tracking-wider text-[11px]">SKU</th>
                    <th className="px-5 py-4 font-bold text-slate-300 uppercase tracking-wider text-[11px]">Produto Atualizado</th>
                    <th className="px-5 py-4 font-bold text-slate-300 uppercase tracking-wider text-[11px]">Preço Informado</th>
                    <th className="px-5 py-4 font-bold text-slate-300 uppercase tracking-wider text-[11px] text-right">Ajuste Estoque</th>
                    <th className="px-5 py-4 font-bold text-slate-300 uppercase tracking-wider text-[11px] text-right">Novo Estoque</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800">
                      <td className="px-5 py-3">
                         {row.status === 'novo' && <span className="px-2 py-1 bg-purple-100 text-purple-700 font-bold text-[10px] rounded uppercase tracking-widest">Criará Novo Produto</span>}
                         {row.status === 'atualizacao' && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 font-bold text-[10px] rounded uppercase tracking-widest">Atualizará Existente</span>}
                         {row.status === 'erro' && <span className="px-2 py-1 bg-red-100 text-red-700 font-bold text-[10px] rounded uppercase tracking-widest">Inválido</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-300 font-bold">{row.gtin || '-'}</td>
                      <td className="px-5 py-3 font-mono text-slate-300 font-bold">{row.sku || '-'}</td>
                      <td className="px-5 py-3 text-slate-100">
                        <div className="font-semibold">{row.name}</div>
                        {row.errorMsg && <div className="text-xs text-red-500 font-bold mt-0.5">{row.errorMsg}</div>}
                      </td>
                      <td className="px-5 py-3 text-slate-300 font-mono text-xs">
                         {row.status !== 'erro' ? row.price.toFixed(2) : '-'}
                      </td>
                      <td className="px-5 py-3 text-right">
                         {row.status !== 'erro' && row.diff !== undefined ? (
                           <span className={row.diff > 0 ? "text-emerald-600 font-bold" : row.diff < 0 ? "text-red-500 font-bold" : "text-slate-400"}>
                             {row.diff > 0 ? '+' : ''}{row.diff}
                           </span>
                         ) : '-'}
                      </td>
                      <td className="px-5 py-3 text-right font-black text-white">
                         {row.status !== 'erro' ? row.stock : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-800 p-4 border-t border-slate-700 flex items-center justify-between text-sm">
               <div className="text-slate-400 font-medium">Total de registros lidos: <span className="font-bold text-slate-100">{processedRows.length}</span></div>
               <div className="flex gap-4">
                  <span className="text-slate-400 font-medium"><span className="text-emerald-600 font-bold">{processedRows.filter(r => r.status === 'atualizacao').length}</span> atualizados</span>
                  <span className="text-slate-400 font-medium"><span className="text-purple-600 font-bold">{processedRows.filter(r => r.status === 'novo').length}</span> criações</span>
                  <span className="text-slate-400 font-medium"><span className="text-red-500 font-bold">{processedRows.filter(r => r.status === 'erro').length}</span> erros</span>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
