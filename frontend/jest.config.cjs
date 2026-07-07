module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/src/test/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '^react-leaflet$': '<rootDir>/src/test/reactLeafletMock.tsx',
    '^leaflet$': '<rootDir>/src/test/leafletMock.ts',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Stub out API modules that use import.meta (Vite-only) so they don't break Jest
    '^.*/api/auth(\\.ts)?$': '<rootDir>/src/api/__mocks__/auth.ts',
    '^.*/api/client(\\.ts)?$': '<rootDir>/src/api/__mocks__/client.ts',
    '^.*/api/useSsoLogin(\\.ts)?$': '<rootDir>/src/api/__mocks__/useSsoLogin.ts',
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/main.tsx', '!src/test/**'],
};
