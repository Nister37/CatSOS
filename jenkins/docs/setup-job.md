# Setup the Jenkins Job

Use this document once Jenkins is running. The goal is to create one shared job that discovers branches and pull requests from GitHub.

Recommended job type: **Multibranch Pipeline**.

Do not use a normal **Pipeline** job for the shared team workflow. A normal Pipeline job is fine for manual experiments, but a Multibranch Pipeline is the Jenkins job type designed for branches and pull requests.

## Before You Start

You need:

- Jenkins running at `https://debian.boston-spica.ts.net/`
- the repository URL: `https://github.com/Nister37/CatSOS.git`
- a GitHub token if the repository is private
- the `Jenkinsfile` committed at the repository root

If Jenkins is not running yet, follow [Initialize Jenkins](initialize.md).

## Install Required Plugin

In Jenkins:

1. Open **Manage Jenkins**.
2. Open **Plugins**.
3. Open **Available plugins**.
4. Search for `GitHub Branch Source`.
5. Install it if it is not already installed.
6. Restart Jenkins if Jenkins asks for it.

You need this plugin because it lets Jenkins discover GitHub branches and pull requests.

## Create the Job

1. Open Jenkins.
2. Click **New Item**.
3. Enter item name:

   ```text
   catsos-ci
   ```

4. Choose **Multibranch Pipeline**.
5. Click **OK**.

## Configure Branch Source

In the job configuration:

1. Find **Branch Sources**.
2. Click **Add source**.
3. Choose **GitHub**.

If you do not see **GitHub**, install the `GitHub Branch Source` plugin first.

Set:

```text
Credentials: your GitHub credential, or "- none -" for a public repository
Repository HTTPS URL: https://github.com/Nister37/CatSOS.git
```

Depending on the Jenkins UI version, the repository field may be split into owner/repository fields. If so, use:

```text
Owner: Nister37
Repository: CatSOS
```

## Configure Discovery

In the same **Branch Sources** section, find **Behaviors**.

Keep the setup simple:

```text
Discover branches: enabled
Discover pull requests from origin: enabled
Discover pull requests from forks: disabled for now
```

For pull request strategy, choose the option that builds the pull request as it would look after merging into the target branch. The label is usually similar to:

```text
Merging the pull request with the current target branch revision
```

This is better than testing only the branch head because it catches conflicts with `main`.

## Configure Scan Trigger

Because Jenkins is behind Tailscale, GitHub cannot call Jenkins webhooks directly.

Use polling:

1. Find **Scan Multibranch Pipeline Triggers**.
2. Enable **Periodically if not otherwise run**.
3. Set interval:

   ```text
   5 minutes
   ```

This means Jenkins will check GitHub every few minutes for new branches and pull requests.

## Save and Run

1. Click **Save**.
2. Jenkins should scan the repository.
3. If it does not scan automatically, click **Scan Multibranch Pipeline Now**.
4. Open the discovered branch or pull request job.
5. Check the build result.

After this, Jenkins should automatically create jobs for branches and pull requests that contain a `Jenkinsfile`.

## Git Credentials

Use the simplest option that matches the repository visibility:

- Public repository: use `- none -`.
- Private repository: use **Username with password**.

For **Username with password**:

```text
Username: your GitHub username, for example Nister37
Password: your GitHub token, not your GitHub account password
```

Do not choose **Secret text**, **SSH Username with private key**, or **Certificate** for this HTTPS setup.

## Generate a GitHub Token

Use this only if the repository is private.

1. Open GitHub.
2. Click your profile picture.
3. Open **Settings**.
4. Open **Developer settings**.
5. Open **Personal access tokens**.
6. Open **Fine-grained tokens**.
7. Click **Generate new token**.
8. Name it:

   ```text
   catsos-jenkins-readonly
   ```

9. Set expiration to 30 or 90 days for local learning.
10. Set repository access to **Only select repositories**.
11. Select `Nister37/CatSOS`.
12. Set repository permission **Contents** to **Read-only**.
13. Generate the token.
14. Copy it immediately. GitHub shows it only once.

Official GitHub documentation:

```text
https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
```

## Add the Token to Jenkins

In the Jenkins job configuration, next to **Credentials**:

1. Click **Add**.
2. Choose **Jenkins**.
3. Set **Kind** to **Username with password**.
4. Set **Username** to your GitHub username.
5. Set **Password** to the GitHub token.
6. Set **ID**:

   ```text
   github-nister37-readonly
   ```

7. Click **Add**.
8. Select this credential in the job.

Do not commit GitHub tokens or Jenkins credentials to the repository.

## Protect Main in GitHub

Jenkins can report pass/fail, but GitHub must block bad merges.

In GitHub:

1. Open the repository.
2. Open **Settings**.
3. Open **Branches**.
4. Add or edit the branch protection rule for:

   ```text
   main
   ```

5. Enable **Require a pull request before merging**.
6. Enable **Require status checks to pass before merging**.
7. After Jenkins has reported at least one build result, select the Jenkins status check as required.
8. Enable **Require branches to be up to date before merging** if available.
9. Disable force pushes and branch deletion.

Result:

```text
push feature branch
open pull request
Jenkins runs
GitHub blocks merge if Jenkins fails
```
