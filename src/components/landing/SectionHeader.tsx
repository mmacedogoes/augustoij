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
    <div className={cn(isCenter ? "text-center mx-auto" : "text-left", "max-w-3xl")}>
      <Eyebrow align={align}>{eyebrow}</Eyebrow>
      <h2
        className={cn(
          "mt-5 font-serif text-augusto-green leading-[1.1] text-4xl md:text-5xl",
          titleClassName,
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-5 text-augusto-slate text-lg leading-relaxed",
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