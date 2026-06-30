import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/ajuda/dicas-ia")({
  component: DicasIA,
});

function DicasIA() {
  return (
    <>
      <h1 className="text-2xl font-semibold mb-3">Dicas de interação com a IA</h1>
      <p>
        A qualidade das respostas depende de quanto contexto você fornece. Use as orientações
        abaixo para extrair o máximo do CondoIA.
      </p>
      <h2 className="text-lg font-semibold mt-6 mb-2">Como pedir notificações</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Informe a unidade alvo (ex.: apto 502, bloco A).</li>
        <li>Descreva o fato com data, horário e local.</li>
        <li>Mencione se é primeira ocorrência ou reincidência.</li>
      </ul>
      <h2 className="text-lg font-semibold mt-6 mb-2">Como pedir análise contratual</h2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Anexe o contrato no chat ou cadastre em Documentos.</li>
        <li>Peça parecer com semáforo (vermelho/amarelo/verde) por cláusula.</li>
        <li>Peça sugestões de redação alternativa.</li>
      </ul>
      <h2 className="text-lg font-semibold mt-6 mb-2">Como interpretar respostas jurídicas</h2>
      <p>
        Quando a IA cita artigos, leis ou jurisprudência, valide os trechos com a fonte original.
        As respostas são informativas e não substituem aconselhamento de profissional habilitado.
      </p>
    </>
  );
}