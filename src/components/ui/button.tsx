import React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 [a]:hover:bg-primary/90",
        outline:
          "border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950 aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:text-slate-200 dark:hover:bg-input/50 dark:hover:text-slate-50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-slate-200 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground dark:hover:bg-slate-700",
        ghost:
          "hover:bg-slate-100 hover:text-slate-950 aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50 dark:hover:text-slate-50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        "destructive-solid":
          "bg-destructive text-white shadow-sm hover:bg-destructive/90 focus-visible:border-destructive/40 focus-visible:ring-destructive/30",
        success:
          "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 focus-visible:border-emerald-400 focus-visible:ring-emerald-500/30",
        "success-soft":
          "bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 focus-visible:border-emerald-300 focus-visible:ring-emerald-500/20 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25",
        warning:
          "bg-amber-500 text-white shadow-sm hover:bg-amber-600 focus-visible:border-amber-400 focus-visible:ring-amber-500/30",
        "warning-soft":
          "bg-amber-50 text-amber-700 shadow-sm hover:bg-amber-100 focus-visible:border-amber-300 focus-visible:ring-amber-500/20 dark:bg-amber-500/15 dark:hover:bg-amber-500/25",
        info:
          "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:border-blue-400 focus-visible:ring-blue-500/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-1.5 px-3.5 text-[0.95rem] has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-7 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 rounded-[min(var(--radius-md),12px)] px-3 text-sm in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-1.5 px-4 text-base has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-10",
        "icon-xs":
          "size-7 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-8 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
