import type { PropsWithChildren, ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions } from '@testing-library/react';

import { createAppStore, type AppStore, type RootState } from '../app/store';

type RenderWithProvidersOptions = RenderOptions & {
  preloadedState?: Partial<RootState>;
  route?: string;
  store?: AppStore;
};

export function renderWithProviders(
  ui: ReactElement,
  { preloadedState, route = '/', store = createAppStore(preloadedState), ...renderOptions }: RenderWithProvidersOptions = {},
) {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    );
  }

  return {
    store,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}
