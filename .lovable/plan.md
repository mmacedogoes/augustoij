## Objetivo
Ativar os CTAs de plano da landing para levar o usuário direto ao pagamento, e criar uma página de contato para o plano "Personalizado" que envia e-mail para `mmacedogoes@gmail.com`.

## Escopo

### 1. CTAs dos planos pagos (Essencial → Administradora)
`src/components/landing/PricingSection.tsx` já navega para `/signup?plano=X&ciclo=Y`. Passa a ser destino final o checkout:

- **Usuário não autenticado**: continua indo para `/signup?plano=X&ciclo=Y`. Após criar a conta com sucesso, o `SignupPage` passa a redirecionar para `/app/assinatura?plano=X&ciclo=Y` (hoje vai para onboarding/app). Preserva `plano`/`ciclo` via `useSearch` na rota `/signup`.
- **Usuário já autenticado**: o clique deve pular o signup e ir direto para `/app/assinatura?plano=X&ciclo=Y`. `PricingSection.handleCta` checa a sessão (`supabase.auth.getSession`) — se logado, `navigate({ to: "/app/assinatura", search: { plano, ciclo } })`; senão, mantém rota `/signup`.
- Plano **Gratuito**: mantém fluxo atual (`/signup` com plano=gratuito, sem checkout).

### 2. Plano "Personalizado" → página de contato
- Nova rota pública `src/routes/contato.tsx` com formulário (nome, telefone, e-mail, mensagem) validado com Zod. Após submit exibe mensagem de sucesso "Recebemos sua mensagem. Nossa equipe entrará em contato em breve." e limpa o formulário.
- No `PricingSection`, o CTA do plano "Personalizado" e o botão "Agendar conversa" da seção detalhada passam a usar `navigate({ to: "/contato" })` em vez de `mailto:`.
- `head()` com título/description próprios e `og:*` conforme padrão do projeto.

### 3. Envio do e-mail de contato
- Nova server function `enviarContatoPersonalizado` em `src/lib/contato.functions.ts` (público, sem `requireSupabaseAuth`), com validação Zod (nome 2–120, e-mail, telefone 8–40, mensagem 10–2000, todos com `.trim()`).
- Envia via Resend (secret `RESEND_API_KEY` já configurado) usando o mesmo padrão dos demais e-mails do projeto:
  - Remetente: `Augusto.IJ <naoresponda@mail.augustoij.com.br>`
  - Destinatário: `mmacedogoes@gmail.com`
  - `reply_to`: e-mail preenchido no formulário
  - Assunto: `Novo contato — Plano Personalizado — {nome}`
  - Corpo HTML simples e branded (nome, telefone clicável, e-mail, mensagem, data/hora).
- Anti-abuso mínimo: honeypot oculto no formulário; se preenchido, retorna sucesso silencioso sem enviar. Falha no envio Resend retorna erro genérico ao usuário e loga no servidor.

## Detalhes técnicos
- Manter `PricingSection` client-only para o check de sessão (import já usa `useNavigate`; adicionar `useEffect` só se necessário — o check pode ser feito on-click de forma assíncrona).
- `SignupPage` já lê `useSearch`; adicionar leitura de `plano`/`ciclo` e, no `onSuccess` do cadastro, redirecionar para `/app/assinatura` com esses params (fallback para onboarding quando `plano === "gratuito"` ou ausente).
- Não alterar o webhook Asaas nem `criarAssinaturaAsaas`; o fluxo pós-checkout permanece igual.
- Nenhuma migração de banco necessária.

## Arquivos afetados
- `src/components/landing/PricingSection.tsx` (roteamento condicional + CTA personalizado)
- `src/routes/signup.tsx` (redirect pós-signup para `/app/assinatura`)
- `src/routes/contato.tsx` (novo)
- `src/lib/contato.functions.ts` (novo — server function Resend)
