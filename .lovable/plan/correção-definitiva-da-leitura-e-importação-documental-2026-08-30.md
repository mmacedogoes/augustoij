# Correção definitiva da leitura e importação documental

## Objetivo
Garantir que convenções, regimentos e atas sejam lidos integralmente, com falhas explícitas e retomáveis, sem inventar áreas ou frações ideais e sem alterar dados já preenchidos pelos usuários. O Altavista será o caso de validação principal, mas a solução será aplicada a todo o acervo.

## Diagnóstico confirmado
- A convenção do Altavista está legível e indexada em 162 trechos, mas suas 56 unidades continuam sem área e fração ideal.
- A sugestão antiga do Altavista foi descartada com 56 unidades, porém sem diagnóstico persistido.
- Há 7 documentos presos em `processando`, 2 documentos com erro de OCR e 2 documentos `pronto` sem trechos indexados.
- A extração ainda limita a consulta a 1.000 trechos e descarta silenciosamente trechos que não casam com uma expressão de “relevância”.
- O reconhecimento de identificadores compostos como `601A` depende parcialmente da IA e não possui teste com as 56 unidades reais do Altavista.
- Falhas da extração automática são registradas apenas no log; a tela pode informar documento pronto sem informar que áreas/frações falharam.
- A importação em lotes não é atômica: parte das unidades pode ser alterada antes de outra linha falhar.

## Implementação

### 1. Estado verificável do processamento
- Adicionar metadados persistentes por documento: páginas/blocos concluídos, falhas, tentativas, quantidade de trechos, etapa atual, diagnóstico e data da última evolução.
- Separar claramente os estados de leitura, indexação e interpretação; `pronto` só será usado quando houver conteúdo indexado e cobertura verificada.
- Detectar documentos estagnados, `pronto` sem chunks e blocos parcialmente gravados; tornar o processamento idempotente por bloco.
- Preservar e exibir a mensagem real da falha, distinguindo arquivo ilegível, documento incompatível, falha temporária da IA, OCR parcial e interpretação incompleta.

### 2. Leitura integral e retomável
- Remover limites silenciosos e paginação fixa; buscar todos os chunks em páginas ordenadas até o fim.
- Não descartar conteúdo por regex. Usar todos os trechos ou uma etapa de classificação auditável que contabilize exatamente o que foi incluído e excluído.
- Validar cada bloco antes de considerá-lo concluído; bloco com zero chunks, embeddings incompletos ou resposta vazia continua pendente/erro.
- Tornar a gravação de cada bloco idempotente para que uma retomada substitua o bloco parcial em vez de duplicá-lo.
- Manter retry somente para 429/5xx/timeout, com backoff limitado; erros terminais serão mostrados e persistidos.

### 3. Extração literal de unidades, áreas e frações
- Criar parser determinístico para identificadores compostos (`601A` → bloco A/unidade 601), listas agrupadas e tabelas quebradas entre páginas/chunks.
- Executar a IA em lotes menores com sobreposição contextual e uma segunda passagem de consolidação, sem truncar respostas nem ignorar lotes falhos.
- Exigir proveniência por campo: página/bloco, trecho literal e valor exatamente encontrado no documento.
- Normalizar formatos brasileiros de área e fração (vírgula decimal, `%`, coeficiente decimal), sem calcular ou completar valores ausentes.
- Rejeitar conflitos, duplicidades ambíguas, valores sem fonte e cobertura incompleta. Persistir o diagnóstico detalhado em vez de retornar sucesso vazio.

### 4. Importação não destrutiva e atômica
- Mover a aplicação das sugestões para uma operação transacional no banco.
- O modo padrão preencherá apenas `area_m2`, `fracao_ideal` e vagas atualmente vazios; identificadores, condôminos e demais dados existentes serão preservados.
- Não marcar sugestão como aplicada se qualquer linha falhar; nenhuma alteração parcial permanecerá.
- Exigir correspondência inequívoca entre sugestão e unidade existente antes de atualizar.

### 5. Interface e recuperação do acervo
- Exibir na aba Documentos as etapas separadas: lido, indexado, interpretação de unidades, incompleto ou falhou.
- Mostrar progresso, páginas/blocos pendentes, diagnóstico e ação adequada para continuar/reiniciar.
- Na aba Unidades, mostrar a cobertura encontrada antes da revisão: total, com área, com fração, conflitos e fontes.
- Criar rotina administrativa para auditar e retomar documentos antigos presos/inconsistentes, sem depender de a aba permanecer aberta.

### 6. Testes e correção do acervo existente
- Adicionar testes unitários para OCR/chunking, paginação acima de 1.000 chunks, retomada idempotente, falhas de lote, proveniência, decimais brasileiros, listas agrupadas e identificadores compostos.
- Criar fixture anonimizada baseada no padrão real do Altavista e exigir 56 correspondências únicas, cada uma com área e fração comprovadas.
- Testar a transação de importação com falha intermediária e confirmar rollback integral.
- Auditar todos os documentos existentes: classificar `pronto` sem chunks, `processando` estagnado, erro de OCR, extração pendente/falha e cobertura incompleta.
- Reprocessar os documentos recuperáveis; arquivos realmente ilegíveis ou de tipo incorreto permanecerão sem importação e com erro explícito.
- Validar o Altavista ponta a ponta: 56 unidades, mapeamento A/B, preenchimento apenas dos campos vazios, soma e amostragem cruzada contra os trechos da convenção.

## Critérios de aceite
- Nenhuma leitura ou extração termina silenciosamente.
- Nenhum documento indexável fica `pronto` com zero chunks.
- Nenhum chunk/página é omitido sem constar no diagnóstico.
- Nenhum valor de área ou fração é aceito sem citação literal e localização da fonte.
- Uma falha durante importação deixa todas as unidades inalteradas.
- O Altavista apresenta 56 unidades correspondidas e todos os valores documentados disponíveis para revisão/importação.
- O relatório final lista cada documento auditado, seu resultado, correções aplicadas e pendências que dependam de um arquivo fonte melhor.
