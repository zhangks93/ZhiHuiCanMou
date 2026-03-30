/**
 * 智汇参谋 · 精编智感 — Editorial Intelligence Theme
 * ====================================================
 * 全局唯一设计令牌（Design Tokens）配置文件
 * 修改此文件即可快速调整全局 UI 样式
 */

export const colors = {
  primary: {
    DEFAULT: '#304766',
    light: '#4b6485',
    dark: '#223247',
    50: '#f3f6fa',
    100: '#e3e9f1',
    200: '#c6d1df',
    300: '#a9b9cd',
    400: '#7f95b0',
    500: '#304766',
    600: '#283c56',
    700: '#223247',
    800: '#1a2535',
    900: '#121b28',
  },
  accent: {
    DEFAULT: '#5f7fbc',
    hover: '#4f6fae',
    50: '#f4f7fc',
    100: '#e6edf8',
    200: '#d4dff1',
    300: '#bccce7',
    400: '#97afd5',
    500: '#5f7fbc',
    600: '#4f6fae',
    700: '#425f99',
  },
  background: '#edf3f9',
  backgroundElevated: '#f8fbff',
  surface: '#ffffff',
  surfaceMuted: '#eef4fb',
  success: {
    DEFAULT: '#059669',
    light: '#0f9f6e',
    100: '#d1fae5',
    200: '#a7f3d0',
    500: '#059669',
    700: '#047857',
    text: '#08724d',
  },
  warning: {
    DEFAULT: '#d97706',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#d97706',
    700: '#b45309',
    text: '#a55406',
  },
  error: {
    DEFAULT: '#dc2626',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#dc2626',
    700: '#b91c1c',
    text: '#b42318',
  },
  text: {
    DEFAULT: '#1e293b',
    strong: '#0f172a',
    muted: '#64748b',
  },
  border: {
    DEFAULT: 'rgba(148, 163, 184, 0.22)',
    strong: 'rgba(71, 85, 105, 0.22)',
  },
} as const

export const alpha = {
  accent: {
    '4': 'rgba(95, 127, 188, 0.04)',
    '8': 'rgba(95, 127, 188, 0.08)',
    '10': 'rgba(95, 127, 188, 0.10)',
    '12': 'rgba(95, 127, 188, 0.12)',
    '14': 'rgba(95, 127, 188, 0.14)',
    '16': 'rgba(95, 127, 188, 0.16)',
    '18': 'rgba(95, 127, 188, 0.18)',
    '24': 'rgba(95, 127, 188, 0.24)',
    '25': 'rgba(95, 127, 188, 0.25)',
    '28': 'rgba(95, 127, 188, 0.28)',
    '42': 'rgba(95, 127, 188, 0.42)',
  },
  dark: {
    '3': 'rgba(15, 23, 42, 0.03)',
    '4': 'rgba(15, 23, 42, 0.04)',
    '5': 'rgba(15, 23, 42, 0.05)',
    '6': 'rgba(15, 23, 42, 0.06)',
    '8': 'rgba(15, 23, 42, 0.08)',
    '10': 'rgba(15, 23, 42, 0.10)',
    '12': 'rgba(15, 23, 42, 0.12)',
    '20': 'rgba(15, 23, 42, 0.20)',
    '28': 'rgba(15, 23, 42, 0.28)',
  },
  success: {
    '10': 'rgba(15, 159, 110, 0.10)',
    '12': 'rgba(15, 159, 110, 0.12)',
    '18': 'rgba(15, 159, 110, 0.18)',
  },
  warning: {
    '8': 'rgba(217, 119, 6, 0.08)',
    '10': 'rgba(217, 119, 6, 0.10)',
    '12': 'rgba(217, 119, 6, 0.12)',
    '14': 'rgba(217, 119, 6, 0.14)',
    '18': 'rgba(217, 119, 6, 0.18)',
  },
  error: {
    '7': 'rgba(220, 38, 38, 0.07)',
    '8': 'rgba(220, 38, 38, 0.08)',
    '10': 'rgba(220, 38, 38, 0.10)',
    '12': 'rgba(220, 38, 38, 0.12)',
    '14': 'rgba(220, 38, 38, 0.14)',
    '18': 'rgba(220, 38, 38, 0.18)',
  },
  white: {
    '28': 'rgba(255, 255, 255, 0.28)',
    '30': 'rgba(255, 255, 255, 0.30)',
    '35': 'rgba(255, 255, 255, 0.35)',
    '40': 'rgba(255, 255, 255, 0.40)',
    '42': 'rgba(255, 255, 255, 0.42)',
    '45': 'rgba(255, 255, 255, 0.45)',
    '50': 'rgba(255, 255, 255, 0.50)',
    '56': 'rgba(255, 255, 255, 0.56)',
    '60': 'rgba(255, 255, 255, 0.60)',
    '70': 'rgba(255, 255, 255, 0.70)',
    '72': 'rgba(255, 255, 255, 0.72)',
    '80': 'rgba(255, 255, 255, 0.80)',
    '82': 'rgba(255, 255, 255, 0.82)',
    '86': 'rgba(255, 255, 255, 0.86)',
    '88': 'rgba(255, 255, 255, 0.88)',
    '90': 'rgba(255, 255, 255, 0.90)',
    '92': 'rgba(255, 255, 255, 0.92)',
    '94': 'rgba(255, 255, 255, 0.94)',
    '96': 'rgba(255, 255, 255, 0.96)',
  },
} as const

