import principal from "@/assets/condoia-logo-principal.jpg.asset.json";
import invertida from "@/assets/condoia-logo-invertida.jpg.asset.json";
import icone from "@/assets/condoia-icone.jpg.asset.json";

type Variant = "principal" | "invertida" | "icone" | "default" | "inverted" | "icon";
type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SRC: Record<Variant, string> = {
  principal: principal.url,
  invertida: invertida.url,
  icone: icone.url,
  default: principal.url,
  inverted: invertida.url,
  icon: icone.url,
};

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

export function Logo({ variant = "principal", className, height, size }: Props) {
  const finalHeight = height ?? (size ? SIZE_PX[size] : 56);
  return (
    <img
      src={SRC[variant]}
      alt="condoIA — Inteligência para Condomínios"
      style={{ height: finalHeight, width: "auto", objectFit: "contain" }}
      className={className}
      draggable={false}
    />
  );
}