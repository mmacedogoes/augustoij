
CREATE POLICY "kb_objects_admin_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kb-documentos' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "kb_objects_admin_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kb-documentos' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "kb_objects_admin_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kb-documentos' AND public.has_role(auth.uid(),'admin'));
