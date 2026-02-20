/** @type {import('tailwindcss').Config} */
/** McKinsey-inspired: 专业简洁，深海军蓝与克制灰阶 */
const themeColors = {
  primary: '#1e3a5f',
  primaryDark: '#152942',
  background: '#f7f8fa',
  surface: '#ffffff',
  success: '#047857',
  warning: '#b45309',
  error: '#b91c1c',
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
      },
      colors: {
        primary: {
          DEFAULT: themeColors.primary,
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: themeColors.primary,
          600: '#1e3a5f',
          700: themeColors.primaryDark,
          800: '#0f2744',
          900: '#102a43',
        },
        background: themeColors.background,
        surface: themeColors.surface,
        accent: themeColors.primaryDark,
        success: {
          DEFAULT: themeColors.success,
          100: '#d1fae5',
          200: '#a7f3d0',
          500: themeColors.success,
          700: '#047857',
        },
        warning: {
          DEFAULT: themeColors.warning,
          100: '#fffbeb',
          200: '#fef3c7',
          500: themeColors.warning,
          700: '#92400e',
        },
        error: {
          DEFAULT: themeColors.error,
          100: '#fee2e2',
          200: '#fecaca',
          500: themeColors.error,
          700: '#991b1b',
        },
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        canmou: {
          "primary": themeColors.primary,
          "primary-content": "#ffffff",
          "secondary": themeColors.primaryDark,
          "accent": themeColors.warning,
          "neutral": "#1f2937",
          "neutral-content": "#f9fafb",
          "base-100": themeColors.surface,
          "base-200": themeColors.background,
          "base-300": "#e5e7eb",
          "base-content": "#374151",
          "info": themeColors.primary,
          "success": themeColors.success,
          "success-content": "#ffffff",
          "warning": themeColors.warning,
          "warning-content": "#1f2937",
          "error": themeColors.error,
          "error-content": "#ffffff",
        },
      },
    ],
    darkTheme: false,
  },
}
