import { Link } from "@tanstack/react-router";
import { AugustoLogo } from "@/components/brand/AugustoLogo";

function InstagramGlyph({ className }: { className?: string }) {
  // Minimalist Instagram silhouette (inline SVG, currentColor)
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

const INSTAGRAM_URL = "https://www.instagram.com/augusto.ij?igsh=aHloYWZtaWQycGtw";

export function ManifestoFooter({ showManifesto = true }: { showManifesto?: boolean } = {}) {
  return (
    <>
      {showManifesto && (
      <section className="relative overflow-hidden bg-augusto-green px-6 py-28 text-center">
        <div className="landing-hero-bg absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center">
          <AugustoLogo variant="stacked" theme="dark" size={220} />
          <h2 className="mt-12 font-serif text-[clamp(3rem,9vw,6rem)] italic leading-[0.98] tracking-[-0.035em] text-augusto-cream sm:whitespace-nowrap">
            Dura lex, sed Augusto.
          </h2>
          <div className="mt-6 text-[13px] font-medium uppercase tracking-[0.24em] text-augusto-gold">
            A lei é dura, mas você tem Augusto.
          </div>
          <blockquote className="mt-12 max-w-[700px] font-serif italic text-augusto-cream text-[22px] leading-[1.5]">
            &ldquo;Acreditamos que toda decisão condominial merece um bom conselho jurídico.
            Que síndicos não deveriam decidir sozinhos. Que advogados não deveriam gastar suas
            melhores horas respondendo perguntas que poderiam ser respondidas em segundos.&rdquo;
          </blockquote>
          <Link
            to="/manifesto"
            className="mt-12 inline-flex items-center gap-2 rounded-md border border-augusto-gold px-6 py-3 text-sm font-medium text-augusto-gold hover:bg-augusto-gold hover:text-augusto-green active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-cream"
          >
            Ler o manifesto completo →
          </Link>
        </div>
      </section>
      )}

      {/* Footer */}
      <footer className="border-t border-landing-rule bg-landing-surface px-6 py-16">
        <div className="mx-auto max-w-6xl grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <AugustoLogo variant="horizontal" size={220} />
            <div className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-augusto-gold">
              Inteligência Jurídica para Condomínios
            </div>
            <p className="mt-3 font-serif italic text-augusto-slate text-sm">
              Dois mil anos de Direito, em forma de conversa.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram do Augusto.IJ"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-augusto-gold/50 text-augusto-gold hover:bg-augusto-gold hover:text-augusto-cream active:scale-[0.96] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
              >
                <InstagramGlyph className="h-[18px] w-[18px]" />
              </a>
            </div>
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
              { label: "Contato", href: "mailto:suporte@augustoij.com.br" },
            ]}
          />
          <FooterCol
            title="Jurídico"
            items={[
              { label: "Termos de Uso", to: "/termos" },
              { label: "Política de Privacidade", to: "/privacidade" },
              { label: "Contato DPO: dpo@augustoij.com.br", href: "mailto:dpo@augustoij.com.br" },
            ]}
          />
        </div>

        <div className="mx-auto max-w-6xl mt-12">
          <div className="h-px bg-augusto-gold/30" />
          <div className="mt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[13px] text-augusto-slate">
            <div>© {new Date().getFullYear()} Augusto.IJ, Todos os direitos reservados.</div>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/privacidade" className="rounded-sm text-augusto-slate transition-colors duration-200 hover:text-augusto-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold">
                Política de Privacidade
              </Link>
              <span className="text-augusto-slate/40">|</span>
              <Link to="/termos" className="rounded-sm text-augusto-slate transition-colors duration-200 hover:text-augusto-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold">
                Termos de Uso
              </Link>
              <span className="text-augusto-slate/40">|</span>
              <a
                href="mailto:dpo@augustoij.com.br"
                className="rounded-sm text-augusto-slate transition-colors duration-200 hover:text-augusto-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold"
              >
                Contato DPO: dpo@augustoij.com.br
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-augusto-gold hover:text-augusto-green transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold rounded-sm"
              >
                <InstagramGlyph className="h-4 w-4" />
              </a>
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
              <Link to={item.to} className="rounded-sm text-[15px] text-augusto-slate transition-colors duration-200 hover:text-augusto-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold">
                {item.label}
              </Link>
            ) : (
              <a href={item.href} className="rounded-sm text-[15px] text-augusto-slate transition-colors duration-200 hover:text-augusto-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold">
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