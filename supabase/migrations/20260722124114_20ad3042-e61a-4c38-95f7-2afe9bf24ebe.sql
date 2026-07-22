
DO $$
DECLARE
  _users uuid[] := ARRAY[
    'be10accb-6297-452b-ab16-ce767526a11d',
    '15595ee2-6c99-4f0f-b6e2-ba2bb6040f31',
    '2a8bb3e2-88a2-4b0c-b0c9-39ad4b20585b',
    'fd39039a-c11d-484f-90e1-f923f4469d14',
    'a59b5f36-a6c3-43c6-aa77-f14ffd955dc1',
    '3d795752-136e-45ca-9f34-0171aa337c2b'
  ]::uuid[];
  _condos uuid[];
  _conversas uuid[];
  _tickets uuid[];
  _proprietarios uuid[];
  _imoveis uuid[];
  _locacoes uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _condos FROM public.condominios WHERE owner_id = ANY(_users);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _conversas FROM public.conversas WHERE user_id = ANY(_users);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _tickets FROM public.helpdesk_tickets WHERE user_id = ANY(_users);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _proprietarios FROM public.proprietarios WHERE owner_admin_id = ANY(_users);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _imoveis FROM public.imoveis WHERE owner_admin_id = ANY(_users);
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _locacoes FROM public.contratos_locacao WHERE owner_admin_id = ANY(_users);

  DELETE FROM public.aditivos WHERE contrato_locacao_id = ANY(_locacoes);
  DELETE FROM public.caucoes WHERE contrato_locacao_id = ANY(_locacoes);
  DELETE FROM public.honorarios WHERE contrato_locacao_id = ANY(_locacoes);
  DELETE FROM public.pagamentos WHERE contrato_locacao_id = ANY(_locacoes);
  DELETE FROM public.reajustes WHERE contrato_locacao_id = ANY(_locacoes);
  DELETE FROM public.contratos_locacao WHERE owner_admin_id = ANY(_users);
  DELETE FROM public.contratos_administracao WHERE owner_admin_id = ANY(_users) OR proprietario_id = ANY(_proprietarios);
  DELETE FROM public.manutencoes WHERE imovel_id = ANY(_imoveis);
  DELETE FROM public.imoveis WHERE owner_admin_id = ANY(_users) OR proprietario_id = ANY(_proprietarios);
  DELETE FROM public.proprietarios WHERE owner_admin_id = ANY(_users);
  DELETE FROM public.alertas_resolvidos WHERE owner_admin_id = ANY(_users);

  DELETE FROM public.helpdesk_mensagens WHERE ticket_id = ANY(_tickets);
  DELETE FROM public.helpdesk_tickets WHERE user_id = ANY(_users);

  DELETE FROM public.mensagens WHERE conversa_id = ANY(_conversas);
  DELETE FROM public.conversas WHERE user_id = ANY(_users);
  DELETE FROM public.chat_cache WHERE condominio_id = ANY(_condos);

  DELETE FROM public.document_chunks WHERE condominio_id = ANY(_condos);
  DELETE FROM public.documentos WHERE condominio_id = ANY(_condos);
  DELETE FROM public.sugestoes_unidades WHERE condominio_id = ANY(_condos);
  DELETE FROM public.unidades WHERE condominio_id = ANY(_condos);
  DELETE FROM public.condominos WHERE condominio_id = ANY(_condos);
  DELETE FROM public.condominio_members WHERE condominio_id = ANY(_condos) OR user_id = ANY(_users);
  DELETE FROM public.eventos_ia WHERE user_id = ANY(_users) OR condominio_id = ANY(_condos);
  DELETE FROM public.despesas WHERE created_by = ANY(_users);
  DELETE FROM public.cidades_novas_alertas WHERE owner_id = ANY(_users) OR primeiro_condominio_id = ANY(_condos);
  DELETE FROM public.condominios WHERE owner_id = ANY(_users);

  DELETE FROM public.alertas_uso WHERE user_id = ANY(_users);
  DELETE FROM public.uso_diario WHERE user_id = ANY(_users);
  DELETE FROM public.uso_mensal WHERE user_id = ANY(_users);
  DELETE FROM public.custos_cliente_mensal WHERE user_id = ANY(_users);
  DELETE FROM public.cancelamentos WHERE user_id = ANY(_users);
  DELETE FROM public.subscriptions WHERE user_id = ANY(_users);

  DELETE FROM public.solicitacoes_exclusao_conta WHERE user_id = ANY(_users);
  DELETE FROM public.solicitacoes_exportacao WHERE user_id = ANY(_users);

  DELETE FROM public.profiles WHERE id = ANY(_users);

  DELETE FROM auth.identities WHERE user_id = ANY(_users);
  DELETE FROM auth.sessions WHERE user_id = ANY(_users);
  DELETE FROM auth.users WHERE id = ANY(_users);
END $$;
