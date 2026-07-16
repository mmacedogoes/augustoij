## Objetivo
Substituir o corpo do e-mail de boas-vindas (`send-welcome-email`) pelo HTML exato enviado no arquivo `email-1-boas-vindas.html`, usando o novo logo `augusto-ij-logo-full-dark-FINAL.png` como imagem do cabeçalho.

## Passos

1. **Publicar o novo logo no CDN**
   - Fazer upload de `user-uploads://augusto-ij-logo-full-dark-FINAL.png` via `lovable-assets create`.
   - Salvar o pointer em `src/assets/email/augusto-ij-logo-full-dark-FINAL.png.asset.json`.
   - Guardar a URL absoluta pública (`https://augustoij.com.br/__l5e/assets-v1/<asset_id>/augusto-ij-logo-full-dark-FINAL.png`).

2. **Reescrever o HTML da Edge Function**
   - Arquivo: `supabase/functions/send-welcome-email/index.ts`.
   - Substituir a função `buildHtml(nome)` pelo HTML do arquivo anexo, **letra por letra**, apenas trocando:
     - `{{URL_LOGO_COMPLETO}}` → URL absoluta do novo logo publicado.
     - `{{nome}}` → nome do destinatário (com escape HTML).
     - `{{link_dashboard}}` → `https://augustoij.com.br/app` (mesma URL do CTA atual).
   - Nenhum outro elemento (cores, tabelas, estilos inline, textos, footer) será modificado.

3. **Redeploy e teste**
   - Deploy da função `send-welcome-email`.
   - Enviar um e-mail de teste para `mmacedogoes@gmail.com` (nome "Matheus") para validar renderização.

4. **Limpar asset antigo (opcional)**
   - Manter os assets antigos (`augusto-ij-icon-dark-FINAL.png`, `logo-completo-escuro.jpg`) por enquanto — não são mais referenciados pelo e-mail, mas ficam disponíveis para outros usos. Confirmar antes de deletar.

## Detalhes técnicos
- O HTML anexo já inclui o cabeçalho verde (`#00512B`) que combina com o fundo verde do logo — nenhum ajuste de contraste é necessário.
- O `{{link_dashboard}}` não aparece no HTML como token separado no seu arquivo? **Confirmar**: no arquivo enviado, o botão usa `href="{{link_dashboard}}"`. Vou substituir por `https://augustoij.com.br/app` (destino atual). Se preferir outra URL, me avise.
- O footer permanece o mesmo texto ("Dura lex, sed Augusto." e razão social).

## Arquivos alterados
- `src/assets/email/augusto-ij-logo-full-dark-FINAL.png.asset.json` (novo)
- `supabase/functions/send-welcome-email/index.ts` (HTML substituído)
