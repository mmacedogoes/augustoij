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
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          id: string
          metadata: Json
          target_condominio_id: string | null
          target_kb_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_condominio_id?: string | null
          target_kb_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_condominio_id?: string | null
          target_kb_id?: string | null
          target_user_id?: string | null
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
      condominio_members: {
        Row: {
          condominio_id: string
          created_at: string
          id: string
          papel_no_condominio: Database["public"]["Enums"]["papel_condominio"]
          user_id: string
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          papel_no_condominio?: Database["public"]["Enums"]["papel_condominio"]
          user_id: string
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
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
        }
        Insert: {
          condominio_id: string
          created_at?: string
          id?: string
          nome_arquivo: string
          status_processamento?: string
          storage_path: string
          tipo?: Database["public"]["Enums"]["tipo_documento"]
        }
        Update: {
          condominio_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string
          status_processamento?: string
          storage_path?: string
          tipo?: Database["public"]["Enums"]["tipo_documento"]
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
      mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          id: string
          model_usado: string | null
          papel: Database["public"]["Enums"]["papel_mensagem"]
          tokens_usados: number | null
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          id?: string
          model_usado?: string | null
          papel: Database["public"]["Enums"]["papel_mensagem"]
          tokens_usados?: number | null
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          id?: string
          model_usado?: string | null
          papel?: Database["public"]["Enums"]["papel_mensagem"]
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          lgpd_aceite_em: string | null
          nome: string | null
          oab: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          lgpd_aceite_em?: string | null
          nome?: string | null
          oab?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          lgpd_aceite_em?: string | null
          nome?: string | null
          oab?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plano: Database["public"]["Enums"]["plano_assinatura"]
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plano?: Database["public"]["Enums"]["plano_assinatura"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plano?: Database["public"]["Enums"]["plano_assinatura"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      uso_mensal: {
        Row: {
          custo_estimado_brl: number
          id: string
          mes_ano: string
          total_mensagens: number
          total_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          custo_estimado_brl?: number
          id?: string
          mes_ano: string
          total_mensagens?: number
          total_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          custo_estimado_brl?: number
          id?: string
          mes_ano?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_condominio_member: {
        Args: { _condominio_id: string; _user_id: string }
        Returns: boolean
      }
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
    }
    Enums: {
      app_role: "owner" | "admin" | "sindico" | "administradora"
      kb_tipo:
        | "jurisprudencia"
        | "doutrina"
        | "lei"
        | "peca"
        | "orientacao"
        | "outro"
      papel_condominio: "sindico" | "subsindico" | "conselheiro" | "colaborador"
      papel_mensagem: "user" | "assistant"
      plano_assinatura: "solo" | "pro" | "administradora"
      tipo_documento: "convencao" | "regimento" | "ata" | "contrato" | "outro"
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
      kb_tipo: [
        "jurisprudencia",
        "doutrina",
        "lei",
        "peca",
        "orientacao",
        "outro",
      ],
      papel_condominio: ["sindico", "subsindico", "conselheiro", "colaborador"],
      papel_mensagem: ["user", "assistant"],
      plano_assinatura: ["solo", "pro", "administradora"],
      tipo_documento: ["convencao", "regimento", "ata", "contrato", "outro"],
    },
  },
} as const
