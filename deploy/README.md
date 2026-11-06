# Appmeal API on Viettel

Current API: `https://com365.lcit.vn:4002/api`.
SSH host: `192.168.251.115`; application: `/opt/web_comtrua/lcit-meal-api`.
Supervisor program: `com365.lcit.vn_p4002`.

The API uses the existing Neon PostgreSQL database through `DATABASE_URL`.
Keep the database URL and the existing Neon deployment's `JWT_SECRET` in the
server's `.env` (mode 600), with `PORT=4002`, `HOST=0.0.0.0`, and `CORS_ORIGINS`
including `https://com365.lcit.vn`. Do not copy MySQL settings into this deployment.

Node.js is installed at `/root/.nvm/versions/node/v22.21.1/bin`; add this directory
to `PATH` for non-interactive SSH commands. Stage releases under
`/opt/web_comtrua/releases`, install with `npm ci`, and run `npm run test:postgres`
and `npm run test:auth:postgres` there. These integration tests use isolated schemas.
The existing Neon schema is already populated; do not import `sql/qlsa.sql`, seed
demo users, or bootstrap another administrator. Back up before any future migration.

Before switching code, back up the running API, Supervisor configuration, and Neon
data under `/opt/backups/com365/<release>`. Preserve `public/uploads`, `user_data`,
and `.git` on the server. Restart only the API with
`supervisorctl restart com365.lcit.vn_p4002`. Verify
`https://com365.lcit.vn:4002/healthz`, authenticated reads, and browser CORS after
every deployment. Logs are `/var/log/com365/out_be.log` and
`/var/log/com365/err_be.log`.

The mobile default URL, `.env.example`, and EAS preview/production profiles point
to Viettel. Rebuild installed mobile binaries to embed the new URL; when running
locally, remove any old `EXPO_PUBLIC_API_URL` override before restarting Metro.

The previous cloud VM is separate infrastructure. Switching this API does not stop
its service or scheduled jobs. Disable the old API service after checking access
and completing the cutover to avoid two sets of jobs using the same Neon database.

## Previous Google Cloud deployment (historical)

The instructions and `Caddyfile` / `install-appmeal.sh` below describe the previous
cloud host; do not run them on the Viettel server.

Target: VM `appmeal`, zone `asia-southeast1-c`, project `project-5478c3b3-05cd-4d6a-bce`.
Web: `https://appmeal.34.126.188.117.sslip.io`; API: same origin under `/api`.

The API selects PostgreSQL when `DATABASE_URL` is configured. Neon credentials and
`JWT_SECRET` belong in `/opt/appmeal/lcit-meal-api/.env` (mode 600); never commit them.
The API listens on localhost port 3000; Caddy provides HTTPS and static web files.

For a new database, run `npm run migrate:postgres`, then run `npm run bootstrap:admin`
once with a unique `INITIAL_ADMIN_PASSWORD` environment variable of at least 16
characters. Remove that variable after bootstrap. No demo accounts are created.
Automatic meal registration starts disabled until staff and schedules are configured.

Export the web client with `npx expo export --platform web --output-dir dist` from
`lcit-meal-mobile`, copy its contents to `/opt/appmeal/web`, and copy the API and
deployment files under `/opt/appmeal`. Run `deploy/install-appmeal.sh`, then install
`deploy/Caddyfile` as `/etc/caddy/Caddyfile` and reload Caddy.

Verify `/healthz`, login, and authenticated API requests after every deployment.
Inspect service logs with `journalctl -u appmeal` and `journalctl -u caddy`.
Run `npm run test:postgres` to test against a disposable schema on Neon's direct
endpoint; it does not change production records. Run the client's typecheck, lint,
and tests before exporting a new web build.

The external IP is reserved as `appmeal-ip` in region `asia-southeast1`.
Keep this reservation when stopping or replacing the VM so the hostname stays valid.
