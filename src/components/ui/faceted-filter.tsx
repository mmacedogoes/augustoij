import * as React from "react";
import { Check, PlusCircle, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export interface FacetedFilterOption {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

export interface FacetedFilterProps {
  title?: string;
  options: FacetedFilterOption[];
  selectedValues?: Set<string> | string[];
  onSelect?: (values: Set<string>) => void;
  singleSelect?: boolean;
  onSingleSelect?: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function FacetedFilter({
  title,
  options,
  selectedValues: selectedProp,
  onSelect,
  singleSelect = false,
  onSingleSelect,
  className,
  placeholder,
}: FacetedFilterProps) {
  const [open, setOpen] = React.useState(false);

  const selectedSet = React.useMemo(() => {
    if (!selectedProp) return new Set<string>();
    if (selectedProp instanceof Set) return selectedProp;
    return new Set(selectedProp);
  }, [selectedProp]);

  const handleSelect = (value: string) => {
    if (singleSelect) {
      if (onSingleSelect) {
        onSingleSelect(value);
      } else if (onSelect) {
        const next = new Set<string>();
        if (!selectedSet.has(value)) {
          next.add(value);
        }
        onSelect(next);
      }
      setOpen(false);
      return;
    }

    const next = new Set(selectedSet);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onSelect?.(next);
  };

  const handleClear = () => {
    if (singleSelect && onSingleSelect) {
      onSingleSelect("");
    } else {
      onSelect?.(new Set());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 border-dashed border-border/70 bg-muted/20 hover:bg-muted/40 text-xs font-medium text-foreground transition-all duration-150",
            selectedSet.size > 0 && "border-solid border-augusto-gold/40 bg-augusto-gold/5",
            className
          )}
        >
          <PlusCircle className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
          {title}
          {selectedSet.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-2 h-4" />
              <Badge
                variant="secondary"
                className="rounded-sm px-1.5 font-semibold text-[10px] bg-augusto-gold/20 text-augusto-gold lg:hidden"
              >
                {selectedSet.size}
              </Badge>
              <div className="hidden space-x-1 lg:flex">
                {selectedSet.size > 2 ? (
                  <Badge
                    variant="secondary"
                    className="rounded-sm px-1.5 font-semibold text-[10px] bg-augusto-gold/20 text-augusto-gold"
                  >
                    {selectedSet.size} selecionados
                  </Badge>
                ) : (
                  options
                    .filter((opt) => selectedSet.has(opt.value))
                    .map((opt) => (
                      <Badge
                        variant="secondary"
                        key={opt.value}
                        className="rounded-sm px-1.5 font-semibold text-[10px] bg-augusto-gold/15 text-augusto-gold"
                      >
                        {opt.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder || title || "Filtrar..."} />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer text-xs"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary/40",
                        isSelected
                          ? "bg-augusto-gold text-white border-augusto-gold"
                          : "opacity-50 [&_svg]:invisible"
                      )}
                    >
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    {option.icon && (
                      <option.icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="truncate">{option.label}</span>
                    {option.count !== undefined && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                        {option.count}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedSet.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={handleClear}
                    className="justify-center text-center text-xs font-medium text-destructive cursor-pointer hover:bg-destructive/10"
                  >
                    Limpar filtro
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export interface FacetedFilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

export function FacetedFilterChip({ label, onRemove, className }: FacetedFilterChipProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium bg-augusto-gold/10 text-augusto-gold border border-augusto-gold/20 hover:bg-augusto-gold/15 transition-colors",
        className
      )}
    >
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-augusto-gold/20 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-augusto-gold"
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Remover filtro {label}</span>
      </button>
    </Badge>
  );
}
