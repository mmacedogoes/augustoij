export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aditivos: {
        Row: {
          contrato_locacao_id: string
          created_at: string
          dados: Json
          gerado_em: string
          id: string
          owner_admin_id: string
          pdf_url: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          contrato_locacao_id: string
          created_at?: string
          dados?: Json
          gerado_em?: string
          id?: string
          owner_admin_id?: string
          pdf_url?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          contrato_locacao_id?: string
          created_at?: string
          dados?: Json
          gerado_em?: string
          id?: string
          owner_admin_id?: string
          pdf_url?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aditivos_contrato_locacao_id_fkey"
            columns: ["contrato_locacao_id"]
            isOneToOne: false
            referencedRelation: "contratos_locacao"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json
          target_condominio_id: string | null
          target_kb_id: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_condominio_id?: string | null
          target_kb_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_condominio_id?: string | null
          target_kb_id?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      ai_orientacoes: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          conteudo: string
          created_at?: string
          id?: string
          ordem?: number
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      alertas_resolvidos: {
        Row: {
          chave: string
          created_at: string
          id: string
          observacao: string | null
          owner_admin_id: string
          resolvido_em: string
          updated_at: string
        }
        Insert: {
          chave: string
          created_at?: string
          id?: string
          observacao?: string | null
          owner_admin_id: string
          resolvido_em?: string
          updated_at?: string
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          observacao?: string | null
          owner_admin_id?: string
          resolvido_em?: string
          updated_at?: string
        }
        Relationships: []
      }
      alertas_uso: {
        Row: {
          disparado_em: string
          id: string
          mes_ano: string
          notificou_admin: boolean
          notificou_usuario: boolean
          percentual_atingido: number
          threshold_pct: number
          tipo: string
          user_id: string
        }
        Insert: {
          disparado_em?: string
          id?: string
          mes_ano: string
          notificou_admin?: boolean
          notificou_usuario?: boolean
          percentual_atingido: number
          threshold_pct: number
          tipo: string
          user_id: string
        }
        Update: {
          disparado_em?: string
          id?: string
          mes_ano?: string
          notificou_admin?: boolean
          notificou_usuario?: boolean
          percentual_atingido?: number
          threshold_pct?: number
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      asaas_webhook_events: {
        Row: {
          customer_id: string | null
          erro: string | null
          event_id: string | null
          event_type: string | null
          id: string
          payload: Json
          payment_id: string | null
          processado_em: string | null
          received_at: string
          status: string | null
          subscription_id: string | null
        }
        Insert: {
          customer_id?: string | null
          erro?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          payment_id?: string | null
          processado_em?: string | null
          received_at?: string
          status?: string | null
          subscription_id?: string | null
        }
        Update: {
          customer_id?: string | null
          erro?: string | null
          event_id?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          payment_id?: string | null
          processado_em?: string | null
          received_at?: string
          status?: string | null
          subscription_id?: string | null
        }
        Relationships: []
      }
      assembleia_cabine_tokens: {
        Row: {
          created_at: string | null
          criado_por: string
          expira_em: string
          id: string
          item_id: string
          token_hash: string
          unidade_id: string
          usado_em: string | null
        }
        Insert: {
          created_at?: string | null
          criado_por?: string
          expira_em: string
          id?: string
          item_id: string
          token_hash: string
          unidade_id: string
          usado_em?: string | null
        }
        Update: {
          created_at?: string | null
          criado_por?: string
          expira_em?: string
          id?: string
          item_id?: string
          token_hash?: string
          unidade_id?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_cabine_tokens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assembleia_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_convocacao_destinatarios: {
        Row: {
          canal: string
          condomino_id: string | null
          convocacao_id: string
          created_at: string | null
          email: string | null
          email_aberto_em: string | null
          email_entregue_em: string | null
          email_enviado_em: string | null
          email_erro: string | null
          entrega_fisica_em: string | null
          entrega_fisica_protocolo: string | null
          id: string
          nome: string
          observacao: string | null
          resend_message_id: string | null
          status_email: string
          status_whatsapp: string
          telefone_bruto: string | null
          telefone_wa: string | null
          unidade_id: string
          whatsapp_confirmado_em: string | null
          whatsapp_confirmado_por: string | null
          whatsapp_link_aberto_em: string | null
          whatsapp_link_aberto_por: string | null
        }
        Insert: {
          canal?: string
          condomino_id?: string | null
          convocacao_id: string
          created_at?: string | null
          email?: string | null
          email_aberto_em?: string | null
          email_entregue_em?: string | null
          email_enviado_em?: string | null
          email_erro?: string | null
          entrega_fisica_em?: string | null
          entrega_fisica_protocolo?: string | null
          id?: string
          nome: string
          observacao?: string | null
          resend_message_id?: string | null
          status_email?: string
          status_whatsapp?: string
          telefone_bruto?: string | null
          telefone_wa?: string | null
          unidade_id: string
          whatsapp_confirmado_em?: string | null
          whatsapp_confirmado_por?: string | null
          whatsapp_link_aberto_em?: string | null
          whatsapp_link_aberto_por?: string | null
        }
        Update: {
          canal?: string
          condomino_id?: string | null
          convocacao_id?: string
          created_at?: string | null
          email?: string | null
          email_aberto_em?: string | null
          email_entregue_em?: string | null
          email_enviado_em?: string | null
          email_erro?: string | null
          entrega_fisica_em?: string | null
          entrega_fisica_protocolo?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          resend_message_id?: string | null
          status_email?: string
          status_whatsapp?: string
          telefone_bruto?: string | null
          telefone_wa?: string | null
          unidade_id?: string
          whatsapp_confirmado_em?: string | null
          whatsapp_confirmado_por?: string | null
          whatsapp_link_aberto_em?: string | null
          whatsapp_link_aberto_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_convocacao_destinatarios_condomino_id_fkey"
            columns: ["condomino_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_convocacao_destinatarios_convocacao_id_fkey"
            columns: ["convocacao_id"]
            isOneToOne: false
            referencedRelation: "assembleia_convocacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_convocacao_destinatarios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_convocacao_eventos: {
        Row: {
          canal: string
          destinatario_id: string
          id: string
          ocorrido_em: string
          payload: Json | null
          registrado_por: string | null
          tipo: string
        }
        Insert: {
          canal: string
          destinatario_id: string
          id?: string
          ocorrido_em?: string
          payload?: Json | null
          registrado_por?: string | null
          tipo: string
        }
        Update: {
          canal?: string
          destinatario_id?: string
          id?: string
          ocorrido_em?: string
          payload?: Json | null
          registrado_por?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_convocacao_eventos_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "assembleia_convocacao_destinatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_convocacoes: {
        Row: {
          agendada_para: string | null
          assembleia_id: string
          assunto_email: string | null
          corpo_email: string | null
          corpo_whatsapp: string | null
          created_at: string | null
          criada_por: string
          enviada_em: string | null
          id: string
          incluir_link_edital: boolean
          incluir_link_videoconferencia: boolean
          incluir_link_votacao: boolean
          situacao: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          agendada_para?: string | null
          assembleia_id: string
          assunto_email?: string | null
          corpo_email?: string | null
          corpo_whatsapp?: string | null
          created_at?: string | null
          criada_por?: string
          enviada_em?: string | null
          id?: string
          incluir_link_edital?: boolean
          incluir_link_videoconferencia?: boolean
          incluir_link_votacao?: boolean
          situacao?: string
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          agendada_para?: string | null
          assembleia_id?: string
          assunto_email?: string | null
          corpo_email?: string | null
          corpo_whatsapp?: string | null
          created_at?: string | null
          criada_por?: string
          enviada_em?: string | null
          id?: string
          incluir_link_edital?: boolean
          incluir_link_videoconferencia?: boolean
          incluir_link_votacao?: boolean
          situacao?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_convocacoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_falantes: {
        Row: {
          assembleia_id: string
          id: string
          nome: string | null
          papel: string
          rotulo_ia: string
          unidade_id: string | null
        }
        Insert: {
          assembleia_id: string
          id?: string
          nome?: string | null
          papel?: string
          rotulo_ia: string
          unidade_id?: string | null
        }
        Update: {
          assembleia_id?: string
          id?: string
          nome?: string | null
          papel?: string
          rotulo_ia?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_falantes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_gravacoes: {
        Row: {
          arquivo_path: string
          assembleia_id: string
          bloco_ordem: number
          created_at: string | null
          duracao_seg: number | null
          erro: string | null
          id: string
          offset_inicio_seg: number
          sessao_id: string
          status: string
        }
        Insert: {
          arquivo_path: string
          assembleia_id: string
          bloco_ordem: number
          created_at?: string | null
          duracao_seg?: number | null
          erro?: string | null
          id?: string
          offset_inicio_seg?: number
          sessao_id: string
          status?: string
        }
        Update: {
          arquivo_path?: string
          assembleia_id?: string
          bloco_ordem?: number
          created_at?: string | null
          duracao_seg?: number | null
          erro?: string | null
          id?: string
          offset_inicio_seg?: number
          sessao_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_gravacoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_gravacoes_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "assembleia_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_habilitacoes: {
        Row: {
          apta: boolean
          assembleia_id: string
          congelado_em: string
          congelado_por: string | null
          id: string
          justificativa: string | null
          motivo_bloqueio: string | null
          origem_dado: string
          peso_fracao: number | null
          peso_unidade: number
          unidade_id: string
        }
        Insert: {
          apta: boolean
          assembleia_id: string
          congelado_em?: string
          congelado_por?: string | null
          id?: string
          justificativa?: string | null
          motivo_bloqueio?: string | null
          origem_dado: string
          peso_fracao?: number | null
          peso_unidade?: number
          unidade_id: string
        }
        Update: {
          apta?: boolean
          assembleia_id?: string
          congelado_em?: string
          congelado_por?: string | null
          id?: string
          justificativa?: string | null
          motivo_bloqueio?: string | null
          origem_dado?: string
          peso_fracao?: number | null
          peso_unidade?: number
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_habilitacoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_habilitacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_inadimplencia_importacoes: {
        Row: {
          arquivo_path: string
          assembleia_id: string
          confirmada_em: string | null
          created_at: string | null
          criado_por: string
          erro: string | null
          id: string
          nome_arquivo: string
          resultado_ia: Json | null
          status: string
          tipo_lista: string
          total_casadas: number | null
          total_linhas: number | null
          total_nao_casadas: number | null
        }
        Insert: {
          arquivo_path: string
          assembleia_id: string
          confirmada_em?: string | null
          created_at?: string | null
          criado_por?: string
          erro?: string | null
          id?: string
          nome_arquivo: string
          resultado_ia?: Json | null
          status?: string
          tipo_lista?: string
          total_casadas?: number | null
          total_linhas?: number | null
          total_nao_casadas?: number | null
        }
        Update: {
          arquivo_path?: string
          assembleia_id?: string
          confirmada_em?: string | null
          created_at?: string | null
          criado_por?: string
          erro?: string | null
          id?: string
          nome_arquivo?: string
          resultado_ia?: Json | null
          status?: string
          tipo_lista?: string
          total_casadas?: number | null
          total_linhas?: number | null
          total_nao_casadas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_inadimplencia_importacoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_inadimplencia_itens: {
        Row: {
          ajustado_em: string | null
          ajustado_manualmente: boolean
          ajustado_por: string | null
          confianca: number | null
          id: string
          identificador_bruto: string | null
          ignorado: boolean
          importacao_id: string
          inadimplente: boolean
          nome_bruto: string | null
          observacao: string | null
          unidade_id: string | null
          valor_debito: number | null
        }
        Insert: {
          ajustado_em?: string | null
          ajustado_manualmente?: boolean
          ajustado_por?: string | null
          confianca?: number | null
          id?: string
          identificador_bruto?: string | null
          ignorado?: boolean
          importacao_id: string
          inadimplente?: boolean
          nome_bruto?: string | null
          observacao?: string | null
          unidade_id?: string | null
          valor_debito?: number | null
        }
        Update: {
          ajustado_em?: string | null
          ajustado_manualmente?: boolean
          ajustado_por?: string | null
          confianca?: number | null
          id?: string
          identificador_bruto?: string | null
          ignorado?: boolean
          importacao_id?: string
          inadimplente?: boolean
          nome_bruto?: string | null
          observacao?: string | null
          unidade_id?: string | null
          valor_debito?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_inadimplencia_itens_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "assembleia_inadimplencia_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_inadimplencia_itens_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_itens: {
        Row: {
          aberto_em: string | null
          alerta_ia: Json | null
          assembleia_id: string
          base_calculo: string | null
          created_at: string | null
          descricao: string | null
          encerrado_em: string | null
          fecha_em: string | null
          fundamento_legal: string | null
          id: string
          ordem: number
          quorum_valor: number | null
          regra_quorum: string
          secreto: boolean
          sessao_id: string | null
          situacao: string
          tipo_votacao: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          aberto_em?: string | null
          alerta_ia?: Json | null
          assembleia_id: string
          base_calculo?: string | null
          created_at?: string | null
          descricao?: string | null
          encerrado_em?: string | null
          fecha_em?: string | null
          fundamento_legal?: string | null
          id?: string
          ordem: number
          quorum_valor?: number | null
          regra_quorum?: string
          secreto?: boolean
          sessao_id?: string | null
          situacao?: string
          tipo_votacao?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          aberto_em?: string | null
          alerta_ia?: Json | null
          assembleia_id?: string
          base_calculo?: string | null
          created_at?: string | null
          descricao?: string | null
          encerrado_em?: string | null
          fecha_em?: string | null
          fundamento_legal?: string | null
          id?: string
          ordem?: number
          quorum_valor?: number | null
          regra_quorum?: string
          secreto?: boolean
          sessao_id?: string | null
          situacao?: string
          tipo_votacao?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_itens_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_itens_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "assembleia_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_opcoes: {
        Row: {
          descricao: string | null
          id: string
          item_id: string
          natureza: string
          ordem: number
          rotulo: string
        }
        Insert: {
          descricao?: string | null
          id?: string
          item_id: string
          natureza: string
          ordem: number
          rotulo: string
        }
        Update: {
          descricao?: string | null
          id?: string
          item_id?: string
          natureza?: string
          ordem?: number
          rotulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_opcoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assembleia_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_presencas: {
        Row: {
          assembleia_id: string
          checkin_em: string
          checkout_em: string | null
          condomino_id: string | null
          id: string
          ip: unknown
          origem: string
          representante_nome: string | null
          sessao_id: string
          tipo: string
          unidade_id: string
          user_agent: string | null
        }
        Insert: {
          assembleia_id: string
          checkin_em?: string
          checkout_em?: string | null
          condomino_id?: string | null
          id?: string
          ip?: unknown
          origem: string
          representante_nome?: string | null
          sessao_id: string
          tipo: string
          unidade_id: string
          user_agent?: string | null
        }
        Update: {
          assembleia_id?: string
          checkin_em?: string
          checkout_em?: string | null
          condomino_id?: string | null
          id?: string
          ip?: unknown
          origem?: string
          representante_nome?: string | null
          sessao_id?: string
          tipo?: string
          unidade_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_presencas_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_presencas_condomino_id_fkey"
            columns: ["condomino_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_presencas_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "assembleia_sessoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_presencas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_procuracoes: {
        Row: {
          arquivo_path: string | null
          assembleia_id: string
          created_at: string | null
          id: string
          motivo_recusa: string | null
          outorgado_condomino_id: string | null
          outorgado_documento: string | null
          outorgado_nome: string
          outorgado_tipo: string
          situacao: string
          unidade_outorgante_id: string
          validada_em: string | null
          validada_por: string | null
        }
        Insert: {
          arquivo_path?: string | null
          assembleia_id: string
          created_at?: string | null
          id?: string
          motivo_recusa?: string | null
          outorgado_condomino_id?: string | null
          outorgado_documento?: string | null
          outorgado_nome: string
          outorgado_tipo: string
          situacao?: string
          unidade_outorgante_id: string
          validada_em?: string | null
          validada_por?: string | null
        }
        Update: {
          arquivo_path?: string | null
          assembleia_id?: string
          created_at?: string | null
          id?: string
          motivo_recusa?: string | null
          outorgado_condomino_id?: string | null
          outorgado_documento?: string | null
          outorgado_nome?: string
          outorgado_tipo?: string
          situacao?: string
          unidade_outorgante_id?: string
          validada_em?: string | null
          validada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_procuracoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_procuracoes_outorgado_condomino_id_fkey"
            columns: ["outorgado_condomino_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_procuracoes_unidade_outorgante_id_fkey"
            columns: ["unidade_outorgante_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_resultados: {
        Row: {
          aprovado: boolean | null
          apurado_em: string
          apurado_por: string | null
          base_calculo: string
          empate: boolean
          hash_resultado: string
          id: string
          item_id: string
          quorum_atingido: number
          quorum_exigido: number
          total_aptos: number
          total_votantes: number
          vencedora_opcao_id: string | null
          votos: Json
        }
        Insert: {
          aprovado?: boolean | null
          apurado_em?: string
          apurado_por?: string | null
          base_calculo: string
          empate?: boolean
          hash_resultado: string
          id?: string
          item_id: string
          quorum_atingido: number
          quorum_exigido: number
          total_aptos: number
          total_votantes: number
          vencedora_opcao_id?: string | null
          votos: Json
        }
        Update: {
          aprovado?: boolean | null
          apurado_em?: string
          apurado_por?: string | null
          base_calculo?: string
          empate?: boolean
          hash_resultado?: string
          id?: string
          item_id?: string
          quorum_atingido?: number
          quorum_exigido?: number
          total_aptos?: number
          total_votantes?: number
          vencedora_opcao_id?: string | null
          votos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_resultados_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "assembleia_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_sessoes: {
        Row: {
          assembleia_id: string
          created_at: string | null
          data_hora_fim: string | null
          data_hora_inicio: string
          id: string
          local: string | null
          observacao: string | null
          ordem: number
          situacao: string
        }
        Insert: {
          assembleia_id: string
          created_at?: string | null
          data_hora_fim?: string | null
          data_hora_inicio: string
          id?: string
          local?: string | null
          observacao?: string | null
          ordem: number
          situacao?: string
        }
        Update: {
          assembleia_id?: string
          created_at?: string | null
          data_hora_fim?: string | null
          data_hora_inicio?: string
          id?: string
          local?: string | null
          observacao?: string | null
          ordem?: number
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_sessoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_sessoes_votante: {
        Row: {
          assembleia_id: string
          condomino_id: string | null
          confirmado_em: string | null
          created_at: string | null
          device_hash: string | null
          email: string
          id: string
          ip: unknown
          otp_expira_em: string | null
          otp_hash: string | null
          revogado: boolean
          tentativas_otp: number
          token_expira_em: string | null
          token_hash: string | null
          user_agent: string | null
        }
        Insert: {
          assembleia_id: string
          condomino_id?: string | null
          confirmado_em?: string | null
          created_at?: string | null
          device_hash?: string | null
          email: string
          id?: string
          ip?: unknown
          otp_expira_em?: string | null
          otp_hash?: string | null
          revogado?: boolean
          tentativas_otp?: number
          token_expira_em?: string | null
          token_hash?: string | null
          user_agent?: string | null
        }
        Update: {
          assembleia_id?: string
          condomino_id?: string | null
          confirmado_em?: string | null
          created_at?: string | null
          device_hash?: string | null
          email?: string
          id?: string
          ip?: unknown
          otp_expira_em?: string | null
          otp_hash?: string | null
          revogado?: boolean
          tentativas_otp?: number
          token_expira_em?: string | null
          token_hash?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_sessoes_votante_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_sessoes_votante_condomino_id_fkey"
            columns: ["condomino_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_tentativas: {
        Row: {
          assembleia_id: string
          criado_em: string
          detalhe: string | null
          email_tentativa: string | null
          id: string
          ip: unknown
          item_id: string | null
          motivo: string
          unidade_id: string | null
          user_agent: string | null
        }
        Insert: {
          assembleia_id: string
          criado_em?: string
          detalhe?: string | null
          email_tentativa?: string | null
          id?: string
          ip?: unknown
          item_id?: string | null
          motivo: string
          unidade_id?: string | null
          user_agent?: string | null
        }
        Update: {
          assembleia_id?: string
          criado_em?: string
          detalhe?: string | null
          email_tentativa?: string | null
          id?: string
          ip?: unknown
          item_id?: string | null
          motivo?: string
          unidade_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_tentativas_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_transcricoes: {
        Row: {
          created_at: string | null
          erro: string | null
          gravacao_id: string
          id: string
          modelo: string | null
          segmentos: Json | null
          status: string
          texto: string | null
        }
        Insert: {
          created_at?: string | null
          erro?: string | null
          gravacao_id: string
          id?: string
          modelo?: string | null
          segmentos?: Json | null
          status?: string
          texto?: string | null
        }
        Update: {
          created_at?: string | null
          erro?: string | null
          gravacao_id?: string
          id?: string
          modelo?: string | null
          segmentos?: Json | null
          status?: string
          texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_transcricoes_gravacao_id_fkey"
            columns: ["gravacao_id"]
            isOneToOne: true
            referencedRelation: "assembleia_gravacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_votos: {
        Row: {
          assembleia_id: string
          base_calculo: string
          criado_em: string
          device_hash: string | null
          hash_anterior: string | null
          hash_voto: string | null
          id: string
          invalidado_em: string | null
          invalidado_motivo: string | null
          invalidado_por: string | null
          ip: unknown
          item_id: string
          justificativa_manual: string | null
          lancado_por: string | null
          opcao_id: string
          origem: string
          peso: number
          recibo: string
          sequencia: number
          unidade_id: string | null
          user_agent: string | null
        }
        Insert: {
          assembleia_id: string
          base_calculo: string
          criado_em?: string
          device_hash?: string | null
          hash_anterior?: string | null
          hash_voto?: string | null
          id?: string
          invalidado_em?: string | null
          invalidado_motivo?: string | null
          invalidado_por?: string | null
          ip?: unknown
          item_id: string
          justificativa_manual?: string | null
          lancado_por?: string | null
          opcao_id: string
          origem: string
          peso: number
          recibo: string
          sequencia?: number
          unidade_id?: string | null
          user_agent?: string | null
        }
        Update: {
          assembleia_id?: string
          base_calculo?: string
          criado_em?: string
          device_hash?: string | null
          hash_anterior?: string | null
          hash_voto?: string | null
          id?: string
          invalidado_em?: string | null
          invalidado_motivo?: string | null
          invalidado_por?: string | null
          ip?: unknown
          item_id?: string
          justificativa_manual?: string | null
          lancado_por?: string | null
          opcao_id?: string
          origem?: string
          peso?: number
          recibo?: string
          sequencia?: number
          unidade_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_votos_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_votos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assembleia_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_votos_opcao_id_fkey"
            columns: ["opcao_id"]
            isOneToOne: false
            referencedRelation: "assembleia_opcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_votos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleia_votos_controle: {
        Row: {
          criado_minuto: string
          id: string
          item_id: string
          unidade_id: string
        }
        Insert: {
          criado_minuto: string
          id?: string
          item_id: string
          unidade_id: string
        }
        Update: {
          criado_minuto?: string
          id?: string
          item_id?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assembleia_votos_controle_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "assembleia_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assembleia_votos_controle_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      assembleias: {
        Row: {
          base_calculo_padrao: string
          bloqueia_inadimplente: boolean
          codigo_publico: string
          condominio_id: string
          convocacao_numero: number
          created_at: string | null
          criado_por: string
          data_hora: string
          edital_publicado_em: string | null
          edital_texto: string | null
          encerrada_em: string | null
          habilitacao_confirmada_em: string | null
          id: string
          instalada_em: string | null
          limite_procuracoes_por_outorgado: number
          link_videoconferencia: string | null
          local: string | null
          modalidade: string
          permite_voto_manual_mesa: boolean
          presidente_nome: string | null
          quorum_instalacao_1a: number
          quorum_instalacao_2a: number | null
          secretario_nome: string | null
          situacao: string
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          base_calculo_padrao?: string
          bloqueia_inadimplente?: boolean
          codigo_publico: string
          condominio_id: string
          convocacao_numero?: number
          created_at?: string | null
          criado_por?: string
          data_hora: string
          edital_publicado_em?: string | null
          edital_texto?: string | null
          encerrada_em?: string | null
          habilitacao_confirmada_em?: string | null
          id?: string
          instalada_em?: string | null
          limite_procuracoes_por_outorgado?: number
          link_videoconferencia?: string | null
          local?: string | null
          modalidade?: string
          permite_voto_manual_mesa?: boolean
          presidente_nome?: string | null
          quorum_instalacao_1a?: number
          quorum_instalacao_2a?: number | null
          secretario_nome?: string | null
          situacao?: string
          tipo: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          base_calculo_padrao?: string
          bloqueia_inadimplente?: boolean
          codigo_publico?: string
          condominio_id?: string
          convocacao_numero?: number
          created_at?: string | null
          criado_por?: string
          data_hora?: string
          edital_publicado_em?: string | null
          edital_texto?: string | null
          encerrada_em?: string | null
          habilitacao_confirmada_em?: string | null
          id?: string
          instalada_em?: string | null
          limite_procuracoes_por_outorgado?: number
          link_videoconferencia?: string | null
          local?: string | null
          modalidade?: string
          permite_voto_manual_mesa?: boolean
          presidente_nome?: string | null
          quorum_instalacao_1a?: number
          quorum_instalacao_2a?: number | null
          secretario_nome?: string | null
          situacao?: string
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assembleias_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_blocos: {
        Row: {
          confianca: number | null
          id: string
          item_id: string | null
          ordem: number
          origem_audio_fim: number | null
          origem_audio_inicio: number | null
          texto: string
          tipo: string
          versao_id: string
        }
        Insert: {
          confianca?: number | null
          id?: string
          item_id?: string | null
          ordem: number
          origem_audio_fim?: number | null
          origem_audio_inicio?: number | null
          texto: string
          tipo: string
          versao_id: string
        }
        Update: {
          confianca?: number | null
          id?: string
          item_id?: string | null
          ordem?: number
          origem_audio_fim?: number | null
          origem_audio_inicio?: number | null
          texto?: string
          tipo?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ata_blocos_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "ata_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_lacunas: {
        Row: {
          ancora_texto: string
          bloco_id: string | null
          descricao: string
          id: string
          preenchida_em: string | null
          preenchida_por: string | null
          referencia_audio_seg: number | null
          situacao: string
          sugestao: string | null
          tipo: string
          valor_preenchido: string | null
          versao_id: string
        }
        Insert: {
          ancora_texto: string
          bloco_id?: string | null
          descricao: string
          id?: string
          preenchida_em?: string | null
          preenchida_por?: string | null
          referencia_audio_seg?: number | null
          situacao?: string
          sugestao?: string | null
          tipo: string
          valor_preenchido?: string | null
          versao_id: string
        }
        Update: {
          ancora_texto?: string
          bloco_id?: string | null
          descricao?: string
          id?: string
          preenchida_em?: string | null
          preenchida_por?: string | null
          referencia_audio_seg?: number | null
          situacao?: string
          sugestao?: string | null
          tipo?: string
          valor_preenchido?: string | null
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ata_lacunas_bloco_id_fkey"
            columns: ["bloco_id"]
            isOneToOne: false
            referencedRelation: "ata_blocos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ata_lacunas_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "ata_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ata_versoes: {
        Row: {
          assembleia_id: string
          created_at: string | null
          criada_por: string | null
          gerada_por: string
          hash_publicacao: string | null
          id: string
          modelo: string | null
          numero: number
          pdf_path: string | null
          publicada_em: string | null
          publicada_por: string | null
          situacao: string
          texto_completo: string | null
        }
        Insert: {
          assembleia_id: string
          created_at?: string | null
          criada_por?: string | null
          gerada_por?: string
          hash_publicacao?: string | null
          id?: string
          modelo?: string | null
          numero: number
          pdf_path?: string | null
          publicada_em?: string | null
          publicada_por?: string | null
          situacao?: string
          texto_completo?: string | null
        }
        Update: {
          assembleia_id?: string
          created_at?: string | null
          criada_por?: string | null
          gerada_por?: string
          hash_publicacao?: string | null
          id?: string
          modelo?: string | null
          numero?: number
          pdf_path?: string | null
          publicada_em?: string | null
          publicada_por?: string | null
          situacao?: string
          texto_completo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ata_versoes_assembleia_id_fkey"
            columns: ["assembleia_id"]
            isOneToOne: false
            referencedRelation: "assembleias"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_rate_limits: {
        Row: {
          bloqueado_ate: string | null
          ip: string
          janela_inicio: string
          kind: string
          tentativas: number
        }
        Insert: {
          bloqueado_ate?: string | null
          ip: string
          janela_inicio?: string
          kind: string
          tentativas?: number
        }
        Update: {
          bloqueado_ate?: string | null
          ip?: string
          janela_inicio?: string
          kind?: string
          tentativas?: number
        }
        Relationships: []
      }
      blog_categorias: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          agendado_para: string | null
          autor_id: string | null
          capa_layout: string
          categoria_id: string | null
          conteudo_markdown: string | null
          created_at: string
          id: string
          imagem_capa: string | null
          meta_description: string | null
          publicado_em: string | null
          resumo: string | null
          slug: string
          status: Database["public"]["Enums"]["blog_status"]
          tags: string[]
          titulo: string
          updated_at: string
        }
        Insert: {
          agendado_para?: string | null
          autor_id?: string | null
          capa_layout?: string
          categoria_id?: string | null
          conteudo_markdown?: string | null
          created_at?: string
          id?: string
          imagem_capa?: string | null
          meta_description?: string | null
          publicado_em?: string | null
          resumo?: string | null
          slug: string
          status?: Database["public"]["Enums"]["blog_status"]
          tags?: string[]
          titulo: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string | null
          autor_id?: string | null
          capa_layout?: string
          categoria_id?: string | null
          conteudo_markdown?: string | null
          created_at?: string
          id?: string
          imagem_capa?: string | null
          meta_description?: string | null
          publicado_em?: string | null
          resumo?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["blog_status"]
          tags?: string[]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "blog_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      cancelamentos: {
        Row: {
          asaas_subscription_id: string | null
          created_at: string
          detalhes: string | null
          id: string
          motivo: string
          plano_config_id: string | null
          user_id: string
        }
        Insert: {
          asaas_subscription_id?: string | null
          created_at?: string
          detalhes?: string | null
          id?: string
          motivo: string
          plano_config_id?: string | null
          user_id: string
        }
        Update: {
          asaas_subscription_id?: string | null
          created_at?: string
          detalhes?: string | null
          id?: string
          motivo?: string
          plano_config_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      caucoes: {
        Row: {
          contrato_locacao_id: string
          corrige_com_rendimento: boolean
          created_at: string
          data_deposito: string | null
          id: string
          observacoes: string | null
          owner_admin_id: string
          possui: boolean
          tipo: string | null
          updated_at: string
          valor_atual_override: number | null
          valor_depositado: number | null
        }
        Insert: {
          contrato_locacao_id: string
          corrige_com_rendimento?: boolean
          created_at?: string
          data_deposito?: string | null
          id?: string
          observacoes?: string | null
          owner_admin_id?: string
          possui?: boolean
          tipo?: string | null
          updated_at?: string
          valor_atual_override?: number | null
          valor_depositado?: number | null
        }
        Update: {
          contrato_locacao_id?: string
          corrige_com_rendimento?: boolean
          created_at?: string
          data_deposito?: string | null
          id?: string
          observacoes?: string | null
          owner_admin_id?: string
          possui?: boolean
          tipo?: string | null
          updated_at?: string
          valor_atual_override?: number | null
          valor_depositado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "caucoes_contrato_locacao_id_fkey"
            columns: ["contrato_locacao_id"]
            isOneToOne: true
            referencedRelation: "contratos_locacao"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_cache: {
        Row: {
          condominio_id: string
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          last_hit_at: string | null
          pergunta: string
          pergunta_hash: string
          resposta: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          last_hit_at?: string | null
          pergunta: string
          pergunta_hash: string
          resposta: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          last_hit_at?: string | null
          pergunta?: string
          pergunta_hash?: string
          resposta?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_cache_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates_itens: {
        Row: {
          ativo: boolean
          base_legal: string | null
          created_at: string
          descricao: string
          id: string
          ordem: number
          tipo_checklist: string
          tipo_servico_slug: string | null
        }
        Insert: {
          ativo?: boolean
          base_legal?: string | null
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          tipo_checklist: string
          tipo_servico_slug?: string | null
        }
        Update: {
          ativo?: boolean
          base_legal?: string | null
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          tipo_checklist?: string
          tipo_servico_slug?: string | null
        }
        Relationships: []
      }
      cidades_cobertas: {
        Row: {
          cidade: string
          created_at: string
          id: string
          slug: string
          uf: string
        }
        Insert: {
          cidade: string
          created_at?: string
          id?: string
          slug: string
          uf: string
        }
        Update: {
          cidade?: string
          created_at?: string
          id?: string
          slug?: string
          uf?: string
        }
        Relationships: []
      }
      cidades_novas_alertas: {
        Row: {
          cidade: string
          created_at: string
          id: string
          owner_id: string | null
          primeiro_condominio_id: string | null
          resolvida_em: string | null
          slug: string
          status: string
          uf: string
        }
        Insert: {
          cidade: string
          created_at?: string
          id?: string
          owner_id?: string | null
          primeiro_condominio_id?: string | null
          resolvida_em?: string | null
          slug: string
          status?: string
          uf: string
        }
        Update: {
          cidade?: string
          created_at?: string
          id?: string
          owner_id?: string | null
          primeiro_condominio_id?: string | null
          resolvida_em?: string | null
          slug?: string
          status?: string
          uf?: string
        }
        Relationships: [
          {
            foreignKeyName: "cidades_novas_alertas_primeiro_condominio_id_fkey"
            columns: ["primeiro_condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_members: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          papel: Database["public"]["Enums"]["papel_condo_v2"]
          papel_no_condominio: Database["public"]["Enums"]["papel_condominio"]
          user_id: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_condo_v2"]
          papel_no_condominio?: Database["public"]["Enums"]["papel_condominio"]
          user_id: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_condo_v2"]
          papel_no_condominio?: Database["public"]["Enums"]["papel_condominio"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominio_members_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      condominios: {
        Row: {
          categoria: string
          cidade: string | null
          cnpj: string | null
          created_at: string
          endereco: string | null
          id: string
          nome: string
          owner_id: string
          qtd_unidades: number | null
          uf: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome: string
          owner_id: string
          qtd_unidades?: number | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          endereco?: string | null
          id?: string
          nome?: string
          owner_id?: string
          qtd_unidades?: number | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      condominos: {
        Row: {
          condominio_id: string
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          observacoes: string | null
          principal: boolean
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_condomino"]
          unidade_id: string
          updated_at: string
        }
        Insert: {
          condominio_id: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          principal?: boolean
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_condomino"]
          unidade_id: string
          updated_at?: string
        }
        Update: {
          condominio_id?: string
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          principal?: boolean
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_condomino"]
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominos_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condominos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      config_alertas: {
        Row: {
          credito_brl: number | null
          custo_storage_mb_brl: number
          id: number
          notificar_admin: boolean
          notificar_usuarios: boolean
          thresholds: number[]
          updated_at: string
        }
        Insert: {
          credito_brl?: number | null
          custo_storage_mb_brl?: number
          id?: number
          notificar_admin?: boolean
          notificar_usuarios?: boolean
          thresholds?: number[]
          updated_at?: string
        }
        Update: {
          credito_brl?: number | null
          custo_storage_mb_brl?: number
          id?: number
          notificar_admin?: boolean
          notificar_usuarios?: boolean
          thresholds?: number[]
          updated_at?: string
        }
        Relationships: []
      }
      contrato_aditivos: {
        Row: {
          altera_escopo: boolean
          altera_valor: boolean
          altera_vigencia: boolean
          arquivo_path: string | null
          contrato_id: string
          created_at: string
          criado_por: string
          data_assinatura: string | null
          data_fim_anterior: string | null
          documento_id: string | null
          id: string
          numero: string | null
          resumo_alteracoes: string | null
          updated_at: string
          valor_anterior: number | null
          valor_novo: number | null
          vigencia_nova_fim: string | null
        }
        Insert: {
          altera_escopo?: boolean
          altera_valor?: boolean
          altera_vigencia?: boolean
          arquivo_path?: string | null
          contrato_id: string
          created_at?: string
          criado_por?: string
          data_assinatura?: string | null
          data_fim_anterior?: string | null
          documento_id?: string | null
          id?: string
          numero?: string | null
          resumo_alteracoes?: string | null
          updated_at?: string
          valor_anterior?: number | null
          valor_novo?: number | null
          vigencia_nova_fim?: string | null
        }
        Update: {
          altera_escopo?: boolean
          altera_valor?: boolean
          altera_vigencia?: boolean
          arquivo_path?: string | null
          contrato_id?: string
          created_at?: string
          criado_por?: string
          data_assinatura?: string | null
          data_fim_anterior?: string | null
          documento_id?: string | null
          id?: string
          numero?: string | null
          resumo_alteracoes?: string | null
          updated_at?: string
          valor_anterior?: number | null
          valor_novo?: number | null
          vigencia_nova_fim?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_aditivos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_aditivos_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_auditoria: {
        Row: {
          acao: string
          condominio_id: string | null
          contrato_id: string | null
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string
          id: string
          user_id: string | null
        }
        Insert: {
          acao: string
          condominio_id?: string | null
          contrato_id?: string | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao: string
          id?: string
          user_id?: string | null
        }
        Update: {
          acao?: string
          condominio_id?: string | null
          contrato_id?: string | null
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contrato_auditoria_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_checklist_itens: {
        Row: {
          ativo: boolean
          base_legal: string | null
          checklist_id: string
          descricao: string
          id: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          base_legal?: string | null
          checklist_id: string
          descricao: string
          id?: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          base_legal?: string | null
          checklist_id?: string
          descricao?: string
          id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_checklist_itens_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "contrato_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_checklist_marcacoes: {
        Row: {
          id: string
          item_id: string
          marcado_em: string | null
          marcado_por: string | null
          observacao: string | null
          periodo_id: string
          situacao: string
        }
        Insert: {
          id?: string
          item_id: string
          marcado_em?: string | null
          marcado_por?: string | null
          observacao?: string | null
          periodo_id: string
          situacao?: string
        }
        Update: {
          id?: string
          item_id?: string
          marcado_em?: string | null
          marcado_por?: string | null
          observacao?: string | null
          periodo_id?: string
          situacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_checklist_marcacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "contrato_checklist_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contrato_checklist_marcacoes_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "contrato_checklist_periodos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_checklist_periodos: {
        Row: {
          checklist_id: string
          competencia: string
          id: string
          status: string
        }
        Insert: {
          checklist_id: string
          competencia: string
          id?: string
          status?: string
        }
        Update: {
          checklist_id?: string
          competencia?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_checklist_periodos_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "contrato_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_checklists: {
        Row: {
          ativo: boolean
          contrato_id: string
          created_at: string
          id: string
          tipo: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          contrato_id: string
          created_at?: string
          id?: string
          tipo: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          contrato_id?: string
          created_at?: string
          id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_checklists_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_eventos: {
        Row: {
          antecedencia_dias: number | null
          competencia: string | null
          contrato_id: string
          created_at: string
          criado_por: string | null
          data_evento: string
          descricao: string | null
          id: string
          notificado_em: string | null
          origem: string
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          antecedencia_dias?: number | null
          competencia?: string | null
          contrato_id: string
          created_at?: string
          criado_por?: string | null
          data_evento: string
          descricao?: string | null
          id?: string
          notificado_em?: string | null
          origem?: string
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          antecedencia_dias?: number | null
          competencia?: string | null
          contrato_id?: string
          created_at?: string
          criado_por?: string | null
          data_evento?: string
          descricao?: string | null
          id?: string
          notificado_em?: string | null
          origem?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_eventos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_obrigacoes: {
        Row: {
          clausula_origem: string | null
          contrato_id: string
          created_at: string
          descricao: string
          id: string
          ordem: number
          origem: string
          parte: string
          periodicidade: string
          updated_at: string
        }
        Insert: {
          clausula_origem?: string | null
          contrato_id: string
          created_at?: string
          descricao: string
          id?: string
          ordem?: number
          origem?: string
          parte: string
          periodicidade?: string
          updated_at?: string
        }
        Update: {
          clausula_origem?: string | null
          contrato_id?: string
          created_at?: string
          descricao?: string
          id?: string
          ordem?: number
          origem?: string
          parte?: string
          periodicidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_obrigacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_reajustes: {
        Row: {
          aplicado_por: string
          competencia: string
          contrato_id: string
          created_at: string
          fonte: string
          id: string
          indice_utilizado: string
          observacao: string | null
          percentual_aplicado: number
          percentual_indice: number | null
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          aplicado_por?: string
          competencia: string
          contrato_id: string
          created_at?: string
          fonte?: string
          id?: string
          indice_utilizado: string
          observacao?: string | null
          percentual_aplicado: number
          percentual_indice?: number | null
          valor_anterior: number
          valor_novo: number
        }
        Update: {
          aplicado_por?: string
          competencia?: string
          contrato_id?: string
          created_at?: string
          fonte?: string
          id?: string
          indice_utilizado?: string
          observacao?: string | null
          percentual_aplicado?: number
          percentual_indice?: number | null
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "contrato_reajustes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_responsaveis: {
        Row: {
          contrato_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          contrato_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          contrato_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_responsaveis_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_administracao: {
        Row: {
          administrador_documento: string | null
          administrador_nome: string | null
          administrador_oab: string | null
          agencia_recebimento: string | null
          arquivo_contrato_url: string | null
          banco_recebimento: string | null
          conta_recebimento: string | null
          created_at: string
          data_inicio: string | null
          id: string
          mora_indice: string
          mora_juros_mensal_percent: number
          mora_multa_percent: number
          owner_admin_id: string
          percent_honorario_mensal: number
          percent_honorario_renovacao: number
          pix_recebimento: string | null
          prazo_meses: number
          proprietario_id: string
          status: string
          updated_at: string
        }
        Insert: {
          administrador_documento?: string | null
          administrador_nome?: string | null
          administrador_oab?: string | null
          agencia_recebimento?: string | null
          arquivo_contrato_url?: string | null
          banco_recebimento?: string | null
          conta_recebimento?: string | null
          created_at?: string
          data_inicio?: string | null
          id?: string
          mora_indice?: string
          mora_juros_mensal_percent?: number
          mora_multa_percent?: number
          owner_admin_id?: string
          percent_honorario_mensal?: number
          percent_honorario_renovacao?: number
          pix_recebimento?: string | null
          prazo_meses?: number
          proprietario_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          administrador_documento?: string | null
          administrador_nome?: string | null
          administrador_oab?: string | null
          agencia_recebimento?: string | null
          arquivo_contrato_url?: string | null
          banco_recebimento?: string | null
          conta_recebimento?: string | null
          created_at?: string
          data_inicio?: string | null
          id?: string
          mora_indice?: string
          mora_juros_mensal_percent?: number
          mora_multa_percent?: number
          owner_admin_id?: string
          percent_honorario_mensal?: number
          percent_honorario_renovacao?: number
          pix_recebimento?: string | null
          prazo_meses?: number
          proprietario_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contratos_administracao_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "proprietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_locacao: {
        Row: {
          arquivo_contrato_url: string | null
          aviso_previo_dias: number
          created_at: string
          data_contrato_original: string | null
          data_fim_vigencia: string | null
          data_inicio_vigencia: string | null
          data_renovacao: string | null
          dia_vencimento: number | null
          encargos_inquilino: Json
          foro: string | null
          historico_renovacoes: Json
          id: string
          imovel_id: string
          indice_reajuste: string
          inquilino_cpf: string | null
          inquilino_email: string | null
          inquilino_endereco: string | null
          inquilino_estado_civil: string | null
          inquilino_nome: string | null
          inquilino_profissao: string | null
          inquilino_rg: string | null
          inquilino_telefone: string | null
          juros_mora_mensal_percent: number
          mes_base_reajuste: number | null
          multa_mora_percent: number
          multa_rescisoria_multiplicador: number
          multa_rescisoria_proporcional: boolean
          owner_admin_id: string
          periodicidade_reajuste_meses: number
          prazo_meses: number | null
          status: string
          updated_at: string
          valor_aluguel: number | null
          valor_aluguel_inicial: number | null
        }
        Insert: {
          arquivo_contrato_url?: string | null
          aviso_previo_dias?: number
          created_at?: string
          data_contrato_original?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          data_renovacao?: string | null
          dia_vencimento?: number | null
          encargos_inquilino?: Json
          foro?: string | null
          historico_renovacoes?: Json
          id?: string
          imovel_id: string
          indice_reajuste?: string
          inquilino_cpf?: string | null
          inquilino_email?: string | null
          inquilino_endereco?: string | null
          inquilino_estado_civil?: string | null
          inquilino_nome?: string | null
          inquilino_profissao?: string | null
          inquilino_rg?: string | null
          inquilino_telefone?: string | null
          juros_mora_mensal_percent?: number
          mes_base_reajuste?: number | null
          multa_mora_percent?: number
          multa_rescisoria_multiplicador?: number
          multa_rescisoria_proporcional?: boolean
          owner_admin_id?: string
          periodicidade_reajuste_meses?: number
          prazo_meses?: number | null
          status?: string
          updated_at?: string
          valor_aluguel?: number | null
          valor_aluguel_inicial?: number | null
        }
        Update: {
          arquivo_contrato_url?: string | null
          aviso_previo_dias?: number
          created_at?: string
          data_contrato_original?: string | null
          data_fim_vigencia?: string | null
          data_inicio_vigencia?: string | null
          data_renovacao?: string | null
          dia_vencimento?: number | null
          encargos_inquilino?: Json
          foro?: string | null
          historico_renovacoes?: Json
          id?: string
          imovel_id?: string
          indice_reajuste?: string
          inquilino_cpf?: string | null
          inquilino_email?: string | null
          inquilino_endereco?: string | null
          inquilino_estado_civil?: string | null
          inquilino_nome?: string | null
          inquilino_profissao?: string | null
          inquilino_rg?: string | null
          inquilino_telefone?: string | null
          juros_mora_mensal_percent?: number
          mes_base_reajuste?: number | null
          multa_mora_percent?: number
          multa_rescisoria_multiplicador?: number
          multa_rescisoria_proporcional?: boolean
          owner_admin_id?: string
          periodicidade_reajuste_meses?: number
          prazo_meses?: number | null
          status?: string
          updated_at?: string
          valor_aluguel?: number | null
          valor_aluguel_inicial?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_locacao_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_servico: {
        Row: {
          analise_em: string | null
          analise_resultado: Json | null
          arquivo_path: string | null
          aviso_previo_dias: number | null
          condominio_id: string
          created_at: string
          criado_por: string
          data_fim: string | null
          data_inicio: string | null
          dia_vencimento: number | null
          documento_id: string | null
          encerrado_em: string | null
          exige_seguro_rc: boolean
          foro: string | null
          garantias: string | null
          id: string
          indice_reajuste: string | null
          mes_base_reajuste: number | null
          motivo_encerramento: string | null
          multa_rescisoria: string | null
          notificacoes_ativas: boolean
          objeto: string | null
          prazo_indeterminado: boolean
          prestador_documento: string | null
          prestador_email: string | null
          prestador_nome: string
          prestador_telefone: string | null
          renovacao_automatica: boolean
          situacao: string
          terceirizacao_mao_de_obra: boolean
          tipo_servico_id: string | null
          tipo_valor: string
          ultimo_reajuste_em: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          analise_em?: string | null
          analise_resultado?: Json | null
          arquivo_path?: string | null
          aviso_previo_dias?: number | null
          condominio_id: string
          created_at?: string
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          documento_id?: string | null
          encerrado_em?: string | null
          exige_seguro_rc?: boolean
          foro?: string | null
          garantias?: string | null
          id?: string
          indice_reajuste?: string | null
          mes_base_reajuste?: number | null
          motivo_encerramento?: string | null
          multa_rescisoria?: string | null
          notificacoes_ativas?: boolean
          objeto?: string | null
          prazo_indeterminado?: boolean
          prestador_documento?: string | null
          prestador_email?: string | null
          prestador_nome: string
          prestador_telefone?: string | null
          renovacao_automatica?: boolean
          situacao?: string
          terceirizacao_mao_de_obra?: boolean
          tipo_servico_id?: string | null
          tipo_valor?: string
          ultimo_reajuste_em?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          analise_em?: string | null
          analise_resultado?: Json | null
          arquivo_path?: string | null
          aviso_previo_dias?: number | null
          condominio_id?: string
          created_at?: string
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_vencimento?: number | null
          documento_id?: string | null
          encerrado_em?: string | null
          exige_seguro_rc?: boolean
          foro?: string | null
          garantias?: string | null
          id?: string
          indice_reajuste?: string | null
          mes_base_reajuste?: number | null
          motivo_encerramento?: string | null
          multa_rescisoria?: string | null
          notificacoes_ativas?: boolean
          objeto?: string | null
          prazo_indeterminado?: boolean
          prestador_documento?: string | null
          prestador_email?: string | null
          prestador_nome?: string
          prestador_telefone?: string | null
          renovacao_automatica?: boolean
          situacao?: string
          terceirizacao_mao_de_obra?: boolean
          tipo_servico_id?: string | null
          tipo_valor?: string
          ultimo_reajuste_em?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_servico_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_servico_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_servico_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico_contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          origem: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          origem?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          origem?: string
        }
        Relationships: []
      }
      conversas: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          skill_ativa: string | null
          titulo: string | null
          user_id: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          skill_ativa?: string | null
          titulo?: string | null
          user_id: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          skill_ativa?: string | null
          titulo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      creditos_avulsos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          preco: number
          quantidade_mensagens: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id: string
          nome: string
          ordem?: number
          preco: number
          quantidade_mensagens: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          preco?: number
          quantidade_mensagens?: number
        }
        Relationships: []
      }
      custos_cliente_mensal: {
        Row: {
          created_at: string
          custo_embeddings: number
          custo_storage: number
          custo_tokens_openai: number
          id: string
          margem_estimada: number
          mes_ano: string
          total_mensagens: number
          total_tokens_input: number
          total_tokens_output: number
          user_id: string
        }
        Insert: {
          created_at?: string
          custo_embeddings?: number
          custo_storage?: number
          custo_tokens_openai?: number
          id?: string
          margem_estimada?: number
          mes_ano: string
          total_mensagens?: number
          total_tokens_input?: number
          total_tokens_output?: number
          user_id: string
        }
        Update: {
          created_at?: string
          custo_embeddings?: number
          custo_storage?: number
          custo_tokens_openai?: number
          id?: string
          margem_estimada?: number
          mes_ano?: string
          total_mensagens?: number
          total_tokens_input?: number
          total_tokens_output?: number
          user_id?: string
        }
        Relationships: []
      }
      demo_chat_usage: {
        Row: {
          count: number
          first_at: string
          ip: string
          last_at: string
        }
        Insert: {
          count?: number
          first_at?: string
          ip: string
          last_at?: string
        }
        Update: {
          count?: number
          first_at?: string
          ip?: string
          last_at?: string
        }
        Relationships: []
      }
      despesas: {
        Row: {
          automatica: boolean
          categoria: string
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          id: string
          metadata: Json
          owner_admin_id: string | null
          periodicidade: string
          recorrente: boolean
          updated_at: string
          valor: number
        }
        Insert: {
          automatica?: boolean
          categoria: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao: string
          id?: string
          metadata?: Json
          owner_admin_id?: string | null
          periodicidade?: string
          recorrente?: boolean
          updated_at?: string
          valor: number
        }
        Update: {
          automatica?: boolean
          categoria?: string
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          metadata?: Json
          owner_admin_id?: string | null
          periodicidade?: string
          recorrente?: boolean
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      dicas_sistema: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          ordem: number
          texto: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          ordem?: number
          texto: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          ordem?: number
          texto?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          condominio_id: string
          conteudo: string
          created_at: string
          documento_id: string
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          condominio_id: string
          conteudo: string
          created_at?: string
          documento_id: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          condominio_id?: string
          conteudo?: string
          created_at?: string
          documento_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_chunks_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          nome_arquivo: string
          status_processamento: string
          storage_path: string
          tipo: Database["public"]["Enums"]["tipo_documento"]
          titulo: string | null
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          status_processamento?: string
          storage_path: string
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          titulo?: string | null
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          status_processamento?: string
          storage_path?: string
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      eventos_ia: {
        Row: {
          aig_log_id: string | null
          aig_run_id: string | null
          condominio_id: string | null
          created_at: string
          creditos_lovable: number
          custo_brl: number
          id: string
          meta: Json | null
          model: string | null
          origem: string
          tokens_input: number
          tokens_output: number
          user_id: string | null
        }
        Insert: {
          aig_log_id?: string | null
          aig_run_id?: string | null
          condominio_id?: string | null
          created_at?: string
          creditos_lovable?: number
          custo_brl?: number
          id?: string
          meta?: Json | null
          model?: string | null
          origem: string
          tokens_input?: number
          tokens_output?: number
          user_id?: string | null
        }
        Update: {
          aig_log_id?: string | null
          aig_run_id?: string | null
          condominio_id?: string | null
          created_at?: string
          creditos_lovable?: number
          custo_brl?: number
          id?: string
          meta?: Json | null
          model?: string | null
          origem?: string
          tokens_input?: number
          tokens_output?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_ia_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_mensagens: {
        Row: {
          anexos: Json
          autor_tipo: Database["public"]["Enums"]["helpdesk_autor"]
          autor_user_id: string
          conteudo: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          anexos?: Json
          autor_tipo: Database["public"]["Enums"]["helpdesk_autor"]
          autor_user_id: string
          conteudo: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          anexos?: Json
          autor_tipo?: Database["public"]["Enums"]["helpdesk_autor"]
          autor_user_id?: string
          conteudo?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "helpdesk_mensagens_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "helpdesk_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      helpdesk_tickets: {
        Row: {
          assunto: Database["public"]["Enums"]["helpdesk_assunto"]
          created_at: string
          encerrado_em: string | null
          encerrado_por: Database["public"]["Enums"]["helpdesk_autor"] | null
          id: string
          last_admin_notified_at: string
          protocolo: string
          status: Database["public"]["Enums"]["helpdesk_status"]
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto: Database["public"]["Enums"]["helpdesk_assunto"]
          created_at?: string
          encerrado_em?: string | null
          encerrado_por?: Database["public"]["Enums"]["helpdesk_autor"] | null
          id?: string
          last_admin_notified_at?: string
          protocolo: string
          status?: Database["public"]["Enums"]["helpdesk_status"]
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: Database["public"]["Enums"]["helpdesk_assunto"]
          created_at?: string
          encerrado_em?: string | null
          encerrado_por?: Database["public"]["Enums"]["helpdesk_autor"] | null
          id?: string
          last_admin_notified_at?: string
          protocolo?: string
          status?: Database["public"]["Enums"]["helpdesk_status"]
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      honorarios: {
        Row: {
          base_calculo: number | null
          competencia: string | null
          contrato_administracao_id: string
          contrato_locacao_id: string | null
          created_at: string
          data_pagamento: string | null
          id: string
          observacoes: string | null
          owner_admin_id: string
          pago: boolean
          percentual: number | null
          tipo: string
          updated_at: string
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          base_calculo?: number | null
          competencia?: string | null
          contrato_administracao_id: string
          contrato_locacao_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          owner_admin_id?: string
          pago?: boolean
          percentual?: number | null
          tipo: string
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          base_calculo?: number | null
          competencia?: string | null
          contrato_administracao_id?: string
          contrato_locacao_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          observacoes?: string | null
          owner_admin_id?: string
          pago?: boolean
          percentual?: number | null
          tipo?: string
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "honorarios_contrato_administracao_id_fkey"
            columns: ["contrato_administracao_id"]
            isOneToOne: false
            referencedRelation: "contratos_administracao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "honorarios_contrato_locacao_id_fkey"
            columns: ["contrato_locacao_id"]
            isOneToOne: false
            referencedRelation: "contratos_locacao"
            referencedColumns: ["id"]
          },
        ]
      }
      imoveis: {
        Row: {
          area: number | null
          bloco: string | null
          cep: string | null
          cidade: string | null
          created_at: string
          descricao: string | null
          edificio: string | null
          endereco: string | null
          id: string
          matricula: string | null
          numero_unidade: string | null
          observacoes: string | null
          owner_admin_id: string
          proprietario_id: string
          quartos: number | null
          uf: string | null
          updated_at: string
          vaga_garagem: boolean
        }
        Insert: {
          area?: number | null
          bloco?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          descricao?: string | null
          edificio?: string | null
          endereco?: string | null
          id?: string
          matricula?: string | null
          numero_unidade?: string | null
          observacoes?: string | null
          owner_admin_id?: string
          proprietario_id: string
          quartos?: number | null
          uf?: string | null
          updated_at?: string
          vaga_garagem?: boolean
        }
        Update: {
          area?: number | null
          bloco?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          descricao?: string | null
          edificio?: string | null
          endereco?: string | null
          id?: string
          matricula?: string | null
          numero_unidade?: string | null
          observacoes?: string | null
          owner_admin_id?: string
          proprietario_id?: string
          quartos?: number | null
          uf?: string | null
          updated_at?: string
          vaga_garagem?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "imoveis_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "proprietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      indices_bcb_cache: {
        Row: {
          ano: number
          fetched_at: string
          id: string
          mes: number
          serie: number
          valor: number
        }
        Insert: {
          ano: number
          fetched_at?: string
          id?: string
          mes: number
          serie: number
          valor: number
        }
        Update: {
          ano?: number
          fetched_at?: string
          id?: string
          mes?: number
          serie?: number
          valor?: number
        }
        Relationships: []
      }
      kb_chunks: {
        Row: {
          conteudo: string
          created_at: string
          embedding: string | null
          id: string
          kb_documento_id: string
          metadata: Json
        }
        Insert: {
          conteudo: string
          created_at?: string
          embedding?: string | null
          id?: string
          kb_documento_id: string
          metadata?: Json
        }
        Update: {
          conteudo?: string
          created_at?: string
          embedding?: string | null
          id?: string
          kb_documento_id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_kb_documento_id_fkey"
            columns: ["kb_documento_id"]
            isOneToOne: false
            referencedRelation: "kb_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documentos: {
        Row: {
          conteudo_bruto: string | null
          created_at: string
          created_by: string
          fonte: string | null
          id: string
          status_processamento: string
          storage_path: string | null
          tipo: Database["public"]["Enums"]["kb_tipo"]
          titulo: string
          updated_at: string
          url: string | null
        }
        Insert: {
          conteudo_bruto?: string | null
          created_at?: string
          created_by: string
          fonte?: string | null
          id?: string
          status_processamento?: string
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["kb_tipo"]
          titulo: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          conteudo_bruto?: string | null
          created_at?: string
          created_by?: string
          fonte?: string | null
          id?: string
          status_processamento?: string
          storage_path?: string | null
          tipo?: Database["public"]["Enums"]["kb_tipo"]
          titulo?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      manutencoes: {
        Row: {
          anexos: Json
          created_at: string
          custo_estimado: number | null
          custo_final: number | null
          data_conclusao: string | null
          data_solicitacao: string
          descricao: string | null
          id: string
          imovel_id: string
          owner_admin_id: string
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          anexos?: Json
          created_at?: string
          custo_estimado?: number | null
          custo_final?: number | null
          data_conclusao?: string | null
          data_solicitacao?: string
          descricao?: string | null
          id?: string
          imovel_id: string
          owner_admin_id?: string
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          anexos?: Json
          created_at?: string
          custo_estimado?: number | null
          custo_final?: number | null
          data_conclusao?: string | null
          data_solicitacao?: string
          descricao?: string | null
          id?: string
          imovel_id?: string
          owner_admin_id?: string
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manutencoes_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          creditos_lovable: number | null
          id: string
          model_usado: string | null
          papel: Database["public"]["Enums"]["papel_mensagem"]
          tokens_input: number | null
          tokens_output: number | null
          tokens_usados: number | null
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          creditos_lovable?: number | null
          id?: string
          model_usado?: string | null
          papel: Database["public"]["Enums"]["papel_mensagem"]
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_usados?: number | null
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          creditos_lovable?: number | null
          id?: string
          model_usado?: string | null
          papel?: Database["public"]["Enums"]["papel_mensagem"]
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_usados?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      model_pricing: {
        Row: {
          ativo: boolean
          credits_per_input_token: number
          credits_per_output_token: number
          model: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          credits_per_input_token?: number
          credits_per_output_token?: number
          model: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          credits_per_input_token?: number
          credits_per_output_token?: number
          model?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacoes: {
        Row: {
          categoria: string
          contrato_id: string | null
          created_at: string
          evento_id: string | null
          id: string
          lida_em: string | null
          mensagem: string | null
          titulo: string
          url_destino: string | null
          user_id: string
        }
        Insert: {
          categoria?: string
          contrato_id?: string | null
          created_at?: string
          evento_id?: string | null
          id?: string
          lida_em?: string | null
          mensagem?: string | null
          titulo: string
          url_destino?: string | null
          user_id: string
        }
        Update: {
          categoria?: string
          contrato_id?: string | null
          created_at?: string
          evento_id?: string | null
          id?: string
          lida_em?: string | null
          mensagem?: string | null
          titulo?: string
          url_destino?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "contrato_eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos: {
        Row: {
          competencia: string | null
          contrato_locacao_id: string
          created_at: string
          data_pagamento: string | null
          desconto: number
          id: string
          observacoes: string | null
          owner_admin_id: string
          pago: boolean
          tipo: string
          updated_at: string
          valor: number | null
          vencimento: string | null
        }
        Insert: {
          competencia?: string | null
          contrato_locacao_id: string
          created_at?: string
          data_pagamento?: string | null
          desconto?: number
          id?: string
          observacoes?: string | null
          owner_admin_id?: string
          pago?: boolean
          tipo: string
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Update: {
          competencia?: string | null
          contrato_locacao_id?: string
          created_at?: string
          data_pagamento?: string | null
          desconto?: number
          id?: string
          observacoes?: string | null
          owner_admin_id?: string
          pago?: boolean
          tipo?: string
          updated_at?: string
          valor?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_contrato_locacao_id_fkey"
            columns: ["contrato_locacao_id"]
            isOneToOne: false
            referencedRelation: "contratos_locacao"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          features: string[]
          id: string
          limite_condominios: number | null
          limite_mensagens_mes: number | null
          limite_storage_mb: number | null
          limite_usuarios: number | null
          nome: string
          ordem: number
          preco_mensal: number | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          features?: string[]
          id: string
          limite_condominios?: number | null
          limite_mensagens_mes?: number | null
          limite_storage_mb?: number | null
          limite_usuarios?: number | null
          nome: string
          ordem?: number
          preco_mensal?: number | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          features?: string[]
          id?: string
          limite_condominios?: number | null
          limite_mensagens_mes?: number | null
          limite_storage_mb?: number | null
          limite_usuarios?: number | null
          nome?: string
          ordem?: number
          preco_mensal?: number | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          convidado_por: string | null
          cpf_cnpj: string | null
          created_at: string
          dicas_ativas: boolean
          email: string | null
          id: string
          lgpd_aceite_em: string | null
          marketing_opt_in: boolean
          nome: string | null
          oab: string | null
          onboarding_completo: boolean
          onboarding_tour_completo: boolean
          papel_sistema: Database["public"]["Enums"]["papel_sistema"]
          perfil_atuacao: Database["public"]["Enums"]["perfil_atuacao"] | null
          razao_social: string | null
          telefone: string | null
          termos_aceitos_em: string | null
          termos_ip: string | null
          termos_versao: string | null
          tipo_pessoa: Database["public"]["Enums"]["tipo_pessoa"] | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          convidado_por?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dicas_ativas?: boolean
          email?: string | null
          id: string
          lgpd_aceite_em?: string | null
          marketing_opt_in?: boolean
          nome?: string | null
          oab?: string | null
          onboarding_completo?: boolean
          onboarding_tour_completo?: boolean
          papel_sistema?: Database["public"]["Enums"]["papel_sistema"]
          perfil_atuacao?: Database["public"]["Enums"]["perfil_atuacao"] | null
          razao_social?: string | null
          telefone?: string | null
          termos_aceitos_em?: string | null
          termos_ip?: string | null
          termos_versao?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"] | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          convidado_por?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          dicas_ativas?: boolean
          email?: string | null
          id?: string
          lgpd_aceite_em?: string | null
          marketing_opt_in?: boolean
          nome?: string | null
          oab?: string | null
          onboarding_completo?: boolean
          onboarding_tour_completo?: boolean
          papel_sistema?: Database["public"]["Enums"]["papel_sistema"]
          perfil_atuacao?: Database["public"]["Enums"]["perfil_atuacao"] | null
          razao_social?: string | null
          telefone?: string | null
          termos_aceitos_em?: string | null
          termos_ip?: string | null
          termos_versao?: string | null
          tipo_pessoa?: Database["public"]["Enums"]["tipo_pessoa"] | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietarios: {
        Row: {
          agencia: string | null
          banco: string | null
          conta: string | null
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          estado_civil: string | null
          id: string
          nome: string
          observacoes: string | null
          owner_admin_id: string
          pix: string | null
          profissao: string | null
          rg: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          owner_admin_id?: string
          pix?: string | null
          profissao?: string | null
          rg?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          owner_admin_id?: string
          pix?: string | null
          profissao?: string | null
          rg?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reajustes: {
        Row: {
          contrato_locacao_id: string
          created_at: string
          data: string
          id: string
          indice_usado: string
          observacoes: string | null
          owner_admin_id: string
          percentual: number
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          contrato_locacao_id: string
          created_at?: string
          data?: string
          id?: string
          indice_usado: string
          observacoes?: string | null
          owner_admin_id: string
          percentual: number
          valor_anterior: number
          valor_novo: number
        }
        Update: {
          contrato_locacao_id?: string
          created_at?: string
          data?: string
          id?: string
          indice_usado?: string
          observacoes?: string | null
          owner_admin_id?: string
          percentual?: number
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: [
          {
            foreignKeyName: "reajustes_contrato_locacao_id_fkey"
            columns: ["contrato_locacao_id"]
            isOneToOne: false
            referencedRelation: "contratos_locacao"
            referencedColumns: ["id"]
          },
        ]
      }
      retencoes_config: {
        Row: {
          aliquota_referencia: string | null
          ativo_padrao: boolean
          base_legal: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          slug: string
        }
        Insert: {
          aliquota_referencia?: string | null
          ativo_padrao?: boolean
          base_legal?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          slug: string
        }
        Update: {
          aliquota_referencia?: string | null
          ativo_padrao?: boolean
          base_legal?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          slug?: string
        }
        Relationships: []
      }
      solicitacoes_exclusao_conta: {
        Row: {
          confirmado_em: string | null
          excluir_em: string | null
          id: string
          ip: string | null
          solicitado_em: string
          status: string
          suspende_em: string | null
          token_confirmacao: string
          user_id: string
        }
        Insert: {
          confirmado_em?: string | null
          excluir_em?: string | null
          id?: string
          ip?: string | null
          solicitado_em?: string
          status?: string
          suspende_em?: string | null
          token_confirmacao?: string
          user_id: string
        }
        Update: {
          confirmado_em?: string | null
          excluir_em?: string | null
          id?: string
          ip?: string | null
          solicitado_em?: string
          status?: string
          suspende_em?: string | null
          token_confirmacao?: string
          user_id?: string
        }
        Relationships: []
      }
      solicitacoes_exportacao: {
        Row: {
          entregue_em: string | null
          id: string
          solicitado_em: string
          status: string
          user_id: string
        }
        Insert: {
          entregue_em?: string | null
          id?: string
          solicitado_em?: string
          status?: string
          user_id: string
        }
        Update: {
          entregue_em?: string | null
          id?: string
          solicitado_em?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_ambiente: string | null
          asaas_billing_type: string | null
          asaas_ciclo: string | null
          asaas_customer_id: string | null
          asaas_payment_url: string | null
          asaas_status: string | null
          asaas_subscription_id: string | null
          cancelado_em: string | null
          cancelamento_motivo: string | null
          cortesia: boolean
          cortesia_concedida_por: string | null
          cortesia_observacao: string | null
          created_at: string
          creditos_mensagens_extras: number
          current_period_end: string | null
          id: string
          overdue_desde: string | null
          pending_desde: string | null
          pending_plano_config_id: string | null
          plano: Database["public"]["Enums"]["plano_assinatura"] | null
          plano_config_id: string
          plano_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          suspenso_em: string | null
          tipo_assinatura: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_ambiente?: string | null
          asaas_billing_type?: string | null
          asaas_ciclo?: string | null
          asaas_customer_id?: string | null
          asaas_payment_url?: string | null
          asaas_status?: string | null
          asaas_subscription_id?: string | null
          cancelado_em?: string | null
          cancelamento_motivo?: string | null
          cortesia?: boolean
          cortesia_concedida_por?: string | null
          cortesia_observacao?: string | null
          created_at?: string
          creditos_mensagens_extras?: number
          current_period_end?: string | null
          id?: string
          overdue_desde?: string | null
          pending_desde?: string | null
          pending_plano_config_id?: string | null
          plano?: Database["public"]["Enums"]["plano_assinatura"] | null
          plano_config_id?: string
          plano_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspenso_em?: string | null
          tipo_assinatura?: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_ambiente?: string | null
          asaas_billing_type?: string | null
          asaas_ciclo?: string | null
          asaas_customer_id?: string | null
          asaas_payment_url?: string | null
          asaas_status?: string | null
          asaas_subscription_id?: string | null
          cancelado_em?: string | null
          cancelamento_motivo?: string | null
          cortesia?: boolean
          cortesia_concedida_por?: string | null
          cortesia_observacao?: string | null
          created_at?: string
          creditos_mensagens_extras?: number
          current_period_end?: string | null
          id?: string
          overdue_desde?: string | null
          pending_desde?: string | null
          pending_plano_config_id?: string | null
          plano?: Database["public"]["Enums"]["plano_assinatura"] | null
          plano_config_id?: string
          plano_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          suspenso_em?: string | null
          tipo_assinatura?: string
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_cortesia_concedida_por_fkey"
            columns: ["cortesia_concedida_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      sugestoes_unidades: {
        Row: {
          condominio_id: string
          created_at: string
          documento_id: string | null
          id: string
          payload: Json
          status: string
          updated_at: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          documento_id?: string | null
          id?: string
          payload: Json
          status?: string
          updated_at?: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          documento_id?: string | null
          id?: string
          payload?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sugestoes_unidades_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sugestoes_unidades_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tipos_servico_contrato: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
          terceirizacao_padrao: boolean
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
          terceirizacao_padrao?: boolean
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          terceirizacao_padrao?: boolean
        }
        Relationships: []
      }
      tipos_servico_retencoes: {
        Row: {
          aplica_por_padrao: boolean
          observacao: string | null
          retencao_id: string
          tipo_servico_id: string
        }
        Insert: {
          aplica_por_padrao?: boolean
          observacao?: string | null
          retencao_id: string
          tipo_servico_id: string
        }
        Update: {
          aplica_por_padrao?: boolean
          observacao?: string | null
          retencao_id?: string
          tipo_servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tipos_servico_retencoes_retencao_id_fkey"
            columns: ["retencao_id"]
            isOneToOne: false
            referencedRelation: "retencoes_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tipos_servico_retencoes_tipo_servico_id_fkey"
            columns: ["tipo_servico_id"]
            isOneToOne: false
            referencedRelation: "tipos_servico_contrato"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          area_m2: number | null
          bloco: string | null
          condominio_id: string
          created_at: string
          fracao_ideal: number | null
          id: string
          numero: string
          observacoes: string | null
          tipo: Database["public"]["Enums"]["tipo_unidade"]
          updated_at: string
          vagas_garagem: number | null
        }
        Insert: {
          area_m2?: number | null
          bloco?: string | null
          condominio_id: string
          created_at?: string
          fracao_ideal?: number | null
          id?: string
          numero: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["tipo_unidade"]
          updated_at?: string
          vagas_garagem?: number | null
        }
        Update: {
          area_m2?: number | null
          bloco?: string | null
          condominio_id?: string
          created_at?: string
          fracao_ideal?: number | null
          id?: string
          numero?: string
          observacoes?: string | null
          tipo?: Database["public"]["Enums"]["tipo_unidade"]
          updated_at?: string
          vagas_garagem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios"
            referencedColumns: ["id"]
          },
        ]
      }
      uso_diario: {
        Row: {
          dia: string
          total_mensagens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          dia: string
          total_mensagens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          dia?: string
          total_mensagens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uso_mensal: {
        Row: {
          custo_estimado_brl: number
          id: string
          mes_ano: string
          total_credits: number | null
          total_mensagens: number
          total_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          custo_estimado_brl?: number
          id?: string
          mes_ano: string
          total_credits?: number | null
          total_mensagens?: number
          total_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          custo_estimado_brl?: number
          id?: string
          mes_ano?: string
          total_credits?: number | null
          total_mensagens?: number
          total_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uso_razoavel_alertas: {
        Row: {
          created_at: string
          id: string
          mes_ano: string
          notificado_em: string | null
          tipo: string
          user_id: string
          valor_atingido: number
        }
        Insert: {
          created_at?: string
          id?: string
          mes_ano: string
          notificado_em?: string | null
          tipo: string
          user_id: string
          valor_atingido: number
        }
        Update: {
          created_at?: string
          id?: string
          mes_ano?: string
          notificado_em?: string | null
          tipo?: string
          user_id?: string
          valor_atingido?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_metrics: { Args: never; Returns: Json }
      admin_list_users: {
        Args: { _limit?: number; _offset?: number; _search?: string }
        Returns: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          is_admin: boolean
          mensagens_mes: number
          nome: string
          oab: string
          plano: string
          total_condominios: number
        }[]
      }
      admin_usage_timeseries: {
        Args: { _days?: number }
        Returns: {
          dia: string
          mensagens: number
        }[]
      }
      assembleia_gerar_recibo: { Args: never; Returns: string }
      calcular_custo_mensal: {
        Args: { _mes_ano: string; _user_id: string }
        Returns: Json
      }
      check_alertas_uso: { Args: { _user_id: string }; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gerar_protocolo_helpdesk: { Args: never; Returns: string }
      get_papel_sistema: {
        Args: { _id: string }
        Returns: Database["public"]["Enums"]["papel_sistema"]
      }
      has_papel_sistema: {
        Args: {
          _papeis: Database["public"]["Enums"]["papel_sistema"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_any_admin: { Args: { _user_id: string }; Returns: boolean }
      is_condominio_member: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      match_document_chunks: {
        Args: {
          _condominio_id: string
          _match_count?: number
          _min_similarity?: number
          _query_embedding: string
        }
        Returns: {
          chunk_id: string
          conteudo: string
          documento_id: string
          nome_arquivo: string
          similarity: number
        }[]
      }
      match_kb_chunks: {
        Args: {
          _match_count?: number
          _min_similarity?: number
          _query_embedding: string
        }
        Returns: {
          chunk_id: string
          conteudo: string
          fonte: string
          kb_documento_id: string
          similarity: number
          tipo: Database["public"]["Enums"]["kb_tipo"]
          titulo: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalizar_telefone_br: { Args: { p_telefone: string }; Returns: string }
      normalize_cpf: { Args: { _v: string }; Returns: string }
      normalize_edificio: { Args: { _v: string }; Returns: string }
      normalize_unidade: { Args: { _v: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      refresh_custos_cliente_mensal: {
        Args: { _mes_ano: string; _user_id: string }
        Returns: undefined
      }
      storage_bytes_by_user: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "owner" | "admin" | "sindico" | "administradora"
      blog_status: "rascunho" | "publicado" | "agendado"
      helpdesk_assunto:
        | "duvida_uso"
        | "problema_tecnico"
        | "financeiro"
        | "sugestao"
        | "seguranca_lgpd"
        | "outro"
      helpdesk_autor: "cliente" | "admin"
      helpdesk_status:
        | "aberto"
        | "respondido_admin"
        | "respondido_cliente"
        | "encerrado"
      kb_tipo:
        | "jurisprudencia"
        | "doutrina"
        | "lei"
        | "peca"
        | "orientacao"
        | "outro"
      papel_condo_v2: "dono_condominio" | "operador_condominio"
      papel_condominio: "sindico" | "subsindico" | "conselheiro" | "colaborador"
      papel_mensagem: "user" | "assistant"
      papel_sistema:
        | "super_admin"
        | "admin_operacional"
        | "admin_suporte"
        | "cliente_pf"
        | "cliente_pj_dono"
        | "cliente_pj_operador"
      perfil_atuacao:
        | "sindico"
        | "advogado"
        | "administradora"
        | "conselheiro"
        | "outro"
      plano_assinatura: "solo" | "pro" | "administradora"
      tipo_condomino:
        | "proprietario"
        | "inquilino"
        | "morador"
        | "responsavel_legal"
      tipo_documento:
        | "convencao"
        | "regimento"
        | "ata"
        | "contrato"
        | "outro"
        | "laudo_tecnico"
        | "previsao_orcamentaria"
        | "prestacao_contas"
        | "comunicado"
      tipo_pessoa: "pf" | "pj"
      tipo_unidade:
        | "apartamento"
        | "casa"
        | "sala_comercial"
        | "loja"
        | "vaga_avulsa"
        | "outro"
        | "lote"
        | "terreno"
        | "galpao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "sindico", "administradora"],
      blog_status: ["rascunho", "publicado", "agendado"],
      helpdesk_assunto: [
        "duvida_uso",
        "problema_tecnico",
        "financeiro",
        "sugestao",
        "seguranca_lgpd",
        "outro",
      ],
      helpdesk_autor: ["cliente", "admin"],
      helpdesk_status: [
        "aberto",
        "respondido_admin",
        "respondido_cliente",
        "encerrado",
      ],
      kb_tipo: [
        "jurisprudencia",
        "doutrina",
        "lei",
        "peca",
        "orientacao",
        "outro",
      ],
      papel_condo_v2: ["dono_condominio", "operador_condominio"],
      papel_condominio: ["sindico", "subsindico", "conselheiro", "colaborador"],
      papel_mensagem: ["user", "assistant"],
      papel_sistema: [
        "super_admin",
        "admin_operacional",
        "admin_suporte",
        "cliente_pf",
        "cliente_pj_dono",
        "cliente_pj_operador",
      ],
      perfil_atuacao: [
        "sindico",
        "advogado",
        "administradora",
        "conselheiro",
        "outro",
      ],
      plano_assinatura: ["solo", "pro", "administradora"],
      tipo_condomino: [
        "proprietario",
        "inquilino",
        "morador",
        "responsavel_legal",
      ],
      tipo_documento: [
        "convencao",
        "regimento",
        "ata",
        "contrato",
        "outro",
        "laudo_tecnico",
        "previsao_orcamentaria",
        "prestacao_contas",
        "comunicado",
      ],
      tipo_pessoa: ["pf", "pj"],
      tipo_unidade: [
        "apartamento",
        "casa",
        "sala_comercial",
        "loja",
        "vaga_avulsa",
        "outro",
        "lote",
        "terreno",
        "galpao",
      ],
    },
  },
} as const
