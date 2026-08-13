# Evolução do Módulo de Gestão de Contratos — Etapa P0

Redesenho do módulo para torná-lo uma central de comando acionável, focada em pendências e produtividade, mantendo a identidade visual atual.

## Alterações Técnicas

### 1. Novo Painel (Central de Comando)
- **Rota**: `src/routes/_authenticated/app.contratos.painel.tsx`
- **Faixa de Saúde**: Substituir os KPIs atuais por uma faixa compacta com métricas de vigência, reajustes, pendências e valor mensal/anualizado.
- **Bloco "Requer atenção agora"**: Adicionar uma lista densa de alertas prioritários (pendências de checklist, reajustes vencidos, contratos sem responsável).
- **Filtros**: Garantir que o seletor de condomínio suporte "Todos os condomínios" de forma fluida.

### 2. Workspace do Contrato (Detalhe)
- **Rota**: `src/routes/_authenticated/app.contratos.$contratoId.tsx`
- **Cabeçalho Persistente**: Tornar o cabeçalho (nome do prestador, status, ações principais) fixo no topo durante o scroll.
- **Navegação por Âncoras**: Substituir o sistema de `Tabs` por uma visualização de página única com seções navegáveis (Scroll / Anchors).
- **Indicador de Completude**: Exibir o percentual de preenchimento dos dados essenciais do contrato.
- **Ações Rápidas**: Adicionar botões distintos para "Editar Dados" e "Editar Obrigações".

### 3. Formulários e Listagem
- **Componente**: `src/components/contratos-servico/ContratoForm.tsx`
    - Adicionar lógica condicional para campos de vigência (Prazo Indeterminado oculta Data Fim).
    - Melhorar a distinção visual entre Valor Mensal e Global.
- **Rota**: `src/routes/_authenticated/app.contratos.index.tsx`
    - Adicionar dropdown de "Visões Salvas" (Todos, Pendências, Risco, etc.).
    - Exibir status de "Saúde" com texto e indicador (ex: "Atenção — 2 pendências").

### 4. Estados da Interface
- Padronizar estados vazios com CTAs orientados à ação (ex: "Nenhum responsável — Atribuir agora").
- Adicionar skeletons de carregamento para os novos blocos do painel.

## Experiência do Usuário (UX)
- Priorização visual do que exige ação imediata.
- Redução de cliques para navegação entre seções do contrato.
- Clareza sobre o impacto financeiro (mensal vs anualizado).
