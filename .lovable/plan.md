## Objetivo

Nenhum plano — inclusive o Gratuito e o Essencial — pode ter a jurisprudência restringida. Hoje o `src/config/plans.ts` marca `jurisprudenciaCompleta: false` para Gratuito e Essencial, e o chat injeta uma instrução no prompt proibindo citar acórdãos.

## O que muda

### 1. `src/config/plans.ts`
Trocar `jurisprudenciaCompleta: false` por `true` nos planos Gratuito e Essencial. Os demais já são `true`, e o `src/config/planos.ts` (fonte da landing) já está todo `true` — as duas fontes passam a concordar.

### 2. `src/lib/plan-gates.ts`
`jurisprudenciaDirective(planoId)` passa a retornar sempre `null`, com comentário explicando que jurisprudência não é mais gate de plano. Mantenho a função exportada (não removo) para não quebrar o import em `src/routes/api/chat.ts` nem qualquer outro consumidor.

### 3. `src/routes/api/chat.ts`
Nada a mudar no fluxo: a linha 504 já trata `null` (só concatena quando existe diretiva). Só confirmo que a resposta não perde nada.

### 4. UI
`UpgradeDialog.tsx` apenas rotula a feature; como nenhum plano fica sem ela, o item deixa de aparecer como bloqueado sozinho. A landing (`PlanosFaq.tsx`) já lista "Legislação, jurisprudência e doutrina completas" como incluída em todos — passa a ser verdade.

## Fora de escopo

Nenhuma tabela, RLS, migração, segredo ou chamada de rede: a restrição era só texto de prompt + flag de configuração. Também não mexo nas regras de peças (notificação/comunicado não citam jurisprudência salvo pedido expresso) — isso é escolha de redação, não limite de plano.

## Verificação

Typecheck + build, e conferência de que nenhum outro ponto do código lê `jurisprudenciaCompleta` para bloquear algo.
