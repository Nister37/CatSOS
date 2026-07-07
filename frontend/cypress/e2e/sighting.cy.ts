const mockReports = [
  {
    id: 'report-uuid-1',
    cat_name: 'Luna',
    status: 'MISSING',
    description: 'Black and white tuxedo cat',
    main_photo: '/media/photos/luna.jpg',
  },
  {
    id: 'report-uuid-2',
    cat_name: 'Miso',
    status: 'MISSING',
    description: 'Orange tabby cat',
    main_photo: '/media/photos/miso.jpg',
  },
];

const setAuthToken = (win: Cypress.AUTWindow) => {
  win.localStorage.setItem(
    'catsos_auth',
    JSON.stringify({ accessToken: 'fake-e2e-token', refreshToken: 'fake-e2e-refresh' }),
  );
};

describe('Report Sighting Flow', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/reports/*', {
      statusCode: 200,
      body: { count: 2, next: null, previous: null, results: mockReports },
    }).as('getReports');
    cy.intercept('GET', '/api/me/', {
      statusCode: 200,
      body: { id: 1, email: 'helper@example.com', display_name: 'Helper User' },
    }).as('getMe');
    cy.intercept('POST', '/api/reports/report-uuid-1/sightings/', {
      statusCode: 201,
      body: { id: 'sighting-uuid-1', report: 'report-uuid-1', confidence: 'HIGH' },
    }).as('createSighting');
  });

  it('submits a sighting with cat selection, location, and confidence', () => {
    cy.visit('/report-sighting', {
      onBeforeLoad: (win) => {
        setAuthToken(win);
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

    cy.wait('@getReports');

    // Select a cat from the list
    cy.findByText(/luna/i).click();

    // Set location on the map (click map or confirm auto-detected location)
    cy.findByLabelText(/street address|location|where/i).should('be.visible');

    // Set confidence level
    cy.findByRole('group', { name: /confidence/i })
      .contains(/high|certain/i)
      .click();

    // Submit the sighting
    cy.findByRole('button', { name: /submit.*sighting|report sighting/i }).click();

    cy.wait('@createSighting');
    cy.findByText(/sighting.*submitted|thank you/i).should('be.visible');
  });
});

describe('Sighting Validation', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/reports/*', {
      statusCode: 200,
      body: { count: 2, next: null, previous: null, results: mockReports },
    }).as('getReports');
    cy.intercept('GET', '/api/me/', {
      statusCode: 200,
      body: { id: 1, email: 'helper@example.com', display_name: 'Helper User' },
    }).as('getMe');
  });

  it('cannot submit without selecting a cat', () => {
    cy.visit('/report-sighting', {
      onBeforeLoad: (win) => {
        setAuthToken(win);
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

    cy.wait('@getReports');

    // Try to submit without selecting a cat
    cy.findByRole('button', { name: /submit.*sighting|report sighting/i }).click();

    cy.findByText(/select.*cat|choose.*cat|cat.*required/i).should('be.visible');
  });
});

describe('Report Sighting a11y', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/reports/*', {
      statusCode: 200,
      body: { count: 2, next: null, previous: null, results: mockReports },
    }).as('getReports');
    cy.intercept('GET', '/api/me/', {
      statusCode: 200,
      body: { id: 1, email: 'helper@example.com', display_name: 'Helper User' },
    }).as('getMe');
  });

  it('passes automated accessibility checks on the report sighting page', () => {
    cy.visit('/report-sighting', {
      onBeforeLoad: (win) => {
        setAuthToken(win);
      },
    });

    cy.wait('@getReports');
    cy.injectAxe();
    cy.checkA11y();
  });
});
