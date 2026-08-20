# Plano de Implementação - Módulo de Assembleias (Fase 2)

Implementação da interface de gestão de assembleias, incluindo lista, criação assistida (Wizard) e revisão de pauta por Inteligência Artificial, restrito a Super Admins.

## 1. Segurança e Acesso
- Criar `src/lib/assembleias/guard.server.ts` para validar acesso `super_admin`.
- Implementar redirecionamento no cliente nas rotas de assembleias para não-admins.

## 2. Fundação e Utilitários
- Implementar `src/lib/assembleias/romanos.ts` para conversão de números (1-60) para algarismos romanos em serif dourado.
- Criar `src/lib/assembleias/assembleias.functions.ts` com CRUD básico e indicadores.
- Criar `src/lib/assembleias/pauta.functions.ts` para gestão de itens e opções.
- Criar `src/lib/assembleias/revisao-ia.functions.ts` integrando com Lovable AI para análise legal da pauta (CC 1.335 - 1.353).

## 3. Interface de Usuário (Dashboard)
- **Lista de Assembleias (`/app/assembleias`)**:
  - Indicadores de status (Ao vivo, Convocadas, Pendências).
  - Timeline de assembleias com badges de situação coloridos.
  - Tabela responsiva com ações contextuais.
- **Wizard de Criação (`/app/assembleias/nova`)**:
  - Passo 1: Dados básicos (Título, tipo, data, modalidade).
  - Passo 2: Pauta interativa com Drag & Drop e revisão de IA integrada.
  - Passo 3: Regras de votação (Quórum, inadimplência, frações ideais).
- **Detalhe do Contrato (`/app/assembleias/$id`)**: Resumo e pauta em modo leitura.

## 4. Navegação
- Adicionar "Assembleias" ao menu lateral e mobile, posicionado antes de "Documentos".
- Atribuir `data-tour="nav-assembleias"`.

## Detalhes Técnicos
- **IA**: Prompts especializados em Direito Condominial brasileiro; output JSON estrito.
- **Estilo**: Uso de tokens HSL, Cormorant Garamond para assinatura visual, Inter para legibilidade.
- **Banco**: Integração com triggers de imutabilidade e hash chain já existentes.

## Checklist de Verificação
- [ ] Acesso negado para usuários comuns.
- [ ] Numerais romanos recalculados na reordenação da pauta.
- [ ] Erro de validação ao salvar pauta incompleta.
- [ ] Revisão de IA exibe fundamentos legais (CC).
- [ ] Resiliência: falha na rede/IA não bloqueia o fluxo principal.
