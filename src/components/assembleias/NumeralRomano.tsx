import React from 'react';
import { paraRomano } from '@/lib/assembleias/romanos';
import { cn } from '@/lib/utils';

interface NumeralRomanoProps {
  n: number;
  className?: string;
}

export function NumeralRomano({ n, className }: NumeralRomanoProps) {
  return (
    <span 
      className={cn(
        "font-serif text-augusto-gold inline-block w-8 text-left",
        className
      )}
    >
      {paraRomano(n)}.
    </span>
  );
}
