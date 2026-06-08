import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary-foreground/95 backdrop-blur-sm",
        secondary: "border-secondary/30 bg-secondary/15 text-foreground backdrop-blur-sm",
        destructive: "border-destructive/30 bg-destructive/15 text-destructive backdrop-blur-sm",
        success: "border-success/30 bg-success/15 text-success backdrop-blur-sm",
        warning: "border-warning/30 bg-warning/15 text-warning backdrop-blur-sm",
        outline: "border-white/15 bg-card/40 text-foreground backdrop-blur-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
