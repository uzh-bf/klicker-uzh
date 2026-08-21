#!/usr/bin/env bash

# Replace the Klicker STG PostgreSQL database with a logical copy of PRD, then
# run the existing ArgoCD PreSync migration hook by submitting a sync operation
# directly to the self-hosted ArgoCD Application custom resource.
#
# Safety defaults:
# - DRY_RUN=true performs read-only validation only.
# - Execution requires two explicit acknowledgement variables.
# - The PRD dump is encrypted while streaming; no plaintext dump is written.
# - STG workloads stay stopped and ArgoCD auto-sync stays disabled on failure.

set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DRY_RUN="${DRY_RUN:-true}"
RUN_ID="${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
RESUME_FAILED_RUN_ID="${RESUME_FAILED_RUN_ID:-}"
REFRESH_ROOT_DIR="${REFRESH_ROOT_DIR:-$SCRIPT_DIR/dumps/prd-to-stg-refresh}"
KEEP_ENCRYPTED_ARCHIVE="${KEEP_ENCRYPTED_ARCHIVE:-false}"

PRD_INFISICAL_ENV="${PRD_INFISICAL_ENV:-prd}"
STG_INFISICAL_ENV="${STG_INFISICAL_ENV:-stg}"
INFISICAL_API_URL="${INFISICAL_API_URL:-https://inf.prd.df-app.ch/api}"
INFISICAL_PROJECT_ID="${INFISICAL_PROJECT_ID:-d071be96-5136-4f23-a6cb-e0c7f9b9a6c8}"
INFISICAL_SECRET_PATH="${INFISICAL_SECRET_PATH:-/}"

EXPECTED_PRD_DB_HOST="${EXPECTED_PRD_DB_HOST:-db-server-prd-apps.postgres.database.azure.com}"
EXPECTED_STG_DB_HOST="${EXPECTED_STG_DB_HOST:-db-server-stg-apps.postgres.database.azure.com}"
EXPECTED_PRD_DB_NAME="${EXPECTED_PRD_DB_NAME:-klicker}"
EXPECTED_STG_DB_NAME="${EXPECTED_STG_DB_NAME:-klicker}"
REQUIRED_DB_SSLMODE="${REQUIRED_DB_SSLMODE:-require}"
STG_FREE_STORAGE_GIB="${STG_FREE_STORAGE_GIB:-}"
MAX_SOURCE_STORAGE_PERCENT="${MAX_SOURCE_STORAGE_PERCENT:-75}"

KUBE_CONTEXT="${KUBE_CONTEXT:-aks-stg-apps}"
ARGOCD_KUBE_CONTEXT="${ARGOCD_KUBE_CONTEXT:-$KUBE_CONTEXT}"
ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}"
ARGOCD_APP="${ARGOCD_APP:-app-klicker}"
WORKLOAD_NAMESPACE="${WORKLOAD_NAMESPACE:-}"
EXPECTED_STG_CLUSTER_UID="${EXPECTED_STG_CLUSTER_UID:-}"
EXPECTED_ARGOCD_CLUSTER_UID="${EXPECTED_ARGOCD_CLUSTER_UID:-$EXPECTED_STG_CLUSTER_UID}"
KUBECTL_REQUEST_TIMEOUT="${KUBECTL_REQUEST_TIMEOUT:-30s}"
REFRESH_LEASE_NAME="${REFRESH_LEASE_NAME:-${ARGOCD_APP}-prd-to-stg-refresh}"
REFRESH_LEASE_NAMESPACE="${REFRESH_LEASE_NAMESPACE:-$ARGOCD_NAMESPACE}"
REFRESH_LEASE_DURATION_SECONDS="${REFRESH_LEASE_DURATION_SECONDS:-7200}"
MIGRATOR_SECRET_NAME="${MIGRATOR_SECRET_NAME:-${ARGOCD_APP}-secret-backend-graphql}"
MIGRATOR_SECRET_KEY="${MIGRATOR_SECRET_KEY:-DATABASE_URL}"
ARGOCD_TIMEOUT_SECONDS="${ARGOCD_TIMEOUT_SECONDS:-1200}"
ARGOCD_TERMINATION_TIMEOUT_SECONDS="${ARGOCD_TERMINATION_TIMEOUT_SECONDS:-120}"
ARGOCD_POLL_SECONDS="${ARGOCD_POLL_SECONDS:-2}"
WORKLOAD_SELECTOR="${WORKLOAD_SELECTOR:-app.kubernetes.io/instance=app-klicker}"
WORKLOAD_DRAIN_TIMEOUT_SECONDS="${WORKLOAD_DRAIN_TIMEOUT_SECONDS:-300}"

CONFIRM_PRD_TO_STG_REFRESH="${CONFIRM_PRD_TO_STG_REFRESH:-}"
ALLOW_RAW_PRD_DATA_IN_STG="${ALLOW_RAW_PRD_DATA_IN_STG:-false}"
RAW_PRD_DATA_APPROVAL_REF="${RAW_PRD_DATA_APPROVAL_REF:-}"
STG_OUTBOUND_INTEGRATIONS_ISOLATED="${STG_OUTBOUND_INTEGRATIONS_ISOLATED:-false}"

PRD_DATABASE_URL="${PRD_DATABASE_URL:-}"
STG_DATABASE_URL="${STG_DATABASE_URL:-}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"

RUN_DIR=""
ARCHIVE_PATH=""
ARCHIVE_CHECKSUM_PATH=""
ARCHIVE_CATALOG_PATH=""
BEFORE_RECEIPT=""
AFTER_RECEIPT=""
DEPLOYMENT_RECEIPT=""

ARGOCD_POLICY_PAUSED=false
WORKLOADS_SCALED=false
TARGET_MUTATED=false
RESTORE_VERIFIED=false
RESUMING_MAINTENANCE=false
REFRESH_LEASE_HELD=false

ORIGINAL_AUTOMATED_SYNC=false
ORIGINAL_AUTOMATED_JSON="null"

PRD_DB_HOST=""
PRD_DB_NAME=""
STG_DB_HOST=""
STG_DB_NAME=""

PRD_VERSION_NUM=""
PRD_SIZE_BYTES=""
PRD_TABLE_COUNT=""
PRD_APPLIED_MIGRATIONS=""
PRD_FAILED_MIGRATIONS=""
PRD_EXTRA_SCHEMA_COUNT=""
PRD_LARGE_OBJECT_COUNT=""

STG_BEFORE_VERSION_NUM=""
STG_BEFORE_SIZE_BYTES=""
STG_BEFORE_TABLE_COUNT=""
STG_BEFORE_APPLIED_MIGRATIONS=""
STG_BEFORE_FAILED_MIGRATIONS=""
STG_EXTRA_SCHEMA_COUNT=""
STG_LARGE_OBJECT_COUNT=""

STG_CONNECTED_ROLE=""
STG_PUBLIC_SCHEMA_OWNER=""
STG_CAN_CREATE_IN_PUBLIC=""
STG_SUPPORTED_OBJECT_COUNT=""
STG_UNOWNED_OBJECT_COUNT=""
STG_UNSUPPORTED_OBJECT_COUNT=""
WORKLOAD_SET_HASH=""
PRD_MIGRATION_HISTORY=""
MIGRATOR_DATABASE_URL=""
MIGRATED_SIZE_BYTES=""
MIGRATED_TABLE_COUNT=""
MIGRATED_APPLIED_MIGRATIONS=""

print_help() {
  cat <<'EOF'
Usage: util/backup/refresh-stg-from-prd.sh

Copies the Klicker PRD PostgreSQL database to STG, then runs the existing
ArgoCD PreSync migration hook by patching the self-hosted app-klicker
Application resource through the Kubernetes API. The argocd CLI is not
required.

The script is read-only by default:

  ./util/backup/refresh-stg-from-prd.sh

Execution requires all three explicit gates:

  DRY_RUN=false \
  CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
  ALLOW_RAW_PRD_DATA_IN_STG=true \
  ./util/backup/refresh-stg-from-prd.sh

Credentials are loaded from Infisical by default:

  prd: DIRECT_DATABASE_URL + BACKUP_ENCRYPTION_KEY
  stg: DIRECT_DATABASE_URL

For CI or controlled testing, provide PRD_DATABASE_URL, STG_DATABASE_URL, and
BACKUP_ENCRYPTION_KEY as environment variables instead. Never pass connection
URLs as command-line arguments.

Important configuration variables:

  KUBE_CONTEXT                       STG workload context; default: aks-stg-apps
  ARGOCD_KUBE_CONTEXT                ArgoCD control-plane context; defaults to KUBE_CONTEXT
  ARGOCD_NAMESPACE                   Application namespace; default: argocd
  ARGOCD_APP                         default: app-klicker
  WORKLOAD_NAMESPACE                 exact STG workload namespace; otherwise derived from the Application
  EXPECTED_STG_CLUSTER_UID           expected stable UID for the STG workload cluster
  EXPECTED_ARGOCD_CLUSTER_UID        expected stable UID for the ArgoCD cluster; defaults to STG UID
  KUBECTL_REQUEST_TIMEOUT             per-request Kubernetes API timeout; default: 30s
  REFRESH_LEASE_NAME                 exclusive maintenance Lease name
  REFRESH_LEASE_NAMESPACE            namespace for the maintenance Lease; default: argocd
  MIGRATOR_SECRET_NAME               Secret containing the PreSync DATABASE_URL
  MIGRATOR_SECRET_KEY                Secret key containing the PreSync DATABASE_URL
  ARGOCD_TERMINATION_TIMEOUT_SECONDS timeout for draining a timed-out operation
  INFISICAL_API_URL                  default: https://inf.prd.df-app.ch/api
  INFISICAL_PROJECT_ID               default: d071be96-5136-4f23-a6cb-e0c7f9b9a6c8
  INFISICAL_SECRET_PATH              default: /
  WORKLOAD_SELECTOR                   default: app.kubernetes.io/instance=app-klicker
  EXPECTED_PRD_DB_HOST                fail-closed PRD hostname
  EXPECTED_STG_DB_HOST                fail-closed STG hostname
  EXPECTED_PRD_DB_NAME                fail-closed PRD database name
  EXPECTED_STG_DB_NAME                fail-closed STG database name
  REQUIRED_DB_SSLMODE                 minimum PostgreSQL SSL mode; default: require
  STG_FREE_STORAGE_GIB                current free STG storage evidence; required for execution
  MAX_SOURCE_STORAGE_PERCENT          default: 75
  RUN_ID                              unique receipt identifier
  RESUME_FAILED_RUN_ID                failed run receipt to resume while STG is stopped
  KEEP_ENCRYPTED_ARCHIVE              default: false
  RAW_PRD_DATA_APPROVAL_REF           ticket/ADR reference approving raw PRD data in STG
  STG_OUTBOUND_INTEGRATIONS_ISOLATED  must be true for execution

Failure after workload shutdown intentionally leaves ArgoCD auto-sync disabled
and STG workloads stopped. If reset completed but restore did not, do not submit
an ArgoCD sync. Re-run with RESUME_FAILED_RUN_ID=<failed-run-id>, a fresh RUN_ID,
and the three execution gates after inspecting the retained receipt.
EOF
}

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

