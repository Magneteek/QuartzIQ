"use client"

import * as React from "react"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

interface CheckboxProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, onClick, ...props }, ref) => (
    <div
      ref={ref}
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      className={cn(
        "h-4 w-4 shrink-0 rounded-sm border border-primary bg-background cursor-pointer transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "hover:border-primary/80",
        checked && "bg-primary border-primary",
        className
      )}
      onClick={(e) => {
        onClick?.(e)
        onCheckedChange?.(!checked)
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onCheckedChange?.(!checked)
        }
      }}
      {...props}
    >
      {checked && (
        <div className="flex items-center justify-center w-full h-full text-primary-foreground">
          <Check className="h-3 w-3" />
        </div>
      )}
    </div>
  )
)
Checkbox.displayName = "Checkbox"

export { Checkbox }