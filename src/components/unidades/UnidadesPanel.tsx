import {
  BalancoExtracao,
  type BalancoLeitura,
  type LinhaOrfa,
  type LinhaPendente,
} from "./BalancoExtracao";
import type {
  BalancoDescritivo,
  Conferencia,
  TentativaDescritiva,
} from "@/lib/convencao-descritiva";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, Users, Loader2, Eye, Sparkles, FileUp, History, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { updateCategoriaCondominio } from "@/lib/condominios.functions";
import {
  listUnidades,
  createUnidade,
  updateUnidade,
  deleteUnidade,
  createCondomino,
  deleteCondomino,
  importUnidadesLote,
  getCondominioMeta,
} from "@/lib/unidades.functions";
import {
  listSugestoesUnidades,
  atualizarStatusSugestao,
  extrairCondominosDeArquivo,
  reprocessarConvencao,
} from "@/lib/unidades-ia.functions";
import {
  getCategoriaMeta,
  normalizeCategoria,
  type CategoriaCondominio,
} from "@/lib/categorias-condominio";
import {
  RevisarUnidadesDialog,
  type UnidadeSugerida,
} from "@/components/unidades/RevisarUnidadesDialog";
import {
  RevisarCondominosDialog,
  type CondominoSugerido,
  type UnidadeRef,
} from "@/components/unidades/RevisarCondominosDialog";
import { HistoricoInfracoesDialog } from "@/components/unidades/HistoricoInfracoesDialog";
import { Card } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TipoUnidade =
  | "apartamento"
  | "casa"
  | "lote"
  | "terreno"
  | "sala_comercial"
  | "loja"
  | "galpao"
  | "vaga_avulsa"
  | "outro";
type TipoCondomino = "proprietario" | "inquilino" | "morador" | "responsavel_legal";

type Condomino = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  tipo: TipoCondomino;
  principal: boolean;
};

type Unidade = {
  id: string;
  bloco: string | null;
  numero: string;
  tipo: TipoUnidade;
  fracao_ideal: number | null;
  area_m2: number | null;
  vagas_garagem: number | null;
  condominos: Condomino[] | null;
};

const EMPTY_UNIDADE = {
  bloco: "",
  numero: "",
  tipo: "apartamento" as TipoUnidade,
  fracao_ideal: "",
  area_m2: "",
  vagas_garagem: "0",
};

