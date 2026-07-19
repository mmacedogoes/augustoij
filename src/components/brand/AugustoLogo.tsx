import React from "react";

export type AugustoLogoVariant =
  | "icon-only"
  | "horizontal"
  | "stacked"
  | "full"
  | "wordmark-only";

interface AugustoLogoProps {
  variant?: AugustoLogoVariant;
  theme?: "light" | "dark";
  /** largura desejada em px (varia por variante) */
  size?: number;
  showTagline?: boolean;
  className?: string;
}

const GREEN = "var(--augusto-green)";
const GOLD = "var(--augusto-gold)";
const CREAM = "var(--augusto-cream)";

const DEFAULT_SIZE: Record<AugustoLogoVariant, number> = {
  "icon-only": 40,
  horizontal: 160,
  stacked: 200,
  full: 220,
  "wordmark-only": 140,
};

function Symbol({ width, color, gold }: { width: number; color: string; gold: string }) {
  const height = (width * 60) / 200;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 60"
      width={width}
      height={height}
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <line x1="10" y1="12" x2="190" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M 10 44 A 30 30 0 0 1 70 44 A 30 30 0 0 1 130 44 A 30 30 0 0 1 190 44"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="100" cy="29" r="5" fill={gold} />
    </svg>
  );
}

function Wordmark({ fontSize, color }: { fontSize: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: '"Cormorant Garamond", Georgia, serif',
        fontSize: `${fontSize}px`,
        fontWeight: 500,
        color,
        lineHeight: 1.15,
        letterSpacing: "-0.01em",
        display: "inline-flex",
        alignItems: "baseline",
        whiteSpace: "nowrap",
        paddingBottom: "0.12em",
      }}
    >
      <span>Augusto</span>
      <span style={{ color: GOLD, fontWeight: 700 }}>.</span>
      <span
        style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          fontWeight: 600,
          fontSize: `${fontSize * 0.78}px`,
          marginLeft: 2,
        }}
      >
        IJ
      </span>
    </span>
  );
}

function Tagline({ fontSize, color }: { fontSize: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: `${fontSize}px`,
        fontWeight: 500,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color,
        whiteSpace: "nowrap",
      }}
    >
      Inteligência Jurídica para Condomínios
    </span>
  );
}

export const AugustoLogo: React.FC<AugustoLogoProps> = ({
  variant = "horizontal",
  theme = "light",
  size,
  showTagline = false,
  className = "",
}) => {
  const lineColor = theme === "dark" ? CREAM : GREEN;
  const textColor = theme === "dark" ? CREAM : GREEN;
  const finalSize = size ?? DEFAULT_SIZE[variant];

  if (variant === "icon-only") {
    return (
      <span className={className} style={{ display: "inline-flex", maxWidth: "100%" }}>
        <Symbol width={finalSize} color={lineColor} gold={GOLD} />
      </span>
    );
  }

  if (variant === "wordmark-only") {
    return (
      <span className={className} style={{ display: "inline-flex", maxWidth: "100%" }}>
        <Wordmark fontSize={finalSize * 0.22} color={textColor} />
      </span>
    );
  }

  if (variant === "horizontal") {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: `${finalSize * 0.07}px`,
          maxWidth: "100%",
          overflow: "visible",
        }}
      >
        <Symbol width={finalSize * 0.55} color={lineColor} gold={GOLD} />
        <Wordmark fontSize={finalSize * 0.16} color={textColor} />
      </span>
    );
  }

  if (variant === "stacked") {
    return (
      <span
        className={className}
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          gap: `${finalSize * 0.04}px`,
          maxWidth: "100%",
        }}
      >
        <Symbol width={finalSize} color={lineColor} gold={GOLD} />
        <Wordmark fontSize={finalSize * 0.22} color={textColor} />
        {showTagline && <Tagline fontSize={finalSize * 0.058} color={GOLD} />}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: `${finalSize * 0.05}px`,
        maxWidth: "100%",
      }}
    >
      <Symbol width={finalSize} color={lineColor} gold={GOLD} />
      <Wordmark fontSize={finalSize * 0.18} color={textColor} />
      <Tagline fontSize={finalSize * 0.052} color={GOLD} />
    </span>
  );
};

export default AugustoLogo;
