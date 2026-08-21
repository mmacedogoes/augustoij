# Plano de Implementação - Módulo de Assembleias (Fase 7)

Implementação da interface de Mesa Ao Vivo, Voto Manual e Cabine Secreta para o Módulo de Assembleias.

## Mudanças propostas

### Servidor & Lógica (Concluído/Refinado)
- **mesa.functions.ts**: Funções para controle de cronômetro, anulação de itens, registro de voto manual pela mesa e abertura de cabine secreta.
- **resultado-texto.ts**: Gerador de frases jurídicas para resultados de votação.
- **audit.server.ts**: Inclusão de ações de mesa na trilha de auditoria.

### Interface Administrativa (Mesa)
- **src/routes/_authenticated/app.assembleias.$assembleiaId.mesa.tsx**: 
    - Painel central de controle da assembleia "Ao Vivo".
    - Cronômetro real-time e quórum parcial dinâmico.
    - Fila de fala e integração com Assistente de IA.
    - Modais de anulação (com justificativa) e geração de token de cabine.
- **src/routes/_authenticated/app.assembleias.$assembleiaId.mesa.voto-manual.tsx**: 
    - Interface para busca de unidades presentes e lançamento de voto nominal manifestado em plenário.
    - Filtro de unidades habilitadas que ainda não votaram.

### Interface Pública (Cabine)
- **src/routes/cabine.$token.tsx**: 
    - Rota pública simplificada para tablets/totens da mesa.
    - Voto secreto via token temporário (2 min).
    - Design focado em privacidade e segurança.

## Detalhes Técnicos
- Uso de `supabaseAdmin` para operações críticas (anulação/votos manuais).
- Validação de tokens de cabine via `assembleia_cabine_tokens`.
- Polling de 3-5s para atualização de quórum na mesa sem sobrecarga.

## Verificação
- Testar fluxo de abertura de item -> votação cabine -> encerramento -> apuração.
- Validar bloqueio de múltiplos itens abertos simultaneamente.
- Verificar trilha de auditoria para anulações.
