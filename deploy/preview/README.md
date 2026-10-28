# Preview deployment configuration and bootstrap

The generic Devrouter controller owns preview admission, deadlines and teardown.
Klicker owns its build inputs, database initialization and synthetic fixtures.
The root preview manifest and rollout plan are prepared. No default workflow is
installed, and live admission remains disabled until qualification completes.
Provider-specific allocation, volume mounts and service environment bindings
stay in the private installation layer.

## Disposable PostgreSQL

`packages/prisma/scripts/previewBootstrap.ts` initializes a newly allocated,
empty preview database. It defaults to dry-run and repeats target validation
under an advisory lock before writing. It refuses retained or partially
initialized targets. A partial failure requires a new environment.

The initial database may contain provider statistics views from
`pg_stat_statements` and `pg_stat_kcache`. Only their exact extension-owned view
names are exempt from the empty-schema check. Ordinary views, lookalike names,
other extension-owned relations and data-bearing relations still refuse initialization.
PostgreSQL 17 or later is required before any role is created.

The trusted runtime job injects these environment variables directly:

| Variable                                 | Purpose                                                              |
| ---------------------------------------- | -------------------------------------------------------------------- |
| `KLICKER_PREVIEW_DISPOSABLE`             | Must equal `1`                                                       |
| `KLICKER_PREVIEW_POSTGRES_HOST`          | Exact private host of the owned addon                                |
| `KLICKER_PREVIEW_BOOTSTRAP_DATABASE_URL` | Privileged TLS URL for the owned `klicker_bootstrap` database        |
| `KLICKER_PREVIEW_APP_PASSWORD`           | Fresh generation-scoped password for the restricted application role |
| `DRY_RUN`                                | Writes require exactly `false`; otherwise validation only            |

The script rejects ambient `PG*` variables and other database URL overrides.
Controller credentials never belong in this job. Do not put injected values in
command arguments, files or logs.

Run from the repository root inside the provisioned development container, or
from `/app` inside the fixture image:

```sh
pnpm --filter @klicker-uzh/prisma exec tsx scripts/previewBootstrap.ts
```

Write mode creates the restricted `klicker_test` role and creates the application
and shadow databases from PostgreSQL's empty `template0`, owned by that role.
Both databases must be absent before initialization and receive the markers
required by the repository's disposable-database guards. The bootstrap verifies
restricted login, schema access and the absence of other sessions in each new
database. Provider activity may remain in the separate bootstrap database.
Hatchet uses its own addon and the manifest’s single `hatchet-init` job. The app bootstrap refuses an addon already containing Hatchet resources. Migration and seed
execution are later jobs using restricted credentials.

`pnpm --filter @klicker-uzh/prisma test:disposable` runs the bootstrap regression
cases alongside the existing disposable-database checks. These tests use
synthetic query clients and perform no database mutation.

Native jobs use `node /app/deploy/preview/bootstrap.mjs bootstrap` for the
one-time database initialization and `node /app/deploy/preview/bootstrap.mjs
fixtures` for guarded migration deployment followed by synthetic seed data.
The wrapper resolves the package directory from its own location, accepts only
these two operations and bounds the complete operation to eight minutes. It
reports phases while suppressing raw child output that could contain runtime
credentials. The existing database identity and dry-run guards still apply.

The helper image compiles its TypeScript entrypoints and copies their traced
runtime files into a separate final stage. That stage retains the Prisma CLI,
schema and migrations, generated client, synthetic seeds, transactional HTML
and MCP harness. It runs Node directly and contains no pnpm, npm, tsx or esbuild.
The full workspace and build dependencies remain in the builder. Tracing is
packaging evidence; the resulting image still requires its own vulnerability
scan and isolated bootstrap, seed and MCP acceptance checks.

Bootstrap CLI failures use exit codes `2` (input refusal), `3` (inspection
refusal before writes), `4` (write failure) and `5` (verification failure).
The wrapper emits `KLICKER_BOOTSTRAP_FAILURE_<code>` for these failures while
keeping raw child output suppressed. Every failed initialization still requires
a new generation.

The trusted installation runs initialization jobs only on creation, using the
provider's `runNodeOnce` fence and zero automatic retries. Refresh and extension
do not rerun successful jobs. Any initialization failure requires teardown and a
new generation, including failure of the verification after ownership changes.

## Remaining qualification

Live proof of native bootstrap, worker startup and task processing, network
access policy, controller expiry, extension and stop behavior, and complete
resource cleanup remains pending. This source slice prepares the manifest and
plan and does not prove native runtime behavior. See the
[approved rollout plan](../../project/2026-10-26-devrouter-preview-rollout-plan.md)
for the remaining acceptance checks.

## Deployment configuration

Serving applications know origins, backing-service endpoints and the optional
server runtime `KLICKER_COOKIE_NAMESPACE`. The same namespace must be supplied
to auth, PWA, Chat, API, response API, response worker, LTI and GraphQL callers.
Unset or empty preserves legacy names. Invalid values and the removed public
preview variable refuse on cookie-name resolution. Namespacing separates
trusted environments on the flat shared domain; access policy stays at ingress.

