# Contratos: acesso por condomínio, avisos semanais e usuários da conta

## 1. Relatório do teste de e-mails de pendências (feito agora)

Verifiquei a rotina de lembretes e o agendamento no banco:

- A rotina automática existe e **está rodando**: agendamento diário às 12h UTC (9h de Brasília), com 35 execuções registradas e a última em 28/08 com status "succeeded".
- **Nenhum e-mail foi efetivamente enviado.** Motivos encontrados nos dados:
  - Existem 2 contratos cadastrados, mas **0 eventos** (`contrato_eventos`) gerados — a rotina só notifica eventos pendentes com data vencida.
  - Existem **0 responsáveis** atribuídos a contratos, então mesmo com eventos o destinatário cairia no criador do contrato.
  - **0 notificações** in-app e **0 registros** de envio de e-mail nos últimos 30 dias.
  - Existem 69 períodos de checklist, mas nenhum se enquadrou na regra de "competência de mês anterior ainda aberta com item obrigatório pendente".
- Conclusão: o encanamento está de pé (cron + template + Resend), mas não há dados que disparem avisos, e a periodicidade está errada (diária, não semanal).

## 2. Avisos semanais (segundas, 8h)

- Reagendar a rotina para **segunda-feira às 8h de Brasília** (11h UTC), substituindo o agendamento diário.
- Mudar a janela da rotina de "hoje" para **a semana toda**: incluir pendências vencidas + tudo que vence nos próximos 7 dias (vigência, janela de denúncia, reajuste, pagamento, obrigações e checklists pendentes).
- Ajustar assunto e textos do e-mail para linguagem semanal ("Suas pendências de contratos desta semana").
- Garantir a geração de eventos: ao rodar, gerar/atualizar a agenda dos contratos ativos que ainda não têm eventos, para que a semana não venha vazia.
- Adicionar um botão "Enviar prévia para mim" na área admin de contratos para testar o envio real sob demanda, e reexecutar o teste depois de aplicar.

## 3. Acesso restrito por condomínio

Hoje o módulo filtra apenas por dono (`owner_id`) e o Super Admin vê todos.

- Passar a considerar também os condomínios em que o usuário é **membro atribuído** (`condominio_members`): seletor de condomínios, listagem de contratos, painel consolidado, indicadores e agenda.
- Reescrever as políticas de acesso do banco (contratos e tabelas filhas) para "dono do condomínio **ou** membro do condomínio", com escrita conforme o grau de acesso do membro.
- Manter o modo suporte somente-leitura do Super Admin como já está.

## 4. Liberar o módulo mantendo limites

- Remover o bloqueio de plano de acesso ao módulo e ao painel consolidado (todos os planos, inclusive Gratuito, entram e navegam).
- **Manter** os limites de contratos ativos por plano na criação de contrato, com a mensagem de upgrade no momento em que o limite é atingido.

## 5. Módulo Conta: gestão de usuários

Disponível para os planos **Gestão** e **Administradora** (demais planos veem a seção com aviso de upgrade).

- Nova seção "Usuários" na página Conta:
  - Criar usuário (nome, e-mail, senha inicial) respeitando o limite de usuários do plano.
  - Atribuir "todos os meus condomínios" ou selecionar condomínios específicos.
  - Definir o grau de acesso por usuário.
  - Editar atribuições, revogar acesso e remover usuário.
- **Perfil padrão do usuário criado**: pode ver tudo o que foi atribuído e **adicionar documentos**; não pode criar usuários, não pode criar condomínios e não pode excluir documentos.
- O dono pode elevar o usuário concedendo, por permissão: gerenciar contratos, gerenciar documentos (incluir exclusão), gerenciar assembleias, gerenciar unidades/condôminos, gerenciar usuários.

## Detalhes técnicos

- Banco: adicionar colunas de permissão em `condominio_members` (ex.: `pode_gerenciar_contratos`, `pode_excluir_documentos`, `pode_gerenciar_usuarios`, `pode_gerenciar_assembleias`, `pode_gerenciar_unidades`) com defaults restritivos; função `security definer` `pode_no_condominio(_user, _condo, _permissao)` para uso nas políticas sem recursão; GRANTs padrão.
- `src/lib/contratos-servico/guard.ts`: trocar checagem de `owner_id` por dono-ou-membro e expor helper de permissão de escrita.
- `src/lib/contratos-servico/contratos.functions.ts` e demais `*.functions.ts` do módulo: filtros por conjunto de condomínios acessíveis em vez de `owner_id`.
- `src/components/gates/GestaoContratosGate.tsx`: deixa de bloquear acesso; limites permanecem em `assertNovoContratoPermitido`.
- `src/routes/api/public/hooks/lembretes-contratos.ts`: janela semanal, geração de eventos faltantes, textos semanais; novo agendamento `0 11 * * 1` substituindo o diário.
- `src/lib/membros.functions.ts`: criar/editar/remover usuários com permissões e múltiplos condomínios, validando limite `usuarios` de `src/config/planos.ts`.
- Novo componente de gestão de usuários usado em `src/routes/_authenticated/app.conta.tsx`.
