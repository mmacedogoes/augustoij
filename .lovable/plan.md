# Reformulação visual da área do usuário

Objetivo: deixar a área logada (`/app`) mais moderna, minimalista e fluida, mantendo exatamente a mesma paleta (verde institucional, dourado, creme) e as mesmas fontes (Cormorant Garamond + Inter) da landing page. Nenhuma função, consulta, regra de negócio ou rota muda — só camada visual.

## 1. Base do design system (src/styles.css)

Sem cores novas. Apenas organização e refino dos tokens existentes, todos em HSL:

- Escala de espaçamento consistente 4/8px aplicada por utilitários (`--app-gap-*`), acabando com margens avulsas.
- Tokens de superfície da área logada derivados dos que já existem: `--app-surface`, `--app-panel`, `--app-panel-hover`, `--app-rule`, para o app respirar o mesmo creme/papel da landing.
- Tokens de elevação suaves (`--app-shadow-soft`, `--app-shadow-card`) — sombras discretas, nada de card pesado.
- Tokens de movimento: `--app-ease` e durações de 150–250ms, usados em todas as transições.
- Hierarquia tipográfica fechada em utilitários: eyebrow (11px, tracking largo, dourado), título de página (Cormorant, 30–40px fluido), título de seção, corpo (15px/1.6) e legenda (13px). Já existem `app-eyebrow`, `app-title`, `app-section-title` — serão padronizados e usados em todas as telas.

## 2. Menu lateral retrátil (src/components/AppShell.tsx)

- Sidebar com dois estados: expandida (240px) e recolhida (72px, só ícones + tooltip). Transição de largura em 200ms, conteúdo acompanha sem "pulo".
- Botão de recolher no rodapé da sidebar; preferência guardada em localStorage.
- Item ativo com barra dourada, fundo sutil e ícone dourado (já existe, será refinado com transição).
- Mobile: em vez da barra de abas com scroll horizontal, um drawer lateral (Sheet do shadcn) aberto pelo ícone de menu no header, com overlay e animação de entrada. Header mobile fica limpo: logo, sino, ajuda, menu.
- Topbar desktop mais leve: fundo translúcido com blur, borda de 1px em `--app-rule`, altura 56px, e o título da página atual à esquerda.

## 3. Padrão de páginas

Um cabeçalho de página consistente em todas as telas: eyebrow + título serif + subtítulo + ações à direita, com o grid responsivo `grid-cols-[minmax(0,1fr)_auto]` que já é usado no início (evita quebra em mobile).

Cards e painéis: raio 16px, borda 1px em `--app-rule`, fundo `--app-panel`, sombra suave, hover elevando 1px com transição de 200ms. Tabelas e listas ganham linhas com hover e zebra sutil, tipografia tabular nos números.

Estados visuais completos e padronizados: skeletons com shimmer no lugar de tela vazia, empty states com ícone em moldura, mensagem curta e ação primária, erro com card discreto e botão de tentar de novo, botões com estado de carregamento.

## 4. Animações (leves e proporcionais)

- Entrada de conteúdo: fade + 8px de subida, 200ms, escalonado só nos cards do topo.
- Sidebar, drawer, tooltips, dropdowns: 150–250ms com easing suave.
- Hover/press em botões e cards: escala 0.99 no active, sem exagero.
- Tudo respeitando `prefers-reduced-motion`.

## 5. Variantes shadcn com personalidade

Refino das variantes já existentes (`augusto`, `augusto-outline`, `augusto-gold`) e adição de uma variante `ghost` discreta para ações secundárias: foco visível em anel dourado, disabled com opacidade e cursor correto, todos os estados com a mesma curva de transição. Nada de cor chumbada — só tokens.

## 6. Telas cobertas

Nesta reformulação: shell (sidebar/topbar/drawer), Início (`/app`), Condomínios (lista e detalhe), Conta, e o painel de Gestão de Contratos. As telas de Admin herdam o shell e os tokens, sem reescrita de layout.

## Notas técnicas

- Só arquivos de apresentação: `src/styles.css`, `src/components/AppShell.tsx`, componentes de UI e o JSX das rotas listadas. Nenhuma alteração em `*.functions.ts`, RLS, queries ou rotas.
- Sem hardcode de cor; tudo por token semântico, então dark mode continua funcionando.
- Mobile-first: breakpoints sm/md/lg, alvos de toque de 44px, sem overflow horizontal.
- A fluidez atual (layout persistente `/app`, preload no hover, skeleton só na área de conteúdo) é preservada — o shell continua montado uma única vez.

## Previews

Não consigo capturar a área logada agora porque a sessão do preview está deslogada. Duas opções:
1. Você faz login no preview e eu capturo as telas atuais e gero 3 direções visuais renderizadas para você escolher antes de codar.
2. Aprova o plano e eu implemento direto a direção descrita acima.
