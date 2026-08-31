WITH ordenados AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY documento_id
      ORDER BY
        COALESCE((metadata->>'bloco')::integer, 2147483647),
        COALESCE((metadata->>'pagina_inicio')::integer, 2147483647),
        COALESCE((metadata->>'trecho')::integer, 2147483647),
        id
    ) - 1 AS ordem_global,
    row_number() OVER (
      PARTITION BY documento_id, COALESCE((metadata->>'bloco')::integer, -1)
      ORDER BY
        COALESCE((metadata->>'pagina_inicio')::integer, 2147483647),
        COALESCE((metadata->>'trecho')::integer, 2147483647),
        id
    ) - 1 AS trecho
  FROM public.document_chunks
)
UPDATE public.document_chunks dc
SET metadata = COALESCE(dc.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'ordem_global', o.ordem_global,
    'trecho', COALESCE((dc.metadata->>'trecho')::integer, o.trecho)
  )
FROM ordenados o
WHERE dc.id = o.id
  AND NOT (COALESCE(dc.metadata, '{}'::jsonb) ? 'ordem_global');