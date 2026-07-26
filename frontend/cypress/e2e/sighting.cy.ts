const mockReports = [
  {
    public_id: 'report-uuid-1',
    cat_name: 'Luna',
    breed: 'Domestic shorthair',
    coat_color: 'Black and white',
    description: 'Black and white tuxedo cat',
    location_summary: 'Near the community garden',
    last_seen_landmark: 'North entrance',
    disappeared_at: '2026-07-25T18:00:00Z',
    approximate_location: { latitude: 51.507, longitude: -0.128 },
    reward_amount: null,
    status: 'MISSING',
    found_message: '',
    resolved_at: null,
    is_active_search: true,
    main_photo: null,
    updated_at: '2026-07-26T08:00:00Z',
  },
];

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

const setAuthToken = (win: Cypress.AUTWindow) => {
  win.localStorage.setItem(
    'catsos_auth',
    JSON.stringify({ accessToken: 'fake-e2e-token', refreshToken: 'fake-e2e-refresh' }),
  );
};

const visitAuthenticated = () => {
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
};

describe('Report Sighting Flow', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/public/reports/?page_size=50', {
      statusCode: 200,
      body: { count: 1, next: null, previous: null, results: mockReports },
    }).as('getReports');
    cy.intercept('GET', '**/api/me/', {
      statusCode: 200,
      body: { id: 1, email: 'helper@example.com', display_name: 'Helper User' },
    });
    cy.intercept('GET', 'https://nominatim.openstreetmap.org/reverse*', {
      statusCode: 200,
      body: { display_name: 'Community Garden', address: { road: 'Garden Road', city: 'London' } },
    }).as('reverseGeocode');
    cy.intercept('POST', '**/api/public/reports/report-uuid-1/sightings/', {
      statusCode: 201,
      body: { id: 'sighting-uuid-1', report: 'report-uuid-1', confidence: 'HIGH' },
    }).as('createSighting');
  });

  it('submits a sighting with cat selection, map location, and confidence', () => {
    visitAuthenticated();
    cy.wait('@getReports');

    cy.findByText('Luna').click();
    cy.get('.leaflet-container').click('center');
    cy.wait('@reverseGeocode');
    cy.findByLabelText('Address').should('have.value', 'Garden Road, London');
    cy.findByRole('button', { name: /certain/i }).click();
    cy.findByRole('button', { name: /submit.*sighting|report sighting/i }).click();

    cy.wait('@createSighting').its('request.body').should((body: FormData | Record<string, string>) => {
      expect(body).not.to.eq(undefined);
    });
    cy.findByText(/sighting reported/i).should('be.visible');
  });

  it('shows validation when the cat or map location is missing', () => {
    visitAuthenticated();
    cy.wait('@getReports');

    cy.findByRole('button', { name: /submit.*sighting|report sighting/i }).click();
    cy.findByText(/please select which cat/i).should('be.visible');

    cy.findByText('Luna').click();
    cy.findByRole('button', { name: /submit.*sighting|report sighting/i }).click();
    cy.findByText(/tap the map/i).should('be.visible');
  });

  it('passes automated accessibility checks', () => {
    visitAuthenticated();
    cy.wait('@getReports');
    cy.get('.page-motion').should('have.css', 'opacity', '1');
    cy.get('.page-motion > *').each(($element) => {
      cy.wrap($element).should('have.css', 'opacity', '1');
    });
    cy.injectAxe();
    cy.checkA11y(undefined, undefined, failWithViolationDetails);
  });
});
