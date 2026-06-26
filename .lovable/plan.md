## Objetivo
Corrigir as abas da área administrativa que não respondem (Usuários, Condomínios, Treinar IA, Orientações, Auditoria) e tornar o guard de acesso confiável.

## Causa raiz
Cada sub-rota admin tem um `beforeLoad` com `try { ... } catch { throw redirect({ to: "/app" }) }`. Qualquer falha transitória da server function `isCurrentUserAdmin` (latência, race com a hidratação do bearer Supabase, erro temporário do gateway) é engolida e o usuário é mandado silenciosamente para `/app`. Não há feedback nem log visível, então clicar na aba parece "não fazer nada".

## Mudanças

### 1. Transformar `/app/admin` em layout único com guard centralizado
- Renomear `src/routes/_authenticated/app.admin.tsx` (dashboard atual) para `src/routes/_authenticated/app.admin.index.tsx`. Conteúdo da Visão geral fica intacto, mas sem o `beforeLoad`.
- Criar um novo `src/routes/_authenticated/app.admin.tsx` que vira o **layout pai** de todas as rotas `/app/admin/*`:
  - `component` retorna apenas `<Outlet />`.
  - `beforeLoad` chama `isCurrentUserAdmin` UMA vez. Se falhar de verdade (não-admin), redireciona para `/app`. Se for erro transitório, propaga para o `errorComponent` em vez de redirecionar silenciosamente.
  - Define `errorComponent` e `notFoundComponent` da rota.

Resultado: o guard roda uma vez ao entrar em qualquer rota `/app/admin/*` e o resultado é compartilhado.

### 2. Remover `beforeLoad` duplicado nos arquivos-filho
Em cada um destes arquivos, apagar o bloco `beforeLoad` (mantendo `component` e o resto):
- `src/routes/_authenticated/app.admin.usuarios.tsx`
- `src/routes/_authenticated/app.admin.condominios.tsx`
- `src/routes/_authenticated/app.admin.treinamento.tsx`
- `src/routes/_authenticated/app.admin.orientacoes.tsx`
- `src/routes/_authenticated/app.admin.auditoria.tsx`

O layout pai já protege todos.

### 3. Tornar `isCurrentUserAdmin` resiliente
Em `src/lib/admin.functions.ts`, manter a assinatura, mas garantir que retorna `{ admin: false }` em caso de erro de RPC em vez de lançar — assim o guard distingue claramente "não é admin" de "falha de rede".

### 4. Limpeza do `AdminNav`
Em `src/components/admin/AdminNav.tsx`, remover o cast `as "/app/admin"` no `Link` — usar tipagem real via `as const` no array de itens para que a tipagem do roteador valide os caminhos das abas.

## Fora de escopo
- Sem mudanças em schema, RLS, server functions de KB, identidade visual, ou layout das páginas filhas.
- A Visão geral continua exibindo as mesmas métricas, mesmos cards e mesmo gráfico.

## Validação
1. Logar como `mmacedogoes@gmail.com`, abrir `/app/admin`.
2. Clicar em cada aba: Usuários, Condomínios, Treinar IA, Orientações, Auditoria — cada uma deve renderizar sem rebote para `/app`.
3. Atualizar (F5) em uma sub-rota como `/app/admin/orientacoes` — deve permanecer na página.
4. Logar com um usuário não-admin e tentar `/app/admin/usuarios` direto pela URL — deve redirecionar para `/app`.
