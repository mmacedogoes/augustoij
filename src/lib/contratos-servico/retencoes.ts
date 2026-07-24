/**
 * Regras determinísticas de retenções aplicáveis a um contrato de prestação
 * de serviços. Fase 3.
 *
 * Existem apenas duas retenções possíveis nesta versão:
 *  - ISS retido na fonte (`iss_retido`): aplica quando a matriz
 *    `tipos_servico_retencoes` vincula o ISS ao tipo do contrato com
 *    `aplica_por_padrao = true`.
 *  - INSS de cessão de mão de obra (`inss_cessao_mao_de_obra`): aplica se e
 *    somente se o contrato tiver `terceirizacao_mao_de_obra = true`.
 *
 * A CSRF permanece desativada; o IRRF foi removido do catálogo. O documento
 * do prestador (CPF/CNPJ) não influencia a sinalização.
 */

export type RetencaoAplicavel = {
  slug: "iss_retido" | "inss_cessao_mao_de_obra";
  nome: string;
  aliquota_referencia: string | null;
  base_legal: string | null;
  descricao: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export async function calcularRetencoesAplicaveis(
  supabase: SupabaseLike,
  contratoId: string,
): Promise<RetencaoAplicavel[]> {
  const { data: contrato, error: cErr } = await supabase
    .from("contratos_servico")
    .select("id, tipo_servico_id, terceirizacao_mao_de_obra")
    .eq("id", contratoId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!contrato) throw new Error("Contrato não encontrado");

  const { data: retencoes, error: rErr } = await supabase
    .from("retencoes_config")
    .select("id, slug, nome, aliquota_referencia, base_legal, descricao, ativo_padrao")
    .eq("ativo_padrao", true);
  if (rErr) throw new Error(rErr.message);

  type RetRow = {
    id: string;
    slug: string;
    nome: string;
    aliquota_referencia: string | null;
    base_legal: string | null;
    descricao: string | null;
  };
  const list = (retencoes ?? []) as RetRow[];

  let vinculos: { retencao_id: string; aplica_por_padrao: boolean }[] = [];
  if (contrato.tipo_servico_id) {
    const { data: matriz, error: mErr } = await supabase
      .from("tipos_servico_retencoes")
      .select("retencao_id, aplica_por_padrao")
      .eq("tipo_servico_id", contrato.tipo_servico_id);
    if (mErr) throw new Error(mErr.message);
    vinculos = (matriz ?? []) as typeof vinculos;
  }
  const aplicaTipo = new Set(
    vinculos.filter((v) => v.aplica_por_padrao).map((v) => v.retencao_id),
  );

  const out: RetencaoAplicavel[] = [];
  for (const r of list) {
    if (r.slug === "iss_retido") {
      if (aplicaTipo.has(r.id)) {
        out.push({
          slug: "iss_retido",
          nome: r.nome,
          aliquota_referencia: r.aliquota_referencia,
          base_legal: r.base_legal,
          descricao: r.descricao,
        });
      }
    } else if (r.slug === "inss_cessao_mao_de_obra") {
      if (contrato.terceirizacao_mao_de_obra === true) {
        out.push({
          slug: "inss_cessao_mao_de_obra",
          nome: r.nome,
          aliquota_referencia: r.aliquota_referencia,
          base_legal: r.base_legal,
          descricao: r.descricao,
        });
      }
    }
  }
  // Ordem estável: ISS primeiro, depois INSS.
  out.sort((a, b) => (a.slug === "iss_retido" ? -1 : b.slug === "iss_retido" ? 1 : 0));
  return out;
}

export function descricaoItemTributario(r: RetencaoAplicavel): string {
  const al = r.aliquota_referencia ? ` (${r.aliquota_referencia})` : "";
  return `Verificar retenção: ${r.nome}${al}`;
}