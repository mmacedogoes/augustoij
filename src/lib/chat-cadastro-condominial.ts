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

const STOPWORDS_PT = new Set([
  "de", "da", "do", "das", "dos", "em", "na", "no", "nas", "nos",
  "para", "por", "com", "sem", "sob", "sobre", "que", "uma", "um",
  "uns", "umas", "como", "mais", "mas", "a", "e", "o", "as", "os",
  "ao", "aos", "sr", "sra", "senhor", "senhora", "bloco", "unidade",
  "apto", "apartamento", "casa", "lote", "sala", "loja", "notificacao",
  "notificação", "advertencia", "advertência", "multa", "morador",
  "condomino", "condômino", "infracao", "infração", "solicitar",
  "solicito", "fazer", "faça", "favor", "este", "esta", "nesse", "nesta"
]);

function rotuloUnidade(u: UnidadeRow): string {
  const bloco = (u.bloco ?? "").trim();
  const numero = (u.numero ?? "").trim();
  return [bloco ? `Bloco ${bloco}` : "", numero ? `Unidade ${numero}` : ""]
    .filter(Boolean)
    .join(" — ") || "Unidade sem identificação";
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function calcularScoreUnidade(u: UnidadeRow, texto: string): number {
  if (!texto) return 0;
  let score = 0;
  const t = texto.toLowerCase();
  const numero = (u.numero ?? "").trim().toLowerCase();
  const bloco = (u.bloco ?? "").trim().toLowerCase();

  // 1. Match do número da unidade (ex.: "101", "704")
  if (numero) {
    // Padrão contextual forte: "unidade 101", "apto 101", "apartamento 101", "ap 101", "#101"
    const reContexto = new RegExp(`(?:unidade|apto|apartamento|ap|casa|sala|lote|n[ºo°]?|#)\\s*${escapeRe(numero)}(?:[^0-9a-zà-ú]|$)`, "i");
    if (reContexto.test(t)) {
      score += 200;
    } else {
      // Número isolado como palavra inteira: "101"
      const reNumero = new RegExp(`(?:^|[^0-9a-zà-ú])${escapeRe(numero)}(?:[^0-9a-zà-ú]|$)`, "i");
      if (reNumero.test(t)) {
        score += 100;
      }
    }
  }

  // 2. Match do bloco da unidade (ex.: "Bloco A", "Torre 1")
  if (bloco) {
    if (bloco.length > 2 && !STOPWORDS_PT.has(bloco)) {
      // Bloco com nome longo (ex.: "Jardins", "Norte")
      const reBlocoLongo = new RegExp(`(?:^|[^0-9a-zà-ú])${escapeRe(bloco)}(?:[^0-9a-zà-ú]|$)`, "i");
      if (reBlocoLongo.test(t)) score += 40;
    } else {
      // Bloco curto (ex.: "A", "B", "1", "2") — EXIGE prefixo "bloco", "torre", "ed." para evitar falsos positivos com preposição "a"
      const reBlocoCurto = new RegExp(`(?:bloco|bl\\.?|torre|edif[íi]cio|ed\\.?)\\s*${escapeRe(bloco)}(?:[^0-9a-zà-ú]|$)`, "i");
      if (reBlocoCurto.test(t)) score += 50;
    }
  }

  // 3. Match de condôminos (nome completo ou partes significativas)
  for (const c of u.condominos ?? []) {
    if (c.nome) {
      const nomeCompleto = c.nome.trim().toLowerCase();
      if (nomeCompleto.length >= 4) {
        const reNomeCompleto = new RegExp(`(?:^|[^0-9a-zà-ú])${escapeRe(nomeCompleto)}(?:[^0-9a-zà-ú]|$)`, "i");
        if (reNomeCompleto.test(t)) {
          score += 150;
          continue;
        }
      }
      const partes = nomeCompleto.split(/\s+/).filter((p) => p.length >= 3 && !STOPWORDS_PT.has(p));
      for (const p of partes) {
        const reParte = new RegExp(`(?:^|[^0-9a-zà-ú])${escapeRe(p)}(?:[^0-9a-zà-ú]|$)`, "i");
        if (reParte.test(t)) {
          score += 40;
        }
      }
    }
  }

  return score;
}

/** Unidades citadas na pergunta vêm primeiro ordenadas por relevância; o resto mantém a ordem. */
export function priorizarUnidades(
  unidades: UnidadeRow[],
  pergunta: string,
  max = MAX_UNIDADES,
): { selecionadas: UnidadeRow[]; omitidas: number; citadas: UnidadeRow[] } {
  const comScore = (unidades ?? []).map((u) => ({
    unidade: u,
    score: calcularScoreUnidade(u, pergunta),
  }));

  const citadas = comScore
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.unidade);

  const demais = comScore
    .filter((item) => item.score === 0)
    .map((item) => item.unidade);

  const ordenadas = [...citadas, ...demais];
  return {
    selecionadas: ordenadas.slice(0, max),
    omitidas: Math.max(0, ordenadas.length - max),
    citadas,
  };
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

export type MensagemConversaAnterior = {
  titulo_conversa?: string | null;
  created_at?: string | null;
  papel: string;
  conteudo: string;
};

function dataBr(iso?: string | null): string {
  if (!iso) return "data não informada";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "data não informada"
    : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/**
 * Monta o bloco de resumo de conversas anteriores do condomínio que mencionem
 * notificações, advertências, multas ou infrações.
 */
export function blocoHistoricoConversasCondominio(
  mensagens: MensagemConversaAnterior[] | null | undefined,
): string {
  const lista = mensagens ?? [];
  if (lista.length === 0) return "";

  const itens = lista.slice(0, 10).map((m) => {
    const data = dataBr(m.created_at);
    const titulo = m.titulo_conversa ? `[Conversa: "${m.titulo_conversa}"]` : "";
    const trecho = m.conteudo.slice(0, 300).replace(/\n+/g, " ").trim();
    return `- (${data}) ${titulo}: "${trecho}${m.conteudo.length > 300 ? "…" : ""}"`;
  });

  return `HISTÓRICO DE CONVERSAS E NOTIFICAÇÕES ANTERIORES NESTE CONDOMÍNIO (memória conversacional):\n${itens.join(
    "\n",
  )}\n\n`;
}

/**
 * Bloco de histórico de notificações/infrações das unidades relevantes,
 * usado para que a IA identifique reincidência e aplique a gradação prevista
 * na convenção/regimento/atas.
 */
export function blocoHistoricoInfracoes(
  unidades: UnidadeRow[] | null | undefined,
  infracoes: InfracaoRow[] | null | undefined,
  historicoConversasBlock = "",
): string {
  const lista = infracoes ?? [];
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

  let blocoFormal = "";
  if (linhas.length > 0) {
    blocoFormal = `HISTÓRICO DE NOTIFICAÇÕES E INFRAÇÕES FORMALMENTE REGISTRADAS NO SISTEMA:\n${linhas.join(
      "\n",
    )}\n\n`;
  }

  if (!blocoFormal && !historicoConversasBlock) {
    return `HISTÓRICO DE INFRAÇÕES NESTE CONDOMÍNIO:\nNenhum registro prévio de notificação ou infração foi encontrado no banco de dados para este condomínio/unidade.\n\n`;
  }

  return `${blocoFormal}${historicoConversasBlock}`;
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

  const { selecionadas, omitidas, citadas } = priorizarUnidades(lista, pergunta);

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

  const cabecalhoCondominio = condominio
    ? `CONDOMÍNIO: ${condominio.nome?.trim() ?? "(sem nome)"}${
        enderecoCondominio(condominio) ? ` — ${enderecoCondominio(condominio)}` : ""
      }\n`
    : "";

  // Se houver unidades citadas/relevantes na conversa, foca os modelos nelas primeiro
  const unidadesParaModelos = citadas.length > 0 ? citadas : selecionadas.slice(0, 10);
  const modelos = unidadesParaModelos
    .slice(0, 10)
    .map((u) => `[BLOCO DE ENDEREÇAMENTO — ${rotuloUnidade(u).toUpperCase()}]:\n${montarEnderecamento(u, condominio)}`)
    .join("\n\n---\n\n");

  return `${cabecalhoCondominio}CADASTRO DE UNIDADES E CONDÔMINOS DESTE CONDOMÍNIO (dados fornecidos pelo próprio gestor):\n${linhas.join(
    "\n",
  )}${rodape}\n\nBLOCOS DE ENDEREÇAMENTO PRONTOS POR UNIDADE (utilize EXCLUSIVAMENTE o bloco da unidade solicitada pelo usuário no topo da peça):\n${modelos}\n\n`;
}
