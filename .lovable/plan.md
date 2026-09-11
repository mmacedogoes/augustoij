# Documentos do Arvoredo travados em "processando"

## O que foi verificado agora

Três documentos foram enviados hoje, às 12:20/12:21:

| Arquivo | Situação | Trechos lidos |
| --- | --- | --- |
| NEO-ARV - Manual de Uso, Operação e Manutenção.pdf | Pronto | 125 |
| REGIMENTO INTERNO - ARVOREDO.pdf | Processando desde 12:26 (etapa "reiniciando") | 0 |
| ESCRITURA PARTICULAR DE CONVENÇÃO... .pdf | Processando desde 12:20, sem nenhum registro de progresso | 0 |

O manual tinha texto digital e foi lido em uma única passada. Os outros dois são digitalizados
(imagem), e precisam ser lidos por reconhecimento de imagem em blocos de 6 páginas.

## Causa confirmada

A leitura de documentos digitalizados é conduzida pela própria página aberta no navegador: cada
chamada ao servidor lê o que couber em 45 segundos e devolve "ainda falta"; é o navegador que pede
a próxima rodada, até 25 vezes.

Disso decorrem três falhas:

1. Se o usuário troca de aba, fecha a página, perde a conexão ou a rodada estoura o tempo do
   servidor, o ciclo simplesmente para. O documento fica marcado como "processando" para sempre,
   sem erro e sem ninguém para retomar.
2. Nada limita a idade desse estado: não existe detecção de documento parado, nem retomada
   automática.
3. A convenção ficou sem qualquer registro de diagnóstico (campo de acompanhamento vazio), ou seja,
   a primeira rodada nem chegou a gravar sucesso nem falha — o pedido morreu no meio. O regimento
   parou logo após a limpeza para releitura, exatamente no mesmo padrão.

Ou seja: não é um arquivo defeituoso; é a leitura que depende da aba aberta e não se recupera
sozinha.

## Plano de correção

### 1. Retomada automática no servidor
- Criar um endpoint agendado (`/api/public/hooks/documentos-retomar`) que, a cada poucos minutos,
  procura documentos em "processando" sem evolução há mais de ~3 minutos e executa a próxima
  rodada de leitura por conta própria, até concluir.
- Marcar cada tentativa no acompanhamento do documento (rodadas, blocos prontos, último avanço) e
  garantir que duas execuções simultâneas não briguem pelo mesmo documento.
- Limitar tentativas: após N rodadas sem nenhum avanço, o documento passa a "erro" com mensagem
  clara em vez de ficar eternamente "processando".

### 2. Nunca deixar estado silencioso
- Gravar o acompanhamento já no início de cada rodada (documento baixado, total de páginas,
  blocos pendentes), para que uma interrupção deixe rastro em vez de campo vazio.
- Na limpeza para releitura, registrar também total de blocos previstos, evitando o estado
  "reiniciando" sem informação.

### 3. Interface honesta
- Na aba Documentos, mostrar progresso real (blocos lidos / total, páginas), há quanto tempo está
  parado e um botão "Continuar leitura".
- Quando a leitura for interrompida por sair da página, exibir "leitura pausada — retomando
  automaticamente" em vez de "processando".

### 4. Destravar os dois documentos do Arvoredo
- Rodar a retomada para o regimento e para a convenção até o fim, conferindo número de trechos
  indexados e páginas que falharam.
- Para a convenção, após a leitura, executar a interpretação de unidades e conferir o balanço
  (unidades, frações e áreas com fonte no texto), sem inventar valores.
- Reportar o resultado de cada um dos dois arquivos.

## Detalhes técnicos
- `src/lib/documentos-processar.server.ts`: gravar meta no início da rodada; incluir contadores de
  tentativa e `travado_ate` para exclusão mútua.
- `src/routes/api/public/hooks/documentos-retomar.ts`: novo endpoint protegido por segredo,
  chamado por cron, iterando documentos `status_processamento = 'processando'` com
  `processamento_meta.atualizado_em` antigo (ou nulo, usando `created_at`).
- `src/components/documentos/DocumentosPanel.tsx`: exibir progresso/idade e ação de continuar; o
  laço no navegador deixa de ser o único motor.
- Sem alteração de esquema obrigatória: `processamento_meta` (jsonb) comporta os novos campos.
