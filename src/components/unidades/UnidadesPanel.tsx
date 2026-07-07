import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, Users, Loader2, Eye, Sparkles, FileUp } from "lucide-react";
import { toast } from "sonner";
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
  detectarUnidadesConvencaoExistente,
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
type TipoCondomino =
  | "proprietario"
  | "inquilino"
  | "morador"
  | "responsavel_legal";

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
  const detectarConvFn = useServerFn(detectarUnidadesConvencaoExistente);
  const reprocessarFn = useServerFn(reprocessarConvencao);

  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [form, setForm] = useState({ ...EMPTY_UNIDADE });
  const [saving, setSaving] = useState(false);
  const [openCond, setOpenCond] = useState<Unidade | null>(null);
  const [openImport, setOpenImport] = useState(false);
  const [openView, setOpenView] = useState<Unidade | null>(null);
  const [sugestoes, setSugestoes] = useState<
    { id: string; documento_id: string | null; payload: { unidades?: UnidadeSugerida[] } }[]
  >([]);
  const [revisarUnidades, setRevisarUnidades] = useState<{
    sugestaoId: string | null;
    unidades: UnidadeSugerida[];
  } | null>(null);
  const [revisarCondominos, setRevisarCondominos] = useState<{
    condominos: CondominoSugerido[];
    unidades: UnidadeRef[];
  } | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const [detectando, setDetectando] = useState(false);
  const [openImportUnificado, setOpenImportUnificado] = useState(false);
  const [categoria, setCategoria] = useState<CategoriaCondominio>("predio");
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
      .then(async (rows) => {
        const list =
          (rows as unknown as {
            id: string;
            documento_id: string | null;
            payload: { unidades?: UnidadeSugerida[] };
          }[]) ?? [];
        setSugestoes(list);
        // Retro-detecção silenciosa (convenções antigas sem sugestão)
        if (list.length === 0) {
          try {
            const r = (await detectarConvFn({ data: { condominioId } })) as {
              status: "sem_convencao" | "ja_processada" | "gerada";
            };
            if (r.status === "gerada") {
              const again = await listSugestoesFn({ data: { condominioId } });
              setSugestoes(
                (again as unknown as {
                  id: string;
                  documento_id: string | null;
                  payload: { unidades?: UnidadeSugerida[] };
                }[]) ?? [],
              );
            }
          } catch (err) {
            console.warn("[UnidadesPanel] detecção retroativa falhou", err);
          }
        }
      })
      .catch(() => setSugestoes([]));
  }
  useEffect(refresh, [condominioId]);

  async function detectarManual() {
    setDetectando(true);
    try {
      const r = (await detectarConvFn({
        data: { condominioId, force: true },
      })) as {
        status: "sem_convencao" | "ja_processada" | "gerada" | "vazio";
        unidades?: UnidadeSugerida[];
      };
      if (r.status === "sem_convencao") {
        toast.info("Nenhuma convenção processada foi encontrada neste condomínio.");
      } else if (r.status === "vazio") {
        toast.warning(
          'A IA não achou unidades no texto atualmente indexado. Use "Reprocessar convenção" para baixar o arquivo original e forçar OCR/visão.',
        );
      } else {
        toast.success(
          `${r.unidades?.length ?? 0} ${vocab.unidade.toLowerCase()}(s) detectada(s) na convenção.`,
        );
        refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao detectar unidades");
    } finally {
      setDetectando(false);
    }
  }

  async function reprocessar() {
    setReprocessando(true);
    const t = toast.loading("Baixando e reinterpretando a convenção com OCR/visão…");
    try {
      const r = (await reprocessarFn({ data: { condominioId } })) as
        | { status: "sem_convencao" }
        | { status: "erro_download"; mensagem?: string }
        | { status: "erro_leitura"; mensagem?: string }
        | { status: "erro_indexacao"; mensagem?: string }
        | { status: "vazio_extracao" }
        | { status: "sem_unidades"; modo: string; chunks: number }
        | {
            status: "gerada";
            unidades: UnidadeSugerida[];
            modo: string;
            chunks: number;
          };
      toast.dismiss(t);
      switch (r.status) {
        case "sem_convencao":
          toast.info("Este condomínio não tem convenção enviada.");
          break;
        case "erro_download":
          toast.error(`Não foi possível baixar o arquivo original. ${r.mensagem ?? ""}`);
          break;
        case "erro_leitura":
          toast.error(
            `Não foi possível ler o conteúdo do arquivo. ${r.mensagem ?? ""}`,
          );
          break;
        case "erro_indexacao":
          toast.error(`Falha ao reindexar os trechos. ${r.mensagem ?? ""}`);
          break;
        case "vazio_extracao":
          toast.warning(
            "Mesmo com OCR/visão o arquivo não devolveu texto legível. Reenvie uma versão de melhor qualidade da convenção.",
          );
          break;
        case "sem_unidades":
          toast.warning(
            `Convenção reprocessada (${r.chunks} trechos, modo: ${r.modo}), mas a IA não localizou uma lista de ${vocab.unidade.toLowerCase()}s. Confirme se o arquivo enviado é a convenção completa (com quadro de frações/anexos).`,
          );
          refresh();
          break;
        case "gerada":
          toast.success(
            `${r.unidades.length} ${vocab.unidade.toLowerCase()}(s) identificada(s) após reprocessamento (${r.modo}).`,
          );
          refresh();
          break;
      }
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Falha ao reprocessar a convenção");
    } finally {
      setReprocessando(false);
    }
  }

  async function abrirImportarCondominos(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo maior que 10 MB.");
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
    setForm({ ...EMPTY_UNIDADE });
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
    if (!confirm(`Excluir a unidade ${formatLabel(u, vocab.bloco)} e todos os condôminos vinculados?`)) return;
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
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" /> Carregando unidades...
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isOwner && sugestoes.length > 0 && (
        <Card className="p-4 border-primary/40 bg-primary/5 flex flex-wrap items-center gap-3 transition-colors">
          <Sparkles className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-medium">
              {sugestoes[0].payload.unidades?.length ?? 0} {vocab.unidade.toLowerCase()}(s)
              detectada(s) na convenção
            </p>
            <p className="text-xs text-muted-foreground">
              Revise antes de importar para a lista de {vocab.unidade.toLowerCase()}s.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              setRevisarUnidades({
                sugestaoId: sugestoes[0].id,
                unidades: sugestoes[0].payload.unidades ?? [],
              })
            }
          >
            Revisar e importar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await updateSugestaoFn({ data: { id: sugestoes[0].id, status: "descartada" } });
              setSugestoes((prev) => prev.slice(1));
            }}
          >
            Descartar
          </Button>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {vocab.unidade}s e Condôminos
          </h2>
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
              disabled={detectando}
              onClick={detectarManual}
              className="transition-colors"
              title="Força a IA a reler a convenção do condomínio"
            >
              {detectando ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Reler convenção
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={reprocessando}
              onClick={reprocessar}
              className="transition-colors"
              title="Baixa o arquivo original e força OCR/visão. Use se a IA não estiver lendo o conteúdo."
            >
              {reprocessando ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              Reprocessar convenção
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
        <Card className="p-8 text-center border-dashed">
          <p className="text-sm text-muted-foreground">
            Nenhuma unidade cadastrada.{" "}
            {isOwner && "Use 'Nova unidade' ou 'Importar unidades e condôminos'."}
          </p>
        </Card>
      ) : (
        <Card className="divide-y">
          {unidades.map((u) => (
            <div key={u.id} className="p-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpenView(u)}
                className="flex-1 min-w-0 text-left hover:bg-muted/30 -m-2 p-2 rounded transition-colors"
                title="Ver detalhes da unidade"
              >
                <p className="font-medium text-primary hover:underline">{formatLabel(u, vocab.bloco)}</p>
                <p className="text-xs text-muted-foreground">
                  {labelTipoUnidade(u.tipo)}
                  {u.area_m2 ? ` • ${u.area_m2} m²` : ""}
                  {u.fracao_ideal ? ` • fração ${u.fracao_ideal}` : ""}
                  {u.vagas_garagem ? ` • ${u.vagas_garagem} vaga(s)` : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(u.condominos?.length ?? 0)} condômino(s)
                </p>
              </button>
              <Button size="sm" variant="ghost" onClick={() => setOpenView(u)}>
                <Eye className="h-4 w-4 mr-1" /> Ver
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpenCond(u)}>
                <Users className="h-4 w-4 mr-1" /> Condôminos
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
            const r = await importFn({
              data: { condominioId, linhas: linhas as never },
            });
            refresh();
            return r as {
              unidadesCriadas: number;
              unidadesAtualizadas: number;
              condominosCriados: number;
              erros: { linha: number; mensagem: string }[];
            };
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

      {revisarUnidades && (
        <RevisarUnidadesDialog
          sugestoes={revisarUnidades.unidades}
          existentes={unidades.map((u) => ({ bloco: u.bloco, numero: u.numero }))}
          vocab={vocab}
          qtdMaxima={qtdConvencao}
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
            if (revisarUnidades.sugestaoId) {
              await updateSugestaoFn({
                data: { id: revisarUnidades.sugestaoId, status: "aplicada" },
              });
              setSugestoes((prev) => prev.filter((s) => s.id !== revisarUnidades.sugestaoId));
            }
            toast.success(
              `${r.unidadesCriadas} nova(s), ${r.unidadesAtualizadas} já existiam.`,
            );
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
                Envie um arquivo com a lista de condôminos (CSV, Excel, PDF, DOCX, DOC ou
                TXT). As unidades são extraídas automaticamente da convenção do condomínio
                na aba Documentos.
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
                onClick={() =>
                  document.getElementById("upload-import-unificado")?.click()
                }
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
            <Campo
              label="Área"
              valor={unidade.area_m2 != null ? `${unidade.area_m2} m²` : "—"}
            />
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
              <h3 className="text-sm font-semibold">
                Condôminos ({condominos.length})
              </h3>
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
              <div className="divide-y border rounded">
                {condominos.map((c) => (
                  <div key={c.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{c.nome}</p>
                      {c.principal && (
                        <span className="text-[10px] uppercase tracking-wide bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
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
                      <span className="col-span-2 truncate">
                        E-mail: {c.email || "—"}
                      </span>
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

function Campo({
  label,
  valor,
  colSpan,
}: {
  label: string;
  valor: string;
  colSpan?: boolean;
}) {
  return (
    <div className={colSpan ? "col-span-2" : ""}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
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
            <Input value={form.bloco} onChange={(e) => setForm({ ...form, bloco: e.target.value })} />
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
                <SelectItem value="sala_comercial">Sala comercial</SelectItem>
                <SelectItem value="loja">Loja</SelectItem>
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
      setForm({ nome: "", cpf: "", email: "", telefone: "", tipo: "proprietario", principal: false });
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
            <div className="divide-y border rounded">
              {(unidade.condominos ?? []).map((c) => (
                <div key={c.id} className="p-3 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {c.nome}{" "}
                      {c.principal && (
                        <span className="text-xs text-emerald-600 ml-1">(principal)</span>
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
                  <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                </div>
                <div>
                  <Label>CPF</Label>
                  <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
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
            . Somente <strong>numero</strong> é obrigatório. Linhas com mesmo bloco+numero
            atualizam a unidade existente.
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
              placeholder={"bloco,numero,nome,email,tipo_condomino\nA,101,João Silva,joao@email.com,proprietario"}
            />
          </div>

          {resultado && (
            <div className="text-sm space-y-1 border rounded p-3 bg-slate-50 dark:bg-slate-900/40">
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