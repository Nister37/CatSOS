import { axe } from 'jest-axe';

import { App } from './App';
import { renderWithProviders } from './test/renderWithProviders';

describe('accessibility', () => {
  it('has no automated WCAG violations on the dashboard shell', async () => {
    const { container } = renderWithProviders(<App />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