export const fonts = {
  body: '"Source Han Sans SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  heading: '"Source Han Sans SC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  sans: ['"Source Han Sans SC"', '"Noto Sans SC"', 'PingFang SC', '"Microsoft YaHei"', 'sans-serif'],
  serif: ['"Source Han Sans SC"', '"Noto Sans SC"', 'PingFang SC', '"Microsoft YaHei"', 'sans-serif'],
  mono: ['"Source Han Sans SC"', '"Noto Sans SC"', 'PingFang SC', '"Microsoft YaHei"', 'sans-serif'],
} as const

export const fontSize = {
  caption: '0.75rem',
  body: '0.875rem',
  subtitle: '1rem',
  title: '1.25rem',
  '2xs': '0.75rem',
  xs: '0.75rem',
  sm: '0.75rem',
  base: '0.875rem',
  md: '0.875rem',
  lg: '1rem',
  xl: '1rem',
  '2xl': '1.25rem',
  '3xl': '1.25rem',
  '4xl': '1.25rem',
  '5xl': '1.25rem',
} as const

export const fontWeight = {
  regular: '400',
  medium: '500',
} as const

export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  input: '1.05rem',
  btn: '1.1rem',
  card: '20px',
  sidebar: '22px',
  section: '24px',
  panel: '28px',
  modal: '30px',
  hero: '32px',
  pill: '9999px',
} as const

export const shadow = {
  xs: '0 1px 2px rgba(15, 23, 42, 0.05)',
  card: '0 2px 8px rgba(26, 39, 68, 0.06)',
  soft: '0 18px 54px rgba(15, 23, 42, 0.08)',
  cardHover: '0 8px 24px rgba(26, 39, 68, 0.08)',
  panelHover: '0 24px 72px rgba(15, 23, 42, 0.13)',
  tooltip: '0 12px 32px rgba(15, 23, 42, 0.12)',
  modal: '0 30px 72px rgba(15, 23, 42, 0.2)',
  sidebar: '0 24px 64px rgba(15, 23, 42, 0.10)',
  innerSoft: 'inset 0 1px 1px rgba(255, 255, 255, 0.5)',
  innerWhite: 'inset 0 1px 0 rgba(255, 255, 255, 0.7)',
  innerWhiteStrong: 'inset 0 1px 0 rgba(255, 255, 255, 0.75)',
  btnPrimary: '0 14px 32px rgba(95, 127, 188, 0.20)',
  btnError: '0 14px 32px rgba(220, 38, 38, 0.18)',
  focusRing: '0 0 0 4px rgba(95, 127, 188, 0.08)',
  chatActive: '0 10px 24px rgba(95, 127, 188, 0.10)',
} as const

