
CREATE POLICY helpdesk_anexos_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'helpdesk-anexos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_any_admin(auth.uid())
    )
  );

CREATE POLICY helpdesk_anexos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'helpdesk-anexos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY helpdesk_anexos_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'helpdesk-anexos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_any_admin(auth.uid())
    )
  );
