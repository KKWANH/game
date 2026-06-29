'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-lg border border-input bg-background/60 px-3 text-sm',
        'placeholder:text-muted-foreground focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring transition',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-xs font-medium uppercase tracking-wide text-muted-foreground', className)}
      {...props}
    />
  )
}

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-xl',
        className
      )}
      {...props}
    />
  )
}
