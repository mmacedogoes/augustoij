# Corrigir "violates row-level security policy for table unidades" na importação

## O que está acontecendo

A importação das 56 unidades do ALTAVISTA falha porque a regra de gravação da tabela de unidades exige que você seja o **dono registrado no cadastro do condomínio**, enquanto o resto do sistema já trabalha com o modelo de **ambiente compartilhado** (dono do condomínio + operadores da mesma conta master).

Confirmado no banco:

- O ALTAVISTA tem `owner_id = c4b4767a…`.
- Na equipe do condomínio, quem consta como `dono_condominio` é `7929fdb7…` (mais dois operadores). Nenhum deles é o `owner_id`.
- A função de importação (`aplicar_unidades_extraidas`) autoriza corretamente por dono, conta master, membro ou admin — mas ela **não é SECURITY DEFINER**, então o `INSERT` ainda é avaliado pelas políticas da tabela.
- As políticas de inserir/atualizar/excluir de `unidades` só aceitam `condominios.owner_id = auth.uid()`.

Resultado: a autorização da função passa, o `INSERT` é bloqueado, e a tela mostra "Nenhuma unidade foi alterada: new row violates row-level security policy".

O mesmo bloqueio afeta a edição manual e a exclusão de unidades por quem não é o `owner_id`, não só a importação.

## Correção

### 1. Alinhar as regras de acesso da tabela de unidades ao ambiente compartilhado (migração)

Substituir as três políticas de gravação (inserir, atualizar, excluir) por regras que aceitem:

- o dono registrado do condomínio (`owner_id`);
- quem tem permissão de unidades pelo cadastro de equipe (`pode_no_condominio(auth.uid(), condominio_id, 'unidades')`);
- quem pertence à mesma conta master do dono (`conta_master(owner) = conta_master(auth.uid())`).

A leitura continua como está (membros e administradores).

### 2. Tornar a função de importação SECURITY DEFINER

`aplicar_unidades_extraidas` já faz sua própria verificação de permissão no início e recusa estratégias que sobrescrevem dados. Passá-la para SECURITY DEFINER (com `search_path` fixo) evita que uma divergência futura entre a checagem da função e as políticas volte a produzir esse erro silencioso.

### 3. Mensagem de erro mais útil

Na tela de revisão de unidades, quando o erro for de permissão, exibir "Você não tem permissão para gravar unidades neste condomínio" em vez do texto técnico do banco.

## Detalhes técnicos

- Migração: `DROP POLICY` + `CREATE POLICY` para INSERT/UPDATE/DELETE em `public.unidades`, usando as funções security-definer já existentes `pode_no_condominio` e `conta_master`.
- `CREATE OR REPLACE FUNCTION public.aplicar_unidades_extraidas(...) SECURITY DEFINER SET search_path = public` mantendo o corpo atual, inclusive a restrição de estratégias (`manter`/`preencher`).
- Front-end: tratamento do erro em `src/lib/unidades.functions.ts` / painel de revisão.
- Nada de dado preenchido manualmente é alterado: a estratégia `preencher` continua só completando campos vazios.

## Verificação

- Importar as 56 unidades do ALTAVISTA com o usuário atual e conferir criação sem erro.
- Conferir que um operador **sem** permissão de unidades continua bloqueado.
