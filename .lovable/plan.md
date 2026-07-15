# Correção de duplicidade — proprietários e imóveis

## Causa raiz
- Import de contrato faz `INSERT` direto em `proprietarios` sem consultar CPF; não há índice único → cada contrato do mesmo dono cria um novo proprietário.
- Dedup de imóvel exige `numero_unidade` igual em string; a IA grava variações ("406", "Apto 406", "406 - bloco A", com endereço embutido), então nunca casa e cria novo imóvel.
- Não há campo `bloco` separado nem normalização de CPF/unidade.

## O que fazer

### 1. Banco (migração única)
- `imoveis.bloco text` (novo).
- Função `public.normalize_unidade(text)` (só dígitos).
- Índice único parcial `proprietarios(owner_admin_id, regexp_replace(cpf,'\D','','g'))` quando CPF não é nulo.
- Índice único parcial `imoveis(owner_admin_id, lower(edificio), normalize_unidade(numero_unidade), coalesce(lower(bloco),''))` quando edifício e unidade não são nulos.
- **Backfill de unificação** por `owner_admin_id`:
  - Proprietários: manter o mais antigo por CPF-dígitos; consolidar campos vazios; reapontar `imoveis.proprietario_id` e `contratos_administracao.proprietario_id`; apagar duplicados.
  - Imóveis: manter o mais antigo por (edifício, unidade-dígitos, bloco); reapontar `contratos_locacao.imovel_id`, `manutencoes.imovel_id` (e demais FKs relevantes); apagar duplicados.

### 2. Extração (src/lib/imoveis/importar.functions.ts)
- Ajustar `SYSTEM_PROMPT`: `numero_unidade` só o número; adicionar `bloco` no JSON; `edificio` só o nome do prédio; `endereco` só logradouro/nº do prédio.
- Após parse: normalizar CPF (só dígitos); extrair só-dígitos para `numero_unidade`; separar bloco quando vier embutido.

### 3. Dedup no salvamento
- Proprietário: se `proprietario_id` não vier, buscar por CPF-dígitos do admin; se achar, reutilizar id e completar apenas campos vazios. Fallback por nome+telefone quando CPF nulo.
- Imóvel: reescrever `buscarImovelDuplicado` usando chave forte (edifício, unidade-dígitos, bloco) e chave secundária (endereço, unidade-dígitos, bloco). Manter `forcar_novo_imovel` como escape.
- Mesmo tratamento no laço de `imoveis_administrados`.

### 4. UX de revisão (src/routes/_authenticated/app.admin.imoveis.importar.tsx)
- Aviso "Proprietário já cadastrado (CPF X) — Vincular / Criar novo".
- Campo Bloco visível; placeholder "somente o número, ex.: 406" em `numero_unidade`.
- Reaproveitar dialog de duplicata de imóvel com a nova chave.

### 5. Verificação
- Após migração, conferir 1 proprietário e 4 imóveis com contratos/caução/honorários intactos.
- Reimportar um dos contratos e confirmar que não gera novo registro.

## Fora do escopo
- Merge de proprietários com CPFs distintos (requer decisão humana).
- Dedup por nome quando ambos os lados têm CPF diferente.
