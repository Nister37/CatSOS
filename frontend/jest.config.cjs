module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/src/test/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^react-leaflet$': '<rootDir>/src/test/reactLeafletMock.tsx',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/main.tsx', '!src/test/**'],
};
