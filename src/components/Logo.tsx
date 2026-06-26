import principal from "@/assets/condoia-logo-principal.jpg.asset.json";
import invertida from "@/assets/condoia-logo-invertida.jpg.asset.json";
import icone from "@/assets/condoia-icone.jpg.asset.json";

type Variant = "principal" | "invertida" | "icone";

const SRC: Record<Variant, string> = {
  principal: principal.url,
  invertida: invertida.url,
  icone: icone.url,
};

type Props = {
  variant?: Variant;
  className?: string;
  /** altura em px */
  height?: number;
};

export function Logo({ variant = "principal", className, height = 32 }: Props) {
  return (
    <img
      src={SRC[variant]}
      alt="condoIA — Inteligência para Condomínios"
      style={{ height, width: "auto" }}
      className={className}
      draggable={false}
    />
  );
}