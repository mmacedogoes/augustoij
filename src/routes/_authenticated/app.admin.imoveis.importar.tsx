import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Sparkles, Loader2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { ImoveisNav } from "@/components/admin/ImoveisNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  extrairContrato,
  salvarImportacaoLocacao,
  salvarImportacaoAdministracao,
  checarDuplicataImovel,
} from "@/lib/imoveis/importar.functions";
import { listProprietarios } from "@/lib/imoveis/proprietarios.functions";

export const Route = createFileRoute("/_authenticated/app/admin/imoveis/importar")({
  component: Page,
});

// -------- helpers ---------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Dict = Record<string, any>;

type Extracao = {
  arquivoPath: string;
  usouVisao: boolean;
  textoExtraido?: string;
  extrai: Dict;
};

// Marca visualmente campos preenchidos pela IA
function AiField(props: {
  label: string;
  aiFilled: boolean;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={props.full ? "sm:col-span-2" : ""}>
      <div className="flex items-center gap-2 mb-1">
        <Label className="mb-0">{props.label}</Label>
        {props.aiFilled && (
          <Badge variant="secondary" className="text-[10px] gap-1 py-0 h-4 px-1.5">
            <Sparkles className="h-2.5 w-2.5" /> IA
          </Badge>
        )}
      </div>
      {props.children}
    </div>
  );
}