The five Next images accept optional non-secret
`KLICKER_DEPLOYMENT_BUILD_ENV_JSON`. The build helper validates only declared
keys and supplemental build inputs, requiring explicit overrides for committed
production defaults. Telemetry and optional flags have safe defaults. An absent
envelope preserves ordinary builds; a non-empty old preview envelope refuses.
Build arguments must never carry credentials. Public Next variables remain
build-time values; runtime injection alone cannot change browser bundles.

Devrouter and its provider adapter own lifecycle, generation identity, network
policy and credential injection. This app-owned tooling handles only build
configuration, guarded schema initialization and synthetic fixtures. Bootstrap
credentials belong to the one-time job; serving images keep ordinary commands.

## Chat deployment harness

The Chat profile reuses the local `chat`, `ai` and `mcp` profile union.
Its cloud bindings omit the unused local MCP database. The fixture job migrates
and seeds the restricted application database, then runs
`deploy/preview/configure-fixtures.mjs`. This step binds the known synthetic
chatbot and its existing synthetic knowledge base to the private MCP service, disables its
seeded external documentation tool, and creates Blob containers with CORS for
only the selected browser origins. Conflicting ownership refuses the operation.

`runtime.mjs` starts Chat, MCP or Azurite only when explicitly selected by the
preview manifest. The normal Chat image command remains the Next server.
The wrapper validates P-256 keys, decodes base64 PEM inputs in memory, forwards
termination signals and preserves the child's exit status. Hatchet's existing
private config volume persists one key pair in an atomically installed directory;
incomplete or mismatched keys refuse startup. Only Chat receives the private key
as `KLICKER_PREVIEW_SCOPE_PRIVATE_KEY`, which becomes the existing
`DOC_QUERY_SCOPE_PRIVATE_KEY` for its child process. MCP receives only
`KLICKER_PREVIEW_SCOPE_PUBLIC_KEY`, decoded as `LOCAL_MCP_PUBLIC_KEY`.
The installation supplies the same generation-derived `DOC_QUERY_SCOPE_KID`,
issuer and audience to both. A generated `LOCAL_MCP_TRANSPORT_TOKEN` reaches
MCP directly and the fixture job, which encrypts it into the owned server row
using the application secret. The fixture job never receives the signing key.

MCP accepts the declared private service authority and its resolved RFC1918
IPv4 address. The configurator stores the latter because the existing Chat
transport requires a private address for plain HTTP. A binding-only rerun
retains the generation and encrypted token and updates only the owned endpoint.
Native address stability and automated binding refresh remain unqualified;
refresh must not rerun migrations or seeds. The initial deployment alone does
not establish installed refresh or extension support.

Azurite uses a generated account key shared with the application SDK; its public
endpoint serves browser uploads while server requests use the private endpoint.
The LiteLLM image copies the existing repository configuration. Its upstream
credential is runtime-only. Neither image introduces a new application API.

Run the harness tests with `node --test deploy/preview/runtime.test.mjs
 deploy/preview/configure-fixtures.test.mjs`. The existing Chat authenticator suite also exercises the real signer/verifier
with decoded deployment keys. Run that suite in the provisioned container. These source checks do not enable installed preview admission.

Azurite currently stores data in its ephemeral container filesystem. Restart
persistence for containers, uploaded objects and CORS is unqualified. A
reviewed volume binding or idempotent startup configuration is required before
claiming refresh/restart support; recreating a generation loses uploaded data.

## CI image reuse

The remote manifest maps application resources to logical CI image targets. The
existing image workflow has an opt-in dispatch path for an exact commit, selected
targets and one native CPU platform. Its frontend variants include complete public
build configuration in their identity. Builds publish images only; they do not
start or refresh environments.

Install a reviewed copy of `resolve-images.mjs` with its trusted CI helpers under
the operator installation directory. Its JSON protocol is the generic Devrouter
image backend contract. Keep publishing/controller credentials in mapped scoped
environment variables. `DEVROUTER_PREVIEW_GITHUB_CONTROL_REF` names the reviewed
producer branch or tag; its resolved commit must equal the installed
`producer.controlRevision`. A moved ref requires review before dispatch. For a
private registry, `DEVROUTER_PREVIEW_DOCKER_CONFIG` can name an existing protected
Docker authentication directory. Its contents stay outside candidate builds and
receipt output. The adapter checks successful CI and immutable registry
platforms; it returns no credentials. Northflank receives admitted digests and
existing registry pull-credential references. A missing CI image never falls back
to a Northflank source build.

Qualification still requires proof of the selected Northflank architecture and an
actual image deployment with no provider build. The previous trial deadline does
not authorize another paid generation. Record CI image waiting/build time
separately from provisioning with available images. The source/contract tests do
not provide those live timings.
