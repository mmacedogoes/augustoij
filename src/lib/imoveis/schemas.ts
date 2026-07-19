import { z } from "zod";

// Coerção de campos numéricos vindos do form (string vazia → null).
const numOrNull = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().nullable(),
);
const intOrNull = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().nullable(),
);
const textOrNull = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : String(v)),
  z.string().nullable(),
);
const boolDefault = (d: boolean) =>
  z.preprocess((v) => (v === undefined ? d : v), z.boolean());

export const proprietarioSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(200),
  cpf: textOrNull,
  estado_civil: textOrNull,
  profissao: textOrNull,
  rg: textOrNull,
  email: textOrNull,
  telefone: textOrNull,
  endereco: textOrNull,
  banco: textOrNull,
  agencia: textOrNull,
  conta: textOrNull,
  pix: textOrNull,
  observacoes: textOrNull,
});
export type ProprietarioInput = z.infer<typeof proprietarioSchema>;

export const imovelSchema = z.object({
  id: z.string().uuid().optional(),
  proprietario_id: z.string().uuid("Selecione um proprietário"),
  descricao: textOrNull,
  endereco: textOrNull,
  edificio: textOrNull,
  numero_unidade: textOrNull,
  cep: textOrNull,
  cidade: textOrNull,
  uf: textOrNull,
  matricula: textOrNull,
  quartos: intOrNull,
  vaga_garagem: boolDefault(false),
  area: numOrNull,
  observacoes: textOrNull,
});
export type ImovelInput = z.infer<typeof imovelSchema>;

export const caucaoSchema = z.object({
  possui: boolDefault(false),
  valor_depositado: numOrNull,
  tipo: z.enum(["poupanca", "dinheiro", "seguro", "outro"]).nullable().optional(),
  corrige_com_rendimento: boolDefault(true),
  data_deposito: textOrNull,
  valor_atual_override: numOrNull,
  observacoes: textOrNull,
});
export type CaucaoInput = z.infer<typeof caucaoSchema>;

export const contratoLocacaoSchema = z.object({
  id: z.string().uuid().optional(),
  imovel_id: z.string().uuid("Selecione um imóvel"),
  inquilino_nome: textOrNull,
  inquilino_cpf: textOrNull,
  inquilino_estado_civil: textOrNull,
  inquilino_profissao: textOrNull,
  inquilino_rg: textOrNull,
  inquilino_email: textOrNull,
  inquilino_telefone: textOrNull,
  inquilino_endereco: textOrNull,
  valor_aluguel: numOrNull,
  valor_aluguel_inicial: numOrNull,
  dia_vencimento: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).max(31).nullable(),
  ),
  data_contrato_original: textOrNull,
  data_inicio_vigencia: textOrNull,
  prazo_meses: intOrNull,
  indice_reajuste: z.preprocess((v) => v ?? "IGP-M", z.string().default("IGP-M")),
  periodicidade_reajuste_meses: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 12 : Number(v)),
    z.number().int().min(1).default(12),
  ),
  mes_base_reajuste: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(1).max(12).nullable(),
  ),
  encargos_inquilino: z.object({
    condominio: boolDefault(true),
    agua: boolDefault(true),
    luz: boolDefault(true),
    iptu: boolDefault(true),
    tcr: boolDefault(true),
  }),
  multa_mora_percent: z.preprocess((v) => (v === "" || v == null ? 2 : Number(v)), z.number().default(2)),
  juros_mora_mensal_percent: z.preprocess((v) => (v === "" || v == null ? 1 : Number(v)), z.number().default(1)),
  multa_rescisoria_multiplicador: z.preprocess((v) => (v === "" || v == null ? 3 : Number(v)), z.number().default(3)),
  multa_rescisoria_proporcional: boolDefault(true),
  aviso_previo_dias: z.preprocess((v) => (v === "" || v == null ? 30 : Number(v)), z.number().int().default(30)),
  foro: textOrNull,
  status: z.enum(["ativo", "encerrado", "renovado"]).default("ativo"),
  arquivo_contrato_url: textOrNull,
  caucao: caucaoSchema,
});
export type ContratoLocacaoInput = z.infer<typeof contratoLocacaoSchema>;

export const contratoAdministracaoSchema = z.object({
  id: z.string().uuid().optional(),
  proprietario_id: z.string().uuid("Selecione um proprietário"),
  administrador_nome: textOrNull,
  administrador_documento: textOrNull,
  administrador_oab: textOrNull,
  pix_recebimento: textOrNull,
  banco_recebimento: textOrNull,
  agencia_recebimento: textOrNull,
  conta_recebimento: textOrNull,
  percent_honorario_renovacao: z.preprocess((v) => (v === "" || v == null ? 50 : Number(v)), z.number().default(50)),
  percent_honorario_mensal: z.preprocess((v) => (v === "" || v == null ? 10 : Number(v)), z.number().default(10)),
  mora_multa_percent: z.preprocess((v) => (v === "" || v == null ? 2 : Number(v)), z.number().default(2)),
  mora_juros_mensal_percent: z.preprocess((v) => (v === "" || v == null ? 1 : Number(v)), z.number().default(1)),
  mora_indice: z.preprocess((v) => v ?? "IGP-M", z.string().default("IGP-M")),
  data_inicio: textOrNull,
  prazo_meses: z.preprocess((v) => (v === "" || v == null ? 24 : Number(v)), z.number().int().default(24)),
  status: z.preprocess((v) => v ?? "ativo", z.string().default("ativo")),
  arquivo_contrato_url: textOrNull,
});
export type ContratoAdministracaoInput = z.infer<typeof contratoAdministracaoSchema>;

export const idInput = z.object({ id: z.string().uuid() });