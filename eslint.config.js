/* eslint-disable import-x/no-named-as-default-member */

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import { importX } from 'eslint-plugin-import-x';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '.git/*',
      '.vscode/*',
      'coverage/*',
      'dist/*',
      'node_modules/*',
      'playwright-report/*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  prettier,
  {
    files: ['**/*.{js,mjs,cjs,ts,cts,mts}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parserOptions: {
        project: ['tsconfig.json', 'tests/tsconfig.json'],
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
    plugins: { 'simple-import-sort': simpleImportSort },
    settings: {
      'import-x/resolver': {
        typescript: {
          project: ['tsconfig.json', 'tests/tsconfig.json'],
        },
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        1,
        { fixStyle: 'inline-type-imports' },
      ],
      'no-console': 1,
      'no-warning-comments': ['warn', { terms: ['todo', 'fixme', '@@@'] }],
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      'import-x/first': 'warn',
      'import-x/newline-after-import': 'warn',
      'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
      'import-x/order': 'off',
    },
  },
  {
    files: ['src/**/*.{js,mjs,cjs,ts,cts,mts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
  },
  {
    files: ['tests/**/*.{spec,test}.{js,ts}'],
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
    plugins: {
      vitest,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      '@typescript-eslint/unbound-method': 'off',
    },
  },
];