validate_boolean() {
  local name="$1"
  local value="$2"

  case "$value" in
    true|false) ;;
    *) die "$name must be exactly 'true' or 'false' (received '$value')" ;;
  esac
}

validate_positive_integer() {
  local name="$1"
  local value="$2"

  [[ "$value" =~ ^[0-9]+$ ]] || die "$name must be a non-negative integer"
}

validate_run_id() {
  [[ "$RUN_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] \
    || die "RUN_ID must be 1-128 characters and contain only letters, numbers, dots, underscores, or hyphens"
}

validate_resume_failed_run_id() {
  [[ -z "$RESUME_FAILED_RUN_ID" ]] && return 0
  [[ "$RESUME_FAILED_RUN_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] \
    || die "RESUME_FAILED_RUN_ID must be 1-128 characters and contain only letters, numbers, dots, underscores, or hyphens"
  [[ "$RESUME_FAILED_RUN_ID" != "$RUN_ID" ]] \
    || die "RESUME_FAILED_RUN_ID must differ from the new RUN_ID"
}

kubectl_safe() {
  kubectl --request-timeout="$KUBECTL_REQUEST_TIMEOUT" "$@"
}

get_argocd_application() {
  kubectl_safe --context "$ARGOCD_KUBE_CONTEXT" -n "$ARGOCD_NAMESPACE" \
    get application.argoproj.io "$ARGOCD_APP" -o json
}

patch_argocd_application() {
  local patch_payload="$1"
  kubectl_safe --context "$ARGOCD_KUBE_CONTEXT" -n "$ARGOCD_NAMESPACE" \
    patch application.argoproj.io "$ARGOCD_APP" --type merge \
    --patch "$patch_payload"
}

build_argocd_sync_patch() {
  local initiator="$1"
  jq -cn --arg initiator "$initiator" \
    '{
      operation: {
        initiatedBy: {username: $initiator},
        sync: {syncStrategy: {hook: {}}}
      }
    }'
}

build_argocd_policy_patch() {
  jq -cn --argjson automated "$1" \
    '{spec: {syncPolicy: {automated: $automated}}}'
}

refresh_lease_holder() {
  printf 'prd-to-stg-refresh-%s' "$RUN_ID"
}

acquire_refresh_lease() {
  local holder_identity lease_manifest
  holder_identity="$(refresh_lease_holder)"
  lease_manifest="$(jq -cn \
    --arg name "$REFRESH_LEASE_NAME" \
    --arg holderIdentity "$holder_identity" \
    --argjson duration "$REFRESH_LEASE_DURATION_SECONDS" \
    '{
      apiVersion: "coordination.k8s.io/v1",
      kind: "Lease",
      metadata: {name: $name},
      spec: {
        holderIdentity: $holderIdentity,
        leaseDurationSeconds: $duration
      }
    }')"

  kubectl_safe --context "$ARGOCD_KUBE_CONTEXT" -n "$REFRESH_LEASE_NAMESPACE" \
    create -f - <<<"$lease_manifest" >/dev/null \
    || die "Refresh Lease '$REFRESH_LEASE_NAMESPACE/$REFRESH_LEASE_NAME' is already held or cannot be created"
  REFRESH_LEASE_HELD=true
  log "Acquired refresh Lease '$REFRESH_LEASE_NAMESPACE/$REFRESH_LEASE_NAME'"
}

renew_refresh_lease() {
  [[ "$REFRESH_LEASE_HELD" == "true" ]] || return 0
  local holder_identity renew_time current_holder
  holder_identity="$(refresh_lease_holder)"
  renew_time="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  current_holder="$(kubectl_safe --context "$ARGOCD_KUBE_CONTEXT" -n "$REFRESH_LEASE_NAMESPACE" \
    get lease "$REFRESH_LEASE_NAME" -o jsonpath='{.spec.holderIdentity}')" \
    || die "Could not read refresh Lease ownership"
  [[ "$current_holder" == "$holder_identity" ]] \
    || die "Refresh Lease ownership changed during run"
  kubectl_safe --context "$ARGOCD_KUBE_CONTEXT" -n "$REFRESH_LEASE_NAMESPACE" \
    patch lease "$REFRESH_LEASE_NAME" --type merge \
    --patch "$(jq -cn --arg renewTime "$renew_time" '{spec: {renewTime: $renewTime}}')" \
    >/dev/null \
    || die "Could not renew refresh Lease"
}

release_refresh_lease() {
  [[ "$REFRESH_LEASE_HELD" == "true" ]] || return 0
  local holder_identity current_holder
  holder_identity="$(refresh_lease_holder)"
  current_holder="$(kubectl_safe --context "$ARGOCD_KUBE_CONTEXT" -n "$REFRESH_LEASE_NAMESPACE" \
    get lease "$REFRESH_LEASE_NAME" -o jsonpath='{.spec.holderIdentity}' 2>/dev/null)" || true
  if [[ "$current_holder" == "$holder_identity" ]]; then
    kubectl_safe --context "$ARGOCD_KUBE_CONTEXT" -n "$REFRESH_LEASE_NAMESPACE" \
      delete lease "$REFRESH_LEASE_NAME" --wait=false >/dev/null || return 1
    log "Released refresh Lease '$REFRESH_LEASE_NAMESPACE/$REFRESH_LEASE_NAME'"
  fi
  REFRESH_LEASE_HELD=false
}

cleanup() {
  local exit_code=$?

  unset PRD_DATABASE_URL STG_DATABASE_URL BACKUP_ENCRYPTION_KEY MIGRATOR_DATABASE_URL

  if [[ "$KEEP_ENCRYPTED_ARCHIVE" != "true" ]]; then
    if [[ -n "$ARCHIVE_PATH" && -f "$ARCHIVE_PATH" ]]; then
      rm -f -- "$ARCHIVE_PATH"
    fi
    if [[ -n "$ARCHIVE_CHECKSUM_PATH" && -f "$ARCHIVE_CHECKSUM_PATH" ]]; then
      rm -f -- "$ARCHIVE_CHECKSUM_PATH"
    fi
    if [[ -n "$ARCHIVE_CATALOG_PATH" && -f "$ARCHIVE_CATALOG_PATH" ]]; then
      rm -f -- "$ARCHIVE_CATALOG_PATH"
    fi
  fi

  if [[ $exit_code -ne 0 && "$ARGOCD_POLICY_PAUSED" == "true" ]]; then
    if [[ "$WORKLOADS_SCALED" != "true" ]]; then
      best_effort_scale_stg_workloads_down || log "WARNING: fail-safe workload scale-down could not be confirmed"
    fi
    log "ArgoCD application: $ARGOCD_APP (automated sync disabled)"
    if [[ "$WORKLOADS_SCALED" == "true" ]]; then
      log "STG remains in fail-safe maintenance mode."
      log "Deployments matching '$WORKLOAD_SELECTOR' remain scaled to zero."
    else
      log "Deployment state is not guaranteed to be zero; verify it before database recovery."
    fi
    if [[ "$TARGET_MUTATED" == "true" ]]; then
      log "The STG database was modified; inspect restore and migration state before recovery."
    fi
    if [[ "$RESTORE_VERIFIED" != "true" ]]; then
      local resumable_run_id=""
      if [[ -n "$BEFORE_RECEIPT" && -s "$BEFORE_RECEIPT" ]]; then
        resumable_run_id="$RUN_ID"
      elif [[ -n "$RESUME_FAILED_RUN_ID" ]]; then
        resumable_run_id="$RESUME_FAILED_RUN_ID"
      fi
      log "Do not submit an ArgoCD sync: a complete restored database has not been verified."
      if [[ -n "$resumable_run_id" ]]; then
        log "Retry the refresh with RESUME_FAILED_RUN_ID=$resumable_run_id, a fresh RUN_ID, and the three execution gates."
      else
        log "No resumable before receipt exists; inspect STG and restore it before re-enabling workloads."
      fi
    else
      local recovery_sync_patch recovery_policy_patch
      recovery_sync_patch="$(build_argocd_sync_patch "prd-to-stg-recovery-$RUN_ID")"
      recovery_policy_patch="$(build_argocd_policy_patch "$ORIGINAL_AUTOMATED_JSON")"
      log "After confirming the restored snapshot is intact, retry the hook sync: kubectl --context $ARGOCD_KUBE_CONTEXT -n $ARGOCD_NAMESPACE patch application.argoproj.io $ARGOCD_APP --type merge --patch '$recovery_sync_patch'"
      log "Then restore the prior policy: kubectl --context $ARGOCD_KUBE_CONTEXT -n $ARGOCD_NAMESPACE patch application.argoproj.io $ARGOCD_APP --type merge --patch '$recovery_policy_patch'"
    fi
  fi

  if [[ "$REFRESH_LEASE_HELD" == "true" ]]; then
    release_refresh_lease || log "WARNING: could not release refresh Lease '$REFRESH_LEASE_NAMESPACE/$REFRESH_LEASE_NAME'; remove it only after confirming this run is no longer active"
  fi

  return "$exit_code"
}

trap cleanup EXIT

parse_database_url_field() {
  local database_url="$1"
  local field="$2"

  KLICKER_DATABASE_URL_INPUT="$database_url" KLICKER_DATABASE_URL_FIELD="$field" \
    node - <<'NODE'
const input = process.env.KLICKER_DATABASE_URL_INPUT
const field = process.env.KLICKER_DATABASE_URL_FIELD

let parsed
try {
  parsed = new URL(input)
} catch {
  process.stderr.write('Invalid PostgreSQL connection URL\n')
  process.exit(1)
}

if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  process.stderr.write('Connection URL must use postgres:// or postgresql://\n')
  process.exit(1)
}

if (field === 'host') {
  process.stdout.write(parsed.hostname)
} else if (field === 'port') {
  process.stdout.write(parsed.port || '5432')
} else if (field === 'username') {
  process.stdout.write(decodeURIComponent(parsed.username))
} else if (field === 'password') {
  process.stdout.write(decodeURIComponent(parsed.password))
} else if (field === 'database') {
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  if (!database) {
    process.stderr.write('Connection URL does not contain a database name\n')
    process.exit(1)
  }
  process.stdout.write(database)
} else if (field === 'libpq') {
  parsed.searchParams.delete('schema')
  parsed.searchParams.delete('pgbouncer')
  process.stdout.write(parsed.toString())
} else if (field === 'sslmode') {
  process.stdout.write(parsed.searchParams.get('sslmode') || '')
} else if (field === 'sslnegotiation') {
  process.stdout.write(parsed.searchParams.get('sslnegotiation') || '')
} else if (field === 'channel_binding') {
  process.stdout.write(parsed.searchParams.get('channel_binding') || '')
} else if (field === 'target_session_attrs') {
  process.stdout.write(parsed.searchParams.get('target_session_attrs') || '')
} else {
  process.stderr.write(`Unknown URL field: ${field}\n`)
  process.exit(1)
}
NODE
}

run_database_command() (
  local database_url="$1"
  shift

  local host port username password database sslmode sslnegotiation
  local channel_binding target_session_attrs
  host="$(parse_database_url_field "$database_url" host)"
  port="$(parse_database_url_field "$database_url" port)"
  username="$(parse_database_url_field "$database_url" username)"
  password="$(parse_database_url_field "$database_url" password)"
  database="$(parse_database_url_field "$database_url" database)"
  sslmode="$(parse_database_url_field "$database_url" sslmode)"
  sslnegotiation="$(parse_database_url_field "$database_url" sslnegotiation)"
  channel_binding="$(parse_database_url_field "$database_url" channel_binding)"
  target_session_attrs="$(parse_database_url_field "$database_url" target_session_attrs)"

  export PGCONNECT_TIMEOUT=15
  export PGHOST="$host"
  export PGPORT="$port"
  export PGUSER="$username"
  export PGPASSWORD="$password"
  export PGDATABASE="$database"
  unset PGSSLMODE PGSSLNEGOTIATION PGCHANNELBINDING PGTARGETSESSIONATTRS
  [[ -z "$sslmode" ]] || export PGSSLMODE="$sslmode"
  [[ -z "$sslnegotiation" ]] || export PGSSLNEGOTIATION="$sslnegotiation"
  [[ -z "$channel_binding" ]] || export PGCHANNELBINDING="$channel_binding"
  [[ -z "$target_session_attrs" ]] \
    || export PGTARGETSESSIONATTRS="$target_session_attrs"

  "$@"
)

load_infisical_secret() {
  local output_variable="$1"
  local secret_name="$2"
  local environment="$3"
  local project_id="$4"
  local secret_value

  if ! secret_value="$(
    infisical secrets get "$secret_name" \
      --domain="$INFISICAL_API_URL" \
      --env="$environment" \
      --path="$INFISICAL_SECRET_PATH" \
      --projectId="$project_id" \
      --plain \
      --silent
  )"; then
    die "Could not load '$secret_name' from Infisical environment '$environment' at '$INFISICAL_API_URL'"
  fi
  [[ -n "$secret_value" ]] \
    || die "Infisical returned an empty value for '$secret_name' in environment '$environment' at path '$INFISICAL_SECRET_PATH'"

  printf -v "$output_variable" '%s' "$secret_value"
}

