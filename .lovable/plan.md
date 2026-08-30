# Leitura completa de convenções, regimentos e atas escaneados

## O problema, confirmado nos dados

No condomínio ALTAVISTA:

- `CONVENÇÃO ALTAVISTA.pdf` está marcada como "pronto", mas o sistema guardou apenas ~3 mil caracteres (9 trechos). Uma convenção completa com quadro de frações tem muito mais que isso — ou seja, a leitura parou nas primeiras páginas.
- `REGIMENTO_INTERNO.pdf` falhou por inteiro ("não foi possível ler o conteúdo visual do documento") e não gerou nenhum trecho.
- A ata de 31.03.2026 leu ~9 mil caracteres.

A causa é o caminho de leitura de PDFs escaneados: hoje o arquivo inteiro é mandado de uma só vez para a IA, em uma única chamada, pedindo a transcrição completa. Documentos longos em fotocópia estouram o limite de resposta e voltam truncados (caso da convenção) ou dão erro único e definitivo (caso do regimento). Além disso, o texto lido é normalizado com colapso de espaços antes de ser guardado, o que desmonta as tabelas de fração ideal.

## O que vai mudar

### 1. Leitura por blocos de páginas, com reconstrução completa

Um PDF sem camada de texto passa a ser dividido em blocos de poucas páginas e cada bloco é lido separadamente pela IA, em sequência controlada. As transcrições são concatenadas na ordem original. Assim uma convenção de 40 páginas escaneadas é lida inteira, inclusive o anexo do quadro de frações que costuma ficar no fim.

O mesmo caminho vale para convenção, regimento, ata e qualquer outro tipo — não é específico de convenção.

### 2. Tolerância a falhas parciais

- Bloco que falhar por instabilidade momentânea é repetido uma vez, com espera.
- Bloco que continuar ilegível é registrado como lacuna e a leitura segue nos demais.
- O documento só é marcado como falho quando: nenhuma página produziu texto legível, o arquivo está corrompido/protegido por senha, ou o conteúdo lido claramente não corresponde a um documento (arquivo vazio, imagem sem texto).
- Quando parte do documento foi lida, o documento fica pronto e a lacuna é informada, em vez de descartar tudo.

### 3. Preservação de tabelas

O texto transcrito passa a preservar quebras de linha e a formatação de tabela em Markdown ao ser fatiado para indexação, com trechos maiores e corte preferencial em fronteira de linha. Uma linha de quadro de frações deixa de ser partida no meio.

### 4. Extração de unidades mais robusta

- Os trechos de tabela deixam de chegar amassados à IA de unidades, o que hoje é a principal razão de frações "não encontradas".
- A leitura de frações passa a ser feita em lotes quando o quadro é grande, em vez de uma chamada única que pode truncar.
- As mensagens de falha continuam explícitas: o sistema segue proibido de inventar, calcular ou dividir frações. Se um valor não está no papel, ele volta vazio e é apontado na revisão.

### 5. Reprocessar documento

Botão "Reprocessar" na lista de documentos, para reler com o novo motor os arquivos já enviados (a convenção e o regimento do ALTAVISTA, por exemplo) sem precisar subir de novo. Também limpa os trechos antigos antes de reindexar.

## Detalhes técnicos

- Nova dependência `pdf-lib` (JavaScript puro, compatível com o runtime do servidor) para fatiar o PDF em sub-PDFs de N páginas sem precisar renderizar imagem.
- `src/lib/documentos.server.ts`: `extractTextWithVision` passa a receber o PDF, contar páginas, montar blocos (padrão 4 páginas), chamar o gateway por bloco com concorrência 2, montar o resultado e devolver `{ texto, paginasLidas, paginasFalhas }`. Imagens soltas seguem em chamada única. Modelo multimodal atualizado para a geração atual do Gemini Flash.
- `chunkText` ganha modo que preserva `\n`, tamanho maior (~1800) e corte em fim de linha; tabelas Markdown ficam íntegras.
- `src/lib/documentos.functions.ts` (`processDocumento`): usa o novo retorno, grava status `pronto` com aviso quando há páginas ilegíveis, e só marca erro nos casos terminais. Nova server function `reprocessarDocumento`.
- `src/lib/unidades-ia.functions.ts`: `montarTextos` deixa de depender de texto colapsado; `extrairQuadroFracoes` passa a rodar em lotes de trechos tabulares e consolidar os mapas. Regras anti-invenção e as validações de cobertura permanecem como estão.
- `src/components/documentos/DocumentosPanel.tsx`: ação "Reprocessar" por linha e exibição do aviso de páginas não lidas.

## Depois de implementado

Reprocesso a convenção e o regimento do ALTAVISTA e reporto quantas páginas foram lidas, quantas unidades e frações saíram do documento, e o que eventualmente ficou ilegível.
