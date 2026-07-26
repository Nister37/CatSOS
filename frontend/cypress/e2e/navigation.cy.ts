describe('Public navigation', () => {
  for (const path of ['/', '/about', '/missing', '/map', '/shelters']) {
    it(`allows anonymous access to ${path}`, () => {
      cy.visit(path);
      cy.location('pathname').should('eq', path);
      cy.location('pathname').should('not.eq', '/login');
    });
  }

  it('renders the home-page heading', () => {
    cy.visit('/');
    cy.findByRole('heading', { name: /lost your cat/i }).should('be.visible');
  });

  it('opens the mobile menu, navigates, and closes the menu', () => {
    cy.viewport('iphone-x');
    cy.visit('/');

    cy.findByRole('button', { name: /open menu/i }).click();
    cy.get('header').findByRole('link', { name: /^missing cats$/i }).click();

    cy.location('pathname').should('eq', '/missing');
    cy.findByRole('button', { name: /open menu/i }).should('have.attr', 'aria-expanded', 'false');
  });
});

describe('Language preference', () => {
  it('persists the language selected in the authenticated app shell', () => {
    cy.visit('/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem(
          'catsos_auth',
          JSON.stringify({ accessToken: 'fake-access-token', refreshToken: 'fake-refresh-token' }),
        );
      },
    });

    cy.findByLabelText(/language/i).select('PL');
    cy.window().its('localStorage').invoke('getItem', 'catsos.language').should('eq', 'pl');
    cy.reload();
    cy.findByLabelText(/language/i).should('have.value', 'pl');
  });
});
