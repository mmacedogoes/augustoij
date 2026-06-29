DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'perfil_atuacao') THEN
    CREATE TYPE public.perfil_atuacao AS ENUM (
      'sindico',
      'advogado',
      'administradora',
      'conselheiro',
      'outro'
    );
  END IF;
END$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS perfil_atuacao public.perfil_atuacao;

ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS user_agent text;