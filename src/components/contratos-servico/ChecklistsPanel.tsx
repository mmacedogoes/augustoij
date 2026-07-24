import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Minus, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  gerarChecklistsDoContrato,
  getChecklistsDoContrato,
  marcarItemChecklist,
  type ChecklistCard,
  type ChecklistCardItem,
} from "@/lib/contratos-servico/checklists.functions";

type Situacao = "pendente" | "conforme" | "nao_conforme" | "nao_se_aplica";

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

export function ChecklistsPanel({ contratoId }: { contratoId: string }) {
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
    if (!periodoId) {
      toast.error("Período não disponível para esta competência.");
      return;
    }
    try {
      await marcarFn({ data: { periodoId, itemId, situacao: proxima, observacao } });
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível marcar o item.");
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
    return <p className="text-sm text-muted-foreground">Carregando checklists…</p>;
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCompetencia((c) => addMes(c, -1))}
            disabled={!podeVoltar}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[12rem] text-center">
            <p className="text-xs text-muted-foreground">Competência</p>
            <p className="text-sm font-medium capitalize">{rotuloCompetencia(competencia)}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCompetencia((c) => addMes(c, 1))}
            disabled={!podeAvancar}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {dados.encerrado_ou_suspenso ? (
          <span className="text-xs text-muted-foreground">
            Contrato encerrado ou suspenso — checklist em modo leitura.
          </span>
        ) : null}
      </div>

      {vazio ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            Este contrato ainda não tem checklists gerados.
          </p>
          <Button onClick={handleGerar} disabled={gerando}>
            {gerando ? "Gerando…" : "Gerar checklists deste contrato"}
          </Button>
        </Card>
      ) : (
        dados.cards.map((card) => (
          <ChecklistCardView
            key={card.id}
            card={card}
            onMarcar={handleMarcar}
            readOnly={card.somente_leitura}
          />
        ))
      )}
    </div>
  );
}

function ChecklistCardView({
  card,
  onMarcar,
  readOnly,
}: {
  card: ChecklistCard;
  onMarcar: (
    periodoId: string | null,
    itemId: string,
    proxima: Situacao,
    observacao: string | null,
  ) => void;
  readOnly: boolean;
}) {
  const destaqueTrab = card.tipo === "trabalhista";
  const naoConformes = card.progresso.nao_conformes;
  return (
    <Card
      className={cn(
        "p-4",
        destaqueTrab && "border-l-4 border-l-[hsl(var(--accent,45_70%_45%))]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h4 className="text-base font-serif text-primary">{card.titulo}</h4>
          <p className="text-xs text-muted-foreground">
            {card.progresso.marcados}/{card.progresso.total} verificados —{" "}
            {card.periodo.status === "concluido" ? "Concluído" : "Aberto"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {destaqueTrab && naoConformes > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {naoConformes} não conforme{naoConformes > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </div>

      {card.itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item ativo neste checklist.</p>
      ) : (
        <ul className="space-y-3">
          {card.itens.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              periodoId={card.periodo.id}
              onMarcar={onMarcar}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ChecklistItemRow({
  item,
  periodoId,
  onMarcar,
  readOnly,
}: {
  item: ChecklistCardItem;
  periodoId: string | null;
  onMarcar: (
    periodoId: string | null,
    itemId: string,
    proxima: Situacao,
    observacao: string | null,
  ) => void;
  readOnly: boolean;
}) {
  const [obsAberto, setObsAberto] = useState(false);
  const [obs, setObs] = useState<string>(item.marcacao?.observacao ?? "");
  const situacao = (item.marcacao?.situacao ?? "pendente") as Situacao;

  const clique = (alvo: Situacao) => {
    if (readOnly) return;
    const proxima: Situacao = situacao === alvo ? "pendente" : alvo;
    onMarcar(periodoId, item.id, proxima, obs.trim().length > 0 ? obs.trim() : null);
  };

  return (
    <li className="rounded-md border border-border/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground">{item.descricao}</p>
          {item.base_legal ? (
            <p className="text-xs text-muted-foreground mt-1">{item.base_legal}</p>
          ) : null}
          {item.marcacao && item.marcacao.marcado_em ? (
            <p className="text-[11px] text-muted-foreground mt-1">
              Marcado por {item.marcacao.marcado_por_nome || "usuário"} em{" "}
              {new Date(item.marcacao.marcado_em).toLocaleString("pt-BR")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <BotaoMarcar
            ativo={situacao === "conforme"}
            variante="ok"
            label="Conforme"
            disabled={readOnly}
            onClick={() => clique("conforme")}
            icon={<Check className="h-4 w-4" />}
          />
          <BotaoMarcar
            ativo={situacao === "nao_conforme"}
            variante="erro"
            label="Não conforme"
            disabled={readOnly}
            onClick={() => clique("nao_conforme")}
            icon={<X className="h-4 w-4" />}
          />
          <BotaoMarcar
            ativo={situacao === "nao_se_aplica"}
            variante="neutro"
            label="Não se aplica"
            disabled={readOnly}
            onClick={() => clique("nao_se_aplica")}
            icon={<Minus className="h-4 w-4" />}
          />
        </div>
      </div>

      <button
        type="button"
        className="mt-2 text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
        onClick={() => setObsAberto((v) => !v)}
      >
        {obsAberto ? "Ocultar observação" : "Adicionar observação"}
      </button>
      {obsAberto ? (
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Observação sobre este item (opcional)"
          className="mt-2 text-sm"
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
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-40";
  const inativo = "border-border/60 text-muted-foreground hover:bg-muted";
  const ok = "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
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
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}