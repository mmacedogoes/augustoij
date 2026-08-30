# Leitura confiável de convenções, regimentos e atas

## Diagnóstico confirmado

- A convenção do ALTAVISTA está legível e indexada: 162 trechos e 264.674 caracteres. Há referências explícitas a frações ideais em 52 trechos e a áreas privativas em 50.
- As 56 unidades existentes do ALTAVISTA continuam sem `area_m2` e `fracao_ideal`.
- A sugestão anterior trouxe 56 unidades, todas sem área e fração, e foi descartada. Portanto, o problema está na interpretação posterior ao OCR, não na legibilidade do arquivo.
- A extração atual limita o conteúdo geral a 70 mil caracteres e os quadros a 60 mil, processa no máximo oito lotes e não preserva a ordem/proveniência dos trechos. Em documentos longos, dados válidos ficam fora do recorte.
- Falhas de lotes e respostas inválidas da IA são descartadas silenciosamente. A autoextração também captura o erro sem persistir diagnóstico, permitindo exibir apenas “Pronto”.
- Existem ainda 7 documentos parados em “Processando” e 2 com erro de OCR no acervo; eles precisam de recuperação controlada, sem alterar dados produzidos pelos usuários.

## Implementação

### 1. Separar processamento técnico de interpretação

- Manter o estado de leitura/indexação do arquivo separado do estado de extração estruturada.
- Um documento só será considerado totalmente concluído quando todos os blocos previstos tiverem sido lidos e indexados.
- Convenções poderão estar “texto lido, dados de unidades incompletos”, em vez de esconder a falha sob o status “Pronto”.
- Persistir diagnóstico de blocos/páginas pendentes, erros temporários e cobertura da extração no payload de sugestão, sem inventar valores.

### 2. Extrair o documento inteiro, por blocos ordenados

- Ler `document_chunks` com metadados de página/bloco e ordenação determinística.
- Remover os cortes globais de 70 mil/60 mil caracteres e o teto de oito lotes.
- Processar todos os trechos relevantes em lotes menores e retomáveis, com limite de concorrência para evitar rate limit.
- Cobrir texto corrido, tabelas Markdown, quadros de áreas, memoriais e listas agrupadas.
- Expandir expressões como “701A, 901A, 1501A e 2101A” em unidades individuais somente quando o próprio texto vincular explicitamente os mesmos valores ao grupo.

### 3. Consolidar sem inventar

- Normalizar bloco/número e consolidar resultados pelo identificador real da unidade.
- Aceitar área e fração apenas quando acompanhadas de trecho de origem; nunca calcular, interpolar ou copiar por semelhança.
- Detectar conflitos quando dois trechos atribuírem valores diferentes à mesma unidade e bloquear a importação até revisão.
- Comparar a cobertura com as unidades já cadastradas e com totais literalmente declarados na convenção.
- Não exigir área quando o documento realmente só informa fração; exigir cobertura completa de qualquer campo que apareça parcialmente em um quadro.

### 4. Tornar toda falha visível e recuperável

- Falha de lote, JSON inválido, timeout, 429 ou 5xx deixará o trabalho pendente para retomada; não será tratado como documento ilegível.
- Erros terminais indicarão o motivo exato: arquivo errado, protegido, corrompido ou realmente impossível de ler.
- Exibir na aba Documentos: páginas/blocos lidos, pendentes e com falha.
- Exibir na aba Unidades: quantidade encontrada, cobertura de áreas/frações, conflitos e exemplos ausentes.
- Impedir importação quando a extração estiver incompleta ou conflitante.

### 5. Corrigir o ALTAVISTA de forma não destrutiva

- Reutilizar os 162 trechos já indexados; não apagar documentos, unidades, condôminos ou outros dados.
- Executar a nova extração integral da convenção e validar as 56 unidades contra os trechos de origem.
- Aplicar áreas e frações apenas nas unidades correspondentes e somente após validação completa, preservando todos os demais campos.
- Reprocessar o regimento do ALTAVISTA com retomada por blocos e mensagem correta caso a interrupção seja temporária.

### 6. Auditar e recuperar o acervo

- Classificar todos os documentos existentes por tipo, formato, estado, quantidade de trechos e cobertura de blocos.
- Retomar os 7 documentos em “Processando” sem reiniciar o que já foi concluído.
- Reavaliar os 2 erros de OCR distinguindo falha transitória de ilegibilidade real.
- Não executar importações destrutivas em condomínios reais; correções de dados serão limitadas a campos comprovadamente extraídos da fonte.

## Testes e critérios de aceite

- Adicionar testes unitários para PDF com texto, PDF escaneado, PDF longo, DOCX, TXT/CSV/XLSX, arquivo vazio, protegido, corrompido e formato inválido.
- Testar retomada de OCR, ordenação dos blocos, tabelas divididas entre trechos, respostas inválidas e erros 429/5xx.
- Testar convenção com linha individual, linha agrupada, fração em percentual/coefficient decimal, conflito e quadro incompleto.
- No ALTAVISTA, confirmar que cada valor importado possui correspondência textual, que nenhuma unidade foi criada/inventada e que os demais dados permanecem intactos.
- Validar no navegador os estados de progresso, erro, revisão e importação.
- Executar type-check, testes focados e conferir o build automático antes da conclusão.

## Detalhes técnicos

- Os wrappers `createServerFn` serão mantidos finos; parsing, consolidação, diagnóstico e orquestração irão para módulos server-side/puramente testáveis.
- As chamadas de IA seguirão retries somente para 429/5xx, com backoff limitado; 4xx serão exibidos sem repetição automática.
- O fluxo permanecerá sujeito às permissões do ambiente de trabalho e às políticas do banco.
