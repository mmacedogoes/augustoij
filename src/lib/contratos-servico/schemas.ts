import { z } from "zod";

const textOrNull = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : String(v).trim() === "" ? null : String(v)),
  z.string().nullable(),
);
const numOrNull = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().nullable(),
);
const intOrNull = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().nullable(),
);
const dateOrNull = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : String(v)),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "Data inválida (use aaaa-mm-dd)")
    .nullable(),
);
const boolDefault = (d: boolean) =>
  z.preprocess((v) => (v === undefined ? d : v), z.boolean());

export const idInput = z.object({ id: z.string().uuid() });

export const contratoServicoSchema = z
  .object({
    id: z.string().uuid().optional(),
    condominio_id: z.string().uuid("Selecione um condomínio"),
    tipo_servico_id: z.string().uuid().nullable().optional(),
    situacao: z.enum(["ativo", "suspenso", "encerrado"]).default("ativo"),
    prestador_nome: z.string().trim().min(1, "Nome do prestador é obrigatório").max(200),
    prestador_documento: textOrNull,
    prestador_email: textOrNull,
    prestador_telefone: textOrNull,
    objeto: textOrNull,
    terceirizacao_mao_de_obra: boolDefault(false),
    data_inicio: dateOrNull,
    prazo_indeterminado: boolDefault(false),
    data_fim: dateOrNull,
    renovacao_automatica: boolDefault(false),
    aviso_previo_dias: intOrNull,
    valor: numOrNull,
    tipo_valor: z.enum(["mensal", "global"]).default("mensal"),
    dia_vencimento: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().min(1).max(31).nullable(),
    ),
    indice_reajuste: z.enum(["igpm", "ipca", "inpc", "outro", "nenhum"]).default("igpm"),
    mes_base_reajuste: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
      z.number().int().min(1).max(12).nullable(),
    ),
    multa_rescisoria: textOrNull,
    exige_seguro_rc: boolDefault(false),
    garantias: textOrNull,
    foro: textOrNull,
  })
  .superRefine((v, ctx) => {
    if (!v.prazo_indeterminado) {
      if (!v.data_fim) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["data_fim"],
          message: "Informe a data de fim ou marque prazo indeterminado",
        });
      } else if (v.data_inicio && v.data_fim <= v.data_inicio) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["data_fim"],
          message: "A data de fim deve ser posterior à data de início",
        });
      }
    }
  });

export type ContratoServicoInput = z.infer<typeof contratoServicoSchema>;

export const obrigacaoSchema = z.object({
  id: z.string().uuid().optional(),
  contrato_id: z.string().uuid(),
  parte: z.enum(["condominio", "prestador"]),
  descricao: z.string().trim().min(1, "Descreva a obrigação").max(1000),
  periodicidade: z
    .enum(["unica", "mensal", "trimestral", "semestral", "anual", "por_evento"])
    .default("mensal"),
  clausula_origem: textOrNull,
  ordem: z.number().int().min(0).default(0),
});
export type ObrigacaoInput = z.infer<typeof obrigacaoSchema>;

export const listFiltersSchema = z.object({
  condominioId: z.string().uuid().nullable().optional(),
  statusExibicao: z
    .enum(["vigente", "vence_em_breve", "vencido", "suspenso", "encerrado"])
    .nullable()
    .optional(),
  tipoServicoId: z.string().uuid().nullable().optional(),
  busca: z.string().trim().max(200).nullable().optional(),
});
export type ListFilters = z.infer<typeof listFiltersSchema>;