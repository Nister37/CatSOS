type AxeViolation = {
  id: string;
  impact?: string | null;
  nodes: Array<{ target: string[] }>;
};

const failWithViolationDetails = (violations: AxeViolation[]) => {
  if (violations.length > 0) {
    throw new Error(JSON.stringify(violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => node.target),
    }))));
  }
};

const waitForPageMotion = () => {
  cy.get('.page-motion').should('have.css', 'opacity', '1');
  cy.get('.page-motion > *').each(($element) => {
    cy.wrap($element).should('have.css', 'opacity', '1');
  });
};

describe('CatSOS SPA', () => {
  it('renders the dashboard and passes automated accessibility checks', () => {
    cy.visit('/');
    cy.findByRole('heading', { name: /lost your cat/i }).should('be.visible');
    cy.injectAxe();
    cy.checkA11y();
  });

  it('submits the intake form', () => {
    cy.visit('/intake');
    cy.findByLabelText(/cat name/i).type('Miso');
    cy.findByLabelText(/reporter email/i).type('rescue@example.com');
    cy.findByLabelText(/urgency/i).select('high');
    cy.findByLabelText(/situation/i).type('Small cat found near a busy road.');
    cy.findByRole('button', { name: /submit report/i }).click();
    cy.findByText(/report queued for review/i).should('be.visible');
  });

  it('navigates between public auth routes without backend calls', () => {
    cy.visit('/');
    cy.findByRole('link', { name: /^join$/i }).click();
    cy.location('pathname').should('eq', '/login');
    cy.findByRole('heading', { name: /welcome back/i }).should('be.visible');

    cy.findByRole('link', { name: /sign up/i }).click();
    cy.location('pathname').should('eq', '/signup');
    cy.findByRole('heading', { name: /join the community/i }).should('be.visible');
  });

  it('passes automated accessibility checks on public auth routes', () => {
    cy.visit('/login');
    waitForPageMotion();
    cy.injectAxe();
    cy.checkA11y(undefined, undefined, failWithViolationDetails);

    cy.visit('/signup');
    waitForPageMotion();
    cy.injectAxe();
    cy.checkA11y(undefined, undefined, failWithViolationDetails);
  });
});
