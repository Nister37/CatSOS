describe('Login Flow', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/token/', {
      statusCode: 200,
      body: { access: 'fake-access-token', refresh: 'fake-refresh-token' },
    }).as('login');
    cy.intercept('GET', '/api/me/', {
      statusCode: 200,
      body: { id: 1, email: 'user@example.com', display_name: 'Test User' },
    }).as('getMe');
  });

  it('logs in with valid credentials and redirects to dashboard', () => {
    cy.visit('/login');
    cy.findByLabelText(/email/i).type('user@example.com');
    cy.findByLabelText(/password/i).type('SecurePass123!');
    cy.findByRole('button', { name: /log in|sign in/i }).click();

    cy.wait('@login');
    cy.location('pathname').should('eq', '/dashboard');
  });
});

describe('Login Validation', () => {
  it('shows errors when submitting empty fields', () => {
    cy.visit('/login');
    cy.findByRole('button', { name: /log in|sign in/i }).click();

    cy.findByText(/email.*required|please enter.*email/i).should('be.visible');
    cy.findByText(/password.*required|please enter.*password/i).should('be.visible');
  });

  it('shows error for invalid credentials', () => {
    cy.intercept('POST', '/api/auth/token/', {
      statusCode: 401,
      body: { detail: 'No active account found with the given credentials' },
    }).as('loginFail');

    cy.visit('/login');
    cy.findByLabelText(/email/i).type('wrong@example.com');
    cy.findByLabelText(/password/i).type('WrongPassword1!');
    cy.findByRole('button', { name: /log in|sign in/i }).click();

    cy.wait('@loginFail');
    cy.findByText(/invalid.*credentials|no active account|incorrect/i).should('be.visible');
  });
});

describe('Signup Flow', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/auth/register/', {
      statusCode: 201,
      body: { id: 2, email: 'newuser@example.com', display_name: 'New User' },
    }).as('signup');
    cy.intercept('POST', '/api/auth/token/', {
      statusCode: 200,
      body: { access: 'fake-access-token', refresh: 'fake-refresh-token' },
    }).as('autoLogin');
    cy.intercept('GET', '/api/me/', {
      statusCode: 200,
      body: { id: 2, email: 'newuser@example.com', display_name: 'New User' },
    }).as('getMe');
  });

  it('signs up with valid data and redirects to dashboard', () => {
    cy.visit('/signup');
    cy.findByLabelText(/email/i).type('newuser@example.com');
    cy.findByLabelText(/^password$/i).type('SecurePass123!');
    cy.findByLabelText(/confirm password|repeat password/i).type('SecurePass123!');
    cy.findByRole('button', { name: /sign up|create account|register/i }).click();

    cy.wait('@signup');
    cy.location('pathname').should('eq', '/dashboard');
  });
});

describe('Protected Routes', () => {
  const protectedPaths = ['/dashboard', '/my-reports', '/settings'];

  protectedPaths.forEach((path) => {
    it(`redirects unauthenticated user from ${path} to /login`, () => {
      cy.visit(path);
      cy.location('pathname').should('eq', '/login');
    });
  });
});

describe('Login a11y', () => {
  it('passes automated accessibility checks on the login page', () => {
    cy.visit('/login');
    cy.injectAxe();
    cy.checkA11y();
  });
});

describe('Signup a11y', () => {
  it('passes automated accessibility checks on the signup page', () => {
    cy.visit('/signup');
    cy.injectAxe();
    cy.checkA11y();
  });
});
