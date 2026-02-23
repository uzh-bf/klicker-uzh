# LTI

LTI 1.3 tool provider service (ltijs) used for LMS integrations. Verifies LTI launches and redirects into Klicker with a short-lived JWT (`lti-token`) scoped to the configured cookie domain.

## Code

- App: `apps/lti/`
- Entry point: `apps/lti/src/index.ts`
- Launch target parsing/validation: `apps/lti/src/launchTarget.ts`

## External interface

- LTI app route: `/` (launch endpoint configured as `appRoute`)
- OIDC login initiation: `/login` (configured as `loginRoute`)
- Debug/info endpoint: `GET /info`

## Responsibilities

- Host the LTI 1.3 provider endpoints (OIDC login + launch) and delegate token validation to `ltijs`.
- Issue a short-lived JWT (`lti-token`) signed with `APP_SECRET` and issuer `APP_ORIGIN_LTI`.
- Set the `lti-token` cookie (Secure, SameSite=None) scoped to `COOKIE_DOMAIN`.
- Resolve a safe post-launch redirect target with strict precedence:
  - custom claim `klicker_redirect_to`
  - query parameter `redirectTo`
- Validate redirect hostnames against `COOKIE_DOMAIN` and `DF_DOMAIN` (exact host or subdomain match).
- Persist LTI platform registrations via `ltijs-sequelize` (separate from the main Prisma database).

## Dependencies

- **LMS / LTI platform**: provides OIDC login + launch requests (OpenOLAT/Moodle, etc.).
- **PostgreSQL (LTI store)**: platform registration storage via `ltijs-sequelize` when `LTI_DB_TYPE='postgres'`.
- **Klicker workloads**: redirect targets after launch (typically Manage/PWA endpoints).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` (component `lti`)
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-lti.yaml`
- Secret: `{{ releaseFullname }}-secret-lti`
- Service: `deploy/charts/klicker-uzh-v3/templates/service-app.yaml` (port `4000`)
- Ingress: `deploy/charts/klicker-uzh-v3/templates/ingress-lti.yaml`

## Configuration (names only)

- `APP_ORIGIN_LTI` — issuer
- `APP_SECRET` — jwt
- `COOKIE_DOMAIN` — cookies
- `DF_DOMAIN` — allowlist
- `LTI_PORT` — port
- `LTI_DEV_MODE` — devmode
- `LTI_AAS_MODE` — ltiaas
- `LTI_ENCRYPTION_KEY` — encryption
- `LTI_DB_TYPE` — dbtype
- `LTI_DB_HOST` — dbhost
- `LTI_DB_PORT` — dbport
- `LTI_DB_NAME` — dbname
- `LTI_DB_USER` — dbuser
- `LTI_DB_PASS` — dbpass
- `LTI_DB_CONNECTION_STRING` — dburl
- `LTI_URL` — platform
- `LTI_NAME` — platform
- `LTI_CLIENT_ID` — platform
- `LTI_AUTH_ENDPOINT` — platform
- `LTI_TOKEN_ENDPOINT` — platform
- `LTI_KEYS_ENDPOINT` — platform

## Notes

- Launch-target validation fails closed: if neither claim nor query target is present (or allowed), the launch is rejected (see `apps/lti/src/launchTarget.ts`).
- This workload uses its own platform-registration store and does not depend on `@klicker-uzh/prisma`.
- Related docs: `[[LMS - OpenOLAT and Moodle]]`, `[[Auth]]`, `[[02-Authentication and Cookies]]`, `[[00-Component Catalog]]`.
