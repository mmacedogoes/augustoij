import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ExpandableText({ text, limit = 200 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  
  if (text.length <= limit) {
    return <p className="text-sm leading-relaxed text-foreground text-justify">{text}</p>;
  }

  return (
    <div className="space-y-1">
      <p className={`text-sm leading-relaxed text-foreground text-justify ${expanded ? "" : "line-clamp-3"}`}>
        {text}
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 text-xs text-augusto-gold hover:text-augusto-gold/80 hover:bg-transparent"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <>
            <ChevronUp className="mr-1 h-3 w-3" /> Ver menos
          </>
        ) : (
          <>
            <ChevronDown className="mr-1 h-3 w-3" /> Ver mais
          </>
        )}
      </Button>
    </div>
  );
}
