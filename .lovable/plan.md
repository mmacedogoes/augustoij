# Remover "número de unidades" do cadastro manual de condomínio

## Objetivo
O número de unidades passa a vir exclusivamente da extração da convenção. Nenhum formulário manual deve pedir esse número.

## Mudanças

### 1. Formulário de novo condomínio — `src/routes/_authenticated/app.condominios.index.tsx`
- Remover o campo "Quantidade de unidades" (input `id="qtd"`).
- Remover `qtd_unidades` do schema Zod local e do estado do formulário; ao criar, enviar `qtd_unidades: null`.
- No cartão da lista, substituir `qtd_unidades ?? 0` exibido: quando `qtd_unidades` for nulo, mostrar "unidades extraídas da convenção" (ou contar registros reais da tabela `unidades` via leve ajuste na consulta, se simples).

### 2. Onboarding — `src/routes/_authenticated/onboarding.tsx`
- Remover o campo "Quantidade de unidades" do passo de cadastro do primeiro condomínio e do schema/estado; criar com `qtd_unidades: null`.

### 3. Edição do condomínio — `src/routes/_authenticated/app.condominios.$id.tsx`
- Remover o campo editável de número de unidades do formulário de edição (não é mais dado manual).
- No cabeçalho/resumo, exibir o total real de unidades cadastradas (tabela `unidades`) em vez de `qtd_unidades` quando este for nulo.

### 4. Fora de escopo (sem alteração)
- Coluna `qtd_unidades` no banco e schemas Zod do servidor (`condominios.functions.ts` já aceitam `null`) — permanecem, apenas deixam de ser preenchidos manualmente; a extração da convenção e a auditoria de unidades continuam gravando/atualizando esse valor.
- Área admin que exibe `qtd_unidades` continua exibindo.

## Verificação
- Type-check e build.
- Criar um condomínio manualmente: ficha sem campo de unidades e criação bem-sucedida com unidades extraídas depois via convenção.
