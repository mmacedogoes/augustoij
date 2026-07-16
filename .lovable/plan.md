
# Atualização do Manual do Augusto.IJ

Objetivo: revisar o manual (`/app/ajuda`) para refletir o sistema como ele está hoje, tornando cada seção mais completa e explicativa. **Não** entram no manual: módulo "Administração de Imóveis", painel Admin, cidades novas (painel admin), treinamento da IA, gestão de usuários — tudo que é exclusivo do super admin/admin.

## O que muda na navegação lateral (`AjudaShell`)

Sidebar reorganizada em 5 grupos (hoje são 4):

1. **Primeiros passos**
   - Visão geral (atualizada)
   - Cadastrar condomínio (inclui novo campo **Cidade** e o aviso de cidade nova)
   - Carregar documentos
   - Primeira conversa com a IA
   - *Novo:* Tour guiado e onboarding

2. **Usando o sistema**
   - *Novo:* Início (antigo Dashboard) — o que aparece e como usar
   - Chat com IA (renomeada para "Interação com a IA")
   - *Novo:* Histórico de conversas
   - Documentos
   - *Novo:* Unidades do condomínio
   - Configurações do condomínio
   - *Novo:* Operadores (para contas PJ / administradoras)

3. **Sua conta**
   - *Novo:* Dados pessoais e segurança (senha, sessão)
   - *Novo:* Plano e limites (o que muda por plano)
   - *Novo:* Privacidade e LGPD (baixar dados, corrigir dados, e-mails de marketing, excluir conta, DPO)

4. **Por perfil** (mantida, textos ampliados)
   - Síndico morador, Síndico profissional, Administradora, Advogado, Conselheiro

5. **IA e FAQ**
   - Dicas de interação com a IA (ampliada: notificações, atas, pareceres, análise contratual, jurisprudência, limites da IA)
   - Perguntas frequentes (ampliada com novas perguntas)

## Alterações por arquivo

### `src/components/ajuda/AjudaShell.tsx`
- Substituir o array `SECOES` pela nova estrutura de 5 grupos acima.
- Adicionar novas rotas de destino (ver abaixo).

### `src/routes/_authenticated/app.ajuda.index.tsx` — Visão geral
Reescrever para descrever, em linguagem clara:
- O que é o Augusto.IJ (assistente jurídico condominial com IA, base de legislação federal/estadual + jurisprudência).
- Os 3 pilares: **Condomínios**, **Documentos**, **Interação com a IA**.
- Roteiro sugerido: cadastrar condomínio → carregar Convenção/Regimento/atas → conversar com a IA na tela **Início**.
- Trocar a menção "Dashboard" por **Início** (a aba foi renomeada).
- Caixa "Dica de ouro" mantida, ampliada.

### `src/routes/_authenticated/app.ajuda.$secao.tsx` — Conteúdo textual
Ampliar cada verbete existente (título, descrição, passo a passo mais detalhado) e adicionar novos verbetes. Chaves finais:

- `cadastro-condominio` — inclui o novo **campo Cidade obrigatório** e explica que, ao cadastrar uma cidade fora de João Pessoa/Cabedelo/Campina Grande (PB), o sistema mostra um aviso informando que a legislação municipal será incorporada em até 3 dias úteis. Enquanto isso, legislação federal/estadual e jurisprudência já estão disponíveis.
- `carregar-documentos` — tipos aceitos, OCR de escaneados, limite de 15 MB, até 10 arquivos por upload, detecção de duplicidade, status "Pronto" antes de usar no chat.
- `primeira-conversa` — trocar "Dashboard" por "Início"; explicar seletor de condomínio, quebras de linha (Shift+Enter), reabrir conversa em Histórico.
- `chat-ia` — o que pedir (notificações, atas, pareceres, análises contratuais, dúvidas operacionais), como fornecer contexto, referências a documentos anexados.
- **Novo** `inicio` — o que aparece na tela Início, atalho para conversar, seleção de condomínio ativo.
- **Novo** `historico` — como reabrir conversas antigas por condomínio, buscar por título/data.
- `documentos` — mesmo verbete atual, ampliado.
- **Novo** `unidades` — cadastro de unidades, uso em notificações endereçadas.
- `configuracoes` — quem pode editar, papéis (dono, operador leitura), auditoria de ações.
- **Novo** `operadores` — apenas contas PJ: criar operador com login próprio, vincular a um ou mais condomínios, remover operador, escopo de leitura.
- **Novo** `onboarding` — o passo a passo do onboarding inicial e como refazer o tour guiado.
- **Novo** `conta-dados` — editar dados pessoais, trocar senha, encerrar sessão.
- **Novo** `conta-plano` — o que cada plano permite (nº de condomínios, tamanho de arquivos, operadores) e como fazer upgrade.
- **Novo** `privacidade` — direitos LGPD implementados na tela **Conta**: baixar meus dados, corrigir meus dados, e-mails de marketing, excluir minha conta, contato do DPO.

Ampliar também o objeto `PERFIS` com bullets mais concretos por perfil (2–3 exemplos de prompts prontos por perfil).

### `src/routes/_authenticated/app.ajuda.faq.tsx`
Adicionar novas perguntas:
- "Cadastrei uma cidade nova — a IA já entende a legislação local?"
- "O que muda entre os planos?"
- "Sou administradora — como dou acesso ao meu time?"
- "A IA guarda meus documentos para treinar modelos?" (não — uso restrito ao condomínio).
- "Como excluo minha conta e meus dados?"
- "Posso usar as respostas da IA como peça jurídica final?" (não, revisar sempre).

Ampliar as respostas existentes (mais contexto, sem inventar recursos).

### `src/routes/_authenticated/app.ajuda.dicas-ia.tsx`
Ampliar com:
- Estrutura recomendada de prompt: contexto → fato → pedido → formato de saída.
- Exemplos prontos de prompts (notificação de barulho, ata de assembleia ordinária, parecer sobre inadimplência, análise de contrato de portaria).
- Como pedir citação de artigos e onde validar (link para consulta oficial).
- Limites: a IA não substitui advogado; sempre revisar antes de enviar/assinar.

### `src/routes/_authenticated/app.ajuda.perfil.$perfil.tsx`
Nenhuma alteração estrutural — vai consumir o `PERFIS` ampliado.

## Fora do escopo (não entram no manual)
- Painel Admin, métricas, financeiro, treinamento da IA, gestão de usuários, cidades novas (visão do super admin), logs.
- Módulo Administração de Imóveis (`/app/admin/imoveis/...`) e todo o submódulo de locação.

## Impacto técnico
- 100% conteúdo (texto/JSX estático) + reorganização de sidebar. Sem mudanças em banco, server functions ou dependências.
- Novas chaves de rota `$secao` (`inicio`, `historico`, `unidades`, `operadores`, `onboarding`, `conta-dados`, `conta-plano`, `privacidade`) são cobertas pela rota dinâmica existente `app.ajuda.$secao.tsx` — não precisa criar rotas novas.

Confirma que posso aplicar essas mudanças?
