# Publicação que nunca termina: descobrir se é o site ou só o indicador

## O que já está comprovado

- A compilação do projeto termina sem erro (verificado agora, do zero).
- Não há falha registrada no diagnóstico da última publicação.
- Não há problema de segurança bloqueando publicação; o app está publicado e público.
- O tamanho gerado está dentro dos limites (cerca de 1.500 arquivos, 50 MB).
- **O site no ar já contém alterações recentes**: o endereço interno novo, criado ontem para retomar a leitura de documentos, responde em produção (`/api/public/hooks/documentos-retomar` devolve "não autorizado", enquanto um endereço inexistente devolve "não encontrado").

Ou seja: as publicações estão de fato chegando ao ar. O que não termina é o indicador de progresso na janela de publicação.

## Plano

1. **Marcador visível de versão** — colocar um texto discreto de versão (data e hora da geração) no rodapé do site. Isso permite, a qualquer momento, olhar o site e saber exatamente qual versão está publicada, sem depender do indicador.
2. **Teste controlado** — publicar uma vez com esse marcador e conferir, pelo próprio site, se a versão nova aparece dentro de poucos minutos, mesmo que a janela continue girando.
3. **Duas conclusões possíveis**
   - Se a versão nova aparecer: o site está publicando normalmente e o problema é apenas o aviso de conclusão travado na interface da Lovable. Nesse caso eu reúno as evidências (horários, versões, respostas do servidor) e o caminho é abrir chamado no suporte da plataforma — não há correção possível no código do projeto.
   - Se a versão nova não aparecer: o envio realmente está parando no meio, e aí seguimos para o passo 4.
4. **Se for o envio (só nesse caso)** — reduzir o peso do que é enviado, tirando do pacote do servidor as bibliotecas que só o navegador usa (realce de código, diagramas, gráficos, geração de PDF e planilhas), e publicar de novo medindo antes e depois.

## Enquanto isso

Você pode fechar a janela de publicação depois de um ou dois minutos: pelo que foi observado, o envio segue e conclui mesmo com o indicador girando.

## Detalhes técnicos

- Marcador de versão: constante injetada em tempo de compilação (`define` no Vite com a data/hora do build), exibida no rodapé e também disponível em `/api/public/auth-check` ou em um endereço simples de versão, para conferência automática.
- Evidência já coletada: `POST /api/public/hooks/documentos-retomar` → 401 em produção; rota inexistente → 404; build local completo com Nitro sem erro; `lovable build diagnostics latest` sem falhas.
- Passo 4 (condicional): `React.lazy` + `<ClientOnly>` e `await import()` em `src/components/ui/chart.tsx`, `AdminDashboardCharts.tsx`, `app.admin.uso.tsx` (xlsx) e nos módulos de exportação PDF/DOCX.
