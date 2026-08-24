# Corrigir a tela de Assembleias travada em "Selecione um condomínio"

## O que está acontecendo

A tela de Assembleias decide qual condomínio carregar lendo um valor guardado no navegador com a chave `augusto.condominioAtivo`. Verifiquei o projeto inteiro: **nada nunca grava esse valor**. Só existem leituras — na lista de assembleias e na tela de convocar assembleia. Não há nenhum seletor de condomínio no topo da área logada.

Resultado: o valor é sempre vazio, a tela cai no estado "Selecione um condomínio no topo da página", e não existe topo nenhum onde selecionar. O módulo fica inacessível por completo, mesmo para o super admin.

A tela de convocar nova assembleia sofre do mesmo problema: ela lê a mesma chave inexistente e fica sem condomínio definido.

## A correção

Fazer no módulo de assembleias o mesmo que o painel de contratos já faz: um seletor próprio de condomínio na página, alimentado pelo banco.

1. **Seletor na lista de assembleias.** Um campo de seleção no cabeçalho da tela, com os condomínios disponíveis, no mesmo estilo visual do painel de contratos.
2. **Memória da escolha.** A seleção fica gravada na chave `augusto.condominioAtivo` (a mesma que o código já lê) e também no endereço da página, para que recarregar ou compartilhar o link mantenha o condomínio.
3. **Escolha automática quando só há um.** Se o super admin tiver acesso a um único condomínio, ele é selecionado sozinho e a lista carrega direto.
4. **Estado vazio honesto.** Só aparece "selecione um condomínio" quando existem vários e nenhum foi escolhido; se não houver nenhum condomínio cadastrado, a mensagem passa a ser essa, com atalho para cadastrar.
5. **Tela de convocar assembleia.** Passa a receber o condomínio pelo endereço vindo da lista, com o valor guardado como reserva, e exibe o mesmo seletor caso chegue sem condomínio definido.

## Detalhes técnicos

- Nova server function `listCondominiosParaAssembleias` em `src/lib/assembleias/assembleias.functions.ts`, com `requireSupabaseAuth` + `ensureAcessoAssembleias`, retornando `id, nome, cidade, uf` ordenados por nome (sem filtro de `owner_id`, já que o módulo é restrito ao super admin).
- `src/routes/_authenticated/app.assembleias.index.tsx`: `validateSearch` com `cid` opcional; `useCondominioAtivo` passa a resolver na ordem search → localStorage → único condomínio; `<Select>` do design system no cabeçalho; ao trocar, grava no localStorage, dispara `augusto:condominioAtivoChanged` e faz `navigate` com `replace`.
- `src/routes/_authenticated/app.assembleias.nova.tsx`: lê `cid` do search antes do localStorage; botão "Convocar assembleia" da lista passa o `cid` adiante.
- Sem migration, sem alteração de RLS, sem tocar em outros módulos.
