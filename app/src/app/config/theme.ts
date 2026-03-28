/**
 * Centralized theme/color configuration.
 * McKinsey-inspired: 专业、简洁、大方，以深海军蓝与克制灰阶为主。
 *
 * When changing colors here, also update tailwind.config.js theme.extend.colors
 */

export const theme = {
  /** 主色 - 深海军蓝，专业权威 */
  primary: '#1e3a5f',

  /** 背景色 - 浅灰白，干净利落 */
  background: '#f7f8fa',

  /** 辅助色/强调 - 用于次要层次 */
  accent: '#2d4a6f',

  /** 成功 - 低调绿色 */
  success: '#047857',

  /** 警告 - 克制琥珀色 */
  warning: '#b45309',

  /** 错误 -  restrained red */
  error: '#b91c1c',

  /** 卡片/面板背景 */
  surface: '#ffffff',

  /** 边框 */
  border: '#e5e7eb',

  /** 次级边框 */
  borderStrong: '#d1d5db',

  /** 正文 */
  text: '#374151',

  /** 次级文字 */
  textMuted: '#6b7280',

  /** 标题 */
  textHeading: '#1f2937',
} as const
