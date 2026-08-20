import { createHmac, timingSafeEqual } from 'crypto'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/resend-webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signature = request.headers.get('x-resend-signature')
        const body = await request.text()
        const secret = process.env['RESEND_WEBHOOK_SECRET']

        // 1. Verificar assinatura
        if (secret && signature) {
          const expected = createHmac('sha256', secret).update(body).digest('hex')
          if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
            return new Response('Unauthorized', { status: 401 })
          }
        }

        const payload = JSON.parse(body)
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // 2. Correlacionar e atualizar status
        if (payload.data?.email_id) {
          const statusMap: Record<string, string> = {
            'email.sent': 'enviado',
            'email.delivered': 'entregue',
            'email.opened': 'aberto',
            'email.bounced': 'falhou',
            'email.complained': 'reclamado',
            'email.clicked': 'clicado'
          }

          const status = statusMap[payload.type] || payload.type
          
          // Atualizar destinatário
          const { data: dest } = await supabaseAdmin
            .from('assembleia_convocacao_destinatarios')
            .update({ 
              status_email: status,
              email_entregue_em: payload.type === 'email.delivered' ? new Date().toISOString() : undefined,
              email_aberto_em: payload.type === 'email.opened' ? new Date().toISOString() : undefined,
              email_erro: payload.type === 'email.bounced' ? JSON.stringify(payload.data) : undefined
            })
            .eq('resend_message_id', payload.data.email_id)
            .select('id, canal')
            .single()

          // Registrar evento
          if (dest) {
            await supabaseAdmin.from('assembleia_convocacao_eventos').insert({
              destinatario_id: dest.id,
              canal: dest.canal || 'email',
              tipo: status,
              payload: payload
            })
          }
        }

        return new Response('ok')
      }
    }
  }
})
