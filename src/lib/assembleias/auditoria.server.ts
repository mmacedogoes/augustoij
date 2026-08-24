/**
 * Lógica de auditoria de assembleias. Todo o acesso é feito com o cliente
 * administrativo, sempre depois do guard de super admin nas server functions.
 * Nenhum retorno desta camada expõe IP completo.
 */
import {
  mascararIp,
  montarCsv,
  motivoLegivel,
  acaoLegivel,
  ACOES_MESA_AUDITADAS,
  agenteResumido,
  carimbo,
} from "./auditoria-utils";
import { descreverResultado } from "./resultado-texto";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function rotuloUnidade(u: any): string {
  if (!u) return "—";
  return [u.bloco, u.numero].filter(Boolean).join(" ").trim() || "—";
}

export type LinhaRegistro = {
  id: string;
  tipo: "voto" | "tentativa";
  criadoEm: string;
  unidade: string | null;
  vinculo: string | null;
  opcao: string | null;
  peso: number | null;
  baseCalculo: string | null;
  origem: string;
  ipMascarado: string;
  agente: string | null;
  recibo: string | null;
  justificativaManual: string | null;
  motivo: string | null;
  invalidado: boolean;
  invalidadoMotivo: string | null;
  invalidadoPor: string | null;
  sequencia: number | null;
};

export async function carregarAssembleia(assembleiaId: string) {
  const sb = await admin();
  const { data, error } = await sb
    .from("assembleias")
    .select("*, condominio:condominios(nome, cnpj, cidade, uf, endereco)")
    .eq("id", assembleiaId)
    .single();
  if (error || !data) throw new Error("Assembleia não encontrada.");
  return data as any;
}

async function mapaVinculos(sb: any, assembleiaId: string) {
  const { data } = await sb
    .from("assembleia_presencas")
    .select("unidade_id, tipo, representante_nome")
    .eq("assembleia_id", assembleiaId);
  const mapa = new Map<string, string>();
  for (const p of data ?? []) {
    const texto =
      p.tipo === "procuracao"
        ? `por procuração${p.representante_nome ? ` — ${p.representante_nome}` : ""}`
        : "titular";
    mapa.set(p.unidade_id, texto);
  }
  return mapa;
}

export async function obterResumo(assembleiaId: string) {
  const sb = await admin();

  const [{ data: votos }, { data: tentativas }, { data: itens }] = await Promise.all([
    sb.from("assembleia_votos").select("item_id, invalidado_em, device_hash").eq("assembleia_id", assembleiaId),
    sb.from("assembleia_tentativas").select("motivo").eq("assembleia_id", assembleiaId),
    sb.from("assembleia_itens").select("id").eq("assembleia_id", assembleiaId),
  ]);

  const validos = (votos ?? []).filter((v: any) => !v.invalidado_em);
  const anulados = (votos ?? []).length - validos.length;
  const itensComVoto = new Set(validos.map((v: any) => v.item_id)).size;

  const contagem = new Map<string, number>();
  for (const t of tentativas ?? []) contagem.set(t.motivo, (contagem.get(t.motivo) ?? 0) + 1);
  const topMotivos = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([motivo, total]) => ({ motivo: motivoLegivel(motivo), total }));

  const porDispositivo = new Map<string, Set<string>>();
  for (const v of votos ?? []) {
    if (!v.device_hash) continue;
    if (!porDispositivo.has(v.device_hash)) porDispositivo.set(v.device_hash, new Set());
  }

  const { data: ultima } = await sb
    .from("admin_audit_log")
    .select("created_at, metadata")
    .eq("action", "assembleia.auditoria.verificar")
    .contains("metadata", { assembleia_id: assembleiaId })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = (ultima?.metadata ?? {}) as any;

  return {
    totalItens: (itens ?? []).length,
    votos: validos.length,
    itensComVoto,
    anulados,
    tentativas: (tentativas ?? []).length,
    topMotivos,
    dispositivos: porDispositivo.size,
    ultimaVerificacao: ultima
      ? { em: ultima.created_at, integra: meta.integra !== false, totalVotos: meta.total_votos ?? null }
      : null,
  };
}

