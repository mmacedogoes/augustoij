import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowRight, ExternalLink, Loader2, ShieldCheck, UserCheck, AlertTriangle } from "lucide-react";
import { AppSkeletonLines } from "@/components/ui/app-skeleton";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { PLANS as PLAN_CONFIG, type PlanId } from "@/config/plans";
import {
  criarAssinaturaAsaas,
  getAssinaturaPendente,
  getPerfilParaAssinatura,
} from "@/lib/asaas.functions";
import { temCpfCnpjValido } from "@/lib/formatters";

const PLAN_PRICES: Record<
  Exclude<PlanId, "gratuito" | "personalizado">,
  { mensal: number; anualPorMes: number; anualTotal: number }
> = {
  essencial: { mensal: 89, anualPorMes: 74, anualTotal: 888 },
  profissional: { mensal: 197, anualPorMes: 164, anualTotal: 1968 },
  gestao: { mensal: 347, anualPorMes: 289, anualTotal: 3468 },
  administradora: { mensal: 697, anualPorMes: 580, anualTotal: 6960 },
};

const searchSchema = z.object({
  plano: z
    .enum(["essencial", "profissional", "gestao", "administradora"])
    .default("profissional"),
  ciclo: z.enum(["mensal", "anual"]).default("mensal"),
});

