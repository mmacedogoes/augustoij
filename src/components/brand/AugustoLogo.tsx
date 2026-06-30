import React from "react";

export type AugustoLogoVariant = "primary" | "inverted" | "icon-only";

interface AugustoLogoProps {
  variant?: AugustoLogoVariant;
  /** altura em px */
  height?: number;
  className?: string;
  /** mostra a tagline letterspaced abaixo do wordmark */
  showTagline?: boolean;
}

const GREEN = "#00512B";
const GOLD = "#B8935A";
const CREAM = "#F4F3F2";

export const AugustoLogo: React.FC<AugustoLogoProps> = ({
  variant = "primary",
  height = 56,
  className,
  showTagline = false,
}) => {
  const isInverted = variant === "inverted";
  const textColor = isInverted ? CREAM : GREEN;

  if (variant === "icon-only") {
    const size = height;
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        width={size}
        height={size}
        className={className}
        role="img"
        aria-label="Augusto.IJ"
      >
        <circle cx="32" cy="32" r="30" fill={GREEN} />
        <text
          x="32"
          y="42"
          textAnchor="middle"
          fontFamily='"Cormorant Garamond", Georgia, serif'
          fontSize="34"
          fontWeight="600"
          fill={CREAM}
        >
          A
        </text>
        <circle cx="48" cy="44" r="3" fill={GOLD} />
      </svg>
    );
  }

  // Wordmark "Augusto.IJ"
  // Aspect ratio aproximada: 360 x (showTagline ? 110 : 80)
  const vbHeight = showTagline ? 110 : 80;
  const width = (height * 360) / vbHeight;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 360 ${vbHeight}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Augusto.IJ — Inteligência Jurídica para Condomínios"
    >
      <text
        x="0"
        y="58"
        fontFamily='"Cormorant Garamond", Georgia, serif'
        fontSize="64"
        fontWeight="500"
        fill={textColor}
        letterSpacing="-0.5"
      >
        Augusto
      </text>
      <text
        x="234"
        y="58"
        fontFamily='"Cormorant Garamond", Georgia, serif'
        fontSize="64"
        fontWeight="700"
        fill={GOLD}
      >
        .
      </text>
      <text
        x="252"
        y="58"
        fontFamily='"Inter", system-ui, sans-serif'
        fontSize="48"
        fontWeight="600"
        fill={textColor}
        letterSpacing="0"
      >
        IJ
      </text>
      {showTagline ? (
        <text
          x="2"
          y="96"
          fontFamily='"Inter", system-ui, sans-serif'
          fontSize="11"
          fontWeight="500"
          fill={isInverted ? CREAM : GREEN}
          letterSpacing="3"
        >
          INTELIGÊNCIA JURÍDICA PARA CONDOMÍNIOS
        </text>
      ) : null}
    </svg>
  );
};

export default AugustoLogo;