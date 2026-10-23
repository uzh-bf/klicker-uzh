# Deployment artifacts

Start with the [self-hosting guide](../apps/docs/docs/self-hosting/overview.md).

- `charts/klicker-uzh-v3`: current application chart; requires externally provisioned infrastructure and Secrets. The directory name is v3 even though the chart's internal name is still `klicker-uzh-v2`
- `env-uzh-prd`, `env-uzh-stg`: UZH-specific values, not portable self-host configuration
- `compose`, `compose-traefik-proxy`, `charts/klicker-uzh-v2`: legacy v1/v2 examples, not current v3 deployment instructions

The legacy Compose examples' MinIO/S3 environment variables do not enable S3 uploads in the current v3 code. For a local trial use the [evaluation guide](../apps/docs/docs/self-hosting/evaluation.md); for retained data read the [production requirements and bootstrap gaps](../apps/docs/docs/self-hosting/production.md).
