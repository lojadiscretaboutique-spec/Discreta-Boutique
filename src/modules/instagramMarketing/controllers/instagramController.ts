import { Request, Response } from 'express';
import { db, auth } from '../../../lib/firebase.js';
import { collection, addDoc, getDocs, updateDoc, doc, getDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { InstagramIdeaService } from '../services/InstagramIdeaService.js';
import { OpenAIImageService } from '../services/OpenAIImageService.js';
import { OpenAIContentService } from '../services/OpenAIContentService.js';
import { InstagramPublisherService } from '../services/InstagramPublisherService.js';
import { InstagramGraphService } from '../services/InstagramGraphService.js';

const ideaService = new InstagramIdeaService();
const imageService = new OpenAIImageService();
const contentService = new OpenAIContentService();
const publisherService = new InstagramPublisherService();
const graphService = new InstagramGraphService();

/**
 * Ensures standard dates on returns
 */
function getISODate() {
  return new Date().toISOString();
}

/**
 * Standard Firebase Error Handling as mandated by the firebase-integration skill
 */
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Generates 10 ideas based on weekly goals and page format (story, feed, reels)
 */
/**
 * Generates 10 ideas based on weekly goals and page format (story, feed, reels)
 */
export async function generateContent(req: Request, res: Response): Promise<void> {
  try {
    const { descricao, tipo } = req.body;
    if (!descricao || !tipo) {
      res.status(400).json({ error: 'Os campos "descricao" e "tipo" (feed, story, reels) são obrigatórios.' });
      return;
    }

    console.log(`[InstagramController] Gerando ideias para "${descricao}" (${tipo})...`);
    const brandKitPrompt = await getBrandKitPrompt();
    const suggestions = await ideaService.generateWeeklyIdeas(descricao, tipo, brandKitPrompt);
    res.json({ suggestions });
  } catch (error: any) {
    console.error('Erro ao gerar conteúdos:', error);
    res.status(500).json({ error: error.message || 'Erro interno na geração de ideias.' });
  }
}

/**
 * Generates secondary text structures (such as stories sequences or reels scripts) inside detailed view
 */
export async function generateDetails(req: Request, res: Response): Promise<void> {
  try {
    const { tipo, titulo, descricao } = req.body;
    if (!tipo || !titulo) {
      res.status(400).json({ error: 'Tipo e Título são obrigatórios para detalhamento.' });
      return;
    }

    const brandKitPrompt = await getBrandKitPrompt();

    if (tipo === 'story') {
      const storySequence = await contentService.generateStorySequence(titulo, descricao || '', brandKitPrompt);
      res.json(storySequence);
    } else if (tipo === 'reels') {
      const reelsScript = await contentService.generateReelsScript(titulo, descricao || '', brandKitPrompt);
      res.json(reelsScript);
    } else {
      res.status(400).json({ error: 'Detalhamento suportado apenas nos formatos story e reels.' });
    }
  } catch (error: any) {
    console.error('Erro ao gerar detalhes do roteiro:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Generates images via DALL-E based on model base reference image and campaign themes
 */
export async function generateImages(req: Request, res: Response): Promise<void> {
  try {
    const { tema, imagem_modelo, modo } = req.body;
    if (!tema || !modo) {
      res.status(400).json({ error: 'O tema e o modo (unica ou carrossel) são obrigatórios.' });
      return;
    }

    console.log(`[InstagramController] Gerando imagem(ns) para tema "${tema}" (${modo})...`);
    const brandKitPrompt = await getBrandKitPrompt();
    const urls = await imageService.generateImagesForPost(tema, imagem_modelo, modo, brandKitPrompt);
    res.json({ urls });
  } catch (error: any) {
    console.error('Erro ao gerar imagens no controller:', error);
    res.status(500).json({ error: error.message || 'Falha ao criar imagens.' });
  }
}

/**
 * Saves or Schedules a post (stores details to Firestore)
 */
export async function schedulePost(req: Request, res: Response): Promise<void> {
  let savedId = req.body.id;
  try {
    const postData = req.body;
    const { id, ...cleanData } = postData;

    const postToSave = {
      tipo: cleanData.tipo || 'feed',
      titulo: cleanData.titulo || '',
      descricao: cleanData.descricao || '',
      hashtags: cleanData.hashtags || [],
      imagem_modelo: cleanData.imagem_modelo || '',
      modo: cleanData.modo || 'unica',
      imagens_geradas: cleanData.imagens_geradas || [],
      ordem: cleanData.ordem || [],
      agendamento: cleanData.agendamento || null,
      status: cleanData.status || 'rascunho',
      created_at: cleanData.created_at || getISODate(),
      updated_at: getISODate()
    };

    if (id) {
      // Update
      const ref = doc(db, 'instagram_posts', id);
      try {
        await updateDoc(ref, postToSave);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `instagram_posts/${id}`);
      }
      console.log(`[InstagramController] Postagem ${id} salva com sucesso.`);
    } else {
      // Create
      let docRef;
      try {
        docRef = await addDoc(collection(db, 'instagram_posts'), postToSave);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'instagram_posts');
      }
      savedId = docRef.id;
      console.log(`[InstagramController] Postagem criada com ID: ${savedId}`);
    }

    res.json({ success: true, id: savedId });
  } catch (error: any) {
    console.error('Erro ao salvar ou agendar postagem:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Publishes a post immediately
 */
export async function publishPostImmediately(req: Request, res: Response): Promise<void> {
  try {
    const { postId } = req.body;
    if (!postId) {
      res.status(400).json({ error: 'ID da postagem é obrigatório para envio imediato.' });
      return;
    }

    // Retrieve post from DB
    let postSnap;
    try {
      postSnap = await getDoc(doc(db, 'instagram_posts', postId));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, `instagram_posts/${postId}`);
    }

    if (!postSnap.exists()) {
      res.status(404).json({ error: 'Postagem não encontrada.' });
      return;
    }

    const postData = { id: postSnap.id, ...postSnap.data() } as any;
    
    // Publish
    const mediaId = await publisherService.publishPost(postId, postData);
    res.json({ success: true, mediaId });
  } catch (error: any) {
    console.error('Erro ao publicar postagem imediata:', error);
    res.status(500).json({ error: error.message || 'Erro na publicação imediata.' });
  }
}

/**
 * Gets list of saved posts
 */
export async function getPosts(req: Request, res: Response): Promise<void> {
  try {
    const q = query(collection(db, 'instagram_posts'), orderBy('created_at', 'desc'));
    let snap;
    try {
      snap = await getDocs(q);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'instagram_posts');
    }
    const list = snap.docs
      .filter(d => d.id !== 'brand_kit_config')
      .map(d => ({ id: d.id, ...d.data() }));
    res.json({ posts: list });
  } catch (error: any) {
    console.error('Erro ao carregar lista de posts:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Gets list of logs
 */
export async function getLogs(req: Request, res: Response): Promise<void> {
  try {
    const q = query(collection(db, 'instagram_logs'), orderBy('created_at', 'desc'), limit(100));
    let snap;
    try {
      snap = await getDocs(q);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'instagram_logs');
    }
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ logs: list });
  } catch (error: any) {
    console.error('Erro ao carregar logs:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Saves credentials for Meta Graph Integration
 */
export async function saveIntegration(req: Request, res: Response): Promise<void> {
  try {
    const { 
      access_token, 
      page_id, 
      instagram_business_id, 
      facebook_page_id,
      facebook_app_id,
      facebook_app_secret,
      perfil_conectado,
      status,
      status_texto,
      checks,
      last_sync
    } = req.body;

    // Permite salvar configurações parciais (ex: apenas as chaves do Facebook App ID/Secret no Passo 1) sem exigir token ativo imediatamente.
    const hasCredentials = !!(access_token && instagram_business_id);
    const calculatedStatus = status || (hasCredentials ? 'conectado' : 'Não configurado');

    // Check if an integration exists
    const q = query(collection(db, 'instagram_integracoes'), limit(1));
    let snap;
    try {
      snap = await getDocs(q);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'instagram_integracoes');
    }

    const dataToSave: any = {
      access_token: access_token || '',
      page_id: page_id || '',
      instagram_business_id: instagram_business_id || '',
      facebook_page_id: facebook_page_id || '',
      facebook_app_id: facebook_app_id || '',
      facebook_app_secret: facebook_app_secret || '',
      status: calculatedStatus,
      created_at: getISODate()
    };

    if (perfil_conectado) dataToSave.perfil_conectado = perfil_conectado;
    if (status_texto) dataToSave.status_texto = status_texto;
    if (checks) dataToSave.checks = checks;
    if (last_sync) dataToSave.last_sync = last_sync;

    if (!snap.empty) {
      const existingId = snap.docs[0].id;
      try {
        await updateDoc(doc(db, 'instagram_integracoes', existingId), dataToSave);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.UPDATE, `instagram_integracoes/${existingId}`);
      }
      res.json({ success: true, id: existingId });
    } else {
      let docRef;
      try {
        docRef = await addDoc(collection(db, 'instagram_integracoes'), dataToSave);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.CREATE, 'instagram_integracoes');
      }
      res.json({ success: true, id: docRef.id });
    }
  } catch (error: any) {
    console.error('Erro ao salvar integração do Instagram:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Gets active integration settings
 */
export async function getIntegration(req: Request, res: Response): Promise<void> {
  try {
    const q = query(collection(db, 'instagram_integracoes'), limit(1));
    let snap;
    try {
      snap = await getDocs(q);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'instagram_integracoes');
    }
    if (!snap.empty) {
      res.json({ integration: { id: snap.docs[0].id, ...snap.docs[0].data() } });
    } else {
      res.json({ integration: null });
    }
  } catch (error: any) {
    console.error('Erro ao carregar integração:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Initiates the Meta OAuth flow by returning the Authorize URL
 */
export async function getAuthUrl(req: Request, res: Response): Promise<void> {
  try {
    const q = query(collection(db, 'instagram_integracoes'), limit(1));
    const snap = await getDocs(q);
    let appId = process.env.FACEBOOK_APP_ID || '';
    
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      if (docData.facebook_app_id) {
        appId = docData.facebook_app_id;
      }
    }

    if (!appId) {
      appId = process.env.FACEBOOK_APP_ID || '1430489214227891'; // Fallback sandbox App ID
    }

    let appUrl = process.env.APP_URL;
    if (!appUrl || appUrl === 'MY_APP_URL') {
      appUrl = `${req.protocol}://${req.get('host')}`;
    }
    appUrl = appUrl.replace(/\/$/, "");
    const redirectUri = `${appUrl}/api/instagram/oauth-callback`;

    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'business_management'
    ];

    const fbAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes.join(',')}&response_type=code`;

    res.json({ url: fbAuthUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Meta OAuth redirect callback page
 */
export async function oauthCallback(req: Request, res: Response): Promise<void> {
  const { code, error: fbError, error_description } = req.query;

  if (fbError || error_description) {
    const errorMsg = String(error_description || fbError || 'Acesso negado pelo usuário.');
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro de Autenticação Meta</title>
        <style>
          body { background-color: #0b1329; color: #f1f5f9; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .error-icon { color: #f43f5e; font-size: 48px; }
          h2 { margin: 16px 0 8px 0; }
          p { color: #94a3b8; font-size: 14px; max-width: 320px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="error-icon">✗</div>
        <h2>Falha na Integração</h2>
        <p>${errorMsg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'META_AUTH_ERROR', error: ${JSON.stringify(errorMsg)} }, '*');
          }
        </script>
      </body>
      </html>
    `);
    return;
  }

  if (!code) {
    res.status(400).send('Código de autorização inválido.');
    return;
  }

  try {
    const q = query(collection(db, 'instagram_integracoes'), limit(1));
    const snap = await getDocs(q);
    let appId = process.env.FACEBOOK_APP_ID || '';
    let appSecret = process.env.FACEBOOK_APP_SECRET || '';

    if (!snap.empty) {
      const docData = snap.docs[0].data();
      if (docData.facebook_app_id) appId = docData.facebook_app_id;
      if (docData.facebook_app_secret) appSecret = docData.facebook_app_secret;
    }

    if (!appId || !appSecret) {
      appId = appId || process.env.FACEBOOK_APP_ID || '1430489214227891';
      appSecret = appSecret || process.env.FACEBOOK_APP_SECRET || '';
      
      if (!appSecret) {
        throw new Error('Meta App Secret não configurado. Adicione o App Secret nas Configurações Avançadas abaixo.');
      }
    }

    let appUrl = process.env.APP_URL;
    if (!appUrl || appUrl === 'MY_APP_URL') {
      appUrl = `${req.protocol}://${req.get('host')}`;
    }
    appUrl = appUrl.replace(/\/$/, "");
    const redirectUri = `${appUrl}/api/instagram/oauth-callback`;

    // Exchange code for short-lived token
    const shortLivedToken = await graphService.exchangeCodeForToken(
      String(code),
      redirectUri,
      appId,
      appSecret
    );

    // Exchange for long-lived token
    const longLivedToken = await graphService.getLongLivedToken(
      shortLivedToken,
      appId,
      appSecret
    );

    // Fetch pages details and Instagram商业 accounts
    const pages = await graphService.getUserPagesAndInstagramAccounts(longLivedToken);

    const pagesOptions = pages.map((page: any) => {
      const ig = page.instagram_business_account;
      return {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        instagramBusinessId: ig ? ig.id : null,
        instagramUsername: ig ? ig.username : null,
        instagramName: ig ? ig.name : null,
        instagramProfilePicture: ig ? ig.profile_picture_url : (page.picture?.data?.url || null)
      };
    });

    const payload = {
      accessToken: longLivedToken,
      pages: pagesOptions
    };

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Autenticação Meta</title>
        <style>
          body { background-color: #0b1329; color: #f1f5f9; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .spinner { border: 4px solid rgba(255, 255, 255, 0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #f59e0b; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .success-icon { color: #10b981; font-size: 48px; }
          h2 { margin: 16px 0 8px 0; }
          p { color: #94a3b8; font-size: 14px; max-width: 300px; }
        </style>
      </head>
      <body>
        <div id="content">
          <div class="spinner"></div>
          <h2>Conectando com o Meta...</h2>
          <p>Aguarde, processando suas páginas e perfis vinculados comercial.</p>
        </div>
        <script>
          const data = ${JSON.stringify(payload)};
          if (window.opener) {
            window.opener.postMessage({ type: 'META_AUTH_SUCCESS', payload: data }, '*');
            document.getElementById('content').innerHTML = \`
              <div class="success-icon">✓</div>
              <h2>Conectado com Sucesso!</h2>
              <p>Esta janela já pode ser fechada automaticamente.</p>
            \`;
            setTimeout(() => {
              window.close();
            }, 1000);
          } else {
            document.getElementById('content').innerHTML = \`
              <div class="error-icon">✗</div>
              <h2>Erro de Comunicação</h2>
              <p>Não foi possível enviar os dados de volta para a aplicação.</p>
            \`;
          }
        </script>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('[OAuth Callback Error]:', error);
    const errorMsg = error.message || 'Erro inesperado durante o login do Facebook.';
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Erro de Autenticação Meta</title>
        <style>
          body { background-color: #0b1329; color: #f1f5f9; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          .error-icon { color: #f43f5e; font-size: 48px; }
          h2 { margin: 16px 0 8px 0; }
          p { color: #94a3b8; font-size: 14px; max-width: 320px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="error-icon">✗</div>
        <h2>Falha na Integração</h2>
        <p>${errorMsg}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'META_AUTH_ERROR', error: ${JSON.stringify(errorMsg)} }, '*');
          }
        </script>
      </body>
      </html>
    `);
  }
}

/**
 * Tests connection with Instagram credentials from Web page
 */
export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const { access_token, instagram_business_id, page_id } = req.body;
    if (!access_token || !instagram_business_id) {
      res.status(400).json({ error: 'Token de acesso e ID do Instagram Business são requeridos para o teste.' });
      return;
    }

    const testResult = await graphService.validateConnectionDetailed({
      accessToken: access_token,
      instagramBusinessId: instagram_business_id,
      pageId: page_id
    });

    res.json(testResult);
  } catch (error: any) {
    res.status(500).json({ valid: false, status: 'erro', details: { message: error.message } });
  }
}

/**
 * Synchronizes Meta details and permissions on page load
 */
export async function syncIntegration(req: Request, res: Response): Promise<void> {
  try {
    const q = query(collection(db, 'instagram_integracoes'), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) {
      res.json({ integration: null });
      return;
    }

    const docId = snap.docs[0].id;
    const data = snap.docs[0].data();

    if (!data.access_token || !data.instagram_business_id) {
      res.json({ integration: { id: docId, ...data } });
      return;
    }

    const validation = await graphService.validateConnectionDetailed({
      accessToken: data.access_token,
      instagramBusinessId: data.instagram_business_id,
      pageId: data.page_id
    });

    const updatedData = {
      ...data,
      status: (validation.valid ? 'conectado' : 'erro') as any,
      status_texto: validation.status,
      checks: validation.checks,
      perfil_conectado: {
        username: validation.details.username || data.perfil_conectado?.username || '',
        name: validation.details.name || data.perfil_conectado?.name || '',
        profile_picture_url: validation.details.profile_picture_url || data.perfil_conectado?.profile_picture_url || '',
        page_name: validation.details.page_name || data.perfil_conectado?.page_name || ''
      },
      last_sync: new Date().toISOString()
    };

    await updateDoc(doc(db, 'instagram_integracoes', docId), updatedData);

    res.json({ integration: { id: docId, ...updatedData } });
  } catch (error: any) {
    console.error('Erro ao sincronizar integração do Instagram:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Saves or updates Brand Kit configuration in database (single doc strategy)
 */
export async function saveBrandKit(req: Request, res: Response): Promise<void> {
  try {
    const brandKitData = req.body;
    const docRef = doc(db, 'instagram_posts', 'brand_kit_config');
    try {
      await setDoc(docRef, brandKitData);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, 'instagram_posts/brand_kit_config');
    }
    res.json({ success: true, id: 'brand_kit_config' });
  } catch (error: any) {
    console.error('Erro ao salvar kit de marca Inteligente:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Gets active Brand Kit settings
 */
export async function getBrandKit(req: Request, res: Response): Promise<void> {
  try {
    const docRef = doc(db, 'instagram_posts', 'brand_kit_config');
    let snap;
    try {
      snap = await getDoc(docRef);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, 'instagram_posts/brand_kit_config');
    }

    if (snap.exists()) {
      res.json({ brandKit: { id: 'brand_kit_config', ...snap.data() } });
    } else {
      res.json({ brandKit: null });
    }
  } catch (error: any) {
    console.error('Erro ao carregar kit de marca:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Help retrieve compiled dynamic master prompt
 */
export async function getBrandKitPrompt(): Promise<string> {
  try {
    const docRef = doc(db, 'instagram_posts', 'brand_kit_config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const bk = snap.data();
      return assembleMasterPrompt(bk);
    }
  } catch (err) {
    console.error('[BrandKitPrompt] Falha ao buscar Brand Kit do banco:', err);
  }
  return '';
}

/**
 * Compiles/formats the Master Prompt according to prompt blueprint
 */
export function assembleMasterPrompt(bk: any): string {
  if (!bk) return '';
  const ident = bk.identidade_marca || {};
  const visual = bk.identidade_visual || {};
  const redes = bk.redes_sociais || {};
  const regras = bk.regras_ia || {};

  return `Você está criando conteúdos profissionais e de alta conversão para o Instagram.
Siga RIGOROSAMENTE as seguintes diretrizes de Identidade de Marca e Inteligência Visual:

1. IDENTIDADE DA MARCA:
- Empresa: ${ident.nome || 'Discreta Boutique'}
- Slogan: ${ident.slogan || ''}
- Descrição: ${ident.descricao || ''}
- Missão: ${ident.missao || ''}
- Público-Alvo: ${ident.publico_alvo || ''}
- Personalidade da Marca: ${ident.personalidade || ''}
- Tom de Voz: ${ident.tom_voz || ''}
- Objetivo no Instagram: ${ident.objetivo || ''}

2. IDENTIDADE VISUAL & ESTILO:
- Logotipo: ${visual.logo || 'Usar logo oficial'}
- Cores de Destaque / Principais: ${visual.cores_principais || ''}
- Cores Secundárias: ${visual.cores_secundarias || ''}
- Fontes Preferidas: ${visual.fontes_preferidas || ''}
- Estilo Visual: ${visual.estilo_visual || ''}
- Referências: ${visual.referencias_visuais || ''}
- Site Oficial: ${visual.site_oficial || ''}

3. CONTATOS E LINKS:
- Instagram: ${redes.instagram || ''}
- WhatsApp: ${redes.whatsapp || ''}
- Facebook: ${redes.facebook || ''}
- TikTok: ${redes.tiktok || ''}
- Site: ${redes.site || ''}
- Endereço / Localização: ${redes.endereco || ''}

4. REGRAS PARA GERAÇÃO DA IA:
- Frases Obrigatórias: ${regras.frases_obrigatorias || ''}
- Palavras Proibidas (NUNCA UTILIZE): ${regras.palavras_proibidas || ''}
- CTA Padrão: ${regras.cta_padrao || ''}
- Emojis Permitidos: ${regras.emojis_permitidos || ''}
- Hashtags Automáticas / Padrão: ${regras.hashtags_automaticas || ''}
- Regras de Escrita: ${regras.regras_escrita || ''}
- Regras de Design / Estética Visual: ${regras.regras_design || ''}

5. ESTRATÉGIA INTEGRADA DO INSTAGRAM:
A IA deve respeitar os seguintes pilares estratégicos da marca:
- Reconhecimento de marca
- Construção de autoridade e diferenciação no nicho
- Relacionamento próximo com o seguidor
- Prova social implícita e explícita
- Conexão emocional genuína
- Entregar valor de alta qualidade antes de fazer a venda direta
- Conversão suave (foco no desejo, direct, link na bio, e CTAs refinados)

Utilize o fluxo de funil: Atrair → Conectar → Ensinar → Gerar confiança → Fortalecer autoridade → Converter.`;
}
