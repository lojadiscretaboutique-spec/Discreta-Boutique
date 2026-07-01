export interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

export interface CandidateStructuredData {
  nomeCompleto: string;
  idade: string;
  cidade: string;
  bairro: string;
  whatsapp: string;
  email: string;
  disponibilidadeHorarios: string;
  disponibilidadeSabados: string;
  disponibilidadeDatasEspeciais: string;
  disponibilidadePromocoes: string;
  disponibilidadeLiveShop: string;
  dataInicio: string;
  tipoInteresse: 'fixo' | 'temporário' | 'freelancer' | string;
  experienciaProfissional: string;
  experienciaAtendimento: string;
  experienciaVendas: string;
  experienciaLojaCaixaEstoquePdv: string;
  experienciaWhatsappComercial: string;
  ultimaExperiencia: string;
  cargoUltimaExperiencia: string;
  tempoPermanencia: string;
  motivoSaida: string;
  facilidadeAprender: string;
  organizacao: string;
  trabalhoEquipe: string;
  confortoProdutosIntimos: string;
  entendimentoDiscricao: string;
  clienteIndeciso: string;
  perguntasIntimas: string;
  facilidadeRedesSociais: string;
  pontoForte: string;
  pontoDesenvolver: string;
  expectativaSalarial: string;
  mensagemFinal: string;
}

export interface CandidateAIAnalysis {
  resumoProfissional: string;
  pontosFortes: string[];
  pontosAtencao: string[];
  nivelAderencia: 'alto' | 'medio' | 'baixo';
  justificativaObjetiva: string;
  perguntasRecomendadas: string[];
  camposIncompletos: string[];
  observacaoFinal: string;
  avaliadoEm?: string;
}

export interface Candidate {
  id?: string;
  candidateName: string;
  phone: string;
  email: string;
  city: string;
  neighborhood: string;
  status: 'NOVO' | 'EM_ANALISE' | 'CHAMAR_ENTREVISTA' | 'APROVADO' | 'REPROVADO' | 'ARQUIVADO' | 'INCOMPLETA';
  lgpdAccepted: boolean;
  lgpdAcceptedAt: any;
  createdAt: any;
  updatedAt: any;
  structuredData: CandidateStructuredData;
  chatMessages: ChatMessage[];
  adminNotes?: string;
  aiAnalysis?: CandidateAIAnalysis;
  interviewQuestions?: string;
  ipAddress?: string;
  userAgent?: string;
  interviewId?: string;
}

export interface RecruitmentSettings {
  promptPrincipal: string;
  promptAnalise: string;
  recruiterName: string;
  initialMessage: string;
  finalMessage: string;
  isActive: boolean;
  lgpdText: string;
  availableJobsText?: string;
}
