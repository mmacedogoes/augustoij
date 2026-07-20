import { createFileRoute, Link } from "@tanstack/react-router";
import { AjudaShell } from "@/components/ajuda/AjudaShell";
import { PERFIS } from "./app.ajuda.$secao";

export const Route = createFileRoute("/_authenticated/app/ajuda/perfil/$perfil")({
  component: PerfilPage,
});

function PerfilPage() {
  const { perfil } = Route.useParams();
  const data = PERFIS[perfil];
  if (!data) {
    return (
      <AjudaShell>
        <h1 className="text-2xl font-semibold mb-3">Perfil não encontrado</h1>
        <p>
          Volte para o{" "}
          <Link to="/app/ajuda" className="text-augusto-green underline-offset-4 hover:underline transition-colors duration-200">
            manual
          </Link>
          .
        </p>
      </AjudaShell>
    );
  }
  return (
    <AjudaShell>
      <h1 className="text-2xl font-semibold mb-3">{data.titulo}</h1>
      <p className="text-muted-foreground">{data.descricao}</p>
      <h2 className="text-lg font-semibold mt-6 mb-2">Recomendações</h2>
      <ul className="list-disc pl-6 space-y-2">
        {data.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </AjudaShell>
  );
}