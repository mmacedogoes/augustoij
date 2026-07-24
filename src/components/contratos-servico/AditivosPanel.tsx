import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, ExternalLink, Pencil, Trash2, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  listAditivos, upsertAditivo, removeAditivo, getAditivoArquivoUrl,
} from "@/lib/contratos-servico/aditivos.functions";

type Aditivo = {
  id: string;
  numero: string | null;
  data_assinatura: string | null;
  altera_valor: boolean;
  altera_vigencia: boolean;
  altera_escopo: boolean;
  valor_anterior: number | null;
  valor_novo: number | null;
  data_fim_anterior: string | null;
  vigencia_nova_fim: string | null;
  resumo_alteracoes: string | null;
  arquivo_path: string | null;
  created_at: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return iso; }
}
function fmtBRL(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function AditivosPanel({
  contratoId,
  onCountChange,
}: {
  contratoId: string;
  onCountChange?: (n: number) => void;
}) {
  const listFn = useServerFn(listAditivos);
  const upFn = useServerFn(upsertAditivo);
  const rmFn = useServerFn(removeAditivo);
  const urlFn = useServerFn(getAditivoArquivoUrl);

  const [rows, setRows] = useState<Aditivo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [abrir, setAbrir] = useState(false);
  const [editando, setEditando] = useState<Aditivo | null>(null);
  const [confirmar, setConfirmar] = useState<Aditivo | null>(null);
  const [removendo, setRemovendo] = useState(false);

  const carregar = useCallback(() => {
    setErro(null);
    listFn({ data: { contratoId } })
      .then((r) => {
        setRows(r.rows as Aditivo[]);
        onCountChange?.(r.rows.length);
      })
      .catch((e: Error) => { setErro(e.message); toast.error(e.message); });
  }, [listFn, contratoId, onCountChange]);

  useEffect(() => { carregar(); }, [carregar]);

  function abrirNovo() { setEditando(null); setAbrir(true); }
  function abrirEditar(a: Aditivo) { setEditando(a); setAbrir(true); }

  async function abrirArquivo(id: string) {
    try {
      const r = await urlFn({ data: { id } });
      if (!r.url) { toast.info("Este aditivo não possui arquivo."); return; }
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível abrir o arquivo."); }
  }

  async function confirmarRemover() {
    if (!confirmar) return;
    setRemovendo(true);
    try {
      await rmFn({ data: { id: confirmar.id } });
      toast.success("Aditivo removido.");
      setConfirmar(null);
      carregar();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao remover."); }
    finally { setRemovendo(false); }
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-serif text-primary">Aditivos</h3>
          <p className="text-sm text-muted-foreground">
            Termos aditivos ao contrato, em ordem cronológica.
          </p>
        </div>
        <Button size="sm" onClick={abrirNovo}>
          <Plus className="h-4 w-4 mr-1" /> Novo aditivo
        </Button>
      </div>

      {erro ? (
        <p className="text-sm text-destructive">{erro}</p>
      ) : rows === null ? (
        <div className="space-y-2">
          <div className="h-16 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-16 rounded-md bg-muted/50 animate-pulse" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum aditivo registrado ainda. Use o botão acima para incluir o primeiro.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((a) => (
            <li key={a.id} className="py-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    Aditivo{a.numero ? ` nº ${a.numero}` : ""} — {fmtDate(a.data_assinatura)}
                  </span>
                  {a.altera_valor && <Badge variant="secondary">Valor</Badge>}
                  {a.altera_vigencia && <Badge variant="secondary">Vigência</Badge>}
                  {a.altera_escopo && <Badge variant="secondary">Escopo</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1 break-words">
                  {a.resumo_alteracoes}
                </p>
                {(a.altera_valor || a.altera_vigencia) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {a.altera_valor && (
                      <>Valor: {fmtBRL(a.valor_anterior)} → {fmtBRL(a.valor_novo)}{a.altera_vigencia ? " · " : ""}</>
                    )}
                    {a.altera_vigencia && (
                      <>Vigência até: {fmtDate(a.data_fim_anterior)} → {fmtDate(a.vigencia_nova_fim)}</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1 shrink-0">
                {a.arquivo_path && (
                  <Button variant="ghost" size="sm" onClick={() => abrirArquivo(a.id)}>
                    <FileText className="h-4 w-4 mr-1" /> Arquivo
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => abrirEditar(a)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmar(a)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AditivoDialog
        aberto={abrir}
        onClose={() => setAbrir(false)}
        contratoId={contratoId}
        editando={editando}
        onSaved={() => { setAbrir(false); carregar(); }}
        salvarFn={upFn}
      />

      <Dialog open={!!confirmar} onOpenChange={(v) => { if (!v) setConfirmar(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover aditivo?</DialogTitle>
            <DialogDescription>
              Esta ação não desfaz automaticamente as alterações que este aditivo já aplicou ao
              contrato (valor, vigência ou obrigações). Ela apenas remove o registro do aditivo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(null)} disabled={removendo}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarRemover} disabled={removendo}>
              {removendo ? "Removendo…" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AditivoDialog({
  aberto,
  onClose,
  contratoId,
  editando,
  onSaved,
  salvarFn,
}: {
  aberto: boolean;
  onClose: () => void;
  contratoId: string;
  editando: Aditivo | null;
  onSaved: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  salvarFn: any;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [numero, setNumero] = useState("");
  const [dataAss, setDataAss] = useState("");
  const [alteraValor, setAlteraValor] = useState(false);
  const [alteraVig, setAlteraVig] = useState(false);
  const [alteraEsc, setAlteraEsc] = useState(false);
  const [valorNovo, setValorNovo] = useState<string>("");
  const [novaFim, setNovaFim] = useState("");
  const [resumo, setResumo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [arquivo, setArquivo] = useState<File | null>(null);

  useEffect(() => {
    if (aberto) {
      setNumero(editando?.numero ?? "");
      setDataAss(editando?.data_assinatura ?? new Date().toISOString().slice(0, 10));
      setAlteraValor(editando?.altera_valor ?? false);
      setAlteraVig(editando?.altera_vigencia ?? false);
      setAlteraEsc(editando?.altera_escopo ?? false);
      setValorNovo(editando?.valor_novo != null ? String(editando.valor_novo) : "");
      setNovaFim(editando?.vigencia_nova_fim ?? "");
      setResumo(editando?.resumo_alteracoes ?? "");
      setArquivo(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [aberto, editando]);

  async function ler(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
      r.onload = () => {
        const s = String(r.result ?? "");
        resolve(s.includes(",") ? s.split(",", 2)[1] : s);
      };
      r.readAsDataURL(f);
    });
  }

  async function salvar() {
    if (!alteraValor && !alteraVig && !alteraEsc) {
      toast.error("Selecione ao menos um tipo de alteração.");
      return;
    }
    if (resumo.trim().length < 3) {
      toast.error("Descreva o que foi alterado.");
      return;
    }
    const valorNum = alteraValor ? Number(valorNovo.replace(",", ".")) : null;
    if (alteraValor && (!valorNum || valorNum <= 0)) {
      toast.error("Informe o novo valor."); return;
    }
    if (alteraVig && !/^\d{4}-\d{2}-\d{2}$/.test(novaFim)) {
      toast.error("Informe a nova data de fim."); return;
    }
    setSalvando(true);
    try {
      let b64: string | null = null;
      if (arquivo) {
        if (arquivo.size > 10 * 1024 * 1024) { toast.error("Arquivo maior que 10 MB."); setSalvando(false); return; }
        b64 = await ler(arquivo);
      }
      await salvarFn({
        data: {
          id: editando?.id,
          contratoId,
          numero: numero.trim() || null,
          dataAssinatura: dataAss,
          alteraValor, alteraVigencia: alteraVig, alteraEscopo: alteraEsc,
          valorNovo: alteraValor ? valorNum : null,
          vigenciaNovaFim: alteraVig ? novaFim : null,
          resumoAlteracoes: resumo.trim(),
          arquivoBase64: b64,
          arquivoNome: arquivo?.name ?? null,
          arquivoMime: arquivo?.type ?? null,
        },
      });
      toast.success(editando ? "Aditivo atualizado." : "Aditivo registrado.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar aditivo.");
    } finally { setSalvando(false); }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar aditivo" : "Novo aditivo"}</DialogTitle>
          <DialogDescription>
            Registre alterações formais ao contrato. Efeitos como valor e vigência são aplicados
            ao contrato após a confirmação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ad-num">Número (opcional)</Label>
              <Input id="ad-num" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="1" />
            </div>
            <div>
              <Label htmlFor="ad-dt">Data de assinatura</Label>
              <Input id="ad-dt" type="date" value={dataAss} onChange={(e) => setDataAss(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">O que este aditivo altera?</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={alteraValor} onCheckedChange={(v) => setAlteraValor(!!v)} /> Valor
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={alteraVig} onCheckedChange={(v) => setAlteraVig(!!v)} /> Vigência
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={alteraEsc} onCheckedChange={(v) => setAlteraEsc(!!v)} /> Escopo
              </label>
            </div>
          </div>
          {alteraValor && (
            <div>
              <Label htmlFor="ad-val">Novo valor (R$)</Label>
              <Input id="ad-val" inputMode="decimal" value={valorNovo}
                onChange={(e) => setValorNovo(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0,00" />
            </div>
          )}
          {alteraVig && (
            <div>
              <Label htmlFor="ad-fim">Nova data de fim</Label>
              <Input id="ad-fim" type="date" value={novaFim} onChange={(e) => setNovaFim(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="ad-res">Resumo das alterações</Label>
            <Textarea id="ad-res" value={resumo} onChange={(e) => setResumo(e.target.value)}
              rows={4} maxLength={2000} placeholder="Descreva o que foi alterado no contrato…" />
          </div>
          <div>
            <Label>Arquivo do aditivo (opcional, PDF/DOCX/TXT — até 10 MB)</Label>
            <Input ref={fileRef} type="file"
              accept=".pdf,.docx,.doc,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </div>
          {alteraValor && Number(valorNovo.replace(",", ".")) > 0 && editando?.valor_anterior != null && (
            <p className="text-xs text-muted-foreground">
              Efeito: valor do contrato passará de {fmtBRL(editando.valor_anterior)} para {fmtBRL(Number(valorNovo.replace(",", ".")))}.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar aditivo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Silence unused var when file-loaded types are stubbed by TS in some modes.
void ExternalLink;