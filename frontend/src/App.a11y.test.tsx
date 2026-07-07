import { axe } from 'jest-axe';

import { App } from './App';
import { renderWithProviders } from './test/renderWithProviders';

jest.mock('./services/reportsApi', () => ({
  fetchPublicReports: jest.fn().mockResolvedValue([]),
  fetchReportDetail: jest.fn().mockResolvedValue(null),
}));

describe('accessibility', () => {
  it.each([
    ['home page', '/'],
    ['dashboard route', '/dashboard'],
    ['intake route', '/intake'],
    ['login route', '/login'],
    ['signup route', '/signup'],
  ])('has no automated WCAG violations on the %s', async (_name, route) => {
    const { container } = renderWithProviders(<App />, { route });

    expect(await axe(container)).toHaveNoViolations();
  });
});
