export function ArcoAugusto({
  width = 44,
  color = "currentColor",
  opacity = 1,
  strokeWidth,
  className,
  ariaHidden = true,
}: {
  width?: number;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  className?: string;
  ariaHidden?: boolean;
}) {
  const height = width * (22 / 64);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 64 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
      style={{ opacity, color }}
    >
      <path
        d="M4 20 A14 14 0 0 1 32 20"
        stroke="currentColor"
        strokeWidth={strokeWidth ?? 2}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 20 A14 14 0 0 1 60 20"
        stroke="currentColor"
        strokeWidth={strokeWidth ?? 2}
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="32" cy="9" r="2.6" fill="#B8935A" />
    </svg>
  );
}

export default ArcoAugusto;