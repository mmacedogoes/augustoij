import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { cn } from "@/lib/utils";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkCls = "text-[15px] font-medium text-augusto-green hover:text-augusto-green-dark transition-colors";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-augusto-cream/95 backdrop-blur transition-all",
        scrolled ? "border-b border-augusto-gold/30" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-6">
        <Link to="/" className="flex items-center">
          <AugustoLogo variant="horizontal" size={140} />
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <button type="button" onClick={() => scrollToId("features")} className={linkCls}>
            Plataforma
          </button>
          <Link to="/historia" className={linkCls}>
            História
          </Link>
          <Link to="/manifesto" className={linkCls}>
            Manifesto
          </Link>
          <button type="button" onClick={() => scrollToId("pricing")} className={linkCls}>
            Planos
          </button>
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <Link to="/login" className={linkCls}>
            Entrar
          </Link>
          <Link
            to="/signup"
            className="rounded-md border border-augusto-green px-4 py-2 text-sm font-medium text-augusto-green hover:bg-augusto-green hover:text-augusto-cream transition-colors"
          >
            Começar
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-augusto-green"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-augusto-gold/20 bg-augusto-cream px-6 py-6 flex flex-col gap-4">
          <button type="button" onClick={() => { setOpen(false); scrollToId("features"); }} className={linkCls}>Plataforma</button>
          <Link to="/historia" className={linkCls} onClick={() => setOpen(false)}>História</Link>
          <Link to="/manifesto" className={linkCls} onClick={() => setOpen(false)}>Manifesto</Link>
          <button type="button" onClick={() => { setOpen(false); scrollToId("pricing"); }} className={linkCls}>Planos</button>
          <div className="h-px bg-augusto-gold/20" />
          <Link to="/login" className={linkCls} onClick={() => setOpen(false)}>Entrar</Link>
          <Link
            to="/signup"
            onClick={() => setOpen(false)}
            className="rounded-md border border-augusto-green px-4 py-2 text-sm font-medium text-augusto-green text-center"
          >
            Começar
          </Link>
        </div>
      )}
    </header>
  );
}

export default Nav;