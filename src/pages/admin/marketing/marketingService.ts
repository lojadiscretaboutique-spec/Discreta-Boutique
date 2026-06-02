import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  setDoc,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { 
  MktCampaign, 
  MktTask, 
  MktInfluencer, 
  MktAffiliateCampaign, 
  MktPromotion, 
  MktGiveaway, 
  MktContentItem, 
  MktAlert, 
  MktWhatsAppShot 
} from './marketingTypes';

// Helper generating IDs
const uuid = () => Math.random().toString(36).substring(2, 11);

// Helper collection names
const COLL_CAMPAIGNS = 'mkt_campaigns';
const COLL_TASKS = 'mkt_tasks';
const COLL_INFLUENCERS = 'mkt_influencers';
const COLL_AFFILIATES = 'mkt_affiliates';
const COLL_PROMOTIONS = 'mkt_promotions';
const COLL_GIVEAWAYS = 'mkt_giveaways';
const COLL_CONTENT = 'mkt_content';
const COLL_ALERTS = 'mkt_alerts';
const COLL_WHATSAPP = 'mkt_whatsapp';

export const marketingService = {
  // Generic collection loader
  async loadCollection<T>(collName: string): Promise<T[]> {
    const q = collection(db, collName);
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));
  },

  // Save document
  async saveDoc(collName: string, id: string, data: any): Promise<void> {
    await setDoc(doc(db, collName, id), { ...data, updatedAt: new Date().toISOString() }, { merge: true });
  },

  // Add document
  async addDoc(collName: string, data: any): Promise<string> {
    const cleanData = { 
      ...data, 
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString() 
    };
    const ref = await addDoc(collection(db, collName), cleanData);
    return ref.id;
  },

  // Delete document
  async deleteDoc(collName: string, id: string): Promise<void> {
    await deleteDoc(doc(db, collName, id));
  },

  // Special Auto-Seeding Trigger
  async checkAndSeedData(force = false): Promise<boolean> {
    try {
      if (!force) {
        return false; // Do not auto-seed unless explicitly forced by the user
      }
      const cmpSnap = await getDocs(collection(db, COLL_CAMPAIGNS));
      if (!cmpSnap.empty) {
        return false; // Already seeded
      }

      console.log("🌱 [Marketing Hub] Database is empty. Seeding campaign, tasks and CRM records...");

      const batch = writeBatch(db);

      // 1. Create main Valentine's campaign "Operação Dia dos Namorados 2026"
      const mainCampaignId = "namorados2026";
      const mainCamRef = doc(db, COLL_CAMPAIGNS, mainCampaignId);
      const valCampaign: MktCampaign = {
        id: mainCampaignId,
        name: "Operação Dia dos Namorados 2026",
        periodStart: "2026-06-01",
        periodEnd: "2026-06-12",
        goal: "Aumentar vendas, seguidores, tráfego e reconhecimento da marca.",
        status: "ativa",
        salesGoal: 50000,
        followersGoal: 2000,
        visitsGoal: 10000,
        whatsappLeadsGoal: 500,
        salesCurrent: 14850,
        followersCurrent: 430,
        visitsCurrent: 2890,
        whatsappLeadsCurrent: 132,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      batch.set(mainCamRef, valCampaign);

      // Also create an inactive second campaign for dashboard variety
      const secCampaignId = "inverno2026";
      const secCamRef = doc(db, COLL_CAMPAIGNS, secCampaignId);
      const winterCampaign: MktCampaign = {
        id: secCampaignId,
        name: "Coleção Sedução Inverno 2026",
        periodStart: "2026-06-15",
        periodEnd: "2026-06-30",
        goal: "Lançamento da nova linha de corpetes premium de veludo e lingeries térmicas.",
        status: "rascunho",
        salesGoal: 80000,
        followersGoal: 4000,
        visitsGoal: 15000,
        whatsappLeadsGoal: 800,
        salesCurrent: 0,
        followersCurrent: 0,
        visitsCurrent: 0,
        whatsappLeadsCurrent: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      batch.set(secCamRef, winterCampaign);

      // 2. FASE 1 - ESTRUTURA COMERCIAL tasks
      const comercialTasks: Array<Partial<MktTask>> = [
        { name: "Criar banner principal Dia dos Namorados", dueDate: "2026-06-01", phase: "estrutura-comercial", column: "concluido", priority: "alta", tags: ["Design", "Banner"] },
        { name: "Criar categoria especial no site", dueDate: "2026-06-01", phase: "estrutura-comercial", column: "concluido", priority: "media", tags: ["Site", "Categorias"] },
        { name: "Criar cupom NAMORADOS15", dueDate: "2026-06-01", phase: "estrutura-comercial", column: "concluido", priority: "critica", tags: ["Vendas", "Cupons"] },
        { name: "Configurar frete grátis acima de R$199", dueDate: "2026-06-01", phase: "estrutura-comercial", column: "concluido", priority: "alta", tags: ["Frete", "Configuração"] },
        { name: "Criar kits promocionais", dueDate: "2026-06-02", phase: "estrutura-comercial", column: "em-andamento", priority: "alta", tags: ["Marketing", "Kits"] },
        { name: "Criar landing page especial", dueDate: "2026-06-03", phase: "estrutura-comercial", column: "planejado", priority: "critica", tags: ["Dev", "LadingPage"] }
      ];

      // 3. FASE 2 - CONTEÚDO INSTAGRAM tasks
      const instagramTasks: Array<Partial<MktTask>> = [
        { name: "Post: Lançamento da campanha", dueDate: "2026-06-01", phase: "conteudo-instagram", column: "concluido", priority: "media", tags: ["Post", "Lançamento"] },
        { name: "Reel: Top 5 presentes para surpreender", dueDate: "2026-06-02", phase: "conteudo-instagram", column: "em-andamento", priority: "alta", tags: ["Reels", "Dicas"] },
        { name: "Reel: Kit para casais", dueDate: "2026-06-03", phase: "conteudo-instagram", column: "planejado", priority: "media", tags: ["Reels", "Combos"] },
        { name: "Reel: Produtos até R$50", dueDate: "2026-06-04", phase: "conteudo-instagram", column: "planejado", priority: "baixa", tags: ["Reels", "Promocional"] },
        { name: "Reel: Produtos mais vendidos", dueDate: "2026-06-05", phase: "conteudo-instagram", column: "planejado", priority: "alta", tags: ["Reels", "Coleção"] },
        { name: "Reel: Dicas para casais", dueDate: "2026-06-06", phase: "conteudo-instagram", column: "planejado", priority: "baixa", tags: ["Reels", "Dicas"] },
        { name: "Reel: Produtos femininos favoritos", dueDate: "2026-06-07", phase: "conteudo-instagram", column: "planejado", priority: "media", tags: ["Reels", "Moda"] },
        { name: "Reel: Produtos masculinos favoritos", dueDate: "2026-06-08", phase: "conteudo-instagram", column: "planejado", priority: "media", tags: ["Reels", "Moda"] },
        { name: "Reel: Últimos dias para entrega", dueDate: "2026-06-09", phase: "conteudo-instagram", column: "planejado", priority: "alta", tags: ["Reels", "Alerta"] },
        { name: "Reel: Depoimentos", dueDate: "2026-06-10", phase: "conteudo-instagram", column: "planejado", priority: "baixa", tags: ["Reels", "SocialProof"] },
        { name: "Reel: Última chamada", dueDate: "2026-06-11", phase: "conteudo-instagram", column: "planejado", priority: "critica", tags: ["Reels", "Urgência"] },
        { name: "Post: Feliz Dia dos Namorados", dueDate: "2026-06-12", phase: "conteudo-instagram", column: "planejado", priority: "media", tags: ["Post", "Greeting"] }
      ];

      // 4. MÓDULO INFLUENCIADORES CRM & default CRM tasks
      const influencersTasks: Array<Partial<MktTask>> = [
        { name: "Pesquisar 20 influenciadores", dueDate: "2026-06-01", phase: "influenciadores", column: "concluido", priority: "media", tags: ["CRM", "Pesquisa"] },
        { name: "Enviar propostas para influenciadores", dueDate: "2026-06-02", phase: "influenciadores", column: "em-andamento", priority: "alta", tags: ["CRM", "Comunicação"] },
        { name: "Preparar kits dos influenciadores", dueDate: "2026-06-03", phase: "influenciadores", column: "planejado", priority: "critica", tags: ["Logística", "Kits"] },
        { name: "Acompanhar publicações dos parceiros", dueDate: "2026-06-05", phase: "influenciadores", column: "planejado", priority: "media", tags: ["Auditoria", "Social"] }
      ];

      // 5. MÓDULO SORTEIOS tasks
      const giveawayTasks: Array<Partial<MktTask>> = [
        { name: "Sorteio Dia dos Namorados: Publicação", dueDate: "2026-06-03", phase: "sorteios", column: "planejado", priority: "alta", tags: ["Sorteios", "Post"] },
        { name: "Sorteio Dia dos Namorados: Encerramento", dueDate: "2026-06-11", phase: "sorteios", column: "backlog", priority: "critica", tags: ["Sorteios", "Prazo"] },
        { name: "Sorteio Dia dos Namorados: Resultado", dueDate: "2026-06-12", phase: "sorteios", column: "backlog", priority: "alta", tags: ["Sorteios", "Live"] }
      ];

      // 6. MÓDULO WHATSAPP tasks
      const whatsappTasks: Array<Partial<MktTask>> = [
        { name: "Disparo WhatsApp: Campanha lançada", dueDate: "2026-06-02", phase: "whatsapp", column: "planejado", priority: "alta", tags: ["Broadcast", "Whats"] },
        { name: "Disparo WhatsApp: Produtos mais vendidos", dueDate: "2026-06-06", phase: "whatsapp", column: "planejado", priority: "media", tags: ["Broadcast", "Whats"] },
        { name: "Disparo WhatsApp: Últimos dias", dueDate: "2026-06-09", phase: "whatsapp", column: "backlog", priority: "alta", tags: ["Broadcast", "Whats"] },
        { name: "Disparo WhatsApp: Última chamada", dueDate: "2026-06-11", phase: "whatsapp", column: "backlog", priority: "critica", tags: ["Broadcast", "Whats"] }
      ];

      // 7. MÓDULO AFILIADOS tasks
      const affiliateTasks: Array<Partial<MktTask>> = [
        { name: "Criar campanha Afiliados Dia dos Namorados", dueDate: "2026-06-01", phase: "afiliados", column: "concluido", priority: "alta", tags: ["Afiliados", "FaseInicial"] },
        { name: "Aumentar comissão (+5% temporário)", dueDate: "2026-06-02", phase: "afiliados", column: "em-andamento", priority: "media", tags: ["Afiliados", "Finanças"] },
        { name: "Enviar material de vendas para afiliados", dueDate: "2026-06-03", phase: "afiliados", column: "planejado", priority: "media", tags: ["Afiliados", "Material"] }
      ];

      // Combine and seed all standard tasks
      const allTasksSeeded = [
        ...comercialTasks,
        ...instagramTasks,
        ...influencersTasks,
        ...giveawayTasks,
        ...whatsappTasks,
        ...affiliateTasks
      ];

      allTasksSeeded.forEach(task => {
        const taskId = uuid();
        const tRef = doc(db, COLL_TASKS, taskId);
        const fullTask: MktTask = {
          id: taskId,
          campaignId: mainCampaignId,
          name: task.name || "Sem Nome",
          phase: task.phase as any || "geral",
          column: task.column as any || "planejado",
          priority: task.priority as any || "media",
          dueDate: task.dueDate || "2026-06-01",
          checklist: [
            { id: uuid(), text: "Revisar com Direção", completed: task.column === "concluido" },
            { id: uuid(), text: "Publicar / Agendar", completed: task.column === "concluido" },
          ],
          comments: [],
          attachments: [],
          tags: task.tags || ["Cupom"],
          assignees: ["Marketing Manager", "Discreta Owner"],
          history: [
            { id: uuid(), action: "Tarefa criada via Automação", userName: "Sistema", createdAt: new Date().toISOString() }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        batch.set(tRef, fullTask);
      });

      // 8. Define STORIES RECORRENTES for all 12 days
      // Let's create specific recurring story logs or compact recurrent task instances so the user can easily check them
      const storyHours = [
        { time: "09:00", title: "Destaque: Produto Dia dos Namorados" },
        { time: "13:00", title: "Enquete: O que você prefere ganhar?" },
        { time: "18:00", title: "Oferta: Combo Amor Premium com Desconto" },
        { time: "21:00", title: "CTA WhatsApp: Compre com ajuda de uma especialista" }
      ];

      const campaignDays = [
        "2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", 
        "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08", 
        "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12"
      ];

      // Just seed 3 full days of stories to avoid bloated db size, and we can generate the rest or keep them virtual!
      // Seeding specific active tasks for June 1st and June 2nd, and the rest can be managed inside the calendar directly.
      campaignDays.slice(0, 3).forEach((day, dIdx) => {
        storyHours.forEach((story, hIdx) => {
          const taskId = `story_${day.replace(/-/g, '')}_${story.time.replace(/:/g, '')}`;
          const tRef = doc(db, COLL_TASKS, taskId);
          const fullTask: MktTask = {
            id: taskId,
            campaignId: mainCampaignId,
            name: `Story [${story.time}] - ${story.title}`,
            phase: "conteudo-instagram",
            column: dIdx === 0 ? "concluido" : (dIdx === 1 ? "em-andamento" : "planejado"),
            priority: "media",
            dueDate: day,
            dueTime: story.time,
            checklist: [],
            comments: [],
            attachments: [],
            tags: ["Instagram", "Story", "Recorrente"],
            assignees: ["Content Creator"],
            history: [{ id: uuid(), action: "Story recorrente gerado automaticamente", userName: "Sistema", createdAt: new Date().toISOString() }],
            isRecurrent: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          batch.set(tRef, fullTask);
        });
      });

      // 9. Seed MÓDULO DE INFLUENCIADORES CRM
      const influencers: MktInfluencer[] = [
        {
          id: "inf_marcela",
          name: "Gabriela Brandão",
          instagram: "@gabi_brandao_m",
          followers: 145000,
          city: "São Paulo - Capital",
          niche: "Lingerie Premium & Lifestyle Feminino",
          whatsapp: "11999990011",
          email: "gabibrandao@gmail.com",
          status: "confirmado",
          notes: "Enviado Kit Sedutora com Corset de Cetim Vermelho e Máscara. Roteiro acordado.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "inf_isabella",
          name: "Isabella Cavalcanti",
          instagram: "@bellacavalc_oficial",
          followers: 82000,
          city: "Belo Horizonte - MG",
          niche: "Autoestima & Autonomia Corporal",
          whatsapp: "31988112233",
          email: "contato@bellacavalc.com",
          status: "negociando",
          notes: "Aguardando definição do valor do cachê para 2 conjuntos de stories e 1 reels.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "inf_roberta",
          name: "Roberta Santoro",
          instagram: "@roberta.santoro",
          followers: 24000,
          city: "Rio de Janeiro - RJ",
          niche: "Boutique Review & Luxo Acessível",
          whatsapp: "21977112211",
          email: "mkt.robertasantoro@outlook.com",
          status: "prospectado",
          notes: "Pesquisada no dia 01/06. Perfil se encaixa muito no público premium da Discreta Boutique.",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      influencers.forEach(inf => {
        batch.set(doc(db, COLL_INFLUENCERS, inf.id), inf);
      });

      // 10. Seed GIVEAWAY campaign
      const giveRef = doc(db, COLL_GIVEAWAYS, "mkt_namorados_giveaway");
      const getawayData: MktGiveaway = {
        id: "mkt_namorados_giveaway",
        name: "Sorteio Dia dos Namorados Boutique",
        publishedAt: "2026-06-03",
        endsAt: "2026-06-11T23:59:59",
        resultAt: "2026-06-12",
        imageUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=600&auto=format&fit=crop"
      };
      batch.set(giveRef, getawayData);

      // 11. Seed WhatsApp Shot schedules
      const shots: MktWhatsAppShot[] = [
        { id: uuid(), date: "2026-06-02", title: "Campanha Dia dos Namorados Lançada", text: "Olá! ❤️ O amor está no ar na Discreta Boutique! Lançamos hoje nossa categoria de namorados com Kits Exclusivos e Desconto de 15% usando o cupom NAMORADOS15. Confira no link: discretaboutique.com.br/namorados", status: "agendado" },
        { id: uuid(), date: "2026-06-06", title: "Kits de Casal mais Vendidos", text: "Ei, ainda em dúvida sobre como surpreender seu amor? 😍 Veja os 3 Kits mais vendidos desta semana com preços especiais. Corre que o estoque é limitado!", status: "agendado" },
        { id: uuid(), date: "2026-06-09", title: "Último dia para garantir entrega antes de 12/06!", text: "Atenção!! 🚨 Hoje é o último dia útil com frete garantido para entrega antes do Dia dos Namorados. Não compre de última hora, garanta o sigilo e sedução garantida!", status: "agendado" },
        { id: uuid(), date: "2026-06-11", title: "Última chamada Cupom NAMORADOS15!", text: "Últimas Horas! ⏰ O cupom NAMORADOS15 expira hoje à meia-noite. Garanta o presente perfeito na Discreta Boutique.", status: "agendado" }
      ];

      shots.forEach(s => {
        batch.set(doc(db, COLL_WHATSAPP, s.id), s);
      });

      // 12. Seed Affiliates Campaign Stats (MÓDULO AFILIADOS)
      const affCmpRef = doc(db, COLL_AFFILIATES, "namorados_affiliates");
      const affCmp: MktAffiliateCampaign = {
        id: "namorados_affiliates",
        name: "Afiliados Dia dos Namorados",
        activeAffiliatesCount: 8,
        totalSales: 8950,
        commissionPaid: 895,
        ranking: [
          { id: "aff_1", name: "Bruna Albuquerque", salesCount: 14, totalAmount: 4320, commission: 432 },
          { id: "aff_2", name: "Jessica Fernandes", salesCount: 9, totalAmount: 2610, commission: 261 },
          { id: "aff_3", name: "Lorena Silva", salesCount: 5, totalAmount: 1420, commission: 142 },
          { id: "aff_4", name: "Karina Costa", salesCount: 2, totalAmount: 600, commission: 60 }
        ],
        createdAt: new Date().toISOString()
      };
      batch.set(affCmpRef, affCmp);

      // 13. Seed active promotions (MÓDULO DE PROMOÇÕES)
      const promos: MktPromotion[] = [
        { id: "promo_1", code: "NAMORADOS15", type: "cupom", description: "15% off em qualquer compra utilizando o cupom de namorados.", startDate: "2026-06-01", endDate: "2026-06-12", active: true },
        { id: "promo_2", code: "FRETE GRÁTIS R$199", type: "frete_gratis", description: "Configurado frete grátis automático do carrinho para compras acima de R$199.", startDate: "2026-06-01", endDate: "2026-06-12", active: true },
        { id: "promo_3", code: "COMPRE 2 GANHE 10%", type: "compre_ganhe", description: "Compre 2 ou mais lingeries da coleção e o desconto é somado na hora.", startDate: "2026-06-01", endDate: "2026-06-12", active: true }
      ];

      promos.forEach(p => {
        batch.set(doc(db, COLL_PROMOTIONS, p.id), p);
      });

      // 14. Seed alerts (MÓDULO AUTOMAÇÕES)
      const alerts: MktAlert[] = [
        { id: uuid(), type: 'vencendo', title: "Kits Promocionais com prazo estourando", message: "A tarefa 'Criar kits promocionais' vence amanhã (02/06) e está em andamento.", targetId: "general", createdAt: new Date().toISOString(), read: false },
        { id: uuid(), type: 'publicacao_hoje', title: "Publicação agendada para hoje!", message: "Post: 'Lançamento da campanha' agendado e publicado hoje.", targetId: "general", createdAt: new Date().toISOString(), read: false },
        { id: uuid(), type: 'influenciador_sem_resposta', title: "Influenciadora Roberta sem resposta", message: "Roberta Santoro está marcada como prospectada. Envie o formulário inicial.", targetId: "inf_roberta", createdAt: new Date().toISOString(), read: false },
        { id: uuid(), type: 'sorteio_perto', title: "Sorteio Dia dos Namorados", message: "O Sorteio está programado para publicação no dia 03/06. Verifique criativos.", targetId: "mkt_namorados_giveaway", createdAt: new Date().toISOString(), read: false }
      ];

      alerts.forEach(al => {
        batch.set(doc(db, COLL_ALERTS, al.id), al);
      });

      // 15. Seed Central de Conteúdo
      const contentItems: MktContentItem[] = [
        { id: uuid(), title: "Banner Principal Dia dos Namorados 2026 - Vermelho Rubi", type: "arte", contentUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7", tags: ["Banner", "Design", "Vermelho"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: uuid(), title: "Rolo de Reels - Casais em Sintonia e Kit Sigilo", type: "video", contentUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7", tags: ["Video", "Reels", "Combos"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: uuid(), title: "Legenda Lançamento Oficial Oficial Dia dos Namorados", type: "texto", bodyText: "O amor está nos detalhes que seduzem... ❤️ Lançamos hoje nossa coleção oficial de Dia dos Namorados na Discreta Boutique! Use o cupom NAMORADOS15 para obter 15% OFF em todas as lingeries importadas e cosméticos artesanais. Frete Grátis nas compras acima de R$199 para garantir discrição total. Link na Bio!", tags: ["Copywriting", "Legendas", "Cupom"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: uuid(), title: "Fotos Coleção Renda Rubra - Modelo Estúdio", type: "foto", contentUrl: "https://images.unsplash.com/photo-1518199266791-5375a83190b7", tags: ["Fotos", "Estúdio", "Renda"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
        { id: uuid(), title: "Grupo de Hashtags Altamente Conversivas", type: "hashtag", bodyText: "#diadosnamorados #presentenamorados #lingeriepremium #discrecaoesegredo #lojadiscreta #casalromantico", tags: ["Tags", "SEO"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      ];

      contentItems.forEach(ci => {
        batch.set(doc(db, COLL_CONTENT, ci.id), ci);
      });

      await batch.commit();
      console.log("🔥 [Marketing Hub] Auto-seeding completed beautifully!");
      return true;
    } catch (error) {
      console.error("❌ [Marketing Hub] Seeding failed:", error);
      return false;
    }
  },

  // Wipe All Marketing Collections completely
  async wipeAllMarketingData(): Promise<void> {
    const collections = [
      COLL_CAMPAIGNS,
      COLL_TASKS,
      COLL_INFLUENCERS,
      COLL_AFFILIATES,
      COLL_PROMOTIONS,
      COLL_GIVEAWAYS,
      COLL_CONTENT,
      COLL_ALERTS,
      COLL_WHATSAPP
    ];
    for (const collName of collections) {
      try {
        const snap = await getDocs(collection(db, collName));
        for (const docItem of snap.docs) {
          await deleteDoc(doc(db, collName, docItem.id));
        }
      } catch (err) {
        console.error(`Error clearing collection ${collName}:`, err);
      }
    }
  },

  // Campaigns API
  async getCampaigns(): Promise<MktCampaign[]> {
    await this.checkAndSeedData();
    return this.loadCollection<MktCampaign>(COLL_CAMPAIGNS);
  },

  async saveCampaign(campaign: MktCampaign): Promise<void> {
    await this.saveDoc(COLL_CAMPAIGNS, campaign.id, campaign);
  },

  async deleteCampaign(id: string): Promise<void> {
    await this.deleteDoc(COLL_CAMPAIGNS, id);
  },

  // Tasks API (Action Plan / Kanban)
  async getTasks(): Promise<MktTask[]> {
    return this.loadCollection<MktTask>(COLL_TASKS);
  },

  async saveTask(task: MktTask): Promise<void> {
    await this.saveDoc(COLL_TASKS, task.id, task);
  },

  async createTask(task: Omit<MktTask, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.addDoc(COLL_TASKS, task);
  },

  async deleteTask(id: string): Promise<void> {
    await this.deleteDoc(COLL_TASKS, id);
  },

  // Influencers CRM
  async getInfluencers(): Promise<MktInfluencer[]> {
    return this.loadCollection<MktInfluencer>(COLL_INFLUENCERS);
  },

  async saveInfluencer(inf: MktInfluencer): Promise<void> {
    await this.saveDoc(COLL_INFLUENCERS, inf.id, inf);
  },

  async createInfluencer(inf: Omit<MktInfluencer, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.addDoc(COLL_INFLUENCERS, inf);
  },

  async deleteInfluencer(id: string): Promise<void> {
    await this.deleteDoc(COLL_INFLUENCERS, id);
  },

  // WhatsApp Disparos
  async getWhatsAppShots(): Promise<MktWhatsAppShot[]> {
    return this.loadCollection<MktWhatsAppShot>(COLL_WHATSAPP);
  },

  async saveWhatsAppShot(shot: MktWhatsAppShot): Promise<void> {
    await this.saveDoc(COLL_WHATSAPP, shot.id, shot);
  },

  async createWhatsAppShot(shot: Omit<MktWhatsAppShot, 'id'>): Promise<string> {
    return this.addDoc(COLL_WHATSAPP, shot);
  },

  async deleteWhatsAppShot(id: string): Promise<void> {
    await this.deleteDoc(COLL_WHATSAPP, id);
  },

  // Affiliates stats campaigns
  async getAffiliateCampaigns(): Promise<MktAffiliateCampaign[]> {
    return this.loadCollection<MktAffiliateCampaign>(COLL_AFFILIATES);
  },

  async saveAffiliateCampaign(cmp: MktAffiliateCampaign): Promise<void> {
    await this.saveDoc(COLL_AFFILIATES, cmp.id, cmp);
  },

  async createAffiliateCampaign(cmp: Omit<MktAffiliateCampaign, 'id' | 'createdAt'>): Promise<string> {
    return this.addDoc(COLL_AFFILIATES, cmp);
  },

  async deleteAffiliateCampaign(id: string): Promise<void> {
    await this.deleteDoc(COLL_AFFILIATES, id);
  },

  // Giveaways
  async getGiveaways(): Promise<MktGiveaway[]> {
    return this.loadCollection<MktGiveaway>(COLL_GIVEAWAYS);
  },

  async saveGiveaway(give: MktGiveaway): Promise<void> {
    await this.saveDoc(COLL_GIVEAWAYS, give.id, give);
  },

  async createGiveaway(give: Omit<MktGiveaway, 'id'>): Promise<string> {
    return this.addDoc(COLL_GIVEAWAYS, give);
  },

  async deleteGiveaway(id: string): Promise<void> {
    await this.deleteDoc(COLL_GIVEAWAYS, id);
  },

  // Promotions
  async getPromotions(): Promise<MktPromotion[]> {
    return this.loadCollection<MktPromotion>(COLL_PROMOTIONS);
  },

  async savePromotion(promo: MktPromotion): Promise<void> {
    await this.saveDoc(COLL_PROMOTIONS, promo.id, promo);
  },

  async createPromotion(promo: Omit<MktPromotion, 'id'>): Promise<string> {
    return this.addDoc(COLL_PROMOTIONS, promo);
  },

  async deletePromotion(id: string): Promise<void> {
    await this.deleteDoc(COLL_PROMOTIONS, id);
  },

  // Content Library
  async getContentItems(): Promise<MktContentItem[]> {
    return this.loadCollection<MktContentItem>(COLL_CONTENT);
  },

  async saveContentItem(ci: MktContentItem): Promise<void> {
    await this.saveDoc(COLL_CONTENT, ci.id, ci);
  },

  async createContentItem(ci: Omit<MktContentItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.addDoc(COLL_CONTENT, ci);
  },

  async deleteContentItem(id: string): Promise<void> {
    await this.deleteDoc(COLL_CONTENT, id);
  },

  // Alerts
  async getAlerts(): Promise<MktAlert[]> {
    return this.loadCollection<MktAlert>(COLL_ALERTS);
  },

  async markAlertAsRead(id: string): Promise<void> {
    await updateDoc(doc(db, COLL_ALERTS, id), { read: true });
  }
};
