# Jenkins

This project uses the root `Jenkinsfile` for the Docker Compose CI pipeline.

The Jenkins documentation is split by workflow:

- [Initialize Jenkins](docs/initialize.md): start Jenkins and expose it through Tailscale.
- [Setup the Jenkins Job](docs/setup-job.md): create the Multibranch Pipeline job and connect it to GitHub.
- [Use Jenkins as a Developer](docs/developer-usage.md): push feature branches, open pull requests, and read Jenkins results.

For the shared CatSOS Jenkins instance, use:

```text
https://debian.boston-spica.ts.net/
```
