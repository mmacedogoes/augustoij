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
    const onScroll = () => {
      setScrolled((prev) => {
        const y = window.scrollY;
        if (prev && y < 8) return false;
        if (!prev && y > 40) return true;
        return prev;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkCls =
    "text-[15px] font-medium text-augusto-cream/90 hover:text-augusto-gold-light transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold rounded-sm";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-augusto-green backdrop-blur transition-all duration-300",
        scrolled
          ? "shadow-[0_6px_20px_-12px_rgba(0,0,0,0.6)] border-b border-augusto-gold/40"
          : "border-b border-transparent",
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-6xl px-6 flex items-center justify-between gap-6 transition-all duration-200 ease-out",
          scrolled ? "py-3" : "py-6",
        )}
      >
        <Link to="/" className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold rounded-sm">
          <AugustoLogo
            variant="horizontal"
            theme="dark"
            size={scrolled ? 180 : 260}
          />
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
            className="rounded-md bg-augusto-gold px-4 py-2 text-sm font-semibold text-augusto-green hover:bg-augusto-gold-light active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-cream"
          >
            Começar grátis
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-augusto-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold rounded-sm"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-augusto-gold/30 bg-augusto-green-dark px-6 py-6 flex flex-col gap-4">
          <button type="button" onClick={() => { setOpen(false); scrollToId("features"); }} className={linkCls}>Plataforma</button>
          <Link to="/historia" className={linkCls} onClick={() => setOpen(false)}>História</Link>
          <Link to="/manifesto" className={linkCls} onClick={() => setOpen(false)}>Manifesto</Link>
          <button type="button" onClick={() => { setOpen(false); scrollToId("pricing"); }} className={linkCls}>Planos</button>
          <div className="h-px bg-augusto-gold/30" />
          <Link to="/login" className={linkCls} onClick={() => setOpen(false)}>Entrar</Link>
          <Link
            to="/signup"
            onClick={() => setOpen(false)}
            className="rounded-md bg-augusto-gold px-4 py-2 text-sm font-semibold text-augusto-green text-center"
          >
            Começar grátis
          </Link>
        </div>
      )}
    </header>
  );
}

export default Nav;