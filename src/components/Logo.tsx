import { AugustoLogo } from "@/components/brand/AugustoLogo";

type LegacyVariant = "principal" | "invertida" | "icone" | "default" | "inverted" | "icon";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = { xs: 100, sm: 140, md: 160, lg: 220, xl: 300 };

type Props = {
  variant?: LegacyVariant;
  className?: string;
  /** altura/altura-base em px (override) */
  height?: number;
  size?: Size;
};

export function Logo({ variant = "principal", className, height, size }: Props) {
  const theme: "light" | "dark" =
    variant === "invertida" || variant === "inverted" ? "dark" : "light";
  const isIcon = variant === "icone" || variant === "icon";
  const px = height ?? (size ? SIZE_PX[size] : 160);

  if (isIcon) {
    return <AugustoLogo variant="icon-only" theme={theme} size={px} className={className} />;
  }

  // Heurística: alturas grandes (>=200) viram stacked; demais ficam horizontal.
  if (px >= 200) {
    return (
      <AugustoLogo
        variant="stacked"
        theme={theme}
        size={Math.min(px, 320)}
        className={className}
      />
    );
  }
  return <AugustoLogo variant="horizontal" theme={theme} size={px} className={className} />;
}
