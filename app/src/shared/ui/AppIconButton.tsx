import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AppIconButtonVariant = 'ghost' | 'secondary' | 'danger'
type AppIconButtonSize = 'sm' | 'md'

interface AppIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string
  children: ReactNode
  variant?: AppIconButtonVariant
  size?: AppIconButtonSize
}

const variantClass: Record<AppIconButtonVariant, string> = {
  ghost: 'app-icon-button-ghost',
  secondary: 'app-icon-button-secondary',
  danger: 'app-icon-button-danger',
}

const sizeClass: Record<AppIconButtonSize, string> = {
  sm: 'app-icon-button-sm',
  md: 'app-icon-button-md',
}

export function AppIconButton({
  label,
  children,
  className = '',
  variant = 'ghost',
  size = 'md',
  title,
  type = 'button',
  ...props
}: AppIconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={label}
      title={title ?? label}
      className={['app-icon-button', variantClass[variant], sizeClass[size], className].filter(Boolean).join(' ')}
    >
      {children}
    </button>
  )
}
