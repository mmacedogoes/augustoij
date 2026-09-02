-- Migração: Adiciona custom_dia_vencimento em public.subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS custom_dia_vencimento integer DEFAULT 10;
