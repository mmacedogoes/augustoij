# Ambiente de trabalho compartilhado por conta dona

Hoje a conta Versari já compartilha automaticamente os condomínios criados pelo **dono** (gatilho de compartilhamento em banco), mas:

- As listagens ainda filtram por "proprietário do registro", então um usuário convidado não vê os condomínios do ambiente, e o dono não vê os condomínios cadastrados pelos usuários que ele criou.
- Não existe nenhuma função de exclusão de condomínio no aplicativo; no banco a permissão de exclusão está com quem criou o registro — inclusive um usuário convidado poderia excluir o que cadastrou.
- Os limites do plano e a tela de Usuários contam apenas os condomínios de cada pessoa, não os do ambiente.

## O que muda

1. **Ambiente único por conta dona**
   - Todo condomínio cadastrado por qualquer usuário do ambiente passa a pertencer ao ambiente da conta dona.
   - Ao cadastrar, o condomínio é compartilhado automaticamente com o dono e com os demais usuários do ambiente (o gatilho já faz isso; será ajustado para cobrir também os cadastros feitos por usuários convidados, garantindo que o dono entre como dono do condomínio).
   - O dono continua podendo restringir: na aba Conta > Usuários ele escolhe quais condomínios cada usuário enxerga e o que pode gerenciar.

2. **Listagens por ambiente**
   - "Meus condomínios", seletor de assembleias, painel de contratos, documentos e contadores de plano passam a considerar os condomínios do ambiente aos quais o usuário tem acesso (proprietário do registro **ou** vínculo ativo).

3. **Exclusão só pelo dono do ambiente**
   - Nova ação "Excluir condomínio" na ficha do condomínio, visível apenas para a conta dona do ambiente, com confirmação escrevendo o nome do condomínio.
   - No banco, a permissão de exclusão passa a exigir que o usuário seja a conta dona do ambiente daquele condomínio; usuários convidados não excluem nada, mesmo o que eles mesmos cadastraram.

4. **Limites de plano por ambiente**
   - A contagem de condomínios e de usuários passa a ser do ambiente (conta dona), evitando que um usuário convidado consuma um limite separado ou fique sem plano.

## Detalhes técnicos

- Banco (migração):
  - Nova função `condominio_ambiente_owner(uuid)` (SECURITY DEFINER) devolvendo a conta master do `owner_id` do condomínio, usando o `conta_master()` existente.
  - Substituir a política `condominios_delete_owner` por `condominios_delete_conta_master`, permitindo DELETE apenas quando `auth.uid() = conta_master(owner_id)`.
  - Ajustar `tg_condominio_compartilhar_equipe` para, quando o criador não for o master, inserir o master como `dono_condominio` com todas as permissões e replicar para os demais usuários do ambiente.
  - Backfill: garantir vínculo do master em todos os condomínios existentes criados por usuários vinculados.
  - Cascatas de exclusão já existentes serão verificadas antes de liberar o DELETE (documentos, unidades, contratos, assembleias).
- Servidor:
  - Novo helper `condominiosDoAmbiente(context)` em `src/lib/conta-master.server.ts` (ids do ambiente + ids acessíveis pelo usuário).
  - `src/lib/condominios.functions.ts`: `listCondominios` passa a listar por acesso (owner ou membro); nova `deleteCondominio` validando `conta_master(owner_id) === userId`.
  - `src/lib/equipe.functions.ts`: `condominiosDoDono` vira "condomínios do ambiente" e o limite de usuários conta o ambiente.
  - `src/lib/plan-context.functions.ts` e gates de criação em `condominios.functions.ts` contam condomínios do ambiente.
- Interface:
  - `app.condominios.index.tsx`: lista já vem do servidor; sem mudança de layout além do estado vazio.
  - `app.condominios.$id.tsx`: botão "Excluir condomínio" (destrutivo) exibido só para a conta dona, com diálogo de confirmação.

## Verificação

- Cadastrar um condomínio com uma conta convidada e conferir que ele aparece para o dono e para os demais usuários do ambiente.
- Conferir que o botão de excluir só aparece para o dono e que a exclusão é bloqueada no servidor para os demais.
- Conferir que a aba Conta > Usuários lista todos os condomínios do ambiente para atribuição.
