# Plano de Implementação - Módulo de Assembleias (Fase 4)

Este plano detalha a implementação da habilitação, inadimplência e congelamento de votantes no módulo de Assembleias, permitindo que o Super Admin defina quem está apto a votar com base em planilhas de inadimplência/adimplência processadas por IA.

## 1. Fundação e Segurança
- **Guardas**: Utilização do `ensureAcessoAssembleias` para todas as novas funções de servidor.
- **Auditoria**: Extensão do `AuditAction` no `src/lib/audit.server.ts` para incluir as ações:
    - `assembleia.inadimplencia.importar`
    - `assembleia.inadimplencia.ajustar`
    - `assembleia.habilitacao.confirmar`
    - `assembleia.habilitacao.refazer`
    - `assembleia.habilitacao.ajuste_mesa`
    - `assembleia.planilha.excluir`
- **RLS**: Manutenção das políticas restritivas ao Super Admin já existentes.

## 2. Lógica de Servidor (Server Functions)
Criar `src/lib/assembleias/habilitacao.functions.ts` contendo:
- **`gerarUrlUploadPlanilha`**: Gera URL assinada para o bucket `assembleia-planilhas`.
- **`processarImportacaoIA`**: 
    - Extração de texto via `src/lib/documentos.server.ts`.
    - Chamada da IA via `callGeminiJson` (helper existente) com prompt específico de casamento de unidades.
    - Registro de consumo em `uso-ia` com origem `assembleia_inadimplencia`.
    - Persistência em `assembleia_inadimplencia_itens`.
- **`ajustarItemInadimplencia`**: Registro manual de correções (vincular, ignorar, alterar status).
- **`confirmarHabilitacao`**: 
    - Snapshot de todas as unidades para `assembleia_habilitacoes`.
    - Bloqueio duro se houver item por fração ideal e unidade apta com fração nula.
    - Atualização de `assembleias.habilitacao_confirmada_em`.
- **`refazerHabilitacao`**: Limpeza do snapshot (se não instalada).
- **`ajustarHabilitacaoMesa`**: Ajustes de última hora com justificativa obrigatória.
- **`excluirPlanilha`**: Limpeza do bucket após confirmação.
- **`habilitarManualmente`**: Fluxo sem IA para marcação direta de inaptos.

## 3. Interface (UI)
- **Rota**: `src/routes/_authenticated/app.assembleias.$assembleiaId.habilitacao.tsx`.
- **Componentes**:
    - `StepperHabilitacao`: 4 passos (Enviar, IA, Revisar, Confirmar).
    - `TabelaImportacao`: Exibição colorida por confiança (Verde, Dourado, Bordô).
    - `FiltrosHabilitacao`: Filtros por status e pendência.
    - `CardSumarioHabilitacao`: Estatísticas de aptos/inaptos e progresso de casamento.
    - `ModalAjusteMesa`: Interface para correções durante a assembleia.
- **Mobile**: Transformação da tabela em cartões empilhados.

## Detalhes Técnicos
- Reaproveitamento de `extractText` (Mammoth, unpdf, XLSX).
- Reaproveitamento de `registrarEventoIa`.
- Limite de 40k caracteres para IA, processamento em blocos se necessário.
- Imutabilidade via snapshot: `peso_fracao` copiado no momento da confirmação.
- Tratamento de `match_status`: `ok`, `ambiguo`, `sem_match`.

Confirmado reaproveitamento de: `extractText` (documentos), `callGeminiJson` (IA), `registrarEventoIa` (consumo).
