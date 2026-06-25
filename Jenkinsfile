pipeline {
  agent any

  options {
    timestamps()
  }

  environment {
    CI_COMPOSE = 'docker-compose.ci.yml'
  }

  stages {
    stage('Backend Tests') {
      steps {
        sh 'docker compose -f $CI_COMPOSE run --rm backend-test'
      }
    }

    stage('OpenAPI Schema') {
      steps {
        sh 'docker compose -f $CI_COMPOSE run --rm backend-openapi'
      }
    }

    stage('Frontend Quality') {
      steps {
        sh 'docker compose -f $CI_COMPOSE run --rm frontend-quality'
      }
    }

    stage('Frontend Runtime Image') {
      steps {
        sh 'docker compose -f $CI_COMPOSE build frontend-runtime'
      }
    }

    stage('Cypress E2E') {
      steps {
        sh 'docker compose -f $CI_COMPOSE up --abort-on-container-exit --exit-code-from frontend-e2e frontend-e2e'
      }
    }
  }

  post {
    always {
      sh 'docker compose -f $CI_COMPOSE down -v --remove-orphans'
      archiveArtifacts artifacts: 'backend/openapi-schema.yml,frontend/coverage/**,frontend/dist/**', allowEmptyArchive: true
    }
  }
}
