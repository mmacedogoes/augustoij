---
title: Assembleia Fase 3 - Edital e Convocação
---

Implementação do sistema de edital e convocação multicanal para o módulo de Assembleias.

## Etapa 1: Infraestrutura e Backend (Server Functions)
- **Edital**: `montarEdital`, `melhorarRedacaoIA`, `publicarEdital`.
- **Convocação**: `montarConvocacao`, `enviarConvocacaoEmail`, `registrarLinkWhatsapp`, `confirmarEnvioWhatsapp`, `registrarEntregaFisica`.
- **Mensagens**: Utilitário para geração de texto WhatsApp/E-mail.

## Etapa 2: Rotas e Interfaces
- **Edital Admin**: `/app/assembleias/$assembleiaId/edital`.
- **Convocação Admin**: `/app/assembleias/$assembleiaId/convocacao`.
- **Edital Público**: `/e/$codigo` (Rota pública).

## Etapa 3: Integrações
- **Resend**: Envio em lote e webhook para rastreamento de status.
- **WhatsApp**: Geração de links `wa.me` com registro de abertura.
- **Auditoria**: Registro administrativo de todas as ações de convocação.

## Detalhes Técnicos
- Uso do template HTML `src/lib/assembleias/email-convocacao-assembleia-template.html`.
- Garantia de idempotência no envio de e-mails.
- Limite de 900 caracteres para mensagens de WhatsApp via URL.
- RLS e bypass via `service_role` para a rota pública do edital.
