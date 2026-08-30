/**
 * Monta o bloco de "cadastro de unidades e condôminos" injetado no system
 * prompt do chat. Esses dados são necessários para qualificar o destinatário
 * em notificações, advertências e multas (dever legal do condomínio).
 */

export type CondominoRow = {
  nome: string | null;
  cpf: string | null;
  tipo: string | null;
  principal: boolean | null;
  email?: string | null;
  telefone?: string | null;
};

export type UnidadeRow = {
  id?: string | null;
  bloco: string | null;
  numero: string | null;
  tipo?: string | null;
  condominos?: CondominoRow[] | null;
};

export type CondominioInfo = {
  nome?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
};


const MAX_UNIDADES = 60;

function rotuloUnidade(u: UnidadeRow): string {
  const bloco = (u.bloco ?? "").trim();
  const numero = (u.numero ?? "").trim();
  return [bloco ? `Bloco ${bloco}` : "", numero ? `Unidade ${numero}` : ""]
    .filter(Boolean)
    .join(" — ") || "Unidade sem identificação";
}

function tokensUnidade(u: UnidadeRow): string[] {
  const toks: string[] = [];
  const numero = (u.numero ?? "").trim().toLowerCase();
  const bloco = (u.bloco ?? "").trim().toLowerCase();
  if (numero) toks.push(numero);
  if (bloco) toks.push(bloco);
  return toks;
}

