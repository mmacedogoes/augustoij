import { useState } from "react";
import { Icon } from "@iconify/react";
import { Reveal } from "@/components/landing/Reveal";
import { useServerFn } from "@tanstack/react-start";
import { SectionLabel } from "@/components/landing/SectionLabel";
import { OutlineButton } from "@/components/landing/OutlineButton";
import { subscribeContratosWaitlist } from "@/lib/contratos-waitlist.functions";

const CAPACIDADES = [
  {
    titulo: "Mapa de obrigações",
    desc: "Cada dever do condomínio e do prestador ligado à cláusula que o criou.",
  },
  {
    titulo: "Checklist mensal de fiscalização",
    desc: "O registro de que você conferiu execução, nota, pagamento e documentação.",
  },
  {
    titulo: "Retenções e obrigações tributárias",
    desc: "ISS na fonte e afins sinalizados conforme a lei do município.",
  },
  {
    titulo: "Alerta de risco trabalhista",
    desc: "A exposição da terceirização vira item de conferência mensal.",
  },
  {
    titulo: "Agenda de vigências e reajustes",
    desc: "O reajuste chega avisado, não descoberto na fatura.",
  },
  {
    titulo: "Análise com semáforo",
    desc: "O contrato revisado cláusula a cláusula, sempre que precisar.",
  },
];

export function GestaoContratos() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const subscribe = useServerFn(subscribeContratosWaitlist);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      await subscribe({ data: { email, origem: "landing-gestao-contratos" } });
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.");
    }
  }

  return (
    <section
      id="gestao-contratos"
      className="relative overflow-hidden bg-verde-profundo px-6 py-[var(--spacing-section-mobile)] md:py-[var(--spacing-section)]"
    >
      {/* Radial atrás da coluna direita */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 78% 45%, hsl(150 94% 14% / 0.9), transparent 55%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[var(--container-container)]">
        <div className="grid gap-14 md:grid-cols-[45%_55%] md:gap-10">
          {/* Coluna esquerda */}
          <div>
            <span
              className="inline-flex items-center rounded-full border px-3 py-1 font-body text-[11px] font-medium uppercase text-dourado-claro"
              style={{ letterSpacing: "0.2em", borderColor: "hsl(33 40% 54% / 0.55)" }}
            >
              Em breve · Gestão de contratos
            </span>

            <h2 className="t-h2 mt-5 text-cream">
              O contrato não termina quando é assinado. É aí que ele começa a custar.
            </h2>

            <p className="mt-5 font-body text-[14px] leading-relaxed text-off/80">
              O prejuízo raramente está na assinatura. Está nos meses seguintes: o reajuste aplicado errado, a renovação automática que ninguém viu chegar, a obrigação que o prestador nunca cumpriu e ninguém cobrou, a retenção tributária esquecida, a folha de pagamento da terceirizada que nunca foi conferida. Em breve, o Augusto.IJ passa a acompanhar tudo isso por você.
            </p>

            <ul className="mt-8 flex flex-col gap-4">
              {CAPACIDADES.map((c) => (
                <li key={c.titulo} className="flex gap-3">
                  <Icon icon="ph:check" className="mt-0.5 h-5 w-5 shrink-0 text-dourado" />
                  <div>
                    <div className="font-body text-[14.5px] font-medium text-off">{c.titulo}</div>
                    <div className="mt-0.5 font-body text-[12.5px] leading-relaxed text-off/70">
                      {c.desc}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {!open && status !== "done" && (
                <OutlineButton
                  type="button"
                  tone="light"
                  onClick={() => setOpen(true)}
                  className="w-full sm:w-auto"
                >
                  Quero ser avisado no lançamento
                </OutlineButton>
              )}

              {open && status !== "done" && (
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
                >
                  <label htmlFor="waitlist-email" className="sr-only">
                    Seu e-mail
                  </label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    autoFocus
                    inputMode="email"
                    autoComplete="email"
                    maxLength={255}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full flex-1 rounded-sm border bg-transparent px-4 py-3 font-body text-[15px] text-off placeholder:text-off/45 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-dourado focus:ring-offset-2 focus:ring-offset-verde-profundo sm:w-auto"
                    style={{ borderColor: "hsl(33 40% 54% / 0.5)" }}
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="inline-flex items-center justify-center gap-2 rounded-sm bg-dourado px-6 py-3 font-body text-[15px] font-medium text-[hsl(30_60%_9%)] transition-colors duration-200 hover:bg-[hsl(33_40%_47%)] active:bg-[hsl(33_40%_42%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dourado focus-visible:ring-offset-2 focus-visible:ring-offset-verde-profundo disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {status === "loading" ? "Enviando…" : "Avisar quando abrir"}
                  </button>
                </form>
              )}

              {status === "done" && (
                <div
                  role="status"
                  className="rounded-sm border px-4 py-3 font-body text-[14px] text-dourado-claro"
                  style={{ borderColor: "hsl(33 40% 54% / 0.55)", background: "hsl(33 40% 54% / 0.08)" }}
                >
                  Anotado. Você será avisado no lançamento.
                </div>
              )}

              {status === "error" && errorMsg && (
                <p className="mt-2 font-body text-[12.5px] text-dourado-claro/80">{errorMsg}</p>
              )}

              <p className="mt-3 font-body text-[11.5px] text-off/55">
                Avisamos por e-mail quando a Gestão de Contratos abrir. Sem compromisso.
              </p>
            </div>

            <p className="mt-8 font-heading text-[15px] italic" style={{ color: "hsl(38 45% 62%)" }}>
              Fiscalizar não é zelo. É defesa.
            </p>
          </div>

          {/* Coluna direita — placeholder do painel */}
          <div
            className="relative flex items-center justify-center md:-mr-16"
            style={{ perspective: "900px" }}
          >
            <div
              className="w-full overflow-hidden bg-papel"
              style={{
                aspectRatio: "16 / 10",
                border: "1px solid hsl(33 40% 54% / 0.4)",
                borderRadius: "12px 0 0 12px",
                transform: "rotateY(-8deg) rotateX(2deg)",
                transformOrigin: "left center",
                boxShadow: "0 30px 80px -30px hsl(151 93% 6% / 0.7)",
              }}
            >
              <div className="flex h-full items-center justify-center p-6">
                <span className="font-body text-[13px] text-ardosia opacity-70">
                  produto-screenshot-painel-contratos.png
                </span>
              </div>
            </div>
          </div>

          {/* Mobile: painel flat, largura total */}
          <div className="md:hidden">
            <div
              className="w-full overflow-hidden rounded-md border bg-papel"
              style={{ aspectRatio: "16 / 10", borderColor: "hsl(33 40% 54% / 0.4)" }}
            >
              <div className="flex h-full items-center justify-center p-6">
                <span className="font-body text-[13px] text-ardosia opacity-70">
                  produto-screenshot-painel-contratos.png
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default GestaoContratos;
