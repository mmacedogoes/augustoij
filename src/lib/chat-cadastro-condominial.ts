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
  bloco: string | null;
  numero: string | null;
  tipo?: string | null;
  condominos?: CondominoRow[] | null;
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

/** Formata o bloco final. Retorna "" quando não há cadastro. */
export function blocoCadastroCondominial(
  unidades: UnidadeRow[] | null | undefined,
  pergunta: string,
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