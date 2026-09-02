import { createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { formatarDataHoraBR } from '@/lib/formatters'

const getEditalPublico = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ codigo: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    
    const { data: assembleia, error } = await supabaseAdmin
      .from('assembleias')
      .select(`
        id,
        titulo,
        tipo,
        data_inicio:data_hora,
        local,
        modalidade,
        edital_texto,
        condominio:condominios(nome, endereco),
        itens:assembleia_itens(ordem, titulo, descricao, regra_quorum)
      `)
      .eq('codigo_publico', data.codigo)
      .eq('situacao', 'convocada')
      .single()

    if (error || !assembleia) return null
    return assembleia as any
  })


export const Route = createFileRoute('/e/$codigo')({
  loader: async ({ params }) => {
    const data = await getEditalPublico({ data: { codigo: params.codigo } })
    if (!data) throw notFound()
    return data
  },
  component: EditalPublicoPage
})

function EditalPublicoPage() {
  const data = Route.useLoaderData()
  const date = new Date(data.data_inicio)

  return (
    <div className="min-h-screen bg-[#F4F3F2] py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto bg-white shadow-sm border border-[#E4E1D8] p-8 sm:p-12">
        <header className="text-center mb-12 border-b border-[#E4E1D8] pb-8">
          <h2 className="font-serif text-[#B8935A] tracking-widest text-sm uppercase mb-2">
            {data.condominio.nome}
          </h2>
          <h1 className="font-serif text-3xl text-[#00512B] mb-4">
            Edital de Convocação
          </h1>
          <p className="text-muted-foreground text-sm uppercase tracking-wide">
            Assembleia Geral {data.tipo}
          </p>
        </header>

        <article className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-[#00512B]">
          <div className="whitespace-pre-wrap font-serif text-lg leading-relaxed text-[#1F2937]">
            {data.edital_texto}
          </div>

          <section className="mt-12 pt-8 border-t border-[#E4E1D8]">
            <h3 className="text-xl mb-6">Informações Adicionais</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <span className="block font-bold text-[#00512B] uppercase text-xs mb-1">Data e Hora</span>
                {formatarDataHoraBR(date)}
              </div>
              <div>
                <span className="block font-bold text-[#00512B] uppercase text-xs mb-1">Local</span>
                {data.local || 'A definir'}
              </div>
              <div>
                <span className="block font-bold text-[#00512B] uppercase text-xs mb-1">Modalidade</span>
                <span className="capitalize">{data.modalidade}</span>
              </div>
            </div>
          </section>
        </article>

        <footer className="mt-16 pt-8 border-t border-[#E4E1D8] text-center text-xs text-muted-foreground italic">
          Augusto.IJ — Inteligência Jurídica para Condomínios
        </footer>
      </div>
    </div>
  )
}
