import { cn } from "@/lib/utils";

type Cta = { label: string; onClick: () => void; variant?: "solid" | "outline" };

export function PricingCard({
  name,
  price,
  priceSuffix,
  sublabel,
  bullets,
  cta,
  featured,
  badge = "POPULAR",
}: {
  name: string;
  price: string;
  priceSuffix?: string;
  sublabel: string;
  bullets: string[];
  cta: Cta;
  featured?: boolean;
  badge?: string;
}) {
  const solid = cta.variant !== "outline";
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg bg-white shadow-sm p-7 relative",
        featured
          ? "border-t-4 border-augusto-gold shadow-md"
          : "border-t border-augusto-gold/40",
      )}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-augusto-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-augusto-green">
          {badge}
        </span>
      )}
      <h3 className="font-serif text-augusto-green text-[22px]">{name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="font-serif text-augusto-green text-5xl leading-none">{price}</span>
        {priceSuffix && (
          <span className="text-sm text-augusto-slate">{priceSuffix}</span>
        )}
      </div>
      <p className="mt-2 text-[13px] text-augusto-slate">{sublabel}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2 text-[15px] text-augusto-slate">
            <span
              className="mt-2 h-1.5 w-1.5 rounded-full bg-augusto-gold flex-shrink-0"
              aria-hidden="true"
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={cta.onClick}
        className={cn(
          "mt-7 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
          solid
            ? "bg-augusto-green text-augusto-cream hover:bg-augusto-green-dark"
            : "border border-augusto-green text-augusto-green hover:bg-augusto-green/5",
        )}
      >
        {cta.label}
      </button>
    </div>
  );
}

export default PricingCard;