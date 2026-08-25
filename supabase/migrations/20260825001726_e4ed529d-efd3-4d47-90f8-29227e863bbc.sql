DROP POLICY IF EXISTS "Super admins can manage fila_fala" ON public.assembleia_fila_fala;
CREATE POLICY "Super admins can manage fila_fala"
ON public.assembleia_fila_fala
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));