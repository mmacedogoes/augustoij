import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, Upload, Users, Loader2, Eye, Sparkles, FileUp } from "lucide-react";
import { toast } from "sonner";
import {
  listUnidades,
  createUnidade,
  updateUnidade,
  deleteUnidade,
  createCondomino,
  deleteCondomino,
  importUnidadesLote,
} from "@/lib/unidades.functions";
import {
  listSugestoesUnidades,
  atualizarStatusSugestao,
  extrairCondominosDeArquivo,
} from "@/lib/unidades-ia.functions";
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
  | "sala_comercial"
  | "loja"
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

  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Unidade | null>(null);
  const [form, setForm] = useState({ ...EMPTY_UNIDADE });
  const [saving, setSaving] = useState(false);
  const [openCond, setOpenCond] = useState<Unidade | null>(null);
  const [openImport, setOpenImport] = useState(false);
  const [openView, setOpenView] = useState<Unidade | null>(null);

  function refresh() {
    setLoading(true);
    fetchAll({ data: { condominioId } })
      .then((r) => setUnidades((r as Unidade[]) ?? []))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar"))
      .finally(() => setLoading(false));
  }
  useEffect(refresh, [condominioId]);

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
    if (!confirm(`Excluir a unidade ${formatLabel(u)} e todos os condôminos vinculados?`)) return;
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Unidades e Condôminos</h2>
          <p className="text-xs text-muted-foreground">
            {unidades.length} unidade(s) cadastrada(s)
          </p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpenImport(true)}>
              <Upload className="h-4 w-4 mr-1" /> Importar CSV
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
            Nenhuma unidade cadastrada. {isOwner && "Use 'Nova unidade' ou 'Importar CSV'."}
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
                <p className="font-medium text-primary hover:underline">{formatLabel(u)}</p>
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
    </div>
  );
}

function formatLabel(u: Unidade) {
  return u.bloco ? `Bloco ${u.bloco} • ${u.numero}` : u.numero;
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
    sala_comercial: "Sala comercial",
    loja: "Loja",
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