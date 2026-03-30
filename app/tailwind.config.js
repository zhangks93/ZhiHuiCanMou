/** @type {import('tailwindcss').Config} */
/**
 * 智汇参谋 · 精编智感 - Editorial Intelligence Theme
 * 所有设计令牌统一来自 src/theme.ts，此处仅做 Tailwind 桥接
 */
import theme from './src/theme.ts'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: theme.fonts.sans,
        serif: theme.fonts.serif,
        mono: theme.fonts.mono,
      },
      colors: {
        primary: theme.colors.primary,
        accent: theme.colors.accent,
        background: theme.colors.background,
        surface: theme.colors.surface,
        success: theme.colors.success,
        warning: theme.colors.warning,
        error: theme.colors.error,
      },
      fontSize: {
        'caption': theme.fontSize.caption,
        'body': theme.fontSize.body,
        'subtitle': theme.fontSize.subtitle,
        'title': theme.fontSize.title,
        '2xs': theme.fontSize['2xs'],
        'xs': theme.fontSize.xs,
        'sm': theme.fontSize.sm,
        'base': theme.fontSize.base,
        'md': theme.fontSize.md,
        'lg': theme.fontSize.lg,
        'xl': theme.fontSize.xl,
        '2xl': theme.fontSize['2xl'],
        '3xl': theme.fontSize['3xl'],
        '4xl': theme.fontSize['4xl'],
        '5xl': theme.fontSize['5xl'],
      },
      fontWeight: {
        normal: theme.fontWeight.regular,
        medium: theme.fontWeight.medium,
        semibold: theme.fontWeight.medium,
        bold: theme.fontWeight.medium,
        extrabold: theme.fontWeight.medium,
        black: theme.fontWeight.medium,
      },
      borderRadius: {
        'card': theme.radius.card,
        'sidebar': theme.radius.sidebar,
        'section': theme.radius.section,
        'panel': theme.radius.panel,
        'modal': theme.radius.modal,
        'hero': theme.radius.hero,
        'pill': theme.radius.pill,
        'btn': theme.radius.btn,
        'input': theme.radius.input,
      },
      boxShadow: {
        'xs': theme.shadow.xs,
        'card': theme.shadow.card,
        'soft': theme.shadow.soft,
        'card-hover': theme.shadow.cardHover,
        'panel-hover': theme.shadow.panelHover,
        'tooltip': theme.shadow.tooltip,
        'modal': theme.shadow.modal,
        'sidebar': theme.shadow.sidebar,
        'inner-soft': theme.shadow.innerSoft,
        'inner-white': theme.shadow.innerWhite,
        'inner-white-strong': theme.shadow.innerWhiteStrong,
        'btn-primary': theme.shadow.btnPrimary,
        'btn-error': theme.shadow.btnError,
        'focus-ring': theme.shadow.focusRing,
        'chat-active': theme.shadow.chatActive,
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'slide-up': 'slideUp 0.35s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  daisyui: {
    themes: [
      {
        canmou: theme.daisyTheme,
      },
    ],
    darkTheme: false,
  },
}
