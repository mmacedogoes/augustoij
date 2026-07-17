
# Confirmação obrigatória de e-mail no signup

## Objetivo
Exigir que o usuário confirme o e-mail antes do primeiro login e conectar a jornada: cadastro → confirmação → pagamento → acesso liberado sem novo login, tudo com identidade visual Augusto.IJ.

## 1. Backend — Supabase Auth
- Chamar `supabase--configure_auth` com `auto_confirm_email: false` e manter `password_hibp_enabled: true`, `disable_signup: false`, `external_anonymous_users_enabled: false`.
- Consequência: `supabase.auth.signUp()` passa a retornar `session: null` até o clique no link de confirmação. Nenhuma mudança em trigger `handle_new_user` (já cria `profiles` mesmo antes da confirmação).

## 2. Signup (`src/routes/signup.tsx`)
- Após `signUp()` bem-sucedido:
  - Não navegar para `/onboarding` nem `/app/assinatura`.
  - Trocar o card por um estado "Confirme seu e-mail": ícone, título "Falta pouco!", texto pedindo verificar a caixa de entrada (e spam) no endereço `X`, botão secundário "Reenviar e‑mail" (chama `supabase.auth.resend`) e contador visual de 10s.
  - Após 10s, `navigate({ to: "/login" })` automaticamente. Toast informativo.
- Ajustar `emailRedirectTo`: se veio com `?plano=...&ciclo=...`, apontar para `${origin}/auth/confirmar?plano=...&ciclo=...`; senão `${origin}/auth/confirmar`.
- Persistir intenção de plano em `localStorage` (`ij:plano_pos_confirmacao`) como fallback, já que alguns provedores de e-mail podem strip query params.
- Manter envio dos e-mails de boas-vindas/dicas (fire-and-forget) — Supabase já dispara o de confirmação separadamente via template padrão.

## 3. Nova rota pública `/auth/confirmar` (`src/routes/auth.confirmar.tsx`)
- `ssr: false`, valida search `{ plano?, ciclo? }`.
- No mount:
  1. Chama `supabase.auth.getSession()`; se ainda não há sessão (link expirado / e-mail não confirmado), exibe estado de erro com CTA para `/login`.
  2. Se há sessão, lê plano/ciclo do search **ou** do `localStorage` fallback e limpa a chave.
  3. Se há plano pago → `navigate({ to: "/app/assinatura", search: { plano, ciclo } })`.
  4. Sem plano → `navigate({ to: "/onboarding" })`.
- UI: logo AugustoLogo centralizado, spinner + "Confirmando seu e-mail…" nos tokens do design system.

## 4. Retorno pós-pagamento sem novo login
- O webhook `asaas-webhook` já promove `plano_config_id` e libera acesso; não muda.
- Em `src/routes/_authenticated/app.assinatura.tsx`:
  - Após `criar()` bem-sucedido, ao invés de só redirecionar para `res.payment_url`, salvar `localStorage.setItem("ij:pos_pagamento_redirect", "/onboarding")` (ou `/app` se onboarding completo) antes do `window.location.href`.
  - Como o usuário volta do Asaas para uma URL de retorno (a página do Asaas oferece botão "Voltar"), configurar `callbackUrl` na criação da assinatura em `src/lib/asaas.functions.ts` apontando para `${SITE_URL}/app/assinatura/retorno`.
- Nova rota `_authenticated/app.assinatura.retorno.tsx`:
  - Faz `useQuery` polling curto (a cada 2s por até 20s) em uma nova server fn `getStatusAssinaturaAtual` que lê `subscriptions.status` + `plano_config_id`.
  - Enquanto pendente: card "Confirmando seu pagamento…" com spinner.
  - Ao ficar `active`: toast "Plano ativado!" e `navigate` para `/app/condominios` se não houver condomínio cadastrado, senão `/app`.
  - Timeout: mostra CTA "Ir para o painel" (o webhook eventualmente promove).

## 5. Identidade visual em todas as telas do fluxo
- Signup, `/auth/confirmar`, `/app/assinatura`, `/app/assinatura/retorno` e `/login` já usam `bg-background`/`text-foreground`/`text-primary` — auditar e adicionar onde faltar:
  - `AugustoLogo variant="stacked"` no topo de cada tela pública.
  - Botões primários com `Button` shadcn (tokens já mapeados).
  - Substituir qualquer cor literal remanescente por tokens (`primary`, `card`, `muted-foreground`).

## Detalhes técnicos
- **Server fn nova**: `getStatusAssinaturaAtual` em `src/lib/asaas.functions.ts` com `.middleware([requireSupabaseAuth])` retornando `{ status, plano_config_id, temCondominio }`.
- **Template de e-mail de confirmação**: se ainda estiver no default do Supabase, escalar depois via `email_domain--scaffold_auth_email_templates`; fora do escopo desta etapa a menos que solicitado.
- **Rate limit**: manter `auth-check` para `signup` como já existe.

## Riscos
- Se `auto_confirm_email` já estava ligado por padrão, usuários antigos (já confirmados) não são afetados — apenas novos cadastros.
- Query params em `emailRedirectTo` só funcionam se estiverem na allowlist de Redirect URLs do Supabase; a URL base `${origin}/auth/confirmar` precisa ser adicionada — item de operação, não de código; documentar no closing.
