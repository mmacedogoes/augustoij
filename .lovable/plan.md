## Objetivo
Adicionar campo "cidade" ao cadastro de condomínios, alertar o super admin sobre cidades novas e mostrar disclaimer ao usuário quando cadastrar condomínio em cidade ainda não coberta pela legislação local.

## Cidades já cobertas (whitelist)
- João Pessoa/PB
- Cabedelo/PB
- Campina Grande/PB

Normalização: comparação case-insensitive, sem acentos, com UF. Ex.: `joao pessoa|PB`.

## Alterações no banco

1. **`condominios`**: adicionar coluna `cidade TEXT`.
2. **Nova tabela `cidades_cobertas`** (seed com as 3 cidades acima):
   - `cidade`, `uf`, `slug` (normalizado), `created_at`
   - RLS: SELECT para authenticated; escrita apenas super_admin.
3. **Nova tabela `cidades_novas_alertas`** — registra cidades cadastradas fora da whitelist:
   - `cidade`, `uf`, `slug`, `primeiro_condominio_id`, `owner_id`, `status` (`pendente` | `resolvida`), `created_at`, `resolvida_em`
   - Unique em `slug` para não duplicar alertas por cidade.
   - RLS: apenas super_admin lê/atualiza; INSERT via server function (SECURITY DEFINER ou usando `supabaseAdmin` dentro do handler após validação).

## Backend (server functions)

Em `src/lib/condominios.functions.ts`:

- **`createCondominio` / `updateCondominio`**: aceitar `cidade` no schema Zod. Ao criar/atualizar:
  1. Normalizar `cidade+uf` → slug.
  2. Se slug ∈ whitelist (3 cidades PB) → nada além do save.
  3. Se slug ∈ `cidades_cobertas` → nada além do save.
  4. Caso contrário → `upsert` em `cidades_novas_alertas` (ignora conflito de slug para não duplicar) e retornar flag `cidadeNova: true` ao cliente.
- Retornar `{ row, cidadeNova }` para o front decidir se mostra o disclaimer.

Nova função em `src/lib/admin.functions.ts`:
- **`listCidadesNovasAlertas`** (protegida por `ensureSuperAdmin` / `isAdminInternoServer`).
- **`marcarCidadeResolvida`** (super admin): move o slug para `cidades_cobertas` e marca alerta como `resolvida`.

## Frontend

### `src/routes/_authenticated/app.condominios.index.tsx` (form de cadastro)
- Novo campo obrigatório **Cidade** no `Dialog` de novo condomínio (input texto, validação min 2).
- Após `create()`, se `cidadeNova === true`, abrir um `Dialog`/`AlertDialog` com o texto:
  > "Seja bem-vindo! Verifiquei que a cidade do seu condomínio é nova em meu banco de dados. Por isso, em até 3 dias, terei a atualização de toda a legislação condominial local. Meu banco de jurisprudência e legislações federais e estaduais já está a sua disposição."
- Também exibir `cidade` no card de listagem (ex.: `Cidade/UF • N unidades`).

### `src/routes/_authenticated/app.condominios.$id.tsx` (edição)
- Adicionar o mesmo campo Cidade e mesma lógica de disclaimer se a cidade nova aparecer via update.

### Painel super admin
- Nova rota **`src/routes/_authenticated/app.admin.cidades-novas.tsx`**:
  - Lista alertas pendentes (`cidade`, `uf`, data, owner, condomínio).
  - Botão "Marcar como atualizada" → chama `marcarCidadeResolvida`, some da lista.
- Adicionar link no `AdminNav` ("Cidades novas") com badge de contagem pendente (opcional).

### `src/routes/_authenticated/app.admin.condominios.tsx`
- Exibir a coluna `cidade` junto com UF.

## Detalhes técnicos

- Whitelist e normalização isolados em `src/lib/cidades-cobertas.ts`:
  ```ts
  export const CIDADES_WHITELIST = new Set([
    "joao pessoa|PB", "cabedelo|PB", "campina grande|PB",
  ]);
  export function slugCidade(cidade: string, uf: string) {
    return `${cidade.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim()}|${uf.toUpperCase()}`;
  }
  ```
- Migração faz INSERT nas 3 cidades em `cidades_cobertas`.
- Categoria e demais campos do form permanecem inalterados.

## Fora do escopo
- Notificação por e-mail ao super admin (o alerta aparece na UI). Se quiser e-mail, sinalizar depois.
- Ingestão automática da legislação da cidade — o super admin faz manualmente após ver o alerta.
