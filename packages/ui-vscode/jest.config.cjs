module.exports = {
  testMatch: ['<rootDir>/dist/**/*.test.js'],
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/__mocks__/vscode.js',
  },
};