export function UnidadesPanel({
  condominioId,
  isOwner,
}: {
  condominioId: string;
  isOwner: boolean;
}) {
  const fetchAll = useServerFn(listUnidades);
  const createFn = useServerFn(createUnidade);
  const updateFn = useServerFn(updateUnidade);
  const deleteFn = useServerFn(deleteUnidade);
  const createCondFn = useServerFn(createCondomino);
  const deleteCondFn = useServerFn(deleteCondomino);
  const importFn = useServerFn(importUnidadesLote);
  const metaFn = useServerFn(getCondominioMeta);
  const listSugestoesFn = useServerFn(listSugestoesUnidades);
  const updateSugestaoFn = useServerFn(atualizarStatusSugestao);
  const extrairCondFn = useServerFn(extrairCondominosDeArquivo);
  const reprocessarFn = useServerFn(reprocessarConvencao);
  const updateCategoriaFn = useServerFn(updateCategoriaCondominio);

  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [form, setForm] = useState({ ...EMPTY_UNIDADE });
  const [saving, setSaving] = useState(false);
  const [openCond, setOpenCond] = useState<Unidade | null>(null);
  const [openImport, setOpenImport] = useState(false);
  const [openView, setOpenView] = useState<Unidade | null>(null);
  const [openHistorico, setOpenHistorico] = useState<Unidade | null>(null);
  const [atualizandoCategoria, setAtualizandoCategoria] = useState(false);
  const [sugestoes, setSugestoes] = useState<
    {
      id: string;
      documento_id: string | null;
      status: "pendente" | "pendente_revisao" | "falhou";
      payload: {
        unidades?: UnidadeSugerida[];
        diagnostico?: {
          observacao?: string | null;
          total_declarado_no_texto?: number | null;
          total_lotes?: number;
          lotes_processados?: number;
          unidades_encontradas?: number;
          unidades_com_fracao?: number;
          unidades_com_area?: number;
          balanco?: BalancoLeitura;
          linhas_nao_lidas?: LinhaPendente[];
          orfas?: LinhaOrfa[];
          balanco_descritivo?: BalancoDescritivo | null;
          tentativa_descritiva?: TentativaDescritiva | null;
          conferencias?: Conferencia[];
          tipologia_detectada?: string | null;
          tipologia_divergente?: {
            cadastrada: string;
            detectada: string;
            mensagem?: string;
          } | null;
          lotes_pendentes?: Array<{ lote: number; motivo: string; texto?: string }>;
        };
      };
    }[]
  >([]);
  const [erroExtracao, setErroExtracao] = useState<string | null>(null);
  const [revisarUnidades, setRevisarUnidades] = useState<{
    sugestaoId: string | null;
    unidades: UnidadeSugerida[];
    tipologiaDivergente?: {
      cadastrada: string;
      detectada: string;
      mensagem?: string;
    } | null;
  } | null>(null);
  const [revisarCondominos, setRevisarCondominos] = useState<{
    condominos: CondominoSugerido[];
    unidades: UnidadeRef[];
  } | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [openImportUnificado, setOpenImportUnificado] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaCondominio>("predio");
  const [detalhesLeituraAbertos, setDetalhesLeituraAbertos] = useState<boolean | null>(null);

  async function handleAtualizarCategoria(detectada: string) {
    setAtualizandoCategoria(true);
    try {
      await updateCategoriaFn({
        data: {
          condominioId,
          categoria: detectada as any,
        },
      });
      setCategoria(normalizeCategoria(detectada));
      toast.success(`Categoria do condomínio atualizada para ${detectada}.`);
    } catch (e) {
      console.error("Erro ao atualizar categoria:", e);
      toast.error("Não foi possível atualizar a categoria do condomínio.");
    } finally {
      setAtualizandoCategoria(false);
    }
  }
  const [qtdConvencao, setQtdConvencao] = useState<number | null>(null);
  const [reprocessando, setReprocessando] = useState(false);

  const vocab = getCategoriaMeta(categoria).vocab;

  function refresh() {
    setLoading(true);
    metaFn({ data: { condominioId } })
      .then((m) => {
        const meta = m as { categoria: string; qtdUnidades: number | null };
        setCategoria(normalizeCategoria(meta.categoria));
        setQtdConvencao(meta.qtdUnidades);
      })
      .catch(() => {});
    fetchAll({ data: { condominioId } })
      .then((r) => setUnidades((r as Unidade[]) ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar"))
      .finally(() => setLoading(false));
    listSugestoesFn({ data: { condominioId } })
      .then((rows) => {
        const list =
          (rows as unknown as {
            id: string;
            documento_id: string | null;
            status: "pendente" | "pendente_revisao" | "falhou";
            payload: {
              unidades?: UnidadeSugerida[];
              diagnostico?: {
                observacao?: string | null;
                total_declarado_no_texto?: number | null;
                total_lotes?: number;
                lotes_processados?: number;
                unidades_encontradas?: number;
                unidades_com_fracao?: number;
                unidades_com_area?: number;
                balanco?: BalancoLeitura;
                linhas_nao_lidas?: LinhaPendente[];
                orfas?: LinhaOrfa[];
                balanco_descritivo?: BalancoDescritivo | null;
                tentativa_descritiva?: TentativaDescritiva | null;
                conferencias?: Conferencia[];
                unidades_confianca_alta?: number;
                unidades_pendentes_revisao?: number;
                escala_fracao?: string | null;
                somas_hipoteses?: Record<string, number>;
                lotes_pendentes?: Array<{ lote: number; motivo: string; texto?: string }>;
              };
            };
          }[]) ?? [];
        setSugestoes(list);
        const falha = list.find((item) => item.status === "falhou");
        setErroExtracao(falha?.payload.diagnostico?.observacao ?? null);
      })
      .catch(() => setSugestoes([]));
  }
  useEffect(refresh, [condominioId]);

  const [openReprocessDialog, setOpenReprocessDialog] = useState(false);
  const [paginaInicio, setPaginaInicio] = useState("");
  const [paginaFim, setPaginaFim] = useState("");
  const [progresso, setProgresso] = useState<string | null>(null);

  async function reprocessar(optsReprocessar: { somenteLotesPendentes?: boolean } = {}) {
    setOpenReprocessDialog(false);
    setReprocessando(true);
    const msgInicial = optsReprocessar.somenteLotesPendentes
      ? "Relendo trechos pendentes da convenção…"
      : "Iniciando extração da convenção…";
    setProgresso(msgInicial);
    const t = toast.loading(msgInicial);
    try {
      const pInicio = paginaInicio ? parseInt(paginaInicio, 10) : undefined;
      const pFim = paginaFim ? parseInt(paginaFim, 10) : undefined;

      let r = (await reprocessarFn({ 
        data: { 
          condominioId,
          paginaInicio: pInicio,
          paginaFim: pFim,
          reiniciar: !optsReprocessar.somenteLotesPendentes,
          somenteLotesPendentes: optsReprocessar.somenteLotesPendentes,
        } 
      })) as any;

      let rodadas = 1;
      let semAvanco = 0;
      let anterior = r?.concluidos ?? 0;

      while (!r.concluido && rodadas < 50 && semAvanco < 3) {
        if (r.status === "incompleta" || r.status === "erro_leitura" || r.status === "sem_convencao") {
          break;
        }

        const etapaRotulo =
          r.etapa === "carregamento_e_roteamento"
            ? "Carregando páginas"
            : r.etapa === "segmentacao_e_descritiva"
              ? "Segmentando registros e analisando frações"
              : r.etapa === "leitura_ia"
                ? `Lendo lotes com IA (${r.concluidos}/${r.total || "?"})`
                : r.etapa === "gravacao"
                  ? "Gravando ledger e registros"
                  : `Etapa: ${r.etapa}`;

        const msgProgresso = r.mensagem || `${etapaRotulo}…`;
        setProgresso(msgProgresso);
        toast.loading(msgProgresso, { id: t });

        r = (await reprocessarFn({
          data: {
            condominioId,
            paginaInicio: pInicio,
            paginaFim: pFim,
            reiniciar: false,
            // Só o disparo inicial reconstrói a lista de trechos pendentes; as
            // rodadas seguintes apenas continuam a leitura já em andamento.
            somenteLotesPendentes: false,
          },
        })) as any;


        rodadas += 1;
        if ((r?.concluidos ?? 0) > anterior) {
          anterior = r?.concluidos ?? 0;
          semAvanco = 0;
        } else {
          semAvanco += 1;
        }
      }

      toast.dismiss(t);
      switch (r.status) {
        case "sem_convencao":
          toast.info("Este condomínio não tem convenção enviada.");
          break;
        case "erro_download":
          toast.error(`Não foi possível baixar o arquivo original. ${r.mensagem ?? ""}`);
          break;
        case "erro_leitura":
          toast.error(`Não foi possível ler o conteúdo do arquivo. ${r.mensagem ?? ""}`);
          break;
        case "erro_indexacao":
          toast.error(`Falha ao reindexar os trechos. ${r.mensagem ?? ""}`);
          break;
        case "vazio_extracao":
          toast.warning(
            "Mesmo com OCR/visão o arquivo não devolveu texto legível. Reenvie uma versão de melhor qualidade da convenção.",
          );
          break;
        case "incompleta":
          setErroExtracao(r.mensagem);
          toast.error(r.mensagem);
          break;
        case "sem_unidades":
          toast.warning(
            `Convenção reprocessada, mas a IA não localizou uma lista de ${vocab.unidade.toLowerCase()}s. Confirme se o arquivo enviado é a convenção completa (com quadro de frações/anexos).`,
          );
          refresh();
          break;
        case "pronto_com_pendencias":
          setErroExtracao(null);
          toast.warning(
            r.mensagem ??
              `${r.unidades?.length ?? 0} ${vocab.unidade.toLowerCase()}(s) lida(s), mas alguns trechos não puderam ser lidos.`,
            { duration: 8000 },
          );
          refresh();
          break;
        case "gerada":
          setErroExtracao(null);
          toast.success(
            `${r.unidades.length} ${vocab.unidade.toLowerCase()}(s) identificada(s) após reprocessamento.`,
          );
          refresh();
          break;
        default:
          // A leitura parou sem um desfecho (ex.: rodadas sem avanço). Sem esta
          // mensagem o botão apenas girava e terminava em silêncio.
          setErroExtracao(
            r?.mensagem ??
              "A leitura dos trechos não avançou. Tente novamente em alguns minutos.",
          );
          toast.warning(
            r?.mensagem ??
              "A leitura dos trechos não avançou nesta tentativa. Tente novamente em alguns minutos.",
            { duration: 8000 },
          );
          refresh();
          break;
      }

    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Falha ao reprocessar a convenção");
    } finally {
      setReprocessando(false);
      setProgresso(null);
    }
  }

  async function abrirImportarCondominos(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Arquivo maior que 15 MB.");
      return;
    }
    setExtraindo(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const base64 = btoa(bin);
      const r = (await extrairCondFn({
        data: { condominioId, fileName: file.name, base64 },
      })) as { condominos: CondominoSugerido[]; unidades: UnidadeRef[] };
      if (!r.condominos || r.condominos.length === 0) {
        toast.info("Nenhum condômino foi identificado no arquivo.");
        return;
      }
      setRevisarCondominos({ condominos: r.condominos, unidades: r.unidades });
    } catch (e) {
      console.error("[UnidadesPanel] extrair condôminos falhou", e);
      toast.error(e instanceof Error ? e.message : "Falha ao extrair condôminos");
    } finally {
      setExtraindo(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_UNIDADE, tipo: vocab.tipoPadrao as TipoUnidade });
    setOpenForm(true);
  }

  function openEdit(u: Unidade) {
    setEditing(u);
    setForm({
      bloco: u.bloco ?? "",
      numero: u.numero,
      tipo: u.tipo,
      fracao_ideal: u.fracao_ideal != null ? String(u.fracao_ideal) : "",
      area_m2: u.area_m2 != null ? String(u.area_m2) : "",
      vagas_garagem: String(u.vagas_garagem ?? 0),
    });
    setOpenForm(true);
  }

  async function salvar() {
    if (!form.numero.trim()) {
      toast.error("Informe o número da unidade.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        condominioId,
        bloco: form.bloco.trim() || null,
        numero: form.numero.trim(),
        tipo: form.tipo,
        fracao_ideal: form.fracao_ideal ? Number(form.fracao_ideal) : null,
        area_m2: form.area_m2 ? Number(form.area_m2) : null,
        vagas_garagem: Number(form.vagas_garagem || 0),
      };
      if (editing) {
        await updateFn({ data: { ...payload, id: editing.id } });
        toast.success("Unidade atualizada.");
      } else {
        await createFn({ data: payload });
        toast.success("Unidade criada.");
      }
      setOpenForm(false);
      refresh();
    } catch (e) {
      console.error("[UnidadesPanel] salvar falhou", e);
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function excluir(u: Unidade) {
    if (
      !confirm(`Excluir a unidade ${formatLabel(u, vocab.bloco)} e todos os condôminos vinculados?`)
    )
      return;
    try {
      await deleteFn({ data: { id: u.id } });
      toast.success("Unidade removida.");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao excluir");
    }
  }

  if (loading) {
    return (
      <Card className="app-card p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" /> Carregando unidades...
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isOwner && erroExtracao && (
        <Card className="app-card p-4 border-destructive/40 bg-destructive/5">
          <p className="text-sm font-medium text-destructive">
            Leitura da convenção requer revisão
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{erroExtracao}</p>
        </Card>
      )}

      {isOwner &&
        sugestoes.some(
          (item) => item.status === "pendente" || item.status === "pendente_revisao",
        ) &&
        (() => {
          const sugestao = sugestoes.find(
            (item) => item.status === "pendente_revisao" || item.status === "pendente",
          );
          if (!sugestao) return null;
          const totalUnidades = sugestao.payload.unidades?.length ?? 0;
          const temLotesPendentes = (sugestao.payload.diagnostico?.lotes_pendentes?.length ?? 0) > 0;
          const temTipologiaDivergente = Boolean(sugestao.payload.diagnostico?.tipologia_divergente);
          const deveAbrirAuto = totalUnidades === 0 || temLotesPendentes;
          const mostrarDetalhes = detalhesLeituraAbertos ?? deveAbrirAuto;

          return (
            <Card className="app-card p-4 border-primary/30 bg-primary/5 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {totalUnidades} {vocab.unidade.toLowerCase()}(s) identificada(s) na convenção
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sugestao.status === "pendente_revisao"
                        ? "Campos de alta confiança preenchidos. Revise antes de confirmar."
                        : `Prontas para conferência e importação para ${vocab.unidade.toLowerCase()}s.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() =>
                      setRevisarUnidades({
                        sugestaoId: sugestao.id,
                        unidades: sugestao.payload.unidades ?? [],
                        tipologiaDivergente: sugestao.payload.diagnostico?.tipologia_divergente ?? null,
                      })
                    }
                  >
                    Revisar e importar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await updateSugestaoFn({ data: { id: sugestao.id, status: "descartada" } });
                      setSugestoes((prev) => prev.filter((item) => item.id !== sugestao.id));
                    }}
                  >
                    Descartar
                  </Button>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setDetalhesLeituraAbertos(!mostrarDetalhes)}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium transition-colors"
                >
                  <span>{mostrarDetalhes ? "Ocultar detalhes da leitura" : "Ver detalhes da leitura"}</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${mostrarDetalhes ? "rotate-180" : ""}`} />
                </button>

                {mostrarDetalhes && (
                  <div className="mt-3 space-y-3">
                    {sugestao.payload.diagnostico?.observacao && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {sugestao.payload.diagnostico.observacao}
                      </p>
                    )}

                    {(sugestao.payload.diagnostico?.balanco ||
                      sugestao.payload.diagnostico?.tentativa_descritiva) && (
                      <BalancoExtracao
                        balanco={sugestao.payload.diagnostico.balanco}
                        tentativa={sugestao.payload.diagnostico.tentativa_descritiva}
                        balancoDescritivo={sugestao.payload.diagnostico.balanco_descritivo}
                        conferencias={sugestao.payload.diagnostico.conferencias}
                        naoLidas={sugestao.payload.diagnostico.linhas_nao_lidas}
                        orfas={sugestao.payload.diagnostico.orfas}
                      />
                    )}

                    {temLotesPendentes && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-100">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>
                            {sugestao.payload.diagnostico!.lotes_pendentes!.length} trecho(s) não puderam ser lidos e estão pendentes.
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reprocessando}
                          className="h-7 text-xs border-amber-600/40 hover:bg-amber-500/20 text-amber-950 dark:text-amber-50 font-medium"
                          onClick={() => reprocessar({ somenteLotesPendentes: true })}
                        >
                          {reprocessando && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Reler trechos pendentes
                        </Button>
                      </div>
                    )}

                    {temTipologiaDivergente && (
                      <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-100">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                          <span>
                            {sugestao.payload.diagnostico!.tipologia_divergente!.mensagem ||
                              `Tipologia detectada (${sugestao.payload.diagnostico!.tipologia_divergente!.detectada}) diverge da categoria (${sugestao.payload.diagnostico!.tipologia_divergente!.cadastrada}).`}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={atualizandoCategoria}
                          className="h-7 text-xs border-amber-600/40 hover:bg-amber-500/20 text-amber-950 dark:text-amber-50 font-medium"
                          onClick={() =>
                            handleAtualizarCategoria(
                              sugestao.payload.diagnostico!.tipologia_divergente!.detectada,
                            )
                          }
                        >
                          {atualizandoCategoria && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                          Atualizar a categoria do condomínio para{" "}
                          {sugestao.payload.diagnostico!.tipologia_divergente!.detectada}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })()}

      {progresso && (
        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-3 text-xs font-medium text-primary animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Extração de unidades em andamento…</p>
            <p className="text-muted-foreground mt-0.5">{progresso}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{vocab.unidade}s e Condôminos</h2>
          <p className="text-xs text-muted-foreground">
            {unidades.length} {vocab.unidade.toLowerCase()}(s) cadastrada(s)
            {qtdConvencao != null && ` • convenção prevê ${qtdConvencao}`}
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              disabled={reprocessando}
              onClick={() => setOpenReprocessDialog(true)}
              className="transition-colors"
              title="Baixa a convenção do storage, força OCR/visão quando necessário e extrai as unidades com IA."
            >
              {reprocessando ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Importar unidades da convenção
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={extraindo}
              onClick={() => setOpenImportUnificado(true)}
            >
              {extraindo ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileUp className="h-4 w-4 mr-1" />
              )}
              Importar unidades e condôminos
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Nova unidade
            </Button>
          </div>
        )}
      </div>

      {unidades.length === 0 ? (
        <Card className="app-card p-8 text-center border-dashed">
          <p className="text-sm text-muted-foreground">
            Nenhuma unidade cadastrada.{" "}
            {isOwner && "Use 'Nova unidade' ou 'Importar unidades e condôminos'."}
          </p>
        </Card>
      ) : (
        <Card className="app-card divide-y divide-[var(--landing-rule)]">
          {unidades.map((u) => (
            <div key={u.id} className="p-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenView(u)}
                className="flex-1 min-w-0 text-left hover:bg-muted/30 -m-2 p-2 rounded transition-colors"
                title="Ver detalhes da unidade"
              >
                <p className="font-medium text-primary hover:underline">
                  {formatLabel(u, vocab.bloco)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {labelTipoUnidade(u.tipo)}
                  {u.area_m2 ? ` • ${u.area_m2} m²` : ""}
                  {u.fracao_ideal ? ` • fração ${u.fracao_ideal}` : ""}
                  {u.vagas_garagem ? ` • ${u.vagas_garagem} vaga(s)` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {u.condominos?.length ?? 0} condômino(s)
                </p>
              </button>
              <Button size="sm" variant="ghost" onClick={() => setOpenView(u)}>
                <Eye className="h-4 w-4 mr-1" /> Ver
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpenCond(u)}>
                <Users className="h-4 w-4 mr-1" /> Condôminos
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenHistorico(u)}>
                <History className="h-4 w-4 mr-1" /> Histórico
              </Button>
              {isOwner && (
                <>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(u)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => excluir(u)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </Card>
      )}

      <UnidadeFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        form={form}
        setForm={setForm}
        editing={!!editing}
        saving={saving}
        onSave={salvar}
      />

      {openCond && (
        <CondominosDialog
          unidade={openCond}
          isOwner={isOwner}
          onClose={() => setOpenCond(null)}
          onCreate={async (payload) => {
            await createCondFn({
              data: { ...payload, unidadeId: openCond.id, condominioId },
            });
            refresh();
          }}
          onDelete={async (id) => {
            await deleteCondFn({ data: { id } });
            refresh();
          }}
        />
      )}

      {openImport && (
        <ImportDialog
          onClose={() => setOpenImport(false)}
          onImport={async (linhas) => {
            const r = (await importFn({
              data: { condominioId, linhas: linhas as never },
            })) as {
              unidadesCriadas: number;
              unidadesAtualizadas: number;
              condominosCriados: number;
              erros: { linha: number; mensagem: string }[];
            };
            refresh();
            return r;
          }}
        />
      )}

      {openView && (
        <VisualizarUnidadeDialog
          unidade={openView}
          isOwner={isOwner}
          onClose={() => setOpenView(null)}
          onEdit={() => {
            const u = openView;
            setOpenView(null);
            openEdit(u);
          }}
          onGerenciarCondominos={() => {
            const u = openView;
            setOpenView(null);
            setOpenCond(u);
          }}
        />
      )}

      {openHistorico && (
        <HistoricoInfracoesDialog
          condominioId={condominioId}
          unidadeId={openHistorico.id}
          titulo={formatLabel(openHistorico, vocab.bloco)}
          podeEditar={isOwner}
          onClose={() => setOpenHistorico(null)}
        />
      )}

      {revisarUnidades && (
        <RevisarUnidadesDialog
          sugestoes={revisarUnidades.unidades}
          existentes={unidades.map((u) => ({ bloco: u.bloco, numero: u.numero }))}
          vocab={vocab}
          qtdMaxima={qtdConvencao}
          tipologiaDivergente={revisarUnidades.tipologiaDivergente}
          onAtualizarCategoria={handleAtualizarCategoria}
          onClose={() => setRevisarUnidades(null)}
          onConfirmar={async (linhas, estrategia) => {
            const r = (await importFn({
              data: { condominioId, linhas: linhas as never, estrategiaConflito: estrategia },
            })) as {
              unidadesCriadas: number;
              unidadesAtualizadas: number;
              condominosCriados: number;
              erros: { linha: number; mensagem: string }[];
            };
            if (r.erros.length > 0) {
              throw new Error(
                `Importação incompleta: ${r.erros.length} erro(s). ${r.erros[0]?.mensagem ?? "Revise os dados e tente novamente."}`,
              );
            }
            if (revisarUnidades.sugestaoId) {
              await updateSugestaoFn({
                data: { id: revisarUnidades.sugestaoId, status: "aplicada" },
              });
              setSugestoes((prev) => prev.filter((s) => s.id !== revisarUnidades.sugestaoId));
            }
            toast.success(`${r.unidadesCriadas} nova(s), ${r.unidadesAtualizadas} já existiam.`);
            setRevisarUnidades(null);
            refresh();
          }}
        />
      )}

      {revisarCondominos && (
        <RevisarCondominosDialog
          sugestoes={revisarCondominos.condominos}
          unidades={revisarCondominos.unidades}
          onClose={() => setRevisarCondominos(null)}
          onConfirmar={async (linhas) => {
            const r = (await importFn({
              data: { condominioId, linhas: linhas as never },
            })) as {
              unidadesCriadas: number;
              unidadesAtualizadas: number;
              condominosCriados: number;
              erros: { linha: number; mensagem: string }[];
            };
            toast.success(
              `${r.condominosCriados} condômino(s) importado(s).${
                r.erros.length ? ` ${r.erros.length} erro(s).` : ""
              }`,
            );
            setRevisarCondominos(null);
            refresh();
          }}
        />
      )}

      {openImportUnificado && (
        <Dialog open onOpenChange={(v) => !v && setOpenImportUnificado(false)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Importar unidades e condôminos</DialogTitle>
              <DialogDescription>
                Envie um arquivo com a lista de condôminos (CSV, Excel, PDF, DOCX, DOC ou TXT). As
                unidades são extraídas automaticamente da convenção do condomínio na aba Documentos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <input
                id="upload-import-unificado"
                type="file"
                accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  setOpenImportUnificado(false);
                  await abrirImportarCondominos(f);
                }}
              />
              <Button
                className="w-full"
                disabled={extraindo}
                onClick={() => document.getElementById("upload-import-unificado")?.click()}
              >
                {extraindo ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4 mr-2" />
                )}
                Selecionar arquivo
              </Button>
              <button
                type="button"
                onClick={() => {
                  setOpenImportUnificado(false);
                  setOpenImport(true);
                }}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors block mx-auto"
              >
                Importar via CSV estruturado (avançado)
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {openReprocessDialog && (
        <Dialog open={openReprocessDialog} onOpenChange={setOpenReprocessDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reprocessar Convenção</DialogTitle>
              <DialogDescription>
                Se a extração automática falhou devido à formatação complexa do documento, você pode ajudar a IA informando em quais páginas a lista de unidades se encontra.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Página Inicial (Opcional)</Label>
                  <Input 
                    type="number" 
                    placeholder="Ex: 5" 
                    value={paginaInicio}
                    onChange={(e) => setPaginaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Página Final (Opcional)</Label>
                  <Input 
                    type="number" 
                    placeholder="Ex: 10" 
                    value={paginaFim}
                    onChange={(e) => setPaginaFim(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenReprocessDialog(false)}>Cancelar</Button>
              <Button onClick={() => reprocessar()}>Iniciar Extração</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function formatLabel(u: Unidade, labelBloco = "Bloco") {
  return u.bloco ? `${labelBloco} ${u.bloco} • ${u.numero}` : u.numero;
}

function VisualizarUnidadeDialog({
  unidade,
  isOwner,
  onClose,
  onEdit,
  onGerenciarCondominos,
}: {
  unidade: Unidade;
  isOwner: boolean;
  onClose: () => void;
  onEdit: () => void;
  onGerenciarCondominos: () => void;
}) {
  const condominos = unidade.condominos ?? [];
  const principal = condominos.find((c) => c.principal);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Unidade {formatLabel(unidade)}</DialogTitle>
          <DialogDescription>
            Ficha completa com dados da unidade e condôminos vinculados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 text-sm">
            <Campo label="Bloco" valor={unidade.bloco ?? "—"} />
            <Campo label="Número" valor={unidade.numero} />
            <Campo label="Tipo" valor={labelTipoUnidade(unidade.tipo)} />
            <Campo label="Área" valor={unidade.area_m2 != null ? `${unidade.area_m2} m²` : "—"} />
            <Campo
              label="Fração ideal"
              valor={unidade.fracao_ideal != null ? String(unidade.fracao_ideal) : "—"}
            />
            <Campo
              label="Vagas de garagem"
              valor={unidade.vagas_garagem != null ? String(unidade.vagas_garagem) : "0"}
            />
            <Campo
              label="Condômino principal"
              valor={principal ? principal.nome : "Não definido"}
              colSpan
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Condôminos ({condominos.length})</h3>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={onGerenciarCondominos}>
                  <Users className="h-4 w-4 mr-1" /> Gerenciar
                </Button>
              )}
            </div>
            {condominos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum condômino cadastrado nesta unidade.
              </p>
            ) : (
              <div className="divide-y divide-[var(--landing-rule)] border rounded">
                {condominos.map((c) => (
                  <div key={c.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{c.nome}</p>
                      {c.principal && (
                        <span className="text-[10px] uppercase tracking-wide bg-[color-mix(in_hsl,var(--augusto-gold)_18%,transparent)] text-augusto-green px-1.5 py-0.5 rounded">
                          Principal
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {labelTipoCondomino(c.tipo)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-1">
                      <span>CPF: {c.cpf || "—"}</span>
                      <span>Tel.: {c.telefone || "—"}</span>
                      <span className="col-span-2 truncate">E-mail: {c.email || "—"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          {isOwner && (
            <Button variant="outline" onClick={onEdit}>
              <Pencil className="h-4 w-4 mr-1" /> Editar unidade
            </Button>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, valor, colSpan }: { label: string; valor: string; colSpan?: boolean }) {
  return (
    <div className={colSpan ? "col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{valor}</p>
    </div>
  );
}

function labelTipoUnidade(t: TipoUnidade) {
  const map: Record<TipoUnidade, string> = {
    apartamento: "Apartamento",
    casa: "Casa",
    lote: "Lote",
    terreno: "Terreno",
    sala_comercial: "Sala comercial",
    loja: "Loja",
    galpao: "Galpão",
    vaga_avulsa: "Vaga avulsa",
    outro: "Outro",
  };
  return map[t];
}
function labelTipoCondomino(t: TipoCondomino) {
  const map: Record<TipoCondomino, string> = {
    proprietario: "Proprietário",
    inquilino: "Inquilino",
    morador: "Morador",
    responsavel_legal: "Responsável legal",
  };
  return map[t];
}

function UnidadeFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editing,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: typeof EMPTY_UNIDADE;
  setForm: (f: typeof EMPTY_UNIDADE) => void;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar unidade" : "Nova unidade"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Bloco (opcional)</Label>
            <Input
              value={form.bloco}
              onChange={(e) => setForm({ ...form, bloco: e.target.value })}
            />
          </div>
          <div>
            <Label>Número *</Label>
            <Input
              value={form.numero}
              onChange={(e) => setForm({ ...form, numero: e.target.value })}
              placeholder="101"
            />
          </div>
          <div className="col-span-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm({ ...form, tipo: v as TipoUnidade })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apartamento">Apartamento</SelectItem>
                <SelectItem value="casa">Casa</SelectItem>
                <SelectItem value="lote">Lote</SelectItem>
                <SelectItem value="terreno">Terreno</SelectItem>
                <SelectItem value="sala_comercial">Sala comercial</SelectItem>
                <SelectItem value="loja">Loja</SelectItem>
                <SelectItem value="galpao">Galpão</SelectItem>
                <SelectItem value="vaga_avulsa">Vaga avulsa</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fração ideal</Label>
            <Input
              value={form.fracao_ideal}
              onChange={(e) => setForm({ ...form, fracao_ideal: e.target.value })}
              placeholder="0.012345"
            />
          </div>
          <div>
            <Label>Área (m²)</Label>
            <Input
              value={form.area_m2}
              onChange={(e) => setForm({ ...form, area_m2: e.target.value })}
              placeholder="75.50"
            />
          </div>
          <div>
            <Label>Vagas de garagem</Label>
            <Input
              type="number"
              min={0}
              value={form.vagas_garagem}
              onChange={(e) => setForm({ ...form, vagas_garagem: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CondominosDialog({
  unidade,
  isOwner,
  onClose,
  onCreate,
  onDelete,
}: {
  unidade: Unidade;
  isOwner: boolean;
  onClose: () => void;
  onCreate: (p: {
    nome: string;
    cpf: string | null;
    email: string | null;
    telefone: string | null;
    tipo: TipoCondomino;
    principal: boolean;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    tipo: "proprietario" as TipoCondomino,
    principal: false,
  });
  const [saving, setSaving] = useState(false);

  async function adicionar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        nome: form.nome.trim(),
        cpf: form.cpf.trim() || null,
        email: form.email.trim() || null,
        telefone: form.telefone.trim() || null,
        tipo: form.tipo,
        principal: form.principal,
      });
      setForm({
        nome: "",
        cpf: "",
        email: "",
        telefone: "",
        tipo: "proprietario",
        principal: false,
      });
      toast.success("Condômino adicionado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao adicionar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Condôminos — {formatLabel(unidade)}</DialogTitle>
          <DialogDescription>
            Gerencie proprietários, inquilinos e moradores vinculados a esta unidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(unidade.condominos ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum condômino cadastrado ainda.</p>
          ) : (
            <div className="divide-y divide-[var(--landing-rule)] border rounded">
              {(unidade.condominos ?? []).map((c) => (
                <div key={c.id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {c.nome}{" "}
                      {c.principal && (
                        <span className="text-xs text-augusto-green ml-1">(principal)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {labelTipoCondomino(c.tipo)}
                      {c.email ? ` • ${c.email}` : ""}
                      {c.telefone ? ` • ${c.telefone}` : ""}
                    </p>
                  </div>
                  {isOwner && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={async () => {
                        if (confirm(`Remover ${c.nome}?`)) await onDelete(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwner && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Adicionar condômino</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label>Nome *</Label>
                  <Input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label>E-mail</Label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={form.tipo}
                    onValueChange={(v) => setForm({ ...form, tipo: v as TipoCondomino })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proprietario">Proprietário</SelectItem>
                      <SelectItem value="inquilino">Inquilino</SelectItem>
                      <SelectItem value="morador">Morador</SelectItem>
                      <SelectItem value="responsavel_legal">Responsável legal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.principal}
                      onChange={(e) => setForm({ ...form, principal: e.target.checked })}
                    />
                    Contato principal
                  </label>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button onClick={adicionar} disabled={saving}>
                  {saving ? "Adicionando..." : "Adicionar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (linhas: Record<string, unknown>[]) => Promise<{
    unidadesCriadas: number;
    unidadesAtualizadas: number;
    condominosCriados: number;
    erros: { linha: number; mensagem: string }[];
  }>;
}) {
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const [resultado, setResultado] = useState<{
    unidadesCriadas: number;
    unidadesAtualizadas: number;
    condominosCriados: number;
    erros: { linha: number; mensagem: string }[];
  } | null>(null);

  async function fileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Arquivo CSV grande demais (máximo 2MB).");
      return;
    }
    setCsv(await f.text());
  }

  async function processar() {
    const linhas = parseCSV(csv);
    if (linhas.length === 0) {
      toast.error("Nenhuma linha válida no CSV.");
      return;
    }
    setImporting(true);
    try {
      const r = await onImport(linhas);
      setResultado(r);
      toast.success(
        `Importação concluída: ${r.unidadesCriadas} novas, ${r.unidadesAtualizadas} já existentes, ${r.condominosCriados} condôminos.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar unidades via CSV</DialogTitle>
          <DialogDescription>
            Cabeçalhos aceitos:{" "}
            <code className="text-xs">
              bloco, numero, tipo_unidade, fracao_ideal, area_m2, vagas_garagem, nome, cpf, email,
              telefone, tipo_condomino
            </code>
            . Somente <strong>numero</strong> é obrigatório. Linhas com mesmo bloco+numero atualizam
            a unidade existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Arquivo CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={fileChange} />
          </div>
          <div>
            <Label>Ou cole o conteúdo</Label>
            <textarea
              className="w-full h-40 border rounded p-2 text-xs font-mono"
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={
                "bloco,numero,nome,email,tipo_condomino\nA,101,João Silva,joao@email.com,proprietario"
              }
            />
          </div>

          {resultado && (
            <div className="text-sm space-y-1 border rounded p-3 bg-muted/40">
              <p>
                <strong>{resultado.unidadesCriadas}</strong> unidades criadas,{" "}
                <strong>{resultado.unidadesAtualizadas}</strong> já existiam,{" "}
                <strong>{resultado.condominosCriados}</strong> condôminos adicionados.
              </p>
              {resultado.erros.length > 0 && (
                <details className="text-xs text-red-600">
                  <summary>{resultado.erros.length} erro(s)</summary>
                  <ul className="list-disc pl-5 mt-1">
                    {resultado.erros.slice(0, 20).map((er) => (
                      <li key={er.linha}>
                        Linha {er.linha}: {er.mensagem}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={processar} disabled={importing || !csv.trim()}>
            {importing ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseCSV(txt: string): Record<string, unknown>[] {
  const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const out: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const raw = (cols[idx] ?? "").trim();
      if (!raw) return;
      if (h === "fracao_ideal" || h === "area_m2") obj[h] = Number(raw.replace(",", "."));
      else if (h === "vagas_garagem") obj[h] = parseInt(raw, 10) || 0;
      else obj[h] = raw;
    });
    if (obj.numero) out.push(obj);
  }
  return out;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === sep && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}
