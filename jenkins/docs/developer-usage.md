# Use Jenkins as a Developer

Use this document for everyday work after the shared Jenkins job exists.

## The Rule

Do not push directly to `main`.

Use feature branches and pull requests:

```text
feature branch -> pull request -> Jenkins check -> merge to main
```

Jenkins does not reject the push itself. GitHub branch protection rejects merging into `main` when the Jenkins check is failing or missing.

## Normal Workflow

1. Create a feature branch:

   ```powershell
   git switch -c feature/my-change
   ```

2. Commit your work.
3. Push the branch:

   ```powershell
   git push -u origin feature/my-change
   ```

4. Open a GitHub pull request into `main`.
5. Wait for Jenkins to discover and build the pull request.
6. If Jenkins passes, continue review and merge.
7. If Jenkins fails, fix the branch and push again.

Because Jenkins is behind Tailscale, builds may start after the next repository scan instead of instantly. The recommended scan interval is 5 minutes.

## Where to Check Jenkins

Open:

```text
https://debian.boston-spica.ts.net/
```

Then open:

```text
catsos-ci
```

You should see discovered branches and pull requests. Open the branch or pull request item to see its build result and console output.

## What Passing Means

The pipeline should run these stages:

1. CI image rebuild
2. Backend Django checks and tests
3. OpenAPI generation and validation
4. Frontend lint, Jest, a11y, and TypeScript checks
5. Frontend runtime image build, including the production Vite build
6. Cypress e2e checks

All stages must pass before merging.

## If Jenkins Does Not Run

Check these in order:

1. Did you push the branch to GitHub?
2. Does the branch contain the root `Jenkinsfile`?
3. Has Jenkins scanned recently? In Jenkins, click **Scan Multibranch Pipeline Now**.
4. Is the branch or pull request visible under `catsos-ci`?
5. Is GitHub credential access still valid?
6. Is the Jenkins container running on `debian`?

Check the Jenkins server with:

```bash
docker compose -f docker-compose.jenkins.yml ps jenkins
```

## If GitHub Does Not Block Merge

Jenkins running is not enough. GitHub must protect `main`.

Check GitHub:

```text
Repository -> Settings -> Rules -> Rulesets -> Protect main
```

Required:

- **Require a pull request before merging** is enabled
- **Required approvals** is set to `0`
- **Require status checks to pass** is enabled
- `continuous-integration/jenkins/branch` is selected as a required status check
- force pushes are blocked
- branch deletion is restricted

GitHub can only list a Jenkins status check after Jenkins has reported at least one result.

If this repository uses the older branch protection UI instead of Rulesets, use:

```text
Repository -> Settings -> Branches -> Branch protection rules
```

and configure the same requirements there.

## Run the Pipeline Manually Without Jenkins

Use this only as a local fallback:

```powershell
$env:COMPOSE_PARALLEL_LIMIT = "1"
docker compose -p catsos-ci-local -f docker-compose.ci.yml build backend-test backend-openapi frontend-quality frontend-runtime frontend-dev frontend-e2e
docker compose -p catsos-ci-local -f docker-compose.ci.yml run --rm backend-test
docker compose -p catsos-ci-local -f docker-compose.ci.yml run --rm backend-openapi
docker compose -p catsos-ci-local -f docker-compose.ci.yml run --rm frontend-quality
docker compose -p catsos-ci-local -f docker-compose.ci.yml build frontend-runtime
docker compose -p catsos-ci-local -f docker-compose.ci.yml up --abort-on-container-exit --exit-code-from frontend-e2e frontend-e2e
docker compose -p catsos-ci-local -f docker-compose.ci.yml down -v --remove-orphans
```

Run the cleanup command even after failures.

The CI cleanup command is safe because Jenkins runs from `docker-compose.jenkins.yml`, while build/test containers run from `docker-compose.ci.yml`.

## If Jenkins Fails With Exit Code 137

Exit code `137` usually means Linux killed the process, most often because the Jenkins host ran out of memory.

This can happen on a small homelab server if multiple Docker builds or old CI containers run at the same time. It is usually an infrastructure/resource issue, not proof that the code is broken.

First, rerun the build once. If it fails again with `137`, check the Jenkins host:

```bash
docker compose -p catsos-ci -f docker-compose.ci.yml down -v --remove-orphans
docker ps
free -h
```

For the shared homelab Jenkins server, keep the built-in node executor count at `1`. That prevents two branch builds from competing for memory.
