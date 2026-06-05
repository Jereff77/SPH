import base from '@erp/config/eslint';

export default [
  ...base,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
];
