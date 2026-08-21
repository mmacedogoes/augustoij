# Plano de Implementação - Módulo de Assembleias (Fase 7)

Implementação da Mesa ao Vivo, Voto pela Mesa e Assembleia Continuada.

## Interface da Mesa (`/app/assembleias/$id/mesa`)
- **Painel de Controle**: Exibição em tempo real do cronômetro (quando ativado), quórum parcial e fila de fala.
- **Gerenciamento de Item**:
    - Ações: Prorrogar (acrescentar tempo), Encerrar Antecipadamente, Anular e Reabrir (com motivo auditado).
    - Exibição de Resultado Parcial (para itens não secretos).
- **Lançamento Manual**: Modal para registrar voto de unidade presente fisicamente (apenas para itens não secretos).
- **Modo Cabine**: Gerador de token/QR Code para unidades votarem em itens secretos usando um dispositivo da mesa (tablet/celular).
- **Fila de Fala**: Lista de inscritos para palavra com controle de tempo (opcional).

## Cabine de Votação Secreta (`/cabine/$token`)
- Rota pública simplificada e "limpa" (sem menu/branding excessivo).
- Consumo de token de uso único.
- Interface de votação focada no item atual.

## Detalhes Técnicos
- **Segurança**: Votos manuais pela mesa são registrados com `p_lancado_por` e `p_justificativa` na função `assembleia_registrar_voto`.
- **Integridade**: Tokens de cabine expiram em 2 minutos e são invalidados após o uso.
- **Audit**: Todas as ações da mesa (anulação, prorrogação, voto manual) geram registros em `admin_audit_log`.

## Arquivos a serem criados/modificados
- `src/routes/_authenticated/app.assembleias.$assembleiaId.mesa.tsx`: Tela principal da mesa.
- `src/routes/cabine.$token.tsx`: Rota da cabine de votação.
- `src/lib/assembleias/mesa.functions.ts`: Lógica de backend (já iniciada).
- `src/routes/_authenticated/app.assembleias.$assembleiaId.index.tsx`: Link de transição para o modo mesa.
