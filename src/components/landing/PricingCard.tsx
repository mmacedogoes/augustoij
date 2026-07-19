import { cn } from "@/lib/utils";

import { Check, X } from "lucide-react";

type Cta = { label: string; onClick: () => void; variant?: "solid" | "outline" };

export type PricingFeature = {
  label: string;
  state: "included" | "excluded" | "strikethrough";
};

export type PricingBadge = {
  label: string;
  tone: "primary" | "success" | "neutral" | "gold";
};

export function PricingCard({
  name,
  price,
  priceSuffix,
  priceNote,
  sublabel,
  features,
  cta,
  featured,
  badge,
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  priceNote?: string;
  sublabel: string;
  features: PricingFeature[];
  cta: Cta;
  featured?: boolean;
  badge?: PricingBadge;
}) {
  const solid = cta.variant !== "outline";
  const badgeClasses: Record<PricingBadge["tone"], string> = {
    primary: "bg-augusto-green text-augusto-cream",
    success: "bg-augusto-green-light/15 text-augusto-green-dark ring-1 ring-augusto-green-light/30",
    neutral: "bg-augusto-slate/10 text-augusto-slate-dark ring-1 ring-augusto-slate/20",
    gold: "bg-augusto-gold text-augusto-green",
  };
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl bg-white p-7 transition-all duration-200 ease-out",
        featured
          ? "border-2 border-augusto-green shadow-[0_20px_50px_-20px_hsl(var(--augusto-green)/0.25)] ring-1 ring-augusto-gold/40 md:-translate-y-1"
          : "border border-augusto-gold/20 shadow-sm hover:-translate-y-0.5 hover:border-augusto-gold/50 hover:shadow-[0_16px_40px_-20px_hsl(var(--augusto-gold)/0.35)]",
      )}
    >
      {badge && (
        <span
          className={cn(
            "absolute -top-3 left-6 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
            badgeClasses[badge.tone],
          )}
        >
          {badge.label}
        </span>
      )}
      <h3 className="font-serif text-augusto-green text-[22px]">{name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-serif text-augusto-green text-[44px] leading-none tracking-tight">
          {price}
        </span>
        {priceSuffix && (
          <span className="text-sm text-augusto-slate">{priceSuffix}</span>
        )}
      </div>
      <p className="mt-1 min-h-[18px] text-[12px] text-augusto-slate/80">{priceNote ?? ""}</p>
      <p className="mt-2 text-[13px] text-augusto-slate">{sublabel}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => {
          if (f.state === "strikethrough") {
            return (
              <li
                key={f.label}
                className="flex gap-2 text-[14px] text-augusto-slate/50 line-through decoration-augusto-slate/40"
              >
                <Check
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-augusto-slate/30"
                  aria-hidden="true"
                />
                <span>{f.label}</span>
              </li>
            );
          }
          const included = f.state === "included";
          return (
            <li
              key={f.label}
              className={cn(
                "flex gap-2 text-[14px]",
                included ? "text-augusto-slate-dark" : "text-augusto-slate/60",
              )}
            >
              {included ? (
                <Check
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-augusto-green"
                  aria-hidden="true"
                />
              ) : (
                <X
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-augusto-slate/40"
                  aria-hidden="true"
                />
              )}
              <span>{f.label}</span>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={cta.onClick}
        className={cn(
          "mt-7 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-augusto-green/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          "active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
          solid
            ? "bg-augusto-green text-augusto-cream hover:bg-augusto-green-dark shadow-sm hover:shadow"
            : "border border-augusto-green/70 text-augusto-green hover:bg-augusto-green hover:text-augusto-cream",
        )}
      >
        {cta.label}
      </button>
    </div>
  );
}

export default PricingCard;