/** Unidades citadas na pergunta vêm primeiro; o resto mantém a ordem original. */
export function priorizarUnidades(
  unidades: UnidadeRow[],
  pergunta: string,
  max = MAX_UNIDADES,
): { selecionadas: UnidadeRow[]; omitidas: number } {
  const texto = (pergunta ?? "").toLowerCase();
  const citadas: UnidadeRow[] = [];
  const demais: UnidadeRow[] = [];
  for (const u of unidades) {
    const toks = tokensUnidade(u);
    const citada =
      toks.length > 0 &&
      toks.some((t) => new RegExp(`(^|[^0-9a-zà-ú])${escapeRe(t)}([^0-9a-zà-ú]|$)`, "i").test(texto));
    (citada ? citadas : demais).push(u);
  }
  const ordenadas = [...citadas, ...demais];
  return {
    selecionadas: ordenadas.slice(0, max),
    omitidas: Math.max(0, ordenadas.length - max),
  };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rótulo curto da unidade usado no fallback de endereçamento. */
export function rotuloCurtoUnidade(u: UnidadeRow): string {
  const bloco = (u.bloco ?? "").trim();
  const numero = (u.numero ?? "").trim();
  if (numero && bloco) return `${numero} — Bloco ${bloco}`;
  if (numero) return numero;
  if (bloco) return `Bloco ${bloco}`;
  return "sem identificação";
}

export function enderecoCondominio(c?: CondominioInfo | null): string {
  if (!c) return "";
  const local = [c.cidade?.trim(), c.uf?.trim()].filter(Boolean).join("/");
  return [c.endereco?.trim(), local].filter(Boolean).join(", ");
}

/**
 * Cabeçalho de endereçamento padrão de qualquer peça dirigida à unidade.
 * Sem condômino cadastrado → "Ao(À) Condômino da unidade {unidade}".
 * Nunca inventa nome ou CPF: campos ausentes são simplesmente omitidos.
 */
export function montarEnderecamento(
  unidade: UnidadeRow,
  condominio?: CondominioInfo | null,
): string {
  const pessoas = unidade.condominos ?? [];
  const titular =
    pessoas.find((c) => c.principal && c.nome?.trim()) ??
    pessoas.find((c) => c.nome?.trim()) ??
    null;

  const linhas: string[] = [];
  if (titular?.nome?.trim()) {
    linhas.push(`Ao(À) Sr.(a) ${titular.nome.trim().toUpperCase()}`);
    if (titular.cpf?.trim()) linhas.push(`CPF nº ${titular.cpf.trim()}`);
  } else {
    linhas.push(`Ao(À) Condômino da unidade ${rotuloCurtoUnidade(unidade)}`);
  }

  const bloco = (unidade.bloco ?? "").trim();
  const numero = (unidade.numero ?? "").trim();
  const linhaUnidade = [
    numero ? `Unidade ${numero}` : "",
    bloco ? `Bloco ${bloco}` : "",
  ]
    .filter(Boolean)
    .join(" — ");
  if (linhaUnidade) linhas.push(linhaUnidade);

  const nomeCondominio = condominio?.nome?.trim();
  if (nomeCondominio) linhas.push(nomeCondominio);
  const endereco = enderecoCondominio(condominio);
  if (endereco) linhas.push(endereco);

  return linhas.join("\n");
}

export type InfracaoRow = {
  unidade_id: string;
  tipo: string | null;
  categoria: string | null;
  ocorrido_em?: string | null;
  created_at?: string | null;
  valor_multa?: number | null;
};

function dataBr(iso?: string | null): string {
  if (!iso) return "data não informada";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "data não informada"
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Bloco de histórico de notificações/infrações das unidades relevantes,
 * usado para que a IA identifique reincidência e aplique a gradação prevista
 * na convenção/regimento/atas.
 */
export function blocoHistoricoInfracoes(
  unidades: UnidadeRow[] | null | undefined,
  infracoes: InfracaoRow[] | null | undefined,
): string {
  const lista = infracoes ?? [];
  if (lista.length === 0) return "";
  const porUnidade = new Map<string, UnidadeRow>();
  for (const u of unidades ?? []) if (u.id) porUnidade.set(u.id, u);

  const grupos = new Map<string, InfracaoRow[]>();
  for (const i of lista) {
    const arr = grupos.get(i.unidade_id) ?? [];
    arr.push(i);
    grupos.set(i.unidade_id, arr);
  }

  const linhas: string[] = [];
  for (const [unidadeId, ocorrencias] of grupos) {
    const u = porUnidade.get(unidadeId);
    const rotulo = u ? rotuloUnidade(u) : "Unidade";
    const detalhe = ocorrencias
      .map(
        (o) =>
          `${o.tipo ?? "notificacao"} sobre "${o.categoria ?? "não informado"}" em ${dataBr(
            o.ocorrido_em ?? o.created_at,
          )}${o.valor_multa ? ` (multa R$ ${Number(o.valor_multa).toFixed(2)})` : ""}`,
      )
      .join("; ");
    linhas.push(`- ${rotulo} — ${ocorrencias.length} ocorrência(s): ${detalhe}`);
  }

  return `HISTÓRICO DE NOTIFICAÇÕES E INFRAÇÕES JÁ REGISTRADAS (memória do sistema):\n${linhas.join(
    "\n",
  )}\n\nSe a nova peça tratar de fato da MESMA categoria já registrada para a mesma unidade, trate como REINCIDÊNCIA: aplique a consequência prevista na convenção, no regimento interno ou em deliberação de ata (ex.: advertência → multa → multa agravada), citando a cláusula. Se os documentos do condomínio não previrem a gradação, diga isso expressamente e sugira deliberação — nunca invente penalidade ou valor.\n\n`;
}

/** Formata o bloco final. Retorna "" quando não há cadastro. */
export function blocoCadastroCondominial(
  unidades: UnidadeRow[] | null | undefined,
  pergunta: string,
  condominio?: CondominioInfo | null,
): string {

  const lista = (unidades ?? []).filter(
    (u) => (u.condominos?.length ?? 0) > 0 || u.numero || u.bloco,
  );
  if (lista.length === 0) return "";

  const { selecionadas, omitidas } = priorizarUnidades(lista, pergunta);

  const linhas = selecionadas.map((u) => {
    const pessoas = (u.condominos ?? []).map((c) => {
      const partes = [c.nome?.trim() || "(sem nome cadastrado)"];
      if (c.cpf?.trim()) partes.push(`CPF ${c.cpf.trim()}`);
      if (c.tipo) partes.push(c.tipo);
      if (c.principal) partes.push("titular principal");
      return partes.join(", ");
    });
    const detalhe = pessoas.length > 0 ? pessoas.join(" | ") : "sem condômino cadastrado";
    return `- ${rotuloUnidade(u)}: ${detalhe}`;
  });

  const rodape =
    omitidas > 0
      ? `\n(+${omitidas} unidade(s) não listada(s) aqui — peça a unidade específica se precisar.)`
      : "";

  return `CADASTRO DE UNIDADES E CONDÔMINOS DESTE CONDOMÍNIO (dados fornecidos pelo próprio gestor):\n${linhas.join("\n")}${rodape}\n\n`;
}