# Notificação sem fundamentação correta (caso Emmanuelle) — diagnóstico e correção

## O que eu apurei nos dados

Condomínio: Reserve Altiplano II (conta de Emmanuelle Araujo).

1. **Convenção de Condomínio: nunca foi lida.** Status "erro", 22 tentativas, **0 trechos indexados**. Mensagem gravada: "A leitura foi tentada várias vezes sem avançar".
2. **Regimento Interno: marcado como "Pronto", mas praticamente vazio.** Só existe **1 trecho de 116 caracteres** — apenas o cabeçalho ("REGIMENTO INTERNO / carimbo do cartório / Residencial Reserve Altiplano II"). Páginas 3 em diante nunca foram lidas, e mesmo assim o documento foi marcado como concluído.
3. **O registro de chamadas de IA confirma:** entre 17h e agora houve **uma única** chamada de leitura por imagem (a que gerou esses 116 caracteres). As 22 tentativas da convenção **nem chegaram ao serviço de leitura** — falharam antes, ao preparar a página do PDF.
4. **Consequência na conversa:** a assistente redigiu a notificação da unidade 102-E citando "Art. 121", "Art. 132" e depois "Art. 35" do Regimento. **Nenhum desses artigos existe na base** — não havia texto algum indexado. Ou seja, a fundamentação foi inventada, e só "acertou" o Art. 35 quando a própria usuária colou o texto no chat.

Resumo: não é um problema de redação da IA; é falta de conteúdo. Os dois documentos não foram efetivamente lidos, e ainda assim o sistema (a) declarou um deles pronto e (b) deixou a IA responder citando artigos sem ter o texto.

## Soluções propostas

### 1. Nunca declarar um documento "pronto" sem conteúdo real
Hoje basta existir **um** trecho qualquer para o documento ser fechado como pronto. Passa a exigir cobertura mínima: todos os blocos de páginas lidos, ou volume de texto compatível com o número de páginas. Sem isso, o documento fica como "leitura incompleta", com aviso visível ao usuário e retomada automática.

### 2. Descobrir e corrigir a falha da convenção antes da leitura
As tentativas morrem na preparação da página (extração da imagem do PDF), sem sequer chamar o serviço de leitura. Ações:
- registrar o motivo técnico exato de cada falha na ficha do documento (hoje só grava a frase genérica);
- adicionar um caminho alternativo quando a extração da imagem embutida falha: enviar a página do PDF diretamente para leitura, em vez de abortar o bloco;
- limitar o tamanho da imagem enviada para evitar estouro de memória em páginas escaneadas grandes.

### 3. Proibir a IA de citar artigo que não esteja na base
Regra dura no chat: artigo de Convenção/Regimento só pode ser citado se o texto correspondente estiver entre os trechos recuperados do próprio condomínio. Sem isso, a resposta deve declarar a omissão e usar fundamento subsidiário identificado como tal — nunca inventar número de artigo.

### 4. Avisar antes de redigir
Quando o condomínio não tiver Convenção e Regimento com leitura completa, o chat informa isso **antes** de produzir a notificação, com um atalho para reprocessar os documentos.

### 5. Reprocessar os dois documentos deste condomínio
Após as correções: apagar os trechos atuais e refazer a leitura da Convenção e do Regimento do Reserve Altiplano II, confirmando páginas lidas e artigos presentes.

## Detalhes técnicos

- `src/lib/documentos-processar.server.ts`: remover o atalho "já existem chunks e não é reinício → pronto" (linhas ~306-334) e substituí-lo por checagem de cobertura por bloco; propagar `detalhe_tecnico` da falha em `processamento_meta` em todas as rodadas, não só na última.
- `src/lib/documentos.server.ts`: em `prepararPlanoOcr` / `extrairImagemDoPdf`, capturar o erro por bloco e cair para o envio do sub-PDF (`blocoArquivo`) quando a extração JPEG falhar; registrar o erro real no log do bloco.
- `src/routes/api/chat.ts`: no bloco de regras de fundamentação, exigir citação ancorada em trecho recuperado; adicionar verificação de cobertura documental do condomínio antes de redigir peça sancionatória.
- `src/components/documentos/DocumentosPanel.tsx`: exibir "leitura incompleta" (páginas lidas / total) em vez de "Pronto" quando a cobertura for parcial.
- Verificação final: consultar contagem de trechos e amostra de texto dos dois documentos e confirmar que os artigos citados existem na base.
