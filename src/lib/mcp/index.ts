import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarCondominios from "./tools/listar-condominios";
import listarUnidades from "./tools/listar-unidades";
import listarDocumentos from "./tools/listar-documentos";
import listarContratos from "./tools/listar-contratos";
import listarAssembleias from "./tools/listar-assembleias";
import pautaAssembleia from "./tools/pauta-assembleia";

// O emissor OAuth precisa ser o host direto do Supabase (o proxy publicado
// quebraria a validação RFC 8414). O ref do projeto é inlinado no build.
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "augusto-ij",
  title: "Augusto.IJ",
  version: "0.1.0",
  instructions:
    "Ferramentas do Augusto.IJ, plataforma de inteligência jurídica condominial. Use `listar_condominios` para descobrir os condomínios do usuário e o seu id, e depois as demais ferramentas para unidades, documentos, contratos de prestação de serviços e assembleias. Todos os dados respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listarCondominios,
    listarUnidades,
    listarDocumentos,
    listarContratos,
    listarAssembleias,
    pautaAssembleia,
  ],
});
