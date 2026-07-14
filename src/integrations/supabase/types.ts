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
          data_inicio_vigencia: string | null
          dia_vencimento: number | null
          encargos_inquilino: Json
          foro: string | null
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
        }
        Insert: {
          arquivo_contrato_url?: string | null
          aviso_previo_dias?: number
          created_at?: string
          data_contrato_original?: string | null
          data_inicio_vigencia?: string | null
          dia_vencimento?: number | null
          encargos_inquilino?: Json
          foro?: string | null
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
        }
        Update: {
          arquivo_contrato_url?: string | null
          aviso_previo_dias?: number
          created_at?: string
          data_contrato_original?: string | null
          data_inicio_vigencia?: string | null
          dia_vencimento?: number | null
          encargos_inquilino?: Json
          foro?: string | null
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
      pagamentos: {
        Row: {
          competencia: string | null
          contrato_locacao_id: string
          created_at: string
          data_pagamento: string | null
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
          cortesia: boolean
          cortesia_concedida_por: string | null
          cortesia_observacao: string | null
          created_at: string
          creditos_mensagens_extras: number
          current_period_end: string | null
          id: string
          plano: Database["public"]["Enums"]["plano_assinatura"] | null
          plano_config_id: string
          plano_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tipo_assinatura: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cortesia?: boolean
          cortesia_concedida_por?: string | null
          cortesia_observacao?: string | null
          created_at?: string
          creditos_mensagens_extras?: number
          current_period_end?: string | null
          id?: string
          plano?: Database["public"]["Enums"]["plano_assinatura"] | null
          plano_config_id?: string
          plano_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo_assinatura?: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cortesia?: boolean
          cortesia_concedida_por?: string | null
          cortesia_observacao?: string | null
          created_at?: string
          creditos_mensagens_extras?: number
          current_period_end?: string | null
          id?: string
          plano?: Database["public"]["Enums"]["plano_assinatura"] | null
          plano_config_id?: string
          plano_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
      calcular_custo_mensal: {
        Args: { _mes_ano: string; _user_id: string }
        Returns: Json
      }
      check_alertas_uso: { Args: { _user_id: string }; Returns: undefined }
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
      refresh_custos_cliente_mensal: {
        Args: { _mes_ano: string; _user_id: string }
        Returns: undefined
      }
      storage_bytes_by_user: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "owner" | "admin" | "sindico" | "administradora"
      blog_status: "rascunho" | "publicado" | "agendado"
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
