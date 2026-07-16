import { createFileRoute } from "@tanstack/react-router";
import { AjudaShell } from "@/components/ajuda/AjudaShell";

export const Route = createFileRoute("/_authenticated/app/ajuda/dicas-ia")({
  component: DicasIA,
});

function DicasIA() {
  return (
    <AjudaShell>
      <h1 className="text-2xl font-semibold mb-3">Dicas de interação com a IA</h1>
      <p>
        A qualidade das respostas depende de quanto contexto você fornece. Use as orientações
        abaixo para extrair o máximo do Augusto.IJ.
      </p>

      <h2 className="text-lg font-semibold mt-6 mb-2">Estrutura recomendada de prompt</h2>
      <p>
        Um bom pedido segue quatro partes, nesta ordem:
      </p>
      <ol className="list-decimal pl-6 space-y-1">
        <li><strong>Contexto</strong> — a quem se destina e qual o cenário (ex.: “condomínio residencial, 40 unidades”).</li>
        <li><strong>Fato</strong> — o que aconteceu, com data, hora, local e envolvidos.</li>
        <li><strong>Pedido</strong> — o que você quer que a IA produza (notificação, parecer, ata, análise).</li>
        <li><strong>Formato de saída</strong> — extensão, tom, se quer citação de artigos, se precisa de conclusão executiva.</li>
      </ol>

      <h2 className="text-lg font-semibold mt-6 mb-2">Exemplos de prompts prontos</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Notificação de barulho:</strong> “Gere uma notificação formal para o apto 302, bloco A, referente a barulho excessivo em 12/10/2026 às 23h. Segunda ocorrência. Base: Regimento Interno e Convenção anexados.”
        </li>
        <li>
          <strong>Ata de assembleia ordinária:</strong> “Elabore ata da AGO de 20/03/2026, quórum de 62% em segunda chamada. Pautas: aprovação de contas de 2025, previsão orçamentária 2026 e eleição de conselho. Deliberações aprovadas por maioria.”
        </li>
        <li>
          <strong>Parecer sobre inadimplência:</strong> “Parecer sobre cabimento de restrição ao uso da área de lazer para unidade inadimplente há 4 meses, considerando a Convenção anexada e a jurisprudência aplicável.”
        </li>
        <li>
          <strong>Análise de contrato:</strong> “Analise o contrato de portaria anexado. Aponte cláusulas com risco (semáforo vermelho/amarelo/verde), justifique cada uma e sugira redação para as vermelhas.”
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">Como pedir notificações</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Informe a unidade alvo (ex.: apto 502, bloco A).</li>
        <li>Descreva o fato com data, horário e local.</li>
        <li>Mencione se é primeira ocorrência ou reincidência.</li>
        <li>Diga em que documento a IA deve se apoiar (Convenção, Regimento, ata específica).</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">Como pedir análise contratual</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Anexe o contrato no chat ou cadastre em Documentos.</li>
        <li>Peça parecer com semáforo (vermelho/amarelo/verde) por cláusula.</li>
        <li>Peça sugestões de redação alternativa.</li>
        <li>Peça uma conclusão executiva ao final para levar à assembleia ou ao conselho.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">Como pedir fundamentação jurídica</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Peça citação de artigos: “cite o artigo e a lei em cada afirmação”.</li>
        <li>Peça jurisprudência: “aponte 2 ou 3 julgados aplicáveis, com tribunal e ano”.</li>
        <li>Valide as citações no repositório oficial (Planalto, tribunais estaduais, LexML) antes de usar em peça formal.</li>
      </ul>

      <h2 className="text-lg font-semibold mt-6 mb-2">Limites da IA</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>A IA é uma ferramenta de apoio — não substitui advogado nem parecer técnico habilitado.</li>
        <li>Sempre revise antes de enviar, assinar ou publicar qualquer documento gerado.</li>
        <li>Cidades fora da whitelist de legislação municipal ainda estão em incorporação (até 3 dias úteis) — nesse período, respostas usam legislação federal, estadual e jurisprudência.</li>
        <li>Documentos com status diferente de <em>Pronto</em> não entram no contexto.</li>
      </ul>
    </AjudaShell>
  );
}