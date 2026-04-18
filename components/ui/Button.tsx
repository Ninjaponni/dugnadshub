'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'confirm'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children?: React.ReactNode
}

const variants: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'bg-surface-low text-text-primary hover:bg-surface-low/80',
  ghost: 'text-accent hover:bg-accent/5',
  danger: 'bg-danger/10 text-danger hover:bg-danger/20',
  confirm: 'bg-success text-white hover:bg-success/90',
}

const sizes: Record<Size, string> = {
  sm: 'px-4 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-[15px]',
  lg: 'px-8 py-3.5 text-[17px]',
}

// Knapp med claymorphism-stil — gradient primær, varm palett
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, style, ...props }, ref) => {
    // Gradient-bakgrunn for primær-knapp
    const gradientStyle = variant === 'primary'
      ? { ...style, background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }
      : style

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`
          inline-flex items-center justify-center gap-2
          font-semibold font-[var(--font-display)]
          rounded-full
          transition-colors duration-150
          disabled:opacity-40 disabled:pointer-events-none
          ${variants[variant]} ${sizes[size]} ${className}
        `}
        style={gradientStyle}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
export default Button