load_credentials() {
  local needs_infisical=false
  if [[ -z "$PRD_DATABASE_URL" || -z "$STG_DATABASE_URL" ]]; then
    needs_infisical=true
  fi
  if [[ "$DRY_RUN" == "false" && -z "$BACKUP_ENCRYPTION_KEY" ]]; then
    needs_infisical=true
  fi
  if [[ "$needs_infisical" == "false" ]]; then
    return
  fi

  require_command infisical

  if [[ -z "$PRD_DATABASE_URL" ]]; then
    log "Loading the PRD direct database URL from Infisical environment '$PRD_INFISICAL_ENV'"
    load_infisical_secret PRD_DATABASE_URL DIRECT_DATABASE_URL "$PRD_INFISICAL_ENV" "$INFISICAL_PROJECT_ID"
  fi
  if [[ -z "$STG_DATABASE_URL" ]]; then
    log "Loading the STG direct database URL from Infisical environment '$STG_INFISICAL_ENV'"
    load_infisical_secret STG_DATABASE_URL DIRECT_DATABASE_URL "$STG_INFISICAL_ENV" "$INFISICAL_PROJECT_ID"
  fi
  if [[ "$DRY_RUN" == "false" && -z "$BACKUP_ENCRYPTION_KEY" ]]; then
    log "Loading the backup encryption key from Infisical environment '$PRD_INFISICAL_ENV'"
    load_infisical_secret BACKUP_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY "$PRD_INFISICAL_ENV" "$INFISICAL_PROJECT_ID"
  fi

  [[ -n "$PRD_DATABASE_URL" ]] || die "PRD database URL is empty"
  [[ -n "$STG_DATABASE_URL" ]] || die "STG database URL is empty"
  if [[ "$DRY_RUN" == "false" ]]; then
    [[ -n "$BACKUP_ENCRYPTION_KEY" ]] || die "Backup encryption key is empty"
  fi
}

validate_endpoints() {
  PRD_DATABASE_URL="$(parse_database_url_field "$PRD_DATABASE_URL" libpq)" \
    || die "Could not normalize the PRD database URL"
  STG_DATABASE_URL="$(parse_database_url_field "$STG_DATABASE_URL" libpq)" \
    || die "Could not normalize the STG database URL"

  PRD_DB_HOST="$(parse_database_url_field "$PRD_DATABASE_URL" host)"
  PRD_DB_NAME="$(parse_database_url_field "$PRD_DATABASE_URL" database)"
  STG_DB_HOST="$(parse_database_url_field "$STG_DATABASE_URL" host)"
  STG_DB_NAME="$(parse_database_url_field "$STG_DATABASE_URL" database)"

  [[ "$PRD_DB_HOST" == "$EXPECTED_PRD_DB_HOST" ]] \
    || die "PRD host '$PRD_DB_HOST' does not equal expected host '$EXPECTED_PRD_DB_HOST'"
  [[ "$STG_DB_HOST" == "$EXPECTED_STG_DB_HOST" ]] \
    || die "STG host '$STG_DB_HOST' does not equal expected host '$EXPECTED_STG_DB_HOST'"
  [[ "$PRD_DB_NAME" == "$EXPECTED_PRD_DB_NAME" ]] \
    || die "PRD database '$PRD_DB_NAME' does not equal expected database '$EXPECTED_PRD_DB_NAME'"
  [[ "$STG_DB_NAME" == "$EXPECTED_STG_DB_NAME" ]] \
    || die "STG database '$STG_DB_NAME' does not equal expected database '$EXPECTED_STG_DB_NAME'"
  [[ "$PRD_DB_HOST" != "$STG_DB_HOST" ]] || die "PRD and STG resolve to the same configured host"

  local prd_sslmode stg_sslmode
  prd_sslmode="$(parse_database_url_field "$PRD_DATABASE_URL" sslmode)"
  stg_sslmode="$(parse_database_url_field "$STG_DATABASE_URL" sslmode)"
  case "$REQUIRED_DB_SSLMODE" in
    require)
      case "$prd_sslmode:$stg_sslmode" in
        require:require|require:verify-ca|require:verify-full|verify-ca:require|verify-ca:verify-ca|verify-ca:verify-full|verify-full:require|verify-full:verify-ca|verify-full:verify-full) ;;
        *) die "PRD and STG URLs must use at least sslmode=require" ;;
      esac
      ;;
    verify-ca)
      [[ "$prd_sslmode" == "verify-ca" || "$prd_sslmode" == "verify-full" ]] \
        || die "PRD URL must use at least sslmode=verify-ca"
      [[ "$stg_sslmode" == "verify-ca" || "$stg_sslmode" == "verify-full" ]] \
        || die "STG URL must use at least sslmode=verify-ca"
      ;;
    verify-full)
      [[ "$prd_sslmode" == "verify-full" ]] || die "PRD URL must use sslmode=verify-full"
      [[ "$stg_sslmode" == "verify-full" ]] || die "STG URL must use sslmode=verify-full"
      ;;
    *) die "REQUIRED_DB_SSLMODE must be require, verify-ca, or verify-full" ;;
  esac
}

read_database_metadata() {
  local database_url="$1"
  local core_query core_metadata migration_metadata
  core_query=$(cat <<'SQL'
/* klicker_database_metadata_core */
SELECT
  current_database(),
  current_setting('server_version_num')::bigint,
  pg_database_size(current_database()),
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
  CASE WHEN to_regclass('public."_prisma_migrations"') IS NULL THEN 0 ELSE 1 END,
  (SELECT count(*) FROM pg_namespace WHERE nspname <> 'public' AND nspname <> 'information_schema' AND nspname !~ '^pg_'),
  (SELECT count(*) FROM pg_largeobject_metadata);
SQL
)

  core_metadata="$(
    run_database_command "$database_url" \
      psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$core_query"
  )" || return 1

  local database_name version_num size_bytes table_count
  local migration_table_present extra_schema_count large_object_count
  IFS='|' read -r database_name version_num size_bytes table_count \
    migration_table_present extra_schema_count large_object_count \
    <<<"$core_metadata"
  [[ "$migration_table_present" == "0" || "$migration_table_present" == "1" ]] \
    || return 1

  if [[ "$migration_table_present" == "1" ]]; then
    local migration_query
    migration_query=$(cat <<'SQL'
/* klicker_database_metadata_migrations */
SELECT
  count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)
FROM public."_prisma_migrations";
SQL
)
    migration_metadata="$(
      run_database_command "$database_url" \
        psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$migration_query"
    )" || return 1
  else
    migration_metadata='0|0'
  fi

  local applied_migrations failed_migrations
  IFS='|' read -r applied_migrations failed_migrations <<<"$migration_metadata"
  printf '%s|%s|%s|%s|%s|%s|%s|%s\n' \
    "$database_name" "$version_num" "$size_bytes" "$table_count" \
    "$applied_migrations" "$failed_migrations" "$extra_schema_count" \
    "$large_object_count"
}

load_database_metadata() {
  local output_variable="$1"
  local database_url="$2"
  local environment="$3"
  local metadata

  if ! metadata="$(read_database_metadata "$database_url")"; then
    die "Could not read $environment database metadata"
  fi
  [[ -n "$metadata" ]] || die "$environment database metadata is empty"
  printf -v "$output_variable" '%s' "$metadata"
}

read_database_identity() {
  local database_url="$1"
  local identity_query
  identity_query=$(cat <<'SQL'
/* klicker_database_identity */
SELECT current_database(), COALESCE(inet_server_addr()::text, ''), inet_server_port();
SQL
)

  run_database_command "$database_url" \
    psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$identity_query"
}

