# Initialize Jenkins

Use this document when you need to start Jenkins for the first time, recover access, or expose the shared Jenkins instance through Tailscale.

## Start Local Jenkins

From the repository root:

```powershell
docker compose -f docker-compose.jenkins.yml up --build jenkins
```

Open:

```text
http://127.0.0.1:8080/
```

The Jenkins port is bound to `127.0.0.1` only. This keeps Jenkins off the public LAN by default.

Read the initial Jenkins password:

```powershell
docker compose -f docker-compose.jenkins.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

## First-Time GUI Setup

After logging in with the initial admin password:

1. If Jenkins shows **Customize Jenkins**, choose **Install suggested plugins**.
2. Wait until plugin installation finishes.
3. If Jenkins asks to create the first admin user, either create one or choose **Skip and continue as admin** for local-only usage.
4. On **Instance Configuration**, keep `http://127.0.0.1:8080/`.
5. Click **Save and Finish**.
6. Click **Start using Jenkins**.

If you chose **Skip and continue as admin** and Jenkins later asks you to log in again, use:

```text
Username: admin
Password: the initial Jenkins password
```

Read the password again with:

```powershell
docker compose -f docker-compose.jenkins.yml exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

If you created your own admin user instead, use the username and password you created during setup.

## Shared Jenkins Through Tailscale

CatSOS shared Jenkins target:

```text
Host: debian.boston-spica.ts.net
Tailscale IP: 100.90.55.44
Jenkins URL: https://debian.boston-spica.ts.net/
```

Recommended setup:

- Run Jenkins with Docker Compose on the `debian` host.
- Use `docker-compose.jenkins.yml` for the Jenkins server.
- Use `docker-compose.ci.yml` only for CI build/test containers.
- Install Tailscale on the host machine, not inside the Jenkins container.
- Expose local Jenkins with Tailscale Serve.
- Expose only the Jenkins web UI port, `8080`; this project does not use Jenkins inbound agent port `50000`.
- Do not expose Jenkins directly to the public internet.
- The Jenkins data volume keeps the existing name `catsos-ci_jenkins-home` so moving Jenkins out of the CI compose file does not reset jobs, plugins, users, or credentials.

Run the following commands on the `debian` host, not on each developer laptop.

Clone the repository:

```bash
git clone https://github.com/Nister37/CatSOS.git
cd CatSOS
```

If the repository already exists:

```bash
cd CatSOS
git pull
```

If `git pull` says this is not a Git repository, then the `CatSOS` directory exists but was not created by `git clone`. Move it aside and clone the repository again:

```bash
cd ~
mv CatSOS CatSOS.backup-$(date +%Y%m%d-%H%M%S)
git clone https://github.com/Nister37/CatSOS.git
cd CatSOS
```

Start Jenkins:

```bash
export DOCKER_SOCKET_GID=$(stat -c '%g' /var/run/docker.sock)
docker compose -f docker-compose.jenkins.yml up --build -d jenkins
```

The `DOCKER_SOCKET_GID` value lets the Jenkins container use the host Docker socket. Verify it works:

```bash
docker compose -f docker-compose.jenkins.yml exec jenkins docker ps
```

Check that Jenkins works locally on the host:

```text
http://127.0.0.1:8080/
```

Install and log in to Tailscale on the host. For a normal desktop install, use the Tailscale app and sign in. For a headless server, use a Tailscale auth key and run:

```bash
tailscale up --auth-key=<tskey-...>
```

Expose Jenkins to the tailnet:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:8080
```

Check the published tailnet URL:

```bash
tailscale serve status
```

Teammates must be logged in to the same Tailscale tailnet. They should open:

```text
https://debian.boston-spica.ts.net/
```

## Connection Security

Use the Tailscale HTTPS URL:

```text
https://debian.boston-spica.ts.net/
```

Do not use these URLs for normal shared access:

```text
http://debian.boston-spica.ts.net/
http://100.90.55.44:8080/
http://127.0.0.1:8080/
```

The raw `http://...` URLs can show **Not secure** in the browser because they do not use browser-level HTTPS. Tailscale still encrypts traffic between tailnet devices, but Jenkins should be used through the HTTPS URL when shared with the team.

If `https://debian.boston-spica.ts.net/` still shows a browser certificate warning:

1. Confirm you opened `https://debian.boston-spica.ts.net/`, not `http://...`.
2. On the `debian` host, check:

   ```bash
   tailscale serve status
   ```

3. The output should show:

   ```text
   https://debian.boston-spica.ts.net/
   |-- / proxy http://127.0.0.1:8080
   ```

4. If it does not, re-run:

   ```bash
   tailscale serve --bg --https=443 http://127.0.0.1:8080
   ```

5. In Jenkins, set the public Jenkins URL to `https://debian.boston-spica.ts.net/` under **Manage Jenkins** -> **System** -> **Jenkins URL**.

Stop sharing Jenkins through Tailscale:

```bash
tailscale serve --https=443 off
```

Stop Jenkins without deleting Jenkins data:

```bash
docker compose -f docker-compose.jenkins.yml down
```

Do not use `docker compose -f docker-compose.jenkins.yml down -v` unless you intentionally want to delete Jenkins jobs, users, plugins, and credentials.

Useful Tailscale docs:

- Tailscale Serve: `https://tailscale.com/kb/1242/tailscale-serve`
- Tailscale auth keys: `https://tailscale.com/kb/1085/auth-keys`
