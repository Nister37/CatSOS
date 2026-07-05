import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { renderWithProviders } from './test/renderWithProviders';

describe('App', () => {
  it('renders the dashboard route', () => {
    renderWithProviders(<App />, { route: '/dashboard' });

    expect(screen.getByRole('heading', { name: /field dashboard/i })).toBeInTheDocument();
  });

  it('validates and submits an intake report', async () => {
    const user = userEvent.setup();
    renderWithProviders(<App />, { route: '/intake' });

    await user.type(screen.getByLabelText(/cat name/i), 'Miso');
    await user.type(screen.getByLabelText(/reporter email/i), 'rescue@example.com');
    await user.selectOptions(screen.getByLabelText(/urgency/i), 'high');
    await user.type(screen.getByLabelText(/situation/i), 'Small cat found near a busy road.');
    await user.click(screen.getByRole('button', { name: /submit report/i }));

    expect(screen.getByText(/report queued for review/i)).toBeInTheDocument();
  });
});