export const Route = createFileRoute("/_authenticated/app/assinatura")({
  validateSearch: (
    s,
  ): {
    plano?: "essencial" | "profissional" | "gestao" | "administradora";
    ciclo?: "mensal" | "anual";
  } => searchSchema.parse(s),
  component: AssinaturaPage,
});

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AssinaturaPage() {
  const { plano, ciclo: cicloInicial } = useSearch({
    from: "/_authenticated/app/assinatura",
  }) as { plano: keyof typeof PLAN_PRICES; ciclo: "mensal" | "anual" };
  const navigate = useNavigate();
  const [ciclo, setCiclo] = useState<"mensal" | "anual">(cicloInicial);
  const [billingType, setBillingType] =
    useState<"UNDEFINED" | "PIX" | "BOLETO" | "CREDIT_CARD">("UNDEFINED");

  const criar = useServerFn(criarAssinaturaAsaas);
  const getPendente = useServerFn(getAssinaturaPendente);
  const getPerfil = useServerFn(getPerfilParaAssinatura);

  const pendente = useQuery({
    queryKey: ["assinatura-pendente"],
    queryFn: () => getPendente(),
  });
  const perfil = useQuery({
    queryKey: ["perfil-assinatura"],
    queryFn: () => getPerfil(),
  });

  const mutation = useMutation({
    mutationFn: () =>
      criar({
        data: {
          plano_id: plano,
          ciclo,
          billing_type: billingType,
          callback_url:
            typeof window !== "undefined"
              ? `${window.location.origin}/app/assinatura/retorno`
              : undefined,
        },
      }),
    onSuccess: (res) => {
      if (res.payment_url) {
        toast.success("Assinatura criada. Redirecionando para pagamento…");
        window.location.href = res.payment_url;
      } else {
        toast.success("Assinatura criada. Aguardando confirmação de pagamento.");
        navigate({ to: "/app/assinatura/retorno" });
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao criar assinatura.");
    },
  });

  const preco = PLAN_PRICES[plano];
  const planoInfo = PLAN_CONFIG[plano];
  const valorAtual =
    ciclo === "anual" ? preco.anualTotal : preco.mensal;
  const displayMensal = ciclo === "anual" ? preco.anualPorMes : preco.mensal;

  const pendenteAtiva =
    pendente.data?.asaas_subscription_id &&
    pendente.data.pending_plano_config_id &&
    pendente.data.plano_config_id !== pendente.data.pending_plano_config_id;

  const perfilCompleto = Boolean(
    perfil.data?.nome &&
      perfil.data?.email &&
      temCpfCnpjValido(perfil.data?.cpf_cnpj),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-augusto-cream/40 to-background">
      <header className="border-b border-augusto-gold/20 bg-card/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" aria-label="Voltar ao início">
            <AugustoLogo variant="horizontal" theme="light" size={180} />
          </Link>
          <span className="hidden sm:inline text-[11px] uppercase tracking-[0.18em] text-augusto-slate">
            Assinatura segura
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header className="app-page-header">
        <span className="app-eyebrow">Assinatura</span>
        <h1 className="app-title">Confirmar assinatura</h1>
        <p className="app-subtitle">
          A cobrança será vinculada à sua conta Augusto.IJ. Seu plano atual
          permanece ativo até a confirmação da primeira cobrança pelo Asaas.
        </p>
      </header>

      {/* Conta vinculada */}
      <Card className="app-card border-augusto-green/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-augusto-green">
            <UserCheck className="h-4 w-4" />
            Conta vinculada a esta assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {perfil.isLoading ? (
            <AppSkeletonLines lines={3} />
          ) : perfil.data ? (
            <>
              <div>
                <span className="text-muted-foreground">Nome: </span>
                <span className="font-medium">
                  {perfil.data.tipo_pessoa === "pj" && perfil.data.razao_social
                    ? perfil.data.razao_social
                    : perfil.data.nome}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">E-mail: </span>
                <span className="font-medium">{perfil.data.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {perfil.data.tipo_pessoa === "pj" ? "CNPJ" : "CPF"}:{" "}
                </span>
                <span className="font-medium">
                  {perfil.data.cpf_cnpj || (
                    <span className="text-destructive">não informado</span>
                  )}
                </span>
              </div>
              {!perfilCompleto && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                  <div>
                    Complete seu CPF/CNPJ na página{" "}
                    <Link to="/app/conta" className="underline font-medium">
                      Conta
                    </Link>{" "}
                    antes de prosseguir — é exigido pelo Asaas para emitir a cobrança.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-destructive">
              Não foi possível carregar seu perfil.
            </div>
          )}
        </CardContent>
      </Card>

      {pendenteAtiva && pendente.data?.asaas_payment_url && (
        <Card className="app-card border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              Você já tem uma assinatura aguardando pagamento
              {pendente.data.pending_plano_config_id
                ? ` (plano ${pendente.data.pending_plano_config_id})`
                : ""}
              .
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = pendente.data!.asaas_payment_url!;
              }}
            >
              Retomar pagamento <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="app-card border-augusto-gold/25 shadow-sm">
        <CardHeader className="border-b border-border/40 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-augusto-gold">Plano Escolhido</span>
              <CardTitle className="text-2xl font-serif text-augusto-green">
                {planoInfo.nome}
              </CardTitle>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-foreground">
                {fmt(displayMensal)}
                <span className="text-xs font-normal text-muted-foreground">/mês</span>
              </div>
              {ciclo === "anual" && (
                <div className="text-xs font-medium text-augusto-green">
                  Faturado anualmente ({fmt(preco.anualTotal)})
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Ciclo de Faturamento
              </Label>
              {ciclo === "anual" && (
                <span className="inline-flex items-center rounded-full bg-augusto-green/10 px-2 py-0.5 text-[11px] font-semibold text-augusto-green">
                  Economia de {fmt(preco.mensal * 12 - preco.anualTotal)}/ano
                </span>
              )}
            </div>
            <RadioGroup
              value={ciclo}
              onValueChange={(v) => setCiclo(v as "mensal" | "anual")}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition ${ciclo === "mensal" ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:border-primary/40"}`}>
                <RadioGroupItem value="mensal" id="ciclo-mensal" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Mensal</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmt(preco.mensal)} / mês
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">Cobrança recorrente mensal</div>
                </div>
              </label>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition relative ${ciclo === "anual" ? "border-augusto-green bg-augusto-green/5 shadow-xs ring-1 ring-augusto-green/30" : "border-border hover:border-primary/40"}`}>
                <div className="absolute -top-2.5 right-3 rounded bg-augusto-green px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
                  Melhor Valor
                </div>
                <RadioGroupItem value="anual" id="ciclo-anual" className="mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    Anual
                    <span className="text-[10px] font-normal text-augusto-green font-medium">(-17%)</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {fmt(preco.anualPorMes)} / mês · <span className="font-medium text-foreground">{fmt(preco.anualTotal)}/ano</span>
                  </div>
                  <div className="text-[11px] text-augusto-green font-medium mt-1">Garante o preço sem reajuste</div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Forma de Pagamento
            </Label>
            <RadioGroup
              value={billingType}
              onValueChange={(v) => setBillingType(v as typeof billingType)}
              className="mt-2 grid gap-2.5 sm:grid-cols-2"
            >
              {[
                { v: "UNDEFINED", t: "Escolher no checkout", d: "Pix, boleto ou cartão", tag: null },
                { v: "PIX", t: "Pix Instantâneo", d: "Liberação imediata da conta", tag: "Recomendado" },
                { v: "CREDIT_CARD", t: "Cartão de Crédito", d: "Ativação imediata e automática", tag: "Instantâneo" },
                { v: "BOLETO", t: "Boleto Bancário", d: "Compensação em até 3 dias úteis", tag: null },
              ].map((o) => (
                <label
                  key={o.v}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${billingType === o.v ? "border-primary bg-primary/5 shadow-xs" : "border-border hover:border-primary/40"}`}
                >
                  <RadioGroupItem value={o.v} id={`bt-${o.v}`} className="mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center justify-between">
                      <span>{o.t}</span>
                      {o.tag && (
                        <span className="text-[10px] font-semibold text-augusto-green bg-augusto-green/10 px-1.5 py-0.2 rounded">
                          {o.tag}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{o.d}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-medium text-foreground">
                Total a pagar agora ({ciclo === "anual" ? "Anualidade" : "1ª Mensalidade"})
              </div>
              <div className="text-2xl font-bold text-augusto-green">
                {fmt(valorAtual)}
              </div>
            </div>
            {ciclo === "anual" && (
              <div className="text-xs text-muted-foreground flex items-center justify-between border-t border-border/40 pt-2">
                <span>Equivalente mensal:</span>
                <span className="font-semibold text-foreground">{fmt(displayMensal)} / mês</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-augusto-green shrink-0" />
              <span>Criptografia SSL de 256 bits · LGPD compliance</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-augusto-gold shrink-0" />
              <span>Garantia de 7 dias com cancelamento simplificado</span>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2 border-t border-border/40">
            <Button variant="ghost" onClick={() => navigate({ to: "/app" })}>
              Voltar ao painel
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !perfilCompleto}
              className="gap-2 min-h-[42px] px-6 text-sm font-semibold shadow-sm"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Confirmar e Ir para Pagamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-augusto-slate">
        A confirmação do pagamento chega no e-mail{" "}
        <span className="font-medium text-augusto-green">
          {perfil.data?.email ?? "cadastrado"}
        </span>{" "}
        e libera automaticamente todos os recursos do seu plano.
      </p>
      </div>
    </div>
  );
}

export default AssinaturaPage;