/**
 * Leitor determinístico da SEÇÃO DESCRITIVA de uma convenção condominial.
 *
 * A fonte de verdade não é o quadro da NBR 12721 (que vem depois, no memorial),
 * e sim as primeiras páginas, onde cada unidade — ou grupo de unidades com as
 * mesmas medidas — é descrita em prosa, seguida de linhas rotuladas em caixa
 * alta com preenchimento por pontos:
 *
 *   A unidade autônoma de N.º 601A possui ... 4 (quatro) vagas de garagem ...
 *   ÁREA REAL PRIVATIVA.............................315,50 m².
 *   ÁREA REAL DE USO COMUM..........................178,07 m².
 *   ÁREA REAL TOTAL.................................543,57 m².
 *   ÁREA EQUIVALENTE DE CONSTRUÇÃO..................432,90 m².
 *   FRAÇÃO IDEAL....................................1,9956%
 *
 * Tudo aqui é regex e aritmética: a interpretação NÃO consome token de IA.
 */

export type RolArtigo2 = {
  total_declarado: number | null;
  identificadores: string[];
  trecho: string;
};

export type BlocoDescritivo = {
  indice: number;
  identificadores: string[];
  frase: string;
  corpo: string;
  area_privativa: number | null;
  area_comum: number | null;
  area_total: number | null;
  area_equivalente: number | null;
  fracao_ideal: number | null;
  vagas: number | null;
};

export type UnidadeDescritiva = {
  identificador: string;
  numero: string;
  bloco: string | null;
  bloco_descritivo: number;
  area_privativa: number | null;
  area_comum: number | null;
  area_total: number | null;
  area_equivalente: number | null;
  fracao_ideal: number | null;
  vagas: number | null;
  frase: string;
  corpo: string;
};

export type Conferencia = {
  regra: string;
  ok: boolean;
  valor?: number | null;
  detalhe?: string;
  unidades?: string[];
};

export type BalancoDescritivo = {
  identificadores_no_rol: number;
  blocos_descritivos: number;
  unidades_apos_expansao: number;
  casadas_com_o_rol: number;
  nao_lidas: number;
  soma_fracoes: number;
  fracao_equivalente_ok: number;
  total_vagas_ok: number;
  constante_vaga: number | null;
  fecha: boolean;
};

/** O que aconteceu na tentativa de leitura descritiva — registrada SEMPRE. */
export type TentativaDescritiva = {
  rol_localizado: boolean;
  identificadores_no_rol: number;
  blocos_descritivos: number;
  unidades_apos_expansao: number;
  com_area_privativa: number;
  com_fracao_ideal: number;
  soma_fracoes: number;
  escala_aplicada: string;
  soma_ok: boolean;
  caminho_usado: "secao_descritiva" | "censo_de_linhas";
  motivo_descarte: string | null;
  amostras?: Array<{ termo: string; ocorrencias: string[] }>;
};

export type LeituraDescritiva = {
  rol: RolArtigo2 | null;
  blocos: BlocoDescritivo[];
  unidades: UnidadeDescritiva[];
  conferencias: Conferencia[];
  balanco: BalancoDescritivo;
  faltando: string[];
  sobrando: string[];
  duplicadas: string[];
  pendentes: string[];
  escala_fracao: string;
  regras_aplicadas: string[];
  vagas_declaradas: number | null;
  soma_ok: boolean;
  tentativa: Omit<TentativaDescritiva, "caminho_usado">;
  ok: boolean;
};


// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

/** Prosa não tem linha: junta quebras, desfaz hifenização e colapsa espaços. */
export function normalizarProsa(texto: string) {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/-\n(?=[a-zà-ú])/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ");
}

export function numeroPtBr(bruto: string | null | undefined): number | null {
  if (!bruto) return null;
  const limpo = bruto.trim().replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

const mediana = (valores: number[]) => {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : (ordenados[meio - 1] + ordenados[meio]) / 2;
};

// ---------------------------------------------------------------------------
// 1. O rol do Artigo 2 é o censo
// ---------------------------------------------------------------------------

/**
 * O parêntese com o número por extenso é OPCIONAL — no Altavista o rol é
 * "totalizando 56 unidades autônomas, assim distribuídas: Bloco A :101A...".
 * Aceita também "compõe-se de", "é composto de", "assim discriminadas" etc.
 */
export const REGEX_ROL =
  /(?:totalizando|comp[õo]e[m]?-se\s+de|[ée]\s+composto\s+(?:de|por)|num?\s+total\s+de|no\s+total\s+de|perfazendo)\s+(\d+)(?:\s*\([^)]*\))?\s*(?:apartamentos?|unidades?(?:\s+aut[oôó]nomas?)?|casas?|salas?|lojas?)[^.]{0,240}?(?:assim\s+distribu[ií]d[oa]s?|assim\s+discriminad[oa]s?|assim\s+descrit[oa]s?|assim\s+dispost[oa]s?|a\s+saber)\s*:?/i;

