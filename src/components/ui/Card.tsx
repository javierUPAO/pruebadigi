'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type PaddingSize = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  padding?: PaddingSize;
}

const PADDING: Record<PaddingSize, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ interactive, padding = 'md', className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-white border border-slate-200 rounded-2xl shadow-xs',
        PADDING[padding],
        interactive && 'transition-all hover:shadow-md hover:scale-[1.01]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

Card.displayName = 'Card';
