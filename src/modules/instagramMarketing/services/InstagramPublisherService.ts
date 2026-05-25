import { db } from '../../../lib/firebase.js';
import { collection, getDocs, addDoc, serverTimestamp, doc, updateDoc, query, limit } from 'firebase/firestore';
import { InstagramGraphService } from './InstagramGraphService.js';
import { InstagramPost, InstagramLog } from '../types/index.js';

export class InstagramPublisherService {
  private graphService: InstagramGraphService;

  constructor() {
    this.graphService = new InstagramGraphService();
  }

  /**
   * Fetches active credentials from instagram_integracoes
   */
  private async getCreds(): Promise<{ accessToken: string; instagramBusinessId: string }> {
    const q = query(collection(db, 'instagram_integracoes'), limit(1));
    const snap = await getDocs(q);
    
    if (snap.empty) {
      throw new Error('Nenhuma integração com o Instagram configurada no sistema.');
    }
    
    const integration = snap.docs[0].data();
    if (!integration.access_token || !integration.instagram_business_id) {
      throw new Error('Token de acesso ou ID comercial do Instagram em falta na integração ativa.');
    }
    
    return {
      accessToken: integration.access_token,
      instagramBusinessId: integration.instagram_business_id
    };
  }

  /**
   * Writes a logs inside instagram_logs
   */
  private async createLog(postId: string, action: string, response: string, status: 'sucesso' | 'erro') {
    try {
      await addDoc(collection(db, 'instagram_logs'), {
        post_id: postId,
        acao: action,
        resposta: response,
        status: status,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error('Erro ao escrever log no banco:', err);
    }
  }

  /**
   * Publishes an existing post directly
   */
  async publishPost(postId: string, post: InstagramPost): Promise<string> {
    console.log(`[InstagramPublisher] Iniciando publicação do post ${postId}...`);
    
    const creds = await this.getCreds();
    
    // Validate images
    const images = post.imagens_geradas || [];
    if (images.length === 0) {
      throw new Error('Não há imagens associadas a este post para publicação.');
    }

    // Sort images by order indices if present
    let sortedImages = [...images];
    if (post.ordem && post.ordem.length === images.length) {
      const reordered: string[] = [];
      post.ordem.forEach(index => {
        if (images[index]) reordered.push(images[index]);
      });
      if (reordered.length === images.length) {
        sortedImages = reordered;
      }
    }

    // Format caption
    const formattedHashtags = (post.hashtags || []).map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
    const fullCaption = `${post.titulo}\n\n${post.descricao}\n\n${formattedHashtags}`;

    let mediaId = '';

    try {
      // Direct posting based on format
      if (post.tipo === 'story') {
        // Post first image as story
        console.log('[InstagramPublisher] Publicando como STORY...');
        mediaId = await this.graphService.publishSingleImage(creds, sortedImages[0], '', true);
      } else if (post.tipo === 'feed') {
        if (post.modo === 'carrossel' && sortedImages.length >= 2) {
          console.log('[InstagramPublisher] Publicando como FEED CARROSSEL...');
          mediaId = await this.graphService.publishCarousel(creds, sortedImages, fullCaption);
        } else {
          console.log('[InstagramPublisher] Publicando como FEED IMAGE ÚNICA...');
          mediaId = await this.graphService.publishSingleImage(creds, sortedImages[0], fullCaption, false);
        }
      } else if (post.tipo === 'reels') {
        // Meta Graph API Content Publishing lets you publish videos as Reels, but for static images DALL-E generates images.
        // If a Reels is an image, we handle it gracefully here by publishing it as a photo with the Reels caption.
        // Note: Graph API supports only true video URL for Video Reels, but we build resilient integration for images too!
        console.log('[InstagramPublisher] Publicando REELS/Vídeo ou imagem correspondente...');
        mediaId = await this.graphService.publishSingleImage(creds, sortedImages[0], fullCaption, false);
      } else {
        throw new Error(`Tipo de postagem '${post.tipo}' inválido ou não suportado.`);
      }

      console.log(`[InstagramPublisher] Post ${postId} publicado com sucesso! ID: ${mediaId}`);
      
      // Update post in DB
      const postRef = doc(db, 'instagram_posts', postId);
      await updateDoc(postRef, {
        status: 'publicado',
        updated_at: new Date().toISOString()
      });

      // Write success logs
      await this.createLog(
        postId, 
        `Publicou post '${post.titulo}' (Formato: ${post.tipo})`, 
        `ID da mídia criada no Instagram: ${mediaId}`, 
        'sucesso'
      );

      return mediaId;
    } catch (error: any) {
      console.error(`[InstagramPublisher] Falha de publicação do post ${postId}:`, error.message);
      
      // Update post to error
      try {
        const postRef = doc(db, 'instagram_posts', postId);
        await updateDoc(postRef, {
          status: 'erro',
          log_erro: error.message,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Erro ao atualizar post para status Erro:', err);
      }

      // Write error logs
      await this.createLog(
        postId, 
        `Falha ao publicar post '${post.titulo}' (Formato: ${post.tipo})`, 
        error.message, 
        'erro'
      );

      throw error;
    }
  }
}
