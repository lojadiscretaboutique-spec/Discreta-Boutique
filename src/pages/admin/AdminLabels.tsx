import React, { useState, useEffect, useRef } from 'react';
import { Package, Search, Plus, Trash2, Printer } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { productService, ProductVariant } from '../../services/productService';
import { Product } from '../../types/catalog';
import JsBarcode from 'jsbarcode';
import { collectionGroup, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface LabelItem {
  id: string; // unique ID for the list
  product: Product;
  quantity: number;
}

export function AdminLabels() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<LabelItem[]>([]);
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  useEffect(() => {
    loadProducts();
    
    // Check for pending items from purchases
    const pending = localStorage.getItem('pending_labels');
    if (pending) {
      try {
        const items = JSON.parse(pending);
        if (Array.isArray(items)) {
          setSelectedItems(prev => [...prev, ...items]);
          localStorage.removeItem('pending_labels');
        }
      } catch (e) {
        console.error("Error parsing pending labels", e);
      }
    }
  }, []);

  const loadProducts = async () => {
    try {
      const data = await productService.listProducts();
      
      const allItems: Product[] = [];
      
      for (const p of data) {
        if (!p.hasVariants) {
          allItems.push(p);
        }
      }
      
      // Load all variants to show them in label selection since variants need barcode printing
      const vSnap = await getDocs(collectionGroup(db, 'variants'));
      vSnap.docs.forEach(doc => {
         const v = doc.data() as ProductVariant;
         allItems.push({
           id: doc.id,
           name: v.name,
           sku: v.sku,
           gtin: v.barcode || '',
           price: v.price || v.promoPrice || 0,
           active: v.active,
           images: v.imageUrl ? [{url: v.imageUrl, path: '', isMain: true}] : [],
           categoryId: 'variant',
           slug: 'variant',
         } as unknown as Product);
      });
      
      /* 
        Optional mock product kept as example:
      const mockProduct: Product = {
        id: 'mock-123',
        ...
      }; 
      */
      
      setProducts(allItems);
    } catch (error) {
      console.error('Error loading products', error);
      if (error instanceof Error && error.message.includes('index')) {
        console.warn("Index needed for collectionGroup variants.", error.message);
      }
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.gtin && p.gtin.includes(searchTerm))
  ).slice(0, 10); // show only top 10 results for auto-complete feel

  const handleAddProduct = (product: Product) => {
    if (selectedQuantity < 1) return;
    const existing = selectedItems.find(item => item.product.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.product.id === product.id 
          ? { ...item, quantity: item.quantity + selectedQuantity }
          : item
      ));
    } else {
      setSelectedItems([...selectedItems, { id: Math.random().toString(), product, quantity: selectedQuantity }]);
    }
    // Optional: reset search
    // setSearchTerm('');
    // setSelectedQuantity(1);
  };

  const handleRemoveProduct = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const handlePrint = () => {
    window.print();
  };

  // Generate the actual items to print by duplicating based on quantity
  const labelsToPrint = selectedItems.flatMap(item => 
    Array.from({ length: item.quantity }, () => item.product)
  );

  return (
    <>
      {/* 
        This is the main UI. 
        It is hidden when printing via "print:hidden" class. 
      */}
      <div className="p-6 space-y-6 max-w-7xl mx-auto print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-100">
              <Package size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Impressão de Etiquetas</h1>
              <p className="text-sm text-slate-500">Gere e imprima etiquetas térmicas 50x80mm em 2 colunas</p>
            </div>
          </div>
          <Button 
            onClick={handlePrint}
            disabled={selectedItems.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-12 px-6 rounded-xl"
          >
            <Printer className="mr-2" size={20} />
            Imprimir {labelsToPrint.length > 0 && `(${labelsToPrint.length})`}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
           {/* Section 1: Selection */}
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
             <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Adicionar Etiquetas</h2>
             
             <div className="space-y-4">
                <div>
                   <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 block mb-2">Buscar Produto</label>
                   <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Nome, SKU ou Código de Barras"
                        className="pl-10 h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                      />
                   </div>
                </div>

                {searchTerm.length > 1 && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2 max-h-[300px] overflow-y-auto space-y-2">
                     {filteredProducts.map(product => (
                        <div key={product.id} className="bg-white dark:bg-slate-900 p-3 flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700">
                           <div className="overflow-hidden mr-2">
                             <div className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">{product.name}</div>
                             <div className="text-xs text-slate-500">SKU: {product.sku || 'N/A'} | Preço: R$ {(product.price || 0).toFixed(2).replace('.', ',')}</div>
                           </div>
                           <div className="flex items-center gap-2 flex-shrink-0">
                             <Input 
                                type="number" 
                                min="1" 
                                className="w-16 h-9 text-center" 
                                value={selectedQuantity}
                                onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                             />
                             <Button size="sm" onClick={() => handleAddProduct(product)} className="h-9 w-9 p-0 bg-slate-900 text-white rounded-lg hover:bg-slate-800">
                                <Plus size={16} />
                             </Button>
                           </div>
                        </div>
                     ))}
                     {filteredProducts.length === 0 && (
                        <div className="text-center p-4 text-slate-500 text-sm">Nenhum produto encontrado.</div>
                     )}
                  </div>
                )}
             </div>
           </div>

           {/* Section 2: Selected List */}
           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col h-full">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Etiquetas Selecionadas</h2>
                {selectedItems.length > 0 && (
                   <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg text-xs">
                     Total: {labelsToPrint.length}
                   </span>
                )}
             </div>

             <div className="flex-1 overflow-y-auto space-y-3">
                {selectedItems.map(item => (
                   <div key={item.id} className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50">
                     <div className="overflow-hidden">
                       <span className="font-semibold block truncate text-sm text-slate-800 dark:text-slate-200">{item.product.name}</span>
                       <span className="text-xs text-slate-500">Qtd: {item.quantity} | SKU: {item.product.sku}</span>
                     </div>
                     <button onClick={() => handleRemoveProduct(item.id)} className="text-red-500 hover:text-red-700 p-2 flex-shrink-0">
                        <Trash2 size={18} />
                     </button>
                   </div>
                ))}

                {selectedItems.length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                    <Package size={40} className="mb-2 opacity-20" />
                    <p className="text-sm">Nenhuma etiqueta na fila</p>
                  </div>
                )}
             </div>
           </div>
        </div>
      </div>

      {/* 
        This is the print output.
        It is hidden on screen and only visible during print.
      */}
      <div className="hidden print:block print:w-[100mm] print:m-0 print:p-0">
        <div className="print-label-grid">
           {labelsToPrint.map((prod, index) => {
              return (
              <div key={index} className="print-label flex flex-col items-center justify-start text-center overflow-hidden break-inside-avoid relative">
                {/* Punch Hole Representation */}
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-black" />
                
                <div className="label-brand text-black mt-3">DISCRETA</div>
                <div className="w-full flex flex-col justify-start items-center overflow-hidden h-[32mm]">
                   <div className="label-title text-black leading-[1.1] w-full px-1">{prod.name}</div>
                   <div className="label-sku text-black leading-none mt-3 truncate w-full">{prod.sku || 'UN'}</div>
                </div>

                <div className="w-full flex object-contain items-center justify-center mt-3">
                  <Barcode value={prod.gtin || prod.sku || String(Math.floor(Math.random() * 1000000000))} />
                </div>
                
                <div className="w-full label-price font-normal text-black leading-none mt-auto mb-2">
                   R$ {(prod.price || 0).toFixed(2).replace('.', ',')}
                </div>
              </div>
              );
           })}
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            @page {
              margin: 0;
              size: 100mm auto;
            }
            body {
              margin: 0 !important;
              padding: 0 !important;
              background-color: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            * {
               box-sizing: border-box;
               -webkit-print-color-adjust: exact;
            }
            .print-label-grid {
              display: grid;
              grid-template-columns: 49mm 49mm;
              width: 100mm;
              margin: 0;
              padding: 0;
              gap: 0;
            }
            .print-label {
              width: 49mm;
              height: 80mm;
              padding: 10mm 2mm 2mm 2mm;
              background-color: white;
              page-break-inside: avoid;
              break-inside: avoid;
              border: 0.5mm dashed #000;
              position: relative;
            }
            .label-brand {
              font-family: Arial, Helvetica, sans-serif;
              font-weight: 900;
              font-size: 18px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #000;
              margin-bottom: 3mm;
              line-height: 1;
            }
            .label-title {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
              font-weight: 700;
              color: #000;
              display: -webkit-box;
              -webkit-line-clamp: 4;
              -webkit-box-orient: vertical;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-sku {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              font-weight: 700;
              color: #000;
            }
            .label-price {
              font-family: Arial, Helvetica, sans-serif;
              font-size: 24px;
              letter-spacing: -1px;
              font-weight: 700;
              color: #000;
            }
            svg {
              max-width: 95%;
              height: auto;
              display: block;
            }
          }
        `}} />
      </div>
    </>
  );
}

// A helper component to generate SVG barcode using pure JS within React
function Barcode({ value }: { value: string }) {
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeRef.current && value) {
      let format = "CODE128";
      const onlyNumbers = /^\d+$/.test(value);
      if (onlyNumbers && (value.length === 12 || value.length === 13)) {
        format = "EAN13";
      }

      try {
        JsBarcode(barcodeRef.current, value, {
          format,
          displayValue: true,
          width: 1.3,
          height: 38,
          fontSize: 12,
          font: "Arial, Helvetica, sans-serif",
          textMargin: 3,
          margin: 0,
          background: "transparent",
          lineColor: "#000",
          valid: function (valid: boolean) {
            // EAN13 might be invalid due to checksum, fallback to code128 if so
            if (!valid && format === "EAN13") {
              try {
                JsBarcode(barcodeRef.current, value, {
                  format: "CODE128",
                  displayValue: true,
                  width: 1.3,
                  height: 38,
                  fontSize: 12,
                  font: "Arial, Helvetica, sans-serif",
                  textMargin: 3,
                  margin: 0,
                  background: "transparent",
                  lineColor: "#000",
                });
              } catch(e) {}
            }
          }
        });
      } catch (errBarcode) {
        // Fallback to code 128 if EAN13 throws explicitly
        try {
          JsBarcode(barcodeRef.current, value, {
             format: "CODE128",
             displayValue: true,
             width: 1.3,
             height: 38,
             fontSize: 12,
             font: "Arial, Helvetica, sans-serif",
             textMargin: 3,
             margin: 0,
             background: "transparent",
             lineColor: "#000",
          });
        } catch (eFinal) {
          console.error("Barcode generation error");
        }
      }
    }
  }, [value]);

  return <svg ref={barcodeRef} style={{ maxWidth: '100%' }}></svg>;
}
