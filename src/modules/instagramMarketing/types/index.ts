export interface InstagramPost {
  id?: string;
  tipo: 'story' | 'feed' | 'reels';
  titulo: string;
  descricao: string;
  hashtags: string[];
  imagem_modelo?: string; // uploaded model / reference image URL
  modo: 'unica' | 'carrossel';
  imagens_geradas?: string[]; // list of generated image URLs
  ordem?: number[]; // list of image indices representing order
  agendamento?: string; // ISO date string or formatted date & time
  status: 'rascunho' | 'agendado' | 'publicado' | 'erro';
  log_erro?: string; // details about the posting error if any
  created_at: string;
  updated_at: string;
}

export interface InstagramIntegration {
  id?: string;
  access_token: string;
  page_id: string; // Facebook Page ID (linked to Instagram Business Account)
  instagram_business_id: string;
  facebook_page_id?: string;
  status: 'conectado' | 'erro';
  created_at: string;
}

export interface InstagramLog {
  id?: string;
  post_id: string;
  acao: string;
  resposta: string;
  status: 'sucesso' | 'erro';
  created_at: string;
}

export interface InstagramSuggestion {
  titulo: string;
  descricao: string;
  hashtags: string[];
}

export interface StoriesSequence {
  telas: Array<{
    tipo: string; // e.g., 'chamada', 'problema', 'produto', 'beneficios', 'CTA'
    fala: string;
    texto_tela: string;
    hashtags?: string[];
  }>;
}

export interface ReelsStructure {
  tema: string;
  roteiro: string;
  falas: string;
  descricao: string;
  hashtags: string[];
  sugestao_audio?: string;
}
