import { defineConfig } from 'cypress';

export default defineConfig({
  allowCypressEnv: false,
  env: {
    backendApiUrl: process.env.BACKEND_API_URL ?? 'http://localhost:8000',
  },
  e2e: {
    baseUrl: 'http://localhost:5173',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
  },
});