load_database_identity() {
  local output_variable="$1"
  local database_url="$2"
  local environment="$3"
  local identity

  if ! identity="$(read_database_identity "$database_url")"; then
    die "Could not read $environment database identity"
  fi
  [[ -n "$identity" ]] || die "$environment database identity is empty"
  printf -v "$output_variable" '%s' "$identity"
}

read_migration_history() {
  local database_url="$1"
  local migration_history_query
  migration_history_query=$(cat <<'SQL'
/* klicker_database_migration_history */
SELECT CASE
  WHEN to_regclass('public."_prisma_migrations"') IS NULL THEN ''
  ELSE COALESCE(
    (
      SELECT string_agg(
        migration_name || '|' || COALESCE(checksum, ''), E'\n'
        ORDER BY finished_at, migration_name
      )
      FROM public."_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ),
    ''
  )
END;
SQL
)

  run_database_command "$database_url" \
    psql -X -v ON_ERROR_STOP=1 -At -c "$migration_history_query"
}

load_migration_history() {
  local output_variable="$1"
  local database_url="$2"
  local environment="$3"
  local migration_history

  if ! migration_history="$(read_migration_history "$database_url")"; then
    die "Could not read $environment migration history"
  fi
  printf -v "$output_variable" '%s' "$migration_history"
}

parse_prd_metadata() {
  local metadata="$1"
  local database_name
  IFS='|' read -r database_name PRD_VERSION_NUM PRD_SIZE_BYTES PRD_TABLE_COUNT \
    PRD_APPLIED_MIGRATIONS PRD_FAILED_MIGRATIONS PRD_EXTRA_SCHEMA_COUNT \
    PRD_LARGE_OBJECT_COUNT <<<"$metadata"

  [[ "$database_name" == "$PRD_DB_NAME" ]] \
    || die "PRD metadata returned unexpected database '$database_name'"
  validate_positive_integer PRD_VERSION_NUM "$PRD_VERSION_NUM"
  validate_positive_integer PRD_SIZE_BYTES "$PRD_SIZE_BYTES"
  validate_positive_integer PRD_TABLE_COUNT "$PRD_TABLE_COUNT"
  validate_positive_integer PRD_APPLIED_MIGRATIONS "$PRD_APPLIED_MIGRATIONS"
  validate_positive_integer PRD_FAILED_MIGRATIONS "$PRD_FAILED_MIGRATIONS"
  validate_positive_integer PRD_EXTRA_SCHEMA_COUNT "$PRD_EXTRA_SCHEMA_COUNT"
  validate_positive_integer PRD_LARGE_OBJECT_COUNT "$PRD_LARGE_OBJECT_COUNT"
  [[ "$PRD_FAILED_MIGRATIONS" == "0" ]] \
    || die "PRD has $PRD_FAILED_MIGRATIONS unresolved Prisma migration(s); refusing to copy"
  [[ "$PRD_EXTRA_SCHEMA_COUNT" == "0" ]] \
    || die "PRD has $PRD_EXTRA_SCHEMA_COUNT non-public application schema(s); this refresh supports only the public schema"
  [[ "$PRD_LARGE_OBJECT_COUNT" == "0" ]] \
    || die "PRD has $PRD_LARGE_OBJECT_COUNT PostgreSQL large object(s); this refresh does not support large objects"
}

parse_stg_before_metadata() {
  local metadata="$1"
  local database_name
  IFS='|' read -r database_name STG_BEFORE_VERSION_NUM STG_BEFORE_SIZE_BYTES \
    STG_BEFORE_TABLE_COUNT STG_BEFORE_APPLIED_MIGRATIONS \
    STG_BEFORE_FAILED_MIGRATIONS STG_EXTRA_SCHEMA_COUNT \
    STG_LARGE_OBJECT_COUNT <<<"$metadata"

  [[ "$database_name" == "$STG_DB_NAME" ]] \
    || die "STG metadata returned unexpected database '$database_name'"
  validate_positive_integer STG_BEFORE_VERSION_NUM "$STG_BEFORE_VERSION_NUM"
  validate_positive_integer STG_BEFORE_SIZE_BYTES "$STG_BEFORE_SIZE_BYTES"
  validate_positive_integer STG_BEFORE_TABLE_COUNT "$STG_BEFORE_TABLE_COUNT"
  validate_positive_integer STG_BEFORE_APPLIED_MIGRATIONS "$STG_BEFORE_APPLIED_MIGRATIONS"
  validate_positive_integer STG_BEFORE_FAILED_MIGRATIONS "$STG_BEFORE_FAILED_MIGRATIONS"
  validate_positive_integer STG_EXTRA_SCHEMA_COUNT "$STG_EXTRA_SCHEMA_COUNT"
  validate_positive_integer STG_LARGE_OBJECT_COUNT "$STG_LARGE_OBJECT_COUNT"
  [[ "$STG_EXTRA_SCHEMA_COUNT" == "0" ]] \
    || die "STG has $STG_EXTRA_SCHEMA_COUNT non-public application schema(s); refusing an incomplete replacement"
  [[ "$STG_LARGE_OBJECT_COUNT" == "0" ]] \
    || die "STG has $STG_LARGE_OBJECT_COUNT PostgreSQL large object(s); refusing an incomplete replacement"
}

read_stg_reset_capabilities() {
  local query
  query=$(cat <<'SQL'
/* klicker_stg_reset_capabilities */
WITH public_namespace AS (
  SELECT oid, nspowner
  FROM pg_namespace
  WHERE nspname = 'public'
), supported_objects AS (
  SELECT c.relowner AS owner_oid
  FROM pg_class c
  WHERE c.relnamespace = (SELECT oid FROM public_namespace)
    AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  UNION ALL
  SELECT p.proowner
  FROM pg_proc p
  WHERE p.pronamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT t.typowner
  FROM pg_type t
  WHERE t.typnamespace = (SELECT oid FROM public_namespace)
    AND t.typrelid = 0
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_type'::regclass
        AND d.objid = t.oid
        AND d.deptype IN ('i', 'e')
    )
), unsupported_objects AS (
  SELECT coll.oid
  FROM pg_collation coll
  WHERE coll.collnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT conv.oid
  FROM pg_conversion conv
  WHERE conv.connamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT op.oid
  FROM pg_operator op
  WHERE op.oprnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT opc.oid
  FROM pg_opclass opc
  WHERE opc.opcnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT opf.oid
  FROM pg_opfamily opf
  WHERE opf.opfnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT cfg.oid
  FROM pg_ts_config cfg
  WHERE cfg.cfgnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT dict.oid
  FROM pg_ts_dict dict
  WHERE dict.dictnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT ext.oid
  FROM pg_extension ext
  WHERE ext.extnamespace = (SELECT oid FROM public_namespace)
)
SELECT
  current_database(),
  current_user,
  pg_get_userbyid((SELECT nspowner FROM public_namespace)),
  has_schema_privilege(current_user, 'public', 'CREATE'),
  (SELECT count(*) FROM supported_objects),
  (SELECT count(*) FROM supported_objects WHERE NOT pg_has_role(current_user, owner_oid, 'USAGE')),
  (SELECT count(*) FROM unsupported_objects),
  (SELECT count(*) FROM pg_namespace WHERE nspname <> 'public' AND nspname <> 'information_schema' AND nspname !~ '^pg_'),
  (SELECT count(*) FROM pg_largeobject_metadata);
SQL
)

  run_database_command "$STG_DATABASE_URL" \
    psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$query"
}

validate_stg_reset_capabilities() {
  local metadata database_name extra_schema_count large_object_count
  if ! metadata="$(read_stg_reset_capabilities)"; then
    die "Could not validate STG object ownership for replacement"
  fi

  IFS='|' read -r database_name STG_CONNECTED_ROLE STG_PUBLIC_SCHEMA_OWNER \
    STG_CAN_CREATE_IN_PUBLIC STG_SUPPORTED_OBJECT_COUNT \
    STG_UNOWNED_OBJECT_COUNT STG_UNSUPPORTED_OBJECT_COUNT extra_schema_count \
    large_object_count <<<"$metadata"

  [[ "$database_name" == "$STG_DB_NAME" ]] \
    || die "STG ownership metadata came from unexpected database '$database_name'"
  [[ -n "$STG_CONNECTED_ROLE" && -n "$STG_PUBLIC_SCHEMA_OWNER" ]] \
    || die "STG ownership metadata is incomplete"
  [[ "$STG_CAN_CREATE_IN_PUBLIC" == "t" ]] \
    || die "STG role '$STG_CONNECTED_ROLE' cannot create objects in the public schema"
  validate_positive_integer STG_SUPPORTED_OBJECT_COUNT "$STG_SUPPORTED_OBJECT_COUNT"
  validate_positive_integer STG_UNOWNED_OBJECT_COUNT "$STG_UNOWNED_OBJECT_COUNT"
  validate_positive_integer STG_UNSUPPORTED_OBJECT_COUNT "$STG_UNSUPPORTED_OBJECT_COUNT"
  validate_positive_integer stg_reset_extra_schema_count "$extra_schema_count"
  validate_positive_integer stg_reset_large_object_count "$large_object_count"
  [[ "$STG_UNOWNED_OBJECT_COUNT" == "0" ]] \
    || die "STG contains $STG_UNOWNED_OBJECT_COUNT public object(s) that '$STG_CONNECTED_ROLE' cannot drop"
  [[ "$STG_UNSUPPORTED_OBJECT_COUNT" == "0" ]] \
    || die "STG contains $STG_UNSUPPORTED_OBJECT_COUNT unsupported public object(s); refusing an incomplete replacement"
  [[ "$extra_schema_count" == "0" && "$large_object_count" == "0" ]] \
    || die "STG replacement capability changed after metadata validation"
}

validate_client_and_capacity() {
  local pg_dump_major pg_restore_major
  pg_dump_major="$(pg_dump --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/')"
  pg_restore_major="$(pg_restore --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/')"
  validate_positive_integer pg_dump_major "$pg_dump_major"
  validate_positive_integer pg_restore_major "$pg_restore_major"

  local prd_major=$((PRD_VERSION_NUM / 10000))
  local stg_major=$((STG_BEFORE_VERSION_NUM / 10000))
  if (( pg_dump_major < prd_major )); then
    die "pg_dump major $pg_dump_major cannot dump PRD PostgreSQL major $prd_major"
  fi
  if (( pg_restore_major < prd_major )); then
    die "pg_restore major $pg_restore_major cannot restore a PRD PostgreSQL major $prd_major dump"
  fi
  if (( stg_major < prd_major )); then
    die "STG PostgreSQL major $stg_major is older than PRD PostgreSQL major $prd_major"
  fi

  if [[ -z "$STG_FREE_STORAGE_GIB" ]]; then
    log "STG_FREE_STORAGE_GIB is not supplied; capacity is checked only for read-only preflight"
    return
  fi

  local stg_free_capacity_bytes=$((STG_FREE_STORAGE_GIB * 1024 * 1024 * 1024))
  if (( PRD_SIZE_BYTES * 100 > stg_free_capacity_bytes * MAX_SOURCE_STORAGE_PERCENT )); then
    die "PRD database size exceeds ${MAX_SOURCE_STORAGE_PERCENT}% of the supplied ${STG_FREE_STORAGE_GIB} GiB STG free-storage evidence"
  fi
}

