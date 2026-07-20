Thanks for the detailed context and for sharing your workflow. I pulled up your Cypress workflow and the Hatchet “hatchet‑lite” docs and read through both carefully. Below is a prioritized diagnosis of what’s most likely breaking the Hatchet‑dependent tests, plus concrete fixes (with YAML you can drop in).

---

## What’s most likely going wrong

### 1) Wrong env var names for the worker/SDK (your app/tests)

Your Cypress step sets:

```yaml
env:
  HATCHET_API_URL: http://127.0.0.1:8888
  HATCHET_TENANT_ID: 707d0855-80ab-4e1f-a156-f1c4546cbf52
  HATCHET_HOST_PORT: 7077
```

But the **SDKs expect**:

* `HATCHET_CLIENT_TOKEN` (required)
* `HATCHET_CLIENT_HOST_PORT` (e.g. `127.0.0.1:7077`), **not** `HATCHET_HOST_PORT`
* (very important here) `HATCHET_CLIENT_TLS_STRATEGY` (defaults to `tls`)—see next point

The Hatchet docs explicitly list the supported env vars; `HATCHET_CLIENT_HOST_PORT` is the correct key and the TLS default is `tls`. If you don’t provide `HATCHET_CLIENT_TLS_STRATEGY=none` while your server is running **insecure gRPC**, the client will attempt TLS and fail the handshake. ([docs.hatchet.run][1])

**Impact:** your worker/app can’t connect to the Hatchet engine even though the container is up, leading to inexplicable failures in tests that depend on Hatchet.

---

### 2) TLS mismatch between your Hatchet server and clients

Your service config sets the hatchet engine to **insecure** gRPC:

```yaml
SERVER_GRPC_INSECURE: 't'
SERVER_GRPC_BIND_ADDRESS: '0.0.0.0'
SERVER_GRPC_BROADCAST_ADDRESS: 127.0.0.1:7077
```

But SDKs default to `HATCHET_CLIENT_TLS_STRATEGY=tls`. If you don’t override it, every connection will try TLS to an insecure server and fail. You must set `HATCHET_CLIENT_TLS_STRATEGY=none` for clients in this setup. ([docs.hatchet.run][1])

---

### 3) No readiness gate for Hatchet itself

Your workflow’s readiness checks (both the custom `wait-for-services.sh` **and** the `cypress-io/github-action` `wait-on`) only wait for your own HTTP services on ports `3000–3010`. There is **no wait** on `http://127.0.0.1:8888` or the gRPC port `7077`. The hatchet‑lite container starts, runs migrations/initialization, and may be briefly unavailable; any tests that need Hatchet can race and fail intermittently.

From the official quickstart, hatchet‑lite exposes `8888` (UI/API) and `7077` (engine gRPC). You should include those endpoints in your readiness gating. ([docs.hatchet.run][2])

---

### 4) Cookie domain inconsistencies (minor but can bite)

In **draft** job you set `SERVER_AUTH_COOKIE_DOMAIN: 127.0.0.1`, in **cloud** job it’s `SERVER_AUTH_COOKIE_DOMAIN: hatchet`. The docs show `localhost` for local compose usage. If your token creation or UI authentication path relies on cookies, mismatched cookie domains can block logins/token flows. Safer to standardize on `localhost` for local CI use (or avoid UI cookies entirely and create tokens via CLI). ([docs.hatchet.run][2])

---

### 5) Possibly fragile token creation path

The docs recommend creating a token via the admin CLI inside the hatchet‑lite container:

```
/hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52
```

…and then setting the **client** env var `HATCHET_CLIENT_TOKEN`. If your script `util/_create_hatchet_token_cypress.sh` doesn’t actually run that command in the running *service* container (or otherwise fetch a token via API), your clients will be missing the required token and will fail to auth. (Required var is `HATCHET_CLIENT_TOKEN`—the SDKs no longer require a separate tenant env var; it’s embedded in the token.) ([docs.hatchet.run][2])

---

### 6) Using `:latest` image tag

You’re pinning `ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest`. Upstream moves quickly and can ship breaking changes; a new image can suddenly break CI. Prefer pinning a known-good minor or patch version (e.g. `v0.73.1`) for deterministic CI. (The GHCR package shows current tags; choose a fixed one.) ([GitHub][3])

