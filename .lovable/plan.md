## Objetivo

Três correções no conteúdo dos documentos gerados:

1. O arquivo (PDF/DOCX) nunca pode conter trechos de conversa ("Deseja que eu gere o arquivo deste documento?", "Segue abaixo...") nem o aviso de conteúdo gerado por inteligência artificial.
2. Notificações de infração e comunicados não citam jurisprudência diretamente — a jurisprudência continua sendo a base do raciocínio, mas aparece só se o usuário pedir.
3. Toda notificação precisa de data e horário da infração; se o usuário não informar, o Augusto pergunta antes de redigir, com opção de "não se aplica".

## 1. Limpeza do conteúdo exportado

Ponto único: `src/lib/documento-export.ts`, numa função `limparParaDocumento(markdown)` aplicada dentro de `parseDocumento` — assim PDF, DOCX, prévia do editor e "salvar no condomínio" ficam iguais, sem tocar no texto exibido no chat.

Ela remove, antes de montar os blocos:

- o marcador `[[DOCUMENTO: ...]]` (hoje só é removido na tela do chat, não na geração);
- a linha "Deseja que eu gere o arquivo deste documento?" e variações;
- o parágrafo do disclaimer de IA (linha em itálico começando com ⚠️ e contendo "inteligência artificial" / "não substitui o parecer");
- frases de moldura conversacional no início e no fim: "Segue abaixo...", "Elaborei...", "Preparei a minuta...", "Se quiser, posso...", "Qualquer ajuste, é só pedir", "Espero ter ajudado", "Fico à disposição", "Posso gerar em PDF/DOCX";
- linhas soltas restantes com "PDF"/"DOCX"/"arquivo" em tom de pergunta.

Regras de segurança da limpeza: só corta linhas inteiras que casem com os padrões, nunca no miolo do texto; se após a limpeza sobrar menos de ~40 caracteres, mantém o texto original (documento sempre sai, nunca vazio). `validarConteudo` continua barrando o caso realmente vazio com toast.

Cobertura dos 4 estados: nada muda no fluxo — loading (spinner no botão), vazio (toast "Não há conteúdo"), erro (try/catch + toast), sucesso (toast + aviso "Arquivo baixado") já existem e permanecem.

Teste: um arquivo `src/lib/documento-export.test.ts` com casos — marcador presente, disclaimer presente, frase de convite, texto limpo (não pode mudar), texto que ficaria vazio (fallback).

## 2. Jurisprudência fora de notificações e comunicados

Só prompt, em `src/routes/api/chat.ts`, num bloco novo "REGRAS DE REDAÇÃO DE PEÇAS":

- Em notificação de infração, advertência, multa e comunicado: proibido citar acórdão, REsp, súmula ou tribunal no corpo. Fundamentar apenas pela convenção/regimento do condomínio e pelo artigo de lei aplicável. A jurisprudência é usada para interpretar a norma e calibrar o texto, não para aparecer.
- Exceção: se o usuário pedir expressamente ("cite a jurisprudência", "fundamenta com julgados"), aí cita.
- Pareceres, análises e respostas de chat continuam exatamente como hoje, com jurisprudência citada — a restrição vale só para peça dirigida ao condômino.

Isso não conflita com a diretiva de plano (`jurisprudenciaDirective`), que só restringe por plano; as duas somam.

## 3. Data e horário da infração obrigatórios

Também só prompt, reaproveitando o mecanismo de pergunta estruturada que já existe (`PerguntaEstruturada.tsx`):

- Antes de redigir qualquer notificação/advertência, se a data OU o horário da infração não estiverem na conversa, o Augusto devolve a pergunta estruturada perguntando ambos, cada um com a opção "Não se aplica / não sei precisar" e campo livre.
- Se o usuário responder "não se aplica", a peça usa uma fórmula neutra ("em data recente, conforme relato da administração") em vez de inventar data.
- Nunca inventar data ou hora.

Nenhum campo novo, nenhuma tela nova — a UI de pergunta estruturada já trata resposta, envio e erro.

## Arquivos tocados

| Arquivo | Mudança |
| --- | --- |
| `src/lib/documento-export.ts` | nova `limparParaDocumento`, chamada em `parseDocumento` |
| `src/lib/documento-export.test.ts` | novo — testes da limpeza |
| `src/routes/api/chat.ts` | regras de peças (jurisprudência) + data/hora obrigatórias |

## Fora de escopo

Sem tabela nova, sem RLS nova, sem edge function, sem segredo: nada aqui toca dados ou rede — a geração continua 100% no navegador e o resto é texto de prompt. Não mexo no visual do chat, no editor de minuta nem no salvamento no condomínio.
