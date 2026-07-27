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
  const height = width * (24 / 44);
  const sw = strokeWidth ?? Math.max(1, width / 44);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 44 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden={ariaHidden}
      style={{ opacity }}
    >
      <path d="M2 22 C 2 12, 10 4, 22 4" stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d="M22 4 C 34 4, 42 12, 42 22" stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <circle cx="22" cy="2" r={sw * 0.9} fill={color} />
    </svg>
  );
}

export default ArcoAugusto;