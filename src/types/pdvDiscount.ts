export type DiscountAuthCondition = 'PERCENTAGE' | 'AMOUNT' | 'EITHER' | 'BOTH';

export interface PDVDiscountConfig {
  enabled: boolean;
  caixaMaxPercent: number;
  caixaMaxAmount: number;
  gerenteMaxPercent: number;
  gerenteMaxAmount: number;
  adminMaxPercent: number;
  adminMaxAmount: number;
  proprietarioMaxPercent: number;
  proprietarioMaxAmount: number;
  absoluteMaxPercent: number;
  absoluteMaxAmount: number;
  requireAuthCondition: DiscountAuthCondition;
  requireReason: boolean;
  requireNoteAbovePercent: number;
  blockBelowCost: boolean;
  authValidityMinutes: number;
  maxPinAttempts: number;
  pinLockoutMinutes: number;
  invalidateOnCartChange: boolean;
}

export const DEFAULT_PDV_DISCOUNT_CONFIG: PDVDiscountConfig = {
  enabled: true,
  caixaMaxPercent: 5,
  caixaMaxAmount: 20,
  gerenteMaxPercent: 15,
  gerenteMaxAmount: 100,
  adminMaxPercent: 30,
  adminMaxAmount: 200,
  proprietarioMaxPercent: 50,
  proprietarioMaxAmount: 500,
  absoluteMaxPercent: 50,
  absoluteMaxAmount: 1000,
  requireAuthCondition: 'EITHER',
  requireReason: true,
  requireNoteAbovePercent: 10,
  blockBelowCost: true,
  authValidityMinutes: 10,
  maxPinAttempts: 3,
  pinLockoutMinutes: 5,
  invalidateOnCartChange: true,
};

export const DEFAULT_DISCOUNT_REASONS = [
  "Cliente fidelizado",
  "Negociação autorizada",
  "Produto com pequena avaria",
  "Última unidade",
  "Cobertura de oferta",
  "Campanha especial",
  "Próximo do vencimento",
  "Produto de mostruário",
  "Cortesia comercial",
  "Erro operacional",
  "Outro",
] as const;

export type DiscountReason = typeof DEFAULT_DISCOUNT_REASONS[number] | string;

export interface DiscountReasonModel {
  id: string;
  code: string;
  name: string;
  description?: string;
  active: boolean;
  requiresNotes: boolean;
  displayOrder: number;
  isSystemDefault: boolean;
  storeId?: string;
  companyId?: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface InitialDiscountReasonSeed {
  code: string;
  name: string;
  description: string;
  requiresNotes: boolean;
  displayOrder: number;
}

export const INITIAL_DISCOUNT_REASONS_SEED: InitialDiscountReasonSeed[] = [
  { code: 'CLIENTE_FIDELIZADO', name: 'Cliente fidelizado', description: 'Desconto concedido para clientes cadastrados e frequentes.', requiresNotes: false, displayOrder: 1 },
  { code: 'NEGOCIACAO_COMERCIAL', name: 'Negociação comercial', description: 'Acordo comercial fechado durante o atendimento.', requiresNotes: false, displayOrder: 2 },
  { code: 'PROMOCAO_AUTORIZADA', name: 'Promoção autorizada', description: 'Promoção vigente aprovada pela gerência.', requiresNotes: false, displayOrder: 3 },
  { code: 'COBERTURA_OFERTA', name: 'Cobertura de oferta', description: 'Igualação de preço cobrindo oferta de concorrente.', requiresNotes: false, displayOrder: 4 },
  { code: 'ULTIMA_UNIDADE', name: 'Última unidade', description: 'Desconto de liquidação para última peça em estoque.', requiresNotes: false, displayOrder: 5 },
  { code: 'PRODUTO_MOSTRUARIO', name: 'Produto de mostruário', description: 'Item exposto no showroom ou vitrine.', requiresNotes: false, displayOrder: 6 },
  { code: 'PEQUENA_AVARIA', name: 'Produto com pequena avaria', description: 'Item com pequeno detalhe estético com avaria comunicada ao cliente.', requiresNotes: true, displayOrder: 7 },
  { code: 'PROXIMO_VENCIMENTO', name: 'Produto próximo do vencimento', description: 'Desconto especial para queima antes da validade.', requiresNotes: false, displayOrder: 8 },
  { code: 'QUEIMA_ESTOQUE', name: 'Queima de estoque', description: 'Desconto de ponta de estoque ou troca de coleção.', requiresNotes: false, displayOrder: 9 },
  { code: 'CAMPANHA_ESPECIAL', name: 'Campanha especial', description: 'Ação promocional de data comemorativa ou evento especial.', requiresNotes: false, displayOrder: 10 },
  { code: 'PAGAMENTO_A_VISTA', name: 'Desconto para pagamento à vista', description: 'Desconto incentivo para pagamento em dinheiro ou PIX.', requiresNotes: false, displayOrder: 11 },
  { code: 'DESCONTO_QUANTIDADE', name: 'Desconto por quantidade', description: 'Bonificação por volume de peças compradas.', requiresNotes: false, displayOrder: 12 },
  { code: 'COMPENSACAO_ATENDIMENTO', name: 'Compensação por problema no atendimento', description: 'Compensação concedida ao cliente devido a imprevistos na loja.', requiresNotes: true, displayOrder: 13 },
  { code: 'CORTESIA_COMERCIAL', name: 'Cortesia comercial', description: 'Gesto de gentileza autorizado para cliente especial.', requiresNotes: false, displayOrder: 14 },
  { code: 'AJUSTE_PRECO_AUTORIZADO', name: 'Ajuste de preço autorizado', description: 'Ajuste pontual de valor aprovado pelo supervisor.', requiresNotes: true, displayOrder: 15 },
  { code: 'ERRO_OPERACIONAL', name: 'Erro operacional', description: 'Ajuste devido a divergência na etiqueta ou sistema.', requiresNotes: true, displayOrder: 16 },
  { code: 'OUTRO', name: 'Outro', description: 'Outro motivo não listado (exige justificativa por escrito).', requiresNotes: true, displayOrder: 17 },
];
