
CREATE POLICY "contratos: super admin lê próprios arquivos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'contratos'
  AND public.is_super_admin(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "contratos: super admin envia arquivos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contratos'
  AND public.is_super_admin(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "contratos: super admin atualiza próprios arquivos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'contratos'
  AND public.is_super_admin(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'contratos'
  AND public.is_super_admin(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "contratos: super admin remove próprios arquivos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'contratos'
  AND public.is_super_admin(auth.uid())
  AND (storage.foldername(name))[1] = auth.uid()::text
);
