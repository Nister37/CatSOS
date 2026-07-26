describe('Django backend contract', () => {
  let apiBaseUrl: string;
  const demoPassword = 'CatSOSDemo123!';

  before(() => {
    cy.env(['backendApiUrl']).then((values) => {
      apiBaseUrl = String(values.backendApiUrl);
    });
  });

  it('serves health and a paginated public report list', () => {
    cy.request(`${apiBaseUrl}/api/health/`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.include({
        status: 'ok',
        service: 'catsos-backend',
      });
      expect(response.headers['content-type']).to.include('application/json');
    });

    cy.request(`${apiBaseUrl}/api/public/reports/`).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.keys('count', 'next', 'previous', 'results');
      expect(response.body.results).to.be.an('array');
    });
  });

  it('enforces authentication on report creation', () => {
    cy.request({
      method: 'POST',
      url: `${apiBaseUrl}/api/reports/`,
      body: {},
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401);
      expect(response.headers['www-authenticate']).to.match(/^Bearer\b/);
      expect(response.body).to.have.property('detail');
    });
  });

  it('completes a real owner-to-helper notification workflow', () => {
    cy.request('POST', `${apiBaseUrl}/api/auth/login/`, {
      email: 'scenario.owner@catsos.local',
      password: demoPassword,
    }).then((ownerLogin) => {
      const ownerAccess = ownerLogin.body.access as string;

      cy.request({
        method: 'POST',
        url: `${apiBaseUrl}/api/reports/`,
        headers: { Authorization: `Bearer ${ownerAccess}` },
        body: {
          cat_name: 'E2E Nova',
          coat_color: 'Black with a white chest',
          description: 'A shy indoor cat last seen near the community garden.',
          disappeared_at: '2026-07-25T18:00:00Z',
          last_seen_address: 'Community garden district',
          last_seen_landmark: 'Near the north entrance',
          last_seen_lat: 52.356,
          last_seen_lng: 4.87,
          contact_name: 'Scenario Owner',
          contact_phone: '+31612345678',
          contact_email: 'scenario.owner@catsos.local',
          contact_visibility: 'APP_ONLY',
          notify_push: true,
          notify_sms: false,
          notify_email: false,
        },
      }).then((createdReport) => {
        expect(createdReport.status).to.eq(201);
        const publicId = createdReport.body.public_id as string;

        cy.request('POST', `${apiBaseUrl}/api/auth/login/`, {
          email: 'scenario.helper@catsos.local',
          password: demoPassword,
        }).then((helperLogin) => {
          cy.request({
            method: 'POST',
            url: `${apiBaseUrl}/api/public/reports/${publicId}/sightings/`,
            headers: { Authorization: `Bearer ${helperLogin.body.access as string}` },
            body: {
              seen_at: '2026-07-26T10:00:00Z',
              location_description: 'Beside the community garden gate',
              latitude: 52.357,
              longitude: 4.871,
              confidence: 'HIGH',
              notes: 'The markings matched the report photo and description.',
            },
          }).its('status').should('eq', 201);
        });
      });
    });

    cy.visit('/login');
    cy.findByLabelText(/email/i).type('scenario.owner@catsos.local');
    cy.findByLabelText(/password/i).type(demoPassword);
    cy.findByRole('button', { name: /log in|sign in/i }).click();
    cy.location('pathname').should('eq', '/');
    cy.visit('/notifications');
    cy.contains(/E2E Nova/i).should('be.visible');
  });
});
