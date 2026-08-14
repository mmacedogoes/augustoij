# Plano de Correção — Gestão de Contratos (Rodada 2)

Corrigir e evoluir o módulo de Gestão de Contratos focando em reatividade, consistência de dados, responsividade e a nova funcionalidade "Perguntar à IJ".

## P0: Core & Quick Actions (Resolução de Bugs Críticos)

### 1. Evolução do QuickViewDrawer (Bug 1)
- **Ações no Drawer**: Adicionar botões para "Abrir Contrato", "Editar Dados", "Perguntar à IJ", "Ver Documento" e "Atribuir Responsável".
- **CTAs Dinâmicos**: O bloco "Próxima Ação" será transformado em um botão que leva diretamente à aba correspondente.
- **Melhorias de UX**: Garantir fechamento com Escape/Clique fora e foco no mobile.

### 2. Conexão Real dos Drawers do Painel (Bug 2)
- **Checklists Pendentes**: Implementar busca real de contratos com checklists "abertos" na competência atual.
- **Sem Responsável**: Listar contratos que não possuem entradas na tabela `contrato_responsaveis`.
- **Mês-base Ausente**: Listar contratos ativos com `mes_base_reajuste` nulo.
- **Feedback Visual**: Adicionar skeletons, estados vazios e tratamento de erro (retry) em cada drawer.

### 3. Navegação Contextual (Bug 3)
- **Filtros por URL**: Permitir que `Ir para listagem avançada` passe parâmetros como `view=checklist` ou `view=sem-responsavel`.
- **Sincronização**: A listagem lerá esses parâmetros para aplicar os filtros e chips automaticamente.

### 4. Estabilidade do Shell (Bug 4)
- **Skeletons Identitários**: Ajustar skeletons para terem as mesmas dimensões dos cards finais, evitando o "salto" de conteúdo.
- **Consistência de Estados**: Garantir que contadores não mostrem `0` ou `...` durante o carregamento de forma desalinhada.

## P1: Perguntar à IJ & Detalhe

### 1. Sistema de Chat por Contrato
- **Contexto Isolado**: Garantir que o `contract_id` seja o filtro primário de qualquer busca de documentos ou histórico.
- **Banner de Escopo**: Mostrar visualmente que a IA está limitada àquele contrato.
- **Sugestões Contextuais**: Perguntas prontas baseadas no tipo de contrato.

### 2. Refinamento do Detalhe ($contratoId)
- **Ações Primárias**: Adicionar "Perguntar à IJ" com peso visual.
- **Hierarquia**: Mover ações destrutivas (suspender/excluir) para um menu secundário.
- **Modais de Edição**: Garantir que "Editar Dados" e "Editar Obrigações" funcionem perfeitamente via overlay.

## P2: Responsividade & Polimento (Bugs 5)

### 1. Grade Responsiva
- Ajustar breakpoints (1440, 1024, 768, 390px) para cards, tabelas e drawers.
- Drawer full-screen no mobile.
- Modal com rodapé sticky e scroll interno.

---

## Detalhes Técnicos

### Arquivos Afetados
- `src/components/contratos-servico/QuickViewDrawer.tsx`
- `src/components/contratos-servico/PendenciasDrawer.tsx`
- `src/lib/contratos-servico/painel.functions.ts` (Adição de novas funções de listagem)
- `src/routes/_authenticated/app.contratos.painel.tsx`
- `src/routes/_authenticated/app.contratos.index.tsx`
- `src/routes/_authenticated/app.contratos.$contratoId.tsx`

### Riscos
- **Performance**: Múltiplas consultas em paralelo no painel. Solução: Cache de `useQuery`.
- **Segurança**: Vazamento de contexto de outros contratos no chat. Solução: Filtro obrigatório por `contract_id` no backend.

### Estratégia de Testes
- Validar filtros via URL.
- Testar isolamento do chat com dois contratos diferentes.
- Verificar responsividade via DevTools.
