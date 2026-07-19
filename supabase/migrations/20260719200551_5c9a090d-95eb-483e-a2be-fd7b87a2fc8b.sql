
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _tipo public.tipo_pessoa := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tipo_pessoa','')::public.tipo_pessoa, 'pf');
  _papel public.papel_sistema := CASE WHEN _tipo = 'pj' THEN 'cliente_pj_dono'::public.papel_sistema ELSE 'cliente_pf'::public.papel_sistema END;
  _nome text := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'nome',''),
    NULLIF(NEW.raw_user_meta_data->>'full_name',''),
    NULLIF(NEW.raw_user_meta_data->>'name',''),
    NEW.email
  );
BEGIN
  INSERT INTO public.profiles (id, nome, email, telefone, tipo_pessoa, cpf_cnpj, razao_social, papel_sistema, lgpd_aceite_em)
  VALUES (
    NEW.id,
    _nome,
    NEW.email,
    NEW.raw_user_meta_data->>'telefone',
    _tipo,
    NEW.raw_user_meta_data->>'cpf_cnpj',
    NEW.raw_user_meta_data->>'razao_social',
    _papel,
    CASE WHEN (NEW.raw_user_meta_data->>'lgpd_aceite')::boolean IS TRUE THEN now() ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
