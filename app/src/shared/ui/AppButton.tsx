import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type AppButtonSize = 'sm' | 'md'

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: AppButtonVariant
  size?: AppButtonSize
}

const variantClass: Record<AppButtonVariant, string> = {
  primary: 'app-button-primary',
  secondary: 'app-button-secondary',
  ghost: 'app-button-ghost',
  danger: 'app-button-danger',
}

const sizeClass: Record<AppButtonSize, string> = {
  sm: 'app-button-sm',
  md: 'app-button-md',
}

export function AppButton({
  children,
  className = '',
  variant = 'secondary',
  size = 'md',
  type = 'button',
  ...props
}: AppButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['app-button', variantClass[variant], sizeClass[size], className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
