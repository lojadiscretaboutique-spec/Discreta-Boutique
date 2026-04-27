import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: 'default' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : "button"
    
    const variants = {
      default: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
      outline: "border-2 border-slate-200 bg-transparent hover:bg-slate-100 text-slate-900",
      ghost: "bg-transparent hover:bg-slate-100 text-slate-900",
      danger: "bg-transparent text-red-600 hover:bg-red-100"
    };
    const sizes = {
      sm: "h-9 rounded-md px-3",
      md: "h-11 px-6 rounded-md",
      lg: "h-12 rounded-md px-8 text-lg font-medium",
      icon: "h-10 w-10 flex items-center justify-center p-0",
      default: "h-10 px-4 py-2" // Added default fallback just in case
    };
    
    return (
      <Component
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:pointer-events-none disabled:opacity-50",
          variants[variant] || variants.default,
          sizes[size] || sizes.md,
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