---

## Minimal, high‑impact fixes (with YAML)

### A) Fix the client env vars + TLS

Add these to **where your worker/app runs** (i.e., whichever step actually starts your node processes that talk to Hatchet), and to your **Cypress** step if the tests instantiate any Hatchet clients directly:

```yaml
env:
  # required for the SDK to authenticate
  HATCHET_CLIENT_TOKEN: ${{ secrets.HATCHET_CLIENT_TOKEN_CI }} # or export from your token script

  # point SDKs at your local engine
  HATCHET_CLIENT_HOST_PORT: 127.0.0.1:7077

  # match the server's insecure gRPC for local CI
  HATCHET_CLIENT_TLS_STRATEGY: none
```

**Why:** correct key names, a full `host:port`, and a TLS strategy that matches your `SERVER_GRPC_INSECURE=t` fix the most likely connection failures. ([docs.hatchet.run][1])

> If your current `_create_hatchet_token_cypress.sh` already generates a token, have it **export** or **write** `HATCHET_CLIENT_TOKEN` into an `.env` that the app/Cypress actually loads; otherwise inject it directly in the workflow with a GitHub secret.

---

### B) Wait for Hatchet before testing

Extend your readiness script and `wait-on` to include Hatchet:

* If your `wait-for-services.sh` takes a space-separated list of URLs, include `http://127.0.0.1:8888` (the UI/API port is sufficient for “is up”).
* Also add a TCP wait for the gRPC port (the Cypress action uses `wait-on` under the hood; you can add `tcp:127.0.0.1:7077`):

```yaml
with:
  wait-on: >
    http://127.0.0.1:3000/healthz,
    http://127.0.0.1:3001,
    http://127.0.0.1:3002,
    http://127.0.0.1:3003,
    http://127.0.0.1:3010,
    http://127.0.0.1:8888,
    tcp:127.0.0.1:7077
  wait-on-timeout: 300
```

**Why:** removes race conditions where Cypress hits your app while Hatchet is still booting/migrating. ([docs.hatchet.run][2])

---

### C) Normalize server config for local CI

In the `services.hatchet.env` section, prefer:

```yaml
SERVER_AUTH_COOKIE_DOMAIN: localhost
SERVER_URL: http://127.0.0.1:8888
SERVER_GRPC_BIND_ADDRESS: 0.0.0.0
SERVER_GRPC_INSECURE: 't'
SERVER_GRPC_BROADCAST_ADDRESS: 127.0.0.1:7077
# (optional but recommended for hatchet-lite)
SERVER_INTERNAL_CLIENT_INTERNAL_GRPC_BROADCAST_ADDRESS: 127.0.0.1:7077
```

These mirror the docs for hatchet‑lite and avoid oddities with cookie scope. The internal broadcast address is recommended in the quickstart examples. ([docs.hatchet.run][2])

---

### D) Pin the image version

Change:

```yaml
image: ghcr.io/hatchet-dev/hatchet/hatchet-lite:v0.73.1
```

(or whichever tag you’ve validated). This avoids surprise breakage when `:latest` changes. ([GitHub][3])

---

### E) Make token creation deterministic in Actions

Two reliable patterns:

**Option 1 (inside the running service):**

```yaml
- name: Create Hatchet API token (via admin CLI)
  run: |
    set -euo pipefail
    # Find the hatchet-lite container and exec the admin tool
    HATCHET_CID=$(docker ps --filter "ancestor=ghcr.io/hatchet-dev/hatchet/hatchet-lite" --format "{{.ID}}" | head -n1)
    TOKEN=$(docker exec "$HATCHET_CID" /hatchet-admin token create --config /config --tenant-id 707d0855-80ab-4e1f-a156-f1c4546cbf52 | xargs)
    echo "HATCHET_CLIENT_TOKEN=$TOKEN" >> $GITHUB_ENV
```

**Option 2 (pre-created secret):** Create once locally (or with a separate admin step), store as `HATCHET_CLIENT_TOKEN_CI` secret, and inject it into the job’s env (simplest if your tenant/keys are ephemeral in CI). The SDKs only require the token; tenant id is embedded in it now. ([docs.hatchet.run][2])