load_failed_run_receipt() {
  local failed_run_dir="$REFRESH_ROOT_DIR/$RESUME_FAILED_RUN_ID"
  local failed_before_receipt="$failed_run_dir/before.json"
  local failed_after_receipt="$failed_run_dir/after.json"
  local failed_deployment_receipt="$failed_run_dir/deployments.tsv"

  [[ -s "$failed_before_receipt" ]] \
    || die "Resume receipt does not exist or is empty: $failed_before_receipt"
  [[ ! -e "$failed_after_receipt" ]] \
    || die "Run '$RESUME_FAILED_RUN_ID' has an after receipt and cannot be resumed"
  [[ -s "$failed_deployment_receipt" ]] \
    || die "Resume deployment receipt does not exist or is empty: $failed_deployment_receipt"

  jq -e \
    --arg runId "$RESUME_FAILED_RUN_ID" \
    --arg sourceHost "$PRD_DB_HOST" \
    --arg sourceDatabase "$PRD_DB_NAME" \
    --arg targetHost "$STG_DB_HOST" \
    --arg targetDatabase "$STG_DB_NAME" \
    '
      .runId == $runId and
      .source.host == $sourceHost and
      .source.database == $sourceDatabase and
      .targetBefore.host == $targetHost and
      .targetBefore.database == $targetDatabase and
      (.argocdAutomatedPolicy | type) == "object" and
      ((.argocdAutomatedPolicy.enabled // true) != false)
    ' "$failed_before_receipt" >/dev/null \
    || die "Resume receipt does not match the current source, target, or prior automated-sync state"

  ORIGINAL_AUTOMATED_JSON="$(jq -c '.argocdAutomatedPolicy' "$failed_before_receipt")"
  ORIGINAL_AUTOMATED_SYNC=true
  RESUMING_MAINTENANCE=true
  ARGOCD_POLICY_PAUSED=true
}

load_argocd_state() {
  local application_json
  application_json="$(get_argocd_application)" \
    || die "Could not read ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP' using context '$ARGOCD_KUBE_CONTEXT'"

  local application_namespace
  application_namespace="$(jq -r '.spec.destination.namespace // empty' <<<"$application_json")"
  [[ -n "$application_namespace" ]] \
    || die "ArgoCD Application '$ARGOCD_APP' has no destination namespace"
  if [[ -n "$WORKLOAD_NAMESPACE" && "$WORKLOAD_NAMESPACE" != "$application_namespace" ]]; then
    die "WORKLOAD_NAMESPACE '$WORKLOAD_NAMESPACE' does not match ArgoCD destination namespace '$application_namespace'"
  fi
  WORKLOAD_NAMESPACE="$application_namespace"

  local operation_phase
  operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
  if jq -e '.operation != null' >/dev/null <<<"$application_json"; then
    die "ArgoCD Application '$ARGOCD_APP' already has a pending operation"
  fi
  [[ "$operation_phase" != "Running" && "$operation_phase" != "Terminating" ]] \
    || die "ArgoCD application '$ARGOCD_APP' already has a running operation"

  local current_automated_sync=false
  if jq -e '.spec.syncPolicy.automated != null and (.spec.syncPolicy.automated.enabled // true) != false' \
    >/dev/null <<<"$application_json"; then
    current_automated_sync=true
  fi

  if [[ "$current_automated_sync" == "true" ]]; then
    [[ -z "$RESUME_FAILED_RUN_ID" ]] \
      || die "RESUME_FAILED_RUN_ID was provided but ArgoCD automated sync is enabled; refusing a stale resume"
    ORIGINAL_AUTOMATED_JSON="$(jq -c '.spec.syncPolicy.automated' <<<"$application_json")"
    ORIGINAL_AUTOMATED_SYNC=true
    return 0
  fi

  [[ -n "$RESUME_FAILED_RUN_ID" ]] \
    || die "ArgoCD automated sync is disabled before refresh; set RESUME_FAILED_RUN_ID only after validating the failed-run receipt and maintenance state"
  load_failed_run_receipt
}

read_cluster_namespace_uid() {
  local context="$1"
  kubectl_safe --context "$context" get namespace kube-system \
    -o jsonpath='{.metadata.uid}'
}

validate_cluster_identity() {
  local stg_cluster_uid argocd_cluster_uid
  stg_cluster_uid="$(read_cluster_namespace_uid "$KUBE_CONTEXT")" \
    || die "Could not read kube-system namespace identity from STG context '$KUBE_CONTEXT'"
  argocd_cluster_uid="$(read_cluster_namespace_uid "$ARGOCD_KUBE_CONTEXT")" \
    || die "Could not read kube-system namespace identity from ArgoCD context '$ARGOCD_KUBE_CONTEXT'"
  [[ -n "$stg_cluster_uid" && "$stg_cluster_uid" == "$EXPECTED_STG_CLUSTER_UID" ]] \
    || die "STG Kubernetes context '$KUBE_CONTEXT' does not match expected cluster identity"
  [[ -n "$argocd_cluster_uid" && "$argocd_cluster_uid" == "$EXPECTED_ARGOCD_CLUSTER_UID" ]] \
    || die "ArgoCD Kubernetes context '$ARGOCD_KUBE_CONTEXT' does not match expected cluster identity"
}

require_kubernetes_permission() {
  local context="$1"
  shift
  local result
  result="$(kubectl_safe --context "$context" auth can-i "$@")" \
    || die "Could not verify Kubernetes permission for '$*' in context '$context'"
  [[ "$result" == "yes" ]] \
    || die "Kubernetes permission denied for '$*' in context '$context'"
}

validate_kubernetes_permissions() {
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" \
    get application.argoproj.io "$ARGOCD_APP" -n "$ARGOCD_NAMESPACE"
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" \
    patch application.argoproj.io "$ARGOCD_APP" -n "$ARGOCD_NAMESPACE"
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" \
    get lease "$REFRESH_LEASE_NAME" -n "$REFRESH_LEASE_NAMESPACE"
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" \
    patch lease "$REFRESH_LEASE_NAME" -n "$REFRESH_LEASE_NAMESPACE"
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" \
    create leases -n "$REFRESH_LEASE_NAMESPACE"
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" \
    delete lease "$REFRESH_LEASE_NAME" -n "$REFRESH_LEASE_NAMESPACE"
  require_kubernetes_permission "$KUBE_CONTEXT" \
    get deployments -n "$WORKLOAD_NAMESPACE"
  require_kubernetes_permission "$KUBE_CONTEXT" \
    update deployments/scale -n "$WORKLOAD_NAMESPACE"
  require_kubernetes_permission "$KUBE_CONTEXT" \
    get secret "$MIGRATOR_SECRET_NAME" -n "$WORKLOAD_NAMESPACE"
}

load_migrator_database_url() {
  local encoded_url
  encoded_url="$(kubectl_safe --context "$KUBE_CONTEXT" -n "$WORKLOAD_NAMESPACE" \
    get secret "$MIGRATOR_SECRET_NAME" \
    -o "jsonpath={.data.$MIGRATOR_SECRET_KEY}")" \
    || die "Could not read the migrator Secret '$WORKLOAD_NAMESPACE/$MIGRATOR_SECRET_NAME'"
  [[ -n "$encoded_url" ]] \
    || die "Migrator Secret '$WORKLOAD_NAMESPACE/$MIGRATOR_SECRET_NAME' has no '$MIGRATOR_SECRET_KEY' value"
  if ! MIGRATOR_DATABASE_URL="$(
    printf '%s' "$encoded_url" | base64 --decode 2>/dev/null ||
      printf '%s' "$encoded_url" | base64 -D
  )"; then
    die "Could not decode the migrator database URL from Secret '$WORKLOAD_NAMESPACE/$MIGRATOR_SECRET_NAME'"
  fi
  [[ -n "$MIGRATOR_DATABASE_URL" ]] \
    || die "Migrator database URL is empty"
}

validate_migrator_secret_target() {
  load_migrator_database_url

  local migrator_host migrator_port migrator_database migrator_sslmode
  migrator_host="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" host)"
  migrator_port="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" port)"
  migrator_database="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" database)"
  migrator_sslmode="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" sslmode)"
  [[ "$migrator_host" == "$STG_DB_HOST" ]] \
    || die "Migrator Secret points to host '$migrator_host', not the validated STG host '$STG_DB_HOST'"
  [[ "$migrator_port" == "$(parse_database_url_field "$STG_DATABASE_URL" port)" ]] \
    || die "Migrator Secret points to port '$migrator_port', not the validated STG port"
  [[ "$migrator_database" == "$STG_DB_NAME" ]] \
    || die "Migrator Secret points to database '$migrator_database', not '$STG_DB_NAME'"
  case "$REQUIRED_DB_SSLMODE:$migrator_sslmode" in
    require:require|require:verify-ca|require:verify-full|verify-ca:verify-ca|verify-ca:verify-full|verify-full:verify-full) ;;
    *) die "Migrator Secret database URL does not meet sslmode=$REQUIRED_DB_SSLMODE" ;;
  esac

  local stg_identity migrator_identity
  load_database_identity stg_identity "$STG_DATABASE_URL" STG
  load_database_identity migrator_identity "$MIGRATOR_DATABASE_URL" migrator
  [[ "$stg_identity" == "$migrator_identity" ]] \
    || die "Migrator Secret and STG database URLs resolve to different database identities"
}

load_workload_state() {
  local deployments_json
  deployments_json="$(kubectl_safe --context "$KUBE_CONTEXT" -n "$WORKLOAD_NAMESPACE" get deployments \
    -l "$WORKLOAD_SELECTOR" -o json)" \
    || die "Could not list STG deployments using context '$KUBE_CONTEXT'"

  local deployment_count
  deployment_count="$(jq '.items | length' <<<"$deployments_json")"
  validate_positive_integer deployment_count "$deployment_count"
  (( deployment_count > 0 )) \
    || die "No STG deployments matched selector '$WORKLOAD_SELECTOR'"

  printf '%s' "$deployments_json"
}

workload_set_hash() {
  jq -c '[.items[] | {namespace: .metadata.namespace, name: .metadata.name, uid: (.metadata.uid // "")}] | sort_by(.namespace, .name, .uid)' \
    | shasum -a 256 | awk '{print $1}'
}

