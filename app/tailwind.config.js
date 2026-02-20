/** @type {import('tailwindcss').Config} */
/** 智汇参谋 · 精编智感 - Editorial Intelligence Theme */
const colors = {
  primary: {
    DEFAULT: '#1a2744',
    light: '#2d3f5c',
    dark: '#0f1828',
    50: '#f0f2f5',
    100: '#dde1e8',
    200: '#bcc4d4',
    300: '#9aa5bd',
    400: '#7887a6',
    500: '#1a2744',
    600: '#16203a',
    700: '#0f1828',
    800: '#0c1220',
    900: '#080d18',
  },
  accent: {
    DEFAULT: '#0d9488',
    hover: '#0f766e',
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#0d9488',
    600: '#0f766e',
    700: '#115e59',
  },
  background: '#f9f8f6',
  surface: '#ffffff',
  success: {
    DEFAULT: '#059669',
    100: '#d1fae5',
    200: '#a7f3d0',
    500: '#059669',
    700: '#047857',
  },
  warning: {
    DEFAULT: '#d97706',
    100: '#fef3c7',
    200: '#fde68a',
    500: '#d97706',
    700: '#b45309',
  },
  error: {
    DEFAULT: '#dc2626',
    100: '#fee2e2',
    200: '#fecaca',
    500: '#dc2626',
    700: '#b91c1c',
  },
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        serif: ['Noto Serif SC', 'Noto Sans SC', 'serif'],
      },
      colors: {
        primary: colors.primary,
        accent: colors.accent,
        background: colors.background,
        surface: colors.surface,
        success: colors.success,
        warning: colors.warning,
        error: colors.error,
      },
      boxShadow: {
        'card': '0 2px 8px rgb(26 39 68 / 0.06)',
        'card-hover': '0 8px 24px rgb(26 39 68 / 0.08)',
        'inner-soft': 'inset 0 1px 1px rgb(255 255 255 / 0.5)',
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
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        canmou: {
          "primary": colors.primary.DEFAULT,
          "primary-content": "#ffffff",
          "secondary": colors.primary.dark,
          "accent": colors.accent.DEFAULT,
          "neutral": "#1a202c",
          "neutral-content": "#f9fafb",
          "base-100": colors.surface,
          "base-200": colors.background,
          "base-300": "#e8e6e3",
          "base-content": "#2d3748",
          "info": colors.accent.DEFAULT,
          "success": colors.success.DEFAULT,
          "success-content": "#ffffff",
          "warning": colors.warning.DEFAULT,
          "warning-content": "#1a202c",
          "error": colors.error.DEFAULT,
          "error-content": "#ffffff",
        },
      },
    ],
    darkTheme: false,
  },
}
