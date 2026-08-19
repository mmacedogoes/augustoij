CREATE INDEX idx_assembleia_itens_id_ordem ON public.assembleia_itens(assembleia_id, ordem);
CREATE INDEX idx_assembleia_habilitacoes_id_apta ON public.assembleia_habilitacoes(assembleia_id, apta);
CREATE INDEX idx_assembleia_votos_item ON public.assembleia_votos(item_id);
CREATE INDEX idx_assembleia_votos_seq ON public.assembleia_votos(assembleia_id, sequencia);
CREATE INDEX idx_assembleia_tentativas_id_data ON public.assembleia_tentativas(assembleia_id, criado_em DESC);
CREATE INDEX idx_assembleia_presencas_sessao ON public.assembleia_presencas(sessao_id);
CREATE INDEX idx_assembleia_votante_id_email ON public.assembleia_sessoes_votante(assembleia_id, email);
CREATE INDEX idx_ata_lacunas_versao_sit ON public.ata_lacunas(versao_id, situacao);
CREATE INDEX idx_assembleia_convocacoes_id_tipo ON public.assembleia_convocacoes(assembleia_id, tipo);
CREATE INDEX idx_assembleia_dest_email_status ON public.assembleia_convocacao_destinatarios(convocacao_id, status_email);
CREATE INDEX idx_assembleia_dest_wa_status ON public.assembleia_convocacao_destinatarios(convocacao_id, status_whatsapp);
CREATE INDEX idx_assembleia_eventos_dest_data ON public.assembleia_convocacao_eventos(destinatario_id, ocorrido_em DESC);

CREATE OR REPLACE FUNCTION public.assembleia_verificar_integridade(p_assembleia_id uuid)
RETURNS TABLE (integra boolean, total_votos bigint, sequencia_quebrada bigint, voto_id uuid) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    r record;
    v_hash_anterior text := 'genesis';
    v_hash_calculado text;
BEGIN
    integra := true;
    total_votos := 0;
    FOR r IN (SELECT * FROM public.assembleia_votos WHERE assembleia_id = p_assembleia_id ORDER BY sequencia) LOOP
        total_votos := total_votos + 1;
        v_hash_calculado := encode(digest(r.item_id::text || coalesce(r.unidade_id::text, r.recibo) || r.opcao_id::text || r.criado_em::text || v_hash_anterior, 'sha256'), 'hex');
        IF v_hash_calculado != r.hash_voto OR coalesce(r.hash_anterior, 'genesis') != v_hash_anterior THEN
            integra := false;
            sequencia_quebrada := r.sequencia;
            voto_id := r.id;
            RETURN NEXT;
            RETURN;
        END IF;
        v_hash_anterior := r.hash_voto;
    END LOOP;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_assembleia_voto_antes_inserir()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_secreto boolean;
    v_hash_anterior text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.assembleia_id::text));
    SELECT secreto INTO v_secreto FROM public.assembleia_itens WHERE id = NEW.item_id;
    IF v_secreto THEN
        NEW.unidade_id := NULL;
        NEW.criado_em := date_trunc('minute', now());
    ELSE
        IF NEW.unidade_id IS NULL THEN
            RAISE EXCEPTION 'unidade_id obrigatorio para itens nao secretos';
        END IF;
    END IF;
    IF NEW.recibo IS NULL THEN
        NEW.recibo := public.assembleia_gerar_recibo();
    END IF;
    SELECT hash_voto INTO v_hash_anterior FROM public.assembleia_votos 
    WHERE assembleia_id = NEW.assembleia_id ORDER BY sequencia DESC LIMIT 1;
    NEW.hash_anterior := coalesce(v_hash_anterior, 'genesis');
    NEW.hash_voto := encode(digest(NEW.item_id::text || coalesce(NEW.unidade_id::text, NEW.recibo) || NEW.opcao_id::text || NEW.criado_em::text || NEW.hash_anterior, 'sha256'), 'hex');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assembleia_voto_antes_inserir
