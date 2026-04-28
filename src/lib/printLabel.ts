import JsBarcode from 'jsbarcode';
import { Product } from '../services/productService';

export const printProductLabel = (product: Product) => {
  // Remover os antigos se existirem
  document.getElementById('print-area')?.remove();
  document.getElementById('print-style')?.remove();

  const canvas = document.createElement('canvas');
  let barcodeDataUrl = '';
  
  if (product.gtin) {
    try {
        // Try EAN13 first
        JsBarcode(canvas, String(product.gtin).trim(), {
            format: "EAN13", 
            displayValue: false,
            height: 40,
            margin: 0,
            background: '#ffffff',
            lineColor: '#000000',
        });
        barcodeDataUrl = canvas.toDataURL('image/png');
    } catch {
       try {
           // Fallback to CODE128
           JsBarcode(canvas, String(product.gtin).trim(), {
               format: "CODE128",
               displayValue: false,
               height: 40,
               margin: 0,
           });
           barcodeDataUrl = canvas.toDataURL('image/png');
       } catch (e) {
           console.error("Barcode generation failed", e);
       }
    }
  }

  const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price || 0);

  const style = document.createElement('style');
  style.id = 'print-style';
  style.innerHTML = `
    @media print {
      body * {
        visibility: hidden;
      }
      #print-area, #print-area * {
        visibility: visible;
      }
      #print-area {
        position: absolute;
        left: 0;
        top: 0;
        width: 80mm;
        height: 50mm;
        margin: 0;
        padding: 2mm 5mm;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        background: white;
        color: black;
        overflow: hidden;
        font-family: Arial, Helvetica, sans-serif;
      }
      @page {
        size: 80mm 50mm;
        margin: 0;
      }
      * {
         -webkit-print-color-adjust: exact !important;
         color-adjust: exact !important;
      }
    }
    
    #print-area {
       display: none;
    }
    
    @media print {
       #print-area {
          display: flex;
       }
    }
    
    #print-area .name {
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 1px;
      line-height: 1.1;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      width: 100%;
    }
    #print-area .sku {
      font-size: 20px;
      text-align: center;
      margin-bottom: 2px;
      font-weight: bold;
    }
    #print-area .barcode-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex-grow: 1;
      justify-content: center;
      margin-top: 1px;
      margin-bottom: 1px;
    }
    #print-area .barcode-img {
      height: 14mm;
      width: auto;
      max-width: 65mm;
      display: block;
    }
    #print-area .gtin {
      font-size: 10px;
      text-align: center;
      margin-top: 1px;
      letter-spacing: 1px;
    }
    #print-area .price {
      font-size: 38px;
      font-weight: 900;
      text-align: center;
      margin-top: 1px;
      margin-bottom: 0px;
      line-height: 1;
      letter-spacing: -1px;
    }
    #print-area .subtitle {
      font-size: 11px;
      text-align: center;
      font-weight: normal;
      margin-bottom: 2px;
    }
    #print-area .exchange-text {
      font-size: 10px;
      text-align: center;
      margin-top: 2px;
      margin-bottom: 2px;
    }
  `;
  document.head.appendChild(style);

  const printArea = document.createElement('div');
  printArea.id = 'print-area';

  printArea.innerHTML = `
      <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
         <div class="name">${product.name || 'Produto'}</div>
         ${product.subtitle ? `<div class="subtitle">${product.subtitle}</div>` : ''}
         ${product.sku ? `<div class="sku">${product.sku}</div>` : ''}
      </div>
      
      ${barcodeDataUrl ? `
        <div class="barcode-container">
          <img src="${barcodeDataUrl}" class="barcode-img" />
          <div class="gtin">${product.gtin}</div>
        </div>
      ` : `<div style="flex-grow: 1"></div>`}

      <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
        <div class="exchange-text">Troca Somente Com Etiqueta</div>
        <div class="price">${formattedPrice}</div>
      </div>
  `;
  document.body.appendChild(printArea);

  setTimeout(() => {
    try {
       window.print();
    } catch (e) {
       console.error(e);
       alert("Sua janela bloqueou a impressão. Tente abrir o sistema em uma nova aba.");
    }
    
    // Limpeza após 5 segundos
    setTimeout(() => {
       document.getElementById('print-area')?.remove();
       document.getElementById('print-style')?.remove();
    }, 5000);
  }, 300);
};
