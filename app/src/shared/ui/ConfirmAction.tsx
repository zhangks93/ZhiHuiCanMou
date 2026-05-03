import type { ReactNode } from 'react'

interface ConfirmActionProps {
  message: string
  onConfirm: () => void
  children: (confirm: () => void) => ReactNode
}

export function ConfirmAction({ message, onConfirm, children }: ConfirmActionProps) {
  const confirm = () => {
    if (window.confirm(message)) {
      onConfirm()
    }
  }

  return <>{children(confirm)}</>
}
