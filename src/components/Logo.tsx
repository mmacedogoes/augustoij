import { AugustoLogo } from "@/components/brand/AugustoLogo";

type Variant = "principal" | "invertida" | "icone" | "default" | "inverted" | "icon";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<Size, number> = {
  xs: 24,
  sm: 40,
  md: 56,
  lg: 96,
  xl: 140,
};

type Props = {
  variant?: Variant;
  className?: string;
  /** altura em px (override) */
  height?: number;
  /** tamanho semântico — define a altura conforme a escala da marca */
  size?: Size;
};

function mapVariant(v: Variant): "primary" | "inverted" | "icon-only" {
  if (v === "invertida" || v === "inverted") return "inverted";
  if (v === "icone" || v === "icon") return "icon-only";
  return "primary";
}

export function Logo({ variant = "principal", className, height, size }: Props) {
  const finalHeight = height ?? (size ? SIZE_PX[size] : 56);
  return (
    <AugustoLogo variant={mapVariant(variant)} height={finalHeight} className={className} />
  );
}