function isFilled(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const s = fr.result as string;
      // remove "data:...;base64," prefix
      resolve(s.slice(s.indexOf(",") + 1));
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

// -------- component -------------------------------------------------------

function Page() {
  const navigate = useNavigate();
  const extrairFn = useServerFn(extrairContrato);
  const salvarLocFn = useServerFn(salvarImportacaoLocacao);
  const salvarAdmFn = useServerFn(salvarImportacaoAdministracao);
  const listPropFn = useServerFn(listProprietarios);
  const checarDupFn = useServerFn(checarDuplicataImovel);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ext, setExt] = useState<Extracao | null>(null);
  const [form, setForm] = useState<Dict | null>(null);
  const [proprietarios, setProprietarios] = useState<Array<{ id: string; nome: string }>>([]);
  const [proprietarioId, setProprietarioId] = useState<string>("");
  const [duplicata, setDuplicata] = useState<{ id: string; label: string } | null>(null);
  const [forcarNovo, setForcarNovo] = useState(false);

  useEffect(() => {
    listPropFn().then((r) => setProprietarios(r.rows as Array<{ id: string; nome: string }>)).catch(() => {});
  }, [listPropFn]);

  const tipo: "locacao" | "administracao" | null = form?.tipo ?? null;
  const subtipo: "original" | "renovacao" = (form?.subtipo === "renovacao" ? "renovacao" : "original");
  const confianca: number = Number(form?.confianca ?? 0);

  // Marca original da IA para o badge (compara valor atual vs original)
  const aiOriginal = ext?.extrai as Dict | undefined;

  const handleUpload = async () => {
    if (!file) { toast.error("Selecione um arquivo"); return; }
    const max = 20 * 1024 * 1024;
    if (file.size > max) { toast.error("Arquivo excede 20MB"); return; }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      toast.error("Apenas PDF ou DOCX");
      return;
    }
    setLoading(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await extrairFn({
        data: {
          fileBase64: b64,
          fileName: file.name,
          mimeType: file.type || (lower.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        },
      });
      setExt(res as Extracao);
      setForm(structuredClone((res as Extracao).extrai));
      toast.success(res.usouVisao ? "Extração concluída (visão IA)" : "Extração concluída");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const setPath = (path: string[], value: unknown) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      let cursor: Dict = next;
      for (let i = 0; i < path.length - 1; i++) {
        cursor[path[i]] = cursor[path[i]] ?? {};
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const wasAiFilled = (path: string[]): boolean => {
    let c: Dict | undefined = aiOriginal;
    for (const k of path) {
      if (!c) return false;
      c = c[k];
    }
    return isFilled(c);
  };

  const handleSave = async () => {
    if (!form || !ext) return;
    if (!tipo) {
      toast.error("Selecione o tipo do contrato (Locação ou Administração) antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      if (tipo === "locacao") {
        // Checa duplicata antes de gravar (se há proprietário conhecido)
        if (proprietarioId && !forcarNovo) {
          const dup = await checarDupFn({
            data: { proprietario_id: proprietarioId, imovel: form.imovel ?? {} },
          });
          if (dup) {
            setDuplicata(dup as { id: string; label: string });
            toast.warning(`Imóvel já cadastrado: ${(dup as { label: string }).label}. Confirme abaixo antes de salvar.`);
            setSaving(false);
            return;
          }
        }
        const r = await salvarLocFn({
          data: {
            arquivoPath: ext.arquivoPath,
            proprietario: form.proprietario ?? {},
            inquilino: form.inquilino ?? {},
            imovel: form.imovel ?? {},
            locacao: form.locacao ?? {},
            caucao: form.caucao ?? {},
            proprietario_id: proprietarioId || null,
            imovel_id: null,
            subtipo,
            forcar_novo_imovel: forcarNovo,
          },
        });
        if ((r as { imovel_duplicado?: unknown }).imovel_duplicado) {
          toast.success("Contrato vinculado ao imóvel já existente.");
        } else if ((r as { renovacao_aplicada?: boolean }).renovacao_aplicada) {
          toast.success("Renovação aplicada ao contrato existente!");
        } else {
          toast.success("Contrato de locação importado!");
        }
        navigate({ to: "/app/admin/imoveis/locacao/$id", params: { id: r.contrato_id } });
      } else if (tipo === "administracao") {
        const r = await salvarAdmFn({
          data: {
            arquivoPath: ext.arquivoPath,
            proprietario: form.proprietario ?? {},
            administrador: form.administrador ?? {},
            honorarios: form.honorarios ?? {},
            vigencia: form.vigencia ?? {},
            imoveis_administrados: form.imoveis_administrados ?? [],
            proprietario_id: proprietarioId || null,
          },
        });
        const criados = (r as { imoveis_criados?: unknown[] }).imoveis_criados?.length ?? 0;
        const vinc = (r as { imoveis_vinculados?: Array<{ label: string }> }).imoveis_vinculados ?? [];
        toast.success(
          `Contrato importado! ${criados} imóvel(is) criado(s), ${vinc.length} vinculado(s).`,
        );
        if (vinc.length > 0) {
          toast.info(`Imóveis já cadastrados vinculados: ${vinc.map((v) => v.label).join(", ")}`);
        }
        navigate({ to: "/app/admin/imoveis/administracao/$id", params: { id: r.contrato_id } });
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-5xl">
        <h1 className="text-3xl font-bold text-primary">Importar contrato</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie um PDF ou DOCX. A IA identifica se é contrato de locação ou de administração
          e pré-preenche o formulário para você revisar antes de salvar.
        </p>
        <div className="mt-6"><AdminNav /></div>
        <ImoveisNav />

        {!ext && (
          <Card className="p-6 space-y-4">
            <div>
              <Label>Arquivo do contrato (PDF ou DOCX, até 20MB)</Label>
              <Input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={loading}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUpload} disabled={!file || loading}>
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Extraindo com IA...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" /> Enviar e extrair</>
                )}
              </Button>
            </div>
          </Card>
        )}

        {ext && form && tipo === "locacao" && (
          <LocacaoReview
            form={form}
            setPath={setPath}
            wasAiFilled={wasAiFilled}
            proprietarios={proprietarios}
            proprietarioId={proprietarioId}
            setProprietarioId={setProprietarioId}
          />
        )}

        {ext && form && tipo === "administracao" && (
          <AdministracaoReview
            form={form}
            setPath={setPath}
            wasAiFilled={wasAiFilled}
            proprietarios={proprietarios}
            proprietarioId={proprietarioId}
            setProprietarioId={setProprietarioId}
          />
        )}

        {ext && form && (
          <Card className="p-4 mt-4 space-y-3">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <Label>Tipo de contrato (edite se necessário)</Label>
                <Select
                  value={tipo ?? undefined}
                  onValueChange={(v) => setForm((prev) => (prev ? { ...prev, tipo: v } : prev))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo (a IA não identificou)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="locacao">Locação</SelectItem>
                    <SelectItem value="administracao">Administração</SelectItem>
                  </SelectContent>
                </Select>
                {confianca > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Sugestão da IA: <b>{tipo ?? "não identificado"}</b> · confiança {confianca}%
                  </p>
                )}
              </div>
              {tipo === "locacao" && (
                <div className="min-w-[200px]">
                  <Label>Subtipo</Label>
                  <Select
                    value={subtipo}
                    onValueChange={(v) => setForm((prev) => (prev ? { ...prev, subtipo: v } : prev))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="original">Contrato original</SelectItem>
                      <SelectItem value="renovacao">Renovação (aditivo)</SelectItem>
                    </SelectContent>
                  </Select>
                  {subtipo === "renovacao" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Se já existir contrato para este imóvel, a renovação atualizará o contrato existente.
                    </p>
                  )}
                </div>
              )}
            </div>
            {duplicata && tipo === "locacao" && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium">Imóvel já cadastrado: {duplicata.label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Vamos vincular o contrato a este imóvel. Você pode editar os campos abaixo,
                  ou criar um novo imóvel mesmo assim.
                </p>
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setDuplicata(null); setForcarNovo(false); }}
                  >
                    Vincular ao existente
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setDuplicata(null); setForcarNovo(true); }}
                  >
                    Criar novo mesmo assim
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {ext && form && (
          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3 inline mr-1" />
              Campos com o selo <b>IA</b> foram preenchidos automaticamente. Revise antes de salvar.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setExt(null); setForm(null); }} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar contrato"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ============ Locação ====================================================

function LocacaoReview(props: {
  form: Dict;
  setPath: (p: string[], v: unknown) => void;
  wasAiFilled: (p: string[]) => boolean;
  proprietarios: Array<{ id: string; nome: string }>;
  proprietarioId: string;
  setProprietarioId: (v: string) => void;
}) {
  const { form, setPath, wasAiFilled } = props;
  const p = form.proprietario ?? {};
  const inq = form.inquilino ?? {};
  const im = form.imovel ?? {};
  const loc = form.locacao ?? {};
  const enc = loc.encargos_inquilino ?? {};
  const c = form.caucao ?? {};

  const encFields = ["condominio","agua","luz","iptu","tcr"] as const;

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Proprietário</h2>
          <div className="text-xs text-muted-foreground">Ou vincule a um existente:</div>
        </div>
        <Select value={props.proprietarioId || undefined} onValueChange={props.setProprietarioId}>
          <SelectTrigger><SelectValue placeholder="Criar novo com os dados abaixo" /></SelectTrigger>
          <SelectContent>
            {props.proprietarios.map((op) => (
              <SelectItem key={op.id} value={op.id}>{op.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!props.proprietarioId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <AiField label="Nome *" aiFilled={wasAiFilled(["proprietario","nome"])} full>
              <Input value={p.nome ?? ""} onChange={(e) => setPath(["proprietario","nome"], e.target.value)} />
            </AiField>
            <AiField label="CPF" aiFilled={wasAiFilled(["proprietario","cpf"])}>
              <Input value={p.cpf ?? ""} onChange={(e) => setPath(["proprietario","cpf"], e.target.value)} />
            </AiField>
            <AiField label="RG" aiFilled={wasAiFilled(["proprietario","rg"])}>
              <Input value={p.rg ?? ""} onChange={(e) => setPath(["proprietario","rg"], e.target.value)} />
            </AiField>
            <AiField label="Estado civil" aiFilled={wasAiFilled(["proprietario","estado_civil"])}>
              <Input value={p.estado_civil ?? ""} onChange={(e) => setPath(["proprietario","estado_civil"], e.target.value)} />
            </AiField>
            <AiField label="Profissão" aiFilled={wasAiFilled(["proprietario","profissao"])}>
              <Input value={p.profissao ?? ""} onChange={(e) => setPath(["proprietario","profissao"], e.target.value)} />
            </AiField>
            <AiField label="E-mail" aiFilled={wasAiFilled(["proprietario","email"])}>
              <Input value={p.email ?? ""} onChange={(e) => setPath(["proprietario","email"], e.target.value)} />
            </AiField>
            <AiField label="Telefone" aiFilled={wasAiFilled(["proprietario","telefone"])}>
              <Input value={p.telefone ?? ""} onChange={(e) => setPath(["proprietario","telefone"], e.target.value)} />
            </AiField>
            <AiField label="Endereço" aiFilled={wasAiFilled(["proprietario","endereco"])} full>
              <Input value={p.endereco ?? ""} onChange={(e) => setPath(["proprietario","endereco"], e.target.value)} />
            </AiField>
            <AiField label="Banco" aiFilled={wasAiFilled(["proprietario","banco"])}>
              <Input value={p.banco ?? ""} onChange={(e) => setPath(["proprietario","banco"], e.target.value)} />
            </AiField>
            <AiField label="Agência" aiFilled={wasAiFilled(["proprietario","agencia"])}>
              <Input value={p.agencia ?? ""} onChange={(e) => setPath(["proprietario","agencia"], e.target.value)} />
            </AiField>
            <AiField label="Conta" aiFilled={wasAiFilled(["proprietario","conta"])}>
              <Input value={p.conta ?? ""} onChange={(e) => setPath(["proprietario","conta"], e.target.value)} />
            </AiField>
            <AiField label="PIX" aiFilled={wasAiFilled(["proprietario","pix"])}>
              <Input value={p.pix ?? ""} onChange={(e) => setPath(["proprietario","pix"], e.target.value)} />
            </AiField>
          </div>
        )}
      </Card>

      <Card className="p-6 grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-primary sm:col-span-2">Inquilino</h2>
        <AiField label="Nome" aiFilled={wasAiFilled(["inquilino","nome"])} full>
          <Input value={inq.nome ?? ""} onChange={(e) => setPath(["inquilino","nome"], e.target.value)} />
        </AiField>
        <AiField label="CPF" aiFilled={wasAiFilled(["inquilino","cpf"])}>
          <Input value={inq.cpf ?? ""} onChange={(e) => setPath(["inquilino","cpf"], e.target.value)} />
        </AiField>
        <AiField label="RG" aiFilled={wasAiFilled(["inquilino","rg"])}>
          <Input value={inq.rg ?? ""} onChange={(e) => setPath(["inquilino","rg"], e.target.value)} />
        </AiField>
        <AiField label="Estado civil" aiFilled={wasAiFilled(["inquilino","estado_civil"])}>
          <Input value={inq.estado_civil ?? ""} onChange={(e) => setPath(["inquilino","estado_civil"], e.target.value)} />
        </AiField>
        <AiField label="Profissão" aiFilled={wasAiFilled(["inquilino","profissao"])}>
          <Input value={inq.profissao ?? ""} onChange={(e) => setPath(["inquilino","profissao"], e.target.value)} />
        </AiField>
        <AiField label="E-mail" aiFilled={wasAiFilled(["inquilino","email"])}>
          <Input value={inq.email ?? ""} onChange={(e) => setPath(["inquilino","email"], e.target.value)} />
        </AiField>
        <AiField label="Telefone" aiFilled={wasAiFilled(["inquilino","telefone"])}>
          <Input value={inq.telefone ?? ""} onChange={(e) => setPath(["inquilino","telefone"], e.target.value)} />
        </AiField>
        <AiField label="Endereço" aiFilled={wasAiFilled(["inquilino","endereco"])} full>
          <Input value={inq.endereco ?? ""} onChange={(e) => setPath(["inquilino","endereco"], e.target.value)} />
        </AiField>
      </Card>

      <Card className="p-6 grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-primary sm:col-span-2">Imóvel</h2>
        <AiField label="Descrição" aiFilled={wasAiFilled(["imovel","descricao"])} full>
          <Input value={im.descricao ?? ""} onChange={(e) => setPath(["imovel","descricao"], e.target.value)} />
        </AiField>
        <AiField label="Endereço" aiFilled={wasAiFilled(["imovel","endereco"])} full>
          <Input value={im.endereco ?? ""} onChange={(e) => setPath(["imovel","endereco"], e.target.value)} />
        </AiField>
        <AiField label="Edifício" aiFilled={wasAiFilled(["imovel","edificio"])}>
          <Input value={im.edificio ?? ""} onChange={(e) => setPath(["imovel","edificio"], e.target.value)} />
        </AiField>
        <AiField label="Unidade" aiFilled={wasAiFilled(["imovel","numero_unidade"])}>
          <Input
            placeholder="somente o número, ex.: 406"
            value={im.numero_unidade ?? ""}
            onChange={(e) => setPath(["imovel","numero_unidade"], e.target.value)}
          />
        </AiField>
        <AiField label="Bloco" aiFilled={wasAiFilled(["imovel","bloco"])}>
          <Input
            placeholder="ex.: A, B, 2 (opcional)"
            value={im.bloco ?? ""}
            onChange={(e) => setPath(["imovel","bloco"], e.target.value)}
          />
        </AiField>
        <AiField label="CEP" aiFilled={wasAiFilled(["imovel","cep"])}>
          <Input value={im.cep ?? ""} onChange={(e) => setPath(["imovel","cep"], e.target.value)} />
        </AiField>
        <AiField label="Cidade" aiFilled={wasAiFilled(["imovel","cidade"])}>
          <Input value={im.cidade ?? ""} onChange={(e) => setPath(["imovel","cidade"], e.target.value)} />
        </AiField>
        <AiField label="UF" aiFilled={wasAiFilled(["imovel","uf"])}>
          <Input value={im.uf ?? ""} onChange={(e) => setPath(["imovel","uf"], e.target.value)} />
        </AiField>
        <AiField label="Quartos" aiFilled={wasAiFilled(["imovel","quartos"])}>
          <Input type="number" value={im.quartos ?? ""} onChange={(e) => setPath(["imovel","quartos"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox checked={!!im.vaga_garagem} onCheckedChange={(v) => setPath(["imovel","vaga_garagem"], Boolean(v))} />
          <Label>Vaga de garagem {wasAiFilled(["imovel","vaga_garagem"]) && <Badge variant="secondary" className="ml-1 text-[10px] py-0 h-4 px-1.5"><Sparkles className="h-2.5 w-2.5 mr-1"/>IA</Badge>}</Label>
        </div>
      </Card>

      <Card className="p-6 grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-primary sm:col-span-2">Locação</h2>
        <AiField label="Valor do aluguel (R$)" aiFilled={wasAiFilled(["locacao","valor_aluguel"])}>
          <Input type="number" step="0.01" value={loc.valor_aluguel ?? ""} onChange={(e) => setPath(["locacao","valor_aluguel"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Dia de vencimento" aiFilled={wasAiFilled(["locacao","dia_vencimento"])}>
          <Input type="number" min={1} max={31} value={loc.dia_vencimento ?? ""} onChange={(e) => setPath(["locacao","dia_vencimento"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Data do contrato original" aiFilled={wasAiFilled(["locacao","data_contrato_original"])}>
          <Input type="date" value={loc.data_contrato_original ?? ""} onChange={(e) => setPath(["locacao","data_contrato_original"], e.target.value || null)} />
        </AiField>
        <AiField label="Início da vigência" aiFilled={wasAiFilled(["locacao","data_inicio_vigencia"])}>
          <Input type="date" value={loc.data_inicio_vigencia ?? ""} onChange={(e) => setPath(["locacao","data_inicio_vigencia"], e.target.value || null)} />
        </AiField>
        <AiField label="Prazo (meses)" aiFilled={wasAiFilled(["locacao","prazo_meses"])}>
          <Input type="number" value={loc.prazo_meses ?? ""} onChange={(e) => setPath(["locacao","prazo_meses"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Índice de reajuste" aiFilled={wasAiFilled(["locacao","indice_reajuste"])}>
          <Input value={loc.indice_reajuste ?? ""} onChange={(e) => setPath(["locacao","indice_reajuste"], e.target.value)} />
        </AiField>
        <AiField label="Periodicidade (meses)" aiFilled={wasAiFilled(["locacao","periodicidade_reajuste_meses"])}>
          <Input type="number" value={loc.periodicidade_reajuste_meses ?? ""} onChange={(e) => setPath(["locacao","periodicidade_reajuste_meses"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Mês-base (1-12)" aiFilled={wasAiFilled(["locacao","mes_base_reajuste"])}>
          <Input type="number" min={1} max={12} value={loc.mes_base_reajuste ?? ""} onChange={(e) => setPath(["locacao","mes_base_reajuste"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Multa de mora (%)" aiFilled={wasAiFilled(["locacao","multa_mora_percent"])}>
          <Input type="number" step="0.01" value={loc.multa_mora_percent ?? ""} onChange={(e) => setPath(["locacao","multa_mora_percent"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Juros mora mensal (%)" aiFilled={wasAiFilled(["locacao","juros_mora_mensal_percent"])}>
          <Input type="number" step="0.01" value={loc.juros_mora_mensal_percent ?? ""} onChange={(e) => setPath(["locacao","juros_mora_mensal_percent"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Multa rescisória (× aluguel)" aiFilled={wasAiFilled(["locacao","multa_rescisoria_multiplicador"])}>
          <Input type="number" step="0.01" value={loc.multa_rescisoria_multiplicador ?? ""} onChange={(e) => setPath(["locacao","multa_rescisoria_multiplicador"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Aviso prévio (dias)" aiFilled={wasAiFilled(["locacao","aviso_previo_dias"])}>
          <Input type="number" value={loc.aviso_previo_dias ?? ""} onChange={(e) => setPath(["locacao","aviso_previo_dias"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Foro" aiFilled={wasAiFilled(["locacao","foro"])} full>
          <Input value={loc.foro ?? ""} onChange={(e) => setPath(["locacao","foro"], e.target.value)} />
        </AiField>
        <div className="sm:col-span-2">
          <Label className="mb-2 block">Encargos por conta do inquilino</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {encFields.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={!!enc[k]}
                  onCheckedChange={(v) => setPath(["locacao","encargos_inquilino",k], Boolean(v))}
                />
                <span className="capitalize">{k === "tcr" ? "TCR" : k}</span>
                {wasAiFilled(["locacao","encargos_inquilino",k]) && (
                  <Badge variant="secondary" className="text-[10px] py-0 h-4 px-1.5">
                    <Sparkles className="h-2.5 w-2.5" />
                  </Badge>
                )}
              </label>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Checkbox checked={!!c.possui} onCheckedChange={(v) => setPath(["caucao","possui"], Boolean(v))} />
          <h2 className="text-lg font-semibold text-primary">Possui caução</h2>
          {wasAiFilled(["caucao","possui"]) && (
            <Badge variant="secondary" className="text-[10px] py-0 h-4 px-1.5"><Sparkles className="h-2.5 w-2.5" /> IA</Badge>
          )}
        </div>
        {!!c.possui && (
          <div className="grid gap-4 sm:grid-cols-2">
            <AiField label="Valor depositado (R$)" aiFilled={wasAiFilled(["caucao","valor_depositado"])}>
              <Input type="number" step="0.01" value={c.valor_depositado ?? ""} onChange={(e) => setPath(["caucao","valor_depositado"], e.target.value === "" ? null : Number(e.target.value))} />
            </AiField>
            <AiField label="Tipo" aiFilled={wasAiFilled(["caucao","tipo"])}>
              <Select value={c.tipo ?? undefined} onValueChange={(v) => setPath(["caucao","tipo"], v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="poupanca">Poupança</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="seguro">Seguro-fiança</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </AiField>
            <AiField label="Data do depósito" aiFilled={wasAiFilled(["caucao","data_deposito"])}>
              <Input type="date" value={c.data_deposito ?? ""} onChange={(e) => setPath(["caucao","data_deposito"], e.target.value || null)} />
            </AiField>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox checked={c.corrige_com_rendimento !== false} onCheckedChange={(v) => setPath(["caucao","corrige_com_rendimento"], Boolean(v))} />
              <Label>Corrigir com rendimento</Label>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ Administração ==============================================

function AdministracaoReview(props: {
  form: Dict;
  setPath: (p: string[], v: unknown) => void;
  wasAiFilled: (p: string[]) => boolean;
  proprietarios: Array<{ id: string; nome: string }>;
  proprietarioId: string;
  setProprietarioId: (v: string) => void;
}) {
  const { form, setPath, wasAiFilled } = props;
  const p = form.proprietario ?? {};
  const a = form.administrador ?? {};
  const h = form.honorarios ?? {};
  const v = form.vigencia ?? {};
  const imoveis: Dict[] = useMemo(
    () => (Array.isArray(form.imoveis_administrados) ? form.imoveis_administrados : []),
    [form.imoveis_administrados],
  );

  const addImovel = () => {
    props.setPath(["imoveis_administrados"], [
      ...imoveis,
      { descricao: null, endereco: null, edificio: null, numero_unidade: null },
    ]);
  };
  const removeImovel = (i: number) => {
    const next = imoveis.filter((_, idx) => idx !== i);
    props.setPath(["imoveis_administrados"], next);
  };

  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Proprietário</h2>
          <div className="text-xs text-muted-foreground">Ou vincule a um existente:</div>
        </div>
        <Select value={props.proprietarioId || undefined} onValueChange={props.setProprietarioId}>
          <SelectTrigger><SelectValue placeholder="Criar novo com os dados abaixo" /></SelectTrigger>
          <SelectContent>
            {props.proprietarios.map((op) => (
              <SelectItem key={op.id} value={op.id}>{op.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!props.proprietarioId && (
          <div className="grid gap-4 sm:grid-cols-2">
            <AiField label="Nome *" aiFilled={wasAiFilled(["proprietario","nome"])} full>
              <Input value={p.nome ?? ""} onChange={(e) => setPath(["proprietario","nome"], e.target.value)} />
            </AiField>
            <AiField label="CPF" aiFilled={wasAiFilled(["proprietario","cpf"])}>
              <Input value={p.cpf ?? ""} onChange={(e) => setPath(["proprietario","cpf"], e.target.value)} />
            </AiField>
            <AiField label="E-mail" aiFilled={wasAiFilled(["proprietario","email"])}>
              <Input value={p.email ?? ""} onChange={(e) => setPath(["proprietario","email"], e.target.value)} />
            </AiField>
            <AiField label="Telefone" aiFilled={wasAiFilled(["proprietario","telefone"])}>
              <Input value={p.telefone ?? ""} onChange={(e) => setPath(["proprietario","telefone"], e.target.value)} />
            </AiField>
            <AiField label="Endereço" aiFilled={wasAiFilled(["proprietario","endereco"])} full>
              <Input value={p.endereco ?? ""} onChange={(e) => setPath(["proprietario","endereco"], e.target.value)} />
            </AiField>
          </div>
        )}
      </Card>

      <Card className="p-6 grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-primary sm:col-span-2">Administrador</h2>
        <AiField label="Nome" aiFilled={wasAiFilled(["administrador","nome"])} full>
          <Input value={a.nome ?? ""} onChange={(e) => setPath(["administrador","nome"], e.target.value)} />
        </AiField>
        <AiField label="Documento (CPF/CNPJ)" aiFilled={wasAiFilled(["administrador","documento"])}>
          <Input value={a.documento ?? ""} onChange={(e) => setPath(["administrador","documento"], e.target.value)} />
        </AiField>
        <AiField label="OAB" aiFilled={wasAiFilled(["administrador","oab"])}>
          <Input value={a.oab ?? ""} onChange={(e) => setPath(["administrador","oab"], e.target.value)} />
        </AiField>
        <AiField label="PIX" aiFilled={wasAiFilled(["administrador","pix"])}>
          <Input value={a.pix ?? ""} onChange={(e) => setPath(["administrador","pix"], e.target.value)} />
        </AiField>
        <AiField label="Banco" aiFilled={wasAiFilled(["administrador","banco"])}>
          <Input value={a.banco ?? ""} onChange={(e) => setPath(["administrador","banco"], e.target.value)} />
        </AiField>
        <AiField label="Agência" aiFilled={wasAiFilled(["administrador","agencia"])}>
          <Input value={a.agencia ?? ""} onChange={(e) => setPath(["administrador","agencia"], e.target.value)} />
        </AiField>
        <AiField label="Conta" aiFilled={wasAiFilled(["administrador","conta"])}>
          <Input value={a.conta ?? ""} onChange={(e) => setPath(["administrador","conta"], e.target.value)} />
        </AiField>
      </Card>

      <Card className="p-6 grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-primary sm:col-span-2">Honorários e mora</h2>
        <AiField label="Honorário sobre renovação (%)" aiFilled={wasAiFilled(["honorarios","percent_honorario_renovacao"])}>
          <Input type="number" step="0.01" value={h.percent_honorario_renovacao ?? ""} onChange={(e) => setPath(["honorarios","percent_honorario_renovacao"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Honorário mensal (%)" aiFilled={wasAiFilled(["honorarios","percent_honorario_mensal"])}>
          <Input type="number" step="0.01" value={h.percent_honorario_mensal ?? ""} onChange={(e) => setPath(["honorarios","percent_honorario_mensal"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Multa de mora (%)" aiFilled={wasAiFilled(["honorarios","mora_multa_percent"])}>
          <Input type="number" step="0.01" value={h.mora_multa_percent ?? ""} onChange={(e) => setPath(["honorarios","mora_multa_percent"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Juros mora mensal (%)" aiFilled={wasAiFilled(["honorarios","mora_juros_mensal_percent"])}>
          <Input type="number" step="0.01" value={h.mora_juros_mensal_percent ?? ""} onChange={(e) => setPath(["honorarios","mora_juros_mensal_percent"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
        <AiField label="Índice de mora" aiFilled={wasAiFilled(["honorarios","mora_indice"])}>
          <Input value={h.mora_indice ?? ""} onChange={(e) => setPath(["honorarios","mora_indice"], e.target.value)} />
        </AiField>
      </Card>

      <Card className="p-6 grid gap-4 sm:grid-cols-2">
        <h2 className="text-lg font-semibold text-primary sm:col-span-2">Vigência</h2>
        <AiField label="Data de início" aiFilled={wasAiFilled(["vigencia","data_inicio"])}>
          <Input type="date" value={v.data_inicio ?? ""} onChange={(e) => setPath(["vigencia","data_inicio"], e.target.value || null)} />
        </AiField>
        <AiField label="Prazo (meses)" aiFilled={wasAiFilled(["vigencia","prazo_meses"])}>
          <Input type="number" value={v.prazo_meses ?? ""} onChange={(e) => setPath(["vigencia","prazo_meses"], e.target.value === "" ? null : Number(e.target.value))} />
        </AiField>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">Imóveis administrados</h2>
          <Button type="button" variant="outline" size="sm" onClick={addImovel}>Adicionar imóvel</Button>
        </div>
        {imoveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum imóvel identificado. Adicione se necessário.</p>}
        {imoveis.map((im, i) => (
          <div key={i} className="rounded-lg border border-border p-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex justify-between items-center">
              <span className="text-sm font-medium">Imóvel {i + 1}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeImovel(i)}>Remover</Button>
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={im.descricao ?? ""} onChange={(e) => setPath(["imoveis_administrados", String(i), "descricao"], e.target.value)} />
            </div>
            <div>
              <Label>Endereço</Label>
              <Input value={im.endereco ?? ""} onChange={(e) => setPath(["imoveis_administrados", String(i), "endereco"], e.target.value)} />
            </div>
            <div>
              <Label>Edifício</Label>
              <Input value={im.edificio ?? ""} onChange={(e) => setPath(["imoveis_administrados", String(i), "edificio"], e.target.value)} />
            </div>
            <div>
              <Label>Unidade</Label>
              <Input
                placeholder="somente o número, ex.: 406"
                value={im.numero_unidade ?? ""}
                onChange={(e) => setPath(["imoveis_administrados", String(i), "numero_unidade"], e.target.value)}
              />
            </div>
            <div>
              <Label>Bloco</Label>
              <Input
                placeholder="ex.: A, B (opcional)"
                value={im.bloco ?? ""}
                onChange={(e) => setPath(["imoveis_administrados", String(i), "bloco"], e.target.value)}
              />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// util para AI badge sem quebrar quando o campo é opcional
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _Textarea = Textarea; // evita tree-shake acidental em builds futuros