import React from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'text'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ReactNode
  iconRight?: React.ReactNode
  isIconOnly?: boolean
  isLoading?: boolean
  danger?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      icon,
      iconRight,
      isIconOnly = false,
      isLoading = false,
      danger = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClass = 'btn'
    const variantClass = `btn-${variant}`
    const sizeClass = `btn-${size}`
    const dangerClass = danger ? 'btn-danger' : ''
    const iconOnlyClass = isIconOnly ? 'btn-icon-only' : ''
    const loadingClass = isLoading ? 'btn-loading' : ''

    const combinedClasses = [
      baseClass,
      variantClass,
      sizeClass,
      dangerClass,
      iconOnlyClass,
      loadingClass,
      className
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={ref}
        className={combinedClasses}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="btn-spinner" size={16} />}
        {!isLoading && icon && <span className="btn-icon-left">{icon}</span>}
        {(!isIconOnly || isLoading === false) && children && (
          <span className="btn-label">{children}</span>
        )}
        {!isLoading && iconRight && <span className="btn-icon-right">{iconRight}</span>}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
