# Unificar período de teste grátis para 7 dias

Hoje o sistema tem três valores diferentes de "teste grátis" espalhados (3 dias, 30 dias, e um "7 dias" já correto na landing). Vou padronizar tudo em **7 dias**, mantendo intocada a lógica de **cortesia** (que continua isenta e sem trial).

## Alterações

### Backend — duração real do trial
1. `src/lib/onboarding.functions.ts` (linha 53): `3 * 24 * 60 * 60 * 1000` → `7 * 24 * 60 * 60 * 1000`.
2. Nova migração: `ALTER TABLE public.subscriptions ALTER COLUMN trial_end SET DEFAULT (now() + interval '7 days');` (hoje está em `3 days`, migração `20260627143619`).
3. Data-fix opcional na mesma migração: para assinaturas ainda `status = 'trialing'` e `cortesia = false` criadas nas últimas 24h, recalcular `trial_end = created_at + interval '7 days'` — evita que quem acabou de se cadastrar fique preso ao trial de 3 dias. (Não mexe em usuários cortesia nem em trials já expirados/convertidos.)

### Frontend — textos visíveis ao usuário
4. `src/routes/signup.tsx` linha 21 (meta description) e linha 218 ("3 dias de teste grátis. Sem cartão.") → 7 dias.
5. `src/routes/_authenticated/onboarding.tsx` linha 252 ("Você tem 3 dias de teste grátis…") → 7 dias.
6. `src/routes/termos.tsx` linha 80 ("Plano Gratuito: válido por 30 dias…") → 7 dias. As outras menções a "30 dias" no arquivo são sobre aviso de mudança de preço e retenção de dados — não são trial, ficam como estão.
7. `supabase/functions/send-welcome-email/index.ts` linha 44 ("período gratuito de 30 dias começou agora") → 7 dias. Redeploy da função.

### Não alterar (já corretos ou fora de escopo)
- `src/routes/index.tsx` já diz "Teste grátis por 7 dias".
- `privacidade.tsx` / `confirmar-exclusao.tsx` / `app.conta.tsx`: as menções a 30 dias são sobre retenção pós-cancelamento e exclusão LGPD, não sobre trial.
- Cortesia: `plan-gates.ts`/`uso.functions.ts` já retornam `trialExpirado: false` quando `cortesia = true`; nenhuma mudança necessária.
- Alertas "atualização de legislação em 3 dias" (cidades novas) não são trial — ficam intactos.

## Verificação
Após aplicar: `tsgo` + reler os arquivos alterados; conferir no preview `/signup`, `/onboarding` e `/termos`; disparar um e-mail de boas-vindas de teste para confirmar o novo texto.
