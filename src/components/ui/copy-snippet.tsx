import * as React from "react";
import { Check, Copy, Download, FileText, Terminal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CopySnippetProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  title?: string;
  badge?: string;
  icon?: React.ReactNode;
  showLineNumbers?: boolean;
  maxHeight?: string;
  downloadFileName?: string;
  variant?: "default" | "bordered" | "ghost" | "gold";
}

export const CopySnippet = React.forwardRef<HTMLDivElement, CopySnippetProps>(
  (
    {
      className,
      value,
      title,
      badge,
      icon,
      showLineNumbers = false,
      maxHeight = "320px",
      downloadFileName,
      variant = "default",
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copiado para a área de transferência");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error("Não foi possível copiar");
      }
    };

    const handleDownload = () => {
      if (!downloadFileName) return;
      try {
        const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = downloadFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`Arquivo ${downloadFileName} baixado`);
      } catch (e) {
        toast.error("Erro ao baixar arquivo");
      }
    };

    const lines = React.useMemo(() => value.split("\n"), [value]);

    const variantClasses = {
      default: "border-border/60 bg-muted/20",
      bordered: "border-border bg-card shadow-xs",
      ghost: "border-transparent bg-transparent",
      gold: "border-augusto-gold/30 bg-augusto-gold/[0.03]",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "group relative my-3 overflow-hidden rounded-xl border text-xs transition-all duration-200",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {/* Header Bar */}
        {(title || badge || downloadFileName || true) && (
          <div className="flex items-center justify-between border-b border-border/40 bg-muted/40 px-3.5 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-muted-foreground shrink-0">
                {icon || <FileText className="h-3.5 w-3.5 text-augusto-gold" />}
              </span>
              {title && (
                <span className="font-semibold text-foreground truncate text-[11px] uppercase tracking-wider">
                  {title}
                </span>
              )}
              {badge && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4 bg-background/80 font-medium"
                >
                  {badge}
                </Badge>
              )}
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1 shrink-0">
              {downloadFileName && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-background/80"
                  title="Baixar como arquivo"
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">Baixar</span>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className={cn(
                  "h-7 px-2 text-[11px] font-medium transition-colors",
                  copied
                    ? "text-augusto-green hover:text-augusto-green bg-augusto-green/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                )}
                title="Copiar texto"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-augusto-green" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    <span>Copiar</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div
          className="overflow-auto p-3.5 font-mono text-[12px] leading-relaxed text-foreground select-text"
          style={{ maxHeight }}
        >
          {showLineNumbers ? (
            <div className="table w-full">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row">
                  <span className="table-cell pr-3 select-none text-right font-mono text-[10px] text-muted-foreground/50 w-8">
                    {idx + 1}
                  </span>
                  <span className="table-cell whitespace-pre-wrap break-words">{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-xs">{value}</pre>
          )}
        </div>
      </div>
    );
  }
);
CopySnippet.displayName = "CopySnippet";