---

### F) Capture real logs from Hatchet (improve debugging)

Right now you upload only a generic `service.log`. Add a “dump logs” step that runs **always** and grabs container logs:

```yaml
- name: Dump Hatchet & Postgres logs
  if: always()
  run: |
    mkdir -p logs
    docker ps -a
    docker logs $(docker ps -a --filter "ancestor=ghcr.io/hatchet-dev/hatchet/hatchet-lite" --format "{{.ID}}" | head -n1) > logs/hatchet-lite.log 2>&1 || true
    docker logs $(docker ps -a --filter "name=postgres_hatchet" --format "{{.ID}}" | head -n1) > logs/postgres-hatchet.log 2>&1 || true

- uses: actions/upload-artifact@v4
  if: always()
  with:
    name: hatchet-logs
    path: logs
    if-no-files-found: ignore
    retention-days: 7
```

And bump verbosity in the service:

```yaml
SERVER_LOGGER_LEVEL: debug
SERVER_LOGGER_FORMAT: console
```

(see configuration options). ([docs.hatchet.run][4])

---

## A compact patch (illustrative)

Below shows just the **key deltas** you need to apply in **both** `cypress-run-parallel-draft` and `cypress-run-cloud` jobs.

```diff
 services:
   hatchet:
-    image: ghcr.io/hatchet-dev/hatchet/hatchet-lite:latest
+    image: ghcr.io/hatchet-dev/hatchet/hatchet-lite:v0.73.1
     ports:
       - '8888:8888'
       - '7077:7077'
     env:
-      SERVER_AUTH_COOKIE_DOMAIN: 127.0.0.1   # or 'hatchet' in the other job
+      SERVER_AUTH_COOKIE_DOMAIN: localhost
       SERVER_AUTH_COOKIE_INSECURE: 't'
       SERVER_GRPC_BIND_ADDRESS: '0.0.0.0'
       SERVER_GRPC_INSECURE: 't'
       SERVER_GRPC_BROADCAST_ADDRESS: 127.0.0.1:7077
+      SERVER_INTERNAL_CLIENT_INTERNAL_GRPC_BROADCAST_ADDRESS: 127.0.0.1:7077
       SERVER_GRPC_PORT: '7077'
       SERVER_URL: http://127.0.0.1:8888
       SERVER_AUTH_SET_EMAIL_VERIFIED: 't'
       SERVER_DEFAULT_ENGINE_VERSION: 'V1'
+      SERVER_LOGGER_LEVEL: debug
+      SERVER_LOGGER_FORMAT: console

 # ensure hatchet is included in readiness
 - name: Start services and wait for readiness
   run: |
     chmod +x .github/scripts/wait-for-services.sh
-    .github/scripts/wait-for-services.sh
+    .github/scripts/wait-for-services.sh
   env:
     SERVICE_ENDPOINTS: >
-      http://127.0.0.1:3000/healthz http://127.0.0.1:3001 http://127.0.0.1:3002
-      http://127.0.0.1:3003 http://127.0.0.1:3010
+      http://127.0.0.1:3000/healthz http://127.0.0.1:3001 http://127.0.0.1:3002
+      http://127.0.0.1:3003 http://127.0.0.1:3010 http://127.0.0.1:8888

 # Cypress action: add waits and correct env vars
 - name: Cypress run …
   uses: cypress-io/github-action@v6
   with:
-    wait-on: 'http://127.0.0.1:3000/healthz, http://127.0.0.1:3001, http://127.0.0.1:3002, http://127.0.0.1:3003, http://127.0.0.1:3010'
+    wait-on: >
+      http://127.0.0.1:3000/healthz,
+      http://127.0.0.1:3001,
+      http://127.0.0.1:3002,
+      http://127.0.0.1:3003,
+      http://127.0.0.1:3010,
+      http://127.0.0.1:8888,
+      tcp:127.0.0.1:7077
     wait-on-timeout: 300
   env:
-    HATCHET_API_URL: http://127.0.0.1:8888
-    HATCHET_TENANT_ID: 707d0855-80ab-4e1f-a156-f1c4546cbf52
-    HATCHET_HOST_PORT: 7077
+    # use the SDK env vars
+    HATCHET_CLIENT_HOST_PORT: 127.0.0.1:7077
+    HATCHET_CLIENT_TLS_STRATEGY: none
+    HATCHET_CLIENT_TOKEN: ${{ env.HATCHET_CLIENT_TOKEN }}  # set earlier

+# after tests (or always), collect logs for debugging
+- name: Dump Hatchet & Postgres logs
+  if: always()
+  run: |
+    mkdir -p logs
+    docker ps -a
+    docker logs $(docker ps -a --filter "ancestor=ghcr.io/hatchet-dev/hatchet/hatchet-lite" --format "{{.ID}}" | head -n1) > logs/hatchet-lite.log 2>&1 || true
+    docker logs $(docker ps -a --filter "name=postgres_hatchet" --format "{{.ID}}" | head -n1) > logs/postgres-hatchet.log 2>&1 || true
+- uses: actions/upload-artifact@v4
+  if: always()
+  with:
+    name: hatchet-logs
+    path: logs
+    if-no-files-found: ignore
+    retention-days: 7
```

