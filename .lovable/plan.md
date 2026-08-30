# Auditoria de unidades, endereçamento padrão e memória de infrações

Três frentes: (1) conferir o cadastro de unidades contra a convenção de cada condomínio e corrigir só o que estiver faltando/errado, (2) padronizar o endereçamento de notificações e comunicados, (3) criar memória de notificações/infrações por unidade com detecção de reincidência.

## Situação atual (verificada no banco)

16 condomínios cadastrados. Divergências já visíveis entre o número declarado na ficha do condomínio e as unidades efetivamente cadastradas:

```text
Condomínio                       declarado   cadastradas   sem fração   sem área   convenção
Condominido Ed. Renato Rocha        12           43            0           0          sim
Roberto Rocha                       60           60            0           0          sim
VIVANT CLUB RESIDENCE              158            0            -           -          não
EDIFICIO IZABELE RIBEIRO BRAGA      16           16            0           0          não
Lagos Country Resort               662          662            0         662          sim
The Haus                            88            0            -           -          sim
Noah / Ocean Palace                  0            0            -           -          sim
ALLIANCE HOUSE                     154          154          154         154          sim
Mai Residence                       33           33           33          33          sim
Condominio Versari                  70           43            0           0          sim
ALTAVISTA                           56           56           56          56          sim
SETAI CASAS VERTICAIS              100            0            -           -          não
Village Del Mar I / Reserva da Serra / condominio teste — sem unidades
```

Ou seja: há condomínios com unidades a mais, a menos, e vários com fração ideal e área totalmente vazias. Condomínios sem convenção anexada não podem ser auditados — serão listados como "sem base documental".

## 1. Auditoria de unidades x convenção

Nova rotina de auditoria (server function admin, `src/lib/unidades-auditoria.functions.ts`) que, para cada condomínio com convenção processada:

- relê a convenção pelo pipeline literal já existente (`reprocessarConvencao` / extração literal com proveniência, que hoje se recusa a inventar dados);
- compara o resultado com o cadastro atual, unidade a unidade (chave: bloco + número);
- gera um relatório por condomínio com: unidades faltantes, unidades cadastradas que não existem na convenção, frações/áreas divergentes e frações/áreas ausentes;
- soma das frações ideais conferida contra 100% (ou 1,0), sinalizando desvio.

Regra de correção — nada é sobrescrito às cegas:

- **Preenche** fração ideal e área quando o campo está vazio no cadastro e o valor consta literalmente na convenção.
- **Cria** unidades que constam na convenção e não existem no cadastro.
- **Nunca** apaga unidade existente, condômino, observação ou qualquer campo já preenchido por usuário.
- Divergência entre um valor já preenchido e o da convenção vira **pendência para revisão** (não é alterada automaticamente), exibida na tela para o dono decidir.
- Se a extração vier incompleta, o condomínio não é alterado — entra no relatório como "leitura incompleta".

Entrega: tela em Admin (`/app/admin/auditoria-unidades`) com o relatório consolidado por condomínio, contagem de correções aplicadas e lista de pendências; execução manual por condomínio ou em lote.

## 2. Endereçamento padrão em notificações e comunicados

Hoje o prompt do chat manda qualificar o destinatário com nome, CPF e unidade, mas o endereço não é injetado e não há um fallback determinístico.

Mudanças:

- Passar a incluir no bloco de cadastro do chat o endereço do condomínio (`condominios.endereco`, cidade/UF) e a identificação completa da unidade (bloco, número, tipo).
- Novo helper puro `montarEnderecamento(unidade, condominio)` (com teste unitário) que produz o cabeçalho padronizado:

```text
Ao(À) Sr.(a) {NOME COMPLETO}
CPF nº {CPF}
Unidade {número} — Bloco {bloco}
{endereço do condomínio}, {cidade}/{UF}
```

- Unidade sem condômino cadastrado (ou sem condômino principal): o cabeçalho usa exatamente `Ao(À) Condômino da unidade {unidade}`, mantendo unidade e endereço, sem nome nem CPF inventado.
- CPF ausente com nome presente: usa o nome e omite a linha do CPF, sem inventar número.
- Regra reforçada no system prompt: **toda** peça dirigida a condômino (notificação, advertência, multa, cobrança, comunicado individual) abre com esse bloco de endereçamento — inclusive quando gerada para exportação em PDF/DOCX.

## 3. Memória de notificações e infrações por unidade

Nova tabela `unidade_infracoes` (migração), com RLS pelas mesmas regras de acesso do condomínio:

- vínculo com condomínio e unidade, condômino opcional;
- tipo (notificação, advertência, multa, comunicado), categoria/assunto da infração, data e hora do fato, descrição;
- base normativa citada (convenção / regimento / ata), valor da multa quando houver;
- ligação opcional com a conversa e o documento gerado;
- carimbo de quem registrou.

Fluxo:

- Ao gerar uma peça dirigida a uma unidade, o sistema registra automaticamente a ocorrência (com confirmação do usuário na hora de salvar/baixar o documento).
- Antes de redigir, o chat consulta o histórico daquela unidade para a mesma categoria e injeta no contexto: quantas ocorrências anteriores, datas e tipo.
- Havendo reincidência, a IA aplica a consequência prevista na convenção/regimento/atas (advertência → multa → multa dobrada, conforme o documento do condomínio), citando a cláusula. Se os documentos não previrem a gradação, a peça diz isso e sugere deliberação, sem inventar penalidade.
- Nova aba **Histórico** na unidade, listando ocorrências em ordem cronológica, com filtro por categoria.

## Detalhes técnicos

- Auditoria roda com o cliente admin, mas iterando apenas condomínios existentes e gravando com validação de proveniência; toda alteração é logada em `admin_audit_log`.
- Reaproveita `unidades-ia.functions.ts` (extração literal + diagnóstico) — sem novo pipeline de IA.
- `chat-cadastro-condominial.ts` ganha endereço e o helper de endereçamento, coberto por testes em `src/lib/*.test.ts`.
- `unidade_infracoes` criada com GRANTs para `authenticated`/`service_role` e políticas baseadas em `is_condominio_member` / `pode_no_condominio`.
- `api/chat.ts` passa a montar o bloco de histórico de infrações quando a pergunta cita uma unidade.