export const layout = {
  sidebarWidth: '186px',
  sidebarWidthCollapsed: '69px',
  headerHeight: '72px',
  chatMaxWidth: '56rem',
  chatMessageMaxWidth: '50rem',
  chatUserMessageMaxWidth: '36rem',
  modalMaxWidth: '40rem',
  chatSidebarWidth: '16.5rem',
  chatSidebarWidthMobile: 'min(22rem, 88vw)',
  chatSidebarWidthCollapsed: '5.75rem',
} as const

export const glass = {
  blur: {
    sm: 'blur(8px)',
    md: 'blur(12px)',
    DEFAULT: 'blur(16px)',
    lg: 'blur(18px)',
    xl: 'blur(20px)',
    '2xl': 'blur(22px)',
    '3xl': 'blur(24px)',
  },
} as const

export const transition = {
  fast: '160ms ease',
  normal: '200ms ease',
  smooth: '180ms ease-out',
} as const

export const animation = {
  fadeIn: 'fadeIn 0.4s ease-out forwards',
  slideUp: 'slideUp 0.35s ease-out forwards',
  slideUpSmooth: 'slide-up 420ms cubic-bezier(0.16, 1, 0.3, 1)',
  fadeInSoft: 'fade-in 320ms ease-out',
  scaleIn: 'scale-in 380ms cubic-bezier(0.16, 1, 0.3, 1)',
  pulseGlow: 'pulse-glow 2.4s ease-in-out infinite',
  breathe: 'breathe 2s ease-in-out infinite',
} as const

export const gradient = {
  pageBackground: [
    'radial-gradient(circle at 8% 10%, rgba(95, 127, 188, 0.12), transparent 24%)',
    'radial-gradient(circle at 88% 8%, rgba(142, 169, 213, 0.08), transparent 26%)',
    'radial-gradient(circle at 82% 82%, rgba(15, 23, 42, 0.06), transparent 22%)',
    'linear-gradient(180deg, #f8fbff 0%, #eff4fb 48%, #edf2f8 100%)',
  ].join(', '),
  btnPrimary: 'linear-gradient(135deg, #4f6fae, #5f7fbc 56%, #7d99ca)',
  btnPrimaryHover: 'linear-gradient(135deg, #425f99, #4f6fae 56%, #5f7fbc)',
  btnError: 'linear-gradient(135deg, #b91c1c, #dc2626)',
  avatarUser: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
  emptyIcon: 'linear-gradient(135deg, #0f172a, #1e293b)',
} as const

export const daisyTheme = {
  primary: colors.primary.DEFAULT,
  'primary-content': '#ffffff',
  secondary: colors.primary.dark,
  accent: colors.accent.DEFAULT,
  neutral: '#1a202c',
  'neutral-content': '#f9fafb',
  'base-100': colors.surface,
  'base-200': colors.background,
  'base-300': '#e8e6e3',
  'base-content': '#2d3748',
  info: colors.accent.DEFAULT,
  success: colors.success.DEFAULT,
  'success-content': '#ffffff',
  warning: colors.warning.DEFAULT,
  'warning-content': '#1a202c',
  error: colors.error.DEFAULT,
  'error-content': '#ffffff',
} as const

const theme = {
  colors,
  alpha,
  fonts,
  fontSize,
  fontWeight,
  radius,
  shadow,
  layout,
  glass,
  transition,
  animation,
  gradient,
  daisyTheme,
} as const

export type Theme = typeof theme
export default theme
