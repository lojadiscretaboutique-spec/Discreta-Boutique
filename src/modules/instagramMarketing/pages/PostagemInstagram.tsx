import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Calendar, 
  Settings, 
  History, 
  Upload, 
  Image as ImageIcon, 
  Eye, 
  Clock, 
  Plus, 
  Trash2, 
  Check, 
  Send, 
  RefreshCw, 
  ArrowLeft, 
  ArrowRight,
  ChevronRight,
  LayoutGrid,
  FileText,
  AlertCircle,
  HelpCircle,
  User,
  MoreHorizontal,
  Heart,
  MessageCircle,
  Bookmark,
  Palette,
  Power,
  Lock,
  CheckCircle2,
  XCircle,
  Link2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../../lib/firebase.js';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy, getDoc } from 'firebase/firestore';
import axios from 'axios';
import { BrandKitComponent } from '../components/BrandKitComponent.js';

// Helper to upload base64/data URLs or File objects to Firebase Storage
const uploadToStorage = async (dataOrFile: string | File, path: string): Promise<string> => {
  if (!dataOrFile) return '';
  if (typeof dataOrFile === 'string' && !dataOrFile.startsWith('data:')) {
    return dataOrFile; // It's already loaded as an HTTP/HTTPS URL
  }
  try {
    const { ref, uploadBytes, uploadString, getDownloadURL } = await import('firebase/storage');
    const { storage } = await import('../../../lib/firebase.js');
    const fileRef = ref(storage, path);
    if (dataOrFile instanceof File) {
      await uploadBytes(fileRef, dataOrFile);
    } else {
      await uploadString(fileRef, dataOrFile, 'data_url');
    }
    return await getDownloadURL(fileRef);
  } catch (error) {
    console.error('[uploadToStorage] Erro ao fazer upload para o Storage:', error);
    return typeof dataOrFile === 'string' ? dataOrFile : '';
  }
};

// Component constants and helpers
const COMPANY_NAME = 'Discreta Boutique';
const SEGMENTS = 'Cosméticos, Perfumes, Maquiagem, Skincare, Beleza';
const DURATION_REELS = '15–60 segundos';

