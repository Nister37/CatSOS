describe('CatSOS SPA', () => {
  it('renders the dashboard and passes automated accessibility checks', () => {
    cy.visit('/');
    cy.findByRole('heading', { name: /field dashboard/i }).should('be.visible');
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
});
