# Correções na tela de pauta da assembleia

## 1. Botão "Importar pauta do edital em PDF"

Hoje o botão está desativado (é só um placeholder). Vamos torná-lo funcional:

- Ao clicar, abre o seletor de arquivo (PDF, até ~10 MB).
- O PDF é enviado para leitura por IA, que devolve a lista de itens da pauta (título, descrição e, quando identificável, quórum e base de cálculo sugeridos).
- Os itens extraídos são acrescentados ao final da pauta atual (não apagam o que já existe), já numerados em sequência.
- Cada item importado é gravado no banco na hora, igual ao fluxo manual.
- Estados visíveis: "Lendo o edital...", erro amigável se o PDF não puder ser lido, e aviso quando nenhum item for identificado.

## 2. Texto do botão de adicionar

"Adicionar item como secundário" passa a ser "Adicionar item à pauta". Nenhuma mudança de comportamento.

## 3. Painel de revisão da IA

O cabeçalho hoje mostra sempre "Revisar de novo". Passa a mostrar:

- "Revisar" enquanto nenhuma revisão foi feita (sem alertas).
- "Revisar de novo" apenas depois de uma revisão já concluída.

O texto de estado vazio continua coerente com o botão.

## Detalhes técnicos

- Nova server function `importarPautaPdf` em `src/lib/assembleias/pauta-import.functions.ts`, seguindo o padrão de `src/lib/contratos-servico/importar.functions.ts` (upload em base64 → Lovable AI Gateway com Gemini → JSON validado por Zod), protegida por `requireSupabaseAuth` e pelo guard de condomínio.
- `src/components/assembleias/PassoPauta.tsx`: input de arquivo oculto, handler de importação, merge dos itens no estado e chamada de `onPersistItem` por item; ajuste do rótulo do botão.
- `src/components/assembleias/RevisaoIAPainel.tsx`: rótulo condicional do botão com base em `alertas.length` / revisão já executada.
