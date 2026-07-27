/**
 * Fonte única de verdade dos planos comerciais.
 * Usado pela landing page e pelas regras de uso do sistema.
 * Convenção: `null` em campos numéricos de limite = ILIMITADO.
 */

export type PlanoId =
  | "gratuito"
  | "essencial"
  | "profissional"
  | "gestao"
  | "administradora"
  | "personalizado";

export type LimitesPlano = {
  mensagensPorDia: number | null;
  mensagensPorMes: number | null;
  usoRazoavelMensagens?: number | null;
  condominios: number | null;
  usuarios: number | null;
  uploadConvencao?: number | null;
  uploadContrato?: number | null;
  uploadOutrosDocumentos?: number | null;
  documentosIlimitados: boolean;
  analisesContrato: number | null;
  contratosGestaoAtiva: number | null;
  usoRazoavelContratos?: number | null;
  historicoDias: number | null;
};

export type RecursosPlano = {
  jurisprudenciaCompleta: boolean;
  modelosBasicos: boolean;
  minutasAtaConvencao: boolean;
  painelConsolidado: boolean;
  relatoriosPorCondominio: boolean;
  suportePrioritario: boolean;
  whiteLabel?: boolean;
  treinamentoEquipe?: boolean;
  gerenteDeConta?: boolean;
  integracoesPersonalizadas?: boolean;
  slaNegociado?: boolean;
};

export type Plano = {
  id: PlanoId;
  nome: string;
  precoMensal: number | null;
  precoAnual: number | null;
  publico: string;
  destaque?: boolean;
  badge?: string;
  ctaTexto?: string;
  duracaoDias?: number;
  limites: LimitesPlano;
  recursos: RecursosPlano;
};

export const PLANOS = {
  gratuito: {
    id: "gratuito",
    nome: "Gratuito",
    precoMensal: 0,
    precoAnual: 0,
    publico: "Teste por 7 dias, sem cartão de crédito",
    duracaoDias: 7,
    limites: {
      mensagensPorDia: 10,
      mensagensPorMes: null,
      condominios: 1,
      usuarios: 1,
      uploadConvencao: 1,
      uploadContrato: 1,
      uploadOutrosDocumentos: 0,
      documentosIlimitados: false,
      analisesContrato: 1,
      contratosGestaoAtiva: 0,
      historicoDias: 7,
    },
    recursos: {
      jurisprudenciaCompleta: true,
      modelosBasicos: false,
      minutasAtaConvencao: false,
      painelConsolidado: false,
      relatoriosPorCondominio: false,
      suportePrioritario: false,
    },
  },
  essencial: {
    id: "essencial",
    nome: "Essencial",
    precoMensal: 97,
    precoAnual: 970,
    publico: "Para síndicos moradores",
    limites: {
      mensagensPorDia: null,
      mensagensPorMes: 100,
      condominios: 2,
      usuarios: 1,
      documentosIlimitados: true,
      analisesContrato: null,
      contratosGestaoAtiva: 3,
      historicoDias: 30,
    },
    recursos: {
      jurisprudenciaCompleta: true,
      modelosBasicos: true,
      minutasAtaConvencao: false,
      painelConsolidado: false,
      relatoriosPorCondominio: false,
      suportePrioritario: false,
    },
  },
  profissional: {
    id: "profissional",
    nome: "Profissional",
    precoMensal: 247,
    precoAnual: 2470,
    publico: "Para síndicos profissionais e advogados",
    destaque: true,
    badge: "Mais escolhido",
    limites: {
      mensagensPorDia: null,
      mensagensPorMes: 400,
      condominios: 8,
      usuarios: 2,
      documentosIlimitados: true,
      analisesContrato: null,
      contratosGestaoAtiva: 15,
      historicoDias: null,
    },
    recursos: {
      jurisprudenciaCompleta: true,
      modelosBasicos: true,
      minutasAtaConvencao: true,
      painelConsolidado: false,
      relatoriosPorCondominio: false,
      suportePrioritario: false,
    },
  },
  gestao: {
    id: "gestao",
    nome: "Gestão",
    precoMensal: 447,
    precoAnual: 4470,
    publico: "Para síndicos com carteira ampla",
    limites: {
      mensagensPorDia: null,
      mensagensPorMes: 900,
      condominios: 20,
      usuarios: 3,
      documentosIlimitados: true,
      analisesContrato: null,
      contratosGestaoAtiva: 40,
      historicoDias: null,
    },
    recursos: {
      jurisprudenciaCompleta: true,
      modelosBasicos: true,
      minutasAtaConvencao: true,
      painelConsolidado: true,
      relatoriosPorCondominio: true,
      suportePrioritario: true,
    },
  },
  administradora: {
    id: "administradora",
    nome: "Administradora",
    precoMensal: 997,
    precoAnual: 9970,
    publico: "Para administradoras de condomínios",
    limites: {
      mensagensPorDia: null,
      mensagensPorMes: null,
      usoRazoavelMensagens: 3000,
      condominios: 50,
      usuarios: 10,
      documentosIlimitados: true,
      analisesContrato: null,
      contratosGestaoAtiva: null,
      usoRazoavelContratos: 200,
      historicoDias: null,
    },
    recursos: {
      jurisprudenciaCompleta: true,
      modelosBasicos: true,
      minutasAtaConvencao: true,
      painelConsolidado: true,
      relatoriosPorCondominio: true,
      suportePrioritario: true,
    },
  },
  personalizado: {
    id: "personalizado",
    nome: "Personalizado",
    precoMensal: null,
    precoAnual: null,
    publico: "Para operações que precisam de mais",
    ctaTexto: "Falar com nossa equipe",
    limites: {
      mensagensPorDia: null,
      mensagensPorMes: null,
      condominios: null,
      usuarios: null,
      documentosIlimitados: true,
      analisesContrato: null,
      contratosGestaoAtiva: null,
      historicoDias: null,
    },
    recursos: {
      jurisprudenciaCompleta: true,
      modelosBasicos: true,
      minutasAtaConvencao: true,
      painelConsolidado: true,
      relatoriosPorCondominio: true,
      suportePrioritario: true,
      whiteLabel: true,
      treinamentoEquipe: true,
      gerenteDeConta: true,
      integracoesPersonalizadas: true,
      slaNegociado: true,
    },
  },
} as const satisfies Record<PlanoId, Plano>;

export type RecursoKey = keyof RecursosPlano;
export type LimiteKey = keyof LimitesPlano;

/** true quando o plano habilita o recurso informado. */
export function podeUsar(planoId: PlanoId, recurso: RecursoKey): boolean {
  const plano = PLANOS[planoId];
  if (!plano) return false;
  return plano.recursos[recurso] === true;
}

/**
 * Retorna o valor bruto do limite: número, `null` para ilimitado,
 * ou `undefined` quando o campo não se aplica àquele plano.
 */
export function limiteDe(
  planoId: PlanoId,
  limite: LimiteKey,
): number | null | undefined {
  const plano = PLANOS[planoId];
  if (!plano) return undefined;
  return plano.limites[limite] as number | null | undefined;
}

export const PLANOS_LIST: Plano[] = Object.values(PLANOS);
