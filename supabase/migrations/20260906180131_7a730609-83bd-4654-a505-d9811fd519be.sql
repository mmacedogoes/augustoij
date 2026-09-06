
-- 1) profiles: endurecer a proteção de auto-escalonamento, cobrindo também criado_por
CREATE OR REPLACE FUNCTION public.tg_profiles_prevent_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = NEW.id THEN
    NEW.papel_sistema := OLD.papel_sistema;
    NEW.ativo := OLD.ativo;
    NEW.criado_por := OLD.criado_por;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) helpdesk_tickets: dono só pode encerrar o próprio chamado; demais campos administrativos protegidos
CREATE OR REPLACE FUNCTION public.tg_helpdesk_ticket_owner_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- service_role / postgres (sem JWT de usuário) passa livre
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_admin := public.is_any_admin(auth.uid());

  IF NOT is_admin THEN
    -- Campos imutáveis para o dono do chamado
    NEW.user_id := OLD.user_id;
    NEW.protocolo := OLD.protocolo;
    NEW.assunto := OLD.assunto;
    NEW.titulo := OLD.titulo;
    NEW.last_admin_notified_at := OLD.last_admin_notified_at;

    -- Única transição permitida: encerrar o próprio chamado
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT (OLD.status <> 'encerrado' AND NEW.status = 'encerrado') THEN
        RAISE EXCEPTION 'Operação não permitida no chamado.';
      END IF;
      NEW.encerrado_por := 'cliente';
      NEW.encerrado_em := COALESCE(NEW.encerrado_em, now());
    ELSE
      NEW.encerrado_por := OLD.encerrado_por;
      NEW.encerrado_em := OLD.encerrado_em;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS helpdesk_tickets_owner_update_guard ON public.helpdesk_tickets;
CREATE TRIGGER helpdesk_tickets_owner_update_guard
BEFORE UPDATE ON public.helpdesk_tickets
FOR EACH ROW
EXECUTE FUNCTION public.tg_helpdesk_ticket_owner_update_guard();

-- 3) Endurecer a policy de UPDATE de profiles: manter apenas auto-update (admin via super_admin policy; trigger protege colunas)
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 4) Endurecer a policy de UPDATE de helpdesk_tickets (escopo já controlado pelo trigger acima)
DROP POLICY IF EXISTS helpdesk_tickets_update_admin_or_owner_close ON public.helpdesk_tickets;
CREATE POLICY helpdesk_tickets_update_admin_or_owner_close ON public.helpdesk_tickets
FOR UPDATE TO authenticated
USING ((auth.uid() = user_id) OR is_any_admin(auth.uid()))
WITH CHECK ((auth.uid() = user_id) OR is_any_admin(auth.uid()));
