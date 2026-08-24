# Correção: itens da pauta somem ao pedir revisão da IA

## O que está acontecendo

No assistente de criação de assembleia (passo 2), os itens da pauta ficam apenas na memória da tela: as funções de gravação de item (`upsertItemPauta`) e de reordenação (`reordenarItens`) estão declaradas na página, mas nunca são chamadas. Nada é gravado no banco.

Quando você clica em "Revisar pauta", a tela:
1. chama a revisão da IA no servidor — que lê os itens do banco e não encontra nenhum;
2. em seguida recarrega a assembleia do banco e substitui a lista da tela pelo resultado vazio.

Resultado: os itens digitados desaparecem da tela. Eles não foram apagados — nunca chegaram a ser salvos.

## Correção

1. **Persistir cada item ao salvar no diálogo**: ao confirmar um item no passo 2, gravar no banco via `upsertItemPauta` e guardar o `id` retornado no estado local. Mover/remover itens também passa a refletir no banco (reordenação e exclusão).
2. **Garantir persistência antes da revisão**: antes de chamar a IA, sincronizar quaisquer itens ainda sem `id` (fallback, caso o usuário tenha criado itens offline ou a gravação tenha falhado).
3. **Não destruir o estado local em caso de retorno vazio**: após a revisão, mesclar os alertas vindos do banco com a lista atual em vez de substituí-la cegamente; se o banco devolver lista vazia, manter o que está na tela e mostrar aviso.
4. **Mensagem clara quando a pauta está vazia**: a revisão já retorna "Pauta vazia" — exibir isso no painel do Augusto em vez de sucesso silencioso.

## Detalhes técnicos

- `src/routes/_authenticated/app.assembleias.nova.tsx`: passar callbacks de persistência ao `PassoPauta`; em `handleIaRevisao`, sincronizar itens sem `id`, depois mesclar `alerta_ia`/`fundamento_legal` por `id` (ou por `ordem`) na lista existente.
- `src/components/assembleias/PassoPauta.tsx`: expor `onSaveItem`/`onDeleteItem`/`onReorder` opcionais, chamados em `handleSaveItem`, `handleRemove` e `handleMove`, mantendo a UI otimista.
- `src/lib/assembleias/pauta.functions.ts`: `upsert` sem `id` para item novo já funciona (insert); acrescentar `onConflict: "id"` explícito para evitar duplicidade em reenvio, e usar `deleteItemPauta` na exclusão.
- Sem mudanças de schema.

## Verificação

- Criar assembleia, adicionar 2 itens, clicar em "Revisar pauta": itens permanecem e recebem os alertas da IA.
- Recarregar a página do assistente: itens continuam lá (vieram do banco).
- Reordenar e excluir itens reflete após recarregar.
