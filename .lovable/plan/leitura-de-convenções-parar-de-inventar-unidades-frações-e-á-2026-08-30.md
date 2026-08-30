# Leitura de convenções: parar de inventar unidades, frações e áreas

## O problema (confirmado no código)

A extração hoje é **instruída a inventar**. Em `src/lib/unidades-ia.functions.ts` o prompt do sistema diz literalmente que, se a convenção declarar apenas totais ("662 lotes em 36 quadras", "40 apartamentos por bloco") e não trouxer a lista individual, a IA deve **gerar as unidades numericamente** para bater o total. Unidades geradas assim não têm fração ideal nem área — o modelo devolve `fracao_ideal: null` e `area_m2: null`.

Somado a isso:

- O schema aceita `fracao_ideal` e `area_m2` nulos sem qualquer verificação, então a sugestão é salva como se estivesse completa e chega na aba Unidades com os campos em branco.
- Quando a IA devolve mais unidades que o previsto no cadastro, uma rotina recorta as excedentes por padrão de andar/quadra — outro ajuste sintético, sem base no texto.
- O texto enviado à IA é cortado em 70 mil caracteres, com priorização apenas por palavras-chave. Em convenções longas o quadro de frações ideais (normalmente um anexo no fim) pode ficar de fora, o que produz exatamente o sintoma relatado: unidades sem tamanho e sem fração.
- Nenhum caminho de erro existe para "li o documento mas não achei as frações": a função devolve a lista incompleta silenciosamente.

## O que vai mudar

### 1. Proibir a geração de unidades
Reescrever o prompt: a IA extrai **somente** o que estiver literalmente no texto. Remover integralmente a regra de "gerar numericamente conforme a descrição". Se houver apenas totais declarados, a IA reporta isso em vez de preencher.

### 2. Cada unidade traz a origem do dado
O JSON pedido passa a incluir, por unidade, se a fração e a área foram lidas do documento, além de um campo de diagnóstico global (total declarado no texto, total efetivamente listado, e se o quadro de frações foi localizado). Frações/áreas ausentes voltam como `null` explícito e nunca estimadas.

### 3. Validação server-side com erro claro
Depois da resposta da IA, a função verifica a cobertura:

- nenhuma unidade encontrada → erro "A convenção não traz a lista individual de unidades".
- unidades encontradas, mas fração ideal ausente em parte delas → erro informando quantas e quais (ex.: "38 de 60 unidades sem fração ideal identificada — a convenção enviada não contém o quadro de frações ou ele está ilegível").
- total listado diferente do total declarado no texto → erro apontando a divergência.

Nesses casos **nada é salvo** como sugestão pendente; a mensagem sobe para a interface com orientação prática (enviar o anexo/quadro de frações, ou um PDF com melhor qualidade de OCR).

### 4. Remover os ajustes automáticos de contagem
A rotina que recorta unidades excedentes por padrão de andar sai do fluxo. Divergência vira erro/aviso, não correção silenciosa.

### 5. Não perder o quadro de frações no corte de texto
Aumentar a prioridade dos trechos que contêm tabelas de fração/área (padrões numéricos com vírgula/percentual junto de "fração", "coeficiente", "área privativa") e, quando o documento exceder o limite, fazer a extração em duas passadas — uma para a lista de unidades, outra dedicada ao quadro de frações/áreas — consolidando por (bloco, número).

### 6. Interface
Na revisão/aba Unidades: banner de erro quando a extração falhar na validação, e, quando o usuário optar por prosseguir manualmente, marcação visual das células de fração/área não identificadas (em vez de aparecerem como vazias comuns).

## Detalhes técnicos

- `src/lib/unidades-ia.functions.ts`: reescrita do `system` prompt; `UnidadeSugestao` ganha `fracao_ideal_origem`/`area_origem`; nova função `validarCoberturaExtracao()` executada antes do insert em `sugestoes_unidades`; remoção de `corrigirExcessoPredioPorPadrao` e `detectarPadraoPavimentosTipo`; segunda passada opcional `extrairQuadroFracoes()` reaproveitando `callGeminiJson`.
- Priorização de chunks: regex adicional para linhas tabulares de fração/área, ordenando esses trechos antes dos demais.
- `src/components/unidades/RevisarUnidadesDialog.tsx` e `UnidadesPanel.tsx`: exibição do diagnóstico e destaque dos campos não identificados.
- Sem mudanças de banco.
