# Publicação travada: reduzir o peso do app

## O que foi verificado agora

- A compilação do projeto termina sem erros (build OK).
- Não há problema de segurança bloqueando a publicação, e o app está marcado como publicado e público.
- O site atual responde normalmente (endereço da Lovable e augustoij.com.br).
- O pacote gerado para o servidor está muito grande: 33 MB (cerca de 7 MB compactados), perto do limite máximo aceito na hora de subir o app.

Como a publicação "fica girando e não termina" mesmo com a compilação funcionando, o suspeito principal é o tamanho do pacote: o envio demora demais e nunca conclui.

## O que mais pesa

Bibliotecas de exibição rica do chat e de relatórios estão sendo empacotadas inteiras, inclusive no lado do servidor:

| Item | Peso |
| --- | --- |
| Realce de código (todas as linguagens) | 8,0 MB |
| Leitura de PDF | 2,1 MB |
| Diagramas | 1,5 MB + 1,0 MB |
| Temas de código | 1,5 MB |
| Fórmulas matemáticas | 0,8 MB |
| Planilhas, gráficos, PDF, captura de tela | ~2,5 MB somados |

## Plano de correção

1. **Enxugar o realce de código e os diagramas** — carregar só as linguagens realmente usadas nas respostas da IA e passar a carregar diagramas e fórmulas apenas quando a mensagem tiver esse conteúdo, em vez de sempre.
2. **Carregar sob demanda o que é do navegador** — geração de PDF, planilhas, gráficos e captura de tela passam a ser carregados só quando o usuário aciona a função, e deixam de entrar no pacote do servidor.
3. **Medir de novo** — refazer a compilação e conferir a redução; meta é ficar bem abaixo de metade do limite atual.
4. **Publicar e acompanhar** — se ainda travar após a redução, o problema não é o tamanho, e nesse caso eu reúno o diagnóstico exato da tentativa para acionar o suporte, sem mais mudanças às cegas.

## Detalhes técnicos

- Alvos: `src/components/ai-elements/message.tsx` (streamdown + `@streamdown/code|math|mermaid`), `src/components/ui/chart.tsx` e `src/components/admin/AdminDashboardCharts.tsx` (recharts), `src/lib/documento-export.ts`, `src/lib/assembleias/ata-pdf.ts`, `src/lib/assembleias/auditoria-pdf.ts` (jspdf/docx/html2canvas), `src/routes/_authenticated/app.admin.uso.tsx` (xlsx).
- Técnica: `React.lazy` + `<ClientOnly>` para componentes de navegador e `await import()` dentro dos manipuladores para bibliotecas de exportação; nenhuma importação estática dessas bibliotecas em módulos que o SSR avalia.
- Restringir o conjunto de linguagens/temas do shiki via configuração do streamdown, evitando o pacote completo (`shikijs__langs` 8 MB).
- Nenhuma mudança de banco de dados, rotas ou regras de negócio.