const REGEX_ROL_GLOBAL = new RegExp(REGEX_ROL.source, "gi");

function identificadoresDoCorpo(corpo: string) {
  const identificadores: string[] = [];
  let blocoAtual: string | null = null;
  const token = /(?:bloco|torre|quadra)\s*:?\s*([A-Za-z0-9]{1,3})\s*:?|(\d{2,5})\s*([A-Za-z])?(?![\d.,])/gi;
  for (let t = token.exec(corpo); t; t = token.exec(corpo)) {
    if (t[1]) {
      blocoAtual = t[1].toUpperCase();
      continue;
    }
    const numero = t[2];
    if (!numero) continue;
    const bloco = (t[3] ?? blocoAtual ?? "").toUpperCase();
    identificadores.push(`${numero}${bloco}`);
  }
  return [...new Set(identificadores)];
}

export function extrairRolArtigo2(prosa: string): RolArtigo2 | null {
  REGEX_ROL_GLOBAL.lastIndex = 0;
  const candidatos: RolArtigo2[] = [];
  for (let m = REGEX_ROL_GLOBAL.exec(prosa); m; m = REGEX_ROL_GLOBAL.exec(prosa)) {
    const inicio = m.index + m[0].length;
    let corpo = prosa.slice(inicio, inicio + 4000);
    const corte = /\bArt(?:igo)?\.?\s*\d|\bPar[áa]grafo\b|\bunidades?\s+aut[oôó]nomas?\s+de\s+N/i.exec(
      corpo,
    );
    if (corte) corpo = corpo.slice(0, corte.index);
    candidatos.push({
      total_declarado: Number(m[1]) || null,
      identificadores: identificadoresDoCorpo(corpo),
      trecho: m[0] + corpo,
    });
  }
  if (candidatos.length === 0) return null;
  // Prefere a frase seguida da lista longa: é o rol de verdade, não uma menção.
  const longos = candidatos.filter((c) => c.identificadores.length > 10);
  const pool = longos.length ? longos : candidatos;
  return [...pool].sort((a, b) => b.identificadores.length - a.identificadores.length)[0];
}


// ---------------------------------------------------------------------------
// 2. Segmentar por bloco descritivo
// ---------------------------------------------------------------------------

const REGEX_SINGULAR =
  /A\s+unidade\s+aut[oô]noma\s+de\s+N\.?\s*[º°o]?\s*([0-9]{1,5}\s*[A-Z]?)\s+possui/gi;
const REGEX_PLURAL =
  /As\s+unidades\s+aut[oô]nomas\s+de\s+N\.?\s*[º°o]?\s*(.+?)\s+possuem/gi;

export function expandirIdentificadores(lista: string): string[] {
  return lista
    .split(/,|\se\s/i)
    .map((parte) => parte.trim())
    .map((parte) => /^n?\.?\s*[º°o]?\s*([0-9]{1,5})\s*([A-Za-z])?$/i.exec(parte))
    .filter((m): m is RegExpExecArray => Boolean(m))
    .map((m) => `${m[1]}${(m[2] ?? "").toUpperCase()}`);
}

const ROTULOS: Array<[keyof BlocoDescritivo, RegExp]> = [
  ["area_privativa", /[ÁA]REA\s+REAL\s+PRIVATIVA[\s.]*([\d.,]+)\s*m/i],
  ["area_comum", /[ÁA]REA\s+REAL\s+DE\s+USO\s+COMUM[\s.]*([\d.,]+)\s*m/i],
  ["area_total", /[ÁA]REA\s+REAL\s+TOTAL[\s.]*([\d.,]+)\s*m/i],
  ["area_equivalente", /[ÁA]REA\s+EQUIVALENTE\s+DE\s+CONSTRU[ÇC][ÃA]O[\s.]*([\d.,]+)\s*m/i],
];
const REGEX_FRACAO = /FRA[ÇC][ÃA]O\s+IDEAL[\s.]*([\d.,]+)\s*(%)?/i;
const REGEX_VAGAS =
  /(\d+)\s*\((?:uma?|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez)\)\s*vagas?\s+de\s+garagem/i;
