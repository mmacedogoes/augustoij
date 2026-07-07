ALTER TABLE public.condominios DROP CONSTRAINT IF EXISTS condominios_categoria_check;
ALTER TABLE public.condominios ADD CONSTRAINT condominios_categoria_check
  CHECK (categoria = ANY (ARRAY['predio'::text, 'casas'::text, 'salas_comerciais'::text, 'shopping'::text, 'galpoes'::text]));