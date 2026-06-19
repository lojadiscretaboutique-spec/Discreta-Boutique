export interface MktCampaign {
  id: string;
  name: string;
  periodStart: string; // "YYYY-MM-DD"
  periodEnd: string;
  goal: string;
  status: 'rascunho' | 'ativa' | 'concluida' | 'cancelada';
  salesGoal?: number;
  followersGoal?: number;
  visitsGoal?: number;
  whatsappLeadsGoal?: number;
  salesCurrent?: number;
  followersCurrent?: number;
  visitsCurrent?: number;
  whatsappLeadsCurrent?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MktTask {
  id: string;
  campaignId: string; // e.g. "namorados2026" or "general"
  name: string;
  phase: 'estrutura-comercial' | 'conteudo-instagram' | 'geral' | 'influenciadores' | 'sorteios' | 'whatsapp' | 'afiliados';
  column: 'backlog' | 'planejado' | 'em-andamento' | 'aguardando' | 'concluido' | 'cancelado';
  priority: 'critica' | 'alta' | 'media' | 'baixa';
  dueDate: string; // "YYYY-MM-DD"
  dueTime?: string; // e.g. "09:00", "13:00", "18:00", "21:00"
  checklist: MktChecklistItem[];
  comments: MktComment[];
  attachments: string[]; // array of strings (names, URLs, or labels)
  tags: string[];
  assignees: string[];
  history: MktHistoryItem[];
  isRecurrent?: boolean; // stories recorrentes are marked as recurrent
  createdAt: string;
  updatedAt: string;
}

export interface MktChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface MktComment {
  id: string;
  userName: string;
  text: string;
  createdAt: string;
}

export interface MktHistoryItem {
  id: string;
  action: string;
  userName: string;
  createdAt: string;
}

export interface MktInfluencer {
  id: string;
  name: string;
  instagram: string;
  followers: number;
  city: string;
  niche: string;
  whatsapp: string;
  email: string;
  status: 'prospectado' | 'contatado' | 'negociando' | 'confirmado' | 'recebido_enviado' | 'publicado' | 'finalizado';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MktAffiliateCampaign {
  id: string;
  name: string; // e.g. "Afiliados Dia dos Namorados"
  activeAffiliatesCount: number;
  totalSales: number;
  commissionPaid: number;
  ranking: MktAffiliateRankingItem[];
  createdAt: string;
}

export interface MktAffiliateRankingItem {
  id: string;
  name: string;
  salesCount: number;
  totalAmount: number;
  commission: number;
}

export interface MktPromotion {
  id: string;
  code: string;
  type: 'cupom' | 'frete_gratis' | 'compre_ganhe' | 'gift_with_purchase';
  description: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface MktGiveaway {
  id: string;
  name: string; // e.g. "Sorteio Dia dos Namorados"
  publishedAt: string; // "YYYY-MM-DD"
  endsAt: string; // "YYYY-MM-DD HH:MM" e.g. "2026-06-11T23:59:59"
  resultAt: string; // "YYYY-MM-DD"
  imageUrl?: string;
}

export interface MktContentItem {
  id: string;
  title: string;
  type: 'arte' | 'video' | 'foto' | 'texto' | 'roteiro' | 'hashtag' | 'ideia';
  contentUrl?: string;
  bodyText?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MktAlert {
  id: string;
  type: 'vencendo' | 'atrasada' | 'publicacao_hoje' | 'stories_pendente' | 'influenciador_sem_resposta' | 'sorteio_perto';
  title: string;
  message: string;
  targetId: string;
  createdAt: string;
  read: boolean;
}

export interface MktWhatsAppShot {
  id: string;
  date: string; // "YYYY-MM-DD"
  title: string;
  text: string;
  mediaUrl?: string;
  mediaName?: string;
  status: 'agendado' | 'disparado' | 'cancelado';
}
