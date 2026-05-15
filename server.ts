import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { MercadoPagoConfig, Preference } from 'mercadopago';
import aiRoutes from './src/server/routes/aiRoutes.js';
import { sendWebhook } from './src/server/services/botConversaService';
import { productCategorizationService } from './src/services/productCategorizationService';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './src/lib/firebase';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json';

const EXPECTED_PROJECT_ID = "gen-lang-client-0000764233";

// Forced Environment Variables to prevent fallback to internal AI Studio projects
process.env.GOOGLE_CLOUD_PROJECT = EXPECTED_PROJECT_ID;
process.env.GCLOUD_PROJECT = EXPECTED_PROJECT_ID;

// Strict validation of project ID
if (firebaseConfig.projectId !== EXPECTED_PROJECT_ID) {
  console.error(`❌ CRITICAL: Project ID mismatch in config! Found ${firebaseConfig.projectId}, expected ${EXPECTED_PROJECT_ID}`);
  process.exit(1);
}

// Initialize firebase-admin explicitly
let adminApp: admin.app.App;
if (!admin.apps.length) {
  console.log("🔥 [Firebase Admin] Initializing explicitly for project:", EXPECTED_PROJECT_ID);
  
  const credential = admin.credential.applicationDefault();
  if (!credential) {
    console.error("❌ CRITICAL: Firebase Admin credentials not found! Ensure Service Account is properly configured.");
    process.exit(1);
  }

  adminApp = admin.initializeApp({
    credential,
    projectId: EXPECTED_PROJECT_ID,
    storageBucket: firebaseConfig.storageBucket,
  }, 'discreta-boutique-admin');
} else {
  adminApp = admin.app('discreta-boutique-admin');
}

const adminDb = adminApp.firestore();

// Logging as requested
console.log("✅ [Firebase Admin] Firebase Project:", adminApp.options.projectId);
console.log("📦 [Firebase Admin] Firestore Initialized for Project:", adminApp.options.projectId);

// Verify connection
(async () => {
  try {
     // Basic check to ensure we are using the correct credentials and project
     console.log("⏳ [Firestore Admin] Verifying connection...");
     // Using a timeout for the verification check to prevent blocking startup indefinitely if network issues occur
     const snapshot = await adminDb.collection('settings').limit(1).get();
     console.log("⭐ [Firestore Admin] Connection Verified. Project:", adminApp.options.projectId);
  } catch (e: any) {
     console.error("❌ [Firestore Admin] Connection Warning:", e.message);
     if (e.message && e.message.includes('ais-us-east1-')) {
       console.error("🛑 CRITICAL FAILURE: System is still trying to connect to internal AI Studio project!");
     }
  }
})();

// Note: We'll use the client SDK in the backend for simplicity since we're in a controlled environment,
// but for high security, firebase-admin would be preferred if service account keys were available.
// In this case, we use the credentials provided in the .env or via the service to demonstrate the flow.

console.log(`Server environment ready`);

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;


  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // AI Routes
  app.use('/api/ia', aiRoutes);

  // Endpoint to create order and trigger webhook
  app.post("/api/pedidos", async (req, res) => {
    try {
        console.log("✅ ROTA DE PEDIDO CHAMADA");
        const orderData = req.body;
        
        // Ensure dates are Firestore Timestamps rather than strings
        orderData.createdAt = serverTimestamp();
        orderData.updatedAt = serverTimestamp();
        
        // Save to DB (Listener will handle the webhook!)
        const docRef = await addDoc(collection(db, 'orders'), orderData);
        
        res.json({ success: true, orderId: docRef.id });
    } catch (error: any) {
        console.error("Erro ao criar pedido ou enviar webhook:", error);
        res.status(500).json({ success: false, error: error.message });
    }
  });

  // Backend-side trigger for BotConversa webhook
  app.post("/api/botconversa/event", async (req, res) => {
    try {
      const { pedido } = req.body;
      if (!pedido) return res.status(400).json({ error: "Pedido é obrigatório" });
      
      await sendWebhook(pedido);
      res.json({ success: true, message: "Webhook disparado com sucesso" });
    } catch (error: any) {
      console.error("Erro ao enviar webhook:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Intelligent Categorization
  app.post("/api/products/categorize", async (req, res) => {
    try {
      const { name, description, brand, tags } = req.body;
      const catSnap = await getDocs(collection(db, 'categories'));
      const categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const suggestions = productCategorizationService.suggestCategories(name, description, brand || '', tags || [], categories);
      res.json({ suggestions });
    } catch (error) {
      console.error("Erro ao categorizar:", error);
      res.status(500).json({ error: "Erro na categorização" });
    }
  });

  // Retry endpoint for BotConversa webhook
  app.post("/api/botconversa/retry", async (req, res) => {
    try {
      const { orderId } = req.body;
      if (!orderId) return res.status(400).json({ error: "Order ID é obrigatório" });
      
      // Fetch the order from Firestore
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
          return res.status(404).json({ error: "Pedido não encontrado" });
      }
      
      const pedido = { id: orderDoc.id, ...orderDoc.data() } as any;
      await sendWebhook(pedido);
      res.json({ success: true, message: "Webhook disparado com sucesso" });
    } catch (error: any) {
      console.error("Erro ao reenviar webhook:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Debug route for BotConversa
  app.get("/debug/botconversa", async (req, res) => {
    try {
      const fakeOrder = {
        id: "DEBUG_123",
        telefone: "5511999999999",
        nome: "Cliente Teste",
        status: "TESTE_ORIGEM"
      };
      await sendWebhook(fakeOrder as any);
      res.json({ success: true, message: "Evento de teste disparado" });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

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

  // Endpoint for favicon to use store logo
  app.get('/favicon.ico', async (req, res) => {
    try {
      const configRaw = await fs.promises.readFile(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
      const config = JSON.parse(configRaw);
      const settingsUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/settings/store`;
      const settingsRes = await fetch(settingsUrl);
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const sFields = settingsData.fields || {};
        if (sFields.logoUrl?.stringValue) {
          return res.redirect(sFields.logoUrl.stringValue);
        }
      }
    } catch (e) {
      console.error("Error fetching favicon:", e);
    }
    res.redirect('/logo.png');
  });

  // Open Graph dynamic injection for product pages
  app.get('*all', async (req, res, next) => {
    const isAsset = /\.(js|ts|jsx|tsx|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|eot|txt|map|webp|avif|json)$/.test(req.path);
    if (isAsset && !req.path.includes('manifest')) {
      return next();
    }

    if (req.path.startsWith('/api/')) return next();

    let title = "Discreta Boutique | Sensualidade e Elegância";
    let description = "Loja virtual exclusiva e rápida da Discreta Boutique";
    let image = "/logo.png";
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
          short_name: title.split('|')[0].trim(),
          description: description,
          theme_color: '#000000',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: image,
              sizes: '192x192',
              purpose: 'any maskable'
            },
            {
              src: image,
              sizes: '512x512',
              purpose: 'any maskable'
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
      <link rel="icon" href="${image}" />
      <link rel="shortcut icon" href="${image}" />
      <link rel="apple-touch-icon" href="${image}" />
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
    setupOrderListener();
  });
}

import { setupOrderListener } from './src/server/services/firestoreListener';

startServer();
