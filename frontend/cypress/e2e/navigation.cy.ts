describe('Public Navigation', () => {
  const publicPaths = ['/', '/about', '/missing-cats', '/sightings-map'];

  publicPaths.forEach((path) => {
    it(`can visit ${path} without authentication`, () => {
      cy.intercept('GET', '/api/reports/*', {
        statusCode: 200,
        body: { count: 0, next: null, previous: null, results: [] },
      }).as('getReports');

      cy.visit(path);
      cy.location('pathname').should('eq', path);
      // Should NOT be redirected to login
      cy.location('pathname').should('not.eq', '/login');
    });
  });

  it('renders the homepage heading', () => {
    cy.visit('/');
    cy.findByRole('heading', { name: /lost your cat/i }).should('be.visible');
  });
});

describe('Mobile Navigation', () => {
  beforeEach(() => {
    cy.viewport('iphone-x');
  });

  it('opens the hamburger menu and navigates to a page', () => {
    cy.visit('/');

    // Open mobile menu
    cy.findByRole('button', { name: /menu|open navigation|toggle/i }).click();

    // Navigate to a public page via menu
    cy.findByRole('link', { name: /missing cats|lost cats|browse/i }).click();
    cy.location('pathname').should('include', '/missing-cats');
  });

  it('closes the mobile menu after navigation', () => {
    cy.visit('/');

    cy.findByRole('button', { name: /menu|open navigation|toggle/i }).click();
    cy.findByRole('link', { name: /missing cats|lost cats|browse/i }).click();

    // Menu should be closed after navigation
    cy.findByRole('navigation', { name: /mobile/i }).should('not.exist');
  });
});

describe('Language Switcher', () => {
  it('changes language from English to Polish and updates UI text', () => {
    cy.visit('/');
    cy.findByRole('heading', { name: /lost your cat/i }).should('be.visible');

    // Open language switcher and select Polish
    cy.findByRole('button', { name: /language|lang|en/i }).click();
    cy.findByRole('option', { name: /polski|polish|pl/i }).click();

    // Verify UI text changes (Polish heading or common translated element)
    cy.findByRole('heading', { name: /lost your cat/i }).should('not.exist');
    cy.findByRole('heading', { name: /zgubiłeś|zgubiony|twój kot/i }).should('be.visible');
  });

  it('changes language from English to Dutch and updates UI text', () => {
    cy.visit('/');
    cy.findByRole('heading', { name: /lost your cat/i }).should('be.visible');

    // Open language switcher and select Dutch
    cy.findByRole('button', { name: /language|lang|en/i }).click();
    cy.findByRole('option', { name: /nederlands|dutch|nl/i }).click();

    // Verify UI text changes (Dutch heading or common translated element)
    cy.findByRole('heading', { name: /lost your cat/i }).should('not.exist');
    cy.findByRole('heading', { name: /kat.*kwijt|vermist/i }).should('be.visible');
  });

  it('persists language choice across page reload', () => {
    cy.visit('/');

    // Switch to Polish
    cy.findByRole('button', { name: /language|lang|en/i }).click();
    cy.findByRole('option', { name: /polski|polish|pl/i }).click();

    // Reload and verify language persists
    cy.reload();
    cy.findByRole('heading', { name: /lost your cat/i }).should('not.exist');
    cy.findByRole('heading', { name: /zgubiłeś|zgubiony|twój kot/i }).should('be.visible');
  });
});
