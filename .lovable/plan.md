# Fim da tela branca ao navegar pelo menu lateral

## O que está acontecendo (causa real)

Três coisas se somam a cada clique no menu:

1. **O menu lateral não é permanente.** O `AppShell` (logo, menu, avisos) é renderizado *dentro de cada página*, não em um layout compartilhado. Ao trocar de rota, o React desmonta a tela inteira — inclusive o menu — e remonta tudo do zero. Por isso a tela pisca em branco em vez de só o conteúdo trocar.
2. **Cada clique faz duas chamadas de rede antes de renderizar.** O `beforeLoad` do grupo autenticado chama `supabase.auth.getUser()` (bate no servidor) e depois busca o `profiles` no banco. A navegação fica bloqueada esperando as duas — em rede lenta são centenas de ms de nada na tela.
3. **O código da próxima tela só começa a baixar no clique.** O router está sem `defaultPreload`, então o chunk JS da rota destino não é pré-carregado no hover.

O `pendingComponent` atual (skeleton após 200ms) está no nível do grupo autenticado, ou seja, ele *substitui a tela inteira, menu incluído* — o que reforça a sensação de recarregar a página.

## Correção passo a passo

### 1. Layout persistente para `/app` (o ponto principal)
- Criar `src/routes/_authenticated/app.tsx` como rota de layout: renderiza `<AppShell><Outlet /></AppShell>`.
- Para não mexer nos ~45 arquivos que já usam `<AppShell>`, o `AppShell` ganha um `AppShellContext`: quando já existe um shell acima na árvore, ele apenas devolve `children` (sem duplicar menu/cabeçalho). Assim nada quebra e o menu passa a permanecer montado entre navegações.
- Resultado: ao clicar no menu, só a área de conteúdo troca.

### 2. Skeleton no lugar certo
- Remover o `pendingComponent` de tela cheia do `_authenticated` e colocar um `pendingComponent` no novo layout `/app`, com `pendingMs: 150` e `pendingMinMs: 0` — ele aparece **dentro** da área de conteúdo, com o menu visível.
- Mantém os 4 estados: loading (skeleton na área de conteúdo), erro (`errorComponent` no layout com mensagem clara e botão "Tentar de novo"), vazio e sucesso continuam por conta de cada página.

### 3. Não bater na rede a cada clique
- No `beforeLoad` do `_authenticated`: trocar `supabase.auth.getUser()` por `supabase.auth.getSession()` (lê o token local, sem round-trip) e manter a validação real no servidor/RLS.
- Guardar o resultado do `profiles` (onboarding + papel) em cache curto em memória por `user.id`, invalidado no `onAuthStateChange` e ao concluir o onboarding. A verificação continua existindo, só não repete a consulta a cada clique.
- Segurança inalterada: quem autoriza de verdade continua sendo a RLS do banco e as server functions; o `beforeLoad` é só roteamento/UX.

### 4. Pré-carregar no hover
- No `src/router.tsx`: `defaultPreload: "intent"` e `defaultPreloadDelay: 50`. O chunk da rota destino baixa enquanto o mouse está sobre o item do menu; o clique fica instantâneo.

## Tratamento de erro e bordas
- `try/catch` no `beforeLoad`: falha de rede não derruba a tela — se houver sessão válida em cache, segue; senão redireciona para `/login` com aviso via toast.
- Sessão expirada durante a navegação: redirect para `/login` (sem loop, `replace`).
- Usuário sem permissão: os gates existentes (`app.admin.tsx`, `app.admin.imoveis.tsx`) e a RLS continuam iguais.
- Cache de perfil limpo em logout, para não vazar estado entre contas.

## Impacto / o que não muda
- Nenhuma alteração de banco, de RLS ou de segredo — é correção de front/roteamento.
- Nenhuma página precisa ser reescrita; `<AppShell>` continua funcionando onde já está.
- Checagem depois: navegar entre Início, Condomínios, Gestão de Contratos, Conta e Admin conferindo que o menu não pisca e que rotas protegidas seguem protegidas.
