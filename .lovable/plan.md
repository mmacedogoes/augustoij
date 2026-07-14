## Objetivo
Substituir os endereços de e-mail antigos nos componentes da landing page pelos novos:
- DPO / privacidade: `dpo@augustoij.com.br`
- Suporte / contato: `suporte@augustoij.com.br`

## Arquivos afetados
1. `src/components/landing/ManifestoFooter.tsx`
   - `contato@augusto.ij` → `suporte@augustoij.com.br`
   - `privacidade@augusto.ij` → `dpo@augustoij.com.br`
2. `src/components/landing/PricingSection.tsx`
   - `mailto:contato@augusto.ij` → `mailto:suporte@augustoij.com.br`
3. `src/config/legal.ts`
   - `DPO_EMAIL` → `dpo@augustoij.com.br`

## Fora do escopo (a confirmar)
- `src/components/HelpMenu.tsx` usa `suporte@condoia.com.br` — é do app autenticado, não da landing page. Se desejar, posso atualizar também.
- Páginas de termos/privacidade (`src/routes/privacidade.tsx`, `src/routes/confirmar-exclusao.tsx`, `src/routes/_authenticated/app.conta.tsx`) são rotas internas, não landing page.

## Implementação
Edições diretas de strings de e-mail nos componentes acima, mantendo labels e hrefs consistentes.