import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Trash2, Plus, Loader2, Sparkles, AlertCircle } from "lucide-react";

export type UnidadeSugerida = {
  bloco: string | null;
  numero: string;
  tipo?: string;
  fracao_ideal: number | null;
  area_m2: number | null;
  vagas_garagem?: number;
  confianca?: "alta" | "media" | "conflito";
  estado?: "lido" | "lido_com_ressalva" | "nao_lido";
  origem?: "rotulo" | "ia" | "manual" | "ausente";
  motivos?: string[];
  trecho_fonte?: string | null;
  fracao_trecho?: string | null;
  area_trecho?: string | null;
  medidas?: Array<{
    campo: string;
    valor_bruto: string;
    escala: string;
    trecho: string;
    pagina?: number | null;
    bloco?: number | null;
  }>;
  medidas_descartadas?: Array<{
    medida: {
      campo: string;
      valor_bruto: string;
      escala: string;
      trecho: string;
    };
    motivo: string;
  }>;
  regras_aplicadas?: string[];
};

function deduplicarMedidasDialog<T extends { campo: string; valor_bruto: string; trecho?: string | null }>(lista: T[]): T[] {
  const vistas = new Set<string>();
  const res: T[] = [];
  for (const m of lista) {
    const key = `${m.campo}|${m.valor_bruto}|${(m.trecho ?? "").trim()}`;
    if (!vistas.has(key)) {
      vistas.add(key);
      res.push(m);
    }
  }
  return res;
}

function deduplicarDescartadasDialog<T extends { medida: { campo: string; valor_bruto: string; trecho?: string | null }; motivo: string }>(lista: T[]): T[] {
  const vistas = new Set<string>();
  const res: T[] = [];
  for (const d of lista) {
    const key = `${d.medida.campo}|${d.medida.valor_bruto}|${(d.medida.trecho ?? "").trim()}|${d.motivo}`;
    if (!vistas.has(key)) {
      vistas.add(key);
      res.push(d);
    }
  }
  return res;
}

type Linha = {
  bloco: string;
  numero: string;
  tipo: string;
  fracao_ideal: string;
  area_m2: string;
  vagas_garagem: string;
  confianca: "alta" | "media" | "conflito";
  estado: "lido" | "lido_com_ressalva" | "nao_lido";
  motivos: string[];
  trecho_fonte: string;
  fracao_trecho: string;
  area_trecho: string;
  medidas: NonNullable<UnidadeSugerida["medidas"]>;
  medidas_descartadas: NonNullable<UnidadeSugerida["medidas_descartadas"]>;
  regrasAplicadas: string[];
};

function toLinha(u: UnidadeSugerida): Linha {
  let estado: Linha["estado"] = "lido";
  if (u.area_m2 == null) {
    estado = "nao_lido";
  } else if (u.fracao_ideal == null) {
    estado = "lido_com_ressalva";
  } else if (u.confianca !== "alta" || (u.medidas_descartadas && u.medidas_descartadas.length > 0)) {
    estado = "lido_com_ressalva";
  }

  const fracaoTrecho =
    u.fracao_trecho ||
    u.medidas?.find((m) => m.campo.includes("fracao") || m.campo.includes("coeficiente"))?.trecho ||
    "";
  const areaTrecho =
    u.area_trecho ||
    u.medidas?.find((m) => m.campo.includes("area"))?.trecho ||
    "";

  return {
    bloco: u.bloco ?? "",
    numero: u.numero ?? "",
    tipo: u.tipo ?? "apartamento",
    fracao_ideal: u.fracao_ideal != null ? String(u.fracao_ideal) : "",
    area_m2: u.area_m2 != null ? String(u.area_m2) : "",
    vagas_garagem: String(u.vagas_garagem ?? 0),
    confianca: u.confianca ?? "media",
    estado,
    motivos: u.motivos && u.motivos.length > 0 ? u.motivos : (u.regras_aplicadas ?? []),
    trecho_fonte: u.trecho_fonte ?? "",
    fracao_trecho: fracaoTrecho,
    area_trecho: areaTrecho,
    medidas: deduplicarMedidasDialog(u.medidas ?? []),
    medidas_descartadas: deduplicarDescartadasDialog(u.medidas_descartadas ?? []),
    regrasAplicadas: u.regras_aplicadas ?? [],
  };
}