export async function obterRegistroVotos(assembleiaId: string, itemId: string): Promise<{
  item: any;
  linhas: LinhaRegistro[];
}> {
  const sb = await admin();

  const { data: item } = await sb
    .from("assembleia_itens")
    .select("id, ordem, titulo, secreto, situacao")
    .eq("id", itemId)
    .single();
  if (!item) throw new Error("Item não encontrado.");

  const [{ data: votos }, { data: tentativas }, vinculos] = await Promise.all([
    sb
      .from("assembleia_votos")
      .select("*, opcao:assembleia_opcoes(rotulo), unidade:unidades(bloco, numero)")
      .eq("item_id", itemId),
    sb.from("assembleia_tentativas").select("*, unidade:unidades(bloco, numero)").eq("item_id", itemId),
    mapaVinculos(sb, assembleiaId),
  ]);

  const secreto = !!item.secreto;

  const linhasVotos: LinhaRegistro[] = (votos ?? []).map((v: any) => ({
    id: v.id,
    tipo: "voto",
    criadoEm: v.criado_em,
    unidade: secreto ? null : rotuloUnidade(v.unidade),
    vinculo: secreto ? null : v.unidade_id ? vinculos.get(v.unidade_id) ?? "titular" : null,
    opcao: v.opcao?.rotulo ?? "—",
    peso: v.peso,
    baseCalculo: v.base_calculo,
    origem: v.origem,
    ipMascarado: mascararIp(v.ip),
    agente: v.user_agent,
    recibo: v.recibo,
    justificativaManual: v.justificativa_manual,
    motivo: null,
    invalidado: !!v.invalidado_em,
    invalidadoMotivo: v.invalidado_motivo,
    invalidadoPor: v.invalidado_por,
    sequencia: v.sequencia,
  }));

  const linhasTentativas: LinhaRegistro[] = (tentativas ?? []).map((t: any) => ({
    id: t.id,
    tipo: "tentativa",
    criadoEm: t.criado_em,
    unidade: secreto ? null : rotuloUnidade(t.unidade),
    vinculo: null,
    opcao: null,
    peso: null,
    baseCalculo: null,
    origem: "portal",
    ipMascarado: mascararIp(t.ip),
    agente: t.user_agent,
    recibo: null,
    justificativaManual: null,
    motivo: motivoLegivel(t.motivo),
    invalidado: false,
    invalidadoMotivo: null,
    invalidadoPor: null,
    sequencia: null,
  }));

  const linhas = [...linhasVotos, ...linhasTentativas];

  if (secreto) {
    // Ordenação por recibo: a ordem cronológica somada à presença permitiria deduzir o voto.
    linhas.sort((a, b) => (a.recibo ?? "zzz").localeCompare(b.recibo ?? "zzz"));
  } else {
    linhas.sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime());
  }

  return { item, linhas };
}

export async function obterTentativas(assembleiaId: string) {
  const sb = await admin();
  const { data } = await sb
    .from("assembleia_tentativas")
    .select("*, unidade:unidades(bloco, numero), item:assembleia_itens(ordem, titulo)")
    .eq("assembleia_id", assembleiaId)
    .order("criado_em", { ascending: false });

  return (data ?? []).map((t: any) => ({
    id: t.id,
    criadoEm: t.criado_em,
    motivoBruto: t.motivo,
    motivo: motivoLegivel(t.motivo),
    detalhe: t.detalhe,
    unidade: t.unidade ? rotuloUnidade(t.unidade) : null,
    item: t.item ? { ordem: t.item.ordem, titulo: t.item.titulo } : null,
    email: t.email_tentativa,
    ipMascarado: mascararIp(t.ip),
    agente: t.user_agent,
  }));
}

