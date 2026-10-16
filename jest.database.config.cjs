const baseConfig = require('./jest.config.cjs');

module.exports = {
  ...baseConfig,

  displayName: 'database-integration',

  testMatch: ['**/tests/database/**/*.integration.ts'],

  extensionsToTreatAsEsm: ['.ts'],

  transform: {
    '^.+\\.tsx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
          target: 'es2024',
        },
        module: {
          type: 'es6',
        },
      },
    ],
  },

  testTimeout: 20000,
};
