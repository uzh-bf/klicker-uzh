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

case "${1:-}" in
start)
  image="$(docker inspect --format '{{.Config.Image}}' "$ORIGINAL")"
  network="$(docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' "$ORIGINAL" | head -n1)"
  docker stop "$ORIGINAL" >/dev/null
  # Only the mock config is mounted; the container gets no upstream key.
  docker run -d --name "$MOCK" --network "$network" --network-alias litellm \
    -v "$ROOT/util/litellm/load-test.config.yaml:/app/config.yaml:ro" \
    "$image" --config=/app/config.yaml --port=4000 >/dev/null
  echo "mock LiteLLM running as $MOCK ; original $ORIGINAL stopped"
  ;;
stop)
  docker rm -f "$MOCK" >/dev/null 2>&1 || true
  docker start "$ORIGINAL" >/dev/null
  echo "mock removed; original $ORIGINAL restarted"
  ;;
*)
  echo "usage: $0 start|stop" >&2
  exit 2
  ;;
esac
