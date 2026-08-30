# Correção definitiva: permissão de condomínio e releitura de documentos longos

## O que foi verificado

- O condomínio ALTAVISTA pertence a `sac@versari.com.br`. A extração de unidades por IA valida acesso com uma checagem **somente de dono** (`assertOwnerCondominio`, em `src/lib/unidades-ia.functions.ts`), ignorando o ambiente de trabalho compartilhado e os vínculos em `condominio_members`. Qualquer usuário do ambiente que não seja o dono do registro recebe "Sem permissão para este condomínio" — o problema é geral, não específico do Altavista.
- A convenção do Altavista **é legível**: baixei o PDF (57 páginas, 4 MB), fatiei em blocos e o OCR do gateway devolveu a transcrição fiel (status 200), inclusive cabeçalhos da escritura de convenção.
- A causa do erro "não foi possível ler" é **tempo**: cada bloco de 4 páginas leva ~30 s. Com concorrência 2, 57 páginas exigem ~4 minutos numa única requisição, muito acima do limite de execução do servidor. A requisição morre no meio e o documento fica gravado como erro. Dois documentos do Altavista estão exatamente nesse estado (convenção e regimento, 0 trechos indexados).
- Agravante menor: a classificação de erro trata qualquer mensagem contendo "OCR" como "conteúdo ilegível", mascarando falhas de tempo/limite como problema de qualidade do arquivo.

## Correções

### 1. Acesso por ambiente de trabalho (todos os condomínios e usuários)

- Substituir a checagem de dono na extração de unidades por uma verificação única de acesso: dono do registro, membro vinculado, conta dona do ambiente ou administrador interno.
- Varrer os demais módulos atrás de checagens equivalentes de "só o dono" e alinhá-las à mesma regra (unidades, auditoria de unidades, documentos, infrações).
- Escrita continua respeitando as permissões do vínculo; leitura/reprocessamento fica liberado a todo o ambiente.

### 2. Leitura de documentos longos sem estourar o tempo

- Tornar a leitura **retomável por blocos**: cada bloco transcrito é gravado imediatamente (trechos + progresso no documento), de modo que uma interrupção não perde o trabalho já feito.
- A ação "Reler documento" passa a processar em rodadas: retoma do primeiro bloco pendente e devolve o progresso; a tela continua chamando automaticamente até concluir, mostrando "página X de Y".
- Aumentar a vazão por rodada (mais páginas por bloco e mais chamadas simultâneas, com recuo em caso de limite de uso), reduzindo o número de rodadas.
- Falha só quando **nenhuma** página for lida. Com leitura parcial, o documento fica utilizável e o aviso com as páginas pendentes é gravado e exibido.
- Corrigir a classificação de erro para separar "tempo/limite excedido" (mensagem: continuar a releitura) de "digitalização ilegível".

### 3. Reprocessar o Altavista e validar

- Rodar a releitura da convenção e do regimento do Altavista até concluírem, conferir os trechos indexados e a extração de frações ideais/áreas na aba Unidades.
- Testar com uma conta vinculada (não dona) que a importação de unidades não retorna mais erro de permissão.

## Detalhes técnicos

- `src/lib/unidades-ia.functions.ts`: `assertOwnerCondominio` → helper compartilhado usando `condominiosAcessiveisIds` / `isDonoDoAmbienteDoCondominio` (`src/lib/conta-master.server.ts`) e `is_condominio_member`.
- `src/lib/documentos.server.ts`: `extractTextWithVisionDetalhado` ganha modo por faixa de blocos (índice inicial/limite de rodada) e retorna blocos concluídos + pendentes.
- `src/lib/documentos-processar.server.ts`: persistência incremental de `document_chunks` por bloco, progresso e aviso em `documentos` (campo de progresso/aviso a criar via migração, se necessário), embeddings por lote já gravados.
- `src/lib/documentos.functions.ts`: `reprocessarDocumento` retorna `{ concluido, paginasLidas, totalPaginas, pendentes }`.
- `src/components/documentos/DocumentosPanel.tsx`: laço de rodadas com barra de progresso e aviso de páginas pendentes.
- `src/lib/ingest-errors.ts`: nova categoria para tempo/limite excedido.
