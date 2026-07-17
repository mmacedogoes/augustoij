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
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { PLANS as PLAN_CONFIG, type PlanId } from "@/config/plans";
import {
  criarAssinaturaAsaas,
  getAssinaturaPendente,
  getPerfilParaAssinatura,
} from "@/lib/asaas.functions";

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
  validateSearch: (s) => searchSchema.parse(s),
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
      criar({ data: { plano_id: plano, ciclo, billing_type: billingType } }),
    onSuccess: (res) => {
      if (res.payment_url) {
        toast.success("Assinatura criada. Redirecionando para pagamento…");
        window.location.href = res.payment_url;
      } else {
        toast.success("Assinatura criada. Aguardando link de pagamento.");
        pendente.refetch();
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
      perfil.data?.cpf_cnpj &&
      perfil.data.cpf_cnpj.replace(/\D/g, "").length >= 11,
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-augusto-cream/40 to-background">
      <header className="border-b border-augusto-gold/20 bg-white/70 backdrop-blur-sm">
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
      <div>
        <h1 className="font-serif text-3xl text-augusto-green tracking-tight">
          Confirmar assinatura
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          A cobrança será vinculada à sua conta Augusto.IJ. Seu plano atual
          permanece ativo até a confirmação da primeira cobrança pelo Asaas.
        </p>
      </div>

      {/* Conta vinculada */}
      <Card className="border-augusto-green/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-augusto-green">
            <UserCheck className="h-4 w-4" />
            Conta vinculada a esta assinatura
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {perfil.isLoading ? (
            <div className="text-muted-foreground">Carregando dados da conta…</div>
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
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
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

      <Card className="border-augusto-gold/25">
        <CardHeader>
          <CardTitle className="text-lg text-augusto-green">
            Plano {planoInfo.nome}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Ciclo
            </Label>
            <RadioGroup
              value={ciclo}
              onValueChange={(v) => setCiclo(v as "mensal" | "anual")}
              className="mt-2 grid grid-cols-2 gap-3"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:border-primary/40">
                <RadioGroupItem value="mensal" id="ciclo-mensal" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Mensal</div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(preco.mensal)} / mês
                  </div>
                </div>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:border-primary/40">
                <RadioGroupItem value="anual" id="ciclo-anual" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Anual</div>
                  <div className="text-xs text-muted-foreground">
                    {fmt(preco.anualPorMes)} / mês · {fmt(preco.anualTotal)}/ano
                  </div>
                </div>
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Forma de pagamento
            </Label>
            <RadioGroup
              value={billingType}
              onValueChange={(v) => setBillingType(v as typeof billingType)}
              className="mt-2 grid gap-2 sm:grid-cols-2"
            >
              {[
                { v: "UNDEFINED", t: "Escolher no pagamento", d: "Pix, boleto ou cartão" },
                { v: "PIX", t: "Pix", d: "Confirmação em minutos" },
                { v: "BOLETO", t: "Boleto bancário", d: "Compensa em até 3 dias úteis" },
                { v: "CREDIT_CARD", t: "Cartão de crédito", d: "Renovação automática" },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:border-primary/40"
                >
                  <RadioGroupItem value={o.v} id={`bt-${o.v}`} />
                  <div>
                    <div className="text-sm font-medium">{o.t}</div>
                    <div className="text-xs text-muted-foreground">{o.d}</div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="rounded-lg bg-muted/40 p-4 flex items-baseline justify-between">
            <div className="text-sm text-muted-foreground">
              Total {ciclo === "anual" ? "anual" : "mensal"}
            </div>
            <div className="text-xl font-semibold">
              {fmt(valorAtual)}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({fmt(displayMensal)}/mês)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ambiente Sandbox Asaas · nenhum valor real será cobrado.
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <Button variant="ghost" onClick={() => navigate({ to: "/app" })}>
              Cancelar
            </Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !perfilCompleto}
              className="gap-2"
            >
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Ir para pagamento
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-augusto-slate">
        A confirmação do pagamento chega no e-mail{" "}
        <span className="font-medium text-augusto-green">
          {perfil.data?.email ?? "cadastrado"}
        </span>{" "}
        e libera automaticamente seu plano.
      </p>
      </div>
    </div>
  );
}

export default AssinaturaPage;