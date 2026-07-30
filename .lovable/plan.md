## Objetivo

Quando o Augusto redigir uma minuta (contrato, notificação, parecer, comunicado, ata, declaração etc.), a resposta no chat termina com um convite e aparece, abaixo da mensagem, um bloco com dois botões: **Gerar PDF** / **Gerar DOCX** (e "Não, obrigado"). O download é gerado no navegador, com a formatação padrão do escritório.

## Como a detecção funciona (sem backend novo)

1. No prompt de sistema em `src/routes/api/chat.ts`, acrescento uma instrução: quando a resposta contiver uma **minuta redigida**, o modelo deve fechar a mensagem com um marcador em linha própria:

```text
[[DOCUMENTO: TÍTULO DO DOCUMENTO]]
Deseja que eu gere o arquivo deste documento?
```

2. No `ChatPanel.tsx`, ao renderizar cada mensagem do assistente, procuro esse marcador. Se existir: removo o marcador do texto exibido e mostro o bloco de ações de download logo abaixo da mensagem. Se não existir, nada muda — comportamento atual intacto.

Fallback: se o modelo esquecer o marcador, mantenho uma heurística leve (resposta longa contendo "CLÁUSULA", "NOTIFICAÇÃO", "PARECER", "COMUNICADO", "Pelo presente" etc.) para ainda oferecer o botão. Título nesse caso = primeira linha em caixa alta, ou "DOCUMENTO".

## Formatação exigida

Um único módulo `src/lib/documento-export.ts` com as regras, usado pelos dois formatos:

- Título: caixa alta, Cormorant Garamond, 14pt, negrito, centralizado.
- Corpo: Cormorant Garamond, 12pt, entrelinha 1,5, recuo de primeira linha de 2 cm, justificado.
- Margens A4 padrão (2,5 cm), rodapé sem numeração de página.
- Parser simples do markdown que o modelo produz: `##`/`**texto**` viram subtítulos em negrito; linhas de assinatura e listas preservadas; tabelas convertidas em linhas de texto (raras em minutas).

**PDF** — `jsPDF` (já no projeto), carregado por `import()` só no clique. Preciso embutir a fonte Cormorant Garamond (Regular + Bold) como VFS base64; hoje o jsPDF só tem as fontes padrão. Peso: ~2 arquivos de fonte carregados sob demanda, nunca no bundle inicial.

**DOCX** — instalo `docx` (JS puro, roda no browser) e gero com `Packer.toBlob`, aplicando `font: "Cormorant Garamond"`, `size` 28/24 half-points, `spacing.line: 360`, `indent.firstLine: 1134` (2 cm em DXA). Se a fonte não estiver instalada na máquina do usuário, o Word cai para a serifada padrão — comportamento normal de DOCX, sem quebra.

## Robustez

- Validação antes de gerar: texto vazio/curto demais → toast "Não há conteúdo para gerar o arquivo", botão não dispara.
- `try/catch` em toda a geração; falha → toast com mensagem clara, botão volta ao estado normal (nada de erro silencioso).
- Estados do botão: **idle** → **gerando** (spinner + desabilitado) → **sucesso** (toast "Arquivo baixado") ou **erro**. Estado "vazio" coberto pela validação acima.
- Casos de borda: clique duplo (botão desabilitado durante a geração), mensagem ainda em streaming (bloco só aparece após o fim do stream), texto muito longo (paginação automática do jsPDF), nome de arquivo sanitizado a partir do título.
- Nada de rede, nada de storage, nada de chave: a geração é 100% local no navegador. Sem tabela nova, sem RLS nova, sem alteração de permissão — o conteúdo já é da própria conversa do usuário.

## Arquivos tocados


| Arquivo                                     | Mudança                                                      |
| ------------------------------------------- | ------------------------------------------------------------ |
| `src/lib/documento-export.ts`               | novo — regras de formatação + `gerarPdf()` / `gerarDocx()`   |
| `src/assets/fonts/cormorant-*.ts`           | novo — fontes base64 para o jsPDF                            |
| `src/components/chat/DocumentoDownload.tsx` | novo — bloco de botões com os 4 estados                      |
| `src/components/chat/ChatPanel.tsx`         | detecta o marcador, limpa o texto exibido, renderiza o bloco |
| `src/routes/api/chat.ts`                    | acrescenta a instrução do marcador ao prompt de sistema      |
| `package.json`                              | adiciona `docx`                                              |


## Fora de escopo (não faço agora)

Salvar os documentos gerados no storage/histórico, editor de minuta antes do download, timbre/logo no cabeçalho, e assinatura eletrônica. Se quiser algum desses depois, é um passo separado.