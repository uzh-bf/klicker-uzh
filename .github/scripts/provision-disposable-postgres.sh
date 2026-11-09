#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -lt 1 || "$#" -gt 2 || ! "$1" =~ ^[0-9a-f]{64}$ ]]; then
  echo "usage: $0 <64-hex-postgres-container-id> [klicker|klicker-prod]" >&2
  exit 2
fi

container_id="$1"
bootstrap_user="${2:-klicker}"
case "$bootstrap_user" in
  klicker|klicker-prod) ;;
  *) echo "Unsupported disposable bootstrap identity." >&2; exit 2 ;;
esac
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/../.." && pwd)"
sql_file="${repo_root}/.devcontainer/disposable-test-init.sql"

if [[ ! -f "${sql_file}" ]]; then
  echo "Disposable PostgreSQL bootstrap SQL is missing: ${sql_file}" >&2
  exit 1
fi

docker exec -i "${container_id}" \
  psql -X \
    -v ON_ERROR_STOP=1 \
    -h /var/run/postgresql \
    -p 5432 \
    -U "$bootstrap_user" \
    -d klicker-prod \
  <"${sql_file}"
