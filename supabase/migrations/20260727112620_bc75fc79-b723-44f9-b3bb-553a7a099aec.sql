CREATE TABLE public.contratos_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'landing-page',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX contratos_waitlist_email_key ON public.contratos_waitlist (lower(email));

GRANT INSERT ON public.contratos_waitlist TO anon, authenticated;
GRANT SELECT ON public.contratos_waitlist TO authenticated;
GRANT ALL ON public.contratos_waitlist TO service_role;

ALTER TABLE public.contratos_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer visitante pode se inscrever"
  ON public.contratos_waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins podem ver a lista"
  ON public.contratos_waitlist
  FOR SELECT
  TO authenticated
  USING (public.is_any_admin(auth.uid()));