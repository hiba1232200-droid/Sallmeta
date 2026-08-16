/** إعداد Jest لاختبارات SellMate AI (وحدة + تكامل + أمان). */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/test/helpers/setup-env.ts'],
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.(t)s', '!src/**/*.module.ts', '!src/main.ts'],
  coverageDirectory: './coverage',
};
