import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustBand } from "@/components/landing/TrustBand";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ForWhomSection } from "@/components/landing/ForWhomSection";
import { AnatomySection } from "@/components/landing/AnatomySection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { AugustoNaPratica } from "@/components/landing/AugustoNaPratica";
import { TrustSection } from "@/components/landing/TrustSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { FinalCtaSection } from "@/components/landing/FinalCtaSection";
import { ManifestoFooter } from "@/components/landing/ManifestoFooter";
import { ScrollBlurOverlay } from "@/components/landing/ScrollBlurOverlay";
import { useHashScroll } from "@/hooks/use-hash-scroll";

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
      <HeroSection />
      <TrustBand />
      <AnatomySection />
      <ProblemSection />
      <ForWhomSection />
      <FeaturesSection />
      <AugustoNaPratica />
      <TrustSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
      <ManifestoFooter />
      <ScrollBlurOverlay />
    </div>
  );
}