BEFORE INSERT ON public.assembleia_votos
FOR EACH ROW EXECUTE FUNCTION public.tg_assembleia_voto_antes_inserir();

CREATE OR REPLACE FUNCTION public.tg_assembleia_voto_bloquear()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'voto e imutavel';
    END IF;
    IF NEW.invalidado_em IS DISTINCT FROM OLD.invalidado_em OR 
       NEW.invalidado_motivo IS DISTINCT FROM OLD.invalidado_motivo OR 
       NEW.invalidado_por IS DISTINCT FROM OLD.invalidado_por THEN
       IF (NEW.id, NEW.assembleia_id, NEW.item_id, NEW.unidade_id, NEW.opcao_id, NEW.peso, NEW.base_calculo, NEW.origem, NEW.lancado_por, NEW.justificativa_manual, NEW.ip, NEW.user_agent, NEW.device_hash, NEW.criado_em, NEW.recibo, NEW.sequencia, NEW.hash_anterior, NEW.hash_voto) 
          IS DISTINCT FROM 
          (OLD.id, OLD.assembleia_id, OLD.item_id, OLD.unidade_id, OLD.opcao_id, OLD.peso, OLD.base_calculo, OLD.origem, OLD.lancado_por, OLD.justificativa_manual, OLD.ip, OLD.user_agent, OLD.device_hash, OLD.criado_em, OLD.recibo, OLD.sequencia, OLD.hash_anterior, OLD.hash_voto) THEN
          RAISE EXCEPTION 'apenas campos de invalidacao podem ser alterados';
       END IF;
       RETURN NEW;
    END IF;
    RAISE EXCEPTION 'voto e imutavel';
END;
$$;

CREATE TRIGGER trg_assembleia_voto_bloquear
BEFORE UPDATE OR DELETE ON public.assembleia_votos
FOR EACH ROW EXECUTE FUNCTION public.tg_assembleia_voto_bloquear();

CREATE OR REPLACE FUNCTION public.tg_assembleia_habilitacao_antes_inserir()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
    v_confirmada_em timestamptz;
BEGIN
    SELECT habilitacao_confirmada_em INTO v_confirmada_em FROM public.assembleias WHERE id = NEW.assembleia_id;
    IF v_confirmada_em IS NOT NULL THEN
        IF NEW.origem_dado = 'ajuste_manual' THEN
            IF NEW.justificativa IS NULL THEN
                RAISE EXCEPTION 'justificativa obrigatoria para ajuste manual apos congelamento';
            END IF;
        ELSE
            RAISE EXCEPTION 'habilitacao ja congelada para esta assembleia';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assembleia_habilitacao_antes_inserir
BEFORE INSERT ON public.assembleia_habilitacoes
FOR EACH ROW EXECUTE FUNCTION public.tg_assembleia_habilitacao_antes_inserir();

CREATE OR REPLACE FUNCTION public.tg_convocacao_destinatario_normalizar()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
    NEW.telefone_wa := public.normalizar_telefone_br(NEW.telefone_bruto);
    IF NEW.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' AND NEW.telefone_wa IS NOT NULL THEN
        NEW.canal := 'ambos';
    ELSIF NEW.email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        NEW.canal := 'email';
    ELSIF NEW.telefone_wa IS NOT NULL THEN
        NEW.canal := 'whatsapp';
    ELSE
        NEW.canal := 'sem_contato';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_convocacao_destinatario_normalizar
BEFORE INSERT OR UPDATE ON public.assembleia_convocacao_destinatarios
FOR EACH ROW EXECUTE FUNCTION public.tg_convocacao_destinatario_normalizar();

CREATE TRIGGER trg_assembleias_updated_at BEFORE UPDATE ON public.assembleias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_assembleia_itens_updated_at BEFORE UPDATE ON public.assembleia_itens FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_assembleia_convocacoes_updated_at BEFORE UPDATE ON public.assembleia_convocacoes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
