## Objetivo

Deixar o painel de cada contrato de locação (aba "Administração de Imóveis") realmente operacional para o dia a dia: lançar pagamentos mês a mês, pagamentos anuais de IPTU/TCR, acompanhar o valor inicial vs. valor atual do aluguel, receber alerta de renovação com sugestão de novo valor pelo índice do contrato e registrar manutenções feitas pela proprietária.

Aproveita o que já existe (tabelas `pagamentos`, `reajustes`, `manutencoes`, funções `listPagamentosContrato`, `calcularReajuste`, `aplicarReajuste`, dashboard de alertas) e completa o que falta.

## Escopo

### 1) Painel do contrato — pagamentos mês a mês
Em `app.admin.imoveis.locacao.$id.painel.tsx`:
- Grade "Aluguéis por competência" com uma linha por mês desde `data_inicio_vigencia` até o mês corrente: competência, vencimento, valor esperado, status, botão **Marcar como pago** (com data e valor efetivamente pago) e **Desfazer**. Já existe geração idempotente; só falta UI clara mês a mês.
- Grade paralela "Condomínio por competência" — usa `pagamentos.tipo = 'condominio'`. Hoje só é gerado se `encargos_inquilino.condominio` estiver marcado; ajustar para sempre exibir a grade quando o encargo estiver ligado, com valor editável por mês.
- Cada linha aceita: valor efetivamente pago, data, observação, comprovante (upload opcional no bucket `contratos`, subpasta `pagamentos/<uid>/`).
- Indicador visual de atraso (usa `calcularMora` já pronta para exibir multa 2% + juros 1% a.m.).

### 2) Pagamentos anuais — IPTU e TCR
- Ajustar `buildParcelasEsperadas` em `pagamentos.functions.ts` para também gerar 1 parcela/ano de **TCR** quando `encargos_inquilino.tcr` (hoje só gera IPTU).
- Bloco "Encargos anuais" no painel com uma linha por ano do contrato: IPTU e TCR, com valor, vencimento editável e botão marcar pago / anexar comprovante.

### 3) Valor inicial × valor atual do aluguel
- Adicionar coluna `valor_aluguel_inicial numeric` em `contratos_locacao` (migração), preenchida com o `valor_aluguel` atual dos contratos existentes.
- No formulário do contrato exibir: **Valor inicial** (fixo, definido no cadastro) e **Valor atual** (somente leitura, = `valor_aluguel`, atualizado por reajustes).
- Painel mostra card "Aluguel": inicial, atual, variação %, último reajuste (data + índice) a partir da tabela `reajustes`.

### 4) Renovação/reajuste como pendência ativa
- O contrato já tem `data_inicio_vigencia`, `periodicidade_reajuste_meses` e `mes_base_reajuste`. Calcular a próxima data de reajuste: (último reajuste em `reajustes` OU `data_inicio_vigencia`) + periodicidade.
- Nova função `listReajustesPendentes` (server) devolvendo contratos com próxima data ≤ hoje + 30 dias e sem `aplicarReajuste` registrado depois dessa data.
- No painel: card **"Reajuste pendente"** quando aplicável, com:
  - Valor atual, índice do contrato, período de apuração (12 meses anteriores)
  - Sugestão calculada por `calcularReajuste` (já existe, com fallback IPCA quando IGP-M for negativo)
  - Valor novo sugerido + campo editável (o usuário pode ajustar)
  - Botão **Aplicar reajuste** (usa `aplicarReajuste`, que grava histórico e atualiza `valor_aluguel`)
  - Botão **Gerar comunicado ao inquilino** (texto pronto com valor antigo, novo, índice, % e vigência — copiar/WhatsApp via `wa.me` usando `inquilino_telefone`)
  - Enquanto não aplicado, o card permanece como "pendência".
- Adicionar contador na Home do módulo ("Reajustes pendentes: N") reusando `dashboard.functions.ts`.

### 5) Manutenções da proprietária
- A tabela `manutencoes` já existe. Adicionar UI:
  - Aba/bloco **Manutenções** dentro do painel do contrato (filtrado pelo `imovel_id` do contrato) e também na página do imóvel.
  - Listagem com colunas: título, responsável (proprietário/inquilino/administrador/condomínio), status, custo estimado/final, datas.
  - Form novo/editar: título, descrição, responsável (padrão "proprietário"), status, custos, datas, anexos (bucket `contratos`, subpasta `manutencoes/<uid>/`).
  - Server functions: `listManutencoes(imovelId)`, `upsertManutencao`, `removeManutencao`.

## Detalhes técnicos

**Migração única:**
```sql
ALTER TABLE public.contratos_locacao
  ADD COLUMN IF NOT EXISTS valor_aluguel_inicial numeric;
UPDATE public.contratos_locacao
   SET valor_aluguel_inicial = valor_aluguel
 WHERE valor_aluguel_inicial IS NULL;
```

**Arquivos novos**
- `src/lib/imoveis/manutencoes.functions.ts`
- `src/components/imoveis/PagamentosGrid.tsx` (grade mensal reutilizável por tipo)
- `src/components/imoveis/ReajustePendenteCard.tsx`
- `src/components/imoveis/ManutencoesPanel.tsx`

**Arquivos alterados**
- `src/lib/imoveis/pagamentos.functions.ts` — gera TCR anual + sempre gera condomínio quando encargo ativo; permite gravar `valor_pago`/`comprovante_url` (colunas já existem em `pagamentos`? confirmar; se faltar, incluir na mesma migração).
- `src/lib/imoveis/reajustes.functions.ts` — adiciona `listReajustesPendentes` e helper `proximaDataReajuste`.
- `src/lib/imoveis/dashboard.functions.ts` — incluir "reajustes pendentes" na checklist.
- `src/lib/imoveis/schemas.ts` — `valor_aluguel_inicial` no schema do contrato.
- `src/routes/_authenticated/app.admin.imoveis.locacao.$id.tsx` — mostrar Valor inicial × atual no form.
- `src/routes/_authenticated/app.admin.imoveis.locacao.$id.painel.tsx` — novos blocos (aluguel/condomínio mês a mês, encargos anuais, reajuste pendente, manutenções).

**Regras mantidas**
- Multa 2% + juros 1% a.m. já parametrizados no contrato — continuam usados no cálculo de mora exibido nas grades.
- Idempotência dos pagamentos pela chave `(contrato_locacao_id, tipo, competencia)` já existente.
- Cálculo do reajuste continua via API BCB (SGS) com cache `indices_bcb_cache` e fallback IPCA — sem mudança de lógica.

## Fora de escopo (a menos que peça depois)
- Envio automático de e-mail/WhatsApp ao inquilino (deixo só o botão "gerar mensagem/abrir WhatsApp").
- Boleto/integração bancária para os aluguéis.
- Painel de manutenções agregado (só listagem por imóvel/contrato).
