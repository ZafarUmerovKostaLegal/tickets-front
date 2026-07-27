import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import babelParser from '@babel/eslint-parser';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'src-tauri/**',
      'playwright-report/**',
      'test-results/**',
      'all-blob-reports/**',
      'android/**',
      'scripts/**',
      'public/**',
      'browser-extension/**/dist/**',
      'e2e/**',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [
            '@babel/preset-typescript',
            ['@babel/preset-react', { runtime: 'automatic' }],
          ],
          plugins: ['@babel/plugin-syntax-jsx'],
        },
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Existing codebase rethrows without { cause }; do not mass-rewrite
      'preserve-caught-error': 'off',
      'no-useless-assignment': 'off',
      'no-empty-pattern': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-danger': 'warn',
      // Contexts, route factories and lazy wrappers intentionally co-locate helper exports.
      // This rule only affects development HMR boundaries, not production correctness.
      'react-refresh/only-export-components': 'off',
      // Prefer sanitizeHtml / twemojiHtml before dangerouslySetInnerHTML
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            'Use sanitizeHtml / twemojiHtml (or a pre-sanitized __html value) before dangerouslySetInnerHTML. See src/shared/lib/sanitizeHtml.ts',
        },
      ],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',
      'no-constant-condition': 'warn',
      'no-fallthrough': 'warn',
      'no-prototype-builtins': 'warn',
      'no-cond-assign': 'warn',
      'no-control-regex': 'warn',
      'no-sparse-arrays': 'warn',
      'no-misleading-character-class': 'warn',
      'no-unsafe-optional-chaining': 'warn',
      'require-yield': 'warn',
      'no-extra-boolean-cast': 'warn',
      'no-self-assign': 'warn',
      'no-compare-neg-zero': 'warn',
      'no-unreachable': 'warn',
    },
  },
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/__tests__/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['src/shared/ui/TwemojiText.tsx'],
    rules: {
      // twemojiHtml sanitizes the generated markup before it reaches this renderer.
      'react/no-danger': 'off',
    },
  },
];
