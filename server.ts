import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { MercadoPagoConfig, Preference } from 'mercadopago';
// Note: We'll use the client SDK in the backend for simplicity since we're in a controlled environment,
// but for high security, firebase-admin would be preferred if service account keys were available.
// In this case, we use the credentials provided in the .env or via the service to demonstrate the flow.

const __filename = fileURLToPath(import.meta.url);
console.log(`Server environment ready: ${__filename}`);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // Mercado Pago Preference Creation
  app.post("/api/payments/create-preference", async (req, res) => {
    try {
      const { items, accessToken, orderId } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
      const preference = new Preference(client);

      const response = await preference.create({
        body: {
          items: items.map((item: { productId: string; name: string; quantity: number; price: number }) => ({
            id: item.productId,
            title: item.name,
            quantity: item.quantity,
            unit_price: Number(item.price),
            currency_id: 'BRL'
          })),
          back_urls: {
            success: `${req.get('origin')}/sucesso?orderId=${orderId}`,
            failure: `${req.get('origin')}/carrinho`,
            pending: `${req.get('origin')}/sucesso?orderId=${orderId}`,
          },
          auto_return: 'approved',
          external_reference: orderId,
        }
      });

      res.json({ id: response.id, init_point: response.init_point, sandbox_init_point: response.sandbox_init_point });
    } catch (error: unknown) {
      console.error("MP Preference Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: errorMessage });
    }
  });

  // Mercado Pago Transparent Payment Processing
  app.post("/api/payments/process", async (req, res) => {
    try {
      const { formData, accessToken, orderId } = req.body;

      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });
      const { Payment } = await import('mercadopago');
      const payment = new Payment(client);

      const response = await payment.create({
        body: {
          transaction_amount: formData.transaction_amount,
          token: formData.token,
          description: formData.description || `Pedido ${orderId}`,
          installments: formData.installments,
          payment_method_id: formData.payment_method_id,
          issuer_id: formData.issuer_id,
          payer: {
            email: formData.payer.email,
            identification: formData.payer.identification
          },
          external_reference: orderId,
        }
      });

      res.json({ success: true, status: response.status, detail: response.status_detail, id: response.id });
    } catch (error: unknown) {
      console.error("MP Payment Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      res.status(500).json({ error: errorMessage });
    }
  });

  let vite: import('vite').ViteDevServer;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
  }

  // Open Graph dynamic injection for product pages
  app.get('*all', async (req, res, next) => {
    const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|eot|webmanifest|json|txt|map)$/.test(req.path);
    if (isAsset) {
      return next();
    }

    if (req.path.startsWith('/api/')) return next();

    let title = "Discreta Boutique | Sensualidade e Elegância";
    let description = "Loja virtual exclusiva e rápida da Discreta Boutique";
    let image = "https://firebasestorage.googleapis.com/v0/b/gen-lang-client-0000764233.firebasestorage.app/o/branding%2Flogo_1777498145199?alt=media&token=1c7b46d9-cc91-4dab-a577-2fed828d9224"; // Default image
    const ogUrl = `https://discretaboutique.com.br${req.path}`;
    
    try {
      const configRaw = await fs.promises.readFile(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
      const config = JSON.parse(configRaw);
      
      // 1. Fetch store settings for global defaults (Logo and Name)
      const settingsUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/settings/store`;
      const settingsRes = await fetch(settingsUrl);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const sFields = settingsData.fields || {};
        if (sFields.storeName?.stringValue) title = `${sFields.storeName.stringValue} | Sensualidade e Elegância`;
        if (sFields.logoUrl?.stringValue) image = sFields.logoUrl.stringValue;
      }

      // 2. Dynamic manifest handler
      if (req.path === '/manifest.webmanifest' || req.path === '/manifest.json') {
        const manifest = {
          name: title.split('|')[0].trim(),
          short_name: 'Discreta',
          description: description,
          theme_color: '#000000',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/logo.webp',
              sizes: '192x192',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: '/logo.webp',
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'any'
            },
            {
              src: '/logo.webp',
              sizes: '512x512',
              type: 'image/webp',
              purpose: 'maskable'
            }
          ]
        };
        return res.json(manifest);
      }

      // 3. Product metadata override
      const productMatch = req.path.match(/^\/produto\/([^/]+)$/);
      if (productMatch) {
        const slug = productMatch[1];
        const apiUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:runQuery`;
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            structuredQuery: {
              from: [{ collectionId: "products" }],
              where: {
                fieldFilter: {
                  field: { fieldPath: "seo.slug" },
                  op: "EQUAL",
                  value: { stringValue: slug }
                }
              },
              limit: 1
            }
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data && data[0] && data[0].document) {
             const doc = data[0].document.fields;
             title = `${doc.name?.stringValue || 'Produto'} | ${title.split('|')[0].trim()}`;
             description = doc.shortDescription?.stringValue || doc.subtitle?.stringValue || description;
             const imagesArray = doc.images?.arrayValue?.values;
             if (imagesArray && imagesArray.length > 0) {
               const mainImage = imagesArray.find((img: { mapValue?: { fields?: { isMain?: { booleanValue?: boolean } } } }) => 
                 img.mapValue?.fields?.isMain?.booleanValue === true
               ) || imagesArray[0];
               const imgData = mainImage as { mapValue?: { fields?: { url?: { stringValue?: string } } } };
               if (imgData.mapValue?.fields?.url?.stringValue) {
                 image = imgData.mapValue.fields.url.stringValue;
               }
             }
          }
        }
      }
    } catch (e) {
      console.error("Error fetching metadata:", e);
    }

    const ogTags = `
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:image" content="${image}" />
      <meta property="og:url" content="${ogUrl}" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${title}" />
      <meta name="twitter:description" content="${description}" />
      <meta name="twitter:image" content="${image}" />
    `;

    try {
      let html = '';
      if (process.env.NODE_ENV !== 'production') {
        html = await fs.promises.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        html = html.replace('</title>', '</title>\n' + ogTags);
        html = await vite.transformIndexHtml(req.url, html);
      } else {
        html = await fs.promises.readFile(path.resolve(process.cwd(), 'dist', 'index.html'), 'utf-8');
        html = html.replace('</title>', '</title>\n' + ogTags);
      }
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch(e) {
      if (vite) vite.ssrFixStacktrace(e);
      console.error("Error rendering HTML:", e);
      const errorMessage = e instanceof Error ? e.message : "Erro interno";
      res.status(500).end(errorMessage);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
