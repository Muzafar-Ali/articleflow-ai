/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',

  roots: ['<rootDir>/tests'],

  testMatch: ['**/*.test.ts'],

  transform: {
    '^.+\\.ts$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
          },

          target: 'es2024',
        },

        module: {
          type: 'commonjs',
        },
      },
    ],
  },

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  clearMocks: true,
  restoreMocks: true,
};
