import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    plugins: { js, '@stylistic': stylistic },
    extends: ['js/recommended'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  // Shared configs
  stylistic.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  // Custom configs
  stylistic.configs.customize({
    indent: 4,
    quotes: 'single',
    semi: true,
    arrowParens: true,
  }),
  {
    rules: {
      // Common
      'eqeqeq': 'error',
      'no-console': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none' }],
      'prefer-const': ['error', { destructuring: 'all' }],
      'prefer-promise-reject-errors': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      'prefer-template': 'error',
      '@stylistic/lines-between-class-members': 'off',
      // Naming
      'consistent-this': ['error', 'that'],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'default',
          format: ['camelCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE'],
        },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
          prefix: ['T'],
        },
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: ['objectLiteralProperty', 'typeProperty'],
          format: null,
        },
      ],
      // Brackets
      'curly': ['error', 'multi-line', 'consistent'],
      /* Planned to be replaced by 'list-style' in ESLint Stylistic v6 */
      '@stylistic/array-bracket-newline': ['error', 'consistent'],
      '@stylistic/function-paren-newline': ['error', 'multiline-arguments'],
      '@stylistic/object-curly-newline': ['error', { multiline: true, consistent: true }],
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
      // Modules
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      // Others
      'default-case-last': 'error',
      'default-param-last': 'off',
      '@typescript-eslint/default-param-last': 'error',
      'no-promise-executor-return': 'error',
      'prefer-spread': 'error',
    },
  },
  // Overrides for config files
  {
    files: ['*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@stylistic/indent': ['error', 2] },
  },
]);
