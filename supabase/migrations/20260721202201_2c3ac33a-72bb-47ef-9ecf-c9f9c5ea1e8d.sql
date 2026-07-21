ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS capa_layout text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.blog_posts
  DROP CONSTRAINT IF EXISTS blog_posts_capa_layout_check;

ALTER TABLE public.blog_posts
  ADD CONSTRAINT blog_posts_capa_layout_check
  CHECK (capa_layout IN ('padrao','hero','lateral'));