UPDATE public.documentos d
SET status_processamento = 'erro: documento sem conteúdo indexado',
    processamento_meta = jsonb_build_object(
      'etapa', 'indexacao',
      'mensagem', 'O processamento anterior terminou sem produzir conteúdo legível. Use Reler documento para recuperar o arquivo.',
      'recuperavel', true,
      'atualizado_em', now()
    )
WHERE d.status_processamento = 'pronto'
  AND NOT EXISTS (
    SELECT 1 FROM public.document_chunks c WHERE c.documento_id = d.id
  );

UPDATE public.documentos d
SET status_processamento = 'erro: processamento interrompido',
    processamento_meta = coalesce(d.processamento_meta, '{}'::jsonb) || jsonb_build_object(
      'etapa', 'recuperacao',
      'mensagem', 'O processamento anterior foi interrompido. Use Reler documento para continuar ou reiniciar.',
      'recuperavel', true,
      'atualizado_em', now()
    )
WHERE d.status_processamento = 'processando'
  AND d.created_at < now() - interval '1 hour';