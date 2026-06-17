import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { MercadoPagoConfig, Preference } from 'mercadopago';
import aiRoutes from './src/server/routes/aiRoutes.js';
import { sendWebhook } from './src/server/services/botConversaService';
import { productCategorizationService } from './src/services/productCategorizationService';
import { db } from './src/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc, query, limit, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';

// Verify connection
(async () => {
  try {
     console.log("⏳ [Firestore Client] Verifying connection...");
     await getDocs(query(collection(db, 'settings'), limit(1)));
     console.log("⭐ [Firestore Client] Connection Verified.");
  } catch (e: any) {
     console.error("❌ [Firestore Client] Connection Warning:", e.message);
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

  // WiFi/Hotspot Lead Capture Route
  app.options('/api/wifi-leads', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.sendStatus(204);
  });

  app.post("/api/wifi-leads", async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

    try {
      const { name, whatsapp, mac, ip, userAgent, source } = req.body;

      if (!name || !whatsapp) {
        return res.status(400).json({ success: false, error: "Nome e WhatsApp são obrigatórios." });
      }

      // Format & Normalize WhatsApp (keep only digits)
      const normalizedWhatsapp = whatsapp.replace(/\D/g, "");

      if (normalizedWhatsapp.length < 8) {
        return res.status(400).json({ success: false, error: "O número de WhatsApp informado é inválido." });
      }

      console.log(`⏳ [Wi-Fi Leads] Checking for existing lead: ${normalizedWhatsapp}`);
      const docRef = doc(db, 'wifiLeads', normalizedWhatsapp);
      
      let docSnap;
      try {
        docSnap = await getDoc(docRef);
        console.log(`⭐ [Wi-Fi Leads] getDoc success. Exist? ${docSnap.exists()}`);
      } catch (getErr: any) {
        console.error(`❌ [Wi-Fi Leads] getDoc failed:`, getErr);
        throw getErr;
      }

      const payload: any = {
        name,
        whatsapp: normalizedWhatsapp,
        mac: mac || "",
        ip: ip || "",
        userAgent: userAgent || "",
        source: source || "wifi_loja",
        updatedAt: serverTimestamp(),
        acceptedMarketing: true,
        origin: "hotspot_discreta"
      };

      if (docSnap.exists()) {
        try {
          await updateDoc(docRef, payload);
          console.log(`⭐ [Wi-Fi Leads] updateDoc success: ${normalizedWhatsapp}`);
        } catch (updateErr: any) {
          console.error(`❌ [Wi-Fi Leads] updateDoc failed:`, updateErr);
          throw updateErr;
        }
      } else {
        payload.createdAt = serverTimestamp();
        try {
          await setDoc(docRef, payload);
          console.log(`⭐ [Wi-Fi Leads] setDoc success: ${normalizedWhatsapp}`);
        } catch (setErr: any) {
          console.error(`❌ [Wi-Fi Leads] setDoc failed:`, setErr);
          throw setErr;
        }
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("Erro ao salvar lead de Wi-Fi:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Endpoint to create order and trigger webhook
  app.post("/api/pedidos", async (req, res) => {
    try {
        console.log("✅ ROTA DE PEDIDO CHAMADA");
        const orderData = req.body;
        
        // Save to DB using client SDK
        const docRef = await addDoc(collection(db, 'orders'), {
            ...orderData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        // Mark as recovered if phone exists
        if (orderData.customerWhatsapp) {
          const { serverRecoveryService } = await import('./src/server/services/serverRecoveryService');
          await serverRecoveryService.markAsRecovered(orderData.customerWhatsapp);
        }
        
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
      
      // Fetch the order from Firestore using Client SDK
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
          return res.status(404).json({ error: "Pedido não encontrado" });
      }
      
      const pedidoData = orderDoc.data();
      const pedido = { id: orderDoc.id, ...pedidoData } as any;
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

  // Test Abandoned Cart Recovery Webhook (Proxy)
  app.post("/api/admin/test-recovery-webhook", async (req, res) => {
    try {
      const { name, phone } = req.body;
      if (!name || !phone) return res.status(400).json({ error: "Nome e telefone são obrigatórios" });
      
      let webhookUrl = null;
      
      // Try new settings first
      const webhookSnap = await getDoc(doc(db, 'settings', 'webhooks'));
      if (webhookSnap.exists()) {
          const data = webhookSnap.data();
          if (data.recoveryWebhookUrl) {
              webhookUrl = data.recoveryWebhookUrl;
          }
      }

      // Fallback to legacy
      if (!webhookUrl) {
          const settingsSnap = await getDoc(doc(db, 'settings', 'recovery'));
          const settings = settingsSnap.exists() ? settingsSnap.data() : null;
          if (settings?.webhookUrl) {
              webhookUrl = settings.webhookUrl;
          }
      }
      
      if (!webhookUrl) {
          return res.status(400).json({ success: false, error: "URL do Webhook não configurada nas configurações de recuperação. Acesse Configurações > Bot Conversa." });
      }

      const { serverRecoveryService } = await import('./src/server/services/serverRecoveryService');
      const success = await serverRecoveryService.sendWebhook(webhookUrl, name, phone, 'TEST_MANUAL');
      
      if (success) {
        res.json({ success: true });
      } else {
        res.status(500).json({ success: false, error: "O servidor do Bot Conversa rejeitou o envio. Verifique o link ou os logs." });
      }
    } catch (error: any) {
      console.error("Erro no teste de webhook:", error);
      res.status(500).json({ success: false, error: error.message });
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

  // Robots.txt dynamic serve
  app.get('/robots.txt', (req, res) => {
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /login
Disallow: /carrinho
Disallow: /checkout
Disallow: /perfil
Disallow: /pedidos
Disallow: /area-cliente
Disallow: /sucesso
Disallow: /motoboy
Sitemap: https://discretaboutique.com.br/sitemap.xml`);
  });

  // Sitemap.xml dynamic generation
  app.get('/api/admin/fix-category-slugs', async (req, res) => {
    try {
      const catRef = collection(db, 'categories');
      const catSnap = await getDocs(catRef);

      const batch = writeBatch(db);
      let batchCount = 0;
      let logs: string[] = [];

      catSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        const rawUrl = data.slug || docSnap.id;
        let rawSlug = data.slug || data.name || docSnap.id;
        
        let cleanSlug = rawSlug.toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
          .replace(/[+&%?\/!,()]/g, "")
          .trim()
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '');

        if (!cleanSlug) {
          cleanSlug = id.toLowerCase().replace(/[^a-z0-9-]/g, '');
        }

        if (cleanSlug && cleanSlug !== data.slug) {
          batch.update(doc(db, 'categories', id), { slug: cleanSlug });
          batchCount++;
          logs.push(`Corrigida (ID: ${id}): '${rawUrl}' -> '${cleanSlug}'`);
        }
      });

      if (batchCount > 0) {
        await batch.commit();
      }

      res.json({ success: true, updated: batchCount, logs });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      res.header('Content-Type', 'application/xml');
      const domain = 'https://discretaboutique.com.br';
      const lastmod = new Date().toISOString().split('T')[0];
      
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${domain}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${domain}/catalogo</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${domain}/quem-somos</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${domain}/politica-de-privacidade</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/trocas-e-devolucoes</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/entrega-discreta</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${domain}/contato</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>${domain}/lgpd</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>`;

      try {
        const catSnap = await getDocs(collection(db, 'categories'));
        const addedCategories = new Set<string>();

        catSnap.docs.forEach(docSnap => {
          const category = docSnap.data();
          let rawSlug = category.slug || category.name || docSnap.id;
          
          let cleanSlug = rawSlug.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove accents
            .replace(/[+&%?\/!,()]/g, "") // remove symbols
            .trim()
            .replace(/\s+/g, '-') // replace spaces with hyphens
            .replace(/-+/g, '-') // remove duplicate hyphens
            .replace(/^-+|-+$/g, ''); // start/end hyphens

          if (!cleanSlug) {
            cleanSlug = docSnap.id.toLowerCase().replace(/[^a-z0-9-]/g, '');
          }
          
          if (!addedCategories.has(cleanSlug)) {
            addedCategories.add(cleanSlug);
            xml += `
  <url>
    <loc>${domain}/categoria/${cleanSlug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
          }
        });

        const pSnap = await getDocs(collection(db, 'products'));
        pSnap.docs.forEach(docSnap => {
          const p = docSnap.data();
          if (p.active !== false && p.seo?.slug && (Number(p.stock) || 0) > 0 && p.extras?.showInCatalog !== false) {
            xml += `
  <url>
    <loc>${domain}/produto/${p.seo.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
          }
        });
      } catch (dbErr) {
        console.error("Error building sitemap.xml dynamic nodes:", dbErr);
      }

      xml += `\n</urlset>`;
      res.send(xml);
    } catch (e) {
      console.error("Error serving sitemap.xml:", e);
      res.status(500).send("Error serving sitemap.xml");
    }
  });

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

  // Dynamic manifest handler
  app.get(['/manifest.webmanifest', '/manifest.json'], async (req, res) => {
    try {
      const configRaw = await fs.promises.readFile(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
      const config = JSON.parse(configRaw);
      
      const settingsUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/settings/store`;
      const settingsRes = await fetch(settingsUrl);
      let storeName = "Discreta Boutique";
      let image = "https://discretaboutique.com.br/logo.png";
      
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const sFields = settingsData.fields || {};
        if (sFields.storeName?.stringValue) storeName = sFields.storeName.stringValue;
        if (sFields.logoUrl?.stringValue) image = sFields.logoUrl.stringValue;
      }

      const themeUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/settings/theme_active`;
      const themeRes = await Promise.resolve().then(() => fetch(themeUrl)).catch(() => null);
      let activeThemeBranding: any = null;
      let activeThemeConfig: any = null;

      if (themeRes && themeRes.ok) {
        const themeData = await themeRes.json();
        const tFields = themeData.fields || {};
        
        activeThemeConfig = {
          primaryColor: tFields.primaryColor?.stringValue || '#D32F2F',
          backgroundColor: tFields.backgroundColor?.stringValue || '#0A0A0A'
        };

        if (tFields.branding && tFields.branding.mapValue && tFields.branding.mapValue.fields) {
          const bFields = tFields.branding.mapValue.fields;

          const extractImage = (field: any) => {
            if (!field) return undefined;
            if (field.stringValue) return field.stringValue; // backward comp
            if (field.mapValue?.fields?.url?.stringValue) return field.mapValue.fields.url.stringValue;
            return undefined;
          };

          activeThemeBranding = {
            appName: bFields.appName?.stringValue,
            shortName: bFields.shortName?.stringValue,
            themeColor: bFields.themeColor?.stringValue,
            backgroundColor: bFields.backgroundColor?.stringValue,
            logoHorizontal: extractImage(bFields.logoHorizontal),
            logoSquare: extractImage(bFields.logoSquare),
            logo: extractImage(bFields.logo),
            favicon: extractImage(bFields.favicon),
            icon192: extractImage(bFields.icon192),
            icon512: extractImage(bFields.icon512),
            maskableIcon: extractImage(bFields.maskableIcon),
            appleTouchIcon: extractImage(bFields.appleTouchIcon),
            socialPreviewImage: extractImage(bFields.socialPreviewImage),
            pwaVersion: bFields.pwaVersion?.integerValue || Date.now(),
          };
        }
      }

      let pwaVersionQuery = '';
      if (activeThemeBranding) {
        if (activeThemeBranding.pwaVersion) pwaVersionQuery = `?v=${activeThemeBranding.pwaVersion}`;
        if (activeThemeBranding.socialPreviewImage) image = `${activeThemeBranding.socialPreviewImage}${pwaVersionQuery}`;
        if (activeThemeBranding.appName) storeName = activeThemeBranding.appName;
      }

      const manifestAppName = activeThemeBranding?.appName || storeName;
      const manifestShortName = activeThemeBranding?.shortName || storeName;
      const manifestThemeColor = activeThemeBranding?.themeColor || activeThemeConfig?.primaryColor || '#000000';
      const manifestBgColor = activeThemeBranding?.backgroundColor || activeThemeConfig?.backgroundColor || '#ffffff';
      
      const manifest = {
        name: manifestAppName,
        short_name: manifestShortName,
        description: "Boutique íntima e sex shop de alta sofisticação em Icó-CE.",
        theme_color: manifestThemeColor,
        background_color: manifestBgColor,
        display: 'standalone',
        start_url: '/',
        icons: [
          { 
            src: activeThemeBranding?.icon192 ? `${activeThemeBranding.icon192}${pwaVersionQuery}` : (activeThemeBranding?.logo || image), 
            sizes: '192x192', 
            purpose: activeThemeBranding?.maskableIcon ? 'any' : 'any maskable',
            type: 'image/png'
          },
          { 
            src: activeThemeBranding?.icon512 ? `${activeThemeBranding.icon512}${pwaVersionQuery}` : (activeThemeBranding?.logo || image), 
            sizes: '512x512', 
            purpose: activeThemeBranding?.maskableIcon ? 'any' : 'any maskable',
            type: 'image/png'
          }
        ]
      };

      if (activeThemeBranding?.maskableIcon) {
        manifest.icons.push({
          src: `${activeThemeBranding.maskableIcon}${pwaVersionQuery}`,
          sizes: '512x512',
          purpose: 'maskable',
          type: 'image/png'
        });
      }
      
      res.json(manifest);
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: "Err" });
    }
  });

  interface MiniProduct {
    id: string;
    name: string;
    slug: string;
    price: number;
    promoPrice?: number;
    imageUrl?: string;
    description?: string;
    categoryId?: string;
  }

  async function fetchActiveProducts(projectId: string, limitVal: number = 150): Promise<MiniProduct[]> {
    const apiUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "products" }],
            where: {
              fieldFilter: {
                field: { fieldPath: "active" },
                op: "EQUAL",
                value: { booleanValue: true }
              }
            },
            limit: limitVal
          }
        })
      });

      if (!response.ok) {
        console.error("Failed to fetch active products:", response.statusText);
        return [];
      }

      const data = await response.json();
      if (!data || !Array.isArray(data)) return [];

      const list: MiniProduct[] = [];
      for (const item of data) {
        if (item.document && item.document.fields) {
          const fields = item.document.fields;
          const name = fields.name?.stringValue || "";
          if (!name) continue;

          const idPart = item.document.name ? item.document.name.split('/').pop() : '';
          const slug = fields.seo?.mapValue?.fields?.slug?.stringValue || fields.slug?.stringValue || idPart || "";
          const price = Number(fields.price?.doubleValue || fields.price?.integerValue || 0);
          const promoPrice = fields.promoPrice ? Number(fields.promoPrice.doubleValue || fields.promoPrice.integerValue || 0) : undefined;
          const categoryId = fields.categoryId?.stringValue || "";

          let imageUrl = "";
          const imagesValues = fields.images?.arrayValue?.values;
          if (imagesValues && imagesValues.length > 0) {
            const mainImg = imagesValues.find((img: any) => 
              img.mapValue?.fields?.isMain?.booleanValue === true
            ) || imagesValues[0];
            imageUrl = mainImg?.mapValue?.fields?.url?.stringValue || "";
          }

          const description = fields.shortDescription?.stringValue || fields.subtitle?.stringValue || fields.description?.stringValue || "";

          list.push({
            id: idPart,
            name,
            slug,
            price,
            promoPrice,
            imageUrl,
            description,
            categoryId
          });
        }
      }
      return list;
    } catch (e) {
      console.error("Error fetching active products:", e);
      return [];
    }
  }

  // Open Graph dynamic injection for product pages
  app.get('*all', async (req, res, next) => {
    const isAsset = /\.(js|ts|jsx|tsx|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|otf|eot|txt|map|webp|avif|json)$/.test(req.path);
    if (isAsset && !req.path.includes('manifest')) {
      return next();
    }

    if (req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/@')) return next();
    if (req.path.includes('/node_modules/')) return next();

    let title = "Discreta Boutique | Sex Shop e Boutique Íntima em Icó - CE";
    let description = "Discreta Boutique é uma boutique íntima em Icó-CE com lingeries, cosméticos sensuais, kits românticos e produtos para casais. Compre online com discrição.";
    let image = "https://discretaboutique.com.br/logo.png";
    let isRobotsIndex = "index, follow";
    let jsonLd: any = null;
    let ssrContent = "";
    
    const domain = "https://discretaboutique.com.br";
    const cleanPath = req.path.replace(/\/$/, ""); // remove trailing slash for canonical consistency
    let ogUrl = `${domain}${cleanPath || "/"}`;

    let storeName = "Discreta Boutique";
    let activeThemeBranding: any = null;

    try {
      const configRaw = await fs.promises.readFile(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
      const config = JSON.parse(configRaw);
      
      // Fetch store settings for global defaults (Logo and Name)
      const settingsUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/settings/store`;
      const settingsRes = await fetch(settingsUrl);
      
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const sFields = settingsData.fields || {};
        if (sFields.storeName?.stringValue) {
          storeName = sFields.storeName.stringValue;
        }
        if (sFields.logoUrl?.stringValue) {
          image = sFields.logoUrl.stringValue;
        }
      }

      // Fetch active theme for PWA branding overrides
      const themeUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/settings/theme_active`;
      const themeRes = await Promise.resolve().then(() => fetch(themeUrl)).catch(() => null);
      let activeThemeConfig: any = null;

      if (themeRes && themeRes.ok) {
        const themeData = await themeRes.json();
        const tFields = themeData.fields || {};
        
        // Extract basic theme colors for fallback
        activeThemeConfig = {
          primaryColor: tFields.primaryColor?.stringValue || '#D32F2F',
          backgroundColor: tFields.backgroundColor?.stringValue || '#0A0A0A'
        };

        if (tFields.branding && tFields.branding.mapValue && tFields.branding.mapValue.fields) {
          const bFields = tFields.branding.mapValue.fields;

          const extractImage = (field: any) => {
            if (!field) return undefined;
            if (field.stringValue) return field.stringValue; // backward comp
            if (field.mapValue?.fields?.url?.stringValue) return field.mapValue.fields.url.stringValue;
            return undefined;
          };

          activeThemeBranding = {
            appName: bFields.appName?.stringValue,
            shortName: bFields.shortName?.stringValue,
            themeColor: bFields.themeColor?.stringValue,
            backgroundColor: bFields.backgroundColor?.stringValue,
            logoHorizontal: extractImage(bFields.logoHorizontal),
            logoSquare: extractImage(bFields.logoSquare),
            logo: extractImage(bFields.logo),
            favicon: extractImage(bFields.favicon),
            icon192: extractImage(bFields.icon192),
            icon512: extractImage(bFields.icon512),
            maskableIcon: extractImage(bFields.maskableIcon),
            appleTouchIcon: extractImage(bFields.appleTouchIcon),
            socialPreviewImage: extractImage(bFields.socialPreviewImage),
            pwaVersion: bFields.pwaVersion?.integerValue || Date.now(),
          };
        }
      }

      // Apply branding overrides to defaults where applicable
      let pwaVersionQuery = '';
      if (activeThemeBranding) {
        if (activeThemeBranding.pwaVersion) pwaVersionQuery = `?v=${activeThemeBranding.pwaVersion}`;
        if (activeThemeBranding.socialPreviewImage) image = `${activeThemeBranding.socialPreviewImage}${pwaVersionQuery}`;
        if (activeThemeBranding.appName) storeName = activeThemeBranding.appName;
      }

      // Check for security-sensitive or personal pages to apply noindex
      const isPrivatePage = /^\/(admin|login|carrinho|checkout|perfil|pedidos|area-cliente|sucesso|wifi|motoboy)(\/|$)/i.test(req.path);
      if (isPrivatePage) {
        isRobotsIndex = "noindex, nofollow";
      }

      // 1. Home Route Override
      if (req.path === '/' || req.path === '') {
        title = "Discreta Boutique | Sex Shop e Boutique Íntima em Icó - CE";
        description = "Discreta Boutique é uma boutique íntima em Icó-CE com lingeries, cosméticos sensuais, kits românticos e produtos para casais. Compre online com discrição.";
        
        jsonLd = [
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": storeName,
            "url": domain,
            "potentialAction": {
              "@type": "SearchAction",
              "target": `${domain}/catalogo?q={search_term_string}`,
              "query-input": "required name=search_term_string"
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "Store",
            "name": storeName,
            "url": domain,
            "logo": image,
            "image": image,
            "description": description,
            "telephone": "+55 88 99234-0317",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Icó",
              "addressRegion": "CE",
              "addressCountry": "BR"
            },
            "sameAs": [
              "https://instagram.com/discretaico"
            ]
          }
        ];

        try {
          const activeProducts = await fetchActiveProducts(config.projectId, 48);
          let productsGridHtml = "";
          if (activeProducts.length > 0) {
            productsGridHtml = activeProducts.slice(0, 24).map(p => {
              const displayPrice = p.promoPrice !== undefined && p.promoPrice > 0
                ? `<span style="color: #dc2626; font-weight: 800; font-size: 1.15rem; margin-right: 0.5rem;">R$ ${p.promoPrice.toFixed(2)}</span>
                   <span style="color: #555; text-decoration: line-through; font-size: 0.9rem;">R$ ${p.price.toFixed(2)}</span>`
                : `<span style="color: #dc2626; font-weight: 800; font-size: 1.15rem;">R$ ${p.price.toFixed(2)}</span>`;

              const imgHtml = p.imageUrl 
                ? `<img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 260px; object-fit: contain; background: #070707; border-bottom: 1px solid #1a1a1a; margin-bottom: 0.75rem;" referrerPolicy="no-referrer" />`
                : '';

              return `
                <div class="product-seo-card" style="box-sizing: border-box; display: flex; flex-direction: column; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 8px; overflow: hidden; padding: 0 0 1rem 0; text-align: left;">
                  ${imgHtml}
                  <div style="padding: 0 1rem; display: flex; flex-direction: column; flex-grow: 1;">
                    <h3 style="margin: 0.5rem 0 0.25rem 0; font-size: 1rem; font-weight: 700; min-height: 2.8rem; overflow: hidden;">
                      <a href="/produto/${p.slug}" style="text-decoration: none; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</a>
                    </h3>
                    <div style="margin-top: auto; padding-top: 0.5rem;">
                      <div style="display: flex; align-items: baseline;">
                        ${displayPrice}
                      </div>
                      <div style="margin-top: 1rem;">
                        <a href="/produto/${p.slug}" style="display: block; text-align: center; background: #dc2626; color: #fff; padding: 0.5rem 1rem; text-decoration: none; border-radius: 4px; font-weight: 900; font-size: 0.85rem; text-transform: uppercase;">Comprar</a>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join("\n");
          }

          ssrContent = `
            <div id="ssr-seo-content" style="max-width: 1200px; margin: 0 auto; padding: 2rem; color: #fff; font-family: system-ui, -apple-system, sans-serif;">
              <header style="text-align: center; margin-bottom: 3rem;">
                <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 1rem; color: #ffffff;">Discreta Boutique</h1>
                <h2 style="font-size: 1.5rem; color: #dc2626; margin-bottom: 1rem; font-weight: 700;">Moda Íntima, Lingeries de Luxo e Bem-estar em Icó - CE</h2>
                <p style="font-size: 1.1rem; color: #aaa; max-width: 800px; margin: 0 auto; line-height: 1.6;">
                  Bem-vindo à Discreta Boutique. Oferecemos lingeries elegantes, cosméticos sensuais modernos, estimuladores masculinos e femininos de alta tecnologia, e produtos selecionados para casais em Icó-CE. Aproveite facilidades de pagamento, atendimento qualificado e embalagens 100% discretas.
                </p>
              </header>
              
              <section style="margin-bottom: 4rem;">
                <h2 style="font-size: 1.8rem; font-weight: 800; border-bottom: 2px solid #222; padding-bottom: 0.5rem; margin-bottom: 2rem;">Produtos em Destaque</h2>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem;">
                  ${productsGridHtml}
                </div>
                <div style="text-align: center; margin-top: 3rem;">
                  <a href="/catalogo" style="display: inline-block; background: #fff; color: #000; padding: 0.85rem 2rem; border-radius: 99px; text-decoration: none; font-weight: 900; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.1em; box-shadow: 0 4px 20px rgba(255,255,255,0.15);">Ver Catálogo Completo</a>
                </div>
              </section>
            </div>
          `;
        } catch (err) {
          console.error("Error creating Home SSR content:", err);
        }
      }

      // 2. Catalog Route Override
      else if (req.path === '/catalogo') {
        title = "Catálogo Discreta Boutique | Lingerie, Sedução e Sex Shop em Icó - CE";
        description = "Explore o catálogo completo da Discreta Boutique em Icó, Ceará. Lingeries exclusivas, cosméticos sensuais, estimuladores e novidades com entrega sigilosa.";
        
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "name": "Catálogo de Produtos - Discreta Boutique",
          "url": `${domain}/catalogo`,
          "description": description,
          "breadcrumb": {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Início", "item": domain },
              { "@type": "ListItem", "position": 2, "name": "Catálogo", "item": `${domain}/catalogo` }
            ]
          }
        };

        try {
          const activeProducts = await fetchActiveProducts(config.projectId, 150);
          let productsGridHtml = "";
          if (activeProducts.length > 0) {
            productsGridHtml = activeProducts.map(p => {
              const displayPrice = p.promoPrice !== undefined && p.promoPrice > 0
                ? `<span style="color: #dc2626; font-weight: 800; font-size: 1.15rem; margin-right: 0.5rem;">R$ ${p.promoPrice.toFixed(2)}</span>
                   <span style="color: #555; text-decoration: line-through; font-size: 0.9rem;">R$ ${p.price.toFixed(2)}</span>`
                : `<span style="color: #dc2626; font-weight: 800; font-size: 1.15rem;">R$ ${p.price.toFixed(2)}</span>`;

              const imgHtml = p.imageUrl 
                ? `<img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 260px; object-fit: contain; background: #070707; border-bottom: 1px solid #1a1a1a; margin-bottom: 0.75rem;" referrerPolicy="no-referrer" />`
                : '';

              const descHtml = p.description 
                ? `<p style="font-size: 0.85rem; color: #aaa; margin: 0.5rem 0; line-clamp: 2; height: 2.4rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.description}</p>`
                : '';

              return `
                <div class="product-seo-card" style="box-sizing: border-box; display: flex; flex-direction: column; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 8px; overflow: hidden; padding: 0 0 1rem 0; text-align: left;">
                  ${imgHtml}
                  <div style="padding: 0 1rem; display: flex; flex-direction: column; flex-grow: 1;">
                    <h3 style="margin: 0.5rem 0 0.25rem 0; font-size: 1rem; font-weight: 700; min-height: 2.8rem; overflow: hidden;">
                      <a href="/produto/${p.slug}" style="text-decoration: none; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</a>
                    </h3>
                    ${descHtml}
                    <div style="margin-top: auto; padding-top: 0.5rem;">
                      <div style="display: flex; align-items: baseline;">
                        ${displayPrice}
                      </div>
                      <div style="margin-top: 1rem;">
                        <a href="/produto/${p.slug}" style="display: block; text-align: center; background: #dc2626; color: #fff; padding: 0.5rem 1rem; text-decoration: none; border-radius: 4px; font-weight: 900; font-size: 0.85rem; text-transform: uppercase;">Ver Detalhes</a>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join("\n");
          } else {
            productsGridHtml = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 2rem;">Nenhum produto encontrado no momento. Visite-nos novamente mais tarde!</p>`;
          }

          ssrContent = `
            <div id="ssr-seo-content" style="max-width: 1200px; margin: 0 auto; padding: 2rem; color: #fff; font-family: system-ui, -apple-system, sans-serif;">
              <header style="text-align: center; margin-bottom: 3rem;">
                <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 1rem; color: #ffffff;">Catálogo Discreta Boutique</h1>
                <p style="font-size: 1.1rem; color: #aaa; max-width: 800px; margin: 0 auto; line-height: 1.6;">
                  Explore o catálogo completo da Discreta Boutique em Icó, Ceará. Lingeries exclusivas, cosméticos sensuais, estimuladores e novidades com entrega sigilosa.
                </p>
              </header>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
                ${productsGridHtml}
              </div>
            </div>
          `;
        } catch (err) {
          console.error("Error creating Catalog SSR content:", err);
        }
      }

      // 3. Category Page Override
      else if (req.path.startsWith('/categoria/')) {
        const categoryMatch = req.path.match(/^\/categoria\/([^/]+)$/);
        if (categoryMatch) {
          const catSlug = categoryMatch[1]; // The clean slug from URL
          const catApiUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/categories?pageSize=100`;
          const catResponse = await Promise.resolve().then(() => fetch(catApiUrl)).catch(() => null);

          if (catResponse && catResponse.ok) {
            const catData = await catResponse.json();
            const docs = catData.documents || [];
            
            let matchedDocFields = null;
            let cleanMatchedSlug = null;
            let matchedCategoryId = null;
            
            for (const doc of docs) {
              const docFields = doc.fields || {};
              const name = docFields.name?.stringValue || '';
              const originalSlug = docFields.slug?.stringValue || '';
              
              let rawSlug = originalSlug || name;
              if (rawSlug) {
                let clean = rawSlug.toLowerCase()
                  .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
                  .replace(/[+&%?\/!,()]/g, "")
                  .trim()
                  .replace(/\s+/g, '-')
                  .replace(/-+/g, '-')
                  .replace(/^-+|-+$/g, '');
                  
                const decodedCat = decodeURIComponent(catSlug);
                // Match normalized URL slug with the DB category
                if (clean === catSlug || encodeURIComponent(clean) === catSlug || originalSlug === catSlug || originalSlug === decodedCat || clean === decodedCat) {
                  matchedDocFields = docFields;
                  cleanMatchedSlug = clean;
                  matchedCategoryId = doc.name ? doc.name.split('/').pop() : null;
                  break;
                }
              }
            }
            
            if (matchedDocFields && cleanMatchedSlug) {
              if (catSlug !== cleanMatchedSlug && decodeURIComponent(catSlug) !== cleanMatchedSlug) {
                res.redirect(301, `/categoria/${cleanMatchedSlug}`);
                return;
              }
 
               const catName = matchedDocFields.name?.stringValue || "Categoria";
               title = `${catName} | Discreta Boutique | Icó - CE`;
               description = `Compre produtos de ${catName} na Discreta Boutique com toda discrição. Lingeries de luxo, cosméticos sensuais, acessórios e novidades em Icó-CE.`;
               
               // Ensure canonical URL is always the cleanest one
               ogUrl = `${domain}/categoria/${cleanMatchedSlug}`;
               
               jsonLd = {
                 "@context": "https://schema.org",
                 "@type": "CollectionPage",
                 "name": `${catName} - Discreta Boutique`,
                 "url": ogUrl,
                 "description": description,
                 "breadcrumb": {
                   "@type": "BreadcrumbList",
                   "itemListElement": [
                     { "@type": "ListItem", "position": 1, "name": "Início", "item": domain },
                     { "@type": "ListItem", "position": 2, "name": "Catálogo", "item": `${domain}/catalogo` },
                     { "@type": "ListItem", "position": 3, "name": catName, "item": ogUrl }
                   ]
                 }
               };

              try {
                const activeProducts = await fetchActiveProducts(config.projectId, 150);
                const categoryProducts = activeProducts.filter(p => p.categoryId === matchedCategoryId);
                let productsGridHtml = "";
                
                if (categoryProducts.length > 0) {
                  productsGridHtml = categoryProducts.map(p => {
                    const displayPrice = p.promoPrice !== undefined && p.promoPrice > 0
                      ? `<span style="color: #dc2626; font-weight: 800; font-size: 1.15rem; margin-right: 0.5rem;">R$ ${p.promoPrice.toFixed(2)}</span>
                         <span style="color: #555; text-decoration: line-through; font-size: 0.9rem;">R$ ${p.price.toFixed(2)}</span>`
                      : `<span style="color: #dc2626; font-weight: 800; font-size: 1.15rem;">R$ ${p.price.toFixed(2)}</span>`;

                    const imgHtml = p.imageUrl 
                      ? `<img src="${p.imageUrl}" alt="${p.name}" style="width: 100%; height: 260px; object-fit: contain; background: #070707; border-bottom: 1px solid #1a1a1a; margin-bottom: 0.75rem;" referrerPolicy="no-referrer" />`
                      : '';

                    return `
                      <div class="product-seo-card" style="box-sizing: border-box; display: flex; flex-direction: column; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 8px; overflow: hidden; padding: 0 0 1rem 0; text-align: left;">
                        ${imgHtml}
                        <div style="padding: 0 1rem; display: flex; flex-direction: column; flex-grow: 1;">
                          <h3 style="margin: 0.5rem 0 0.25rem 0; font-size: 1rem; font-weight: 700; min-height: 2.8rem; overflow: hidden;">
                            <a href="/produto/${p.slug}" style="text-decoration: none; color: #fff; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</a>
                          </h3>
                          <div style="margin-top: auto; padding-top: 0.5rem;">
                            <div style="display: flex; align-items: baseline;">
                              ${displayPrice}
                            </div>
                            <div style="margin-top: 1rem;">
                              <a href="/produto/${p.slug}" style="display: block; text-align: center; background: #dc2626; color: #fff; padding: 0.5rem 1rem; text-decoration: none; border-radius: 4px; font-weight: 900; font-size: 0.85rem; text-transform: uppercase;">Comprar</a>
                            </div>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join("\n");
                } else {
                  productsGridHtml = `<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 2rem;">Nenhum produto cadastrado nesta categoria de momento.</p>`;
                }

                ssrContent = `
                  <div id="ssr-seo-content" style="max-width: 1200px; margin: 0 auto; padding: 2rem; color: #fff; font-family: system-ui, -apple-system, sans-serif;">
                    <header style="text-align: center; margin-bottom: 3rem;">
                      <a href="/catalogo" style="color: #666; text-decoration: none; font-size: 0.9rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em;">&larr; Voltar para o Catálogo</a>
                      <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -0.02em; margin: 1rem 0; color: #ffffff;">${catName}</h1>
                      <p style="font-size: 1.1rem; color: #aaa; max-width: 800px; margin: 0 auto; line-height: 1.6;">
                        Explore nossa seleção de ${catName} na Discreta Boutique. Entregas reservadas e total sigilo para você em Icó-CE.
                      </p>
                    </header>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 3rem;">
                      ${productsGridHtml}
                    </div>
                  </div>
                `;
              } catch (err) {
                console.error("Error creating Category SSR content:", err);
              }
             }
          }
        }
      }

      // 4. Product Route Override
      else if (req.path.startsWith('/produto/')) {
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
              
              const pName = doc.name?.stringValue || 'Produto';
              title = `${pName} | Discreta Boutique | Icó - CE`;
              
              const rawDesc = doc.shortDescription?.stringValue || doc.subtitle?.stringValue || doc.description?.stringValue || "";
              description = rawDesc ? `${rawDesc.substring(0, 160).trim()}... Compre na Discreta Boutique com sigilo.` : `Compre ${pName} na Discreta Boutique em Icó-CE com total sigilo e privacidade. Lingerie, sex shop, cosméticos e bem estar.`;
              
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

              const priceVal = Number(doc.promoPrice?.doubleValue || doc.promoPrice?.integerValue || doc.price?.doubleValue || doc.price?.integerValue || 0);
              const stockVal = Number(doc.stock?.integerValue || doc.stock?.doubleValue || 0);
              const inStock = stockVal > 0;

              jsonLd = {
                "@context": "https://schema.org",
                "@type": "Product",
                "name": pName,
                "image": image,
                "description": description,
                "brand": {
                  "@type": "Brand",
                  "name": "Discreta Boutique"
                },
                "offers": {
                  "@type": "Offer",
                  "url": ogUrl,
                  "priceCurrency": "BRL",
                  "price": priceVal || 0.0,
                  "priceValidUntil": "2027-12-31",
                  "availability": inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                  "itemCondition": "https://schema.org/NewCondition"
                }
              };
            }
          }
        }
      }

      // 5. Institutional Pages Overrides
      else if (req.path === '/quem-somos') {
        title = "Quem Somos | Discreta Boutique - Moda Íntima e Bem-estar em Icó";
        description = "Saiba mais sobre a trajetória da Discreta Boutique em Icó-CE, nosso compromisso com a privacidade e nossa curadoria cuidadosa de lingerie e produtos para o prazer.";
      } else if (req.path === '/politica-de-privacidade') {
        title = "Política de Privacidade | Discreta Boutique";
        description = "Confira nossos termos de privacidade e entenda como a Discreta Boutique protege seus dados e garante sua discrição do faturamento à entrega.";
      } else if (req.path === '/politica-de-troca' || req.path === '/trocas-e-devolucoes') {
        title = "Política de Trocas e Devoluções | Discreta Boutique";
        description = "Entenda como funciona nossa política de trocas e devoluções simplificada e discreta, de acordo com o Código de Defesa do Consumidor.";
      } else if (req.path === '/entrega-discreta') {
        title = "Entrega Discreta e Sigilosa | Discreta Boutique em Icó - CE";
        description = "Sua privacidade é prioridade. Conheça nosso padrão de embalagem externa neutra e remetente discreto para envio e entrega segura de lingerie e cosméticos sensuais.";
      } else if (req.path === '/contato') {
        title = "Fale Conosco | Discreta Boutique | Atendimento em Icó - CE";
        description = "Fale com a nossa equipe de atendimento em Icó-CE de forma confidencial e discreta. Tire dúvidas sobre produtos, entregas ou faça seu pedido por WhatsApp.";
      } else if (req.path === '/lgpd') {
        title = "Conformidade LGPD | Discreta Boutique";
        description = "Compromisso da Discreta Boutique com a privacidade e proteção de dados em conformidade com a Lei Geral de Proteção de Dados.";
      }

      // Generate institutional breadcrumbs if jsonLd was not set yet but we are on standard page
      if (!jsonLd && !isPrivatePage && req.path !== '/') {
        const pageCleanName = title.split('|')[0].trim();
        jsonLd = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Início", "item": domain },
            { "@type": "ListItem", "position": 2, "name": pageCleanName, "item": ogUrl }
          ]
        };
      }

    } catch (e) {
      console.error("Error fetching metadata:", e);
    }

    let scriptLd = '';
    if (jsonLd) {
      scriptLd = `
      <script type="application/ld+json">
        ${JSON.stringify(jsonLd)}
      </script>`;
    }

    const versionStr = activeThemeBranding?.pwaVersion ? `?v=${activeThemeBranding.pwaVersion}` : '';
    const faviconUrl = activeThemeBranding?.favicon ? `${activeThemeBranding.favicon}${versionStr}` : image;
    const appleTouchIconUrl = activeThemeBranding?.appleTouchIcon ? `${activeThemeBranding.appleTouchIcon}${versionStr}` : image;
    const themeColorMeta = activeThemeBranding?.themeColor ? `<meta name="theme-color" content="${activeThemeBranding.themeColor}" />\n` : '';

    const ogTags = `
      <link rel="canonical" href="${ogUrl}" />
      <meta name="robots" content="${isRobotsIndex}" />
      ${themeColorMeta}
      <link rel="icon" href="${faviconUrl}" />
      <link rel="shortcut icon" href="${faviconUrl}" />
      <link rel="apple-touch-icon" href="${appleTouchIconUrl}" />
      <meta property="og:site_name" content="${activeThemeBranding?.appName || storeName}" />
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:image" content="${image}" />
      <meta property="og:url" content="${ogUrl}" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${title}" />
      <meta name="twitter:description" content="${description}" />
      <meta name="twitter:image" content="${image}" />${scriptLd}
    `;

    try {
      let html = '';
      if (process.env.NODE_ENV !== 'production') {
        html = await fs.promises.readFile(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        html = await vite.transformIndexHtml(req.url, html);
        // Replace existing title completely in head AFTER vite transform to prevent overrides
        html = html.replace(/<title>[^<]+<\/title>/, `<title>${title}</title>`);
        html = html.replace('</title>', '</title>\n' + ogTags);
      } else {
        html = await fs.promises.readFile(path.resolve(process.cwd(), 'dist', 'index.html'), 'utf-8');
        // Replace existing title completely in head
        html = html.replace(/<title>[^<]+<\/title>/, `<title>${title}</title>`);
        html = html.replace('</title>', '</title>\n' + ogTags);
      }

      if (ssrContent) {
        html = html.replace('<div id="root"></div>', `<div id="root">${ssrContent}</div>`);
      }

      res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
    } catch(e) {
      console.error("Error rendering HTML:", e);
      const errorMessage = e instanceof Error ? e.message : "Erro interno";
      res.status(500).end(errorMessage);
    }
  });

  let vite: import('vite').ViteDevServer;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
  }


  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    setupOrderListener();
    
    // Background Job: Abandoned Cart Recovery (every 5 minutes)
    console.log("⏱️  [Recovery] Background monitor started.");
    setInterval(async () => {
      try {
        const { serverRecoveryService } = await import('./src/server/services/serverRecoveryService');
        await serverRecoveryService.processAbandonedCarts();
      } catch (e: any) {
        console.error("❌ [Recovery Job Error]:", e.message);
      }
    }, 5 * 60 * 1000); // 5 min
  });
}

import { setupOrderListener } from './src/server/services/firestoreListener';

startServer();
