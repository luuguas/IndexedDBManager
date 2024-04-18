module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  env: {
    browser: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['dist', 'node_modules', 'coverage'],
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    'import/prefer-default-export': 'off',
    indent: 'off',
    '@typescript-eslint/indent': ['error', 4],
    'lines-between-class-members': 'off',
    '@typescript-eslint/lines-between-class-members': 'off',
  },
  overrides: [
    {
      files: ['.*.js', '*.js'],
      rules: {
        '@typescript-eslint/indent': ['error', 2],
      },
    },
  ],
};
