import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { FounderStorySection } from "@/components/landing/FounderStorySection";
import { ForWhomSection } from "@/components/landing/ForWhomSection";
import { AnatomySection } from "@/components/landing/AnatomySection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { ManifestoFooter } from "@/components/landing/ManifestoFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Augusto.IJ — IA para síndicos e administradoras de condomínios" },
      { name: "description", content: "Plataforma de IA com apoio jurídico, gestão de documentos e respostas instantâneas para o dia a dia do seu condomínio. Teste grátis por 7 dias." },
      { property: "og:title", content: "Augusto.IJ — IA para condomínios" },
      { property: "og:description", content: "Apoio inteligente para síndicos e administradoras." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-augusto-cream text-augusto-slate-dark">
      <Nav />
      <HeroSection />
      <ProblemSection />
      <FounderStorySection />
      <ForWhomSection />
      <AnatomySection />
      <FeaturesSection />
      <PricingSection />
      <ManifestoFooter />
    </div>
  );
}