validate_stg_database_identity() {
  local stg_identity stg_database
  load_database_identity stg_identity "$STG_DATABASE_URL" STG
  stg_database="$(printf '%s' "$stg_identity" | cut -d'|' -f1)"
  [[ "$stg_database" == "$STG_DB_NAME" ]] \
    || die "STG database identity '$stg_database' does not match expected database '$STG_DB_NAME'"
}

record_preflight_workload_set() {
  local deployments_json="$1"
  WORKLOAD_SET_HASH="$(workload_set_hash <<<"$deployments_json")"
}

validate_preflight_workload_set() {
  local deployments_json="$1"
  [[ -n "$WORKLOAD_SET_HASH" ]] || return 0
  local current_hash
  current_hash="$(workload_set_hash <<<"$deployments_json")"
  [[ "$current_hash" == "$WORKLOAD_SET_HASH" ]] \
    || die "Selected STG Deployments changed after preflight; refusing mutation"
}

validate_resume_workload_state() {
  local deployments_json="$1"
  [[ "$RESUMING_MAINTENANCE" == "true" ]] || return 0

  local nonzero_replicas
  nonzero_replicas="$(
    jq '[.items[] | select((.spec.replicas // 1) != 0 or (.status.replicas // 0) != 0)] | length' \
      <<<"$deployments_json"
  )"
  [[ "$nonzero_replicas" == "0" ]] \
    || die "Cannot resume while any selected STG Deployment has desired or running replicas"

  local failed_deployment_receipt="$REFRESH_ROOT_DIR/$RESUME_FAILED_RUN_ID/deployments.tsv"
  local receipt_deployments current_deployments
  receipt_deployments="$(
    jq -Rn \
      '[inputs | select(length > 0) | split("\t") | {namespace: .[0], name: .[1]}] | sort_by(.namespace, .name)' \
      <"$failed_deployment_receipt"
  )"
  current_deployments="$(
    jq -c '[.items[] | {namespace: .metadata.namespace, name: .metadata.name}] | sort_by(.namespace, .name)' \
      <<<"$deployments_json"
  )"
  [[ "$current_deployments" == "$(jq -c . <<<"$receipt_deployments")" ]] \
    || die "Selected STG Deployments no longer match the failed-run receipt"

  WORKLOADS_SCALED=true
  log "Resuming fail-safe maintenance from run '$RESUME_FAILED_RUN_ID'; ArgoCD remains manual and all selected Deployments remain at zero"
}

print_preflight_summary() {
  local deployments_json="$1"
  local deployment_count
  deployment_count="$(jq '.items | length' <<<"$deployments_json")"
  log "Preflight complete"
  log "Source: $PRD_DB_HOST/$PRD_DB_NAME (PostgreSQL $((PRD_VERSION_NUM / 10000)), $PRD_SIZE_BYTES bytes, $PRD_TABLE_COUNT tables)"
  log "Target: $STG_DB_HOST/$STG_DB_NAME (PostgreSQL $((STG_BEFORE_VERSION_NUM / 10000)), current size $STG_BEFORE_SIZE_BYTES bytes)"
  log "ArgoCD Application: $ARGOCD_NAMESPACE/$ARGOCD_APP via context $ARGOCD_KUBE_CONTEXT"
  log "STG deployments to stop: $deployment_count"
  while IFS=$'\t' read -r namespace deployment; do
    [[ -n "$namespace" && -n "$deployment" ]] || continue
    log "  - $namespace/$deployment"
  done < <(jq -r '.items[] | [.metadata.namespace, .metadata.name] | @tsv' <<<"$deployments_json")
  log "STG reset: remove $STG_SUPPORTED_OBJECT_COUNT objects owned by $STG_CONNECTED_ROLE; preserve public schema owned by $STG_PUBLIC_SCHEMA_OWNER"
  log "Raw PRD data, including personal data, will be present in STG after execution."
}

prepare_run_directory() {
  RUN_DIR="$REFRESH_ROOT_DIR/$RUN_ID"
  ARCHIVE_PATH="$RUN_DIR/prd.dump.gpg"
  ARCHIVE_CHECKSUM_PATH="$ARCHIVE_PATH.sha256"
  ARCHIVE_CATALOG_PATH="$RUN_DIR/prd.dump.list"
  BEFORE_RECEIPT="$RUN_DIR/before.json"
  AFTER_RECEIPT="$RUN_DIR/after.json"
  DEPLOYMENT_RECEIPT="$RUN_DIR/deployments.tsv"

  [[ ! -e "$RUN_DIR" ]] || die "Run directory already exists; choose a new RUN_ID: $RUN_DIR"
  mkdir -p "$RUN_DIR"
  chmod 700 "$RUN_DIR"
}

encrypt_prd_dump() {
  log "Creating encrypted PRD custom-format dump"
  exec 3<<<"$BACKUP_ENCRYPTION_KEY"
  if ! run_database_command "$PRD_DATABASE_URL" \
    pg_dump --format=custom --no-owner --no-privileges \
      | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
        --cipher-algo AES256 --symmetric --output "$ARCHIVE_PATH"; then
    exec 3<&-
    die "PRD dump or archive encryption failed"
  fi
  exec 3<&-

  [[ -s "$ARCHIVE_PATH" ]] || die "Encrypted PRD archive is empty"

  local checksum
  checksum="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"
  [[ "$checksum" =~ ^[0-9a-fA-F]{64}$ ]] || die "Could not calculate archive checksum"
  printf '%s  %s\n' "$checksum" "$(basename "$ARCHIVE_PATH")" >"$ARCHIVE_CHECKSUM_PATH"

  log "Validating that the encrypted archive decrypts and has a readable pg_restore catalog"
  exec 3<<<"$BACKUP_ENCRYPTION_KEY"
  if ! gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
    --decrypt "$ARCHIVE_PATH" 2>/dev/null \
      | {
        pg_restore --list >"$ARCHIVE_CATALOG_PATH"
        catalog_status=$?
        cat >/dev/null
        drain_status=$?
        (( catalog_status == 0 && drain_status == 0 ))
      }; then
    exec 3<&-
    die "Encrypted archive validation failed"
  fi
  exec 3<&-

  local filtered_catalog="$ARCHIVE_CATALOG_PATH.filtered"
  local public_schema_entries
  public_schema_entries="$(
    grep -Ec '^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public|(COMMENT|ACL|SECURITY LABEL) - SCHEMA public) ' \
      "$ARCHIVE_CATALOG_PATH" || true
  )"
  (( public_schema_entries > 0 )) \
    || die "PRD archive catalog does not contain the expected public schema entry"

  awk '
    /^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public / ||
    /^[0-9]+; [0-9]+ [0-9]+ (COMMENT|ACL|SECURITY LABEL) - SCHEMA public / {
      print ";" $0
      next
    }
    { print }
  ' "$ARCHIVE_CATALOG_PATH" >"$filtered_catalog"
  mv -- "$filtered_catalog" "$ARCHIVE_CATALOG_PATH"

  if grep -Eq '^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public|(COMMENT|ACL|SECURITY LABEL) - SCHEMA public) ' \
    "$ARCHIVE_CATALOG_PATH"; then
    die "Could not exclude public schema ownership entries from the restore catalog"
  fi
}

write_before_receipt() {
  local archive_checksum
  archive_checksum="$(awk '{print $1}' "$ARCHIVE_CHECKSUM_PATH")"

  jq -n \
    --arg runId "$RUN_ID" \
    --arg resumedFromRunId "$RESUME_FAILED_RUN_ID" \
    --arg createdAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg sourceHost "$PRD_DB_HOST" \
    --arg sourceDatabase "$PRD_DB_NAME" \
    --arg targetHost "$STG_DB_HOST" \
    --arg targetDatabase "$STG_DB_NAME" \
    --arg archiveSha256 "$archive_checksum" \
    --argjson sourceSizeBytes "$PRD_SIZE_BYTES" \
    --argjson sourceTableCount "$PRD_TABLE_COUNT" \
    --argjson sourceAppliedMigrations "$PRD_APPLIED_MIGRATIONS" \
    --argjson targetBeforeSizeBytes "$STG_BEFORE_SIZE_BYTES" \
    --argjson targetBeforeTableCount "$STG_BEFORE_TABLE_COUNT" \
    --argjson targetBeforeAppliedMigrations "$STG_BEFORE_APPLIED_MIGRATIONS" \
    --argjson argocdAutomatedPolicy "$ORIGINAL_AUTOMATED_JSON" \
    '{
      runId: $runId,
      resumedFromRunId: (if $resumedFromRunId == "" then null else $resumedFromRunId end),
      createdAt: $createdAt,
      source: {
        host: $sourceHost,
        database: $sourceDatabase,
        sizeBytes: $sourceSizeBytes,
        tableCount: $sourceTableCount,
        appliedMigrations: $sourceAppliedMigrations
      },
      targetBefore: {
        host: $targetHost,
        database: $targetDatabase,
        sizeBytes: $targetBeforeSizeBytes,
        tableCount: $targetBeforeTableCount,
        appliedMigrations: $targetBeforeAppliedMigrations
      },
      archiveSha256: $archiveSha256,
      argocdAutomatedPolicy: $argocdAutomatedPolicy
    }' >"$BEFORE_RECEIPT"
}

pause_argocd_policy() {
  if [[ "$RESUMING_MAINTENANCE" == "true" ]]; then
    log "ArgoCD automated sync is already disabled by failed run '$RESUME_FAILED_RUN_ID'"
    ARGOCD_POLICY_PAUSED=true
    return 0
  fi

  log "Disabling automated sync/self-heal on ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP'"
  patch_argocd_application '{"spec":{"syncPolicy":{"automated":null}}}' >/dev/null
  ARGOCD_POLICY_PAUSED=true

  local application_json
  application_json="$(get_argocd_application)"
  if jq -e '.spec.syncPolicy.automated != null and (.spec.syncPolicy.automated.enabled // true) != false' \
    >/dev/null <<<"$application_json"; then
    die "ArgoCD automated sync is still enabled after requesting manual policy"
  fi
}