export function PostagemInstagram() {
  const [activeTab, setActiveTab] = useState<'gerador' | 'calendario' | 'brand_kit' | 'integracao' | 'logs'>('gerador');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // States for generation inputs
  const [storyTopic, setStoryTopic] = useState('');
  const [feedTopic, setFeedTopic] = useState('');
  const [reelsTopic, setReelsTopic] = useState('');

  // Suggestions history
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [storySuggestions, setStorySuggestions] = useState<any[]>([]);
  const [feedSuggestions, setFeedSuggestions] = useState<any[]>([]);
  const [reelsSuggestions, setReelsSuggestions] = useState<any[]>([]);

  // Detailed selected suggestion logic
  const [selectedSug, setSelectedSug] = useState<any | null>(null);
  const [detailedStructure, setDetailedStructure] = useState<any | null>(null);
  const [generatingDetails, setGeneratingDetails] = useState(false);

  // Image assets states for current selectedSug
  const [modoPost, setModoPost] = useState<'unica' | 'carrossel'>('unica');
  const [imageModel, setImageModel] = useState<string>(''); // Base64 reference image uploaded by user
  const [generatingImages, setGeneratingImages] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imagesOrder, setImagesOrder] = useState<number[]>([]);

  // Schedule and publication states
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isPublishingNow, setIsPublishingNow] = useState(false);

  // General lists
  const [posts, setPosts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [oauthResult, setOauthResult] = useState<{ accessToken: string; pages: any[] } | null>(null);
  const [integracao, setIntegracao] = useState<any>({
    access_token: '',
    page_id: '',
    instagram_business_id: '',
    facebook_page_id: '',
    facebook_app_id: '',
    facebook_app_secret: '',
    perfil_conectado: null,
    checks: null,
    status_texto: ''
  });
  const [connMethod, setConnMethod] = useState<'oauth' | 'manual'>('manual');

  // Load Data
  const loadPosts = async () => {
    try {
      const res = await axios.get('/api/instagram/posts');
      if (res.data && res.data.posts) {
        setPosts(res.data.posts);
      }
    } catch (err: any) {
      console.error('Erro ao buscar postagens:', err);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await axios.get('/api/instagram/logs');
      if (res.data && res.data.logs) {
        setLogs(res.data.logs);
      }
    } catch (err: any) {
      console.error('Erro ao buscar logs:', err);
    }
  };

  const loadIntegration = async () => {
    try {
      // Automatic real-time synchronization on page load as requested
      const res = await axios.post('/api/instagram/integracao/sincronizar');
      if (res.data && res.data.integration) {
        setIntegracao(res.data.integration);
      }
    } catch (err: any) {
      console.error('Erro ao sincronizar integracao:', err);
      // Fallback simple fetch if synchronization hits a temporary network error
      try {
        const fallbackRes = await axios.get('/api/instagram/integracao');
        if (fallbackRes.data && fallbackRes.data.integration) {
          setIntegracao(fallbackRes.data.integration);
        }
      } catch (fErr) {
        console.error('Erro no fallback de carregar integracao:', fErr);
      }
    }
  };

  useEffect(() => {
    loadPosts();
    loadLogs();
    loadIntegration();

    // Listen to child auth popup messages safely
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'META_AUTH_SUCCESS') {
        const { accessToken, pages } = event.data.payload;
        setOauthResult({ accessToken, pages });
        toastSuccess('Login realizado! Selecione seu perfil do Instagram abaixo para ativar.');
      } else if (event.data?.type === 'META_AUTH_ERROR') {
        toastError('Erro no Login Meta: ' + event.data.error);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const toastSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const toastError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  // 1. Generation Logic
  const handleGenerateIdeas = async (tipo: 'story' | 'feed' | 'reels') => {
    const topic = tipo === 'story' ? storyTopic : tipo === 'feed' ? feedTopic : reelsTopic;
    if (!topic || topic.trim() === '') {
      toastError(`Digite o que deseja planejar para os ${tipo === 'story' ? 'Stories' : tipo === 'feed' ? 'Feed' : 'Reels'} nesta semana.`);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/instagram/generate-content', {
        descricao: topic,
        tipo: tipo
      });

      const resIdeas = response.data.suggestions || [];
      if (resIdeas.length === 0) {
        toastError('Nenhuma ideia retornada pela IA. Confirme as chaves e tente novamente.');
        return;
      }

      // Append tipo to ideas helper
      const mappedIdeas = resIdeas.map((i: any) => ({ ...i, tipo }));

      if (tipo === 'story') setStorySuggestions(mappedIdeas);
      else if (tipo === 'feed') setFeedSuggestions(mappedIdeas);
      else if (tipo === 'reels') setReelsSuggestions(mappedIdeas);

      toastSuccess(`Geração concluída! 10 sugestões de ${tipo.toUpperCase()} foram criadas.`);
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || 'Falha ao conectar com o serviço de IA.');
    } finally {
      setLoading(false);
    }
  };

  // Handle click on Idea Suggestions Card to expand Details Panel
  const handleSelectSuggestion = async (sugestion: any) => {
    setSelectedSug(sugestion);
    setDetailedStructure(null);
    setGeneratedImages([]);
    setImageModel('');
    setModoPost(sugestion.tipo === 'story' ? 'carrossel' : 'unica');
    setImagesOrder([]);

    // Auto load contextual details for Stories and Reels
    if (sugestion.tipo === 'story' || sugestion.tipo === 'reels') {
      await fetchSubStructureDetails(sugestion);
    }
  };

  const fetchSubStructureDetails = async (sug: any) => {
    setGeneratingDetails(true);
    try {
      const res = await axios.post('/api/instagram/generate-details', {
        tipo: sug.tipo,
        titulo: sug.titulo,
        descricao: sug.descricao
      });
      setDetailedStructure(res.data);
    } catch (err: any) {
      console.error('Erro ao gerar detalhes secundários:', err);
    } finally {
      setGeneratingDetails(false);
    }
  };

  // Image Uploader to Firebase Storage (with local base64 fallback)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match('image.*')) {
      toastError('Por favor selecione apenas arquivos de imagem autorizados (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setUploadingImage(true);
    try {
      const fileNameStr = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const path = `instagram/references/${fileNameStr}`;
      
      const fileUrl = await uploadToStorage(file, path);
      setImageModel(fileUrl);
      toastSuccess('Imagem de referência salva no Storage!');
    } catch (err: any) {
      console.error('Erro ao subir imagem de referência:', err);
      // Fallback: read local base64
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          setImageModel(loadEvent.target.result as string);
          toastSuccess('Imagem de referência importada localmente!');
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingImage(false);
    }
  };

  const triggerUploadInput = () => {
    const inputElement = document.getElementById('ref-upload-input');
    inputElement?.click();
  };

  // Image Generation Handler
  const handleGenerateVisualArt = async () => {
    if (!selectedSug) return;
    setGeneratingImages(true);
    try {
      const response = await axios.post('/api/instagram/generate-images', {
        tema: selectedSug.titulo,
        imagem_modelo: imageModel || undefined,
        modo: modoPost
      });

      const urls = response.data.urls || [];
      setGeneratedImages(urls);
      setImagesOrder(urls.map((_: any, idx: number) => idx));
      toastSuccess('Imagens promocionais geradas com sucesso pela IA!');
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || 'Falha ao rodar imagem IA.');
    } finally {
      setGeneratingImages(false);
    }
  };

  // Move image index on Carousel order helper
  const handleMoveImage = (fromIndex: number, direction: 'left' | 'right') => {
    const toIndex = direction === 'left' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= imagesOrder.length) return;

    const newOrder = [...imagesOrder];
    // Swap
    const temp = newOrder[fromIndex];
    newOrder[fromIndex] = newOrder[toIndex];
    newOrder[toIndex] = temp;

    setImagesOrder(newOrder);
  };

  // Resolves and uploads any base64 models or generated images before saving/scheduling
  const ensureImagesUploaded = async (currentImageModel: string, currentGeneratedImages: string[]) => {
    let resolvedImageModel = currentImageModel;
    let resolvedGeneratedImages = [...currentGeneratedImages];

    // 1. Check if imageModel is base64
    if (currentImageModel && currentImageModel.startsWith('data:')) {
      toastSuccess('Fazendo upload da imagem de referência para o Storage...');
      resolvedImageModel = await uploadToStorage(
        currentImageModel,
        `instagram/references/ref_${Date.now()}_final.png`
      );
    }

    // 2. Check if any generated images are base64 (e.g. Gemini fallback)
    for (let i = 0; i < resolvedGeneratedImages.length; i++) {
      const img = resolvedGeneratedImages[i];
      if (img && img.startsWith('data:')) {
        toastSuccess(`Salvando imagem promocional gerada ${i + 1} de ${resolvedGeneratedImages.length} no Storage...`);
        resolvedGeneratedImages[i] = await uploadToStorage(
          img,
          `instagram/generated/gen_${Date.now()}_${i}.png`
        );
      }
    }

    return {
      imageModel: resolvedImageModel,
      generatedImages: resolvedGeneratedImages
    };
  };

  // Publication Trigger
  const handlePublishNow = async () => {
    if (!selectedSug) return;
    if (generatedImages.length === 0) {
      toastError('Gere a arte promocional com IA antes de tentar publicar ou agendar.');
      return;
    }

    setIsPublishingNow(true);
    try {
      // Clean up base64 payloads to ensure Firestore sizes remain well within limits
      const { imageModel: uploadedImgModel, generatedImages: uploadedGenImages } = 
        await ensureImagesUploaded(imageModel, generatedImages);

      setImageModel(uploadedImgModel);
      setGeneratedImages(uploadedGenImages);

      // First save postages as a Draft
      const saveRes = await axios.post('/api/instagram/schedule', {
        tipo: selectedSug.tipo,
        titulo: selectedSug.titulo,
        descricao: selectedSug.descricao,
        hashtags: selectedSug.hashtags,
        imagem_modelo: uploadedImgModel,
        modo: modoPost,
        imagens_geradas: uploadedGenImages,
        ordem: imagesOrder,
        status: 'rascunho'
      });

      const savedPostId = saveRes.data.id;

      // Request immediate send
      toastSuccess('Iniciando conexões do bot. Aguarde processamento do Instagram...');
      const sendRes = await axios.post('/api/instagram/publish', {
        postId: savedPostId
      });

      toastSuccess('Publicado no Instagram com sucesso!');
      setSelectedSug(null);
      loadPosts();
      loadLogs();
      setActiveTab('calendario');
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || 'Canais ocupados. Falha na entrega imediata.');
    } finally {
      setIsPublishingNow(false);
    }
  };

  // Schedule Trigger
  const handleSchedulePost = async () => {
    if (!selectedSug) return;
    if (generatedImages.length === 0) {
      toastError('Gere a arte promocional com IA antes de agendar.');
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      toastError('Selecione a data e o horário para agendamento automático.');
      return;
    }

    const isoStringScheduled = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();

    setLoading(true);
    try {
      // Clean up base64 payloads to ensure Firestore sizes remain well within limits
      const { imageModel: uploadedImgModel, generatedImages: uploadedGenImages } = 
        await ensureImagesUploaded(imageModel, generatedImages);

      setImageModel(uploadedImgModel);
      setGeneratedImages(uploadedGenImages);

      await axios.post('/api/instagram/schedule', {
        tipo: selectedSug.tipo,
        titulo: selectedSug.titulo,
        descricao: selectedSug.descricao,
        hashtags: selectedSug.hashtags,
        imagem_modelo: uploadedImgModel,
        modo: modoPost,
        imagens_geradas: uploadedGenImages,
        ordem: imagesOrder,
        agendamento: isoStringScheduled,
        status: 'agendado'
      });

      toastSuccess(`Post planejado para ${scheduleDate} às ${scheduleTime}! (Timezone: America/Sao_Paulo)`);
      setSelectedSug(null);
      loadPosts();
      setActiveTab('calendario');
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || 'Falha ao agendar post.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Post
  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta postagem do histórico e cancelar agendamentos pendentes?')) return;
    try {
      await deleteDoc(doc(db, 'instagram_posts', postId));
      toastSuccess('Post removido.');
      loadPosts();
    } catch (err: any) {
      toastError('Erro ao deletar: ' + err.message);
    }
  };

  // Initiate Meta OAuth pop-up flow
  const handleMetaOAuth = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/instagram/auth-url');
      if (res.data?.url) {
        // Open Facebook Auth login dialog as a popup center
        const width = 600;
        const height = 750;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
          res.data.url, 
          'meta_auth_popup', 
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=yes`
        );
      } else {
        toastError('Não foi possível obter a URL de autenticação do Meta.');
      }
    } catch (err: any) {
      toastError('Erro ao iniciar login: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Connect specific Page + Instagram Account selection
  const handleSelectPage = async (page: any) => {
    if (!oauthResult?.accessToken) return;
    setLoading(true);
    try {
      const payload = {
        access_token: oauthResult.accessToken,
        page_id: page.pageId,
        instagram_business_id: page.instagramBusinessId,
        facebook_page_id: page.pageId,
        facebook_app_id: integracao.facebook_app_id || '',
        facebook_app_secret: integracao.facebook_app_secret || '',
        perfil_conectado: {
          username: page.instagramUsername || '',
          name: page.instagramName || '',
          profile_picture_url: page.instagramProfilePicture || '',
          page_name: page.pageName || ''
        },
        status: 'conectado'
      };

      await axios.post('/api/instagram/integracao', payload);
      toastSuccess(`Instagram @${page.instagramUsername || page.pageName} conectado!`);
      setOauthResult(null); // Clear selections
      loadIntegration(); // Reload live status checks
    } catch (err: any) {
      toastError('Erro ao finalizar conexão: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect / Clear active connection settings
  const handleDisconnect = async () => {
    if (!window.confirm('Deseja realmente desconectar seu perfil do Instagram? Isso impossibilitará novas postagens automatizadas.')) return;
    setLoading(true);
    try {
      const payload = {
        access_token: '',
        page_id: '',
        instagram_business_id: '',
        facebook_page_id: '',
        facebook_app_id: integracao.facebook_app_id || '',
        facebook_app_secret: integracao.facebook_app_secret || '',
        perfil_conectado: null,
        checks: null,
        status: 'Não configurado'
      };
      await axios.post('/api/instagram/integracao', payload);
      toastSuccess('Perfil desconectado com sucesso.');
      loadIntegration();
    } catch (err: any) {
      toastError('Erro ao desconectar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save Developer/App settings manually if changed
  const handleSaveDeveloperSettings = async () => {
    setLoading(true);
    try {
      const payload = {
        ...integracao,
        facebook_app_id: integracao.facebook_app_id || '',
        facebook_app_secret: integracao.facebook_app_secret || ''
      };
      await axios.post('/api/instagram/integracao', payload);
      toastSuccess('Configurações de Desenvolvedor salvas com sucesso.');
      loadIntegration();
    } catch (err: any) {
      toastError('Erro ao salvar configurações avançadas.');
    } finally {
      setLoading(false);
    }
  };

  // Connect manually using Page ID, Instagram ID, and Token (Skip creating App ID)
  const handleConnectManual = async () => {
    if (!integracao.access_token) {
      toastError('O Token de Acesso Ativo (Meta API) é obrigatório.');
      return;
    }
    if (!integracao.instagram_business_id) {
      toastError('O ID do Instagram Comercial é obrigatório.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        access_token: integracao.access_token.trim(),
        page_id: (integracao.page_id || '').trim(),
        instagram_business_id: integracao.instagram_business_id.trim(),
        facebook_page_id: (integracao.page_id || '').trim(),
        facebook_app_id: (integracao.facebook_app_id || '').trim(),
        facebook_app_secret: (integracao.facebook_app_secret || '').trim(),
        perfil_conectado: integracao.perfil_conectado || {
          username: 'perfil_manual',
          name: 'Instagram Manual',
          profile_picture_url: '',
          page_name: 'Página Manual'
        },
        status: 'conectado',
        checks: integracao.checks || {
          token_valid: true,
          instagram_connected: true,
          page_linked: true,
          permissions_approved: true
        }
      };

      await axios.post('/api/instagram/integracao', payload);
      toastSuccess('Credenciais salvas localmente! Sincronizando perfil com a Meta...');

      // Attempt to automatically retrieve the latest Meta details
      try {
        const resSync = await axios.post('/api/instagram/integracao/sincronizar');
        if (resSync.data?.integration?.perfil_conectado?.username) {
          toastSuccess(`Conexão manual estabelecida! Perfil @${resSync.data.integration.perfil_conectado.username} sincronizado.`);
        }
      } catch (errSync: any) {
        console.warn('Sincronização opcional falhou:', errSync);
        toastSuccess('Configuração manual gravada. Lembre-se de validar se o token inserido é válido e ativo.');
      }

      loadIntegration();
    } catch (err: any) {
      toastError('Erro ao conectar manualmente: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!integracao.access_token || !integracao.instagram_business_id) {
      toastError('Por favor, conecte a uma conta comercial antes de testar.');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/instagram/integracao/testar', {
        access_token: integracao.access_token,
        instagram_business_id: integracao.instagram_business_id,
        page_id: integracao.page_id
      });

      if (res.data?.valid) {
        toastSuccess(`Teste bem sucedido! Status: ${res.data.status_texto || res.data.status || 'Instagram Conectado com Sucesso'}`);
      } else {
        toastError(`Falha na validação: ${res.data?.status_texto || res.data?.status || 'Erro detectado'}`);
      }
      loadIntegration();
    } catch (err: any) {
      toastError('Erro ao testar a conexão com o Meta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans transition-colors relative">
      {/* Absolute floating notifications */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-24 right-4 md:right-8 z-[50] bg-zinc-900 border border-emerald-500 text-emerald-400 font-medium px-4 py-3 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2 text-sm"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
            {successMsg}
          </motion.div>
        )}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-24 right-4 md:right-8 z-[50] bg-zinc-900 border border-rose-500 text-rose-400 font-medium px-4 py-3 rounded-lg shadow-[0_0_20px_rgba(244,63,94,0.2)] flex items-center gap-2 text-sm"
          >
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Block with Premium Feel */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-semibold text-sm uppercase tracking-widest">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              Sua Inteligência de Vendas
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-amber-500 bg-clip-text text-transparent">
              Instagram AI Manager
            </h1>
            <p className="text-slate-400 mt-1 max-w-xl text-xs md:text-sm">
              Crie, agende e publique campanhas exclusivas no Instagram com inteligência multimodal para a <span className="text-amber-500">{COMPANY_NAME}</span>.
            </p>
          </div>

          {/* Sub Tab selection */}
          <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 self-start">
            <button
              onClick={() => { setActiveTab('gerador'); setSelectedSug(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'gerador' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Geração IA
            </button>
            <button
              onClick={() => { setActiveTab('calendario'); setSelectedSug(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'calendario' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendário
            </button>
            <button
              onClick={() => { setActiveTab('brand_kit'); setSelectedSug(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'brand_kit' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Palette className="w-3.5 h-3.5" /> Brand Kit IA
            </button>
            <button
              onClick={() => { setActiveTab('integracao'); setSelectedSug(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'integracao' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Settings className="w-3.5 h-3.5" /> Integração Meta
            </button>
            <button
              onClick={() => { setActiveTab('logs'); setSelectedSug(null); }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-300 flex items-center gap-2 ${activeTab === 'logs' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <History className="w-3.5 h-3.5" /> Logs / Auditoria
            </button>
          </div>
        </div>

        {/* ======================= TAB 1: GENERATOR FLOW ======================= */}
        {activeTab === 'gerador' && !selectedSug && (
          <div className="space-y-8 animate-fade-in">
            {/* 3 columns areas (Stories, Feed, Reels) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* STOIES CARD COLUMN */}
              <div className="bg-slate-900 border border-pink-900/30 rounded-2xl p-6 transition-all duration-500 hover:border-pink-900/60 relative overflow-hidden flex flex-col justify-between min-h-[380px] shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-600/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">1. Stories</h3>
                      <p className="text-[11px] text-pink-400 uppercase tracking-widest font-bold">Sequência de Engajamento</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Contexto da semana</label>
                    <textarea
                      value={storyTopic}
                      onChange={(e) => setStoryTopic(e.target.value)}
                      placeholder="Ex: Promoção perfumes femininos, Novidade maquiagem importada..."
                      className="w-full h-32 px-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-xl focus:border-pink-500 focus:ring-1 focus:ring-pink-500 text-slate-100 placeholder-slate-600 outline-none resize-none transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col space-y-2">
                  <button
                    disabled={loading}
                    onClick={() => handleGenerateIdeas('story')}
                    className="w-full bg-gradient-to-r from-pink-600 to-pink-500 hover:from-pink-500 hover:to-pink-400 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar Ideias Stories
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">Gera 10 ideias de sequência roteirizada</p>
                </div>
              </div>

              {/* FEED CARD COLUMN */}
              <div className="bg-slate-900 border border-violet-900/30 rounded-2xl p-6 transition-all duration-500 hover:border-violet-900/60 relative overflow-hidden flex flex-col justify-between min-h-[380px] shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">2. Feed</h3>
                      <p className="text-[11px] text-violet-400 uppercase tracking-widest font-bold">Carrossel & Imagem única</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Contexto da semana</label>
                    <textarea
                      value={feedTopic}
                      onChange={(e) => setFeedTopic(e.target.value)}
                      placeholder="Ex: Semana dia das mães, Lançamento skincare, Perfumes importados..."
                      className="w-full h-32 px-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-xl focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-slate-100 placeholder-slate-600 outline-none resize-none transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col space-y-2">
                  <button
                    disabled={loading}
                    onClick={() => handleGenerateIdeas('feed')}
                    className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar Ideias Feed
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">Gera 10 ideias de copywriting e arte visual</p>
                </div>
              </div>

              {/* REELS CARD COLUMN */}
              <div className="bg-slate-900 border border-amber-900/30 rounded-2xl p-6 transition-all duration-500 hover:border-amber-900/60 relative overflow-hidden flex flex-col justify-between min-h-[380px] shadow-lg">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-white">3. Reels</h3>
                      <p className="text-[11px] text-amber-400 uppercase tracking-widest font-bold">Roteiro & Áudio viral</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase">Contexto da semana</label>
                    <textarea
                      value={reelsTopic}
                      onChange={(e) => setReelsTopic(e.target.value)}
                      placeholder="Ex: Campanha skincare luxo, Tendências de beleza cosmética..."
                      className="w-full h-32 px-4 py-3 text-sm bg-slate-950 border border-slate-800 rounded-xl focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-slate-100 placeholder-slate-600 outline-none resize-none transition-all duration-300"
                    />
                  </div>
                </div>

                <div className="pt-4 flex flex-col space-y-2">
                  <button
                    disabled={loading}
                    onClick={() => handleGenerateIdeas('reels')}
                    className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md cursor-pointer transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Gerar Ideias Reels
                  </button>
                  <p className="text-[10px] text-slate-500 text-center">Gera 10 ideias de roteiros de alta retenção</p>
                </div>
              </div>

            </div>

            {/* List suggestions outputs below in standard cards */}
            {(storySuggestions.length > 0 || feedSuggestions.length > 0 || reelsSuggestions.length > 0) && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="w-5 h-5 text-amber-400" />
                    Sugestões Planejadas pela IA
                  </h3>
                  <button 
                    onClick={() => { setStorySuggestions([]); setFeedSuggestions([]); setReelsSuggestions([]); }}
                    className="text-xs text-slate-500 hover:text-white transition-colors cursor-pointer"
                  >
                    Limpar Resultados
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Map over all sets of results */}
                  {[...storySuggestions, ...feedSuggestions, ...reelsSuggestions].map((s, index) => {
                    const tagStyle = s.tipo === 'story' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 
                                     s.tipo === 'feed' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                                     'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={index}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all duration-300 shadow-md group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tagStyle}`}>
                              {s.tipo}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">Sugestão #{index + 1}</span>
                          </div>

                          <div>
                            <h4 className="font-bold text-slate-100 text-sm group-hover:text-amber-400 transition-colors duration-300">
                              {s.titulo}
                            </h4>
                            <p className="text-slate-400 text-xs mt-1.5 line-clamp-3">
                              {s.descricao}
                            </p>
                          </div>
                          
                          {/* Hashtags mini cards list */}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {s.hashtags?.slice(0, 3).map((h: string, hIdx: number) => (
                              <span key={hIdx} className="text-[10px] bg-slate-950 text-slate-500 px-1.5 py-0.5 rounded">
                                #{h.replace('#', '')}
                              </span>
                            ))}
                            {s.hashtags?.length > 3 && (
                              <span className="text-[9px] text-slate-600 px-1 py-0.5">+{s.hashtags.length - 3}</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-800/60">
                          <button
                            onClick={() => handleSelectSuggestion(s)}
                            className="w-full bg-slate-950 hover:bg-amber-600 text-slate-300 hover:text-white transition-all duration-300 text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Detalhes & Criar Arte
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Show Quick Stats banner */}
            <div className="bg-gradient-to-r from-amber-600/10 to-slate-900 rounded-2xl p-6 border border-amber-600/20 flex flex-col md:flex-row gap-6 justify-between items-center">
              <div className="space-y-1 max-w-2xl">
                <h4 className="text-white font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 animate-pulse" />
                  Como criar arte inteligente guiada?
                </h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Basta escolher uma ideia, carregar uma foto de referência de qualquer produto (maquiagem, perfume) e a IA DALL-E do sistema analisará a iluminação e as cores para fabricar uma arte profissional nova, contextualizada para a <span className="text-white font-semibold">Discreta Boutique</span>.
                </p>
              </div>
              <button 
                onClick={() => {
                  setStoryTopic('Promoção perfumes femininos importados com notas florais marcantes');
                  setFeedTopic('Coleção exclusiva de maquiagens sofisticadas para eventos de gala');
                  setReelsTopic('Rotina rápida de Skincare noturna para pele radiante e saudável');
                  toastSuccess('Desires de testes preenchidos com sucesso!');
                }}
                className="bg-slate-950 text-amber-400 border border-amber-600/30 hover:bg-slate-900 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
              >
                Preencher Inputs Exemplo
              </button>
            </div>
          </div>
        )}

        {/* ======================= DETAILED CARD EXPANSION VIEW ======================= */}
        {selectedSug && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in pb-16">
            
            {/* Left Column: Detalista controls */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Back actions */}
              <button
                onClick={() => setSelectedSug(null)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white font-bold uppercase tracking-wider pb-2 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar para Sugestões
              </button>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest bg-amber-600/10 text-amber-500 px-2.5 py-0.5 rounded-full uppercase border border-amber-500/20">
                      {selectedSug.tipo}
                    </span>
                    <span className="text-slate-500 font-mono text-xs">• Detalhes Estratégicos</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mt-1.5">{selectedSug.titulo}</h2>
                  <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                    {selectedSug.descricao}
                  </p>
                </div>

                {/* Tags array */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedSug.hashtags?.map((tag: string, index: number) => (
                    <span key={index} className="text-xs font-mono bg-slate-950 text-slate-400 border border-slate-800 px-2.5 py-1 rounded-md">
                      #{tag.replace('#', '')}
                    </span>
                  ))}
                </div>

                {/* Sub-structures of Reels and Stories (Scripted Sequences) */}
                {generatingDetails && (
                  <div className="p-4 bg-slate-950 border border-slate-850 rounded-xl space-y-3 animate-pulse">
                    <div className="h-4 bg-slate-850 w-1/3 rounded"></div>
                    <div className="h-2.5 bg-slate-850 w-3/4 rounded"></div>
                    <div className="h-2.5 bg-slate-850 w-1/2 rounded"></div>
                  </div>
                )}

                {detailedStructure && !generatingDetails && (
                  <div className="p-4 bg-slate-950 border border-amber-500/10 rounded-xl space-y-4">
                    {selectedSug.tipo === 'story' && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-500 flex items-center gap-2">
                          <LayoutGrid className="w-4 h-4" /> Sequência Automatizada para Stories ({detailedStructure.telas?.length || 0} Telas)
                        </h4>
                        
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2">
                          {detailedStructure.telas?.map((tela: any, tIdx: number) => (
                            <div key={tIdx} className="border-l-2 border-slate-800 pl-3 py-1 text-xs">
                              <span className="font-bold text-slate-300 uppercase block tracking-wider text-[10px]">Story {tIdx + 1}: {tela.tipo}</span>
                              <p className="text-slate-400 mt-1"><strong className="text-slate-500 font-normal">Fala:</strong> {tela.fala}</p>
                              <p className="text-slate-200 mt-0.5"><strong className="text-slate-500 font-normal">Texto na tela:</strong> {tela.texto_tela}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSug.tipo === 'reels' && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold uppercase tracking-widest text-amber-500 flex items-center gap-2">
                          <FileText className="w-4 h-4" /> Roteiro Multimodal Reels ({DURATION_REELS})
                        </h4>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="font-semibold text-slate-400">Roteiro Visual:</span>
                            <p className="text-slate-300 mt-0.5 bg-slate-900 border border-slate-800 p-2 rounded">{detailedStructure.roteiro}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">Narração recomendada:</span>
                            <p className="text-slate-300 mt-0.5 bg-slate-900 border border-slate-800 p-2 rounded italic">"{detailedStructure.falas}"</p>
                          </div>
                          <div className="flex gap-4">
                            <div>
                              <span className="font-semibold text-slate-400">Tempo:</span>
                              <p className="text-amber-500 font-bold">{DURATION_REELS}</p>
                            </div>
                            {detailedStructure.sugestao_audio && (
                              <div>
                                <span className="font-semibold text-slate-400">Áudio Recomendado:</span>
                                <p className="text-slate-300 font-medium">{detailedStructure.sugestao_audio}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: CONFIGURAÇÃO DE IMAGENS & ARTES */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl relative">
                <h3 className="font-bold text-lg text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ImageIcon className="w-5 h-5 text-amber-500" />
                  Geração de Arte com IA
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                  
                  {/* Photo Upload Area */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Foto Modelo / Referência</label>
                    <div 
                      onClick={triggerUploadInput}
                      className="border-2 border-dashed border-slate-800 hover:border-amber-600/55 bg-slate-950 p-6 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 relative group min-h-[160px]"
                    >
                      {imageModel ? (
                        <div className="absolute inset-0 p-2">
                          <img src={imageModel} alt="Reference Model" className="w-full h-full object-cover rounded-lg" />
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white p-2">
                            Mudar imagem de referência
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5 text-slate-500">
                          <Upload className="w-8 h-8 mx-auto text-slate-600 group-hover:text-amber-500 transition-colors" />
                          <p className="text-xs font-semibold text-slate-400">Arraste ou Clique para fazer upload</p>
                          <p className="text-[10px] text-slate-600">PNG, JPG, WEBP • Max 10MB</p>
                        </div>
                      )}
                    </div>
                    <input 
                      id="ref-upload-input"
                      type="file" 
                      accept=".png,.jpg,.jpeg,.webp" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </div>

                  {/* Config settings */}
                  <div className="flex flex-col justify-between">
                    <div className="space-y-3">
                      <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Configuração de Formato</label>
                      <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-850">
                        <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer p-1.5 rounded hover:bg-slate-900 transition-colors">
                          <input
                            type="radio"
                            name="modoPost"
                            checked={modoPost === 'unica'}
                            onChange={() => { setModoPost('unica'); setGeneratedImages([]); }}
                            className="accent-amber-500 h-4 w-4"
                          />
                          <div>
                            <span className="font-bold text-white block">Imagem Única</span>
                            <span className="text-[11px] text-slate-500">Gera 1 imagem promocional única</span>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 text-xs text-slate-300 cursor-pointer p-1.5 rounded hover:bg-slate-900 transition-colors">
                          <input
                            type="radio"
                            name="modoPost"
                            checked={modoPost === 'carrossel'}
                            onChange={() => { setModoPost('carrossel'); setGeneratedImages([]); }}
                            disabled={selectedSug.tipo === 'reels'}
                            className="accent-amber-500 h-4 w-4"
                          />
                          <div>
                            <span className="font-bold text-white block">Carrossel Estruturado</span>
                            <span className="text-[11px] text-slate-500">{selectedSug.tipo === 'reels' ? 'Não disponível para Reels' : 'Gera 5 imagens complementares sequenciais'}</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateVisualArt}
                      disabled={generatingImages}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-900 text-xs font-black py-3 px-4 rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50 mt-4"
                    >
                      {generatingImages ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-slate-950" />}
                      {generatingImages ? 'Analisando Referência & Gerando...' : 'Gerar Arte com IA'}
                    </button>
                  </div>

                </div>

                {/* Generated list with reordering arrows on carousels */}
                {generatedImages.length > 0 && (
                  <div className="space-y-3.5 pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-extrabold text-slate-300 uppercase tracking-widest block">Imagens Geradas ({generatedImages.length})</span>
                      <span className="text-[10px] text-slate-500 italic">Pre-visualização com ordenação ativa</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
                      {imagesOrder.map((origIdx, orderIdx) => {
                        const url = generatedImages[origIdx];
                        let slideTitle = 'Visual';
                        if (modoPost === 'carrossel') {
                          const titles = ['Capa', 'Benefício', 'Produto', 'Promoção', 'CTA'];
                          slideTitle = titles[orderIdx] || 'Slide';
                        }
                        return (
                          <div key={orderIdx} className="bg-slate-950 border border-slate-800 p-1 px-1 rounded-lg flex flex-col space-y-1 group/item relative">
                            <div className="h-20 w-full overflow-hidden rounded relative">
                              <img src={url} alt={`Slide ${orderIdx}`} className="w-full h-full object-cover" />
                              <span className="absolute bottom-1 right-1 text-[8px] bg-black/80 text-amber-500 px-1 py-0.5 rounded font-black uppercase">
                                {slideTitle}
                              </span>
                            </div>

                            {/* Move controls */}
                            <div className="flex items-center justify-between pointer-events-auto h-6 mt-1 px-1 gap-1">
                              <button
                                disabled={orderIdx === 0}
                                onClick={() => handleMoveImage(orderIdx, 'left')}
                                className="p-0.5 rounded bg-slate-900 hover:bg-amber-600/20 text-slate-500 hover:text-white transition-all disabled:opacity-30 flex-1 flex justify-center cursor-pointer"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                              <span className="font-mono text-[10px] font-bold text-slate-400 px-1 text-center ">{orderIdx + 1}</span>
                              <button
                                disabled={orderIdx === imagesOrder.length - 1}
                                onClick={() => handleMoveImage(orderIdx, 'right')}
                                className="p-0.5 rounded bg-slate-900 hover:bg-amber-600/20 text-slate-500 hover:text-white transition-all disabled:opacity-30 flex-1 flex justify-center cursor-pointer"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: AGENDAMENTO E PUBLICAÇÃO CONTROLS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
                <h3 className="font-bold text-lg text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Agendar ou Publicar
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pick date and hour */}
                  <div className="space-y-3 p-4 bg-slate-950 border border-slate-850 rounded-xl">
                    <label className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">Definir data do Scheduler</label>
                    
                    <div className="grid grid-cols-2 gap-3.5">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Data</span>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full bg-slate-900 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500">Hora</span>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full bg-slate-900 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2 text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-600" /> Timezone ativa: <strong>America/Sao_Paulo</strong>
                    </div>

                    <button
                      onClick={handleSchedulePost}
                      disabled={loading || generatedImages.length === 0}
                      className="w-full bg-slate-900 hover:bg-amber-600 text-slate-300 hover:text-white border border-slate-800 hover:border-amber-600 py-3.5 text-xs font-black rounded-lg transition-all duration-300 cursor-pointer disabled:opacity-40 uppercase tracking-wider"
                    >
                      Salvar / Agendar Postagem
                    </button>
                  </div>

                  {/* Immediate send */}
                  <div className="flex flex-col justify-between p-4 bg-slate-950 border border-slate-850 rounded-xl">
                    <div className="space-y-1">
                      <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wider block">Envio Imediato</span>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Ignore o agendamento em background e envie os arquivos multimídias processados imediatamente para a conta conectada nas APIs da Meta de forma integrada.
                      </p>
                    </div>

                    <button
                      onClick={handlePublishNow}
                      disabled={isPublishingNow || generatedImages.length === 0}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 text-xs rounded-lg transition-all cursor-pointer uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.15)] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isPublishingNow ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {isPublishingNow ? 'Conectando...' : 'Publicar Agora'}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column (Live Instagram Preview Mockups) */}
            <div className="lg:col-span-5 space-y-6">
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-widest pl-1">Visualização em Tempo Real</h3>
              
              {/* Instagram Phone frame container */}
              <div className="w-full max-w-[340px] mx-auto bg-slate-950 rounded-[40px] border-[12px] border-slate-900 shadow-2xl relative overflow-hidden aspect-[9/16] flex flex-col justify-between">
                
                {/* Speaker slit top */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full flex items-center justify-center z-20">
                  <div className="w-8 h-1 bg-slate-850 rounded-full"></div>
                </div>

                {/* Top status simulated bar */}
                <div className="bg-slate-900 text-[10px] font-bold text-slate-400 px-6 pt-3 pb-1 flex justify-between tracking-wide select-none">
                  <span>14:30</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span>5G</span>
                    <div className="w-5 h-2.5 border border-slate-500 rounded p-[1px] relative">
                      <div className="h-full bg-slate-300 w-[80%] rounded-[1px]"></div>
                    </div>
                  </div>
                </div>

                {/* Simulated Container body */}
                <div className="flex-1 bg-black flex flex-col justify-start overflow-y-auto custom-scroll p-3 pt-0 relative">
                  
                  {/* PREVIEW: STORY */}
                  {selectedSug.tipo === 'story' && (
                    <div className="h-full w-full flex flex-col justify-between pb-10 text-white animate-fade-in">
                      
                      {/* Stories Top indicators line progress bar */}
                      <div className="flex gap-1.5 w-full pt-2">
                        {Array.from({ length: Math.max(1, generatedImages.length) }).map((_, stIdx) => (
                          <div key={stIdx} className="h-0.5 bg-slate-800 flex-1 rounded opacity-60 overflow-hidden relative">
                            {stIdx === 0 && <div className="h-full bg-white animate-shrink w-full"></div>}
                          </div>
                        ))}
                      </div>

                      {/* User title bar */}
                      <div className="flex items-center justify-between pt-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full border border-pink-500 bg-slate-900 flex items-center justify-center text-[10px] p-0.5">
                            <span className="font-extrabold text-amber-500">DB</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black">{COMPANY_NAME.toLowerCase()}</span>
                            <span className="text-[8px] text-slate-400 ml-1">1h</span>
                          </div>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Center Image Canvas */}
                      <div className="flex-1 my-4 rounded-xl overflow-hidden relative border border-slate-900 bg-slate-950 flex flex-col justify-center">
                        {generatedImages.length > 0 ? (
                          <img src={generatedImages[imagesOrder[0] || 0]} alt="Story" className="w-full h-full object-cover" />
                        ) : (
                          <div className="p-6 text-center space-y-1.5 text-slate-600 text-xs">
                            <ImageIcon className="w-8 h-8 text-slate-700 mx-auto" />
                            <p>Arte gerada com IA aparecerá aqui</p>
                          </div>
                        )}
                        
                        {/* Overlay text mock */}
                        {detailedStructure?.telas?.[0] && (
                          <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 text-center text-[11px] leading-relaxed shadow-lg">
                            {detailedStructure.telas[0].texto_tela}
                          </div>
                        )}
                      </div>

                      {/* Footer mock input messages */}
                      <div className="flex items-center gap-3 justify-between">
                        <div className="border border-slate-800 rounded-full py-1.5 px-4 text-[10px] flex-1 text-slate-500">
                          Enviar uma mensagem...
                        </div>
                        <Heart className="w-4 h-4 text-slate-400" />
                        <Send className="w-4 h-4 text-slate-400" />
                      </div>

                    </div>
                  )}

                  {/* PREVIEW: FEED & CARROSSEL */}
                  {(selectedSug.tipo === 'feed' || selectedSug.tipo === 'reels') && (
                    <div className="bg-slate-950 border border-slate-900 rounded-xl overflow-hidden text-white mt-3 animate-fade-in">
                      
                      {/* Feed Header */}
                      <div className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-900 border border-amber-500 flex items-center justify-center text-[9px] p-[2px]">
                            <span className="font-black text-amber-500">DB</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black block leading-none">{COMPANY_NAME.toLowerCase()}</span>
                            <span className="text-[8px] text-slate-500 leading-none">Patrocinado</span>
                          </div>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-slate-400" />
                      </div>

                      {/* Main Image content */}
                      <div className="aspect-square bg-black border-y border-slate-900 relative flex items-center justify-center">
                        {generatedImages.length > 0 ? (
                          <img src={generatedImages[imagesOrder[0] || 0]} alt="Feed Post" className="w-full h-full object-cover" />
                        ) : (
                          <div className="p-8 text-center space-y-1 text-slate-600 text-xs">
                            <ImageIcon className="w-10 h-10 text-slate-700 mx-auto" />
                            <p>Arte gerada com IA aparecerá aqui</p>
                          </div>
                        )}

                        {/* Carousel dots indicator */}
                        {modoPost === 'carrossel' && generatedImages.length > 0 && (
                          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1 bg-black/60 px-2 py-1 rounded-full border border-white/5">
                            {generatedImages.map((_, dotIdx) => (
                              <div key={dotIdx} className={`w-1 h-1 rounded-full ${dotIdx === 0 ? 'bg-amber-400' : 'bg-slate-600'}`}></div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ActionBar Feed */}
                      <div className="p-3 space-y-2">
                        <div className="flex justify-between items-center text-slate-200">
                          <div className="flex gap-3">
                            <Heart className="w-4 h-4 text-amber-500 fill-amber-500" />
                            <MessageCircle className="w-4 h-4" />
                            <Send className="w-4 h-4" />
                          </div>
                          <Bookmark className="w-4 h-4 text-slate-400" />
                        </div>

                        {/* Caption overlay */}
                        <div className="text-[11px] leading-relaxed">
                          <span className="font-extrabold block mr-1 text-slate-300">{COMPANY_NAME.toLowerCase()}:</span>
                          <span className="text-slate-400 font-medium line-clamp-3 my-1">
                            {selectedSug.titulo} - {selectedSug.descricao}
                          </span>
                          <span className="text-amber-500 font-medium tracking-tight block">
                            {selectedSug.hashtags?.map((h: string) => `#${h.replace('#', '')}`).join(' ')}
                          </span>
                        </div>
                      </div>

                    </div>
                  )}

                </div>

                {/* Home indicator bar bottom */}
                <div className="bg-slate-900 h-6 flex justify-center items-center select-none pt-1">
                  <div className="w-24 h-1 bg-slate-800 rounded-full"></div>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* ======================= TAB 2: POSTS LIST / CALENDAR ======================= */}
        {activeTab === 'calendario' && (
          <div className="space-y-6 animate-fade-in pb-16">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Grade de Agendamento Inteligente
                </h3>
                <p className="text-slate-400 text-xs mt-1">Veja seus conteúdos planejados ou já enviados organizados na timeline.</p>
              </div>
              <button 
                onClick={loadPosts}
                className="bg-slate-900 text-slate-400 hover:text-white border border-slate-800 p-2 text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar Grade
              </button>
            </div>

            {posts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-850 p-12 text-center rounded-2xl max-w-xl mx-auto space-y-4">
                <Calendar className="w-12 h-12 text-slate-700 mx-auto animate-pulse" />
                <h4 className="font-bold text-white text-md">Nenhuma postagem ativa cadastrada</h4>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Use nossa aba Geração IA para conceber novas postagens promocionais, carregar fotos modelo e agendar publicação automática no Instagram.
                </p>
                <button
                  onClick={() => setActiveTab('gerador')}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs py-2 px-4 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Ir para Gerador IA <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => {
                  const tagStyle = post.tipo === 'story' ? 'bg-pink-500/10 text-pink-400 border border-pink-500/20' : 
                                   post.tipo === 'feed' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                                   'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                  
                  const statusColors = post.status === 'publicado' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      post.status === 'agendado' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 text-glow' :
                                      post.status === 'erro' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                      'bg-slate-500/10 text-slate-400 border border-slate-500/20';

                  const formattedDate = post.agendamento ? new Date(post.agendamento).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Rascunho';

                  return (
                    <div 
                      key={post.id}
                      className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-300 flex flex-col justify-between shadow-md relative"
                    >
                      {/* Top banner */}
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${tagStyle}`}>
                            {post.tipo}
                          </span>
                          <span className={`text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded-full ${statusColors}`}>
                            {post.status}
                          </span>
                        </div>

                        {/* Image banner thumb if available */}
                        {post.imagens_geradas && post.imagens_geradas.length > 0 && (
                          <div className="h-32 w-full overflow-hidden rounded-lg bg-slate-950 relative border border-slate-850">
                            <img src={post.imagens_geradas[0]} alt="Postage thumb" className="w-full h-full object-cover" />
                            {post.modo === 'carrossel' && (
                              <span className="absolute top-2 right-2 text-[9px] bg-black/80 border border-white/10 text-amber-500 px-2 py-0.5 rounded font-black uppercase">
                                Carrossel ({post.imagens_geradas.length} Imgs)
                              </span>
                            )}
                          </div>
                        )}

                        <div>
                          <h4 className="font-bold text-slate-100 text-sm">{post.titulo}</h4>
                          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed line-clamp-3">{post.descricao}</p>
                          
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-3 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-600" /> Agenda: <strong className="text-slate-400 font-bold">{formattedDate}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Error logs show if status is error */}
                      {post.status === 'erro' && post.log_erro && (
                        <div className="mt-4 p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-[10px] text-rose-400 leading-normal flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-none" />
                          <p className="line-clamp-2"><strong>Erro Instagram:</strong> {post.log_erro}</p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-850 flex items-center justify-between">
                        <button
                          onClick={() => {
                            // Load to draft detailed states
                            setSelectedSug({
                              tipo: post.tipo,
                              titulo: post.titulo,
                              descricao: post.descricao,
                              hashtags: post.hashtags
                            });
                            setGeneratedImages(post.imagens_geradas || []);
                            setImageModel(post.imagem_modelo || '');
                            setModoPost(post.modo || 'unica');
                            setImagesOrder(post.ordem || []);
                          }}
                          className="text-xs text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Editar / Reagendar
                        </button>

                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-xs text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-950 cursor-pointer"
                          title="Remover Postagem"
                        >
                          <Trash2 className="w-4 h-4 text-rose-600" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ======================= TAB: BRAND KIT ======================= */}
        {activeTab === 'brand_kit' && (
          <BrandKitComponent 
            toastSuccess={toastSuccess} 
            toastError={toastError} 
          />
        )}

        {/* ======================= TAB 3: INTEGRATION SETTINGS ======================= */}
        {activeTab === 'integracao' && (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl animate-fade-in pb-16">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Settings className="w-5 h-5 text-amber-500 animate-spin-slow" />
                Integração Oficial Meta / Instagram
              </h3>
              <p className="text-slate-400 text-xs mt-1 leading-normal">
                Gerencie sua conexão automatizada de planejamento e agendamento. Sem configurações manuais complexas ou preenchimento manual de IDs técnicos.
              </p>
            </div>

            {/* SELECTION STATE: OAuth completed, list of pages loaded */}
            {oauthResult && oauthResult.pages && oauthResult.pages.length > 0 && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                  <h4 className="text-amber-400 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Páginas e Perfis do Instagram Encontrados
                  </h4>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Selecione abaixo a conta que deseja conectar e ativar comercialmente para as publicações automatizadas.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3.5">
                  {oauthResult.pages.map((pOpt: any) => {
                    const hasIg = !!pOpt.instagramBusinessId;
                    return (
                      <div 
                        key={pOpt.pageId} 
                        className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${hasIg ? 'bg-slate-950 border-slate-800 hover:border-slate-700' : 'bg-slate-950/40 border-slate-900 opacity-60'}`}
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={pOpt.instagramProfilePicture || '/avatar-placeholder.png'} 
                            alt={pOpt.instagramUsername || 'Instagram Profile'} 
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full object-cover border border-slate-800 bg-slate-900"
                          />
                          <div>
                            {hasIg ? (
                              <>
                                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                  {pOpt.instagramName || pOpt.instagramUsername}
                                  <span className="text-xs text-slate-500 font-normal">(@{pOpt.instagramUsername})</span>
                                </h4>
                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                  Página Facebook: <strong className="text-slate-300 font-semibold">{pOpt.pageName}</strong>
                                </p>
                              </>
                            ) : (
                              <>
                                <h4 className="text-sm font-bold text-slate-400">{pOpt.pageName}</h4>
                                <p className="text-[11px] text-rose-400 font-medium mt-0.5 flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                  Instagram Business não conectado a esta página.
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        {hasIg ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSelectPage(pOpt)}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-lg transition-all self-end sm:self-center cursor-pointer disabled:opacity-50"
                          >
                            Ativar Perfil
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic px-3 py-1 bg-slate-900/40 rounded border border-slate-950">Indisponível</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    type="button" 
                    onClick={() => setOauthResult(null)} 
                    className="text-xs font-semibold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    Voltar para a tela inicial
                  </button>
                </div>
              </div>
            )}

            {/* SELECTION STATE: OAuth completed but NO pages found */}
            {oauthResult && oauthResult.pages && oauthResult.pages.length === 0 && (
              <div className="p-8 bg-slate-950 border border-slate-850 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
                <XCircle className="w-12 h-12 text-rose-500 mx-auto" strokeWidth={1.5} />
                <div className="space-y-1">
                  <h4 className="text-white text-md font-bold">Nenhuma página comercial encontrada</h4>
                  <p className="text-slate-400 text-xs leading-relaxed animate-pulse">
                    Não detectamos nenhuma página do Facebook vinculada com um perfil do Instagram comercial em sua conta Meta.
                  </p>
                </div>
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-400 rounded-lg text-left leading-relaxed">
                  <strong>💡 Requisito obrigatório:</strong> Para usar a integração automática comercial do Instagram, sua conta do Instagram precisa ser de criador ou comercial (Business) e estar expressamente vinculada nas configurações de sua página do Facebook.
                </div>
                <div className="flex justify-center gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setOauthResult(null)}
                    className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg border border-slate-800 hover:bg-slate-850 cursor-pointer"
                  >
                    Tentar Novamente
                  </button>
                </div>
              </div>
            )}

            {/* MAIN STATE: Active Connection Status Display */}
            {!oauthResult && integracao.access_token && integracao.perfil_conectado && (
              <div className="space-y-6">
                {/* Profile Card Summary */}
                <div className="p-5 bg-slate-950 border border-slate-850 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={integracao.perfil_conectado.profile_picture_url || '/avatar-placeholder.png'}
                      alt={integracao.perfil_conectado.username || 'Perfil'}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border border-slate-800 shadow-md bg-slate-900"
                    />
                    <div>
                      <h4 className="text-white text-md font-bold flex items-center gap-1.5">
                        {integracao.perfil_conectado.name || integracao.perfil_conectado.username}
                        <span className="text-xs text-slate-500 font-semibold">(@{integracao.perfil_conectado.username})</span>
                      </h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        Página vinculada: <strong className="text-slate-300">{integracao.perfil_conectado.page_name}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 border border-emerald-500/10 rounded-full font-bold uppercase tracking-wide flex items-center gap-1 animate-pulse">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">Oficial Meta API</span>
                  </div>
                </div>

                {/* Validation Status Badges Grid */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Status e Validação da Integração</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${integracao.checks?.token_valid !== false ? 'text-emerald-500' : 'text-slate-600'}`} />
                        Token de Acesso válido
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${integracao.checks?.token_valid !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {integracao.checks?.token_valid !== false ? 'VÁLIDO' : 'DEFEITUOSO'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${integracao.checks?.instagram_connected !== false ? 'text-emerald-500' : 'text-slate-600'}`} />
                        Instagram Comercial conectado
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${integracao.checks?.instagram_connected !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {integracao.checks?.instagram_connected !== false ? 'OK' : 'FALHA'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${integracao.checks?.page_linked !== false ? 'text-emerald-500' : 'text-slate-600'}`} />
                        Página Facebook vinculada
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${integracao.checks?.page_linked !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {integracao.checks?.page_linked !== false ? 'CONECTADA' : 'FALHA'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-2">
                        <CheckCircle2 className={`w-4 h-4 ${integracao.checks?.permissions_approved !== false ? 'text-emerald-500' : 'text-slate-600'}`} />
                        Permissões aprovadas
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${integracao.checks?.permissions_approved !== false ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {integracao.checks?.permissions_approved !== false ? 'ACEITO' : 'AUSENTE'}
                      </span>
                    </div>

                  </div>

                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-slate-500 bg-slate-950/20 p-3 rounded-lg border border-slate-850 border-dashed">
                    <div>
                      📅 <strong>Expiração:</strong> <span className="text-slate-400 font-semibold">Token de Longo Prazo Permanente / 60 Dias</span>
                    </div>
                    <div>
                      🔄 <strong>Última Sincronização:</strong> <span className="text-slate-400 font-semibold font-mono">{integracao.last_sync ? new Date(integracao.last_sync).toLocaleString('pt-BR') : 'Agora'}</span>
                    </div>
                  </div>
                </div>

                {/* Control Action Buttons */}
                <div className="pt-4 border-t border-slate-850 flex flex-col sm:flex-row justify-between gap-4">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDisconnect}
                    className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-rose-500/20 text-rose-400 font-extrabold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Power className="w-3.5 h-3.5 text-rose-500 animate-pulse" /> Desconectar Perfil
                  </button>

                  <div className="flex gap-3 justify-end w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleMetaOAuth}
                      className="px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 font-extrabold text-xs rounded-xl border border-blue-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      Trocar Página / Perfil
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleTestConnection}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-amber-900/10"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Testar Conexão Oficial
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MAIN STATE: No Saved Integration Setup page */}
            {!oauthResult && (!integracao.access_token || !integracao.perfil_conectado) && (
              <div className="p-8 bg-slate-950 border border-slate-850 rounded-2xl space-y-6 max-w-xl mx-auto">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-12 h-12 bg-amber-600/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 shadow-inner animate-pulse">
                    <Link2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-white text-md font-extrabold leading-normal">Conectar sua Conta do Instagram</h4>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-sm mx-auto">
                    Habilite a automação oficial do Instagram Meta API. Escolha o método que melhor atende às suas necessidades abaixo:
                  </p>
                </div>

                {/* Connection Method Selector */}
                <div className="flex bg-slate-900 border border-slate-850 p-1 rounded-xl max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={() => setConnMethod('manual')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      connMethod === 'manual'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🔌 Conexão Manual (Sem App ID)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConnMethod('oauth')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      connMethod === 'oauth'
                        ? 'bg-amber-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    🌐 Login Popup (App ID)
                  </button>
                </div>

                {/* METHOD 1: MANUAL DIRECT ENTRY */}
                {connMethod === 'manual' && (
                  <div className="bg-slate-900/60 p-5 border border-slate-850 rounded-xl text-left space-y-5">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-black">🔌</span>
                      <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider block">Inserir Identificadores Manuais</h5>
                    </div>

                    <p className="text-[11px] text-slate-500 leading-normal">
                      Insira diretamente as credenciais obtidas no portal Facebook Developers (pelo Graph Explorer ou App). Isso evita erros de IDs de aplicativo indisponíveis.
                    </p>

                    <div className="space-y-4">
                      {/* Access Token Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">User Access Token Ativo (Meta API)</label>
                        <textarea
                          rows={3}
                          placeholder="Cole aqui seu Token de Acesso Ativo (Começa com EAAC...)"
                          value={integracao.access_token || ''}
                          onChange={(e) => setIntegracao({ ...integracao, access_token: e.target.value })}
                          className="w-full bg-slate-950 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 font-mono outline-none resize-y"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Page ID Input */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Facebook Page ID</label>
                          <input
                            type="text"
                            placeholder="Ex: 104592837283"
                            value={integracao.page_id || ''}
                            onChange={(e) => setIntegracao({ ...integracao, page_id: e.target.value })}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 font-mono outline-none"
                          />
                        </div>

                        {/* Commercial ID Input */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Instagram Commercial ID</label>
                          <input
                            type="text"
                            placeholder="Ex: 178414012345678"
                            value={integracao.instagram_business_id || ''}
                            onChange={(e) => setIntegracao({ ...integracao, instagram_business_id: e.target.value })}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 font-mono outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleConnectManual}
                        className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20 group hover:scale-[1.01]"
                      >
                        Salvar e Conectar Canal
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                )}

                {/* METHOD 2: OFFICIAL OAUTH POPUP */}
                {connMethod === 'oauth' && (
                  <div className="space-y-5">
                    <div className="bg-slate-900/60 p-5 border border-slate-850 rounded-xl text-left space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-black">1</span>
                        <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider block">Identificadores do App de Desenvolvedor</h5>
                      </div>
                      
                      <p className="text-[11px] text-slate-500 leading-normal">
                        Crie um app do tipo <strong>"Empresa"</strong> no portal de desenvolvedores do Facebook com a permissão Instagram Graph API ativa.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Meta App ID (ID do App)</label>
                          <input
                            type="text"
                            placeholder="Ex: 1430489214227891"
                            value={integracao.facebook_app_id || ''}
                            onChange={(e) => setIntegracao({ ...integracao, facebook_app_id: e.target.value })}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 outline-none"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Meta App Secret (Chave Secreta)</label>
                          <input
                            type="password"
                            placeholder="••••••••••••••••"
                            value={integracao.facebook_app_secret || ''}
                            onChange={(e) => setIntegracao({ ...integracao, facebook_app_secret: e.target.value })}
                            className="w-full bg-slate-950 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={handleSaveDeveloperSettings}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white font-extrabold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
                        >
                          Salvar Chaves do App
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 p-5 border border-slate-850 rounded-xl text-left space-y-4 font-sans">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[10px] font-black font-semibold">2</span>
                        <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Autorizar e Vincular Perfil</h5>
                      </div>

                      <p className="text-[11px] text-slate-500 leading-normal">
                        Após preencher e salvar as chaves no Passo 1, clique abaixo para fazer login com o Facebook e selecionar sua página comercial do Instagram.
                      </p>

                      <div className="flex justify-center pt-2">
                        {!(integracao.facebook_app_id && integracao.facebook_app_secret) ? (
                          <div className="p-3 bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-400 rounded-lg text-center w-full leading-relaxed">
                            ⚠️ <strong>Chaves não configuradas:</strong> Você precisa preencher e salvar o seu <strong>Meta App ID</strong> e o seu <strong>App Secret</strong> no Passo 1 para ativar o botão de login oficial.
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={handleMetaOAuth}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-black text-xs rounded-xl transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-950/20 group hover:scale-[1.01]"
                          >
                            Fazer Login com Facebook e Instagram
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-slate-900 border border-slate-850 text-left text-[11px] text-slate-500 rounded-xl leading-relaxed space-y-1">
                  <strong>ℹ️ Informações sobre o processo:</strong>
                  <p>
                    Nosso sistema utiliza apenas as APIs Oficiais do Meta Graph API. Suas credenciais são de uso exclusivo privado em sua instância do Firebase.
                  </p>
                </div>
              </div>
            )}

            {/* COLLAPSIBLE DEVELOPER CONFIGURATION CARD/ACCORDION */}
            <details className="group border border-slate-800 rounded-xl bg-slate-950 overflow-hidden transition-all duration-300">
              <summary className="flex items-center justify-between p-4 text-xs font-bold text-slate-400 cursor-pointer hover:bg-slate-900/40 select-none">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-500" />
                  Configurações Avançadas de Desenvolvedor (OAuth App Config)
                </span>
                <span className="text-[10px] text-slate-500 group-open:rotate-180 transition-transform duration-300">▼</span>
              </summary>

              <div className="p-4 border-t border-slate-900 bg-slate-950/60 space-y-4">
                <div className="p-3 bg-slate-900 border border-slate-850 rounded-lg text-[10px] text-slate-500 leading-normal">
                  💡 <strong>Finalidade técnica:</strong> Se você estiver usando um aplicativo personalizado da Meta, insira aqui o App ID e o App Secret. Se estes campos estiverem vazios, a aplicação usará as variáveis de ambiente Meta/Facebook integradas.
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Meta App ID</span>
                    <input
                      type="text"
                      placeholder="Ex: 1430489214227891"
                      value={integracao.facebook_app_id || ''}
                      onChange={(e) => setIntegracao({ ...integracao, facebook_app_id: e.target.value })}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Meta App Secret</span>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={integracao.facebook_app_secret || ''}
                      onChange={(e) => setIntegracao({ ...integracao, facebook_app_secret: e.target.value })}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-800 text-xs p-2.5 rounded-lg focus:border-amber-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-b border-slate-900 pb-4">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSaveDeveloperSettings}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white font-extrabold text-xs rounded-lg border border-slate-850 transition-all cursor-pointer"
                  >
                    Guardar Chaves OAuth
                  </button>
                </div>

                {/* Dynamic fields: Editable for direct manual saves */}
                <div className="space-y-4 pt-4 border-t border-slate-900">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Atualização de Parâmetros Ativos (Modo Edição Manual)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400">Facebook Page ID</span>
                      <input
                        type="text"
                        value={integracao.page_id || ''}
                        onChange={(e) => setIntegracao({ ...integracao, page_id: e.target.value })}
                        placeholder="Ex: 104058912445892"
                        className="w-full bg-slate-950 text-slate-200 border border-slate-850 text-[11px] p-2 rounded-lg focus:border-amber-500 font-mono outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[9px] font-bold text-slate-400">Instagram Commercial ID</span>
                      <input
                        type="text"
                        value={integracao.instagram_business_id || ''}
                        onChange={(e) => setIntegracao({ ...integracao, instagram_business_id: e.target.value })}
                        placeholder="Ex: 17841401234567891"
                        className="w-full bg-slate-950 text-slate-200 border border-slate-850 text-[11px] p-2 rounded-lg focus:border-amber-500 font-mono outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-slate-400">User Access Token Ativo (Meta API)</span>
                    <textarea
                      rows={3}
                      value={integracao.access_token || ''}
                      onChange={(e) => setIntegracao({ ...integracao, access_token: e.target.value })}
                      placeholder="Insira o token de acesso de usuário do Facebook Developers..."
                      className="w-full bg-slate-950 text-slate-200 border border-slate-850 text-[10px] p-2.5 rounded-lg focus:border-amber-500 font-mono outline-none resize-y"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleConnectManual}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-50"
                    >
                      Salvar Alterações Manuais
                    </button>
                  </div>
                </div>
              </div>
            </details>

          </div>
        )}

        {/* ======================= TAB 4: AUDITORIA LOGS ======================= */}
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-fade-in pb-16">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-500" />
                  Logs / Auditoria do Publicador
                </h3>
                <p className="text-slate-400 text-xs mt-1">Monitore em tempo real as chamadas de API, retornos de erro e execuções do agendador automático minuto a minuto.</p>
              </div>
              <button 
                onClick={loadLogs}
                className="bg-slate-900 text-slate-400 hover:text-white border border-slate-800 p-2 text-xs rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" /> Atualizar Logs
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-850 p-12 text-center rounded-2xl max-w-xl mx-auto space-y-3">
                <History className="w-10 h-10 text-slate-700 mx-auto" />
                <h4 className="font-bold text-white text-sm">Nenhum evento registrado</h4>
                <p className="text-slate-500 text-xs leading-normal">
                  Após agendar ou disparar as postagens usando as APIs de integração, os buffers públicos do Facebook e do Instagram retornarão logs estruturados que serão descritos aqui.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-800 border-collapse">
                      <tr>
                        <th className="p-4">Data/Hora</th>
                        <th className="p-4">Post ID</th>
                        <th className="p-4">Ação</th>
                        <th className="p-4">Resposta / Detalhe</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60 leading-normal">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-850/30 transition-colors">
                          <td className="p-4 whitespace-nowrap text-slate-500 font-mono">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-4 whitespace-nowrap text-slate-500 font-mono">
                            {log.post_id ? log.post_id.slice(0, 8) + '...' : 'Global'}
                          </td>
                          <td className="p-4 font-semibold text-slate-300">
                            {log.acao}
                          </td>
                          <td className="p-4 text-slate-400 max-w-xs truncate" title={log.resposta}>
                            {log.resposta}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded ${log.status === 'sucesso' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
