# Local Jenkins

This project uses the root `Jenkinsfile` instead of GitLab CI or GitHub Actions.

## Start Jenkins

```powershell
docker compose -f docker-compose.ci.yml up --build jenkins
```

Open `http://127.0.0.1:8080/` and create a Pipeline job that reads `Jenkinsfile` from this repository.

Read the initial Jenkins password:

```powershell
docker compose -f docker-compose.ci.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

## Agent Model

The Jenkins container only needs Docker CLI access. The pipeline runs Python, Node, Yarn, and Cypress inside the builder images declared in `docker-compose.ci.yml`.

Jenkins is grouped with the CI Compose file because its only purpose in this project is to run the CI pipeline locally.

## Pipeline Stages

1. Backend Django checks and tests
2. OpenAPI generation and validation
3. Frontend lint, Jest, a11y, and build
4. Frontend runtime image build
5. Cypress e2e checks
