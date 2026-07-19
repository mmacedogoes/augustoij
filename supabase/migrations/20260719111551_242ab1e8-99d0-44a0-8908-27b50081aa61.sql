ALTER TABLE public.contratos_locacao
  ADD COLUMN IF NOT EXISTS valor_aluguel_inicial numeric;

UPDATE public.contratos_locacao
   SET valor_aluguel_inicial = valor_aluguel
 WHERE valor_aluguel_inicial IS NULL;