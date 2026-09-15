#!/usr/bin/env bash
# Called by devrouter while it owns the checkout and provider lifecycle locks.
# This continuation requires previously provisioned marked test databases.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_id="${DEVROUTER_RECOVERY_APP_CONTAINER:-}"
postgres_id="${DEVROUTER_RECOVERY_POSTGRES_CONTAINER:-}"
for container_id in "$app_id" "$postgres_id"; do
  [[ "$container_id" =~ ^[a-f0-9]{64}$ ]] || { echo 'Missing exact recovery container identity.' >&2; exit 1; }
done

# Pin the reviewed consumer procedure before any database write.
# Refresh every pin after changing a reviewed recovery input or helper.
[[ "$(shasum -a 256 "$root/.devcontainer/recover-bootstrap.sh" | cut -d " " -f 1)" = "70f4c231680f3cdae1e9ec02997b0565af417da691973547f86c937a14c836be" ]] || { echo "Recovery source changed: .devcontainer/recover-bootstrap.sh" >&2; exit 1; }
[[ "$(shasum -a 256 "$root/.devcontainer/disposable-test-init.sql" | cut -d " " -f 1)" = "0070db33b8d5b8a2b4eb7a597a69b63518934f611bcf5fa4aa7e02a028a61aed" ]] || { echo "Recovery source changed: .devcontainer/disposable-test-init.sql" >&2; exit 1; }
[[ "$(shasum -a 256 "$root/.github/scripts/provision-disposable-postgres.sh" | cut -d " " -f 1)" = "b1f7c3d1445ff2cf7781fdc2795ad9befacf6c95d7327c95e9af0ed88f0358a7" ]] || { echo "Recovery source changed: .github/scripts/provision-disposable-postgres.sh" >&2; exit 1; }
[[ "$(shasum -a 256 "$root/util/dev-runtime.sh" | cut -d " " -f 1)" = "688e8f6e057068aab111d2d8767668906501b76b9cc9d111c68456297829262f" ]] || { echo "Recovery source changed: util/dev-runtime.sh" >&2; exit 1; }

[[ "$(docker exec "$app_id" sha256sum /workspaces/klicker-uzh/.devcontainer/recover-bootstrap.sh | cut -d " " -f 1)" = "70f4c231680f3cdae1e9ec02997b0565af417da691973547f86c937a14c836be" ]] || { echo "Mounted bootstrap differs from reviewed source." >&2; exit 1; }
[[ "$(docker exec "$app_id" sha256sum /workspaces/klicker-uzh/util/dev-runtime.sh | cut -d " " -f 1)" = "688e8f6e057068aab111d2d8767668906501b76b9cc9d111c68456297829262f" ]] || { echo "Mounted runtime helper differs from reviewed source." >&2; exit 1; }

docker exec "$app_id" bash /workspaces/klicker-uzh/util/dev-runtime.sh begin-bootstrap >/dev/null

for attempt in {1..60}; do
  if docker exec "$postgres_id" pg_isready -q -h /var/run/postgresql -p 5432 -U klicker-prod -d klicker-prod; then
    break
  fi
  if [ "$attempt" -eq 60 ]; then
    echo 'Recovery PostgreSQL did not become ready.' >&2
    exit 1
  fi
  sleep 1
done
# Bootstrap verifies both restricted database identities before schema writes.
docker exec "$app_id" bash /workspaces/klicker-uzh/.devcontainer/recover-bootstrap.sh --initialize-new-disposable
