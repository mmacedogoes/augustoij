import { Link } from "@tanstack/react-router";
import { AtSign, Globe, Send } from "lucide-react";
import { AugustoLogo } from "@/components/brand/AugustoLogo";

export function ManifestoFooter() {
  return (
    <>
      {/* Manifesto block */}
      <section className="bg-augusto-green py-28 px-6 text-center">
        <div className="mx-auto max-w-3xl flex flex-col items-center">
          <AugustoLogo variant="icon-only" theme="dark" size={100} />
          <h2 className="mt-10 font-serif italic text-augusto-cream text-5xl md:text-7xl lg:text-[96px] leading-[1.1]">
            Dura lex, sed Augusto.
          </h2>
          <div className="mt-6 text-[13px] font-medium uppercase tracking-[0.24em] text-augusto-gold">
            A lei é dura — mas você tem Augusto.
          </div>
          <blockquote className="mt-12 max-w-[700px] font-serif italic text-augusto-cream text-[22px] leading-[1.5]">
            &ldquo;Acreditamos que toda decisão condominial merece um bom conselho jurídico.
            Que síndicos não deveriam decidir sozinhos. Que advogados não deveriam gastar suas
            melhores horas respondendo perguntas que poderiam ser respondidas em segundos.&rdquo;
          </blockquote>
          <Link
            to="/manifesto"
            className="mt-12 inline-flex items-center gap-2 rounded-md border border-augusto-gold px-6 py-3 text-sm font-medium text-augusto-gold hover:bg-augusto-gold hover:text-augusto-green transition-colors"
          >
            Ler o manifesto completo →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-augusto-cream py-16 px-6 border-t border-augusto-gold/20">
        <div className="mx-auto max-w-6xl grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <AugustoLogo variant="horizontal" size={160} />
            <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
              Inteligência Jurídica para Condomínios
            </div>
            <p className="mt-3 font-serif italic text-augusto-slate text-sm">
              Dois mil anos de Direito, em forma de conversa.
            </p>
          </div>

          <FooterCol
            title="Plataforma"
            items={[
              { label: "Como funciona", href: "#anatomia" },
              { label: "Para Síndicos", href: "#features" },
              { label: "Para Administradoras", href: "#features" },
              { label: "Para Advogados", href: "#features" },
              { label: "Planos", href: "#pricing" },
            ]}
          />
          <FooterCol
            title="Institucional"
            items={[
              { label: "A História", to: "/historia" },
              { label: "Manifesto", to: "/manifesto" },
              { label: "Blog", to: "/blog" },
              { label: "Contato", href: "mailto:contato@augusto.ij" },
            ]}
          />
          <FooterCol
            title="Jurídico"
            items={[
              { label: "Termos de Uso", to: "/termos" },
              { label: "Política de Privacidade", to: "/privacidade" },
              { label: "LGPD", to: "/privacidade" },
              { label: "Sigilo Profissional", to: "/privacidade" },
            ]}
          />
        </div>

        <div className="mx-auto max-w-6xl mt-12">
          <div className="h-px bg-augusto-gold/30" />
          <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[13px] text-augusto-slate">
            <div>© {new Date().getFullYear()} Augusto.IJ — Todos os direitos reservados.</div>
            <div className="flex items-center gap-4 text-augusto-gold">
              <a href="#" aria-label="Instagram" className="hover:brightness-110"><AtSign className="h-4 w-4" /></a>
              <a href="#" aria-label="LinkedIn" className="hover:brightness-110"><Globe className="h-4 w-4" /></a>
              <a href="#" aria-label="YouTube" className="hover:brightness-110"><Send className="h-4 w-4" /></a>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

type FooterItem = { label: string; href?: string; to?: string };

function FooterCol({ title, items }: { title: string; items: FooterItem[] }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item.label}>
            {item.to ? (
              <Link to={item.to} className="text-[15px] text-augusto-slate hover:text-augusto-green transition-colors">
                {item.label}
              </Link>
            ) : (
              <a href={item.href} className="text-[15px] text-augusto-slate hover:text-augusto-green transition-colors">
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ManifestoFooter;