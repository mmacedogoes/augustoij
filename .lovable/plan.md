# Fase 1 — Fundação do módulo "Administração de Imóveis"

Módulo restrito ao super admin (advogado/administrador) para gerir proprietários, imóveis e contratos. Nesta fase, só cadastro manual — sem IA.

## Reuso do que já existe

O projeto já tem controle de papéis via enum `papel_sistema` e as funções `is_super_admin(uuid)` / `has_role(uuid, app_role)`. **Não vou criar `user_roles`** — vou reaproveitar `is_super_admin` para RLS e o layout `_authenticated/app.admin.tsx` que já bloqueia não-admins. As rotas ficarão sob `/app/admin/imoveis/*` seguindo o padrão existente (mesmo shell, sidebar, tokens de design).

## 1. Schema (uma única migration)

Todas as tabelas em `public`, todas com `id uuid pk`, `owner_admin_id uuid not null default auth.uid()`, `created_at`, `updated_at` (trigger `tg_set_updated_at`), RLS habilitada, GRANTs para `authenticated`/`service_role`, e política única `FOR ALL USING (public.is_super_admin(auth.uid()) AND owner_admin_id = auth.uid()) WITH CHECK (mesma cond.)` — cada super admin só enxerga o que ele mesmo cadastrou.

Tabelas (campos exatamente como pedido):

- `proprietarios` — nome, cpf, estado_civil, profissao, rg, email, telefone, endereco, banco, agencia, conta, pix, observacoes
- `imoveis` — proprietario_id fk→proprietarios, descricao, endereco, edificio, numero_unidade, cep, cidade, uf, matricula, quartos, vaga_garagem bool, area numeric, observacoes
- `contratos_locacao` — imovel_id fk, todos os campos do inquilino, valor_aluguel, dia_vencimento (check 1-31), datas, prazo_meses, indice_reajuste default 'IGP-M', periodicidade_reajuste_meses default 12, mes_base_reajuste (check 1-12), encargos_inquilino jsonb, multa_mora_percent default 2, juros_mora_mensal_percent default 1, multa_rescisoria_multiplicador default 3, multa_rescisoria_proporcional default true, aviso_previo_dias default 30, foro, status default 'ativo' (check ativo|encerrado|renovado), arquivo_contrato_url
- `caucoes` — contrato_locacao_id fk unique, possui, valor_depositado, tipo (poupanca|dinheiro|seguro|outro), corrige_com_rendimento default true, data_deposito, valor_atual_override, observacoes
- `contratos_administracao` — proprietario_id fk, dados do administrador, dados bancários, percent_honorario_renovacao default 50, percent_honorario_mensal default 10, mora_multa_percent default 2, mora_juros_mensal_percent default 1, mora_indice default 'IGP-M', data_inicio, prazo_meses default 24, status default 'ativo', arquivo_contrato_url
- `pagamentos` — contrato_locacao_id fk, tipo (aluguel|condominio|iptu|agua|luz|tcr|outro), competencia text, valor, vencimento, pago default false, data_pagamento, observacoes
- `manutencoes` — imovel_id fk, titulo, descricao, status (solicitada|em_andamento|concluida|cancelada), responsavel (proprietario|inquilino|administrador|condominio), custo_estimado, custo_final, data_solicitacao, data_conclusao, anexos jsonb default '[]'
- `honorarios` — contrato_administracao_id fk, contrato_locacao_id fk null, tipo (mensal|renovacao), competencia, base_calculo, percentual, valor, vencimento, pago default false, data_pagamento, observacoes
- `aditivos` — contrato_locacao_id fk, tipo default 'renovacao', dados jsonb, pdf_url null, gerado_em timestamptz default now()

Índices em toda fk e em `(owner_admin_id, ...)` para listagens.

## 2. Camada de dados (server functions)

Um arquivo `.functions.ts` por entidade em `src/lib/imoveis/`, todos usando `.middleware([requireSupabaseAuth])`:

- `proprietarios.functions.ts` — list, get, upsert, remove
- `imoveis.functions.ts` — list (com join proprietário), get, upsert, remove
- `contratos-locacao.functions.ts` — list (join imóvel/proprietário), get (com caução), upsert (grava contrato + caução na mesma chamada), remove
- `contratos-administracao.functions.ts` — list, get, upsert, remove

Todas as escritas com validação Zod. `owner_admin_id` vem do `context.userId` no servidor, nunca do cliente.

## 3. Rotas e telas (shadcn/ui, pt-BR, BRL)

Estrutura sob `_authenticated/app.admin.imoveis.*` — herda o gate de admin já existente:

```text
app.admin.imoveis.tsx               → layout com sub-tabs
app.admin.imoveis.index.tsx         → visão geral / atalhos
app.admin.imoveis.proprietarios.index.tsx  → lista
app.admin.imoveis.proprietarios.$id.tsx    → form novo/editar ("novo" como id sentinela)
app.admin.imoveis.unidades.index.tsx        → lista de imóveis
app.admin.imoveis.unidades.$id.tsx          → form
app.admin.imoveis.locacao.index.tsx         → lista contratos de locação
app.admin.imoveis.locacao.$id.tsx           → form (contrato + bloco caução embutido)
app.admin.imoveis.administracao.index.tsx   → lista contratos de administração
app.admin.imoveis.administracao.$id.tsx     → form
```

Item de menu "Administração de Imóveis" adicionado ao sidebar admin (visível só quando `is_super_admin`, condição já usada pelos itens de admin atuais).

## 4. Utilidades de formulário

`src/lib/imoveis/masks.ts`:
- máscara CPF (`000.000.000-00`) e CNPJ, CEP, telefone
- máscara moeda BRL (input controlado, guarda `number`)
- helpers de data (input `type="date"` isoladamente + formatação `dd/MM/yyyy` na exibição via `date-fns` pt-BR)

Schemas Zod compartilhados em `src/lib/imoveis/schemas.ts` (usados no client via `react-hook-form` e no server nas server functions).

## 5. Design system

Reuso total dos tokens/componentes existentes (`Card`, `Table`, `Button`, `Input`, `Select`, `Textarea`, `Checkbox`, `Dialog` de confirmação de exclusão). Sem cores ou fontes novas.

## Fora do escopo desta fase

- Extração por IA a partir do PDF do contrato
- Upload dos PDFs para Storage (`arquivo_contrato_url` fica como campo de texto opcional; o upload real vem numa próxima fase)
- Geração automática de parcelas em `pagamentos`/`honorarios`
- Aditivos e cálculo de reajuste

Aguardando aprovação para executar a migration e criar os arquivos.
