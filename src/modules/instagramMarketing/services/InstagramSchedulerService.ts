import { db } from '../../../lib/firebase.js';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { InstagramPublisherService } from './InstagramPublisherService.js';
import { InstagramPost } from '../types/index.js';

export class InstagramSchedulerService {
  private publisherService: InstagramPublisherService;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    this.publisherService = new InstagramPublisherService();
  }

  /**
   * Checks for scheduled posts and publishes them
   */
  async checkAndPublishScheduledPosts() {
    console.log('[InstagramSchedulerService] Verificando posts agendados...');
    const nowStr = new Date().toISOString();

    try {
      // Find all posts that are scheduled and ready to publish
      const q = query(
        collection(db, 'instagram_posts'),
        where('status', '==', 'agendado')
      );
      
      const snap = await getDocs(q);
      if (snap.empty) {
        console.log('[InstagramSchedulerService] Nenhum post agendado pendente.');
        return;
      }

      const pendingPosts = snap.docs.map(doc => ({
        id: doc.id,
        data: doc.data() as InstagramPost
      }));

      // Filter local memory list by date to support timezone/exact time <= now
      const duePosts = pendingPosts.filter(p => {
        if (!p.data.agendamento) return false;
        // Compare ISO strings or direct dates
        return p.data.agendamento <= nowStr;
      });

      if (duePosts.length === 0) {
        console.log('[InstagramSchedulerService] Nenhum post agendado está pronto para publicação neste minuto.');
        return;
      }

      console.log(`[InstagramSchedulerService] Encontrado(s) ${duePosts.length} post(s) pronto(s) para postagem. Iniciando...`);

      for (const due of duePosts) {
        try {
          console.log(`[InstagramSchedulerService] Processando post agendado '${due.data.titulo}' (${due.id})...`);
          await this.publisherService.publishPost(due.id, due.data);
          console.log(`[InstagramSchedulerService] Post '${due.id}' publicado pelo scheduler com sucesso.`);
        } catch (error: any) {
          console.error(`[InstagramSchedulerService] Falha ao processar publicação automática para o post '${due.id}':`, error.message);
        }
      }
    } catch (err: any) {
      console.error('[InstagramSchedulerService] Erro na verificação do Scheduler:', err);
    }
  }

  /**
   * Starts the polling background interval (runs every 1 minute)
   */
  startScheduler() {
    if (this.intervalId) {
      console.log('[InstagramSchedulerService] O Scheduler já está em execução.');
      return;
    }

    console.log('⏱️  [InstagramSchedulerService] Inicializando loop infinito a cada 1 minuto...');
    
    // Check immediately on startup
    this.checkAndPublishScheduledPosts();

    // Set interval to run once every minute (60 * 1000 milisseconds)
    this.intervalId = setInterval(async () => {
      await this.checkAndPublishScheduledPosts();
    }, 60 * 1000);
  }

  /**
   * Stops the background process
   */
  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[InstagramSchedulerService] Loop de monitoração parado.');
    }
  }
}