export function RevisarUnidadesDialog({
  sugestoes,
  existentes = [],
  vocab = { bloco: "Bloco", numero: "Número", unidade: "Unidade", tipoPadrao: "apartamento" },
  qtdMaxima = null,
  tipologiaDivergente = null,
  onAtualizarCategoria,
  onClose,
  onConfirmar,
}: {
  sugestoes: UnidadeSugerida[];
  existentes?: { bloco: string | null; numero: string }[];
  vocab?: {
    bloco: string;
    numero: string;
    unidade: string;
    tipoPadrao:
      | "apartamento"
      | "casa"
      | "lote"
      | "terreno"
      | "sala_comercial"
      | "loja"
      | "galpao"
      | "outro";
  };
  qtdMaxima?: number | null;
  tipologiaDivergente?: {
    cadastrada: string;
    detectada: string;
    mensagem?: string;
  } | null;
  onAtualizarCategoria?: (detectada: string) => Promise<void>;
  onClose: () => void;
  onConfirmar: (
    linhas: Record<string, unknown>[],
    estrategia: "manter" | "preencher",
  ) => Promise<void>;
}) {
  const [atualizandoCategoria, setAtualizandoCategoria] = useState(false);
  const tipoPadrao = vocab.tipoPadrao;
  const [linhas, setLinhas] = useState<Linha[]>(() => {
    const parseNum = (s: string | null | undefined) => {
      const m = String(s ?? "").match(/\d+/);
      return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
    };
    return sugestoes
      .map((s) => toLinha({ ...s, tipo: s.tipo ?? tipoPadrao }))
      .sort((a, b) => {
        const ba = String(a.bloco ?? "");
        const bb = String(b.bloco ?? "");
        if (ba !== bb) return ba.localeCompare(bb, "pt-BR", { numeric: true });
        const na = parseNum(a.numero);
        const nb = parseNum(b.numero);
        if (na !== nb) return na - nb;
        return String(a.numero ?? "").localeCompare(String(b.numero ?? ""), "pt-BR", {
          numeric: true,
        });
      });
  });
  const [saving, setSaving] = useState(false);
  const [estrategia, setEstrategia] = useState<"manter" | "preencher">("preencher");

  const totalNoRol = linhas.length;
  const totalLidas = linhas.filter((l) => l.estado === "lido").length;
  const totalComRessalva = linhas.filter((l) => l.estado === "lido_com_ressalva").length;
  const totalNaoLidas = linhas.filter((l) => l.estado === "nao_lido").length;
  const somaFracoes = linhas.reduce((acc, l) => {
    const v = l.fracao_ideal ? parseFloat(l.fracao_ideal.replace(",", ".")) : 0;
    return acc + (isNaN(v) ? 0 : v);
  }, 0);
  const formatarFracaoSoma = (valor: number) =>
    valor.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 6 });

  const chaveExistentes = new Set(
    existentes.map((e) => `${(e.bloco ?? "").trim().toLowerCase()}::${e.numero.trim()}`),
  );
  const conflitos = linhas.filter((l) =>
    chaveExistentes.has(`${l.bloco.trim().toLowerCase()}::${l.numero.trim()}`),
  ).length;
  const totalValidas = linhas.filter((l) => l.numero.trim().length > 0).length;
  // Só bloqueia se a convenção declarar um total explícito (> 0).
  // qtdMaxima null ou 0 = "não informado no cadastro" → sem limite.
  const excedeConvencao =
    qtdMaxima != null && qtdMaxima > 0 && totalValidas - conflitos + existentes.length > qtdMaxima;

  function update(i: number, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    setLinhas((prev) => [
      ...prev,
      {
        bloco: "",
        numero: "",
        tipo: tipoPadrao,
        fracao_ideal: "",
        area_m2: "",
        vagas_garagem: "0",
        confianca: "media",
        estado: "nao_lido",
        motivos: ["Inserida manualmente"],
        trecho_fonte: "",
        fracao_trecho: "",
        area_trecho: "",
        medidas: [],
        medidas_descartadas: [],
        regrasAplicadas: [],
      },
    ]);
  }

  function aceitarMedidaRejeitada(linhaIndex: number, rejIndex: number) {
    setLinhas((prev) =>
      prev.map((l, idx) => {
        if (idx !== linhaIndex) return l;
        const rej = l.medidas_descartadas[rejIndex];
        if (!rej) return l;

        const campo = rej.medida.campo.toLowerCase();
        const numStr = rej.medida.valor_bruto;
        const patch: Partial<Linha> = {
          medidas_descartadas: l.medidas_descartadas.filter((_, rIdx) => rIdx !== rejIndex),
          medidas: [...l.medidas, { ...rej.medida, pagina: null, bloco: null }],
        };

        if (campo.includes("fracao") || campo.includes("coeficiente")) {
          patch.fracao_ideal = numStr;
          patch.fracao_trecho = rej.medida.trecho;
        } else if (campo.includes("area")) {
          patch.area_m2 = numStr;
          patch.area_trecho = rej.medida.trecho;
        } else if (campo.includes("vaga")) {
          patch.vagas_garagem = numStr;
        }

        if (l.estado === "nao_lido") {
          patch.estado = "lido_com_ressalva";
        }

        return { ...l, ...patch };
      }),
    );
    toast.success("Medida aceita com sucesso.");
  }

  async function confirmar() {
    const validas = linhas.filter((l) => l.numero.trim().length > 0);
    if (validas.length === 0) {
      toast.error("Adicione ao menos uma unidade com número.");
      return;
    }
    setSaving(true);
    try {
      await onConfirmar(
        validas.map((l) => ({
          bloco: l.bloco.trim() || null,
          numero: l.numero.trim(),
          tipo_unidade: l.tipo,
          fracao_ideal: l.fracao_ideal ? Number(l.fracao_ideal.replace(",", ".")) : null,
          area_m2: l.area_m2 ? Number(l.area_m2.replace(",", ".")) : null,
          vagas_garagem: Number(l.vagas_garagem || 0),
        })),
        estrategia,
      );
    } catch (e) {
      console.error("[RevisarUnidades] falhou", e);
      toast.error(e instanceof Error ? e.message : "Falha ao importar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Revisar unidades extraídas da convenção
          </DialogTitle>
          <DialogDescription>
            A IA identificou {sugestoes.length} {vocab.unidade.toLowerCase()}(s). Confira, edite ou
            remova antes de importar.
          </DialogDescription>
          <div className="mt-2 px-3 py-1.5 rounded-md bg-muted/60 border text-xs font-mono font-medium flex flex-wrap items-center gap-1.5 text-foreground">
            <span className="font-semibold text-primary">{totalNoRol} no rol</span>
            <span>·</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{totalLidas} lidas</span>
            <span>·</span>
            <span className={totalComRessalva > 0 ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-muted-foreground"}>
              {totalComRessalva} com ressalva
            </span>
            <span>·</span>
            <span className={totalNaoLidas > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
              {totalNaoLidas} não lidas
            </span>
            <span>·</span>
            <span>
              soma das frações <strong className="font-bold">{formatarFracaoSoma(somaFracoes)}</strong>
            </span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {tipologiaDivergente && (
            <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-100">
              <div className="flex items-start gap-2 max-w-xl">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Tipologia divergente detectada na convenção</p>
                  <p className="mt-0.5 text-muted-foreground dark:text-amber-200/80">
                    {tipologiaDivergente.mensagem ||
                      `A convenção aparenta ser de "${tipologiaDivergente.detectada}", mas o condomínio está cadastrado como "${tipologiaDivergente.cadastrada}".`}
                  </p>
                </div>
              </div>
              {onAtualizarCategoria && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={atualizandoCategoria}
                  className="h-8 text-xs font-medium border-amber-600/40 hover:bg-amber-500/20 text-amber-950 dark:text-amber-50 shrink-0"
                  onClick={async () => {
                    setAtualizandoCategoria(true);
                    try {
                      await onAtualizarCategoria(tipologiaDivergente.detectada);
                    } finally {
                      setAtualizandoCategoria(false);
                    }
                  }}
                >
                  {atualizandoCategoria ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : null}
                  Atualizar a categoria do condomínio para {tipologiaDivergente.detectada}
                </Button>
              )}
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[80px_90px_130px_140px_120px_70px_40px] gap-2 pb-2 text-xs font-medium text-muted-foreground border-b sticky top-0 bg-background z-10">
              <span>{vocab.bloco}</span>
              <span>{vocab.numero}*</span>
              <span>Tipo</span>
              <span>Fração ideal</span>
              <span>Área m²</span>
              <span>Vagas</span>
              <span />
            </div>
            <div className="divide-y divide-[var(--landing-rule)]">
              {linhas.map((l, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[80px_90px_130px_140px_120px_70px_40px] gap-2 py-2 items-start"
                >
                  <Input
                    value={l.bloco}
                    onChange={(e) => update(i, { bloco: e.target.value })}
                    className="h-9"
                  />
                  <Input
                    value={l.numero}
                    onChange={(e) => update(i, { numero: e.target.value })}
                    className="h-9"
                  />
                  <select
                    value={l.tipo}
                    onChange={(e) => update(i, { tipo: e.target.value })}
                    className="h-9 border rounded-md px-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                  >
                    <option value="apartamento">Apartamento</option>
                    <option value="casa">Casa</option>
                    <option value="lote">Lote</option>
                    <option value="terreno">Terreno</option>
                    <option value="sala_comercial">Sala comercial</option>
                    <option value="loja">Loja</option>
                    <option value="galpao">Galpão</option>
                    <option value="vaga_avulsa">Vaga avulsa</option>
                    <option value="outro">Outro</option>
                  </select>
                  <div className="space-y-1">
                    <Input
                      value={l.fracao_ideal}
                      onChange={(e) => update(i, { fracao_ideal: e.target.value })}
                      className={`h-9 ${l.fracao_ideal ? "" : "border-destructive/60 bg-destructive/5"}`}
                      placeholder="não identificada"
                      title={
                        l.fracao_ideal
                          ? (l.fracao_trecho ? `Trecho: ${l.fracao_trecho}` : undefined)
                          : "Fração ideal não identificada na convenção — preencha manualmente."
                      }
                    />
                    {l.fracao_trecho ? (
                      <span
                        className="block text-[10px] text-muted-foreground truncate"
                        title={`Trecho fonte: “${l.fracao_trecho}”`}
                      >
                        fonte: “{l.fracao_trecho}”
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    <Input
                      value={l.area_m2}
                      onChange={(e) => update(i, { area_m2: e.target.value })}
                      className={`h-9 ${l.area_m2 ? "" : "border-destructive/60 bg-destructive/5"}`}
                      placeholder="não identificada"
                      title={
                        l.area_m2
                          ? (l.area_trecho ? `Trecho: ${l.area_trecho}` : undefined)
                          : "Área não identificada na convenção — preencha manualmente."
                      }
                    />
                    {l.area_trecho ? (
                      <span
                        className="block text-[10px] text-muted-foreground truncate"
                        title={`Trecho fonte: “${l.area_trecho}”`}
                      >
                        fonte: “{l.area_trecho}”
                      </span>
                    ) : null}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={l.vagas_garagem}
                    onChange={(e) => update(i, { vagas_garagem: e.target.value })}
                    className="h-9"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(i)}
                    className="text-red-500 hover:text-red-600 transition-colors h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="col-span-7 text-xs space-y-1.5 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${
                          l.estado === "lido"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : l.estado === "lido_com_ressalva"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-destructive/15 text-destructive"
                        }`}
                      >
                        {l.estado === "lido"
                          ? "Lida"
                          : l.estado === "lido_com_ressalva"
                            ? "Com ressalva"
                            : "Não lida"}
                      </span>
                      <span
                        className={
                          l.confianca === "conflito"
                            ? "text-destructive font-medium"
                            : l.confianca === "alta"
                              ? "text-primary font-medium"
                              : "text-amber-600 font-medium"
                        }
                      >
                        Confiança {l.confianca}
                      </span>
                      {l.motivos.length > 0 && (
                        <span className="text-muted-foreground">
                          · {l.motivos.join(" · ")}
                        </span>
                      )}
                    </div>

                    {/* Trecho para digitação de não lidas */}
                    {l.trecho_fonte && (l.estado === "nao_lido" || (!l.area_m2 && !l.fracao_ideal)) && (
                      <div className="p-2 rounded bg-muted/40 border border-border/60 text-xs font-mono">
                        <span className="font-semibold text-[11px] text-muted-foreground block mb-0.5">
                          Trecho do registro na convenção (use para digitar os valores acima):
                        </span>
                        <p className="whitespace-pre-wrap text-foreground/90 select-all max-h-24 overflow-y-auto">
                          {l.trecho_fonte}
                        </p>
                      </div>
                    )}

                    {/* Medidas rejeitadas */}
                    {l.medidas_descartadas.length > 0 && (() => {
                      const descartadasIdentidade = l.medidas_descartadas
                        .map((rej, rejIdx) => ({ rej, rejIdx }))
                        .filter(({ rej }) => rej.motivo === "identidade_nao_confere" || rej.motivo.includes("identidade") || rej.motivo.includes("quadro sem indicação"));
                      const outrasDescartadas = l.medidas_descartadas
                        .map((rej, rejIdx) => ({ rej, rejIdx }))
                        .filter(({ rej }) => rej.motivo !== "identidade_nao_confere" && !rej.motivo.includes("identidade") && !rej.motivo.includes("quadro sem indicação"));

                      return (
                        <div className="space-y-1">
                          {outrasDescartadas.map(({ rej, rejIdx }) => (
                            <div
                              key={rejIdx}
                              className="flex items-center justify-between gap-2 p-1.5 px-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <span className="text-amber-900 dark:text-amber-200">
                                  <strong>rejeitada: {rej.motivo}</strong> ({rej.medida.campo.replaceAll("_", " ")} ={" "}
                                  <code>{rej.medida.valor_bruto}</code>)
                                  {rej.medida.trecho ? ` — “${rej.medida.trecho}”` : ""}
                                </span>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => aceitarMedidaRejeitada(i, rejIdx)}
                                className="h-6 px-2 text-[11px] font-medium border-amber-600/40 hover:bg-amber-500/20 text-amber-950 dark:text-amber-50 shrink-0"
                              >
                                aceitar mesmo assim
                              </Button>
                            </div>
                          ))}

                          {descartadasIdentidade.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                Ver candidatos descartados ({descartadasIdentidade.length})
                              </summary>
                              <div className="mt-1 space-y-1 border-l pl-2">
                                {descartadasIdentidade.map(({ rej, rejIdx }) => (
                                  <div
                                    key={rejIdx}
                                    className="flex items-center justify-between gap-2 p-1.5 px-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                      <span className="text-amber-900 dark:text-amber-200">
                                        <strong>rejeitada: {rej.motivo}</strong> ({rej.medida.campo.replaceAll("_", " ")} ={" "}
                                        <code>{rej.medida.valor_bruto}</code>)
                                        {rej.medida.trecho ? ` — “${rej.medida.trecho}”` : ""}
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => aceitarMedidaRejeitada(i, rejIdx)}
                                      className="h-6 px-2 text-[11px] font-medium border-amber-600/40 hover:bg-amber-500/20 text-amber-950 dark:text-amber-50 shrink-0"
                                    >
                                      aceitar mesmo assim
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      );
                    })()}

                    {l.medidas.length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver {l.medidas.length} medida(s) e fontes
                        </summary>
                        <ul className="mt-1 space-y-1 border-l pl-3 text-muted-foreground">
                          {l.medidas.map((m, medidaIndex) => (
                            <li key={`${m.campo}-${medidaIndex}`}>
                              <strong className="text-foreground">{m.campo.replaceAll("_", " ")}:</strong> {m.valor_bruto}
                              {m.pagina ? ` · pág. ${m.pagina}` : ""} — “{m.trecho}”
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {linhas.map((l, i) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">
                      {vocab.unidade} #{i + 1}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        l.estado === "lido"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : l.estado === "lido_com_ressalva"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-destructive/15 text-destructive"
                      }`}
                    >
                      {l.estado === "lido"
                        ? "Lida"
                        : l.estado === "lido_com_ressalva"
                          ? "Com ressalva"
                          : "Não lida"}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove(i)}
                    className="h-7 w-7 text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{vocab.bloco}</Label>
                    <Input
                      value={l.bloco}
                      onChange={(e) => update(i, { bloco: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{vocab.numero}*</Label>
                    <Input
                      value={l.numero}
                      onChange={(e) => update(i, { numero: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      value={l.tipo}
                      onChange={(e) => update(i, { tipo: e.target.value })}
                      className="w-full h-9 border rounded-md px-2 text-sm bg-background"
                    >
                      <option value="apartamento">Apartamento</option>
                      <option value="casa">Casa</option>
                      <option value="lote">Lote</option>
                      <option value="terreno">Terreno</option>
                      <option value="sala_comercial">Sala comercial</option>
                      <option value="loja">Loja</option>
                      <option value="galpao">Galpão</option>
                      <option value="vaga_avulsa">Vaga avulsa</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Fração</Label>
                    <Input
                      value={l.fracao_ideal}
                      onChange={(e) => update(i, { fracao_ideal: e.target.value })}
                      className={`h-9 ${l.fracao_ideal ? "" : "border-destructive/60 bg-destructive/5"}`}
                      placeholder="não identificada"
                    />
                    {l.fracao_trecho ? (
                      <span
                        className="block text-[10px] text-muted-foreground truncate mt-0.5"
                        title={`Trecho fonte: “${l.fracao_trecho}”`}
                      >
                        fonte: “{l.fracao_trecho}”
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-xs">Área m²</Label>
                    <Input
                      value={l.area_m2}
                      onChange={(e) => update(i, { area_m2: e.target.value })}
                      className={`h-9 ${l.area_m2 ? "" : "border-destructive/60 bg-destructive/5"}`}
                      placeholder="não identificada"
                    />
                    {l.area_trecho ? (
                      <span
                        className="block text-[10px] text-muted-foreground truncate mt-0.5"
                        title={`Trecho fonte: “${l.area_trecho}”`}
                      >
                        fonte: “{l.area_trecho}”
                      </span>
                    ) : null}
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Vagas</Label>
                    <Input
                      type="number"
                      min={0}
                      value={l.vagas_garagem}
                      onChange={(e) => update(i, { vagas_garagem: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>

                {l.motivos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Motivo: {l.motivos.join(" · ")}
                  </p>
                )}

                {/* Trecho para digitação de não lidas no mobile */}
                {l.trecho_fonte && (l.estado === "nao_lido" || (!l.area_m2 && !l.fracao_ideal)) && (
                  <div className="p-2 rounded bg-muted/40 border border-border/60 text-xs font-mono">
                    <span className="font-semibold text-[11px] text-muted-foreground block mb-0.5">
                      Trecho do registro na convenção:
                    </span>
                    <p className="whitespace-pre-wrap text-foreground/90 select-all max-h-24 overflow-y-auto">
                      {l.trecho_fonte}
                    </p>
                  </div>
                )}

                {/* Medidas rejeitadas no mobile */}
                {l.medidas_descartadas.length > 0 && (() => {
                  const descartadasIdentidade = l.medidas_descartadas
                    .map((rej, rejIdx) => ({ rej, rejIdx }))
                    .filter(({ rej }) => rej.motivo === "identidade_nao_confere" || rej.motivo.includes("identidade") || rej.motivo.includes("quadro sem indicação"));
                  const outrasDescartadas = l.medidas_descartadas
                    .map((rej, rejIdx) => ({ rej, rejIdx }))
                    .filter(({ rej }) => rej.motivo !== "identidade_nao_confere" && !rej.motivo.includes("identidade") && !rej.motivo.includes("quadro sem indicação"));

                  return (
                    <div className="space-y-1.5 pt-1">
                      {outrasDescartadas.map(({ rej, rejIdx }) => (
                        <div
                          key={rejIdx}
                          className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5"
                        >
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span className="text-amber-900 dark:text-amber-200">
                              <strong>rejeitada: {rej.motivo}</strong> ({rej.medida.campo.replaceAll("_", " ")} ={" "}
                              <code>{rej.medida.valor_bruto}</code>)
                              {rej.medida.trecho ? ` — “${rej.medida.trecho}”` : ""}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => aceitarMedidaRejeitada(i, rejIdx)}
                            className="w-full h-7 text-xs font-medium border-amber-600/40 hover:bg-amber-500/20 text-amber-950 dark:text-amber-50"
                          >
                            aceitar mesmo assim
                          </Button>
                        </div>
                      ))}

                      {descartadasIdentidade.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                            Ver candidatos descartados ({descartadasIdentidade.length})
                          </summary>
                          <div className="mt-1 space-y-1.5 border-l pl-2">
                            {descartadasIdentidade.map(({ rej, rejIdx }) => (
                              <div
                                key={rejIdx}
                                className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5"
                              >
                                <div className="flex items-start gap-1.5">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span className="text-amber-900 dark:text-amber-200">
                                    <strong>rejeitada: {rej.motivo}</strong> ({rej.medida.campo.replaceAll("_", " ")} ={" "}
                                    <code>{rej.medida.valor_bruto}</code>)
                                    {rej.medida.trecho ? ` — “${rej.medida.trecho}”` : ""}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => aceitarMedidaRejeitada(i, rejIdx)}
                                  className="w-full h-7 text-xs font-medium border-amber-600/40 hover:bg-amber-500/20 text-amber-950 dark:text-amber-50"
                                >
                                  aceitar mesmo assim
                                </Button>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={add} className="mt-3 transition-colors">
            <Plus className="h-4 w-4 mr-1" /> Adicionar {vocab.unidade.toLowerCase()}
          </Button>
        </div>

        <div className="border-t pt-4 space-y-3">
          {(conflitos > 0 || excedeConvencao) && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              {conflitos > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium">
                      {conflitos} {vocab.unidade.toLowerCase()}(s) já existem
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Escolha como tratar as duplicatas antes de importar.
                    </p>
                    <div className="mt-2 inline-flex rounded-md border overflow-hidden text-xs">
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setEstrategia("manter")}
                        className={`px-3 py-1.5 transition-colors ${
                          estrategia === "manter"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        Manter existentes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => setEstrategia("preencher")}
                        className={`px-3 py-1.5 border-l transition-colors ${
                          estrategia === "preencher"
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}
                      >
                        Preencher campos vazios
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {excedeConvencao && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  A convenção prevê {qtdMaxima} {vocab.unidade.toLowerCase()}(s). Você está tentando
                  cadastrar mais que isso — ajuste as linhas ou o total no cadastro do condomínio.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="p-0">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={confirmar}
              disabled={saving || linhas.length === 0 || excedeConvencao}
              className="transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando…
                </>
              ) : (
                `Importar ${totalValidas} ${vocab.unidade.toLowerCase()}(s)`
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
