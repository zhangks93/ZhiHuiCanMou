import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src-tauri/target', 'src-tauri/gen']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': 'warn',
    },
  },
  {
    files: ['src/shared/lib/logger.ts', '**/*.test.{ts,tsx}'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: [
      'src/features/biz-data/components/TableView.tsx',
      'src/features/opportunity/pages/OpportunityPage.tsx',
      'src/features/biz-data/components/StrategyPlanView.tsx',
    ],
    rules: {
      'react-hooks/incompatible-library': 'off',
    },
  },
])