export const REGEX_CAPACIDADE = /capacidade\s+para\s+(\d+)/i;

export function segmentarBlocosDescritivos(prosa: string): BlocoDescritivo[] {
  type Marca = { inicio: number; fim: number; ids: string[] };
  const marcas: Marca[] = [];
  for (const re of [REGEX_SINGULAR, REGEX_PLURAL]) {
    re.lastIndex = 0;
    for (let m = re.exec(prosa); m; m = re.exec(prosa)) {
      const ids = expandirIdentificadores(m[1]);
      if (ids.length === 0) continue;
      marcas.push({ inicio: m.index, fim: m.index + m[0].length, ids });
    }
  }
  marcas.sort((a, b) => a.inicio - b.inicio);

  return marcas.map((marca, i) => {
    const fimBloco = i + 1 < marcas.length ? marcas[i + 1].inicio : prosa.length;
    const corpo = prosa.slice(marca.inicio, fimBloco);
    const frase = prosa.slice(marca.inicio, Math.min(marca.fim + 400, fimBloco));
    const bloco: BlocoDescritivo = {
      indice: i,
      identificadores: marca.ids,
      frase: frase.trim(),
      corpo: corpo.trim(),
      area_privativa: null,
      area_comum: null,
      area_total: null,
      area_equivalente: null,
      fracao_ideal: null,
      vagas: null,
    };
    for (const [campo, re] of ROTULOS) {
      const v = numeroPtBr(re.exec(corpo)?.[1]);
      (bloco[campo] as number | null) = v;
    }
    const f = REGEX_FRACAO.exec(corpo);
    if (f) {
      const valor = numeroPtBr(f[1]);
      bloco.fracao_ideal = valor == null ? null : f[2] ? valor / 100 : valor;
    }
    const v = REGEX_VAGAS.exec(corpo);
    bloco.vagas = v ? Number(v[1]) : null;
    return bloco;
  });
}

// ---------------------------------------------------------------------------
// 3/4. Expansão e as quatro conferências
// ---------------------------------------------------------------------------

function partirIdentificador(id: string) {
  const m = /^(\d{1,5})([A-Za-z0-9]{0,3})$/.exec(id);
  if (!m) return { numero: id, bloco: null as string | null };
  return { numero: m[1], bloco: m[2] ? m[2].toUpperCase() : null };
}

const ESCALAS: Array<{ nome: string; fator: number }> = [
  { nome: "decimal", fator: 1 },
  { nome: "percentual", fator: 1 / 100 },
  { nome: "milesimo", fator: 1 / 1000 },
  { nome: "milionesimo", fator: 1 / 1_000_000 },
];

