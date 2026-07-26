describe('Authentication flows', () => {
  it('logs in, loads the current user, and returns to the home page', () => {
    cy.intercept('POST', '**/api/auth/login/', {
      statusCode: 200,
      body: { access: 'fake-access-token', refresh: 'fake-refresh-token', token_type: 'Bearer' },
    }).as('login');
    cy.intercept('GET', '**/api/me/', {
      statusCode: 200,
      body: {
        id: 1,
        email: 'user@example.com',
        first_name: 'Test',
        last_name: 'User',
        avatar_fallback: 'TU',
        profile_picture_url: null,
      },
    }).as('getMe');

    cy.visit('/login');
    cy.findByLabelText(/email/i).type('user@example.com');
    cy.findByLabelText(/password/i).type('SecurePass123!');
    cy.get('form').findByRole('button', { name: /log in/i }).click();

    cy.wait(['@login', '@getMe']);
    cy.location('pathname').should('eq', '/');
  });

  it('validates empty login fields without sending a request', () => {
    cy.intercept('POST', '**/api/auth/login/').as('login');
    cy.visit('/login');
    cy.get('form').findByRole('button', { name: /log in/i }).click();

    cy.findAllByRole('alert')
      .should('have.length', 2)
      .first()
      .should('contain.text', 'Enter a valid email address');
    cy.get('@login.all').should('have.length', 0);
  });

  it('shows a safe invalid-credentials error', () => {
    cy.intercept('POST', '**/api/auth/login/', {
      statusCode: 401,
      body: { non_field_errors: ['Invalid email or password.'] },
    }).as('loginFail');

    cy.visit('/login');
    cy.findByLabelText(/email/i).type('wrong@example.com');
    cy.findByLabelText(/password/i).type('WrongPassword1!');
    cy.get('form').findByRole('button', { name: /log in/i }).click();

    cy.wait('@loginFail');
    cy.findByRole('alert').should('contain.text', 'Invalid email or password.');
  });

  it('registers and routes to email verification', () => {
    cy.intercept('POST', '**/api/auth/register/', {
      statusCode: 201,
      body: {
        detail: 'Verification required.',
        email_verification_required: true,
        resend_available_in_seconds: 120,
        user: { id: 2, email: 'newuser@example.com' },
      },
    }).as('signup');

    cy.visit('/signup');
    cy.findByLabelText(/^email$/i).type('newuser@example.com');
    cy.findByLabelText(/^password$/i).type('SecurePass123!');
    cy.findByLabelText(/confirm password/i).type('SecurePass123!');
    cy.get('form').findByRole('button', { name: /create account/i }).click();

    cy.wait('@signup');
    cy.location('pathname').should('eq', '/verify-email');
  });

  for (const path of ['/my-reports', '/settings', '/notifications']) {
    it(`redirects unauthenticated users from ${path}`, () => {
      cy.visit(path);
      cy.location('pathname').should('eq', '/login');
    });
  }

  for (const path of ['/login', '/signup']) {
    it(`has no automated accessibility violations on ${path}`, () => {
      cy.visit(path);
      cy.get('.page-motion').should('have.css', 'opacity', '1');
      cy.get('.page-motion > *').each(($element) => {
        cy.wrap($element).should('have.css', 'opacity', '1');
      });
      cy.injectAxe();
      cy.checkA11y();
    });
  }
});
