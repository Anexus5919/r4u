import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.tsbuildinfo',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
      'object-shorthand': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
    },
  },

  // ---------------------------------------------------------------- client
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      'jsx-a11y/alt-text': 'error',
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/aria-props': 'error',
      'jsx-a11y/aria-role': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'error',

      // the resume preview and chat render user content, and both must stay escaped
      'react/no-danger': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'User content is stored as plain text and rendered escaped. See DESIGN-SYSTEM.md and REALTIME.md section 9.1.',
        },
      ],
    },
  },

  // ---------------------------------------------------------------- server
  {
    files: ['server/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      /*
        On Express 5 the sanitized values exist only in matchedData(req). Reading req.body or
        req.query directly is both a correctness bug and the mass-assignment surface for role,
        owner and version. See API.md section 1.5.
      */
      'no-restricted-properties': [
        'error',
        { object: 'req', property: 'body', message: 'Read req.validated from matchedData(req).' },
        { object: 'req', property: 'query', message: 'Read req.validated from matchedData(req).' },
        { object: 'req', property: 'params', message: 'Read req.validated from matchedData(req).' },
      ],
    },
  },
  {
    files: ['server/src/middleware/**/*.ts', 'server/src/**/*.validators.ts'],
    rules: { 'no-restricted-properties': 'off' },
  },

  // ---------------------------------------------------------------- config files
  {
    files: ['**/*.config.{js,ts}', 'scripts/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  }
)