export function interpretarConvencaoDescritiva(textoBruto: string): LeituraDescritiva {
  const prosa = normalizarProsa(textoBruto);
  const rol = extrairRolArtigo2(prosa);
  const blocos = segmentarBlocosDescritivos(prosa);

  const unidades: UnidadeDescritiva[] = [];
  const duplicadas: string[] = [];
  const vistos = new Set<string>();
  for (const bloco of blocos) {
    for (const id of bloco.identificadores) {
      if (vistos.has(id)) {
        duplicadas.push(id);
        continue;
      }
      vistos.add(id);
      const { numero, bloco: letra } = partirIdentificador(id);
      unidades.push({
        identificador: id,
        numero,
        bloco: letra,
        bloco_descritivo: bloco.indice,
        area_privativa: bloco.area_privativa,
        area_comum: bloco.area_comum,
        area_total: bloco.area_total,
        area_equivalente: bloco.area_equivalente,
        fracao_ideal: bloco.fracao_ideal,
        vagas: bloco.vagas,
        frase: bloco.frase,
        corpo: bloco.corpo,
      });
    }
  }

  // --- escala das frações ----------------------------------------------------
  // Primeiro por VALOR: quando a maioria já está em decimal, o valor solto acima
  // de 1 é percentual cujo "%" o OCR perdeu. Só depois o somatório global decide.
  const regrasAplicadas: string[] = [];
  const comFracao = unidades.filter((u) => u.fracao_ideal != null);
  const menores = comFracao.filter((u) => (u.fracao_ideal ?? 0) < 1).length;
  if (comFracao.length > 0 && menores > comFracao.length / 2) {
    let corrigidas = 0;
    for (const u of comFracao) {
      if ((u.fracao_ideal ?? 0) > 1) {
        u.fracao_ideal = (u.fracao_ideal as number) / 100;
        corrigidas += 1;
      }
    }
    if (corrigidas > 0)
      regrasAplicadas.push(`escala_por_valor: ${corrigidas} fração(ões) acima de 1 divididas por 100`);
  }
  const brutas = unidades.map((u) => u.fracao_ideal).filter((v): v is number => v != null);
  let escala = "decimal";

  if (brutas.length > 0) {
    const soma = brutas.reduce((a, b) => a + b, 0);
    const melhor = ESCALAS.map((e) => ({ e, erro: Math.abs(soma * e.fator - 1) })).sort(
      (a, b) => a.erro - b.erro,
    )[0];
    if (melhor && melhor.e.fator !== 1 && melhor.erro <= 0.005) {
      escala = melhor.e.nome;
      regrasAplicadas.push(`escala_global: ${melhor.e.nome}`);
      for (const u of unidades) {
        if (u.fracao_ideal != null) u.fracao_ideal = u.fracao_ideal * melhor.e.fator;
      }
    }
  }

  const conferencias: Conferencia[] = [];
  const pendentes = new Set<string>();

  // (a) soma das frações = 1
  const somaFracoes = unidades.reduce((t, u) => t + (u.fracao_ideal ?? 0), 0);
  const somaOk = Math.abs(somaFracoes - 1) <= 0.005;
  const medianaFracao = mediana(unidades.map((u) => u.fracao_ideal ?? 0).filter((v) => v > 0));
  conferencias.push({
    regra: "soma_fracoes",
    ok: somaOk,
    valor: Number(somaFracoes.toFixed(6)),
    detalhe: somaOk
      ? `escala ${escala}`
      : `nenhuma escala fecha; frações mais destoantes da mediana (${medianaFracao?.toFixed(6) ?? "-"})`,
    unidades: somaOk
      ? []
      : [...unidades]
          .filter((u) => u.fracao_ideal != null && medianaFracao)
          .sort(
            (a, b) =>
              Math.abs((b.fracao_ideal ?? 0) - (medianaFracao ?? 0)) -
              Math.abs((a.fracao_ideal ?? 0) - (medianaFracao ?? 0)),
          )
          .slice(0, 5)
          .map((u) => u.identificador),
  });

  // (b) fração = área equivalente rateada — conferência POR UNIDADE, 50 ppm
  const somaEquivalente = unidades.reduce((t, u) => t + (u.area_equivalente ?? 0), 0);
  const foraRateio: string[] = [];
  let rateioOk = 0;
  if (somaEquivalente > 0) {
    for (const u of unidades) {
      if (u.area_equivalente == null || u.fracao_ideal == null) continue;
      const calculada = u.area_equivalente / somaEquivalente;
      const desvio = Math.abs(calculada - u.fracao_ideal) / (u.fracao_ideal || 1);
      if (desvio <= 50e-6) rateioOk += 1;
      else {
        foraRateio.push(
          `${u.identificador}: declarada ${(u.fracao_ideal * 100).toFixed(4)}% x calculada ${(calculada * 100).toFixed(4)}%`,
        );
        pendentes.add(u.identificador);
      }
    }
  }
  conferencias.push({
    regra: "fracao_igual_equivalente_rateada",
    ok: foraRateio.length === 0,
    valor: rateioOk,
    detalhe: foraRateio.slice(0, 5).join(" | ") || `${rateioOk} de ${unidades.length}`,
    unidades: foraRateio.map((t) => t.split(":")[0]),
  });

  // (c) total = privativa + comum + vagas x constante DERIVADA (mediana)
  const porVaga = unidades
    .filter((u) => u.area_total != null && u.area_privativa != null && u.area_comum != null && (u.vagas ?? 0) > 0)
    .map((u) => (u.area_total! - u.area_privativa! - u.area_comum!) / u.vagas!);
  const constanteVaga = porVaga.length ? Number((mediana(porVaga) ?? 0).toFixed(2)) : null;
  const foraVaga: string[] = [];
  let vagaOk = 0;
  if (constanteVaga != null) {
    for (const u of unidades) {
      if (u.area_total == null || u.area_privativa == null || u.area_comum == null || !u.vagas)
        continue;
      const esperado = u.area_privativa + u.area_comum + u.vagas * constanteVaga;
      if (Math.abs(esperado - u.area_total) <= 0.02) vagaOk += 1;
      else {
        foraVaga.push(`${u.identificador}: ${u.vagas} vaga(s) — ${u.frase.slice(0, 160)}`);
        pendentes.add(u.identificador);
      }
    }
  }
  conferencias.push({
    regra: "total_igual_privativa_comum_vagas",
    ok: foraVaga.length === 0,
    valor: constanteVaga,
    detalhe:
      foraVaga.slice(0, 3).join(" | ") ||
      `constante derivada ${constanteVaga?.toFixed(2) ?? "-"} m² por vaga; ${vagaOk} de ${unidades.length}`,
    unidades: foraVaga.map((t) => t.split(":")[0]),
  });

  // (d) soma das vagas x capacidade declarada — aviso, nunca bloqueio
  const somaVagas = unidades.reduce((t, u) => t + (u.vagas ?? 0), 0);
  const capacidade = numeroPtBr(REGEX_CAPACIDADE.exec(prosa)?.[1] ?? null);
  conferencias.push({
    regra: "vagas_declaradas",
    ok: capacidade == null || capacidade === somaVagas,
    valor: somaVagas,
    detalhe:
      capacidade == null
        ? "o documento não declara a capacidade do estacionamento"
        : `declarado ${capacidade}, somado ${somaVagas}`,
  });

  // --- casamento com o rol ---------------------------------------------------
  const noRol = new Set(rol?.identificadores ?? []);
  const lidos = new Set(unidades.map((u) => u.identificador));
  const faltando = [...noRol].filter((id) => !lidos.has(id));
  const sobrando = noRol.size ? [...lidos].filter((id) => !noRol.has(id)) : [];
  const casadas = noRol.size ? [...lidos].filter((id) => noRol.has(id)).length : unidades.length;
  conferencias.push({
    regra: "rol_artigo_2",
    ok: noRol.size > 0 && faltando.length === 0 && sobrando.length === 0 && duplicadas.length === 0,
    valor: noRol.size,
    detalhe: noRol.size
      ? `faltando ${faltando.length}, sobrando ${sobrando.length}, duplicadas ${duplicadas.length}`
      : "rol do Artigo 2 não localizado",
    unidades: [...faltando, ...sobrando],
  });

  const semMedida = unidades.filter((u) => u.area_privativa == null || u.fracao_ideal == null);
  for (const u of semMedida) pendentes.add(u.identificador);

  const balanco: BalancoDescritivo = {
    identificadores_no_rol: noRol.size,
    blocos_descritivos: blocos.length,
    unidades_apos_expansao: unidades.length,
    casadas_com_o_rol: casadas,
    nao_lidas: faltando.length + semMedida.length,
    soma_fracoes: Number(somaFracoes.toFixed(6)),
    fracao_equivalente_ok: rateioOk,
    total_vagas_ok: vagaOk,
    constante_vaga: constanteVaga,
    fecha: somaOk && faltando.length === 0 && sobrando.length === 0 && semMedida.length === 0,
  };

  return {
    rol,
    blocos,
    unidades,
    conferencias,
    balanco,
    faltando,
    sobrando,
    duplicadas,
    pendentes: [...pendentes],
    escala_fracao: escala,
    vagas_declaradas: capacidade,
    ok: unidades.length > 0 && somaOk,
  };
}

// ---------------------------------------------------------------------------
// 6. Faixa descritiva — o que precisa de OCR de alta fidelidade
// ---------------------------------------------------------------------------

/**
 * Localiza a faixa de páginas da seção descritiva, a partir do rol do Artigo 2
 * e da primeira ocorrência de "unidade autônoma de N.º". Recebe o texto de cada
 * página (índice 0 = página 1) e devolve o intervalo 1-based, com folga de uma
 * página de cada lado. Devolve null quando não encontra a seção.
 */
export function localizarFaixaDescritiva(paginas: string[]): { inicio: number; fim: number } | null {
  const marcada = paginas.map((p) => {
    const prosa = normalizarProsa(p);
    return (
      /unidade[s]?\s+aut[oô]noma[s]?\s+de\s+N/i.test(prosa) ||
      /[ÁA]REA\s+REAL\s+PRIVATIVA/i.test(prosa) ||
      REGEX_ROL.test(prosa)
    );
  });
  const primeira = marcada.indexOf(true);
  if (primeira < 0) return null;
  const ultima = marcada.lastIndexOf(true);
  return { inicio: Math.max(1, primeira), fim: Math.min(paginas.length, ultima + 2) };
}
