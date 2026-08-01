#!/usr/bin/env bash
set -euo pipefail

umask 077

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
graph_repo="${KG_CONTENT_GENERATION_REPO:-}"
token_file="${KG_CONTENT_GENERATION_HATCHET_ENV:-}"
output_file="${KLICKER_LOCAL_KB_SERVICES_ENV:-$repo_root/.devcontainer/.local-kb-services.env}"

if [[ -z "$graph_repo" ]]; then
  echo "KG_CONTENT_GENERATION_REPO must point to the kg-content-generation checkout." >&2
  exit 2
fi
if [[ -z "$token_file" ]]; then
  token_file="$graph_repo/lightrag_research/scripts/hatchet/.env.local"
fi
if [[ ! -f "$token_file" ]]; then
  echo "Local graph Hatchet env not found: $token_file" >&2
  echo "Start lightrag_research/scripts/hatchet/start_local_stack.sh first." >&2
  exit 2
fi

token="$(sed -nE 's/^export HATCHET_CLIENT_TOKEN="?([^" ]+)"?.*$/\1/p' "$token_file" | tail -n 1)"
if [[ -z "$token" ]]; then
  echo "No HATCHET_CLIENT_TOKEN found in $token_file" >&2
  exit 1
fi

mkdir -p "$(dirname "$output_file")"
tmp_file="$(mktemp "${output_file}.tmp.XXXXXX")"
trap 'rm -f "$tmp_file"' EXIT

cat >"$tmp_file" <<EOF
# Generated locally. Do not commit: contains a Hatchet client token.
KB_GRAPH_HATCHET_CLIENT_TOKEN=$token
KB_GRAPH_HATCHET_CLIENT_HOST_PORT=host.docker.internal:7077
KB_GRAPH_HATCHET_API_URL=http://host.docker.internal:8888
KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY=none
KB_GRAPH_HATCHET_WORKFLOW_NAME=course-kg-ingestion
KB_GRAPH_TIMEOUT_SECONDS=3600
KB_GRAPH_STANDARD_GENERATION_MODEL=openai/gpt-5.4
KB_GRAPH_STANDARD_CLEANING_MODEL=openai/gpt-5.4
KB_GRAPH_HIGH_GENERATION_MODEL=openai/gpt-5.4
KB_GRAPH_HIGH_CLEANING_MODEL=openai/gpt-5.4
KB_FALKORDB_HOST=host.docker.internal
KB_FALKORDB_PORT=6379
KB_FALKORDB_TLS=false
KB_FALKORDB_QUERY_TIMEOUT_MS=5000
EOF
mv "$tmp_file" "$output_file"
trap - EXIT

echo "Local KB graph-builder settings written to $output_file"
