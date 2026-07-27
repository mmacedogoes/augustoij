import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/v2/Hero";
import { FaixaProva } from "@/components/landing/v2/FaixaProva";
import { Metodo } from "@/components/landing/v2/Metodo";
import { Situacoes } from "@/components/landing/v2/Situacoes";
import { Credibilidade } from "@/components/landing/v2/Credibilidade";
import { ScrollBlurOverlay } from "@/components/landing/ScrollBlurOverlay";
import { useHashScroll } from "@/hooks/use-hash-scroll";

// Seções abaixo da dobra: code-split para reduzir o JS inicial da home.
const ProblemSection = lazy(() =>
  import("@/components/landing/ProblemSection").then((m) => ({ default: m.ProblemSection })),
);
const ForWhomSection = lazy(() =>
  import("@/components/landing/ForWhomSection").then((m) => ({ default: m.ForWhomSection })),
);
const FeaturesSection = lazy(() =>
  import("@/components/landing/FeaturesSection").then((m) => ({ default: m.FeaturesSection })),
);
const PricingSection = lazy(() =>
  import("@/components/landing/PricingSection").then((m) => ({ default: m.PricingSection })),
);
const FaqSection = lazy(() =>
  import("@/components/landing/FaqSection").then((m) => ({ default: m.FaqSection })),
);
const FinalCtaSection = lazy(() =>
  import("@/components/landing/FinalCtaSection").then((m) => ({ default: m.FinalCtaSection })),
);
const ManifestoFooter = lazy(() =>
  import("@/components/landing/ManifestoFooter").then((m) => ({ default: m.ManifestoFooter })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Augusto.IJ · IA jurídica para condomínios" },
      { name: "description", content: "Plataforma de IA com apoio jurídico, gestão de documentos e respostas instantâneas para o dia a dia do seu condomínio. Teste grátis por 7 dias." },
      { property: "og:title", content: "Augusto.IJ · IA jurídica para condomínios" },
      { property: "og:description", content: "Apoio inteligente para síndicos e administradoras." },
      { property: "og:url", content: "https://augustoij.com.br/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://augustoij.com.br/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Augusto.IJ",
          url: "https://augustoij.com.br",
          logo: "https://augustoij.com.br/favicon-256.png",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Augusto.IJ",
          url: "https://augustoij.com.br",
        }),
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  useHashScroll();
  return (
    <div className="relative min-h-screen bg-augusto-cream text-augusto-slate-dark">
      <Nav />
      <Hero />
      <FaixaProva />
      <Metodo />
      <Suspense fallback={<div className="h-24" aria-hidden />}>
        <ProblemSection />
        <ForWhomSection />
        <FeaturesSection />
        <AugustoNaPratica />
        <TrustSection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
        <ManifestoFooter />
      </Suspense>
      <ScrollBlurOverlay />
    </div>
  );
}
