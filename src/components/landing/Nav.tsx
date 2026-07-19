import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { AugustoLogo } from "@/components/brand/AugustoLogo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSectionClick = useCallback(
    (id: string, closeMenu = false) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (closeMenu) setOpen(false);

      if (pathname === "/") {
        event.preventDefault();
        if (window.location.hash !== `#${id}`) {
          window.history.pushState(null, "", `#${id}`);
        }
        scrollToId(id);
      }
    },
    [pathname],
  );

  useEffect(() => {
    const onScroll = () => {
      setScrolled((prev) => {
        const y = window.scrollY;
        // Wide hysteresis band avoids re-triggering when the header's own
        // resize causes a tiny scroll delta near the threshold.
        if (prev && y < 12) return false;
        if (!prev && y > 72) return true;
        return prev;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkCls =
    "rounded-full px-3 py-2 text-[14px] font-medium text-augusto-cream/85 transition-all duration-200 hover:bg-augusto-cream/10 hover:text-augusto-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold";

  return (
    <header
      className={cn(
        // Header height stays constant — only the surface treatment
        // (background, border, shadow) changes on scroll, so there is no
        // layout thrash that could re-cross the scroll threshold.
        "sticky top-0 z-50 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300 ease-out",
        scrolled
          ? "border-b border-augusto-gold/35 bg-augusto-green/88 shadow-[var(--landing-shadow-deep)] supports-[backdrop-filter]:backdrop-blur-xl"
          : "border-b border-augusto-gold/15 bg-augusto-green",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8",
        )}
      >
        <Link to="/" className="flex min-w-0 items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold">
          {/* Fixed logo width keeps the header height stable across scroll */}
          <AugustoLogo variant="horizontal" theme="dark" size={188} />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-augusto-gold/20 bg-augusto-cream/5 p-1 md:flex">
          <Link to="/" hash="features" onClick={handleSectionClick("features")} className={linkCls}>
            Plataforma
          </Link>
          <Link to="/historia" className={linkCls}>
            História
          </Link>
          <Link to="/manifesto" className={linkCls}>
            Manifesto
          </Link>
          <Link to="/" hash="pricing" onClick={handleSectionClick("pricing")} className={linkCls}>
            Planos
          </Link>
          <Link to="/blog" className={linkCls}>
            Blog
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login" className={linkCls}>
            Entrar
          </Link>
          <Button asChild variant="augusto-gold" size="lg" className="h-10 px-4">
            <Link to="/signup">Começar grátis</Link>
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-augusto-gold/30 text-augusto-cream transition-colors duration-200 hover:bg-augusto-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-gold md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Abrir menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-3 border-t border-augusto-gold/25 bg-augusto-green-dark px-6 py-6 shadow-[var(--landing-shadow-deep)] md:hidden">
          <Link to="/" hash="features" onClick={handleSectionClick("features", true)} className={linkCls}>Plataforma</Link>
          <Link to="/historia" className={linkCls} onClick={() => setOpen(false)}>História</Link>
          <Link to="/manifesto" className={linkCls} onClick={() => setOpen(false)}>Manifesto</Link>
          <Link to="/" hash="pricing" onClick={handleSectionClick("pricing", true)} className={linkCls}>Planos</Link>
          <Link to="/blog" className={linkCls} onClick={() => setOpen(false)}>Blog</Link>
          <div className="h-px bg-augusto-gold/30" />
          <Link to="/login" className={linkCls} onClick={() => setOpen(false)}>Entrar</Link>
          <Link
            to="/signup"
            onClick={() => setOpen(false)}
            className="rounded-md bg-augusto-gold px-4 py-2.5 text-center text-sm font-semibold text-augusto-green transition-all duration-200 hover:bg-augusto-gold-light active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-cream"
          >
            Começar grátis
          </Link>
        </div>
      )}
    </header>
  );
}

export default Nav;