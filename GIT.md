# Git Workflow

This project uses GitHub Pull Requests as the required path into `main`.

GitLab calls this a merge request. GitHub calls the same idea a pull request, or PR. In this repository, use the GitHub term when working in the UI.

## Current Rule

`main` is protected.

That means:

- do not push work directly to `main`
- create a feature branch for each change
- open a Pull Request into `main`
- Jenkins must pass before the PR can be merged
- any collaborator with write access can merge once Jenkins is green
- required human approvals are currently set to `0`, so work is not blocked when one developer is absent

The required Jenkins check is:

```text
continuous-integration/jenkins/branch
```

If this check is pending or failed, GitHub should block the merge button.

This is one shared Jenkins setup for the team. Developers do not need to create their own Jenkins jobs or credentials on their machines. Each developer only needs normal GitHub repository access and Tailscale access if they want to open the Jenkins UI.

The current repository rule is designed for a two-person team:

- both developers can create branches
- both developers can open Pull Requests
- both developers can merge a Pull Request after Jenkins succeeds
- no human approval is required because `Required approvals` is `0`
- Jenkins is the mandatory gate into `main`
- direct pushes to `main` should be rejected by GitHub

## Normal Development Flow

Start from an up-to-date `main`:

```bash
git checkout main
git pull
```

Create a branch:

```bash
git checkout -b feature/CAT-123-short-description
```

Make changes, then inspect them:

```bash
git status
git diff
```

Commit:

```bash
git add .
git commit -m "feat: Describe the change"
```

Push the branch:

```bash
git push -u origin feature/CAT-123-short-description
```

Open a Pull Request on GitHub from your branch into `main`.

## Pull Request Checklist

Before merging, check:

- the PR targets `main`
- Jenkins check is visible
- Jenkins check is successful
- the changed files match the issue scope
- no secrets or private data were committed
- migrations are included when Django models changed
- docs are updated when behavior or setup changed

## If Jenkins Fails

Do not merge.

Open the failed Jenkins build, read the failing stage, fix the branch, then push another commit:

```bash
git status
git add .
git commit -m "fix: Address CI failure"
git push
```

The same PR will update automatically and Jenkins will run again.

If Jenkins fails with exit code `137`, treat it as a Jenkins host resource problem first. It usually means Linux killed a process because the server ran out of memory.

In that case:

- rerun the Jenkins build once
- if it fails again, check for old CI containers on the Jenkins host
- keep the shared Jenkins built-in executor count at `1`
- do not randomly change application code unless the failing log points to a real code error

## If the Branch Is Behind Main

If GitHub says the branch is out of date, update it:

```bash
git checkout main
git pull
git checkout feature/CAT-123-short-description
git merge main
git push
```

Resolve conflicts locally if Git asks you to.

## Merging

When Jenkins is green, click the merge button in GitHub.

For small feature branches, prefer `Squash and merge` if available. It keeps `main` readable by turning the branch into one clean commit.

After the PR is merged:

```bash
git checkout main
git pull
git branch -d feature/*part*/CAT-123
( for instance: feature/backend/CAT-010)
```

You can also delete the remote branch from the GitHub PR page.

## Direct Push Test

To confirm protection is working, a direct push to `main` should be rejected by GitHub.

Only run this when you have no uncommitted work:

```bash
git checkout main
git pull
git commit --allow-empty -m "test: verify main direct push is blocked"
git push origin main
```

Expected result: GitHub rejects the push because `main` is protected.

Clean up the local test commit:

```bash
git reset --hard origin/main
```

Do not run `git reset --hard` if you have local changes you want to keep.

## If You Committed On Main By Mistake

Do not force push `main`. GitHub should reject it anyway because `main` is protected.

Create a branch from your local commit and push that branch instead:

```bash
git checkout -b docs/CAT-000-my-change
git push -u origin docs/CAT-000-my-change
```

Then open a Pull Request from that branch into `main`.

After the Pull Request is merged, update local `main`:

```bash
git checkout main
git pull
```

## Force Push Rule

Do not force push to `main`.

Avoid force pushing feature branches unless you know why it is needed. If you must update a feature branch history, use:

```bash
git push --force-with-lease
```

`--force-with-lease` is safer than `--force` because it refuses to overwrite remote work you have not fetched.

## Branch Naming

Use short, issue-based names:

```text
feature/*part*/CAT-123-report-api
fix/*part*/CAT-124-login-validation
docs/*part*/CAT-125-jenkins-guide
ci/*part*/CAT-126-pipeline-fix
test/*part*/CAT-127-auth-tests
```

Avoid long-running branches like:

```text
frontend
backend
final-version
all-changes
```

Small PRs are easier to review, easier to fix, and safer to merge.
