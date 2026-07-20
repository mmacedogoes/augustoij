
-- Enums
DO $$ BEGIN
  CREATE TYPE public.helpdesk_assunto AS ENUM ('duvida_uso','problema_tecnico','financeiro','sugestao','seguranca_lgpd','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.helpdesk_status AS ENUM ('aberto','respondido_admin','respondido_cliente','encerrado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.helpdesk_autor AS ENUM ('cliente','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tickets
CREATE TABLE IF NOT EXISTS public.helpdesk_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assunto public.helpdesk_assunto NOT NULL,
  titulo text NOT NULL,
  status public.helpdesk_status NOT NULL DEFAULT 'aberto',
  encerrado_em timestamptz,
  encerrado_por public.helpdesk_autor,
  last_admin_notified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS helpdesk_tickets_user_idx ON public.helpdesk_tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS helpdesk_tickets_status_idx ON public.helpdesk_tickets(status, updated_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.helpdesk_tickets TO authenticated;
GRANT ALL ON public.helpdesk_tickets TO service_role;
ALTER TABLE public.helpdesk_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY helpdesk_tickets_select_own ON public.helpdesk_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_any_admin(auth.uid()));

CREATE POLICY helpdesk_tickets_insert_own ON public.helpdesk_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY helpdesk_tickets_update_admin_or_owner_close ON public.helpdesk_tickets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_any_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_any_admin(auth.uid()));

-- Mensagens
CREATE TABLE IF NOT EXISTS public.helpdesk_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.helpdesk_tickets(id) ON DELETE CASCADE,
  autor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  autor_tipo public.helpdesk_autor NOT NULL,
  conteudo text NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS helpdesk_mensagens_ticket_idx ON public.helpdesk_mensagens(ticket_id, created_at ASC);

GRANT SELECT, INSERT ON public.helpdesk_mensagens TO authenticated;
GRANT ALL ON public.helpdesk_mensagens TO service_role;
ALTER TABLE public.helpdesk_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY helpdesk_mensagens_select ON public.helpdesk_mensagens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND (t.user_id = auth.uid() OR public.is_any_admin(auth.uid()))
    )
  );

CREATE POLICY helpdesk_mensagens_insert ON public.helpdesk_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    autor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.helpdesk_tickets t
      WHERE t.id = ticket_id
        AND (
          (autor_tipo = 'cliente' AND t.user_id = auth.uid()
             AND (t.status <> 'encerrado' OR t.encerrado_em > now() - interval '7 days'))
          OR (autor_tipo = 'admin' AND public.is_any_admin(auth.uid()))
        )
    )
  );

-- Trigger updated_at + status
CREATE OR REPLACE FUNCTION public.tg_helpdesk_mensagem_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.helpdesk_tickets
     SET updated_at = now(),
         status = CASE
                    WHEN status = 'encerrado' THEN 'aberto'::public.helpdesk_status
                    WHEN NEW.autor_tipo = 'cliente' THEN 'respondido_cliente'::public.helpdesk_status
                    ELSE 'respondido_admin'::public.helpdesk_status
                  END,
         encerrado_em = CASE WHEN status = 'encerrado' THEN NULL ELSE encerrado_em END,
         encerrado_por = CASE WHEN status = 'encerrado' THEN NULL ELSE encerrado_por END,
         last_admin_notified_at = CASE
                    WHEN NEW.autor_tipo = 'cliente' THEN now()
                    ELSE last_admin_notified_at
                  END
   WHERE id = NEW.ticket_id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS helpdesk_mensagem_after_insert ON public.helpdesk_mensagens;
CREATE TRIGGER helpdesk_mensagem_after_insert
AFTER INSERT ON public.helpdesk_mensagens
FOR EACH ROW EXECUTE FUNCTION public.tg_helpdesk_mensagem_after_insert();

DROP TRIGGER IF EXISTS helpdesk_tickets_updated_at ON public.helpdesk_tickets;
CREATE TRIGGER helpdesk_tickets_updated_at
BEFORE UPDATE ON public.helpdesk_tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Gerador de protocolo
CREATE OR REPLACE FUNCTION public.gerar_protocolo_helpdesk()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _dia text := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYYMMDD');
  _seq int;
  _tentativa int := 0;
  _protocolo text;
BEGIN
  LOOP
    SELECT COALESCE(MAX(SUBSTRING(protocolo FROM 14)::int), 0) + 1
      INTO _seq
      FROM public.helpdesk_tickets
     WHERE protocolo LIKE 'AIJ-' || _dia || '-%';
    _protocolo := 'AIJ-' || _dia || '-' || lpad(_seq::text, 4, '0');
    BEGIN
      RETURN _protocolo;
    EXCEPTION WHEN unique_violation THEN
      _tentativa := _tentativa + 1;
      IF _tentativa > 5 THEN RAISE; END IF;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.gerar_protocolo_helpdesk() TO authenticated;
