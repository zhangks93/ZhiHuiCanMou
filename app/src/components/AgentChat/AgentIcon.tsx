import { BarChart3, Bot, type LucideIcon } from 'lucide-react'

import type { AgentIcon as AgentIconConfig } from '@/lib/agent/types'

const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  BarChart3,
  Bot,
}

interface AgentIconProps {
  icon?: AgentIconConfig
  size?: number
  strokeWidth?: number
  className?: string
}

export function AgentIcon({
  icon,
  size = 18,
  strokeWidth = 1.8,
  className,
}: AgentIconProps) {
  if (!icon) {
    return <Bot size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />
  }

  if (icon.type === 'emoji') {
    return <span className={className} aria-hidden="true">{icon.value}</span>
  }

  const Icon = LUCIDE_ICON_MAP[icon.value] ?? Bot
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />
}
