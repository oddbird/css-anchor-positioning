/* eslint-disable import/no-named-as-default-member */

import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
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
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
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
      'import/resolver': {
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
      'import/first': 'warn',
      'import/newline-after-import': 'warn',
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/order': 'off',
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
