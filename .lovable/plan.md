# Plano de Redesign da Aba "Resumo e Dados"

O objetivo é reorganizar as informações do contrato em uma lista vertical de caixas (cards) expansíveis, com foco em legibilidade (texto justificado) e organização moderna (grid de cards para cláusulas).

## Alterações Visuais e de UI

- **Lista Vertical de Caixas**: Substituiremos o layout de grid atual por uma pilha vertical de seções expansíveis.
- **Interação de Expansão**: Cada seção terá um cabeçalho fixo e um botão de ação específico para expandir/recolher os detalhes, conforme preferência.
- **Texto Justificado e Resumido**: Utilizaremos o componente `ExpandableText` (já existente e ajustado) para garantir que textos longos (como o Objeto) sejam exibidos de forma justificada e com limite de linhas inicial.
- **Obrigações Expansíveis**: A seção de obrigações será integrada ao fluxo vertical, permitindo a visualização detalhada ao expandir o card.
- **Cláusulas e Garantias em Grid**: Refatoração desta seção para usar um sistema de cards em grid modernos, substituindo as linhas simples atuais.

## Detalhes Técnicos

- **Componente `InfoCard`**: Será atualizado ou substituído por um novo componente `ExpandableSection` que gerencia o estado de expansão localmente.
- **Layout Mobile**: A estrutura vertical naturalmente favorece dispositivos móveis, garantindo que as informações não fiquem apertadas em telas pequenas.
- **Estilo Serifado**: Manteremos o uso da fonte Cormorant (serif) para valores e títulos importantes para preservar a identidade visual "Augusto".

## Passos de Implementação

1.  **Ajustar `ExpandableText`**: Garantir que o estilo `text-justify` esteja aplicado corretamente e que o limite de caracteres seja adequado.
2.  **Criar `ExpandableSection`**: Componente para as caixas listadas, com suporte a ícone, título, resumo e conteúdo colapsável.
3.  **Refatorar `Cláusulas e Garantias`**: Implementar o novo layout de grid de cards dentro de uma dessas seções.
4.  **Integrar Obrigações**: Mover a lógica de exibição de obrigações para dentro de uma seção expansível.
5.  **Limpeza de Layout**: Remover o grid complexo da `Page` na aba de informações e substituir pela nova lista vertical.

Este plano foca na experiência operacional, permitindo que o usuário veja o essencial rapidamente e mergulhe nos detalhes apenas quando necessário.