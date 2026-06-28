pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    CI_COMPOSE = 'docker-compose.ci.yml'
    CI_PROJECT = 'catsos-ci'
    COMPOSE_PARALLEL_LIMIT = '1'
  }

  stages {
    stage('Prepare CI') {
      steps {
        script {
          env.CI_PROJECT = "catsos-ci-${env.BUILD_TAG}".toLowerCase().replaceAll('[^a-z0-9_-]', '-')
        }
        sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" down -v --remove-orphans'
        sh 'docker compose -p catsos-ci -f "$CI_COMPOSE" down -v --remove-orphans || true'
      }
    }

    stage('Build CI Images') {
      steps {
        sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" build backend-test backend-openapi frontend-quality frontend-dev frontend-e2e'
      }
    }

    stage('Backend Tests') {
      steps {
        sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" run --rm backend-test'
      }
    }

    stage('OpenAPI Schema') {
      steps {
        sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" run --rm backend-openapi'
      }
    }

    stage('Frontend Quality') {
      steps {
        sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" run --rm frontend-quality'
      }
    }

    stage('Frontend Runtime Image') {
      steps {
        sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" build frontend-runtime'
      }
    }

    stage('Cypress E2E') {
      steps {
        sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" up --abort-on-container-exit --exit-code-from frontend-e2e frontend-e2e'
      }
    }
  }

  post {
    always {
      sh 'docker compose -p "$CI_PROJECT" -f "$CI_COMPOSE" down -v --remove-orphans'
      archiveArtifacts artifacts: 'backend/openapi-schema.yml,frontend/coverage/**,frontend/dist/**', allowEmptyArchive: true
    }
  }
}
