import { Eyebrow } from "./Eyebrow";
import { cn } from "@/lib/utils";

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
  titleClassName,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
  titleClassName?: string;
}) {
  const isCenter = align === "center";
  return (
    <div className={cn(isCenter ? "mx-auto flex flex-col items-center text-center" : "text-left", "max-w-3xl")}>
      <Eyebrow align={align}>{eyebrow}</Eyebrow>
      <h2
        className={cn(
          "mt-6 font-serif text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.96] tracking-[-0.035em] text-augusto-green",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-6 text-[17px] leading-[1.75] text-augusto-slate sm:text-lg",
            isCenter && "mx-auto max-w-[600px]",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default SectionHeader;