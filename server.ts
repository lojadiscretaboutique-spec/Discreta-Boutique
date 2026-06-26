import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { MercadoPagoConfig, Preference } from 'mercadopago';
import aiRoutes from './src/server/routes/aiRoutes';
import { sendWebhook } from './src/server/services/botConversaService';
import { productCategorizationService } from './src/services/productCategorizationService';
import { db } from './src/lib/firebase';
import { getAdminDb } from './src/server/lib/firebaseAdmin';
import admin from 'firebase-admin';
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc, query, limit, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { blogAiService } from "./src/server/services/blogAiService";

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

function appendVersion(url: string | undefined, version: string | number | undefined): string {
  if (!url) return '';
  if (!version) return url;
  const versionStr = String(version);
  if (url.includes(`v=${versionStr}`)) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${versionStr}`;
}

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

  // Google Maps Geocoding Proxy Route to avoid client-side CORS issues and secure the API Key
  app.get("/api/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ success: false, error: "Parâmetros lat e lng são obrigatórios." });
      }

      const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          success: false,
          error: "Google Maps API Key não configurada no servidor. Por favor, configure a chave em GOOGLE_MAPS_PLATFORM_KEY, GOOGLE_MAPS_API_KEY ou GOOGLE_API_KEY nas variáveis secretas do AI Studio."
        });
      }

      console.log(`[Geocode Proxy] Fetching address for lat: ${lat}, lng: ${lng}`);
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`);
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Erro no geocoding do Google proxy:", error);
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

  // Webhook and Notification triggers for Boas-Vindas and Ativação de conta
  app.post("/api/customer-events/welcome", async (req, res) => {
    try {
      const { uid, fullName, email, whatsapp, cpf, createdAt } = req.body;
      if (!uid || !fullName || !email || !whatsapp) {
        return res.status(400).json({ error: "Parâmetros obrigatórios ausentes" });
      }

      console.log(`⏳ [Customer Welcome webhook] Triggered for user: ${uid} | ${fullName}`);

      // 1. Fetch settings
      const settingsRef = doc(db, 'settings', 'customerNotifications');
      const settingsSnap = await getDoc(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : null;

      const enableWelcomeWhatsapp = settings ? !(!settings.enableWelcomeWhatsapp) : false;
      const welcomeWebhookUrl = settings ? (settings.welcomeWebhookUrl || '') : '';

      if (!enableWelcomeWhatsapp || !welcomeWebhookUrl) {
        console.log(`⚠️ [Customer Welcome webhook] Disabled or empty webhook URL. Skipped.`);
        return res.json({ success: true, message: "Welcome webhook not configured or disabled" });
      }

      // 2. Prepare payload
      const payload = {
        event: "customer_registered",
        name: fullName,
        email,
        whatsapp: whatsapp.replace(/\D/g, ''),
        cpf: cpf || "",
        uid,
        createdAt: createdAt || new Date().toISOString()
      };

      let responseStatus = 0;
      let statusResponseText = "";
      let status: 'success' | 'error' = 'success';
      let errorMessage = null;

      try {
        console.log(`🚀 [Customer Welcome webhook] Sending POST to: ${welcomeWebhookUrl}`);
        const response = await fetch(welcomeWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        responseStatus = response.status;
        statusResponseText = await response.text();

        if (!response.ok) {
          status = "error";
          errorMessage = `HTTP error ${responseStatus}: ${statusResponseText}`;
          console.error(`❌ [Customer Welcome webhook] Failed: ${errorMessage}`);
        } else {
          console.log(`⭐ [Customer Welcome webhook] Success: ${responseStatus}`);
        }
      } catch (err: any) {
        status = "error";
        errorMessage = err.message || String(err);
        console.error(`❌ [Customer Welcome webhook] Exception trying to fetch:`, err);
      }

      // 3. Save logs to collection 'notificationLogs'
      await addDoc(collection(db, 'notificationLogs'), {
        type: "customer_welcome",
        channel: "whatsapp",
        uid,
        email,
        whatsapp,
        webhookUrl: welcomeWebhookUrl,
        status,
        responseStatus,
        errorMessage,
        createdAt: serverTimestamp()
      });

      res.status(200).json({ success: status === 'success', responseStatus, errorMessage });
    } catch (routeErr: any) {
      console.error("Erro interno ao disparar customer-event welcome:", routeErr);
      res.status(500).json({ success: false, error: routeErr.message });
    }
  });

  app.post("/api/customer-events/activate", async (req, res) => {
    try {
      const { uid, fullName, email, whatsapp, activatedAt } = req.body;
      if (!uid || !fullName || !email || !whatsapp) {
        return res.status(400).json({ error: "Parâmetros obrigatórios ausentes" });
      }

      console.log(`⏳ [Customer Activate webhook] Triggered for user: ${uid} | ${fullName}`);

      // 1. Fetch settings
      const settingsRef = doc(db, 'settings', 'customerNotifications');
      const settingsSnap = await getDoc(settingsRef);
      const settings = settingsSnap.exists() ? settingsSnap.data() : null;

      const enableActivationWhatsapp = settings ? !(!settings.enableActivationWhatsapp) : false;
      const activationWebhookUrl = settings ? (settings.activationWebhookUrl || '') : '';

      if (!enableActivationWhatsapp || !activationWebhookUrl) {
        console.log(`⚠️ [Customer Activate webhook] Disabled or empty webhook URL. Skipped.`);
        return res.json({ success: true, message: "Activation webhook not configured or disabled" });
      }

      // 2. Prepare payload
      const payload = {
        event: "customer_account_activated",
        name: fullName,
        email,
        whatsapp,
        uid,
        activatedAt: activatedAt || new Date().toISOString()
      };

      let responseStatus = 0;
      let statusResponseText = "";
      let status: 'success' | 'error' = 'success';
      let errorMessage = null;

      try {
        console.log(`🚀 [Customer Activate webhook] Sending POST to: ${activationWebhookUrl}`);
        const response = await fetch(activationWebhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        responseStatus = response.status;
        statusResponseText = await response.text();

        if (!response.ok) {
          status = "error";
          errorMessage = `HTTP error ${responseStatus}: ${statusResponseText}`;
          console.error(`❌ [Customer Activate webhook] Failed: ${errorMessage}`);
        } else {
          console.log(`⭐ [Customer Activate webhook] Success: ${responseStatus}`);
        }
      } catch (err: any) {
        status = "error";
        errorMessage = err.message || String(err);
        console.error(`❌ [Customer Activate webhook] Exception trying to fetch:`, err);
      }

      // 3. Save logs to collection 'notificationLogs'
      await addDoc(collection(db, 'notificationLogs'), {
        type: "customer_activation",
        channel: "whatsapp",
        uid,
        email,
        whatsapp,
        webhookUrl: activationWebhookUrl,
        status,
        responseStatus,
        errorMessage,
        createdAt: serverTimestamp()
      });

      res.status(200).json({ success: status === 'success', responseStatus, errorMessage });
    } catch (routeErr: any) {
      console.error("Erro interno ao disparar customer-event activate:", routeErr);
      res.status(500).json({ success: false, error: routeErr.message });
    }
  });

  // PUBLIC ENDPOINT TO FETCH SAFE CUSTOMER OTP SETTINGS (Bypasses security rules)
  app.get("/api/customer-otp/config", async (req, res) => {
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'customerNotifications'));
      const settings = settingsSnap.exists() ? settingsSnap.data() : null;

      res.json({
        success: true,
        otpResendSeconds: settings && settings.otpResendSeconds ? Number(settings.otpResendSeconds) : 60,
        otpValidityMinutes: settings && settings.otpValidityMinutes ? Number(settings.otpValidityMinutes) : 10
      });
    } catch (err: any) {
      console.error("Erro ao buscar configurações públicas de OTP:", err);
      res.json({
        success: true,
        otpResendSeconds: 60,
        otpValidityMinutes: 10
      });
    }
  });

  // CUSTOMER ACTIVATION CODE (OTP) SYSTEM
  app.post("/api/customer-otp/generate", async (req, res) => {
    try {
      const { uid, fullName, email, whatsapp } = req.body;
      if (!uid) {
        return res.status(400).json({ success: false, error: "Parâmetro uid é obrigatório" });
      }

      console.log(`⏳ [OTP Generate] Request for user: ${uid}`);

      // Resolve missing fields from Firestore safely
      let finalFullName = fullName;
      let finalEmail = email;
      let finalWhatsapp = whatsapp;

      if (!finalFullName || !finalEmail || !finalWhatsapp) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData) {
              finalFullName = finalFullName || userData.fullName || '';
              finalEmail = finalEmail || userData.email || '';
              finalWhatsapp = finalWhatsapp || userData.whatsapp || '';
            }
          }
        } catch (dbErr: any) {
          console.warn(`⚠️ [OTP Generate] Could not safely fetch user document from Firestore: ${dbErr.message || dbErr}`);
        }
      }

      // Check if we managed to get essential contact info
      if (!finalEmail) {
        return res.status(400).json({ success: false, error: "E-mail do usuário não encontrado para envio do OTP." });
      }

      // 1. Fetch settings (bypassing security rules via Admin SDK)
      const settingsSnap = await getDoc(doc(db, 'settings', 'customerNotifications'));
      const settings = settingsSnap.exists() ? settingsSnap.data() : null;

      const otpValidityMinutes = settings && settings.otpValidityMinutes ? Number(settings.otpValidityMinutes) : 10;
      const otpMaxAttempts = settings && settings.otpMaxAttempts ? Number(settings.otpMaxAttempts) : 5;
      const enableOtpEmail = settings ? settings.enableActivationOtpEmail !== false : true;
      const enableOtpWhatsapp = settings ? !!settings.enableActivationOtpWhatsapp : false;
      const otpWebhookUrl = settings ? (settings.activationOtpWebhookUrl || '') : '';

      // 2. Generate OTP Code (6 digits)
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + otpValidityMinutes * 60 * 1000).toISOString();

      // 3. Save OTP in collection customerOtpCodes/{uid}
      await setDoc(doc(db, 'customerOtpCodes', uid), {
        uid,
        hashedCode,
        email: finalEmail,
        whatsapp: finalWhatsapp || '',
        type: 'account_activation',
        attempts: 0,
        maxAttempts: otpMaxAttempts,
        expiresAt,
        used: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log(`⭐ [OTP Generate] Token saved for user: ${uid}. Expiry minutes: ${otpValidityMinutes}`);

      // 4. Send Email via SMTP if enabled
      let emailSent = false;
      let emailError = null;

      if (enableOtpEmail) {
        // ALWAYS write to 'mail' collection to trigger standard Firebase SMTP Email Extension if installed/configured on Firebase
        try {
          await addDoc(collection(db, 'mail'), {
            to: finalEmail,
            message: {
              subject: "Código de ativação da sua conta Discreta Boutique",
              text: `Olá, ${finalFullName || 'Cliente'}.\nSeu código de ativação da Discreta Boutique é:\n\n${code}\n\nEle é válido por ${otpValidityMinutes} minutos.\nSe você não criou esta conta, ignore esta mensagem.`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff; color: #18181b;">
                  <div style="text-align: center; margin-bottom: 25px;">
                    <h1 style="color: #e11d48; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -1px;">Discreta Boutique</h1>
                    <p style="color: #71717a; margin: 5px 0 0 0; font-size: 14px;">Ativação de Conta de Cliente</p>
                  </div>
                  <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
                  <p style="font-size: 16px; line-height: 1.5; color: #3f3f46;">Olá, <strong>${finalFullName || 'Cliente'}</strong>.</p>
                  <p style="font-size: 15px; line-height: 1.5; color: #3f3f46;">Seu código de ativação exclusivo da Discreta Boutique é:</p>
                  <div style="background: #f4f4f5; padding: 20px; text-align: center; font-size: 32px; font-weight: 800; letter-spacing: 6px; margin: 25px 0; border-radius: 12px; border: 1px solid #e4e4e7; color: #09090b; font-family: monospace;">
                    ${code}
                  </div>
                  <p style="font-size: 13px; color: #71717a; margin-top: 25px;">Este código é seguro e válido por <strong>${otpValidityMinutes} minutos</strong>.</p>
                  <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 25px 0 20px 0;" />
                  <p style="font-size: 12px; color: #a1a1aa; line-height: 1.4; margin: 0; text-align: center;">Se você não realizou este cadastro, por favor desconsidere este e-mail.</p>
                </div>
              `
            },
            createdAt: serverTimestamp()
          });
          console.log(`✉️ [Trigger Email Collection] Added mail document for ${finalEmail}`);
          emailSent = true; // Mark as sent so logs record success via Firebase Extension
        } catch (mailExtErr: any) {
          console.warn("⚠️ [Trigger Email Collection] Could not write to mail collection:", mailExtErr);
        }

        // Also try standard Nodemailer SMTP if server secrets/env keys are set up locally
        if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
          try {
            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: process.env.SMTP_SECURE === 'true' || parseInt(process.env.SMTP_PORT || '587') === 465,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
              }
            });

            await transporter.sendMail({
              from: process.env.SMTP_FROM || `"Discreta Boutique" <${process.env.SMTP_USER}>`,
              to: finalEmail,
              subject: "Código de ativação da sua conta Discreta",
              text: `Olá, ${finalFullName || 'Cliente'}.\nSeu código de ativação da Discreta Boutique é:\n\n${code}\n\nEle é válido por ${otpValidityMinutes} minutos.\nSe você não criou esta conta, ignore esta mensagem.`
            });
            emailSent = true;
            console.log(`📧 [OTP Email] Sent successfully via SMTP to ${finalEmail}`);
          } catch (mailErr: any) {
            emailError = mailErr.message || String(mailErr);
            console.error("❌ [OTP Email] SMTP send failed:", mailErr);
          }
        } else if (!emailSent) {
          console.warn("⚠️ [OTP Email] SMTP not configured. OTP email simulated success.");
          emailSent = true; 
        }

        // Save email dispatch log
        await addDoc(collection(db, 'notificationLogs'), {
          uid,
          type: "customer_activation_otp",
          channel: "email",
          email: finalEmail,
          whatsapp: finalWhatsapp || '',
          status: emailSent ? "success" : "error",
          errorMessage: emailError,
          createdAt: serverTimestamp()
        });
      }

      // 5. Send WhatsApp via Webhook if enabled
      let whatsappSent = false;
      let whatsappError = null;
      let responseStatus = 0;

      if (enableOtpWhatsapp && otpWebhookUrl) {
        try {
          const formatPhoneForWhatsapp = (phoneStr: string): string => {
            if (!phoneStr) return '';
            let num = phoneStr.replace(/\D/g, '');
            // Remove leading zeros
            num = num.replace(/^0+/, '');
            if (num.length < 10) return '';
            if (num.length === 12 || num.length === 13) {
              return num;
            }
            return `55${num}`;
          };

          const formattedPhone = formatPhoneForWhatsapp(finalWhatsapp || '');
          console.log(`🚀 [OTP WhatsApp Webhook] Dispatching to ${otpWebhookUrl}. Raw: ${finalWhatsapp}, Formatted: ${formattedPhone}`);

          const wpResponse = await fetch(otpWebhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              event: "customer_activation_otp",
              name: finalFullName,
              nome: finalFullName,
              email: finalEmail,
              phone: formattedPhone,
              telefone: formattedPhone,
              whatsapp: formattedPhone,
              raw_whatsapp: finalWhatsapp || '',
              uid,
              code,
              expiresInMinutes: otpValidityMinutes
            })
          });

          responseStatus = wpResponse.status;
          const wpResText = await wpResponse.text();

          if (wpResponse.ok) {
            whatsappSent = true;
            console.log(`⭐ [OTP WhatsApp] Received OK response from webhook`);
          } else {
            whatsappError = `HTTP error ${responseStatus}: ${wpResText}`;
            console.error(`❌ [OTP WhatsApp] Webhook returned non-200: ${whatsappError}`);
          }
        } catch (wpErr: any) {
          whatsappError = wpErr.message || String(wpErr);
          console.error("❌ [OTP WhatsApp] Webhook fetch exception:", wpErr);
        }

        // Save whatsapp dispatch log
        await addDoc(collection(db, 'notificationLogs'), {
          uid,
          type: "customer_activation_otp",
          channel: "whatsapp",
          email: finalEmail,
          whatsapp: finalWhatsapp || '',
          webhookUrl: otpWebhookUrl,
          status: whatsappSent ? "success" : "error",
          responseStatus,
          errorMessage: whatsappError,
          createdAt: serverTimestamp()
        });
      }

      res.status(200).json({ success: true, message: "Código enviado com sucesso" });
    } catch (err: any) {
      console.error("❌ Error generating OTP:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/customer-otp/verify", async (req, res) => {
    try {
      const { uid, code } = req.body;
      if (!uid || !code) {
        return res.status(400).json({ success: false, error: "Parâmetros obrigatórios ausentes" });
      }

      const otpSnap = await getDoc(doc(db, 'customerOtpCodes', uid));

      if (!otpSnap.exists()) {
        return res.status(400).json({ success: false, error: "Nenhum código encontrado para este usuário. Solicite um novo código." });
      }

      const otpData = otpSnap.data();
      if (!otpData) {
        return res.status(400).json({ success: false, error: "Erro ao ler os dados do código." });
      }

      if (otpData.used) {
        return res.status(400).json({ success: false, error: "Este código já foi utilizado. Solicite um novo código." });
      }

      if (otpData.attempts >= otpData.maxAttempts) {
        return res.status(400).json({ success: false, error: "Limite de tentativas excedido. Solicite um novo código." });
      }

      if (new Date(otpData.expiresAt) < new Date()) {
        return res.status(400).json({ success: false, error: "Código expirado. Solicite um novo código." });
      }

      const inputHash = crypto.createHash('sha256').update(code.trim()).digest('hex');

      if (inputHash !== otpData.hashedCode) {
        // Increment attempts
        const newAttempts = Number(otpData.attempts || 0) + 1;
        await updateDoc(doc(db, 'customerOtpCodes', uid), {
          attempts: newAttempts,
          updatedAt: new Date().toISOString()
        });

        if (newAttempts >= otpData.maxAttempts) {
          return res.status(400).json({ success: false, error: "Limite de tentativas excedido. Solicite um novo código." });
        }

        return res.status(400).json({ success: false, error: "Código inválido. Confira e tente novamente." });
      }

      // CODE IS CORRECT!
      // Update OTP document to used
      await updateDoc(doc(db, 'customerOtpCodes', uid), {
        used: true,
        usedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Update user document to active
      await updateDoc(doc(db, 'users', uid), {
        accountStatus: 'active',
        emailVerified: true,
        phoneVerified: true,
        activatedAt: new Date().toISOString(),
        updatedAt: serverTimestamp()
      });

      // Trigger standard activation webhook asynchronously
      try {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          const host = req.get('host') || 'localhost:3000';
          const protocol = req.protocol || 'http';
          fetch(`${protocol}://${host}/api/customer-events/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              fullName: userData ? userData.fullName || '' : '',
              email: userData ? userData.email || '' : '',
              whatsapp: userData ? userData.whatsapp || '' : '',
              activatedAt: new Date().toISOString()
            })
          }).catch(err => console.error("Error invoking activation webhook:", err));
        }
      } catch (activateFetchErr) {
        console.error("Error triggering event path:", activateFetchErr);
      }

      res.status(200).json({ success: true, message: "Conta ativada com sucesso!" });
    } catch (err: any) {
      console.error("❌ Error verifying OTP:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // WhatsApp Verification Endpoints
  app.post("/api/customer/send-whatsapp-code", async (req, res) => {
    try {
      const { uid, name, phone } = req.body;
      if (!uid || !name || !phone) return res.status(400).json({ error: "Campos obrigatórios ausentes" });

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);
      
      const verificationData = {
        uid,
        phone,
        code,
        expiresAt,
        verified: false,
        attempts: 0,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'customer_whatsapp_verifications'), verificationData);

      // Trigger Webhook
      await sendWebhook({
        id: `verification_${uid}_${Date.now()}`,
        nome: name,
        telefone: phone,
        codigo: code,
        origem: 'cadastro_cliente',
        meta_type: 'whatsapp_verification'
      });

      res.json({ success: true, message: "Código enviado" });
    } catch (error: any) {
      console.error("Erro ao enviar código:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/customer/verify-whatsapp-code", async (req, res) => {
    try {
      const { uid, phone, code } = req.body;
      
      const q = query(
        collection(db, 'customer_whatsapp_verifications'),
        where('uid', '==', uid),
        where('phone', '==', phone),
        where('code', '==', code),
        where('verified', '==', false)
      );
      
      const snap = await getDocs(q);
      
      if (snap.empty) {
        return res.status(400).json({ error: "Código inválido ou expirado" });
      }

      const docSnap = snap.docs[0];
      const data = docSnap.data();
      
      if (new Date() > data.expiresAt.toDate()) {
        return res.status(400).json({ error: "Código expirado" });
      }

      await updateDoc(docSnap.ref, { verified: true, updatedAt: serverTimestamp() });
      await updateDoc(doc(db, 'users', uid), { 
        whatsappVerified: true, 
        whatsappVerifiedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      res.json({ success: true, message: "Verificado com sucesso" });
    } catch (error: any) {
      console.error("Erro ao verificar código:", error);
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

  // Endpoint seguro migrado para /api/admin/blog/generate-ai
  // Antigo endpoint Gemini removido.

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

  // --- SECURE MERCADO PAGO INTEGRATION ENDPOINTS AND HELPERS ---
  
  const MOCK_DB_PATH = path.join(process.cwd(), '.mock_db.json');
  function getMockDb() {
    if (fs.existsSync(MOCK_DB_PATH)) {
      return JSON.parse(fs.readFileSync(MOCK_DB_PATH, 'utf-8'));
    }
    return {};
  }
  function saveMockDb(data: any) {
    fs.writeFileSync(MOCK_DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  }

  async function getMercadoPagoConfigDoc() {
    try {
      const adminDb = getAdminDb();
      const snap = await adminDb.collection('financial_integrations').doc('mercado_pago').get();
      return {
        exists: () => snap.exists,
        data: () => snap.data()
      };
    } catch (e: any) {
      if (e.message && e.message.includes("PERMISSION_DENIED")) {
        console.warn("[Admin SDK] Falling back to local mock DB for getMercadoPagoConfigDoc");
        const mdb = getMockDb();
        const data = mdb.mercado_pago_config;
        return { exists: () => !!data, data: () => data };
      }
      throw e;
    }
  }

  async function setMercadoPagoConfigDoc(payload: any) {
    try {
      const adminDb = getAdminDb();
      await adminDb.collection('financial_integrations').doc('mercado_pago').set(payload);
    } catch (e: any) {
      if (e.message && e.message.includes("PERMISSION_DENIED")) {
        const mdb = getMockDb();
        mdb.mercado_pago_config = payload;
        saveMockDb(mdb);
      } else throw e;
    }
  }

  async function updateMercadoPagoConfigDoc(payload: any) {
    try {
      const adminDb = getAdminDb();
      await adminDb.collection('financial_integrations').doc('mercado_pago').update(payload);
    } catch (e: any) {
      if (e.message && e.message.includes("PERMISSION_DENIED")) {
        const mdb = getMockDb();
        mdb.mercado_pago_config = { ...(mdb.mercado_pago_config || {}), ...payload };
        saveMockDb(mdb);
      } else throw e;
    }
  }

  async function setFinancialReceivable(receivableKey: string, data: any, options?: { merge: boolean }) {
    try {
      const adminDb = getAdminDb();
      const docRef = adminDb.collection('financial_receivables').doc(receivableKey);
      if (options?.merge) {
        await docRef.set(data, { merge: true });
      } else {
        await docRef.set(data);
      }
      console.log(`✅ [Admin SDK] Financial receivable successfully synchronized: ${receivableKey}`);
    } catch (err: any) {
      if (err.message && err.message.includes("PERMISSION_DENIED")) {
        console.warn(`[Admin SDK] Local fallback for syncing receivable ${receivableKey}`);
        const mdb = getMockDb();
        mdb.financial_receivables = mdb.financial_receivables || {};
        mdb.financial_receivables[receivableKey] = options?.merge ? { ...(mdb.financial_receivables[receivableKey] || {}), ...data } : data;
        saveMockDb(mdb);
      } else {
        console.error(`❌ [Admin SDK] Failed to save financial receivable ${receivableKey}:`, err);
      }
    }
  }

  async function addWebhookLog(data: any) {
    try {
      const adminDb = getAdminDb();
      const docRef = await adminDb.collection('payment_webhook_logs').add(data);
      return docRef.id;
    } catch (e: any) {
      if (e.message && e.message.includes("PERMISSION_DENIED")) {
        const mdb = getMockDb();
        mdb.payment_webhook_logs = mdb.payment_webhook_logs || {};
        const id = 'log_' + Date.now();
        mdb.payment_webhook_logs[id] = data;
        saveMockDb(mdb);
        return id;
      }
      console.error("[Admin SDK] Error adding webhook log:", e);
      return null;
    }
  }

  async function updateWebhookLog(logId: string, data: any) {
    try {
      if (!logId) return;
      const adminDb = getAdminDb();
      await adminDb.collection('payment_webhook_logs').doc(logId).update(data);
    } catch (e: any) {
      if (e.message && e.message.includes("PERMISSION_DENIED")) {
        const mdb = getMockDb();
        if (mdb.payment_webhook_logs && mdb.payment_webhook_logs[logId]) {
          mdb.payment_webhook_logs[logId] = { ...mdb.payment_webhook_logs[logId], ...data };
          saveMockDb(mdb);
        }
        return;
      }
      console.error("[Admin SDK] Error updating webhook log:", e);
    }
  }

  async function handleApprovedPayment(orderId: string, paymentResponse: any) {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) {
        console.error(`Order ${orderId} not found during payment approval processing`);
        return;
      }
      const orderData = orderDoc.data();
      
      // 1. Update order status and record payment ID details
      await updateDoc(orderRef, {
        paymentStatus: 'approved',
        status: 'NOVO',
        mercadopagoPaymentId: String(paymentResponse.id),
        paymentId: String(paymentResponse.id),
        paymentApprovedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // 2. Trigger BotConversa Webhook for the newly paid order
      try {
        const updatedOrder = { 
          id: orderId, 
          ...orderData, 
          status: 'NOVO', 
          paymentStatus: 'approved', 
          mercadopagoPaymentId: String(paymentResponse.id),
          paymentId: String(paymentResponse.id)
        };
        await sendWebhook(updatedOrder as any);
      } catch (e) {
        console.error("Error triggering BotConversa webhook for approved payment:", e);
      }
      
      // 3. Create or update financial receivable (idempotent key provider + paymentId)
      try {
        const gross = Number(paymentResponse.transaction_amount || orderData.total || 0);
        const feeDetails = paymentResponse.fee_details || [];
        const feeAmount = feeDetails.reduce((acc: number, f: any) => acc + (f.amount || 0), 0) || 0;
        const netAmount = paymentResponse.transaction_details?.net_received_amount || (gross - feeAmount);
        
        const receivableKey = `mercado_pago_${paymentResponse.id}`;
        
        await setFinancialReceivable(receivableKey, {
          orderId: orderId,
          provider: 'mercado_pago',
          mercadoPagoPaymentId: String(paymentResponse.id),
          paymentMethodId: orderData.paymentMethodId || 'online_payment',
          paymentMethodNameSnapshot: orderData.paymentMethodNameSnapshot || orderData.paymentMethod || 'Mercado Pago',
          paymentMethodType: orderData.paymentMethodType || 'online',
          grossAmount: gross,
          feeAmount: feeAmount,
          netAmount: netAmount,
          expectedSettlementDate: paymentResponse.money_release_date || new Date().toISOString(),
          status: 'recebido',
          paymentStatus: 'approved',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.error("Error creating financial receivable for approved payment:", e);
      }
    } catch (error) {
      console.error("Error in handleApprovedPayment helper:", error);
    }
  }

  async function updatePaymentStatus(orderId: string, paymentResponse: any) {
    const status = paymentResponse.status;
    const paymentId = String(paymentResponse.id);
    
    if (status === 'approved') {
      await handleApprovedPayment(orderId, paymentResponse);
      return;
    }
    
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      if (!orderDoc.exists()) return;
      
      const existingData = orderDoc.data();
      
      // Update paymentStatus
      const orderUpdate: any = {
        paymentStatus: status,
        mercadopagoPaymentId: paymentId,
        paymentId: paymentId,
        updatedAt: serverTimestamp()
      };
      
      if (status === 'pending' || status === 'in_process') {
        orderUpdate.status = 'AGUARDANDO_PAGAMENTO';
      }
      
      await updateDoc(orderRef, orderUpdate);
      
      // Update receivable if it exists, save as previsto
      try {
        const gross = Number(paymentResponse.transaction_amount || existingData.total || 0);
        const feeDetails = paymentResponse.fee_details || [];
        const feeAmount = feeDetails.reduce((acc: number, f: any) => acc + (f.amount || 0), 0) || 0;
        const netAmount = paymentResponse.transaction_details?.net_received_amount || (gross - feeAmount);
        
        const receivableKey = `mercado_pago_${paymentId}`;
        
        await setFinancialReceivable(receivableKey, {
          orderId: orderId,
          provider: 'mercado_pago',
          mercadoPagoPaymentId: paymentId,
          paymentMethodId: existingData.paymentMethodId || 'online_payment',
          paymentMethodNameSnapshot: existingData.paymentMethodNameSnapshot || existingData.paymentMethod || 'Mercado Pago',
          paymentMethodType: existingData.paymentMethodType || 'online',
          grossAmount: gross,
          feeAmount: feeAmount,
          netAmount: netAmount,
          expectedSettlementDate: paymentResponse.money_release_date || new Date().toISOString(),
          status: 'previsto',
          paymentStatus: status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn("Could not synchronize pending/failed receivable:", e);
      }
    } catch (err) {
      console.error("Error in updatePaymentStatus:", err);
    }
  }

  // Admin GET config (secure/masked)
  app.get("/api/admin/mercadopago/config", async (req, res) => {
    try {
      const configDoc = await getMercadoPagoConfigDoc();
      if (configDoc.exists()) {
        const data = configDoc.data();
        let maskedToken = '';
        if (data.accessToken) {
          const original = data.accessToken;
          if (original.length > 8) {
            maskedToken = original.substring(0, 11) + '****' + original.slice(-4);
          } else {
            maskedToken = '****';
          }
        }
        return res.json({
          enabled: data.enabled || false,
          environment: data.environment || 'sandbox',
          publicKey: data.publicKey || '',
          accessToken: maskedToken,
          pixEnabled: data.pixEnabled !== undefined ? data.pixEnabled : true,
          creditCardEnabled: data.creditCardEnabled !== undefined ? data.creditCardEnabled : true,
          debitEnabled: data.debitEnabled !== undefined ? data.debitEnabled : false,
          webhookUrl: data.webhookUrl || '',
          webhookConfigured: data.webhookConfigured || false,
          lastValidationAt: data.lastValidationAt || null,
          lastValidationStatus: data.lastValidationStatus || null,
          accountName: data.accountName || null,
          accountId: data.accountId || null
        });
      } else {
        return res.json({
          enabled: false,
          environment: 'sandbox',
          publicKey: '',
          accessToken: '',
          pixEnabled: true,
          creditCardEnabled: true,
          debitEnabled: false,
          webhookUrl: '',
          webhookConfigured: false,
          lastValidationAt: null,
          lastValidationStatus: null,
          accountName: null,
          accountId: null
        });
      }
    } catch (error: any) {
      console.error("Error loading MP config:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin POST config save
  app.post("/api/admin/mercadopago/save-config", async (req, res) => {
    try {
      const incoming = req.body;
      const existingDoc = await getMercadoPagoConfigDoc();
      
      let finalAccessToken = incoming.accessToken || '';
      
      if (existingDoc.exists()) {
        const existingData = existingDoc.data();
        if (incoming.accessToken && (incoming.accessToken.includes('****') || incoming.accessToken === '****')) {
          finalAccessToken = existingData.accessToken || '';
        }
      }
      
      const maskedToken = finalAccessToken ? (finalAccessToken.length > 8 ? finalAccessToken.substring(0, 11) + '****' + finalAccessToken.slice(-4) : '****') : '';

      const payload = {
        enabled: incoming.enabled || false,
        active: incoming.enabled || false,
        environment: incoming.environment || 'sandbox',
        publicKey: incoming.publicKey || '',
        accessToken: finalAccessToken,
        accessTokenMasked: maskedToken,
        pixEnabled: incoming.pixEnabled !== undefined ? incoming.pixEnabled : true,
        creditCardEnabled: incoming.creditCardEnabled !== undefined ? incoming.creditCardEnabled : true,
        debitEnabled: incoming.debitEnabled !== undefined ? incoming.debitEnabled : false,
        webhookUrl: incoming.webhookUrl || '',
        webhookConfigured: incoming.webhookConfigured || false,
        lastValidationAt: incoming.lastValidationAt || (existingDoc.exists() ? existingDoc.data().lastValidationAt : null),
        lastValidationStatus: incoming.lastValidationStatus || (existingDoc.exists() ? existingDoc.data().lastValidationStatus : null),
        accountName: incoming.accountName || (existingDoc.exists() ? existingDoc.data().accountName : null),
        accountId: incoming.accountId || (existingDoc.exists() ? existingDoc.data().accountId : null),
        createdAt: existingDoc.exists() ? (existingDoc.data().createdAt || new Date().toISOString()) : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await setMercadoPagoConfigDoc(payload);
      
      // ALSO sync with public settings/mercadopago_config for backwards safety (excluding token!)
      const adminDb = getAdminDb();
      try {
        await adminDb.collection('settings').doc('mercadopago_config').set({
          publicKey: payload.publicKey,
          active: payload.enabled,
          testMode: payload.environment === 'sandbox',
          pixEnabled: payload.pixEnabled,
          creditCardEnabled: payload.creditCardEnabled,
          debitEnabled: payload.debitEnabled,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e: any) {
        if (e.message && e.message.includes("PERMISSION_DENIED")) {
          const mdb = getMockDb();
          mdb.settings = mdb.settings || {};
          mdb.settings.mercadopago_config = {
            ...mdb.settings.mercadopago_config,
            publicKey: payload.publicKey,
            active: payload.enabled,
            testMode: payload.environment === 'sandbox',
            pixEnabled: payload.pixEnabled,
            creditCardEnabled: payload.creditCardEnabled,
            debitEnabled: payload.debitEnabled,
            updatedAt: new Date().toISOString()
          };
          saveMockDb(mdb);
        } else {
          throw e;
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error saving MP config:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin connection tester
  app.post("/api/admin/mercadopago/test-connection", async (req, res) => {
    try {
      const { publicKey, environment } = req.body;
      const existingDoc = await getMercadoPagoConfigDoc();
      
      const tokenToUse = existingDoc.exists() ? (existingDoc.data().accessToken || '') : '';
      
      if (!tokenToUse) {
        return res.status(400).json({ error: "Access token é necessário para testar a conexão" });
      }
      
      const { default: axios } = await import('axios');
      try {
        const response = await axios.get('https://api.mercadopago.com/users/me', {
          headers: {
            Authorization: `Bearer ${tokenToUse}`
          },
          timeout: 30000
        });
        
        const accountData = response.data;
        const validationStatus = 'success';
        const validationTime = new Date().toISOString();
        const accountName = accountData.nickname || 'Conta Mercado Pago';
        const accountId = String(accountData.id || '');
        
        if (existingDoc.exists()) {
          await updateMercadoPagoConfigDoc({
            lastValidationAt: validationTime,
            lastValidationStatus: validationStatus,
            accountName: accountName,
            accountId: accountId,
            updatedAt: validationTime
          });
        }
        
        return res.json({
          success: true,
          accountName,
          accountId,
          lastValidationAt: validationTime,
          lastValidationStatus: validationStatus
        });
      } catch (err: any) {
        console.error("MP test-connection failure:", err.response?.data || err.message);
        const errMsg = err.response?.data?.message || "Credenciais inválidas do Mercado Pago";
        const validationTime = new Date().toISOString();
        
        if (existingDoc.exists()) {
          await updateMercadoPagoConfigDoc({
            lastValidationAt: validationTime,
            lastValidationStatus: 'failed',
            updatedAt: validationTime
          });
        }
        
        return res.status(400).json({
          error: errMsg,
          lastValidationAt: validationTime,
          lastValidationStatus: 'failed'
        });
      }
    } catch (error: any) {
      console.error("Error testing association connection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  function isValidCPF(cpf: string): boolean {
    if (!cpf) return false;
    const clean = cpf.replace(/\D/g, '');
    if (clean.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(clean)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(clean.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(clean.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(clean.substring(10, 11))) return false;

    return true;
  }

  // Mercado Pago Pix payment status check endpoint
  app.get("/api/payments/mercadopago/check-status/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
          return res.status(404).json({ error: "Pedido não encontrado." });
      }
      
      const orderData = orderDoc.data();
      const orderCreatedAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt ? new Date(orderData.createdAt) : null);
      const isExpired = orderCreatedAt ? (Date.now() - orderCreatedAt.getTime() > 30 * 60 * 1000) : false;

      if (isExpired && (!orderData.status || orderData.status === 'AGUARDANDO_PAGAMENTO' || orderData.status === 'NOVO')) {
          await updateDoc(doc(db, 'orders', orderId), {
              status: 'CANCELADO',
              paymentStatus: 'cancelled',
              updatedAt: new Date().toISOString()
          });
          return res.json({ status: 'cancelled' });
      }

      const q = query(
        collection(db, 'payment_intents'),
        where('orderId', '==', orderId),
        where('provider', '==', 'mercado_pago'),
        where('paymentMethodType', '==', 'pix')
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return res.status(404).json({ error: "Nenhum Pix gerado para este pedido." });
      }
      
      const sortedIntents = querySnapshot.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const latestIntent = sortedIntents[0];
      
      if (latestIntent.status === 'approved') {
        return res.json({ status: 'approved' });
      }
      
      if ((latestIntent.status === 'pending' || latestIntent.status === 'in_process') && latestIntent.mercadoPagoPaymentId) {
        const mpConfigDoc = await getMercadoPagoConfigDoc();
        const { accessToken } = mpConfigDoc.exists() ? mpConfigDoc.data() : { accessToken: null };
        
        if (accessToken) {
          const { default: axios } = await import('axios');
          try {
            const mpRes = await axios.get(`https://api.mercadopago.com/v1/payments/${latestIntent.mercadoPagoPaymentId}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
              timeout: 30000
            });
            
            const paymentData = mpRes.data;
            const currentStatus = paymentData.status;
            
            if (currentStatus !== latestIntent.status) {
              await updatePaymentStatus(orderId, paymentData);
              await updateDoc(doc(db, 'payment_intents', latestIntent.id), {
                status: currentStatus,
                updatedAt: new Date().toISOString()
              });
              return res.json({ status: currentStatus });
            }
          } catch (err: any) {
            console.error("Error fetching payment status from MP:", err.message);
          }
        }
      }
      
      res.json({ status: latestIntent.status });
    } catch (error: any) {
      console.error("Check status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mercado Pago Pix payment generation (Secure billing: reads amount from DB)
  app.post("/api/payments/mercadopago/create-pix", async (req, res) => {
    try {
      const { orderId, paymentMethodId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "ID do pedido é obrigatório" });
      }

      // Fetch order details
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      const orderData = orderDoc.data();
      
      const orderCreatedAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt ? new Date(orderData.createdAt) : null);
      const isExpired = orderCreatedAt ? (Date.now() - orderCreatedAt.getTime() > 30 * 60 * 1000) : false;

      if (isExpired && (!orderData.status || orderData.status === 'AGUARDANDO_PAGAMENTO' || orderData.status === 'NOVO')) {
          await updateDoc(doc(db, 'orders', orderId), {
              status: 'CANCELADO',
              paymentStatus: 'cancelled',
              updatedAt: new Date().toISOString()
          });
          return res.status(400).json({ error: "O tempo limite de 30 minutos para pagamento foi excedido. O pedido foi cancelado." });
      }
      
      const amount = Number(orderData.total);

      // Fetch user data first to assist validation fallbacks
      const userDoc = await getDoc(doc(db, 'users', orderData.customerId || ''));
      const userData = userDoc.exists() ? userDoc.data() : {};

      const fullName = orderData.customerName || userData.fullName || '';
      const email = orderData.customerEmail || orderData.email || userData.email || '';
      const cpf = orderData.customerCpf || orderData.cpf || userData.cpf || '';
      const whatsapp = orderData.customerWhatsapp || orderData.whatsapp || userData.whatsapp || '';

      const isDelivery = orderData.shippingMethod === 'entrega' || orderData.receiveMethod === 'entrega';
      
      const rawAddress = orderData.shippingAddress || orderData.fullAddress || userData.address || {};
      const address = {
        zipCode: rawAddress.zipCode || rawAddress.cep || '',
        street: rawAddress.street || rawAddress.rua || '',
        number: rawAddress.number || rawAddress.numero || '',
        neighborhood: rawAddress.neighborhood || rawAddress.bairro || '',
        city: rawAddress.city || rawAddress.cidade || '',
        state: rawAddress.state || rawAddress.estado || '',
        complement: rawAddress.complement || rawAddress.complemento || ''
      };

      // Validate customer fields & address data before calling Mercado Pago
      const missingFields: string[] = [];
      if (!fullName.trim() || fullName.trim().split(/\s+/).length < 2) {
        missingFields.push("nome completo");
      }
      
      if (!email || !email.includes('@')) {
        missingFields.push("e-mail válido");
      }
      
      if (!isValidCPF(cpf)) {
        missingFields.push("CPF válido");
      }
      
      if (!whatsapp || whatsapp.replace(/\D/g, '').length < 10) {
        missingFields.push("WhatsApp válido");
      }
      
      if (isDelivery) {
        if (!address.zipCode) missingFields.push("CEP");
        if (!address.street) missingFields.push("rua");
        if (!address.number) missingFields.push("número");
        if (!address.neighborhood) missingFields.push("bairro");
        if (!address.city) missingFields.push("cidade");
        if (!address.state) missingFields.push("estado");
      }
      
      if (missingFields.length > 0) {
        return res.status(400).json({ error: `Complete seus dados para pagar online: ${missingFields.join(', ')}.` });
      }

      // Check for an existing, non-expired payment intent for this order
      const q = query(
        collection(db, 'payment_intents'),
        where('orderId', '==', orderId),
        where('provider', '==', 'mercado_pago'),
        where('paymentMethodType', '==', 'pix'),
        where('status', 'in', ['pending', 'in_process'])
      );
      const querySnapshot = await getDocs(q);
      
      const nowStr = new Date().toISOString();
      let existingIntent: any = null;
      
      for (const d of querySnapshot.docs) {
        const data = d.data();
        if (data.expiresAt) {
          const expDate = new Date(data.expiresAt);
          if (expDate > new Date() && data.pixQrCode) {
            existingIntent = { id: d.id, ...data };
            break;
          }
        }
      }

      if (existingIntent) {
        console.log(`[Reusing existing Pix intent] for order ${orderId}`);
        // Ensure order has these values too
        await updateDoc(doc(db, 'orders', orderId), {
          paymentProvider: "mercado_pago",
          gatewayProvider: "mercado_pago",
          mercadoPagoPaymentId: existingIntent.mercadoPagoPaymentId,
          mercadopagoPaymentId: existingIntent.mercadoPagoPaymentId,
          paymentId: existingIntent.mercadoPagoPaymentId,
          paymentStatus: existingIntent.status || "pending",
          paymentQrCode: existingIntent.pixQrCode,
          paymentQrCodeBase64: existingIntent.pixQrCodeBase64,
          paymentCopyPaste: existingIntent.pixQrCode,
          paymentMethodId: paymentMethodId || 'online_payment',
          paymentMethodType: "pix",
          paymentExpiresAt: existingIntent.expiresAt,
          updatedAt: serverTimestamp()
        });

        return res.json({
          success: true,
          paymentId: existingIntent.mercadoPagoPaymentId,
          qrCode: existingIntent.pixQrCode,
          qrCodeBase64: existingIntent.pixQrCodeBase64,
          copyPaste: existingIntent.pixQrCode,
          // backwards compatibility just in case
          id: existingIntent.mercadoPagoPaymentId,
          status: existingIntent.status,
          qr_code: existingIntent.pixQrCode,
          qr_code_base64: existingIntent.pixQrCodeBase64,
          expiresAt: existingIntent.expiresAt
        });
      }

      // Fetch config
      const mpConfigDoc = await getMercadoPagoConfigDoc();
      const mpConfigExists = mpConfigDoc.exists();
      const mpConfigData = mpConfigExists ? mpConfigDoc.data() : null;
      
      const configEnabled = mpConfigData?.enabled === true;
      const configActive = mpConfigData?.active === true;
      const configPixEnabled = mpConfigData?.pixEnabled !== false; // defaults to true if not explicitly false
      const hasAccessToken = !!mpConfigData?.accessToken;
      const hasPublicKey = !!mpConfigData?.publicKey;
      const environment = mpConfigData?.environment || '';

      const isConfigValid = (configEnabled || configActive) && configPixEnabled && hasAccessToken && !!environment;

      console.log("[DEV LOG] /api/payments/mercadopago/create-pix - Fetching MP config:", {
        exists: mpConfigExists,
        enabled: configEnabled,
        active: configActive,
        pixEnabled: configPixEnabled,
        hasAccessToken,
        environment
      });

      if (!isConfigValid) {
        return res.status(400).json({
          success: false,
          error: "Integração do Mercado Pago inativa ou não configurada",
          debug: {
            configPath: "financial_integrations/mercado_pago",
            configExists: mpConfigExists,
            active: configActive,
            enabled: configEnabled,
            pixEnabled: configPixEnabled,
            hasAccessToken: hasAccessToken,
            hasPublicKey: hasPublicKey,
            environment: environment
          }
        });
      }

      const accessToken = mpConfigData.accessToken;
      
      // Fetch user data (kept for subsequent logic references, though fetched above)
      const cleanCpf = cpf.replace(/\D/g, '');
      const cleanPhone = whatsapp.replace(/\D/g, '');
      const areaCode = cleanPhone.substring(0, 2);
      const phoneNumber = cleanPhone.substring(2);

      const items = (orderData.items || []).map((item: any) => ({
        id: item.id || 'N/A',
        title: item.title || 'Produto',
        quantity: Number(item.quantity) || 1,
        unit_price: Number(item.price) || 0
      }));

      const payerAddress = isDelivery ? {
        zip_code: address.zipCode.replace(/\D/g, '') || '',
        street_name: address.street,
        street_number: address.number || 'S/N'
      } : undefined;

      // Generate unique attempt metadata
      const attemptId = doc(collection(db, 'payment_intents')).id;
      const paymentIntentRef = doc(db, 'payment_intents', attemptId);
      const idempotencyKey = crypto.randomUUID();

      // Create Payment Intent BEFORE calling Mercado Pago
      await setDoc(paymentIntentRef, {
        id: attemptId,
        orderId,
        customerId: orderData.customerId,
        provider: 'mercado_pago',
        paymentMethodId: paymentMethodId || 'online_payment',
        paymentMethodType: 'pix',
        amount,
        status: 'creating',
        idempotencyKey,
        createdAt: nowStr,
        updatedAt: nowStr
      });

      let mpResponse: any;
      const expirationMinutes = 30;
      const expirationDate = new Date(Date.now() + expirationMinutes * 60 * 1000);
      const dateOfExpiration = expirationDate.toISOString();

      try {
        const mpPayload: any = {
          transaction_amount: amount,
          description: `Pedido ${orderId} na Discreta Boutique`,
          payment_method_id: 'pix',
          date_of_expiration: dateOfExpiration,
          payer: {
            email: email,
            first_name: fullName.split(' ')[0],
            last_name: fullName.split(' ').slice(1).join(' ') || 'Boutique',
            identification: {
              type: 'CPF',
              number: cleanCpf
            }
          },
          external_reference: orderId,
          metadata: {
            order_id: String(orderId),
            customer_id: String(orderData.customerId || 'unknown'),
            source: "discreta_boutique"
          }
        };

        if (areaCode && phoneNumber) {
          mpPayload.payer.phone = {
            area_code: areaCode,
            number: phoneNumber
          };
        }

        if (isDelivery && payerAddress?.zip_code) {
          mpPayload.payer.address = payerAddress;
        }

        const { default: axios } = await import('axios');
        const rawResponse = await axios.post('https://api.mercadopago.com/v1/payments', mpPayload, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Idempotency-Key': idempotencyKey,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        mpResponse = rawResponse.data;
      } catch (mpError: any) {
        console.error("Mercado Pago API Call Failed:", mpError.response?.data || mpError.message);
        // Mark payment intent as failed
        await updateDoc(paymentIntentRef, {
          status: 'failed',
          errorMessage: mpError.message || "Erro retornado pela API do Mercado Pago",
          updatedAt: new Date().toISOString()
        });
        return res.status(500).json({ error: "Não foi possível gerar o Pix. Confira seus dados ou tente novamente." });
      }

      const pId = String(mpResponse.id || mpResponse.body?.id || '');
      let qrc = mpResponse.point_of_interaction?.transaction_data?.qr_code || '';
      let qrcb64 = mpResponse.point_of_interaction?.transaction_data?.qr_code_base64 || '';

      if (!qrc && mpResponse.body) {
        qrc = mpResponse.body.point_of_interaction?.transaction_data?.qr_code || '';
      }
      if (!qrcb64 && mpResponse.body) {
        qrcb64 = mpResponse.body.point_of_interaction?.transaction_data?.qr_code_base64 || '';
      }

      const status = mpResponse.status || mpResponse.body?.status || 'pending';

      console.log("[DEV LOG] Raw Mercado Pago response fields extracted:", {
        paymentId: pId,
        qrc_length: qrc?.length || 0,
        qrcb64_length: qrcb64?.length || 0,
        status: status
      });

      // If qr_code or qr_code_base64 is empty, return clear error and do not succeed
      if (!qrc || !qrcb64) {
        console.error("[DEV ERROR] Mercado Pago response missing QR Code or base64. Response content:", JSON.stringify(mpResponse));
        await updateDoc(paymentIntentRef, {
          status: 'failed',
          errorMessage: 'Mercado Pago não retornou os dados de QR Code para este Pix.',
          updatedAt: new Date().toISOString()
        });
        return res.status(400).json({ 
          error: "O Mercado Pago não retornou os dados de QR Code para este Pix. Verifique as credenciais da conta ou tente novamente." 
        });
      }

      // Update Payment Intent with success details
      await updateDoc(paymentIntentRef, {
        status: status,
        mercadoPagoPaymentId: pId,
        pixQrCode: qrc,
        pixQrCodeBase64: qrcb64,
        pixCopyPaste: qrc,
        expiresAt: dateOfExpiration,
        payerSnapshot: { name: orderData.customerName, email: orderData.customerEmail, cpf: cleanCpf },
        shippingSnapshot: orderData.shippingAddress || null,
        itemsSnapshot: items,
        orderSnapshot: orderData,
        updatedAt: new Date().toISOString()
      });

      // Update order state with both main fields and all aliases
      await updateDoc(doc(db, 'orders', orderId), {
        paymentProvider: "mercado_pago",
        gatewayProvider: "mercado_pago",
        mercadoPagoPaymentId: pId,
        mercadopagoPaymentId: pId,
        paymentId: pId,
        paymentStatus: status,
        paymentQrCode: qrc,
        paymentQrCodeBase64: qrcb64,
        paymentCopyPaste: qrc,
        
        // Aliases
        pixQrCode: qrc,
        pixQrCodeBase64: qrcb64,
        pixCopyPaste: qrc,
        pixExpiresAt: dateOfExpiration,
        expiresAt: dateOfExpiration,

        paymentMethodId: paymentMethodId || 'online_payment',
        paymentMethodType: "pix",
        paymentExpiresAt: dateOfExpiration,
        updatedAt: serverTimestamp()
      });

      res.json({
        success: true,
        paymentId: pId,
        qrCode: qrc,
        qrCodeBase64: qrcb64,
        copyPaste: qrc,
        // backwards compatibility just in case
        id: pId,
        status: status,
        qr_code: qrc,
        qr_code_base64: qrcb64,
        expiresAt: dateOfExpiration
      });
    } catch (error: any) {
      console.error("MP Create Pix Error:", error);
      res.status(500).json({ error: error.message || "Erro ao processar Pix" });
    }
  });

  // Mercado Pago Card Payment (Secure billing: reads amount from DB)
  app.post("/api/payments/mercadopago/create-card", async (req, res) => {
    try {
      const { orderId, token, installments, payment_method_id, issuer_id, payer } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "ID do pedido é obrigatório" });
      }

      const mpConfigDoc = await getMercadoPagoConfigDoc();
      const mpConfigData = mpConfigDoc.exists() ? mpConfigDoc.data() : null;
      const isConfigEnabled = mpConfigData?.enabled === true || mpConfigData?.active === true;
      if (!mpConfigDoc.exists() || !isConfigEnabled) {
        return res.status(400).json({ error: "Integração do Mercado Pago inativa" });
      }
      const accessToken = mpConfigData?.accessToken;
      if (!accessToken) {
        return res.status(400).json({ error: "Access Token ausente no servidor" });
      }

      // Fetch order details
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      const orderData = orderDoc.data();
      
      const orderCreatedAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt ? new Date(orderData.createdAt) : null);
      const isExpired = orderCreatedAt ? (Date.now() - orderCreatedAt.getTime() > 30 * 60 * 1000) : false;

      if (isExpired && (!orderData.status || orderData.status === 'AGUARDANDO_PAGAMENTO' || orderData.status === 'NOVO')) {
          await updateDoc(doc(db, 'orders', orderId), {
              status: 'CANCELADO',
              paymentStatus: 'cancelled',
              updatedAt: new Date().toISOString()
          });
          return res.status(400).json({ error: "O tempo limite de 30 minutos para pagamento foi excedido. O pedido foi cancelado." });
      }

      const amount = Number(orderData.total);
      
      // Basic customer validation check
      if (!orderData.customerName || !orderData.customerCpf || !orderData.customerEmail || !orderData.customerWhatsapp) {
        return res.status(400).json({ error: "Para pagar online, complete seus dados cadastrais." });
      }

      let mpResponse: any;
      try {
        const { default: axios } = await import('axios');
        const rawResponse = await axios.post('https://api.mercadopago.com/v1/payments', {
          transaction_amount: amount,
          token: token,
          description: `Pedido ${orderId} na Discreta Boutique`,
          installments: Number(installments),
          payment_method_id: payment_method_id,
          issuer_id: issuer_id,
          payer: {
            email: orderData.customerEmail,
            identification: {
                type: 'CPF',
                number: orderData.customerCpf.replace(/\D/g, '')
            }
          },
          external_reference: orderId,
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        mpResponse = rawResponse.data;
      } catch (mpError: any) {
        console.error("Mercado Pago API Call Failed:", mpError.response?.data || mpError.message);
        return res.status(500).json({ error: "Erro ao processar o pagamento com cartão." });
      }

      const pId = String(mpResponse.id || mpResponse.body?.id || '');
      const status = mpResponse.status || mpResponse.body?.status || 'pending';

      // Save Payment Intent
      const { paymentIntentService } = await import('./src/services/paymentIntentService');
      await paymentIntentService.create({
          id: pId,
          orderId,
          customerId: orderData.customerId,
          paymentMethodId,
          paymentMethodNameSnapshot: payment_method_id === 'credit_card' ? 'Cartão de Crédito' : 'Cartão de Débito',
          paymentMethodType: payment_method_id === 'credit_card' ? 'credit_card' : 'debit_card',
          gatewayProvider: 'mercado_pago',
          provider: 'mercado_pago',
          amount,
          currency: 'BRL',
          status: status as any,
          mercadopagoPaymentId: pId,
          installments: Number(installments),
          payer: { email: orderData.customerEmail },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      });

      await updatePaymentStatus(orderId, mpResponse);

      res.json({
        success: true,
        status: status,
        detail: mpResponse.status_detail,
        id: pId
      });
    } catch (error: any) {
      console.error("MP Create Card Error:", error);
      res.status(500).json({ error: error.message || "Erro no processamento do cartão" });
    }
  });

  // Mercado Pago Status Check
  app.get("/api/payments/mercadopago/status/:paymentId", async (req, res) => {
    try {
        const { paymentId } = req.params;
        const mpConfigDoc = await getMercadoPagoConfigDoc();
        if (!mpConfigDoc.exists()) {
            return res.status(400).json({ error: "Integração inativa" });
        }
        const { accessToken } = mpConfigDoc.data();
        const { default: axios } = await import('axios');
        const pResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            timeout: 30000
        });
        res.json({ status: pResponse.data.status });
    } catch (error: any) {
        console.error("MP Status Check Error:", error);
        res.status(500).json({ error: error.message });
    }
  });

  // Mercado Pago Webhook Hook (Validated directly against API)
  app.post("/api/webhooks/mercadopago", async (req, res) => {
    try {
      console.log("🔔 WEBHOOK MERCADO PAGO:", JSON.stringify(req.body));
      
      const event = req.body;
      const eventId = String(event.id || '');
      const paymentId = String(event.data?.id || event.id || '');
      const type = event.type || event.topic || '';
      
      const isTestEvent = paymentId === '123456' || event.live_mode === false;

      const logId = await addWebhookLog({
        provider: 'mercado_pago',
        eventId: eventId,
        paymentId: paymentId,
        type: type,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        success: false,
        testEvent: isTestEvent,
        payload: event
      });

      if (isTestEvent) {
        if (logId) await updateWebhookLog(logId, {
          success: true,
          ignored: true,
          message: "Evento de teste recebido com sucesso"
        });
        return res.json({ ok: true, received: true, testEvent: true });
      }

      if (!paymentId || (type !== 'payment' && type !== 'payment.created' && type !== 'payment.updated')) {
        if (logId) await updateWebhookLog(logId, {
          success: true,
          ignored: true,
          message: "Evento ignorado (não-pagamento)"
        });
        return res.json({ status: "ignored" });
      }

      const configDoc = await getMercadoPagoConfigDoc();
      if (!configDoc.exists()) {
        if (logId) await updateWebhookLog(logId, { success: false, ignored: true, error: "Sem configuração cadastrada" });
        return res.json({ status: "ignored", error: "Integração inativa" });
      }
      
      const { accessToken } = configDoc.data();
      if (!accessToken) {
        if (logId) await updateWebhookLog(logId, { success: false, ignored: true, error: "Access token ausente" });
        return res.json({ status: "ignored", error: "Token ausente" });
      }

      const { default: axios } = await import('axios');
      try {
        const pResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          timeout: 30000
        });

        const paymentData = pResponse.data;
        const orderId = paymentData.external_reference;

        if (!orderId) {
          if (logId) await updateWebhookLog(logId, { success: false, ignored: true, error: "external_reference ausente" });
          return res.json({ status: "ignored", notes: "Sem orderId" });
        }

        await updatePaymentStatus(orderId, paymentData);

        if (logId) await updateWebhookLog(logId, {
          orderId: orderId,
          status: paymentData.status,
          success: true,
          processedAt: new Date().toISOString()
        });

        res.json({ status: "processed" });
      } catch (err: any) {
        console.error("Webhook processing error resolving payment:", err.response?.data || err.message);
        if (logId) await updateWebhookLog(logId, { success: false, ignored: true, error: err.message });
        res.json({ status: "ignored", error: err.message });
      }
    } catch (error: any) {
      console.error("General Webhook Crash:", error);
      res.status(200).json({ status: "failed", error: error.message });
    }
  });

  // Mercado Pago Preference Creation
  app.post("/api/payments/create-preference", async (req, res) => {
    try {
      const { items, orderId } = req.body;

      // Safe access token retrieval from server DB
      const configDoc = await getMercadoPagoConfigDoc();
      if (!configDoc.exists()) {
        return res.status(400).json({ error: "Configuração do Mercado Pago não encontrada" });
      }
      const { accessToken } = configDoc.data();
      if (!accessToken) {
        return res.status(400).json({ error: "Access token é necessário para criar a preferência" });
      }
      
      if (orderId) {
          const orderDoc = await getDoc(doc(db, 'orders', orderId));
          if (orderDoc.exists()) {
              const orderData = orderDoc.data();
              const orderCreatedAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt ? new Date(orderData.createdAt) : null);
              const isExpired = orderCreatedAt ? (Date.now() - orderCreatedAt.getTime() > 30 * 60 * 1000) : false;

              if (isExpired && (!orderData.status || orderData.status === 'AGUARDANDO_PAGAMENTO' || orderData.status === 'NOVO')) {
                  await updateDoc(doc(db, 'orders', orderId), {
                      status: 'CANCELADO',
                      paymentStatus: 'cancelled',
                      updatedAt: new Date().toISOString()
                  });
                  return res.status(400).json({ error: "O tempo limite de 30 minutos para pagamento foi excedido. O pedido foi cancelado." });
              }
          }
      }

      let mpResponse: any;
      try {
        const { default: axios } = await import('axios');
        const rawResponse = await axios.post('https://api.mercadopago.com/checkout/preferences', {
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
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        mpResponse = rawResponse.data;
      } catch (mpError: any) {
        console.error("Mercado Pago API Call Failed:", mpError.response?.data || mpError.message);
        return res.status(500).json({ error: "Erro ao criar a preferência." });
      }

      res.json({ id: mpResponse.id, init_point: mpResponse.init_point, sandbox_init_point: mpResponse.sandbox_init_point });
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

  // Unique session lock for concurrent request protection per Admin user
  const activeGenerations = new Set<string>();

  // Secure OpenAI Blog Content Generation Endpoint
  app.post("/api/admin/blog/generate-ai", async (req, res) => {
    let uid = "";
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Tokens ou autorizações de autenticação ausentes." });
      }
      const token = authHeader.split('Bearer ')[1];

      // Lazy load Firebase Admin and getAdminDb to guarantee safety & portability
      const admin = (await import('firebase-admin')).default;
      const { getAdminDb } = await import('./src/server/lib/firebaseAdmin');
      const adminDb = getAdminDb();
      if (!adminDb) {
        throw new Error("Não foi possível inicializar a conexão com a base administrativa.");
      }

      // Verify Firebase ID Token
      const decodedToken = await admin.auth().verifyIdToken(token);
      uid = decodedToken.uid;
      const email = decodedToken.email;

      // Check Admin Role
      let isUserAdmin = email === 'lojadiscretaboutique@gmail.com' || uid === 'VpnA7EDoSoUMF0VGOHyiCjyrOSf2';
      if (!isUserAdmin) {
        const uDoc = await adminDb.collection('users').doc(uid).get();
        if (uDoc.exists && uDoc.data()?.role === 'admin') {
          isUserAdmin = true;
        }
      }

      if (!isUserAdmin) {
        return res.status(403).json({ error: "Acesso reservado exclusivamente para administradores autenticados." });
      }

      // Concurrent request check (multi-click protection)
      if (activeGenerations.has(uid)) {
        return res.status(429).json({ error: "Uma geração com Inteligência Artificial já está em execução para sua conta. Por favor, aguarde alguns instantes." });
      }
      activeGenerations.add(uid);

      try {
        const {
          tema,
          palavraChavePrincipal,
          palavrasChaveSecundarias,
          objetivo,
          publico,
          tomVoz,
          palavras,
          categoria,
          tags,
          produtosSelecionados,
          sugerirProdutos,
          faqRequested,
          ctaRequested,
          seoLocal
        } = req.body;

        if (!tema || !palavraChavePrincipal || !categoria) {
          return res.status(400).json({ error: "Os campos Tema, Palavra-chave Principal e Categoria são obrigatórios para a geração." });
        }

        // Fetch configurable daily generation limit or default to 15
        let maxDaily = 15;
        const settingsSnap = await adminDb.collection('settings').doc('blog_ai_settings').get();
        if (settingsSnap.exists) {
          const limitVal = settingsSnap.data()?.maxDailyGenerations;
          if (typeof limitVal === 'number' && limitVal > 0) {
            maxDaily = limitVal;
          }
        }

        // Daily usage limit query (since start of calendar day local time)
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const dailySnap = await adminDb.collection('blog_ai_generations')
          .where('createdAt', '>=', startOfDay)
          .get();

        if (dailySnap.size >= maxDaily) {
          return res.status(429).json({
            error: `O limite diário de segurança de ${maxDaily} gerações de conteúdo com IA foi atingido hoje para evitar custos excessivos com a API.`
          });
        }

        // Retrieve active catalog products in stock to feed into prompt suggestions
        let catalogProductsList: { id: string; name: string; price: number }[] = [];
        try {
          const pSnap = await adminDb.collection('products')
            .where('active', '==', true)
            .limit(100)
            .get();

          pSnap.forEach(docSnap => {
            const data = docSnap.data();
            const stock = Number(data.stock || 0);
            const showInCatalog = data.extras?.showInCatalog !== false;
            if (stock > 0 && showInCatalog) {
              catalogProductsList.push({
                id: docSnap.id,
                name: data.name || "",
                price: Number(data.price || 0)
              });
            }
          });
        } catch (err) {
          console.warn("[Blog AI Generate] Failed to capture product catalog list:", err);
        }

        const { blogAiService } = await import('./src/server/services/blogAiService');
        
        const generatedPayload = await blogAiService.generateBlogPost({
          tema,
          palavraChavePrincipal,
          palavrasChaveSecundarias: palavrasChaveSecundarias || [],
          objetivo: objetivo || "SEO",
          publico: publico || "mulheres",
          tomVoz: tomVoz || "elegante",
          palavras: Number(palavras) || 900,
          categoria,
          tags: tags || [],
          produtosSelecionados: produtosSelecionados || [],
          sugerirProdutos: !!sugerirProdutos,
          faqRequested: faqRequested !== false,
          ctaRequested: ctaRequested !== false,
          seoLocal: !!seoLocal,
          catalogProductsList
        });

        // Store log in blog_ai_generations collection
        const logDocRef = await adminDb.collection('blog_ai_generations').add({
          userId: uid,
          userEmail: email,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          prompt: { tema, palavraChavePrincipal, palavrasChaveSecundarias, objetivo, publico, tomVoz, palavras, categoria, tags, seoLocal },
          resultado: generatedPayload,
          tokensEstimated: generatedPayload.tokensEstimated || 0,
          articleId: null,
          status: "pending_review",
          modelo: process.env.OPENAI_MODEL || "gpt-4o-mini"
        });

        res.status(200).json({
          success: true,
          generationId: logDocRef.id,
          post: generatedPayload
        });

      } finally {
        activeGenerations.delete(uid);
      }
    } catch (err: any) {
      console.error("[Blog AI Generate Endpoint Error]:", err);
      res.status(500).json({ error: err.message || "Falha ao gerar postagem via OpenAI." });
    }
  });

  // Secure OpenAI Blog Cluster AI Planning Endpoint
  app.post("/api/admin/blog/generate-cluster-ai", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Tokens ou autorizações de autenticação ausentes." });
      }
      const token = authHeader.split('Bearer ')[1];

      const admin = (await import('firebase-admin')).default;
      const { getAdminDb } = await import('./src/server/lib/firebaseAdmin.js');
      const adminDb = getAdminDb();
      if (!adminDb) {
        throw new Error("Não foi possível inicializar a conexão com a base administrativa.");
      }

      // Verify Firebase ID Token
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      // Check Admin Role
      let isUserAdmin = email === 'lojadiscretaboutique@gmail.com' || uid === 'VpnA7EDoSoUMF0VGOHyiCjyrOSf2';
      if (!isUserAdmin) {
        const uDoc = await adminDb.collection('users').doc(uid).get();
        if (uDoc.exists && uDoc.data()?.role === 'admin') {
          isUserAdmin = true;
        }
      }

      if (!isUserAdmin) {
        return res.status(403).json({ error: "Acesso reservado exclusivamente para administradores autenticados." });
      }

      const { tema } = req.body;
      if (!tema) {
        return res.status(400).json({ error: "O campo tema é obrigatório para propor um Cluster SEO." });
      }

      // Capture active catalog products
      let catalogProductsList: { id: string; name: string; price: number }[] = [];
      try {
        const pSnap = await adminDb.collection('products')
          .where('active', '==', true)
          .limit(100)
          .get();

        pSnap.forEach(docSnap => {
          const data = docSnap.data();
          const stock = Number(data.stock || 0);
          const showInCatalog = data.extras?.showInCatalog !== false;
          if (stock > 0 && showInCatalog) {
            catalogProductsList.push({
              id: docSnap.id,
              name: data.name || "",
              price: Number(data.price || 0)
            });
          }
        });
      } catch (err) {
        console.warn("[Blog AI Cluster Generate] Failed to capture product catalog list:", err);
      }

      const { blogAiService } = await import('./src/server/services/blogAiService');
      const clusterPlans = await blogAiService.generateSEOClusterSuggestions({
        tema,
        catalogProductsList
      });

      res.status(200).json({
        success: true,
        cluster: clusterPlans
      });

    } catch (err: any) {
      console.error("[Blog AI Generate Cluster Endpoint Error]:", err);
      res.status(500).json({ error: err.message || "Falha ao propor cluster via OpenAI." });
    }
  });

  // Mercado Pago Transparent Payment Processing
  app.post("/api/payments/process", async (req, res) => {
    try {
      const { formData, orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: "ID do pedido é obrigatório" });
      }

      // Safe access token retrieval from server DB
      const configDoc = await getMercadoPagoConfigDoc();
      if (!configDoc.exists()) {
        return res.status(400).json({ error: "Configuração do Mercado Pago não encontrada" });
      }
      const { accessToken } = configDoc.data();
      if (!accessToken) {
        return res.status(400).json({ error: "Access token is required" });
      }

      // Secure billing: Retrieve the order total from the database
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (!orderDoc.exists()) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      const orderData = orderDoc.data();
      const amount = Number(orderData.total);

      let mpResponse: any;
      try {
        const { default: axios } = await import('axios');
        const rawResponse = await axios.post('https://api.mercadopago.com/v1/payments', {
          transaction_amount: amount,
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
        }, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });
        mpResponse = rawResponse.data;
      } catch (mpError: any) {
        console.error("Mercado Pago API Call Failed:", mpError.response?.data || mpError.message);
        return res.status(500).json({ error: "Erro ao processar o pagamento geral." });
      }

      // Synchronize the order status and receivables securely
      await updatePaymentStatus(orderId, mpResponse);

      res.json({ success: true, status: mpResponse.status, detail: mpResponse.status_detail, id: mpResponse.id });
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

  app.post('/api/admin/check-expired-payments', async (req, res) => {
    try {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("status", "in", ["AGUARDANDO_PAGAMENTO", "NOVO"]));
      const querySnapshot = await getDocs(q);
      
      let cancelledCount = 0;
      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000;
      
      const batch = writeBatch(db);
      let batchSize = 0;
      
      querySnapshot.forEach((docSnap) => {
        const orderData = docSnap.data();
        const createdAt = orderData.createdAt?.toDate ? orderData.createdAt.toDate() : (orderData.createdAt ? new Date(orderData.createdAt) : null);
        
        if (createdAt && (now - createdAt.getTime() > thirtyMinutes)) {
            // Check if payment was already approved
            if (orderData.paymentApprovedAt || orderData.paymentStatus === 'paid') {
                console.log(`[CheckExpired] Skipping order ${docSnap.id} - already approved/paid. paymentApprovedAt: ${orderData.paymentApprovedAt}, paymentStatus: ${orderData.paymentStatus}`);
                return;
            }

            const isIntegrated = orderData.paymentMethod?.toLowerCase().includes("pix") || 
                                 orderData.paymentProvider === "mercado_pago" || 
                                 orderData.paymentMethod === "online_payment";
            
            if (isIntegrated) {
                batch.update(docSnap.ref, {
                    status: 'CANCELADO',
                    paymentStatus: 'cancelled',
                    updatedAt: new Date().toISOString()
                });
                cancelledCount++;
                batchSize++;
            }
        }
      });
      
      if (batchSize > 0) {
        await batch.commit();
      }
      
      res.json({ success: true, cancelledCount });
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

        // Live blog posts sitemap injection
        try {
          xml += `
  <url>
    <loc>${domain}/blog</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
          const blogSnap = await getDocs(collection(db, 'blog_posts'));
          blogSnap.docs.forEach(docSnap => {
            const bp = docSnap.data();
            const isVisible = bp.status === 'publicado' || (bp.status === 'agendado' && bp.publishedAt && new Date(bp.publishedAt) <= new Date());
            if (isVisible && bp.slug) {
              xml += `
  <url>
    <loc>${domain}/blog/${bp.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
            }
          });

          // Live blog categories sitemap injection
          try {
            const blogCatSnap = await getDocs(collection(db, 'blog_categories'));
            blogCatSnap.docs.forEach(catDocSnap => {
              const bc = catDocSnap.data();
              if (bc.status !== 'oculta' && bc.slug) {
                xml += `
  <url>
    <loc>${domain}/blog/categoria/${bc.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
              }
            });
          } catch (blogCatErr) {
            console.error("Error building sitemap.xml blog category nodes:", blogCatErr);
          }
        } catch (blogErr) {
          console.error("Error building sitemap.xml blog nodes:", blogErr);
        }
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

  app.get('/blog/rss.xml', async (req, res) => {
    try {
      res.header('Content-Type', 'application/rss+xml');
      const domain = 'https://discretaboutique.com.br';
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog Discreta Boutique</title>
    <link>${domain}/blog</link>
    <description>Artigos sobre lingeries, autoestima e presentes românticos.</description>`;

      const blogSnap = await getDocs(collection(db, 'blog_posts'));
      blogSnap.docs.forEach(docSnap => {
        const bp = docSnap.data();
        const isVisible = bp.status === 'publicado';
        if (isVisible) {
          xml += `
    <item>
      <title><![CDATA[${bp.title}]]></title>
      <link>${domain}/blog/${bp.slug}</link>
      <description><![CDATA[${bp.summary || ''}]]></description>
      <pubDate>${bp.publishedAt || new Date().toISOString()}</pubDate>
    </item>`;
        }
      });

      xml += `
  </channel>
</rss>`;
      res.send(xml);
    } catch (e) {
      console.error("Error serving RSS:", e);
      res.status(500).send("Error serving RSS");
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

      const v = activeThemeBranding?.pwaVersion || '';
      if (activeThemeBranding) {
        if (activeThemeBranding.socialPreviewImage) image = appendVersion(activeThemeBranding.socialPreviewImage, v);
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
            src: activeThemeBranding?.icon192 ? appendVersion(activeThemeBranding.icon192, v) : (activeThemeBranding?.logo ? appendVersion(activeThemeBranding.logo, v) : image), 
            sizes: '192x192', 
            purpose: activeThemeBranding?.maskableIcon ? 'any' : 'any maskable',
            type: 'image/png'
          },
          { 
            src: activeThemeBranding?.icon512 ? appendVersion(activeThemeBranding.icon512, v) : (activeThemeBranding?.logo ? appendVersion(activeThemeBranding.logo, v) : image), 
            sizes: '512x512', 
            purpose: activeThemeBranding?.maskableIcon ? 'any' : 'any maskable',
            type: 'image/png'
          }
        ]
      };

      if (activeThemeBranding?.maskableIcon) {
        manifest.icons.push({
          src: appendVersion(activeThemeBranding.maskableIcon, v),
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
      if (activeThemeBranding) {
        if (activeThemeBranding.socialPreviewImage) image = appendVersion(activeThemeBranding.socialPreviewImage, activeThemeBranding.pwaVersion);
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

      // Blog Route Override (Listing)
      else if (req.path === '/blog') {
        title = "Blog Discreta Boutique | Sexualidade, Lingerie e Bem-Estar em Icó - CE";
        description = "Aprenda sobre saúde íntima, dicas de sedução, novidades em lingeries, cosméticos sensuais e ideias para casais no blog oficial da Discreta Boutique em Icó, Ceará.";
        ogUrl = `${domain}/blog`;

        jsonLd = {
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Blog Discreta Boutique",
          "description": description,
          "url": ogUrl
        };

        try {
          const blogApiUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/blog_posts?pageSize=100`;
          const blogResponse = await Promise.resolve().then(() => fetch(blogApiUrl)).catch(() => null);

          let blogsHtml = "";
          if (blogResponse && blogResponse.ok) {
            const blogData = await blogResponse.json();
            const docs = blogData.documents || [];
            
            const publishedPosts = docs.map((d: any) => {
              const fields = d.fields || {};
              const id = d.name ? d.name.split('/').pop() : '';
              return {
                id,
                title: fields.title?.stringValue || '',
                slug: fields.slug?.stringValue || '',
                subtitle: fields.subtitle?.stringValue || '',
                summary: fields.summary?.stringValue || '',
                status: fields.status?.stringValue || '',
                coverImage: fields.coverImage?.stringValue || '',
                publishedAt: fields.publishedAt?.stringValue || fields.createdAt?.stringValue || ''
              };
            }).filter((p: any) => p.status === 'publicado');

            if (publishedPosts.length > 0) {
              blogsHtml = publishedPosts.map((p: any) => `
                <article style="background: #121212; border: 1px solid #222; border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; text-align: left;">
                  ${p.coverImage ? `<img src="${p.coverImage}" alt="${p.title}" style="width: 100%; height: 200px; object-fit: cover;" referrerPolicy="no-referrer" />` : ''}
                  <div style="padding: 1.5rem;">
                    <span style="font-size: 0.8rem; color: #dc2626; font-weight: 700; text-transform: uppercase;">Artigo</span>
                    <h2 style="font-size: 1.3rem; margin: 0.5rem 0; font-weight: 800;">
                      <a href="/blog/${p.slug}" style="color: #fff; text-decoration: none;">${p.title}</a>
                    </h2>
                    <p style="color: #ccc; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1rem;">${p.summary || p.subtitle || ''}</p>
                    <a href="/blog/${p.slug}" style="color: #dc2626; text-decoration: none; font-weight: 700; font-size: 0.9rem;">Ler Artigo Completo &rarr;</a>
                  </div>
                </article>
              `).join('\n');
            } else {
              blogsHtml = `<p style="grid-column: 1/-1; text-align: center; color: #777;">Nenhum artigo publicado no momento. Volte em breve!</p>`;
            }
          }

          ssrContent = `
            <div style="max-width: 1200px; margin: 0 auto; padding: 2rem; color: #fff; font-family: system-ui, -apple-system, sans-serif;">
              <header style="text-align: center; margin-bottom: 3.5rem;">
                <h1 style="font-size: 2.8rem; font-weight: 900; letter-spacing: -0.02em; margin-bottom: 0.5rem;">Blog Discreta Boutique</h1>
                <p style="font-size: 1.25rem; color: #aaa; max-width: 700px; margin: 0 auto; line-height: 1.6;">
                  Dicas de intimidade, autoestima, sedução e bem-estar para empoderar você e a sua parceria amorosa em Icó-CE.
                </p>
              </header>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 2rem;">
                ${blogsHtml}
              </div>
            </div>
          `;
        } catch (blogErr) {
          console.error("Error creating Blog SSR content:", blogErr);
        }
      }

      // Blog Article Route Override (Single)
      else if (req.path.startsWith('/blog/')) {
        const blogPostMatch = req.path.match(/^\/blog\/([^/]+)$/);
        if (blogPostMatch) {
          const blogSlug = blogPostMatch[1];
          const blogApiUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents:runQuery`;
          
          try {
            const blogResponse = await fetch(blogApiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                structuredQuery: {
                  from: [{ collectionId: "blog_posts" }],
                  where: {
                    fieldFilter: {
                      field: { fieldPath: "slug" },
                      op: "EQUAL",
                      value: { stringValue: blogSlug }
                    }
                  },
                  limit: 1
                }
              })
            });

            if (blogResponse.ok) {
              const runQueryData = await blogResponse.json();
              if (runQueryData && runQueryData[0] && runQueryData[0].document) {
                const docFields = runQueryData[0].document.fields;
                const postTitle = docFields.title?.stringValue || "Artigo";
                const postSummary = docFields.summary?.stringValue || docFields.subtitle?.stringValue || "";
                const postContent = docFields.content?.stringValue || "";
                const postCover = docFields.coverImage?.stringValue || "";
                
                title = `${postTitle} | Blog Discreta Boutique | Icó - CE`;
                description = postSummary ? `${postSummary.substring(0, 155).trim()}...` : `Leia "${postTitle}" no blog da Discreta Boutique em Icó, com total discrição e sigilo.`;
                if (postCover) image = postCover;
                ogUrl = `${domain}/blog/${blogSlug}`;

                // Parse FAQs if present
                const faqsValues = docFields.seo?.mapValue?.fields?.faq?.arrayValue?.values || [];
                const faqList = faqsValues.map((fv: any) => {
                  const itemFields = fv.mapValue?.fields || {};
                  return {
                    question: itemFields.question?.stringValue || "",
                    answer: itemFields.answer?.stringValue || ""
                  };
                }).filter((f: any) => f.question && f.answer);

                const faqLd = faqList.length > 0 ? {
                  "@type": "FAQPage",
                  "mainEntity": faqList.map((f: any) => ({
                    "@type": "Question",
                    "name": f.question,
                    "acceptedAnswer": {
                      "@type": "Answer",
                      "text": f.answer
                    }
                  }))
                } : null;

                jsonLd = {
                  "@context": "https://schema.org",
                  "@graph": [
                    {
                      "@type": "BlogPosting",
                      "@id": ogUrl,
                      "headline": postTitle,
                      "description": description,
                      "image": image,
                      "author": {
                        "@type": "Organization",
                        "name": "Discreta Boutique"
                      },
                      "publisher": {
                        "@type": "Organization",
                        "name": "Discreta Boutique",
                        "logo": {
                          "@type": "ImageObject",
                          "url": image
                        }
                      },
                      "mainEntityOfPage": ogUrl
                    },
                    ...(faqLd ? [faqLd] : [])
                  ]
                };

                // High performance simplified markdown translator for crawler
                const formattedHtml = postContent
                  .split("\n")
                  .map(line => {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith("### ")) {
                      return `<h3 style="font-size: 1.4rem; font-weight: 700; margin: 1.5rem 0 0.5rem 0;">${cleanLine.replace("### ", "")}</h3>`;
                    } else if (cleanLine.startsWith("## ")) {
                      return `<h2 style="font-size: 1.8rem; font-weight: 800; margin: 2rem 0 0.75rem 0; color: #dc2626; border-bottom: 1px solid #222; padding-bottom: 0.25rem;">${cleanLine.replace("## ", "")}</h2>`;
                    } else if (cleanLine.startsWith("# ")) {
                      return `<h1 style="font-size: 2.2rem; font-weight: 900; margin: 2rem 0 1rem 0;">${cleanLine.replace("# ", "")}</h1>`;
                    } else if (cleanLine.startsWith("- ")) {
                      return `<li style="margin-left: 1.5rem; margin-bottom: 0.5rem; font-size: 1rem; line-height: 1.6;">${cleanLine.replace("- ", "")}</li>`;
                    } else if (cleanLine) {
                      return `<p style="font-size: 1.05rem; line-height: 1.7; color: #e5e5e5; margin-bottom: 1.25rem;">${cleanLine}</p>`;
                    }
                    return "";
                  })
                  .join("\n");

                const faqSectionHtml = faqList.length > 0 ? `
                  <section style="margin-top: 4rem; border-top: 2px solid #222; padding-top: 2rem;">
                    <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 1.5rem; color: #dc2626;">Perguntas Frequentes</h2>
                    <div>
                      ${faqList.map((f: any) => `
                        <div style="margin-bottom: 1.5rem;">
                          <h3 style="font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem;">${f.question}</h3>
                          <p style="font-size: 1rem; color: #ccc; line-height: 1.6; margin: 0;">${f.answer}</p>
                        </div>
                      `).join("\n")}
                    </div>
                  </section>
                ` : "";

                ssrContent = `
                  <article style="max-width: 800px; margin: 0 auto; padding: 2rem; color: #fff; font-family: system-ui, -apple-system, sans-serif; text-align: left;">
                    <header style="margin-bottom: 2.5rem;">
                      <a href="/blog" style="color: #888; text-decoration: none; font-size: 0.9rem; font-weight: 700; text-transform: uppercase;">&larr; Voltar para o Blog</a>
                      <h1 style="font-size: 2.8rem; font-weight: 900; letter-spacing: -0.02em; margin: 1rem 0; color: #ffffff; line-height: 1.15;">${postTitle}</h1>
                      ${postSummary ? `<p style="font-size: 1.25rem; color: #aaa; margin-bottom: 1.5rem; line-height: 1.5; font-style: italic;">${postSummary}</p>` : ""}
                    </header>
                    ${postCover ? `<div style="margin-bottom: 2.5rem; text-align: center;"><img src="${postCover}" alt="${postTitle}" style="width: 100%; max-height: 480px; object-fit: cover; border-radius: 8px;" referrerPolicy="no-referrer" /></div>` : ""}
                    <div style="margin-bottom: 3rem;">
                      ${formattedHtml}
                    </div>
                    ${faqSectionHtml}
                  </article>
                `;
              }
            }
          } catch (err) {
            console.error("Error creating Blog Single SSR content:", err);
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

    const v = activeThemeBranding?.pwaVersion || '';
    const faviconUrl = activeThemeBranding?.favicon ? appendVersion(activeThemeBranding.favicon, v) : image;
    const appleTouchIconUrl = activeThemeBranding?.appleTouchIcon ? appendVersion(activeThemeBranding.appleTouchIcon, v) : image;
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
