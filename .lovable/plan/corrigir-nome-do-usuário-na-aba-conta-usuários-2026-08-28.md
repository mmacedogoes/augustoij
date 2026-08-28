# Corrigir nome do usuário na aba Conta > Usuários

## Problema
Após cadastrar um usuário da equipe, a lista em **Conta > Usuários da conta** mostra o nome do condomínio onde deveria aparecer o nome do usuário.

## Causa confirmada
Em `src/lib/equipe.functions.ts`, `listUsuariosEquipe` busca os perfis (`profiles`) usando o client autenticado do próprio dono — sujeito ao RLS da tabela `profiles`. Como o dono não tem permissão de leitura sobre o perfil de outros usuários, a consulta retorna vazio, `nome` e `email` ficam `null` e a única linha de texto visível no cartão é a dos condomínios vinculados — dando a impressão de que o nome exibido é o do condomínio.

## Correção
1. Em `listUsuariosEquipe` (`src/lib/equipe.functions.ts`), trocar a consulta a `profiles` para usar o client privilegiado (`supabaseAdmin`, via import dinâmico, mesmo padrão já usado em `criarUsuarioEquipe`).
   - Seguro: a função já lista apenas `user_id`s vinculados a condomínios cujo `owner_id` é o próprio usuário autenticado, então nenhum dado de terceiros é exposto.
2. Melhoria de apresentação em `UsuariosEquipePanel.tsx` (se necessário após o teste): garantir fallback para e-mail quando `nome` estiver vazio (já existe `u.nome ?? u.email`).

## Verificação
- Recarregar Conta > Usuários e confirmar que cada cartão mostra o nome do usuário cadastrado (não o do condomínio).
- Conferir o build em `/tmp/observability/build-errors.log`.
