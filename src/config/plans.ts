/**
 * Fonte única de verdade para as regras de cada plano.
 * Todos os módulos (landing, checkout, limites, gates de recurso) devem
 * importar deste arquivo — nunca replicar valores manualmente.
 *
 * Convenção: `null` em qualquer campo numérico significa ILIMITADO.
 */

export type PlanId =
  | "gratuito"
  | "essencial"
  | "profissional"
  | "gestao"
  | "administradora"
  | "personalizado";

export type ModeloIA = "modelo-economico" | "modelo-padrao";

export type PlanRecursos = {
  uploadDocumentos: boolean;
  analiseContratos: boolean;
  modelosDocumentos: boolean;
  jurisprudenciaCompleta: boolean;
  minutasAtaConvencao: boolean;
  relatoriosPorCondominio: boolean;
  suportePrioritario: boolean;
};

export type Plan = {
  id: PlanId;
  nome: string;
  duracaoDias: number | null;
  mensagensPorDia: number | null;
  mensagensPorMes: number | null;
  condomíniosMax: number | null;
  documentosMax: number | null;
  usuariosMax: number | null;
  historicosDias: number | null;
  modelo_ia: ModeloIA;
  recursos: PlanRecursos;
};

export const PLANS = {
  gratuito: {
    id: "gratuito",
    nome: "Gratuito",
    duracaoDias: 30,
    mensagensPorDia: 10,
    mensagensPorMes: null,
    condomíniosMax: 1,
    documentosMax: 0,
    usuariosMax: 1,
    historicosDias: 7,
    modelo_ia: "modelo-economico",
    recursos: {
      uploadDocumentos: false,
      analiseContratos: false,
      modelosDocumentos: false,
      jurisprudenciaCompleta: false,
      minutasAtaConvencao: false,
      relatoriosPorCondominio: false,
      suportePrioritario: false,
    },
  },
  essencial: {
    id: "essencial",
    nome: "Essencial",
    duracaoDias: null,
    mensagensPorDia: null,
    mensagensPorMes: 100,
    condomíniosMax: 2,
    documentosMax: 10,
    usuariosMax: 1,
    historicosDias: 30,
    modelo_ia: "modelo-economico",
    recursos: {
      uploadDocumentos: true,
      analiseContratos: true,
      modelosDocumentos: true,
      jurisprudenciaCompleta: false,
      minutasAtaConvencao: false,
      relatoriosPorCondominio: false,
      suportePrioritario: false,
    },
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    duracaoDias: null,
    mensagensPorDia: null,
    mensagensPorMes: 400,
    condomíniosMax: 8,
    documentosMax: null,
    usuariosMax: 2,
    historicosDias: null,
    modelo_ia: "modelo-padrao",
    recursos: {
      uploadDocumentos: true,
      analiseContratos: true,
      modelosDocumentos: true,
      jurisprudenciaCompleta: true,
      minutasAtaConvencao: true,
      relatoriosPorCondominio: false,
      suportePrioritario: false,
    },
  },
  gestao: {
    id: "gestao",
    nome: "Gestão",
    duracaoDias: null,
    mensagensPorDia: null,
    mensagensPorMes: 900,
    condomíniosMax: 20,
    documentosMax: null,
    usuariosMax: 3,
    historicosDias: null,
    modelo_ia: "modelo-padrao",
    recursos: {
      uploadDocumentos: true,
      analiseContratos: true,
      modelosDocumentos: true,
      jurisprudenciaCompleta: true,
      minutasAtaConvencao: true,
      relatoriosPorCondominio: true,
      suportePrioritario: true,
    },
  },
  administradora: {
    id: "administradora",
    nome: "Administradora",
    duracaoDias: null,
    mensagensPorDia: null,
    mensagensPorMes: null,
    condomíniosMax: 50,
    documentosMax: null,
    usuariosMax: 10,
    historicosDias: null,
    modelo_ia: "modelo-padrao",
    recursos: {
      uploadDocumentos: true,
      analiseContratos: true,
      modelosDocumentos: true,
      jurisprudenciaCompleta: true,
      minutasAtaConvencao: true,
      relatoriosPorCondominio: true,
      suportePrioritario: false,
    },
  },
  personalizado: {
    id: "personalizado",
    nome: "Personalizado",
    duracaoDias: null,
    mensagensPorDia: null,
    mensagensPorMes: null,
    condomíniosMax: null,
    documentosMax: null,
    usuariosMax: null,
    historicosDias: null,
    modelo_ia: "modelo-padrao",
    recursos: {
      uploadDocumentos: true,
      analiseContratos: true,
      modelosDocumentos: true,
      jurisprudenciaCompleta: true,
      minutasAtaConvencao: true,
      relatoriosPorCondominio: true,
      suportePrioritario: true,
    },
  },
} as const satisfies Record<PlanId, Plan>;

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const getPlan = (id: PlanId): Plan => PLANS[id];

/** true = ilimitado. */
export const isUnlimited = (v: number | null): v is null => v === null;

/**
 * Verifica se um contador atingiu o limite. `null` como limite = ilimitado.
 */
export const atingiuLimite = (usado: number, limite: number | null): boolean =>
  limite !== null && usado >= limite;

/** Formata um limite numérico para exibição ("Ilimitado" quando null). */
export const formatarLimite = (v: number | null, unidade = ""): string =>
  v === null ? "Ilimitado" : unidade ? `${v} ${unidade}` : String(v);

/**
 * Classificação especial para usuários cadastrados por um titular pagante
 * dentro de um condomínio. Eles não possuem plano próprio — o consumo e os
 * limites são atribuídos ao titular do condomínio.
 *
 * Não faz parte de `PLANS` porque não deve aparecer em seletores de plano,
 * checkout, landing ou comparativos. É apenas um rótulo de exibição.
 */
export const CLASSIFICACAO_VINCULADO = {
  id: "vinculado" as const,
  nome: "Vinculado ao titular",
  descricao:
    "Usuário cadastrado por um titular pagante. Utiliza o plano do titular do condomínio.",
};