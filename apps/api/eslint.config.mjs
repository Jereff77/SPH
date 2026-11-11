import base from '@erp/config/eslint';

export default [
  ...base,
  {
    // Los specs se excluyen del tsconfig (no van al build): no se lintean con type-info.
    ignores: ['**/*.spec.ts', '**/*.testing-spec.ts'],
  },
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
];
