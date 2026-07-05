// Helpers

const interceptNominatim = () => {
  cy.intercept('https://nominatim.openstreetmap.org/**', {
    body: {
      display_name: '10 Baker Street, London, UK',
      address: { road: 'Baker Street', house_number: '10', city: 'London' },
    },
  }).as('nominatim');
};

// Step helpers
const completeStep1 = (catName = 'Luna', breed = 'Tuxedo') => {
  cy.visit('/report-missing', {
    onBeforeLoad: (win) => {
      cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(
        (success: PositionCallback) => {
          success({
            coords: { latitude: 51.5074, longitude: -0.1278, accuracy: 10 } as GeolocationCoordinates,
            timestamp: Date.now(),
          });
        },
      );
    },
  });
  cy.findByLabelText(/cat's name/i).type(catName);
  cy.findByLabelText(/breed \/ main color/i).type(breed);
  cy.findByRole('button', { name: /next: location details/i }).click();
};

const completeStep2 = (address = 'Baker Street, London') => {
  cy.location('pathname').should('eq', '/report-missing/location');
  cy.findByLabelText(/street address/i).clear().type(address);
  cy.findByRole('button', { name: /next: contact details/i }).click();
};

const completeStep3 = (
  name = 'Jane Doe',
  phone = '+44 7700 900123',
  email = 'jane@example.com',
) => {
  cy.location('pathname').should('eq', '/report-missing/contact');
  cy.findByLabelText(/full name/i).type(name);
  cy.findByLabelText(/phone number/i).type(phone);
  cy.findByLabelText(/email address/i).type(email);
  cy.findByRole('button', { name: /post missing report/i }).click();
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Report Missing Cat — Step 1', () => {
  beforeEach(() => {
    cy.visit('/report-missing', {
      onBeforeLoad: (win) => {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake(
          (success: PositionCallback) => {
            success({
              coords: { latitude: 51.5074, longitude: -0.1278, accuracy: 10 } as GeolocationCoordinates,
              timestamp: Date.now(),
            });
          },
        );
      },
    });
  });

  it('renders the step 1 heading and progress label', () => {
    cy.findByRole('heading', { name: /basic information/i }).should('be.visible');
    cy.findByText(/step 1 of 3/i).should('be.visible');
  });

  it('shows a validation error when the cat name is too short', () => {
    cy.findByLabelText(/cat's name/i).type('A');
    cy.findByLabelText(/breed \/ main color/i).type('Tabby');
    cy.findByRole('button', { name: /next: location details/i }).click();
    cy.findByText(/name must be at least 2 characters/i).should('be.visible');
  });

  it('shows a validation error when breed is missing', () => {
    cy.findByLabelText(/cat's name/i).type('Luna');
    cy.findByRole('button', { name: /next: location details/i }).click();
    cy.findByText(/please describe the breed or color/i).should('be.visible');
  });

  it('enables the chip number field when "Yes" is selected', () => {
    cy.findByRole('radio', { name: /yes/i }).click();
    cy.findByPlaceholderText(/15-digit number/i)
      .closest('div')
      .should('not.have.class', 'opacity-50');
  });

  it('navigates to step 2 with valid data', () => {
    cy.findByLabelText(/cat's name/i).type('Luna');
    cy.findByLabelText(/breed \/ main color/i).type('Tuxedo');
    cy.findByRole('button', { name: /next: location details/i }).click();
    cy.location('pathname').should('eq', '/report-missing/location');
  });

  it('is reachable from the homepage "Report Missing Cat" button', () => {
    cy.visit('/');
    cy.findAllByRole('link', { name: /report missing cat/i }).first().click();
    cy.location('pathname').should('eq', '/report-missing');
    cy.findByRole('heading', { name: /basic information/i }).should('be.visible');
  });
});

describe('Report Missing Cat — Step 2', () => {
  beforeEach(() => {
    interceptNominatim();
    completeStep1();
  });

  it('renders the step 2 heading and 66% progress', () => {
    cy.findByRole('heading', { name: /where was your cat last seen/i }).should('be.visible');
    cy.findByText(/66% complete/i).should('be.visible');
  });

  it('renders the map, address and landmark fields', () => {
    cy.findByLabelText(/street address/i).should('be.visible');
    cy.findByLabelText(/area \/ landmark/i).should('be.visible');
  });

  it('shows a validation error when submitting without an address', () => {
    cy.findByLabelText(/street address/i).clear();
    cy.findByRole('button', { name: /next: contact details/i }).click();
    cy.findByText(/please enter a street address/i).should('be.visible');
  });

  it('navigates back to step 1 via the back link', () => {
    cy.findByRole('link', { name: /back to cat details/i }).click();
    cy.location('pathname').should('eq', '/report-missing');
  });

  it('navigates to step 3 with a valid address', () => {
    cy.findByLabelText(/street address/i).clear().type('Baker Street, London');
    cy.findByRole('button', { name: /next: contact details/i }).click();
    cy.location('pathname').should('eq', '/report-missing/contact');
  });
});

describe('Report Missing Cat — Step 3', () => {
  beforeEach(() => {
    interceptNominatim();
    completeStep1();
    completeStep2();
  });

  it('renders the "Final Step" heading', () => {
    cy.findByRole('heading', { name: /final step/i }).should('be.visible');
  });

  it('shows the cat name from step 1 in the step tracker', () => {
    cy.findByText(/cat: luna/i).should('be.visible');
  });

  it('shows the privacy protection card', () => {
    cy.findByText(/privacy protection/i).should('be.visible');
  });

  it('shows validation errors when submitting without contact details', () => {
    cy.findByRole('button', { name: /post missing report/i }).click();
    cy.findByText(/please enter your full name/i).should('be.visible');
    cy.findByText(/please enter a valid email address/i).should('be.visible');
  });

  it('navigates back to step 2 via the back link', () => {
    cy.findByRole('link', { name: /back to location/i }).click();
    cy.location('pathname').should('eq', '/report-missing/location');
  });
});

describe('Report Missing Cat — Full Flow', () => {
  it('completes all three steps and returns to the homepage', () => {
    completeStep1('Luna', 'Tuxedo');
    completeStep2('Baker Street, London');

    cy.findByText(/cat: luna/i).should('be.visible');

    completeStep3('Jane Doe', '+44 7700 900123', 'jane@example.com');

    cy.findByText(/broadcasting alert/i).should('be.visible');
    cy.location('pathname', { timeout: 10000 }).should('eq', '/');
    cy.findByRole('heading', { name: /lost your cat/i }).should('be.visible');
  });
});