*(The `ancestor=` filter will match the hatchet‑lite container even though GitHub Actions gives it an autogenerated name. You can also switch to a name label if you prefer.)*

---

## Why these changes are sufficient

* **Correct SDK env**: `HATCHET_CLIENT_HOST_PORT`, `HATCHET_CLIENT_TLS_STRATEGY=none`, and a valid `HATCHET_CLIENT_TOKEN` line up with the documented expectations of the SDKs; `HATCHET_HOST_PORT` is ignored by SDKs. ([docs.hatchet.run][1])
* **Readiness**: Hatchet‑lite’s documented ports (`8888` and `7077`) are properly waited on, eliminating race conditions. ([docs.hatchet.run][2])
* **Cookie domain cleanup**: aligns with the docs’ local examples and avoids subtle auth issues if you ever touch the UI/login in CI. ([docs.hatchet.run][2])
* **Pinned image**: stabilizes CI against upstream changes. ([GitHub][3])
* **Logs**: tangible error messages from the Hatchet engine and its Postgres are preserved for failed runs, making further debugging straightforward. ([docs.hatchet.run][4])

---

## References I used while reviewing

* Your workflow (`cypress-testing.yml`) showing service definitions and env values. ([GitHub][5])
* Hatchet Lite deployment and example env (ports, cookie domain, broadcast address, token creation). ([docs.hatchet.run][2])
* Worker/SDK configuration (required client env vars + TLS default behavior). ([docs.hatchet.run][1])
* Full configuration options to increase logging when needed. ([docs.hatchet.run][4])
* GHCR package page to illustrate pinning to a specific `hatchet-lite` tag. ([GitHub][3])

---

### If it still fails after the above

Grab the `hatchet-lite.log` artifact and search for:

* `tls`/`handshake` errors → missing `HATCHET_CLIENT_TLS_STRATEGY=none`.
* `unauthorized`/`permission` → missing/incorrect `HATCHET_CLIENT_TOKEN`.
* `dial tcp` or `connection refused` → missing waits on `8888`/`7077` or wrong `CLIENT_HOST_PORT`.
* DB migration errors in Hatchet’s Postgres → check `postgres_hatchet` logs and the `DATABASE_URL` pointing to `postgres_hatchet:5432` (looks correct in your workflow). ([GitHub][5])

Apply the small set of fixes above and the Hatchet-dependent specs should start behaving like the rest of your suite.

[1]: https://docs.hatchet.run/self-hosting/worker-configuration-options "Worker Configuration Options - Hatchet Documentation"
[2]: https://docs.hatchet.run/self-hosting/hatchet-lite "Hatchet Lite Deployment - Hatchet Documentation"
[3]: https://github.com/-/hatchet-dev/packages/container/package/hatchet%2Fhatchet-lite?utm_source=chatgpt.com "Package hatchet/hatchet-lite · GitHub"
[4]: https://docs.hatchet.run/self-hosting/configuration-options?utm_source=chatgpt.com "Configuration Options - Hatchet Documentation"
[5]: https://raw.githubusercontent.com/uzh-bf/klicker-uzh/refs/heads/v3-assessment/.github/workflows/cypress-testing.yml "raw.githubusercontent.com"
