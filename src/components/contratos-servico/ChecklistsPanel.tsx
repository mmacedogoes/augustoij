import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Check, X, Minus, ChevronLeft, ChevronRight, AlertTriangle,
  ListTodo, CheckCircle2, ShieldAlert, MessageSquare, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  gerarChecklistsDoContrato,
  getChecklistsDoContrato,
  marcarItemChecklist,
  type ChecklistCard,
  type ChecklistCardItem,
} from "@/lib/contratos-servico/checklists.functions";

type Situacao = "pendente" | "conforme" | "nao_conforme" | "nao_se_aplica";
type Coluna = "a_fazer" | "em_dia" | "atencao";

const TITULOS_TIPO: Record<string, string> = {
  fiscalizacao: "Fiscalização",
  pagamento: "Pagamento",
  tributario: "Tributário",
  trabalhista: "Trabalhista",
};

function primeiroDiaMesAtual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function addMes(comp: string, delta: number): string {
  const [y, m] = comp.split("-").map((n) => Number(n));
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}
function rotuloCompetencia(comp: string): string {
  const [y, m] = comp.split("-").map((n) => Number(n));
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${nomes[m - 1]} de ${y}`;
}

function colunaDaSituacao(s: Situacao): Coluna {
  if (s === "nao_conforme") return "atencao";
  if (s === "conforme" || s === "nao_se_aplica") return "em_dia";
  return "a_fazer";
}

type ItemFlat = {
  item: ChecklistCardItem;
  cardId: string;
  cardTipo: string;
  cardTitulo: string;
  periodoId: string | null;
  readOnly: boolean;
};

export function ChecklistsPanel({ contratoId, readOnly = false }: { contratoId: string; readOnly?: boolean }) {
  const getFn = useServerFn(getChecklistsDoContrato);
  const marcarFn = useServerFn(marcarItemChecklist);
  const gerarFn = useServerFn(gerarChecklistsDoContrato);

  const [competencia, setCompetencia] = useState<string>(primeiroDiaMesAtual());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<{
    cards: ChecklistCard[];
    intervalo: { inferior: string; superior: string };
    encerrado_ou_suspenso: boolean;
  } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [pendente, setPendente] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    getFn({ data: { contratoId, competencia } })
      .then((r) => setDados(r))
      .catch((e: Error) => {
        setErro(e.message);
        toast.error(e.message);
      })
      .finally(() => setCarregando(false));
  }, [getFn, contratoId, competencia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const podeVoltar = useMemo(() => {
    if (!dados) return false;
    return addMes(competencia, -1) >= dados.intervalo.inferior;
  }, [dados, competencia]);
  const podeAvancar = useMemo(() => {
    if (!dados) return false;
    return addMes(competencia, 1) <= dados.intervalo.superior;
  }, [dados, competencia]);

  async function handleMarcar(
    periodoId: string | null,
    itemId: string,
    proxima: Situacao,
    observacao: string | null,
  ) {
    if (readOnly) {
      toast.error("Modo suporte: não é possível alterar checklists.");
      return;
    }
    if (!periodoId) {
      toast.error("Período não disponível para esta competência.");
      return;
    }
    setPendente(itemId);
    try {
      await marcarFn({ data: { periodoId, itemId, situacao: proxima, observacao } });
      await new Promise<void>((r) => {
        getFn({ data: { contratoId, competencia } })
          .then((res) => { setDados(res); })
          .catch(() => {})
          .finally(() => r());
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar o item.");
    } finally {
      setPendente(null);
    }
  }

  async function handleGerar() {
    setGerando(true);
    try {
      await gerarFn({ data: { contratoId } });
      toast.success("Checklists gerados.");
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar os checklists.");
    } finally {
      setGerando(false);
    }
  }

  if (carregando && !dados) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando checklists…
      </div>
    );
  }
  if (erro && !dados) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {erro}
      </div>
    );
  }
  if (!dados) return null;

  const vazio = dados.cards.length === 0;

  const flat: ItemFlat[] = dados.cards.flatMap((c) =>
    c.itens.map((it) => ({
      item: it,
      cardId: c.id,
      cardTipo: c.tipo,
      cardTitulo: c.titulo,
      periodoId: c.periodo.id,
      readOnly: c.somente_leitura,
    })),
  );
  const grupos: Record<Coluna, ItemFlat[]> = { a_fazer: [], em_dia: [], atencao: [] };
  for (const f of flat) {
    const s = (f.item.marcacao?.situacao ?? "pendente") as Situacao;
    grupos[colunaDaSituacao(s)].push(f);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--app-radius)] border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCompetencia((c) => addMes(c, -1))}
            disabled={!podeVoltar}
            aria-label="Mês anterior"
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[11rem] text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Competência
            </p>
            <p className="font-serif text-base capitalize text-primary">{rotuloCompetencia(competencia)}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCompetencia((c) => addMes(c, 1))}
            disabled={!podeAvancar}
            aria-label="Próximo mês"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {dados.encerrado_ou_suspenso ? (
          <span className="text-xs text-muted-foreground">
            Contrato encerrado ou suspenso — em modo leitura.
          </span>
        ) : (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <ContadorInline cor="augusto-gold" total={grupos.a_fazer.length} label="a fazer" />
            <ContadorInline cor="augusto-green" total={grupos.em_dia.length} label="em dia" />
            <ContadorInline cor="destructive" total={grupos.atencao.length} label="atenção" />
          </div>
        )}
      </div>

      {vazio ? (
        <Card className="app-card p-8 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Este contrato ainda não tem checklists gerados.
          </p>
          <Button onClick={handleGerar} disabled={gerando} variant="augusto">
            {gerando ? "Gerando…" : "Gerar checklists deste contrato"}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <Coluna
            titulo="A fazer"
            icon={<ListTodo className="h-4 w-4" />}
            cor="augusto-gold"
            itens={grupos.a_fazer}
            onMarcar={handleMarcar}
            pendente={pendente}
            vazioTexto="Nenhum item aguardando."
          />
          <Coluna
            titulo="Em dia"
            icon={<CheckCircle2 className="h-4 w-4" />}
            cor="augusto-green"
            itens={grupos.em_dia}
            onMarcar={handleMarcar}
            pendente={pendente}
            vazioTexto="Marque os itens conformes para preencher esta lista."
          />
          <Coluna
            titulo="Atenção"
            icon={<ShieldAlert className="h-4 w-4" />}
            cor="destructive"
            itens={grupos.atencao}
            onMarcar={handleMarcar}
            pendente={pendente}
            vazioTexto="Sem não conformidades — ótimo!"
          />
        </div>
      )}
    </div>
  );
}

function ContadorInline({ cor, total, label }: { cor: string; total: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          cor === "augusto-gold" && "bg-augusto-gold",
          cor === "augusto-green" && "bg-augusto-green",
          cor === "destructive" && "bg-destructive",
        )}
      />
      <strong className="font-medium text-foreground">{total}</strong> {label}
    </span>
  );
}

function Coluna({
  titulo, icon, cor, itens, onMarcar, pendente, vazioTexto,
}: {
  titulo: string;
  icon: React.ReactNode;
  cor: "augusto-gold" | "augusto-green" | "destructive";
  itens: ItemFlat[];
  onMarcar: (periodoId: string | null, itemId: string, proxima: Situacao, obs: string | null) => void;
  pendente: string | null;
  vazioTexto: string;
}) {
  const acento =
    cor === "augusto-gold"
      ? "border-t-augusto-gold/70 bg-augusto-gold/[0.03]"
      : cor === "augusto-green"
        ? "border-t-augusto-green/70 bg-augusto-green/[0.03]"
        : "border-t-destructive/70 bg-destructive/[0.03]";
  const chip =
    cor === "augusto-gold"
      ? "bg-augusto-gold/15 text-augusto-gold"
      : cor === "augusto-green"
        ? "bg-augusto-green/15 text-augusto-green"
        : "bg-destructive/15 text-destructive";
  return (
    <Card className={cn("border-t-4 p-4", acento)}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("grid h-7 w-7 place-items-center rounded-full", chip)}>{icon}</span>
          <h4 className="font-serif text-base text-primary">{titulo}</h4>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", chip)}>{itens.length}</span>
      </div>
      {itens.length === 0 ? (
        <p className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
          {vazioTexto}
        </p>
      ) : (
        <ul className="space-y-2">
          {itens.map((f) => (
            <ChecklistItemRow
              key={f.item.id}
              flat={f}
              onMarcar={onMarcar}
              carregando={pendente === f.item.id}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ChecklistItemRow({
  flat, onMarcar, carregando,
}: {
  flat: ItemFlat;
  onMarcar: (periodoId: string | null, itemId: string, proxima: Situacao, obs: string | null) => void;
  carregando: boolean;
}) {
  const { item, periodoId, readOnly, cardTipo, cardTitulo } = flat;
  const [obsAberto, setObsAberto] = useState(false);
  const [obs, setObs] = useState<string>(item.marcacao?.observacao ?? "");
  const situacao = (item.marcacao?.situacao ?? "pendente") as Situacao;

  const clique = (alvo: Situacao) => {
    if (readOnly) return;
    const proxima: Situacao = situacao === alvo ? "pendente" : alvo;
    onMarcar(periodoId, item.id, proxima, obs.trim().length > 0 ? obs.trim() : null);
  };

  const tipoLabel = TITULOS_TIPO[cardTipo] ?? cardTitulo;
  const destaqueTrab = cardTipo === "trabalhista";

  return (
    <li
      className={cn(
        "group rounded-lg border border-border/60 bg-background p-3 transition-all duration-200",
        "hover:border-augusto-gold/40 hover:shadow-sm",
        carregando && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
                destaqueTrab
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {tipoLabel}
            </span>
            {destaqueTrab && situacao === "nao_conforme" ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                <AlertTriangle className="h-3 w-3" /> crítico
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-snug text-foreground">{item.descricao}</p>
          {item.base_legal ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.base_legal}</p>
          ) : null}
          {item.marcacao && item.marcacao.marcado_em ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {item.marcacao.marcado_por_nome || "usuário"} · {new Date(item.marcacao.marcado_em).toLocaleDateString("pt-BR")}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1">
        <BotaoMarcar
          ativo={situacao === "conforme"}
          variante="ok"
          label="Conforme"
          disabled={readOnly}
          onClick={() => clique("conforme")}
          icon={<Check className="h-3.5 w-3.5" />}
        />
        <BotaoMarcar
          ativo={situacao === "nao_conforme"}
          variante="erro"
          label="Não conforme"
          disabled={readOnly}
          onClick={() => clique("nao_conforme")}
          icon={<X className="h-3.5 w-3.5" />}
        />
        <BotaoMarcar
          ativo={situacao === "nao_se_aplica"}
          variante="neutro"
          label="Não se aplica"
          disabled={readOnly}
          onClick={() => clique("nao_se_aplica")}
          icon={<Minus className="h-3.5 w-3.5" />}
        />
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-primary"
          onClick={() => setObsAberto((v) => !v)}
        >
          <MessageSquare className="h-3 w-3" />
          {obs ? "obs" : "nota"}
        </button>
      </div>

      {obsAberto ? (
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Observação sobre este item (opcional)"
          className="mt-2 text-xs"
          disabled={readOnly}
          maxLength={1000}
          rows={2}
          onBlur={() => {
            if (readOnly) return;
            if (situacao === "pendente") return;
            if ((item.marcacao?.observacao ?? "") === obs) return;
            onMarcar(periodoId, item.id, situacao, obs.trim().length > 0 ? obs.trim() : null);
          }}
        />
      ) : null}
    </li>
  );
}

function BotaoMarcar({
  ativo,
  variante,
  label,
  disabled,
  onClick,
  icon,
}: {
  ativo: boolean;
  variante: "ok" | "erro" | "neutro";
  label: string;
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  const base =
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all duration-200 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold/70";
  const inativo = "border-border/60 text-muted-foreground hover:bg-muted hover:text-foreground";
  const ok = "border-augusto-green/50 bg-augusto-green/10 text-augusto-green";
  const erro = "border-destructive/60 bg-destructive/10 text-destructive";
  const neutro = "border-border bg-muted text-foreground";
  const classe = ativo
    ? variante === "ok"
      ? ok
      : variante === "erro"
        ? erro
        : neutro
    : inativo;
  return (
    <button
      type="button"
      className={`${base} ${classe}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-pressed={ativo}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}