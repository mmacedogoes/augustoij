# Plano de Correção e Evolução — Gestão de Contratos (P0)

Este plano foca na **Etapa P0**, priorizando a navegabilidade, filtros reativos, Central de Comando completa e a nova estrutura do Espaço de Trabalho.

## 1. Painel (Central de Comando)
- **Fila de Pendências**: Implementar um `PendenciasDrawer` que lista checklists, atrasos e reajustes pendentes, disparado pelo CTA "Ver checklists".
- **Cards de Atenção**: Expandir o bloco "Requer atenção agora" com os 10+ tipos de alertas solicitados (vencimentos, conformidade, dados ausentes).
- **Explicação Financeira**: Adicionar um `Popover` no "Valor anual estimado" detalhando a fórmula e os contratos incluídos/excluídos.

## 2. Listagem (Carteira Inteligente)
- **Filtros Reativos**: Ajustar o estado dos filtros para disparar a atualização da tabela instantaneamente.
- **Gestão de Filtros**: Adicionar `Badge` ou `Chip` de filtros ativos com opção de remoção individual.
- **Painel Lateral de Visualização**: Ao clicar em uma linha, abrir um `QuickViewDrawer` com resumo, saúde e ações rápidas (atribuir responsável, abrir contrato).

## 3. Detalhe (Espaço de Trabalho)
- **Navegação Lateral**: Substituir abas horizontais por uma `Sidebar` interna organizada por grupos (Visão, Financeiro, Documentos, Risco).
- **Cabeçalho Persistente**: Criar um componente de header fixo com status, saúde, próximo evento e botões de ação principal.
- **Fluxos de Edição**: Migrar as rotas de edição para modais (`EditContratoModal` e `EditObrigacoesModal`) mantendo o contexto do workspace.

## Detalhes Técnicos e Segurança
- **Filtros**: Otimização do `useQuery` para garantir que a atualização instantânea não gere "flashing" excessivo (uso de `placeholderData`).
- **Navegação**: Uso de `React.lazy` para os painéis da sidebar no detalhe para manter a carga inicial leve.
- **Segurança**: Validação via Zod em todos os novos fluxos de edição em modal.

## Arquivos Afetados (Principais)
- `src/routes/_authenticated/app.contratos.painel.tsx`
- `src/routes/_authenticated/app.contratos.index.tsx`
- `src/routes/_authenticated/app.contratos.$contratoId.tsx`
- `src/components/contratos-servico/ContratoForm.tsx` (para uso em modal)
- Novos componentes em `src/components/contratos-servico/` (Drawers, Popovers, Sidebar)
