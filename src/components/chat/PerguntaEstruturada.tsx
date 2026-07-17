import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

export type PerguntaItem = {
  id?: string;
  /** Texto da pergunta. Aceita `label` (formato antigo), `pergunta` (formato novo)
   *  ou `pregunta` (tolerância a variação/typo em espanhol emitido pela IA). */
  label?: string;
  pergunta?: string;
  pregunta?: string;
  modo?: "unica" | "multipla";
  opcoes?: string[];
  permite_outro?: boolean;
};

export type PerguntaEstruturadaDados = {
  tipo: "pergunta_estruturada";
  texto?: string;
  perguntas?: PerguntaItem[];
};

type RespostaState = {
  selecionadas: string[];
  outroAtivo: boolean;
  outroTexto: string;
};

function keyFor(p: PerguntaItem, i: number) {
  return p.id || `p${i}`;
}

function labelDe(p: PerguntaItem, i: number): string {
  return (p.pergunta ?? p.pregunta ?? p.label ?? `Pergunta ${i + 1}`).toString();
}

export function PerguntaEstruturada({
  dados,
  disabled,
  onResponder,
}: {
  dados: PerguntaEstruturadaDados;
  disabled?: boolean;
  onResponder: (texto: string) => void;
}) {
  const perguntas = dados.perguntas ?? [];
  const [respostas, setRespostas] = useState<Record<string, RespostaState>>(() => {
    const init: Record<string, RespostaState> = {};
    perguntas.forEach((p, i) => {
      init[keyFor(p, i)] = { selecionadas: [], outroAtivo: false, outroTexto: "" };
    });
    return init;
  });
  const [enviado, setEnviado] = useState(false);

  const update = (k: string, patch: Partial<RespostaState>) =>
    setRespostas((prev) => ({ ...prev, [k]: { ...prev[k], ...patch } }));

  const handleEnviar = () => {
    const linhas: string[] = ["[Respostas estruturadas]"];
    perguntas.forEach((p, i) => {
      const k = keyFor(p, i);
      const r = respostas[k];
      const valores = [...r.selecionadas];
      if (r.outroAtivo && r.outroTexto.trim()) valores.push(r.outroTexto.trim());
      if (valores.length === 0) return;
      linhas.push(`${labelDe(p, i)}: ${valores.join(", ")}`);
    });
    linhas.push("[/Respostas estruturadas]");
    setEnviado(true);
    onResponder(linhas.join("\n"));
  };

  const bloqueado = disabled || enviado;

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      {dados.texto && (
        <p className="text-sm text-foreground whitespace-pre-wrap">{dados.texto}</p>
      )}
      {perguntas.map((p, i) => {
        const k = keyFor(p, i);
        const r = respostas[k];
        const modo = p.modo ?? "unica";
        const opcoes = p.opcoes ?? [];
        return (
          <div key={k} className="space-y-2">
            <Label className="text-sm font-medium">{labelDe(p, i)}</Label>
            {modo === "unica" ? (
              <RadioGroup
                value={r.selecionadas[0] ?? ""}
                onValueChange={(v) =>
                  update(k, { selecionadas: [v], outroAtivo: false })
                }
                disabled={bloqueado}
              >
                {opcoes.map((op) => (
                  <div key={op} className="flex items-center gap-2">
                    <RadioGroupItem value={op} id={`${k}-${op}`} disabled={bloqueado} />
                    <Label htmlFor={`${k}-${op}`} className="font-normal cursor-pointer">
                      {op}
                    </Label>
                  </div>
                ))}
                {p.permite_outro && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem
                      value="__outro__"
                      id={`${k}-outro`}
                      checked={r.outroAtivo}
                      onClick={() =>
                        update(k, { selecionadas: [], outroAtivo: true })
                      }
                      disabled={bloqueado}
                    />
                    <Label htmlFor={`${k}-outro`} className="font-normal cursor-pointer">
                      Outro
                    </Label>
                  </div>
                )}
              </RadioGroup>
            ) : (
              <div className="space-y-2">
                {opcoes.map((op) => {
                  const checked = r.selecionadas.includes(op);
                  return (
                    <div key={op} className="flex items-center gap-2">
                      <Checkbox
                        id={`${k}-${op}`}
                        checked={checked}
                        disabled={bloqueado}
                        onCheckedChange={(v) =>
                          update(k, {
                            selecionadas: v
                              ? [...r.selecionadas, op]
                              : r.selecionadas.filter((x) => x !== op),
                          })
                        }
                      />
                      <Label htmlFor={`${k}-${op}`} className="font-normal cursor-pointer">
                        {op}
                      </Label>
                    </div>
                  );
                })}
                {p.permite_outro && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`${k}-outro`}
                      checked={r.outroAtivo}
                      disabled={bloqueado}
                      onCheckedChange={(v) => update(k, { outroAtivo: Boolean(v) })}
                    />
                    <Label htmlFor={`${k}-outro`} className="font-normal cursor-pointer">
                      Outro
                    </Label>
                  </div>
                )}
              </div>
            )}
            {p.permite_outro && r.outroAtivo && (
              <Input
                placeholder="Especifique…"
                value={r.outroTexto}
                disabled={bloqueado}
                onChange={(e) => update(k, { outroTexto: e.target.value })}
              />
            )}
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        onClick={handleEnviar}
        disabled={bloqueado}
      >
        {enviado ? "Respostas enviadas" : "Enviar respostas"}
      </Button>
    </div>
  );
}

export function tryParsePerguntaEstruturada(text: string): PerguntaEstruturadaDados | null {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // ESTRATÉGIA 1: parse direto se começa com {
  if (trimmed.startsWith("{")) {
    const result = tentarParse(trimmed);
    if (result) return result;
  }

  // ESTRATÉGIA 2: bloco fenced ```json ... ``` ou ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    const candidato = fenceMatch[1].trim();
    if (candidato.startsWith("{")) {
      const result = tentarParse(candidato);
      if (result) return result;
    }
  }

  // ESTRATÉGIA 3: JSON em qualquer posição, prosa antes/depois
  if (trimmed.includes('"pergunta_estruturada"')) {
    const jsonStart = trimmed.indexOf("{");
    if (jsonStart === -1) return null;
    const jsonBlock = extrairJsonBalanceado(trimmed, jsonStart);
    if (jsonBlock) {
      const result = tentarParse(jsonBlock);
      if (result) return result;
    }
  }

  return null;
}

function tentarParse(candidato: string): PerguntaEstruturadaDados | null {
  try {
    const parsed = JSON.parse(candidato);
    if (parsed?.tipo !== "pergunta_estruturada") return null;
    if (!Array.isArray(parsed.perguntas)) return null;
    if (parsed.perguntas.length === 0) return null;
    const perguntasValidas = parsed.perguntas.every((p: PerguntaItem) =>
      p
      && (typeof p.pergunta === "string" || typeof p.pregunta === "string" || typeof p.label === "string")
      && (p.modo === undefined || p.modo === "unica" || p.modo === "multipla")
      && Array.isArray(p.opcoes)
      && p.opcoes.length > 0,
    );
    if (!perguntasValidas) return null;
    return parsed as PerguntaEstruturadaDados;
  } catch {
    return null;
  }
}

function extrairJsonBalanceado(text: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = startIndex; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === "\\") {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth++;
    if (char === "}") {
      depth--;
      if (depth === 0) return text.substring(startIndex, i + 1);
    }
  }
  return null;
}