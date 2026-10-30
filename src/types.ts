export const LESOES = ["COM AFASTAMENTO", "FATAL", "INCIDENTE", "SEM AFASTAMENTO"] as const;
export type Lesao = (typeof LESOES)[number];

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
export const BASES = ["BCB", "BDC", "PDS", "PDT", "ITM", "STI", "SIT"];
export const GERENCIAS = ["ALMOX", "ADM", "LOG", "SPOT", "SESMT", "GERE", "GOMAN", "GSTC", "FROTA"];
export const TIPOS = ["TÍPICO", "SINIS. TRÂNSITO", "PRI. SOCORROS", "INCIDENTE", "OUTROS"];
export const TURNOS = ["MANHÃ", "TARDE", "NOITE"];
export const ENVOLVIDOS = ["PRÓPRIOS", "TERCEIROS"];

export const CARACTERISTICAS = [
  "TRÂNSITO (COLISÃO, DANOS MATERIAIS)",
  "TRÂNSITO (TRAJETO)",
  "CONTATO COM ELETRICIDADE",
  "GOLPEADO POR (ATINGIDO POR OBJETO EM MOVIMENTO)",
  "GOLPEADO CONTRA/EM (CORRENDO, COLIDINDO, BATENDO, SOTERRAMENTO)",
  "IMPACTO/PRENSAMENTO POR OBJETO EM MOVIMENTO",
  "QUEDA EM ALTURA MAIOR QUE > 2 METROS",
  "QUEDA EM ALTURA MENOR QUE < 2 METROS",
  "QUEDA NO MESMO NÍVEL (ESCORREGÃO E QUEDA, TROPEÇÃO)",
  "QUEDA DE DIFERENÇA DE NIVEL",
  "PEGO ENTRE OU SOB (ESMAGADO, AMPUTADO)",
  "PEGO (AGARRADO, APERTADO), PEGO (BLOQUEADO, SUSPENSO)",
  "CORTE/PERFURAÇÃO",
  "ATAQUE DE ANIMAIS/INSETOS",
  "ATO DE VIOLÊNCIA",
  "DANOS A PROPIEDADE",
  "CONTATO COM SUBSTÂNCIAS PERIGOSAS",
  "INCÊNDIO (BLEVE/JATO DE FOGO/BOLA DE FOGO)",
  "EXPLOSÃO (NUVEM DE VAPOR/POEIRA/PRESSÃO DE RUPTURA/BLEVE)",
  "FALHA DE EQUIPAMENTO MECÂNICO",
  "FALHA DE SISTEMA ELÉTRICO",
  "OPERAÇÕES ANORMAIS / DISTÚRBIOS NO PROCESSO",
  "OUTROS",
];

export interface Acao {
  etapa: number;
  prazo?: string;
  realizacao?: string;
  status?: string;
}

export interface Registro {
  id: string;
  categoria: "acidente" | "incidente_interno";
  data: string; // yyyy-mm-dd
  hora?: string; // HH:MM
  turno: string;
  colaborador: string;
  prefixo: string;
  processo: string; // gerência
  base: string;
  cidade: string;
  supervisor: string;
  tipo: string;
  caracteristica: string;
  definicao: string;
  descricao: string;
  envolvidos: "PRÓPRIOS" | "TERCEIROS";
  gravidade: string;
  lesao: string;
  cat: string;
  trajeto: string;
  comunicadoEqtl: string;
  diasPerdidos?: number; // dias corridos de afastamento (NBR 14280)
  diasDebitados?: number; // dias debitados (morte/incapacidade permanente); vazio = 6000 se fatal
  acoes?: Acao[];
}

export interface Taxa {
  ano: number;
  mes: number; // 1-12
  tg: number;
  metaTg: number;
  tf: number; // sem afastamento
  tfca: number; // com afastamento
  metaTf: number;
}

/** Horas-homem de exposição ao risco (H) de cada mês, base do cálculo das taxas. */
export interface Exposicao {
  ano: number;
  mes: number;
  horas: number;
}

/** Critérios e metas do cálculo das taxas. */
export interface ConfigTaxas {
  metaTf: number;
  metaTg: number;
  /** tipos de evento com lesão sem afastamento que entram na TF (sem afastamento) */
  tiposSemAfastamento: string[];
  /** acidentes de trajeto ficam fora das taxas, salvo se marcado */
  incluirTrajeto: boolean;
}

export const CONFIG_PADRAO: ConfigTaxas = {
  metaTf: 4.17,
  metaTg: 39,
  tiposSemAfastamento: ["TÍPICO", "PRI. SOCORROS"],
  incluirTrajeto: false,
};

export interface Dataset {
  registros: Registro[];
  taxas: Taxa[]; // taxas importadas da planilha (histórico), usadas quando não há horas-homem
  exposicao: Exposicao[];
  equipes: Equipe[];
  colaboradores: Colaborador[];
  config: ConfigTaxas;
  atualizadoEm: string; // ISO
}

/** Cadastro de equipes (prefixos): base, gerência, coordenação e gerência geral de cada uma. */
export interface Equipe {
  prefixo: string;
  base: string; // código: BCB, BDC...
  gerencia: string; // código: GSTC, GOMAN...
  coordenador: string;
  gerente: string;
}

/** Quadro de colaboradores (planilha do QSMS): usado no autocomplete e para completar base/gerência. */
export interface Colaborador {
  chapa: string;
  nome: string;
  funcao: string;
  base: string;
  processo: string;
  gerencia: string; // código: GOMAN, GSTC, GERE, ADM, ALMOX, FROTA, SESMT
  situacao: string;
}