scale_stg_workloads_down() {
  local deployments_json
  WORKLOADS_SCALED=false
  deployments_json="$(load_workload_state)"
  validate_preflight_workload_set "$deployments_json"
  if [[ ! -s "$DEPLOYMENT_RECEIPT" ]]; then
    jq -r '.items[] | [.metadata.namespace, .metadata.name, (.spec.replicas // 1)] | @tsv' \
      <<<"$deployments_json" >"$DEPLOYMENT_RECEIPT"
  fi

  local scale_failed=false
  while IFS=$'\t' read -r namespace deployment replicas; do
    [[ -n "$namespace" && -n "$deployment" ]] || continue
    log "Scaling $namespace/deployment/$deployment from $replicas to 0"
    if ! kubectl_safe --context "$KUBE_CONTEXT" -n "$namespace" \
      scale "deployment/$deployment" --replicas=0 >/dev/null; then
      scale_failed=true
    fi
  done <"$DEPLOYMENT_RECEIPT"

  [[ "$scale_failed" == "false" ]] \
    || return 1

  local deadline=$((SECONDS + WORKLOAD_DRAIN_TIMEOUT_SECONDS))
  while true; do
    deployments_json="$(load_workload_state)"
    local remaining_replicas
    remaining_replicas="$(jq '[.items[] | (.status.replicas // 0)] | add // 0' <<<"$deployments_json")"
    validate_positive_integer remaining_replicas "$remaining_replicas"
    if (( remaining_replicas == 0 )); then
      break
    fi
    if (( SECONDS >= deadline )); then
      die "Timed out waiting for STG workloads to reach zero replicas"
    fi
    sleep 2
  done

  WORKLOADS_SCALED=true
  log "All selected STG workloads are stopped"
}

best_effort_scale_stg_workloads_down() {
  local deployments_json
  deployments_json="$(kubectl_safe --context "$KUBE_CONTEXT" -n "$WORKLOAD_NAMESPACE" \
    get deployments -l "$WORKLOAD_SELECTOR" -o json 2>/dev/null)" || return 1
  local scale_failed=false
  while IFS=$'\t' read -r namespace deployment; do
    [[ -n "$namespace" && -n "$deployment" ]] || continue
    if ! kubectl_safe --context "$KUBE_CONTEXT" -n "$namespace" \
      scale "deployment/$deployment" --replicas=0 >/dev/null; then
      scale_failed=true
    fi
  done < <(jq -r '.items[] | [.metadata.namespace, .metadata.name] | @tsv' <<<"$deployments_json")
  [[ "$scale_failed" == "false" ]]
}

reset_stg_owned_objects() {
  local reset_sql
  reset_sql=$(cat <<'SQL'
/* klicker_reset_owned_objects */
SET lock_timeout = '30s';
BEGIN;
DO $reset$
DECLARE
  object_record record;
  object_kind text;
BEGIN
  FOR object_record IN
    SELECT
      p.proname AS object_name,
      p.prokind,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_has_role(current_user, p.proowner, 'USAGE')
  LOOP
    object_kind := CASE object_record.prokind
      WHEN 'p' THEN 'PROCEDURE'
      WHEN 'a' THEN 'AGGREGATE'
      ELSE 'FUNCTION'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I(%s) CASCADE',
      object_kind,
      'public',
      object_record.object_name,
      object_record.identity_arguments
    );
  END LOOP;

  FOR object_record IN
    SELECT c.relname AS object_name, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm')
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    object_kind := CASE object_record.relkind
      WHEN 'm' THEN 'MATERIALIZED VIEW'
      ELSE 'VIEW'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I CASCADE',
      object_kind,
      'public',
      object_record.object_name
    );
  END LOOP;

  FOR object_record IN
    SELECT c.relname AS object_name, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'f')
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    object_kind := CASE object_record.relkind
      WHEN 'f' THEN 'FOREIGN TABLE'
      ELSE 'TABLE'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I CASCADE',
      object_kind,
      'public',
      object_record.object_name
    );
  END LOOP;

  FOR object_record IN
    SELECT c.relname AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    EXECUTE format(
      'DROP SEQUENCE IF EXISTS %I.%I CASCADE',
      'public',
      object_record.object_name
    );
  END LOOP;

  FOR object_record IN
    SELECT t.typname AS object_name, t.typtype
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typrelid = 0
      AND pg_has_role(current_user, t.typowner, 'USAGE')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_type'::regclass
          AND d.objid = t.oid
          AND d.deptype IN ('i', 'e')
      )
  LOOP
    object_kind := CASE object_record.typtype
      WHEN 'd' THEN 'DOMAIN'
      ELSE 'TYPE'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I CASCADE',
      object_kind,
      'public',
      object_record.object_name
    );
  END LOOP;
END
$reset$;
COMMIT;
SQL
)

  log "Removing STG objects owned by '$STG_CONNECTED_ROLE' while preserving schema 'public' owned by '$STG_PUBLIC_SCHEMA_OWNER'"
  run_database_command "$STG_DATABASE_URL" \
    psql -X -v ON_ERROR_STOP=1 -c "$reset_sql" >/dev/null
  TARGET_MUTATED=true
}

restore_stg_database() {
  log "Restoring the encrypted PRD archive into STG"
  exec 3<<<"$BACKUP_ENCRYPTION_KEY"
  if ! gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
    --decrypt "$ARCHIVE_PATH" 2>/dev/null \
      | run_database_command "$STG_DATABASE_URL" \
        pg_restore --format=custom --exit-on-error --single-transaction \
          --dbname="$STG_DB_NAME" --use-list="$ARCHIVE_CATALOG_PATH" \
          --no-owner --no-privileges; then
    exec 3<&-
    die "STG pg_restore failed"
  fi
  exec 3<&-
}

validate_restored_snapshot() {
  local metadata="$1"
  local database_name version_num size_bytes table_count applied_migrations
  local failed_migrations extra_schema_count large_object_count
  IFS='|' read -r database_name version_num size_bytes table_count applied_migrations \
    failed_migrations extra_schema_count large_object_count <<<"$metadata"

  [[ "$database_name" == "$STG_DB_NAME" ]] || die "Restored metadata came from an unexpected database"
  validate_positive_integer restored_version_num "$version_num"
  validate_positive_integer restored_size_bytes "$size_bytes"
  validate_positive_integer restored_table_count "$table_count"
  validate_positive_integer restored_applied_migrations "$applied_migrations"
  validate_positive_integer restored_failed_migrations "$failed_migrations"
  validate_positive_integer restored_extra_schema_count "$extra_schema_count"
  validate_positive_integer restored_large_object_count "$large_object_count"
  [[ "$table_count" == "$PRD_TABLE_COUNT" ]] \
    || die "Restored table count $table_count does not match PRD snapshot count $PRD_TABLE_COUNT"
  [[ "$applied_migrations" == "$PRD_APPLIED_MIGRATIONS" ]] \
    || die "Restored migration count $applied_migrations does not match PRD snapshot count $PRD_APPLIED_MIGRATIONS"
  [[ "$failed_migrations" == "0" ]] \
    || die "Restored snapshot contains $failed_migrations unresolved Prisma migration(s)"
  [[ "$extra_schema_count" == "0" && "$large_object_count" == "0" ]] \
    || die "Restored snapshot contains unsupported schemas or large objects"

  local restored_migration_history
  load_migration_history restored_migration_history "$STG_DATABASE_URL" STG
  [[ "$restored_migration_history" == "$PRD_MIGRATION_HISTORY" ]] \
    || die "Restored migration names and checksums do not exactly match the PRD snapshot"

  log "Logical restore matches the PRD table and migration metadata"
}

