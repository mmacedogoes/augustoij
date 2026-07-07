## Causa raiz

O componente `<Toaster />` do **sonner** nunca é montado na árvore da aplicação. O wrapper existe em `src/components/ui/sonner.tsx`, mas ninguém o importa nem renderiza. Consequência: TODAS as chamadas `toast.error(...)` e `toast.success(...)` (usadas em ~20 arquivos, incluindo `UnidadesPanel.tsx`) são silenciosas — o código dispara a mensagem, mas nada aparece na tela.

Fluxo real ao clicar em **Salvar** em "Nova unidade":

1. `salvar()` roda a validação `if (!form.numero.trim())` → dispara `toast.error("Informe o número da unidade")` → silencioso → **"nada acontece"**.
2. Ou, se `numero` estiver preenchido, chama `createFn(...)`. Se o server function joga qualquer erro (ex.: duplicidade em `UNIQUE (condominio_id, bloco, numero)`, `fracao_ideal` inválido, etc.), o `catch` dispara `toast.error(e.message)` → silencioso → **"nada acontece"**.
3. Se der certo, `setOpenForm(false)` fecha e `refresh()` atualiza — nesse caso o usuário veria a nova unidade. Como não vê, é porque um dos dois toasts silenciosos acima está sendo disparado.

O problema não é RLS, não é policy, não é o schema — todas as políticas (`Donos podem inserir unidades`), grants e constraints estão OK. O problema é UX: erros ficam invisíveis, dando a sensação de que o app "não faz nada".

## Correção

### 1. Montar `<Toaster />` globalmente (uma linha resolve toda a aplicação)

Em `src/routes/__root.tsx`, importar e renderizar `<Toaster />` dentro do shell:

```tsx
import { Toaster } from "@/components/ui/sonner";
// ...
<>
  <Outlet />
  <Toaster richColors position="top-right" />
</>
```

Isso restaura o feedback visual de todos os `toast.error/success/info` já presentes no código (login, condomínios, unidades, admin, onboarding, etc.). Depois disso, ao clicar em Salvar, o usuário verá exatamente o que está impedindo o save.

### 2. Garantia defensiva no `UnidadesPanel`

No `catch` de `salvar()`, além do toast, logar `console.error(e)` — assim mesmo se o Toaster falhar futuramente, o erro fica visível no console. Custo: 1 linha.

### 3. Não é necessário mexer em backend

Nenhuma migração, nenhuma alteração de RLS, nenhuma mudança de policy. O banco e o server function `createUnidade` estão corretos.

## Arquivos alterados

- `src/routes/__root.tsx` — adicionar import e `<Toaster />` no shell.
- `src/components/unidades/UnidadesPanel.tsx` — adicionar `console.error(e)` no catch do `salvar()`.

## Verificação

Após implementar, você reabre o formulário de "Nova unidade" e clica em Salvar. Vai aparecer o toast com a mensagem real (ex.: "Informe o número da unidade" ou o erro do servidor). Se o erro real for algo diferente (validação de fração, duplicidade, etc.), aí sim eu ajusto o campo específico.