export async function obterPresencas(assembleiaId: string, sessaoId?: string | null) {
  const sb = await admin();
  const { data: sessoes } = await sb
    .from("assembleia_sessoes")
    .select("id, ordem, data_hora_inicio, data_hora_fim, situacao")
    .eq("assembleia_id", assembleiaId)
    .order("ordem");

  let q = sb
    .from("assembleia_presencas")
    .select("*, unidade:unidades(bloco, numero)")
    .eq("assembleia_id", assembleiaId)
    .order("checkin_em");
  if (sessaoId) q = q.eq("sessao_id", sessaoId);
  const { data } = await q;

  return {
    sessoes: sessoes ?? [],
    presencas: (data ?? []).map((p: any) => ({
      id: p.id,
      sessaoId: p.sessao_id,
      unidade: rotuloUnidade(p.unidade),
      tipo: p.tipo,
      representante: p.representante_nome,
      entrada: p.checkin_em,
      saida: p.checkout_em,
      origem: p.origem,
    })),
  };
}

export async function obterAtosMesa(assembleiaId: string) {
  const sb = await admin();
  const { data: itens } = await sb
    .from("assembleia_itens")
    .select("id, ordem, titulo")
    .eq("assembleia_id", assembleiaId);
  const idsItens = new Set((itens ?? []).map((i: any) => i.id));
  const rotuloItem = new Map((itens ?? []).map((i: any) => [i.id, `Item ${i.ordem} — ${i.titulo}`]));

  const { data: logs } = await sb
    .from("admin_audit_log")
    .select("id, action, created_at, actor_user_id, metadata")
    .in("action", ACOES_MESA_AUDITADAS)
    .order("created_at", { ascending: false })
    .limit(2000);

  const filtrados = (logs ?? []).filter((l: any) => {
    const m = (l.metadata ?? {}) as any;
    return m.assembleia_id === assembleiaId || (m.item_id && idsItens.has(m.item_id));
  });

  const autores = [...new Set(filtrados.map((l: any) => l.actor_user_id).filter(Boolean))];
  const nomes = new Map<string, string>();
  if (autores.length) {
    const { data: perfis } = await sb.from("profiles").select("id, nome").in("id", autores);
    for (const p of perfis ?? []) nomes.set(p.id, p.nome ?? "—");
  }

  return filtrados.map((l: any) => {
    const m = (l.metadata ?? {}) as any;
    return {
      id: l.id,
      em: l.created_at,
      acao: acaoLegivel(l.action),
      autor: nomes.get(l.actor_user_id) ?? "Usuário não identificado",
      item: m.item_id ? rotuloItem.get(m.item_id) ?? null : null,
      detalhe: m.motivo ?? m.justificativa ?? m.acrescimo_segundos
        ? String(m.motivo ?? m.justificativa ?? `${m.acrescimo_segundos}s adicionais`)
        : null,
    };
  });
}

