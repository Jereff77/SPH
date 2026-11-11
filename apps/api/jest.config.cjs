/** Jest del API (CJS vía ts-jest). Los specs de src/modules/cxp corren con `node --test` (scripts test:unit / test:integracion). */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '<rootDir>/src/modules/cxp/'],
  // Los imports del código llevan sufijo .js; se quita para resolver el .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: {
    '^.+\\.ts$': ['ts-jest', { isolatedModules: true, tsconfig: { experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } }],
  },
};
