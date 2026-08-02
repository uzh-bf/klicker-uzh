#!/usr/bin/env bash

set -euo pipefail

chart_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo_dir="$(cd "${chart_dir}/../../.." && pwd)"

for environment in prd stg; do
  values="${repo_dir}/deploy/env-uzh-${environment}/values.yaml"
  ingress="$(helm template klicker-uzh "${chart_dir}" \
    --values "${values}" \
    --show-only templates/ingress-backend-graphql.yaml)"
  services="$(helm template klicker-uzh "${chart_dir}" \
    --values "${values}" \
    --show-only templates/service-app.yaml)"

  grep -Fq 'haproxy.org/forwarded-for: "true"' <<<"${ingress}"
  if grep -Fq 'haproxy.org/forwarded-for' <<<"${services}"; then
    echo "forwarded-for must be configured on the ${environment} Ingress" >&2
    exit 1
  fi
done
