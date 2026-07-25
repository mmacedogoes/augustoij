import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, MessageCircle, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  analisarContratoServico, getAnaliseContratoServico, type ResultadoAnalise,
} from "@/lib/contratos-servico/analise.functions";

function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch { return iso; }
}

export function AnalisePanel({
  contratoId,
  temArquivo,
  condominioId,
  prestadorNome,
  objeto,
}: {
  contratoId: string;
  temArquivo: boolean;
  condominioId: string;
  prestadorNome: string;
  objeto: string | null;
}) {
  const getFn = useServerFn(getAnaliseContratoServico);
  const runFn = useServerFn(analisarContratoServico);
  const navigate = useNavigate();
  const [carregando, setCarregando] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);
  const [geradoEm, setGeradoEm] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    getFn({ data: { contratoId } })
      .then((r) => {
        setResultado(r.resultado as ResultadoAnalise | null);
        setGeradoEm(r.gerado_em);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setCarregando(false));
  }, [getFn, contratoId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function rodar() {
    if (!temArquivo) {
      toast.info("Anexe o arquivo do contrato para gerar a análise.");
      return;
    }
    setAnalisando(true);
    try {
      const r = await runFn({ data: { contratoId } });
      setResultado(r as ResultadoAnalise);
      setGeradoEm((r as ResultadoAnalise).gerado_em);
      toast.success("Análise concluída.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na análise.");
    } finally { setAnalisando(false); }
  }

  function abrirChat() {
    // Monta a mensagem inicial do assistente com o semáforo da análise
    // já formatado em markdown, para que a conversa continue a partir daí.
    const linhas: string[] = [];
    linhas.push(
      `Analisei o contrato firmado com **${prestadorNome}**${objeto ? ` (${objeto})` : ""}. Aqui está o semáforo:\n`,
    );
    if (resultado?.resumo) linhas.push(`> ${resultado.resumo.trim()}\n`);

    function bloco(emoji: string, titulo: string, pontos: { titulo: string; detalhe: string; clausula?: string | null }[]) {
      if (!pontos || pontos.length === 0) return;
      linhas.push(`**${emoji} ${titulo}**`);
      for (const p of pontos.slice(0, 8)) {
        const suf = p.clausula ? ` _(cláusula ${p.clausula})_` : "";
        linhas.push(`- **${p.titulo}**${suf}${p.detalhe ? ` — ${p.detalhe}` : ""}`);
      }
      linhas.push("");
    }
    if (resultado) {
      bloco("🟢", "Pontos positivos", resultado.pontos_positivos);
      bloco("🟡", "Pontos de atenção", resultado.pontos_atencao);
      bloco("🔴", "Pontos negativos", resultado.pontos_negativos);
    }
    linhas.push("Sobre o que você quer aprofundar?");
    const msg = linhas.join("\n").trim();
    try {
      sessionStorage.setItem(`chat-seed-assistant-${condominioId}`, msg);
      // Limpa qualquer seed antigo de "prompt do usuário" para esta conversa
      sessionStorage.removeItem(`chat-inicial-${condominioId}`);
    } catch { /* ignora */ }
    navigate({ to: "/app/condominios/$id", params: { id: condominioId } });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-serif text-primary">Análise com o Augusto</h3>
          <p className="text-sm text-muted-foreground">
            Semáforo com pontos positivos, negativos e de atenção do contrato.
            {geradoEm ? ` Última análise: ${fmtDT(geradoEm)}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={rodar} disabled={!temArquivo || analisando}>
            {resultado ? <RefreshCw className="h-4 w-4 mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {analisando ? "Analisando…" : resultado ? "Analisar novamente" : "Analisar com Augusto"}
          </Button>
          {resultado && (
            <Button size="sm" variant="outline" onClick={abrirChat}>
              <MessageCircle className="h-4 w-4 mr-1" /> Conversar sobre este contrato
            </Button>
          )}
        </div>
      </div>

      {!temArquivo && (
        <p className="text-sm text-muted-foreground">
          A análise exige o arquivo do contrato. Anexe um PDF, DOCX ou TXT no bloco “Arquivo do
          contrato” acima e volte aqui.
        </p>
      )}

      {carregando ? (
        <div className="space-y-2">
          <div className="h-20 rounded-md bg-muted/50 animate-pulse" />
          <div className="h-20 rounded-md bg-muted/50 animate-pulse" />
        </div>
      ) : !resultado ? (
        temArquivo && (
          <p className="text-sm text-muted-foreground">
            Nenhuma análise gerada ainda. Clique em “Analisar com Augusto”.
          </p>
        )
      ) : (
        <div className="space-y-4">
          {resultado.resumo && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-foreground whitespace-pre-wrap">
              {resultado.resumo}
            </div>
          )}
          <BlocoPontos
            titulo="Pontos positivos" tone="pos" icon={<CheckCircle2 className="h-4 w-4" />}
            pontos={resultado.pontos_positivos}
          />
          <BlocoPontos
            titulo="Pontos de atenção" tone="warn" icon={<AlertTriangle className="h-4 w-4" />}
            pontos={resultado.pontos_atencao}
          />
          <BlocoPontos
            titulo="Pontos negativos" tone="neg" icon={<XCircle className="h-4 w-4" />}
            pontos={resultado.pontos_negativos}
          />
        </div>
      )}
    </Card>
  );
}

function BlocoPontos({
  titulo, tone, icon, pontos,
}: {
  titulo: string;
  tone: "pos" | "warn" | "neg";
  icon: React.ReactNode;
  pontos: { titulo: string; detalhe: string; clausula?: string | null }[];
}) {
  const cor = tone === "pos"
    ? "border-emerald-500/40 bg-emerald-500/5"
    : tone === "warn"
      ? "border-amber-500/40 bg-amber-500/5"
      : "border-red-500/40 bg-red-500/5";
  return (
    <div className={`rounded-md border ${cor} p-3`}>
      <p className="text-sm font-medium flex items-center gap-2 mb-2">{icon} {titulo}</p>
      {pontos.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nada identificado.</p>
      ) : (
        <ul className="space-y-2">
          {pontos.map((p, i) => (
            <li key={i} className="text-sm">
              <p className="font-medium text-foreground">
                {p.titulo}{p.clausula ? <span className="text-xs text-muted-foreground ml-2">— cláusula {p.clausula}</span> : null}
              </p>
              {p.detalhe && <p className="text-sm text-muted-foreground mt-0.5">{p.detalhe}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}