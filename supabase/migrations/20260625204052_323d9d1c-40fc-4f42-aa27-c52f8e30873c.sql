
-- 1. Resize embedding column to 1536 (matches openai/text-embedding-3-small with dimensions=1536)
ALTER TABLE public.document_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.document_chunks ADD COLUMN embedding vector(1536);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS document_chunks_condominio_idx
  ON public.document_chunks (condominio_id);

-- 2. Similarity search function (SECURITY DEFINER, filters by condo + membership)
CREATE OR REPLACE FUNCTION public.match_document_chunks(
  _condominio_id uuid,
  _query_embedding vector(1536),
  _match_count int DEFAULT 6,
  _min_similarity float DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id uuid,
  documento_id uuid,
  nome_arquivo text,
  conteudo text,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.match_document_chunks(uuid, vector, int, float) TO authenticated;

-- 3. Storage policies on bucket `documentos` (path layout: <condominio_id>/<filename>)
CREATE POLICY "Membros podem ver arquivos do condominio"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos'
  AND public.is_condominio_member(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
);

CREATE POLICY "Membros podem enviar arquivos do condominio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos'
  AND public.is_condominio_member(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
);

CREATE POLICY "Membros podem excluir arquivos do condominio"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos'
  AND public.is_condominio_member(
    (storage.foldername(name))[1]::uuid,
    auth.uid()
  )
);

-- 4. Trigger to update uso_mensal on each assistant message
CREATE OR REPLACE FUNCTION public.tg_update_uso_mensal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _mes text;
BEGIN
  IF NEW.papel <> 'assistant' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO _user_id FROM public.conversas WHERE id = NEW.conversa_id;
  IF _user_id IS NULL THEN
    RETURN NEW;
  END IF;

  _mes := to_char(now(), 'YYYY-MM');

  INSERT INTO public.uso_mensal (user_id, mes_ano, total_mensagens, total_tokens)
  VALUES (_user_id, _mes, 1, COALESCE(NEW.tokens_usados, 0))
  ON CONFLICT (user_id, mes_ano) DO UPDATE
  SET total_mensagens = public.uso_mensal.total_mensagens + 1,
      total_tokens = public.uso_mensal.total_tokens + COALESCE(NEW.tokens_usados, 0),
      updated_at = now();

  RETURN NEW;
END;
$$;

-- Ensure unique constraint exists for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uso_mensal_user_mes_unique'
  ) THEN
    ALTER TABLE public.uso_mensal
      ADD CONSTRAINT uso_mensal_user_mes_unique UNIQUE (user_id, mes_ano);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_update_uso_mensal ON public.mensagens;
CREATE TRIGGER trg_update_uso_mensal
AFTER INSERT ON public.mensagens
FOR EACH ROW EXECUTE FUNCTION public.tg_update_uso_mensal();
