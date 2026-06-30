import { createFileRoute, Link } from "@tanstack/react-router";
import { PERFIS } from "./app.ajuda.$secao";

export const Route = createFileRoute("/_authenticated/app/ajuda/perfil/$perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { perfil } = Route.useParams();
  const data = PERFIS[perfil];
  if (!data) {
    return (
      <>
        <h1 className="text-2xl font-semibold mb-3">Perfil não encontrado</h1>
        <p>
          Volte para o{" "}
          <Link to="/app/ajuda" className="text-emerald-600 hover:underline">
            manual
          </Link>
          .
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-2xl font-semibold mb-3">{data.titulo}</h1>
      <p className="text-slate-600">{data.descricao}</p>
      <h2 className="text-lg font-semibold mt-6 mb-2">Recomendações</h2>
      <ul className="list-disc pl-6 space-y-2">
        {data.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </>
  );
}