export async function obterDispositivos(assembleiaId: string) {
  const sb = await admin();
  const assembleia = await carregarAssembleia(assembleiaId);
  const limite = (assembleia.limite_procuracoes_por_outorgado ?? 0) + 1;

  const { data: votos } = await sb
    .from("assembleia_votos")
    .select("device_hash, unidade_id, unidade:unidades(bloco, numero)")
    .eq("assembleia_id", assembleiaId)
    .is("invalidado_em", null);

  const grupos = new Map<string, Map<string, string>>();
  for (const v of votos ?? []) {
    const chave = (v as any).device_hash || "sem impressão";
    if (!grupos.has(chave)) grupos.set(chave, new Map());
    if ((v as any).unidade_id) {
      grupos.get(chave)!.set((v as any).unidade_id, rotuloUnidade((v as any).unidade));
    }
  }

  return [...grupos.entries()]
    .map(([hash, unidades]) => ({
      hash,
      total: unidades.size,
      unidades: [...unidades.values()],
      acimaDoEsperado: unidades.size > limite,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function verificarIntegridade(assembleiaId: string) {
  const sb = await admin();
  const { data, error } = await sb.rpc("assembleia_verificar_integridade", { p_assembleia_id: assembleiaId });
  if (error) throw new Error(error.message);
  const linha = (Array.isArray(data) ? data[0] : data) as any;
  return {
    integra: !!linha?.integra,
    totalVotos: Number(linha?.total_votos ?? 0),
    sequenciaQuebrada: linha?.sequencia_quebrada != null ? Number(linha.sequencia_quebrada) : null,
    votoId: linha?.voto_id ?? null,
    verificadoEm: new Date().toISOString(),
  };
}

/* ------------------------- Exportações ------------------------- */

export async function csvVotos(assembleiaId: string, itemId?: string | null) {
  const sb = await admin();
  const { data: itens } = await sb
    .from("assembleia_itens")
    .select("id, ordem, titulo, secreto")
    .eq("assembleia_id", assembleiaId)
    .order("ordem");

  const alvo = (itens ?? []).filter((i: any) => !itemId || i.id === itemId);
  const linhas: (string | number | null)[][] = [];

  for (const item of alvo) {
    const { linhas: registros } = await obterRegistroVotos(assembleiaId, item.id);
    for (const r of registros) {
      linhas.push([
        `Item ${item.ordem} — ${item.titulo}`,
        item.secreto ? carimbo(r.criadoEm, true) : carimbo(r.criadoEm),
        item.secreto ? "(item secreto)" : r.unidade ?? "",
        r.tipo === "tentativa" ? "RECUSADO" : r.invalidado ? `${r.opcao} (anulado)` : r.opcao ?? "",
        r.peso ?? "",
        r.baseCalculo ?? "",
        r.origem,
        r.ipMascarado,
        agenteResumido(r.agente),
        r.recibo ?? "tentativa registrada",
        r.tipo === "tentativa" ? r.motivo ?? "" : r.invalidadoMotivo ?? "",
      ]);
    }
  }

  return montarCsv(
    ["Item", "Carimbo", "Unidade", "Opção", "Peso", "Base de cálculo", "Origem", "IP", "Agente", "Recibo", "Observação"],
    linhas,
  );
}

export async function csvPresencas(assembleiaId: string) {
  const { sessoes, presencas } = await obterPresencas(assembleiaId, null);
  const ordemSessao = new Map(sessoes.map((s: any) => [s.id, s.ordem]));
  return montarCsv(
    ["Sessão", "Unidade", "Tipo", "Representante", "Entrada", "Saída", "Origem"],
    presencas.map((p) => [
      `Sessão ${ordemSessao.get(p.sessaoId) ?? "—"}`,
      p.unidade,
      p.tipo,
      p.representante ?? "",
      carimbo(p.entrada),
      p.saida ? carimbo(p.saida) : "",
      p.origem,
    ]),
  );
}

export async function csvTentativas(assembleiaId: string) {
  const tentativas = await obterTentativas(assembleiaId);
  return montarCsv(
    ["Carimbo", "Motivo", "Item", "Unidade", "IP", "Agente"],
    tentativas.map((t) => [
      carimbo(t.criadoEm),
      t.motivo,
      t.item ? `Item ${t.item.ordem} — ${t.item.titulo}` : "",
      t.unidade ?? "",
      t.ipMascarado,
      agenteResumido(t.agente),
    ]),
  );
}

export async function dadosRelatorio(assembleiaId: string) {
  const sb = await admin();
  const assembleia = await carregarAssembleia(assembleiaId);

  const [{ data: sessoes }, { data: habilitacoes }, { data: itens }, { data: ata }] = await Promise.all([
    sb.from("assembleia_sessoes").select("*").eq("assembleia_id", assembleiaId).order("ordem"),
    sb.from("assembleia_habilitacoes").select("apta, motivo_bloqueio").eq("assembleia_id", assembleiaId),
    sb
      .from("assembleia_itens")
      .select("*, opcoes:assembleia_opcoes(id, rotulo), resultados:assembleia_resultados(*)")
      .eq("assembleia_id", assembleiaId)
      .order("ordem"),
    sb
      .from("ata_versoes")
      .select("hash_publicacao, publicada_em, numero")
      .eq("assembleia_id", assembleiaId)
      .not("publicada_em", "is", null)
      .order("publicada_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const aptas = (habilitacoes ?? []).filter((h: any) => h.apta).length;
  const inaptas = (habilitacoes ?? []).length - aptas;
  const bloqueios = new Map<string, number>();
  for (const h of habilitacoes ?? []) {
    if (h.apta) continue;
    const m = motivoLegivel(h.motivo_bloqueio ?? "motivo não informado");
    bloqueios.set(m, (bloqueios.get(m) ?? 0) + 1);
  }

  const { presencas } = await obterPresencas(assembleiaId, null);
  const presencaPorSessao = (sessoes ?? []).map((s: any) => ({
    ordem: s.ordem,
    inicio: s.data_hora_inicio,
    fim: s.data_hora_fim,
    local: s.local,
    total: presencas.filter((p) => p.sessaoId === s.id).length,
  }));

  const tentativas = await obterTentativas(assembleiaId);
  const tentativasPorMotivo = new Map<string, number>();
  for (const t of tentativas) tentativasPorMotivo.set(t.motivo, (tentativasPorMotivo.get(t.motivo) ?? 0) + 1);

  const itensRelatorio: any[] = [];
  for (const item of itens ?? []) {
    const resultado = (item as any).resultados?.[0] ?? null;
    const { data: votos } = await sb
      .from("assembleia_votos")
      .select("recibo, opcao_id")
      .eq("item_id", (item as any).id)
      .is("invalidado_em", null)
      .order("recibo");
    const rotulos = new Map(((item as any).opcoes ?? []).map((o: any) => [o.id, o.rotulo]));
    const totais = new Map<string, number>();
    for (const v of votos ?? []) {
      const r = rotulos.get((v as any).opcao_id) ?? "—";
      totais.set(r as string, (totais.get(r as string) ?? 0) + 1);
    }
    itensRelatorio.push({
      ordem: (item as any).ordem,
      titulo: (item as any).titulo,
      secreto: (item as any).secreto,
      frase: resultado ? descreverResultado(item, resultado) : "Item sem apuração registrada.",
      quorumExigido: resultado?.quorum_exigido ?? null,
      quorumAtingido: resultado?.quorum_atingido ?? null,
      totais: [...totais.entries()].map(([opcao, total]) => ({ opcao, total })),
      recibos: (votos ?? []).map((v: any) => ({ recibo: v.recibo, opcao: rotulos.get(v.opcao_id) ?? "—" })),
    });
  }

  const integridade = await verificarIntegridade(assembleiaId);

  return {
    condominio: {
      nome: assembleia.condominio?.nome ?? "—",
      cnpj: assembleia.condominio?.cnpj ?? null,
      endereco: assembleia.condominio?.endereco ?? null,
      cidade: [assembleia.condominio?.cidade, assembleia.condominio?.uf].filter(Boolean).join("/") || null,
    },
    assembleia: {
      titulo: assembleia.titulo,
      tipo: assembleia.tipo,
      codigo: assembleia.codigo_publico,
      dataHora: assembleia.data_hora,
      local: assembleia.local,
      modalidade: assembleia.modalidade,
    },
    sessoes: presencaPorSessao,
    habilitacao: {
      aptas,
      inaptas,
      bloqueios: [...bloqueios.entries()].map(([motivo, total]) => ({ motivo, total })),
    },
    itens: itensRelatorio,
    tentativas: [...tentativasPorMotivo.entries()].map(([motivo, total]) => ({ motivo, total })),
    integridade,
    ata: ata ? { numero: (ata as any).numero, hash: (ata as any).hash_publicacao, publicadaEm: (ata as any).publicada_em } : null,
  };
}