terminate_argocd_operation() {
  log "Terminating the timed-out ArgoCD operation before recovery"
  patch_argocd_application '{"operation":null}' >/dev/null \
    || return 1

  local deadline=$((SECONDS + ARGOCD_TERMINATION_TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    local application_json operation_phase
    application_json="$(get_argocd_application)" || {
      sleep "$ARGOCD_POLL_SECONDS"
      continue
    }
    operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
    if ! jq -e '.operation != null' >/dev/null <<<"$application_json" && \
      [[ "$operation_phase" != "Running" && "$operation_phase" != "Terminating" ]]; then
      return 0
    fi
    sleep "$ARGOCD_POLL_SECONDS"
  done
  return 1
}

run_presync_hook() {
  local application_json operation_phase
  application_json="$(get_argocd_application)" \
    || die "Could not read ArgoCD Application immediately before sync"
  operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
  if jq -e '.operation != null' >/dev/null <<<"$application_json" || \
    [[ "$operation_phase" == "Running" || "$operation_phase" == "Terminating" ]]; then
    die "ArgoCD Application '$ARGOCD_APP' acquired another operation before refresh sync"
  fi

  local initiator="prd-to-stg-refresh-$RUN_ID"
  local sync_patch
  sync_patch="$(build_argocd_sync_patch "$initiator")"

  log "Submitting a hook-based sync to ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP'"
  if ! patch_argocd_application "$sync_patch" >/dev/null; then
    die "Could not submit the ArgoCD sync operation through the Kubernetes API"
  fi

  # Once the operation is accepted, Deployment replica state is no longer
  # guaranteed to be zero: a successful PreSync allows the main Sync phase.
  WORKLOADS_SCALED=false

  local deadline=$((SECONDS + ARGOCD_TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    if ! application_json="$(get_argocd_application)"; then
      log "Waiting for the ArgoCD Application resource to become readable"
      sleep "$ARGOCD_POLL_SECONDS"
      continue
    fi

    local observed_initiator
    observed_initiator="$(jq -r '.status.operationState.operation.initiatedBy.username // ""' <<<"$application_json")"
    if [[ "$observed_initiator" != "$initiator" ]]; then
      sleep "$ARGOCD_POLL_SECONDS"
      continue
    fi

    operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
    case "$operation_phase" in
      Succeeded)
        log "ArgoCD sync succeeded; the PreSync migration hook and Sync phase completed"
        return 0
        ;;
      Failed|Error)
        local operation_message
        operation_message="$(jq -r '.status.operationState.message // "no operation message"' <<<"$application_json")"
        log "ArgoCD operation ended in phase '$operation_phase': $operation_message"
        log "Forcing the selected STG Deployments back to zero"
        scale_stg_workloads_down
        die "ArgoCD sync or PreSync migration hook failed"
        ;;
    esac

    sleep "$ARGOCD_POLL_SECONDS"
  done

  if ! terminate_argocd_operation; then
    die "Timed out waiting for the submitted ArgoCD operation and could not confirm its termination"
  fi
  renew_refresh_lease
  log "Timed out waiting for the submitted ArgoCD operation; forcing STG Deployments back to zero"
  scale_stg_workloads_down
  die "ArgoCD sync did not complete within $ARGOCD_TIMEOUT_SECONDS seconds"
}

scale_stg_workloads_down_after_verification_failure() {
  log "Post-sync verification failed; returning STG workloads to zero replicas"
  scale_stg_workloads_down
}

validate_migrated_target() {
  local metadata="$1"
  local database_name version_num size_bytes table_count applied_migrations
  local failed_migrations extra_schema_count large_object_count
  IFS='|' read -r database_name version_num size_bytes table_count applied_migrations \
    failed_migrations extra_schema_count large_object_count <<<"$metadata"
  MIGRATED_SIZE_BYTES="$size_bytes"
  MIGRATED_TABLE_COUNT="$table_count"
  MIGRATED_APPLIED_MIGRATIONS="$applied_migrations"

  local error=""
  local migrated_migration_history
  load_migration_history migrated_migration_history "$STG_DATABASE_URL" STG
  if [[ "$database_name" != "$STG_DB_NAME" ]]; then
    error="Post-migration metadata came from unexpected database '$database_name'"
  elif [[ ! "$version_num" =~ ^[0-9]+$ ||
    ! "$size_bytes" =~ ^[0-9]+$ ||
    ! "$table_count" =~ ^[0-9]+$ ||
    ! "$applied_migrations" =~ ^[0-9]+$ ||
    ! "$failed_migrations" =~ ^[0-9]+$ ||
    ! "$extra_schema_count" =~ ^[0-9]+$ ||
    ! "$large_object_count" =~ ^[0-9]+$ ]]; then
    error="Post-migration database metadata is incomplete or malformed"
  elif (( table_count == 0 )); then
    error="Post-migration database contains no public tables"
  elif (( applied_migrations < PRD_APPLIED_MIGRATIONS )); then
    error="Post-migration applied count $applied_migrations is lower than PRD snapshot count $PRD_APPLIED_MIGRATIONS"
  elif [[ "$failed_migrations" != "0" ]]; then
    error="Post-migration database contains $failed_migrations unresolved Prisma migration(s)"
  elif [[ -n "$PRD_MIGRATION_HISTORY" &&
    "$migrated_migration_history" != "$PRD_MIGRATION_HISTORY" &&
    "$migrated_migration_history" != "$PRD_MIGRATION_HISTORY"$'\n'* ]]; then
    error="Post-migration migration names and checksums do not extend the PRD history"
  elif [[ "$extra_schema_count" != "0" || "$large_object_count" != "0" ]]; then
    error="Post-migration database contains unsupported schemas or large objects"
  fi

  if [[ -n "$error" ]]; then
    scale_stg_workloads_down_after_verification_failure
    die "$error"
  fi

  log "Post-sync verification passed: $table_count tables, $applied_migrations applied migrations"
}

write_after_receipt() {
  jq -n \
    --arg runId "$RUN_ID" \
    --arg completedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg targetHost "$STG_DB_HOST" \
    --arg targetDatabase "$STG_DB_NAME" \
    --argjson targetSizeBytes "$MIGRATED_SIZE_BYTES" \
    --argjson targetTableCount "$MIGRATED_TABLE_COUNT" \
    --argjson targetAppliedMigrations "$MIGRATED_APPLIED_MIGRATIONS" \
    '{
      runId: $runId,
      completedAt: $completedAt,
      targetAfter: {
        host: $targetHost,
        database: $targetDatabase,
        sizeBytes: $targetSizeBytes,
        tableCount: $targetTableCount,
        appliedMigrations: $targetAppliedMigrations,
        unresolvedMigrations: 0
      }
    }' >"$AFTER_RECEIPT"
}

restore_argocd_policy() {
  local policy_patch
  policy_patch="$(build_argocd_policy_patch "$ORIGINAL_AUTOMATED_JSON")"
  renew_refresh_lease
  patch_argocd_application "$policy_patch" >/dev/null

  local application_json
  application_json="$(get_argocd_application)"
  jq -e --argjson expected "$ORIGINAL_AUTOMATED_JSON" \
    '(.spec.syncPolicy.automated // null) == $expected' \
    >/dev/null <<<"$application_json" \
    || die "Could not restore the exact original ArgoCD automated-sync policy"

  local restored_automated=false
  if jq -e '.spec.syncPolicy.automated != null and (.spec.syncPolicy.automated.enabled // true) != false' \
    >/dev/null <<<"$application_json"; then
    restored_automated=true
  fi

  [[ "$restored_automated" == "$ORIGINAL_AUTOMATED_SYNC" ]] \
    || die "Could not restore the original ArgoCD automated-sync state"

  ARGOCD_POLICY_PAUSED=false
  WORKLOADS_SCALED=false
  log "Restored the original ArgoCD sync policy"
}

validate_configuration() {
  validate_boolean DRY_RUN "$DRY_RUN"
  validate_boolean KEEP_ENCRYPTED_ARCHIVE "$KEEP_ENCRYPTED_ARCHIVE"
  validate_boolean ALLOW_RAW_PRD_DATA_IN_STG "$ALLOW_RAW_PRD_DATA_IN_STG"
  validate_boolean STG_OUTBOUND_INTEGRATIONS_ISOLATED "$STG_OUTBOUND_INTEGRATIONS_ISOLATED"
  validate_positive_integer MAX_SOURCE_STORAGE_PERCENT "$MAX_SOURCE_STORAGE_PERCENT"
  if [[ -n "$STG_FREE_STORAGE_GIB" ]]; then
    validate_positive_integer STG_FREE_STORAGE_GIB "$STG_FREE_STORAGE_GIB"
  fi
  validate_positive_integer REFRESH_LEASE_DURATION_SECONDS "$REFRESH_LEASE_DURATION_SECONDS"
  validate_positive_integer ARGOCD_TIMEOUT_SECONDS "$ARGOCD_TIMEOUT_SECONDS"
  validate_positive_integer ARGOCD_TERMINATION_TIMEOUT_SECONDS "$ARGOCD_TERMINATION_TIMEOUT_SECONDS"
  validate_positive_integer ARGOCD_POLL_SECONDS "$ARGOCD_POLL_SECONDS"
  validate_positive_integer WORKLOAD_DRAIN_TIMEOUT_SECONDS "$WORKLOAD_DRAIN_TIMEOUT_SECONDS"
  [[ -n "$EXPECTED_STG_CLUSTER_UID" ]] \
    || die "EXPECTED_STG_CLUSTER_UID is required for Kubernetes target binding"
  [[ -n "$EXPECTED_ARGOCD_CLUSTER_UID" ]] \
    || die "EXPECTED_ARGOCD_CLUSTER_UID is required for Kubernetes target binding"
  validate_run_id
  validate_resume_failed_run_id
  (( REFRESH_LEASE_DURATION_SECONDS > 0 )) || die "REFRESH_LEASE_DURATION_SECONDS must be greater than zero"
  (( ARGOCD_POLL_SECONDS > 0 )) || die "ARGOCD_POLL_SECONDS must be greater than zero"
  (( MAX_SOURCE_STORAGE_PERCENT > 0 && MAX_SOURCE_STORAGE_PERCENT <= 95 )) \
    || die "MAX_SOURCE_STORAGE_PERCENT must be between 1 and 95"
}

validate_execution_gates() {
  [[ "$DRY_RUN" == "false" ]] || return 0

  [[ "$CONFIRM_PRD_TO_STG_REFRESH" == "ERASE_STG_AND_COPY_PRD" ]] \
    || die "Execution requires CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD"
  [[ "$ALLOW_RAW_PRD_DATA_IN_STG" == "true" ]] \
    || die "Execution requires ALLOW_RAW_PRD_DATA_IN_STG=true"
  [[ -n "$RAW_PRD_DATA_APPROVAL_REF" ]] \
    || die "Execution requires RAW_PRD_DATA_APPROVAL_REF=<approved ticket or ADR reference>"
  [[ "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" == "true" ]] \
    || die "Execution requires STG_OUTBOUND_INTEGRATIONS_ISOLATED=true"
  [[ -n "$STG_FREE_STORAGE_GIB" ]] \
    || die "Execution requires STG_FREE_STORAGE_GIB=<current free storage evidence>"
}

validate_tools() {
  local tools=(awk base64 cat cut gpg grep jq kubectl mv node pg_dump pg_restore psql sed shasum)
  local tool
  for tool in "${tools[@]}"; do
    require_command "$tool"
  done
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    print_help
    return 0
  fi
  [[ $# -eq 0 ]] || die "Unknown argument: $1"

  validate_configuration
  validate_execution_gates
  validate_tools
  load_credentials
  validate_endpoints

  local prd_metadata stg_before_metadata
  load_database_metadata prd_metadata "$PRD_DATABASE_URL" PRD
  load_database_metadata stg_before_metadata "$STG_DATABASE_URL" STG
  parse_prd_metadata "$prd_metadata"
  parse_stg_before_metadata "$stg_before_metadata"
  load_migration_history PRD_MIGRATION_HISTORY "$PRD_DATABASE_URL" PRD
  validate_stg_reset_capabilities
  validate_client_and_capacity
  validate_cluster_identity
  load_argocd_state
  validate_kubernetes_permissions
  validate_migrator_secret_target

  local deployments_json
  deployments_json="$(load_workload_state)"
  validate_resume_workload_state "$deployments_json"
  record_preflight_workload_set "$deployments_json"
  print_preflight_summary "$deployments_json"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY_RUN=true: no dump was created and no external state was changed."
    log "Re-run with the three documented execution gates after reviewing this plan."
    return 0
  fi

  acquire_refresh_lease
  prepare_run_directory
  encrypt_prd_dump
  renew_refresh_lease
  write_before_receipt

  pause_argocd_policy
  renew_refresh_lease
  validate_preflight_workload_set "$(load_workload_state)"
  scale_stg_workloads_down

  # Re-verify the pause immediately before the first destructive database action.
  local paused_application_json
  paused_application_json="$(get_argocd_application)"
  if jq -e '.spec.syncPolicy.automated != null and (.spec.syncPolicy.automated.enabled // true) != false' \
    >/dev/null <<<"$paused_application_json"; then
    die "ArgoCD automated sync was re-enabled before database replacement"
  fi

  renew_refresh_lease
  validate_stg_database_identity
  reset_stg_owned_objects
  restore_stg_database
  local restored_metadata
  load_database_metadata restored_metadata "$STG_DATABASE_URL" STG
  validate_restored_snapshot "$restored_metadata"
  RESTORE_VERIFIED=true

  renew_refresh_lease
  run_presync_hook
  local migrated_metadata
  if ! migrated_metadata="$(read_database_metadata "$STG_DATABASE_URL")"; then
    scale_stg_workloads_down
    die "Could not read STG database metadata after the migration hook"
  fi
  [[ -n "$migrated_metadata" ]] || {
    scale_stg_workloads_down
    die "STG database metadata after the migration hook is empty"
  }
  validate_migrated_target "$migrated_metadata"
  restore_argocd_policy
  write_after_receipt

  log "PRD-to-STG database refresh completed successfully"
  log "Receipts: $BEFORE_RECEIPT and $AFTER_RECEIPT"
  if [[ "$KEEP_ENCRYPTED_ARCHIVE" == "true" ]]; then
    log "Encrypted archive retained at: $ARCHIVE_PATH"
  else
    log "Encrypted archive will be removed during cleanup"
  fi
}

main "$@"
