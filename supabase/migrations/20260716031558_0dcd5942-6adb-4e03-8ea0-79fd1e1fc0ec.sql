-- 1. Schema de extensões
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- 2. Move a extensão pgvector para fora do public
ALTER EXTENSION vector SET SCHEMA extensions;

-- 3. Recria as funções que referenciam `vector` incluindo `extensions` no search_path.
--    (o tipo `vector` agora vive em extensions; sem isso o parser não o encontra
--     ao recompilar/planejar as funções SECURITY DEFINER com search_path travado.)

CREATE OR REPLACE FUNCTION public.match_kb_chunks(
  _query_embedding extensions.vector,
  _match_count integer DEFAULT 4,
  _min_similarity double precision DEFAULT 0.35
)
RETURNS TABLE(
  chunk_id uuid,
  kb_documento_id uuid,
  titulo text,
  tipo public.kb_tipo,
  fonte text,
  conteudo text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.kb_documento_id,
    d.titulo,
    d.tipo,
    d.fonte,
    c.conteudo,
    1 - (c.embedding <=> _query_embedding) AS similarity
  FROM public.kb_chunks c
  JOIN public.kb_documentos d ON d.id = c.kb_documento_id
  WHERE c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> _query_embedding) >= _min_similarity
  ORDER BY c.embedding <=> _query_embedding
  LIMIT _match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_document_chunks(
  _condominio_id uuid,
  _query_embedding extensions.vector,
  _match_count integer DEFAULT 6,
  _min_similarity double precision DEFAULT 0.3
)
RETURNS TABLE(
  chunk_id uuid,
  documento_id uuid,
  nome_arquivo text,
  conteudo text,
  similarity double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NOT public.is_condominio_member(_condominio_id, auth.uid()) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    dc.id,
    dc.documento_id,
    d.nome_arquivo,
    dc.conteudo,
    1 - (dc.embedding <=> _query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documentos d ON d.id = dc.documento_id
  WHERE dc.condominio_id = _condominio_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> _query_embedding) >= _min_similarity
  ORDER BY dc.embedding <=> _query_embedding
  LIMIT _match_count;
END;
$function$;

-- 4. Preserva permissões (as duas são chamadas via .rpc() por usuários autenticados)
REVOKE EXECUTE ON FUNCTION public.match_kb_chunks(extensions.vector, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_kb_chunks(extensions.vector, integer, double precision) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.match_document_chunks(uuid, extensions.vector, integer, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid, extensions.vector, integer, double precision) TO authenticated, service_role;