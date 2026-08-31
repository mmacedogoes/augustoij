# Pipeline determinístico de unidades e auditoria documental

## Objetivo
Substituir a extração escalar e bloqueante por um pipeline determinístico que preserve todas as grandezas da convenção, escolha área/fração canônicas por regras auditáveis, importe somente dados de alta confiança em campos vazios e encaminhe ambiguidades para revisão sem derrubar a interface. Nenhum dado manual existente será sobrescrito ou removido.

## Implementação

### 1. Medidas rotuladas e normalização brasileira
- Criar um normalizador puro para números brasileiros, percentuais, decimais, milésimos, permilagem e frações ordinárias, sempre produzindo fração canônica em `[0,1]` com oito casas.
- Trocar o contrato da IA de `area_m2`/`fracao_ideal` por `medidas[]`, contendo campo semântico, valor bruto literal, escala declarada, citação, página e bloco.
- Validar proveniência numericamente a partir dos numerais do trecho, sem depender da string formatada retornada pela IA.
- Reconhecer identificadores compostos e textuais com fronteiras: `601A`, `601-A`, `A-601`, “601 do bloco A”, “Bloco A, apartamento 601” e “apto 601 — bloco A”.

### 2. Ordenação e contexto de tabelas
- Gravar em cada `document_chunk` o índice sequencial do trecho e uma ordem global estável; manter fallback determinístico para documentos legados.
- Paginar chunks com ordenação explícita e estável, evitando repetição ou omissão acima de 1.000 registros.
- Ajustar o fatiamento para nunca cortar linhas de tabelas Markdown e repetir o cabeçalho aplicável em cada chunk.
- Montar lotes com cabeçalho/legenda do quadro e uma linha de sobreposição entre lotes, preservando página, bloco, trecho e ordem global.

### 3. Consolidação determinística e autoverificação
- Consolidar candidatos por unidade e por campo rotulado; campos diferentes coexistem e nunca geram conflito entre si.
- Comparar somente valores do mesmo campo em escala canônica, aplicando tolerâncias de área e fração.
- Resolver divergências por: coerência aritmética, precedência de quadro/anexo sobre prosa, maioria simples e, somente no fim, conflito.
- Selecionar `area_m2` pela área privativa, com fallback documentado `área global − área comum`; selecionar `fracao_ideal` pela fração do terreno, com fallback para coeficiente de rateio.
- Detectar a escala global das frações pelo somatório completo nas hipóteses percentual, decimal e milésimo; se nenhuma fechar, manter os resultados para revisão e registrar todas as somas e maiores desvios.
- Executar e registrar as validações: soma das frações, identidade entre áreas, total de área privativa quando declarado, proporcionalidade quando declarada e quantidade de unidades.

### 4. Persistência auditável e importação parcial segura
- Ampliar o status de sugestões para `pendente_revisao` e persistir sempre unidades, candidatos, confiança, fontes e diagnósticos, inclusive quando existirem lotes incompletos ou conflitos.
- Persistir por condomínio um `perfil_documental` com escala detectada, coluna canônica, tolerâncias e resultados das validações; proteger o acesso pelo mesmo escopo do condomínio.
- Importar automaticamente somente unidades/campos de confiança alta, apenas quando o campo atual estiver vazio; nunca substituir valores manuais, apagar unidades ou alterar outros dados.
- Tornar todos os caminhos de extração retornos controlados; nenhuma falha parcial ou erro serializado atravessará a server function como tela em branco.

### 5. Revisão assistida
- Atualizar a aba Unidades para abrir a revisão sempre que houver itens médios ou conflitantes.
- Exibir por campo os candidatos lado a lado, com rótulo, valor normalizado, valor bruto, página/bloco e citação; permitir selecionar um candidato em um clique.
- Diferenciar visualmente confiança alta, média e conflito, informar o que já foi preenchido automaticamente e manter a confirmação em modo não destrutivo por padrão.

### 6. Testes determinísticos e caso Altavista
- Atualizar fixtures para refletir exatamente os metadados gravados pelo pipeline real.
- Cobrir quadro NBR 12721 repartido em chunks, sticky header, escalas equivalentes, grandezas diferentes da mesma unidade, todos os formatos de identificador e paginação ordenada acima de 1.000 chunks.
- Testar tolerâncias, regras aritméticas, importação parcial sem sobrescrever dados e duas execuções byte-a-byte equivalentes.
- Adicionar fixture anonimizada do Altavista com 56 unidades A/B, incluindo 601A = 315,50 m² e 1,9956%, exigindo 56 chaves únicas, cobertura integral e soma canônica 1,00000000.

### 7. Auditoria e recuperação do acervo
- Classificar cada documento existente como: pronto consistente, pronto sem chunks, processamento estagnado, erro de OCR, extração pendente/falha ou cobertura incompleta.
- Reprocessar somente os recuperáveis com o novo motor; manter arquivos ilegíveis ou incompatíveis como pendência explícita.
- Produzir relatório administrativo com um item por documento: classificação anterior, ação executada, quantidade de chunks/unidades, escala/somas, campos preenchidos, conflitos e pendências.
- Validar o Altavista duas vezes de ponta a ponta antes de encerrar, comparando resultados determinísticos e confirmando que somente campos vazios foram preenchidos.

## Alterações técnicas
- Arquivos centrais: `unidades-extracao.server.ts`, novo `fracao-normalizar.ts`, `documentos.server.ts`, `documentos-processar.server.ts`, funções de unidades/auditoria, `UnidadesPanel.tsx`, `RevisarUnidadesDialog.tsx` e testes.
- Migração: novo perfil documental por condomínio, novo status de sugestão e ajustes necessários na função transacional de aplicação; incluir permissões e RLS compatíveis com proprietário, membros autorizados e suporte administrativo.
- Compatibilidade: documentos antigos sem `ordem_global` continuarão legíveis por fallback de bloco/página/trecho; a auditoria os reindexará quando recuperáveis.

## Critérios de aceite
- Duas execuções do mesmo documento retornam exatamente a mesma saída.
- Altavista retorna 56 unidades únicas, todas com área privativa e fração ideal citadas, e soma das frações igual a 1,0000 dentro da tolerância.
- Grandezas rotuladas diferentes nunca são tratadas como conflito.
- Uma unidade ambígua não impede a persistência/importação das demais corretas.
- Nenhum valor manual existente é alterado e nenhuma exceção de extração produz tela em branco.
- O relatório final contém um resultado para cada documento do acervo.
