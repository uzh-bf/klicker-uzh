#!/usr/bin/env bash
# Swaps one workspace's LiteLLM container for a mock-only LiteLLM that serves
# util/litellm/load-test.config.yaml, so chat load runs cost nothing.
# util/litellm/config.yaml is never modified.
#
# Usage (host shell):
#   LITELLM_CONTAINER=<project>-litellm-1 util/load-test/mock-litellm.sh start
#   LITELLM_CONTAINER=<project>-litellm-1 util/load-test/mock-litellm.sh stop
# Find the container name with: docker ps --filter label=com.docker.compose.service=litellm
# Run it after `devrouter ensure`: a later ensure restarts the real litellm
# container, which then shares the `litellm` alias with the mock.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORIGINAL="${LITELLM_CONTAINER:?Set LITELLM_CONTAINER to the workspace litellm container name}"
MOCK="${ORIGINAL}-mock"

# Refuse to touch any litellm service that is not this checkout's own. The
# runtime mounts util/litellm/config.yaml read-only and offers no override
# hook, so the swap below is the only way to serve the mock config.
service="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.service"}}' "$ORIGINAL")"
workdir="$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$ORIGINAL")"
if [ "$service" != litellm ] || [ "$workdir" != "$ROOT/.devcontainer" ]; then
  echo "refusing: $ORIGINAL is not the litellm service of $ROOT" >&2
  exit 1
fi

case "${1:-}" in
start)
  image="$(docker inspect --format '{{.Config.Image}}' "$ORIGINAL")"
  network="$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' "$ORIGINAL" | head -n1)"
  remove_mock() {
    if docker inspect "$MOCK" >/dev/null 2>&1; then
      docker rm -f "$MOCK" >/dev/null
    fi
  }
  remove_mock
  docker stop "$ORIGINAL" >/dev/null
  restore_original() {
    remove_mock
    docker start "$ORIGINAL" >/dev/null 2>&1 || true
  }
  trap restore_original ERR
  # Only the mock config is mounted; the container gets no upstream key.
  docker run -d --name "$MOCK" --network "$network" --network-alias litellm \
    -v "$ROOT/util/litellm/load-test.config.yaml:/app/config.yaml:ro" \
    "$image" --config=/app/config.yaml --port=4000 >/dev/null
  ready=0
  for _ in $(seq 1 60); do
    if docker exec "$MOCK" python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:4000/health/liveliness').status == 200 else 1)" >/dev/null 2>&1; then
      ready=1
      break
    fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$MOCK" 2>/dev/null)" != true ]; then
      break
    fi
    sleep 1
  done
  if [ "$ready" != 1 ]; then
    echo "mock LiteLLM failed to start; restoring $ORIGINAL" >&2
    restore_original
    exit 1
  fi
  trap - ERR
  echo "mock LiteLLM running as $MOCK ; original $ORIGINAL stopped"
  ;;
stop)
  if docker inspect "$MOCK" >/dev/null 2>&1; then
    docker rm -f "$MOCK" >/dev/null
  fi
  docker start "$ORIGINAL" >/dev/null
  echo "mock removed; original $ORIGINAL restarted"
  ;;
*)
  echo "usage: $0 start|stop" >&2
  exit 2
  ;;
esac
