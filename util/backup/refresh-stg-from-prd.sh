#!/usr/bin/env bash

# Replace the Klicker STG PostgreSQL database with a logical copy of PRD, then
# run the existing ArgoCD PreSync migration hook by submitting a sync operation
# directly to the self-hosted ArgoCD Application custom resource.
#
# Safety defaults:
# - DRY_RUN=true performs read-only validation only.
# - Execution requires explicit destructive, data-approval, and isolation gates.
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

# Production target contract. Ambient variables must not be able to redefine
# the source, target, or identities that the safety checks are meant to prove.
# Replacing any of these resources requires a reviewed script change.
readonly PRD_INFISICAL_ENV=prd
readonly STG_INFISICAL_ENV=stg
readonly INFISICAL_API_URL=https://inf.prd.df-app.ch/api
readonly INFISICAL_PROJECT_ID=d071be96-5136-4f23-a6cb-e0c7f9b9a6c8
readonly INFISICAL_SECRET_PATH=/

readonly EXPECTED_PRD_DB_HOST=db-server-prd-apps.postgres.database.azure.com
readonly EXPECTED_STG_DB_HOST=db-server-stg-apps.postgres.database.azure.com
readonly EXPECTED_PRD_DB_PORT=6432
readonly EXPECTED_STG_DB_PORT=6432
readonly EXPECTED_PRD_DB_NAME=klicker-prod-prd
readonly EXPECTED_STG_DB_NAME=klicker-qa-stg
STG_STORAGE_GIB="${STG_STORAGE_GIB:-32}"
MAX_SOURCE_STORAGE_PERCENT="${MAX_SOURCE_STORAGE_PERCENT:-75}"
readonly STG_AZURE_RESOURCE_GROUP=DF_Klicker_RG
readonly STG_AZURE_SERVER_NAME=db-server-stg-apps
MIN_STG_FREE_SPACE_MULTIPLIER="${MIN_STG_FREE_SPACE_MULTIPLIER:-3}"

KUBE_CONTEXT="${KUBE_CONTEXT:-aks-stg-apps}"
ARGOCD_KUBE_CONTEXT="${ARGOCD_KUBE_CONTEXT:-$KUBE_CONTEXT}"
readonly ARGOCD_NAMESPACE=argo
readonly ARGOCD_APP=app-klicker
readonly EXPECTED_ARGOCD_PROJECT=stg-apps-klicker
readonly WORKLOAD_NAMESPACE=stg-klicker
readonly EXPECTED_KUBE_TLS_SERVER_NAME=stg-apps-vhziuhfl.hcp.switzerlandnorth.azmk8s.io
readonly EXPECTED_KUBE_SYSTEM_UID=207f1b0e-5ad7-4de6-94d1-2b4564a41fe7
readonly EXPECTED_WORKLOAD_NAMESPACE_UID=ae9b8ae9-d3df-4078-820d-1ef69d4cf816
readonly EXPECTED_ARGOCD_APP_UID=9f936f7f-58ff-4a72-8c75-eb969ac3bd6f
readonly EXPECTED_ARGOCD_PROJECT_UID=6faae3ef-2736-45ee-a2d5-8fd4cfd41b16
readonly EXPECTED_ARGOCD_DESTINATION_SERVER=https://kubernetes.default.svc
readonly EXPECTED_ARGOCD_REPO_URL=https://github.com/uzh-bf/klicker-uzh.git
readonly EXPECTED_ARGOCD_TARGET_REVISION=v3
readonly MIGRATOR_SECRET_NAME=app-klicker-klicker-uzh-v2-secret-backend-graphql
readonly MIGRATOR_SECRET_KEY=DATABASE_URL
readonly MIGRATOR_JOB_NAME=app-klicker-klicker-uzh-v2-migrate
readonly EXPECTED_MIGRATOR_IMAGE_REPOSITORY=ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm
KUBECTL_REQUEST_TIMEOUT="${KUBECTL_REQUEST_TIMEOUT:-30s}"
ARGOCD_TIMEOUT_SECONDS="${ARGOCD_TIMEOUT_SECONDS:-1200}"
ARGOCD_POLL_SECONDS="${ARGOCD_POLL_SECONDS:-2}"
readonly WORKLOAD_SELECTOR=app.kubernetes.io/instance=app-klicker
WORKLOAD_DRAIN_TIMEOUT_SECONDS="${WORKLOAD_DRAIN_TIMEOUT_SECONDS:-300}"
POST_SYNC_HEALTH_TIMEOUT_SECONDS="${POST_SYNC_HEALTH_TIMEOUT_SECONDS:-600}"
CLEANUP_TIMEOUT_SECONDS="${CLEANUP_TIMEOUT_SECONDS:-300}"
MIGRATOR_EVIDENCE_TIMEOUT_SECONDS="${MIGRATOR_EVIDENCE_TIMEOUT_SECONDS:-10}"

readonly REFRESH_LEASE_NAME=app-klicker-prd-to-stg-refresh
REFRESH_LEASE_DURATION_SECONDS="${REFRESH_LEASE_DURATION_SECONDS:-300}"
REFRESH_LEASE_RENEW_INTERVAL_SECONDS="${REFRESH_LEASE_RENEW_INTERVAL_SECONDS:-30}"
REFRESH_LEASE_RENEW_RETRY_ATTEMPTS="${REFRESH_LEASE_RENEW_RETRY_ATTEMPTS:-3}"
REFRESH_LEASE_RENEW_RETRY_DELAY_SECONDS="${REFRESH_LEASE_RENEW_RETRY_DELAY_SECONDS:-2}"

CONFIRM_PRD_TO_STG_REFRESH="${CONFIRM_PRD_TO_STG_REFRESH:-}"
ALLOW_RAW_PRD_DATA_IN_STG="${ALLOW_RAW_PRD_DATA_IN_STG:-false}"
RAW_PRD_DATA_APPROVAL_REF="${RAW_PRD_DATA_APPROVAL_REF:-}"
STG_OUTBOUND_INTEGRATIONS_ISOLATED="${STG_OUTBOUND_INTEGRATIONS_ISOLATED:-false}"

PRD_DATABASE_URL="${PRD_DATABASE_URL:-}"
STG_DATABASE_URL="${STG_DATABASE_URL:-}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
MIGRATOR_DATABASE_URL=""
export -n PRD_DATABASE_URL STG_DATABASE_URL BACKUP_ENCRYPTION_KEY

RUN_DIR=""
ARCHIVE_PATH=""
ARCHIVE_CHECKSUM_PATH=""
ARCHIVE_CATALOG_PATH=""
BEFORE_RECEIPT=""
AFTER_RECEIPT=""
DEPLOYMENT_RECEIPT=""
SCALE_OBSERVATION_RECEIPT=""
STATE_RECEIPT=""
LEASE_FAILURE_FILE=""
RUN_PHASE_FILE=""

ARGOCD_POLICY_PAUSED=false
MAINTENANCE_FENCE_ACTIVE=false
WORKLOADS_SCALED=false
TARGET_MUTATED=false
RESTORE_VERIFIED=false
RESUMING_MAINTENANCE=false
TERMINAL_SUCCESS=false
ARGO_OPERATION_ACCEPTED=false
RUN_PHASE="initializing"
FAILURE_ORIGIN_PHASE=""
CLEANUP_INCOMPLETE=false

LEASE_ACQUIRED=false
LEASE_HOLDER_ID="prd-to-stg-refresh-$RUN_ID"
LEASE_RENEWAL_PID=""

ORIGINAL_AUTOMATED_SYNC=false
ORIGINAL_AUTOMATED_JSON="null"
ORIGINAL_SYNC_WINDOWS_JSON="[]"
PREFLIGHT_DEPLOYMENTS_JSON=""
ARGO_OPERATION_INITIATOR=""
ARGO_OPERATION_REVISION=""
PINNED_ARGOCD_REVISION=""
OBSERVED_MIGRATOR_IMAGE=""
OBSERVED_MIGRATOR_IMAGE_ID=""
OBSERVED_MIGRATOR_JOB_UID=""
OBSERVED_MIGRATOR_POD_UID=""
PRE_SYNC_MIGRATOR_JOB_UID=""
MIGRATOR_EVIDENCE_FILE=""
MIGRATOR_EVIDENCE_WATCH_PID=""

PRD_DB_HOST=""
PRD_DB_PORT=""
PRD_DB_NAME=""
STG_DB_HOST=""
STG_DB_PORT=""
STG_DB_NAME=""
PRD_DATABASE_IDENTITY=""
STG_DATABASE_IDENTITY=""
MIGRATOR_DATABASE_IDENTITY=""
PRD_MIGRATION_HISTORY=""
PRD_MIGRATION_FINGERPRINT=""
MIGRATED_MIGRATION_FINGERPRINT=""
MIGRATED_METADATA=""
POST_SYNC_DEPLOYMENTS_JSON=""

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
STG_AZURE_RESOURCE_ID=""
STG_AZURE_STORAGE_USED_BYTES=""
STG_AZURE_STORAGE_FREE_BYTES=""
STG_AZURE_TXLOG_STORAGE_BYTES=""
STG_AZURE_STORAGE_METRIC_TIME=""

STG_CONNECTED_ROLE=""
STG_PUBLIC_SCHEMA_OWNER=""
STG_CAN_CREATE_IN_PUBLIC=""
STG_SUPPORTED_OBJECT_COUNT=""
STG_UNOWNED_OBJECT_COUNT=""
STG_UNSUPPORTED_OBJECT_COUNT=""

print_help() {
  cat <<'EOF'
Usage: util/backup/refresh-stg-from-prd.sh

Copies the Klicker PRD PostgreSQL database to STG, then runs the existing
ArgoCD PreSync migration hook by patching the self-hosted app-klicker
Application resource through the Kubernetes API. The argocd CLI is not
required.

The script is read-only by default:

  ./util/backup/refresh-stg-from-prd.sh

Execution requires all five explicit gates:

  DRY_RUN=false \
  CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
  ALLOW_RAW_PRD_DATA_IN_STG=true \
  RAW_PRD_DATA_APPROVAL_REF=APPROVED-TICKET-OR-ADR \
  STG_OUTBOUND_INTEGRATIONS_ISOLATED=true \
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
  KUBECTL_REQUEST_TIMEOUT             default: 30s
  STG_STORAGE_GIB                     default: 32
  MAX_SOURCE_STORAGE_PERCENT          default: 75
  MIN_STG_FREE_SPACE_MULTIPLIER       default: 3
  REFRESH_LEASE_DURATION_SECONDS      default: 300
  REFRESH_LEASE_RENEW_INTERVAL_SECONDS default: 30
  REFRESH_LEASE_RENEW_RETRY_ATTEMPTS  default: 3
  REFRESH_LEASE_RENEW_RETRY_DELAY_SECONDS default: 2
  CLEANUP_TIMEOUT_SECONDS             default: 300
  MIGRATOR_EVIDENCE_TIMEOUT_SECONDS   default: 10
  RUN_ID                              unique receipt identifier
  RESUME_FAILED_RUN_ID                failed run receipt to resume while STG is stopped
  KEEP_ENCRYPTED_ARCHIVE              default: false

The Infisical environments/project/path, PRD and STG database endpoints, Azure
server, Kubernetes and ArgoCD identities, workload selector, migrator, Git
repository/revision, and Lease name are checked-in target constants. Ambient
environment variables cannot redefine them. Changing the target contract
requires a reviewed script change.

Failure after target mutation keeps the app-scoped ArgoCD deny window, disables
auto-sync, and stops STG workloads. If cleanup cannot prove every invariant,
state.json records cleanupIncomplete=true. If reset completed but restore did
not, do not submit an ArgoCD sync. Re-run with
RESUME_FAILED_RUN_ID=<failed-run-id>, a fresh RUN_ID, and the same five
execution gates after inspecting the retained receipt.
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

validate_raw_data_approval_ref() {
  [[ -z "$RAW_PRD_DATA_APPROVAL_REF" ]] && return 0
  local approval_ref_pattern='^[A-Za-z0-9][A-Za-z0-9._:/?&=%+#-]{0,199}$'
  [[ "$RAW_PRD_DATA_APPROVAL_REF" =~ $approval_ref_pattern ]] \
    || die "RAW_PRD_DATA_APPROVAL_REF must be a 1-200 character ticket, URL, or ADR reference without spaces"
}

# Focused modules keep destructive database, Kubernetes, and Argo behavior
# independently reviewable. Each module documents its shared-state contract.
# shellcheck source=refresh-stg-from-prd/database.sh
source "$SCRIPT_DIR/refresh-stg-from-prd/database.sh"
# shellcheck source=refresh-stg-from-prd/kubernetes.sh
source "$SCRIPT_DIR/refresh-stg-from-prd/kubernetes.sh"
# shellcheck source=refresh-stg-from-prd/argocd.sh
source "$SCRIPT_DIR/refresh-stg-from-prd/argocd.sh"

cleanup() {
  local exit_code="${1:-$?}"
  local cleanup_complete=true

  trap - EXIT INT TERM
  set +e
  stop_migrator_evidence_watch

  if [[ $exit_code -ne 0 ]]; then
    TERMINAL_SUCCESS=false
    FAILURE_ORIGIN_PHASE="$RUN_PHASE"
    log "Refresh failed during phase '$RUN_PHASE'; entering fail-safe cleanup"

    if [[ "$TARGET_MUTATED" == "true" ]]; then
      establish_fail_safe_maintenance || cleanup_complete=false
    else
      if [[ "$ARGOCD_POLICY_PAUSED" == "true" ]]; then
        restore_original_workloads_for_cleanup || cleanup_complete=false
        restore_original_argocd_policy_for_cleanup || cleanup_complete=false
      fi
      if [[ "$MAINTENANCE_FENCE_ACTIVE" == "true" ]]; then
        remove_argocd_maintenance_fence || cleanup_complete=false
      fi
    fi

    if [[ "$cleanup_complete" == "true" ]]; then
      CLEANUP_INCOMPLETE=false
      set_run_phase failed
    else
      CLEANUP_INCOMPLETE=true
      set_run_phase cleanup-incomplete
    fi
  fi

  if [[ "$CLEANUP_INCOMPLETE" == "true" ]]; then
    stop_refresh_lease_renewal
    log "CRITICAL: Cleanup is incomplete; the Lease was not released and will expire naturally."
  else
    release_refresh_lease
  fi

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

  unset PRD_DATABASE_URL STG_DATABASE_URL BACKUP_ENCRYPTION_KEY \
    MIGRATOR_DATABASE_URL

  if [[ $exit_code -ne 0 && "$TARGET_MUTATED" == "true" ]]; then
    if [[ "$CLEANUP_INCOMPLETE" == "true" ]]; then
      log "CRITICAL: STG safety could not be fully proven. Treat the environment as unavailable and inspect state.json."
      log "Do not remove the AppProject deny window or re-enable workloads until ArgoCD is terminal, automated sync is disabled, and every selected Deployment is at zero replicas."
    else
      log "Verified fail-safe maintenance: the app-scoped ArgoCD deny window is active, automated sync is disabled, no operation is active, and all selected Deployments are at zero replicas."
    fi
    log "The STG database was modified; inspect restore and migration state before recovery."
    if [[ "$RESTORE_VERIFIED" != "true" ]]; then
      local resumable_run_id=""
      if [[ -n "$BEFORE_RECEIPT" && -s "$BEFORE_RECEIPT" ]]; then
        resumable_run_id="$RUN_ID"
      elif [[ -n "$RESUME_FAILED_RUN_ID" ]]; then
        resumable_run_id="$RESUME_FAILED_RUN_ID"
      fi
      log "Do not submit an ArgoCD sync: a complete restored database has not been verified."
      if [[ -n "$resumable_run_id" ]]; then
        log "Retry the refresh with RESUME_FAILED_RUN_ID=$resumable_run_id, a fresh RUN_ID, and all five execution gates."
      else
        log "No resumable before receipt exists; inspect STG and restore it before re-enabling workloads."
      fi
    else
      log "Resume through this script with RESUME_FAILED_RUN_ID; it removes the deny window only after another verified restore and then submits the pinned Argo operation atomically."
    fi
  fi

  exit "$exit_code"
}

trap cleanup EXIT
trap 'cleanup 130' INT
trap 'cleanup 143' TERM

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
    --arg sourcePort "$PRD_DB_PORT" \
    --arg sourceDatabase "$PRD_DB_NAME" \
    --arg sourceMigrationFingerprint "$PRD_MIGRATION_FINGERPRINT" \
    --arg targetHost "$STG_DB_HOST" \
    --arg targetPort "$STG_DB_PORT" \
    --arg targetDatabase "$STG_DB_NAME" \
    --arg kubeSystemUid "$EXPECTED_KUBE_SYSTEM_UID" \
    --arg workloadNamespace "$WORKLOAD_NAMESPACE" \
    --arg workloadNamespaceUid "$EXPECTED_WORKLOAD_NAMESPACE_UID" \
    --arg argocdApplicationUid "$EXPECTED_ARGOCD_APP_UID" \
    --arg argocdProject "$EXPECTED_ARGOCD_PROJECT" \
    --arg argocdProjectUid "$EXPECTED_ARGOCD_PROJECT_UID" \
    --arg argocdRevision "$PINNED_ARGOCD_REVISION" \
    '
      .runId == $runId and
      .source.host == $sourceHost and
      .source.port == $sourcePort and
      .source.database == $sourceDatabase and
      .source.migrationFingerprint == $sourceMigrationFingerprint and
      .targetBefore.host == $targetHost and
      .targetBefore.port == $targetPort and
      .targetBefore.database == $targetDatabase and
      .kubernetes.kubeSystemUid == $kubeSystemUid and
      .kubernetes.workloadNamespace == $workloadNamespace and
      .kubernetes.workloadNamespaceUid == $workloadNamespaceUid and
      .kubernetes.argocdApplicationUid == $argocdApplicationUid and
      .kubernetes.argocdProject == $argocdProject and
      .kubernetes.argocdProjectUid == $argocdProjectUid and
      .argocdRevision == $argocdRevision and
      (.argocdProjectOriginalSyncWindows | type) == "array" and
      (.argocdAutomatedPolicy | type) == "object" and
      ((.argocdAutomatedPolicy.enabled // true) != false)
    ' "$failed_before_receipt" >/dev/null \
    || die "Resume receipt does not match the current source, target, or prior automated-sync state"

  local failed_deployments_json receipt_deployments_json
  failed_deployments_json="$(jq -c '.deployments | sort_by(.namespace, .name)' "$failed_before_receipt")"
  receipt_deployments_json="$(
    jq -Rsc '
      split("\n") | map(select(length > 0) | split("\t") |
        {namespace: .[0], name: .[1], replicas: (.[2] | tonumber)}) |
      sort_by(.namespace, .name)
    ' <"$failed_deployment_receipt"
  )"
  [[ "$failed_deployments_json" == "$receipt_deployments_json" ]] \
    || die "Resume Deployment receipt does not match the failed-run before receipt"

  ORIGINAL_AUTOMATED_JSON="$(jq -c '.argocdAutomatedPolicy' "$failed_before_receipt")"
  ORIGINAL_SYNC_WINDOWS_JSON="$(jq -c '.argocdProjectOriginalSyncWindows' "$failed_before_receipt")"
  ORIGINAL_AUTOMATED_SYNC=true
  RESUMING_MAINTENANCE=true
  ARGOCD_POLICY_PAUSED=true
}

print_preflight_summary() {
  local deployment_count="$1"
  log "Preflight complete"
  log "Source: $PRD_DB_HOST/$PRD_DB_NAME (PostgreSQL $((PRD_VERSION_NUM / 10000)), $PRD_SIZE_BYTES bytes, $PRD_TABLE_COUNT tables)"
  log "Target: $STG_DB_HOST/$STG_DB_NAME (PostgreSQL $((STG_BEFORE_VERSION_NUM / 10000)), current size $STG_BEFORE_SIZE_BYTES bytes)"
  log "ArgoCD Application: $ARGOCD_NAMESPACE/$ARGOCD_APP via context $ARGOCD_KUBE_CONTEXT"
  log "Pinned ArgoCD revision: $PINNED_ARGOCD_REVISION"
  log "STG deployments to stop: $deployment_count"
  while IFS= read -r deployment; do
    [[ -z "$deployment" ]] || log "  - $deployment"
  done < <(
    jq -r '.items[] | "\(.metadata.namespace)/deployment/\(.metadata.name)"' \
      <<<"$PREFLIGHT_DEPLOYMENTS_JSON" | sort
  )
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
  SCALE_OBSERVATION_RECEIPT="$RUN_DIR/scale-observations.tsv"
  STATE_RECEIPT="$RUN_DIR/state.json"
  LEASE_FAILURE_FILE="$RUN_DIR/lease-renewal-failed"
  RUN_PHASE_FILE="$RUN_DIR/phase"
  MIGRATOR_EVIDENCE_FILE="$RUN_DIR/migrator-evidence.json"

  [[ ! -e "$RUN_DIR" ]] || die "Run directory already exists; choose a new RUN_ID: $RUN_DIR"
  mkdir -p "$RUN_DIR"
  chmod 700 "$RUN_DIR"
}

set_run_phase() {
  local phase="$1"
  RUN_PHASE="$phase"
  if [[ -n "$RUN_PHASE_FILE" ]]; then
    local temporary_phase_file="$RUN_PHASE_FILE.tmp"
    printf '%s\n' "$RUN_PHASE" >"$temporary_phase_file"
    mv -- "$temporary_phase_file" "$RUN_PHASE_FILE"
  fi
  [[ -n "$STATE_RECEIPT" ]] || return 0
  local temporary_receipt="$STATE_RECEIPT.tmp"
  jq -n \
    --arg runId "$RUN_ID" \
    --arg phase "$RUN_PHASE" \
    --arg failedFromPhase "$FAILURE_ORIGIN_PHASE" \
    --arg updatedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg targetHost "$STG_DB_HOST" \
    --arg targetPort "$STG_DB_PORT" \
    --arg targetDatabase "$STG_DB_NAME" \
    --arg approvalRef "$RAW_PRD_DATA_APPROVAL_REF" \
    --arg leaseHolder "$LEASE_HOLDER_ID" \
    --arg argoInitiator "$ARGO_OPERATION_INITIATOR" \
    --arg pinnedArgoRevision "$PINNED_ARGOCD_REVISION" \
    --arg argoRevision "$ARGO_OPERATION_REVISION" \
    --arg migratorImage "$OBSERVED_MIGRATOR_IMAGE" \
    --arg migratorImageId "$OBSERVED_MIGRATOR_IMAGE_ID" \
    --arg migratorJobUid "$OBSERVED_MIGRATOR_JOB_UID" \
    --arg migratorPodUid "$OBSERVED_MIGRATOR_POD_UID" \
    --argjson targetMutated "$TARGET_MUTATED" \
    --argjson restoreVerified "$RESTORE_VERIFIED" \
    --argjson maintenanceFenceActive "$MAINTENANCE_FENCE_ACTIVE" \
    --argjson cleanupIncomplete "$CLEANUP_INCOMPLETE" \
    --argjson outboundIntegrationsIsolated "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" \
    --argjson terminalSuccess "$TERMINAL_SUCCESS" \
    '{
      runId: $runId,
      phase: $phase,
      failedFromPhase: (if $failedFromPhase == "" then null else $failedFromPhase end),
      updatedAt: $updatedAt,
      target: {
        host: $targetHost,
        port: $targetPort,
        database: $targetDatabase
      },
      governance: {
        rawPrdDataApprovalRef: $approvalRef,
        stgOutboundIntegrationsIsolated: $outboundIntegrationsIsolated
      },
      leaseHolder: $leaseHolder,
      argoOperation: {
        initiator: (if $argoInitiator == "" then null else $argoInitiator end),
        pinnedRevision: (if $pinnedArgoRevision == "" then null else $pinnedArgoRevision end),
        revision: (if $argoRevision == "" then null else $argoRevision end),
        migratorImage: (if $migratorImage == "" then null else $migratorImage end),
        migratorImageId: (if $migratorImageId == "" then null else $migratorImageId end),
        migratorJobUid: (if $migratorJobUid == "" then null else $migratorJobUid end),
        migratorPodUid: (if $migratorPodUid == "" then null else $migratorPodUid end)
      },
      targetMutated: $targetMutated,
      restoreVerified: $restoreVerified,
      maintenanceFenceActive: $maintenanceFenceActive,
      cleanupIncomplete: $cleanupIncomplete,
      terminalSuccess: $terminalSuccess
    }' >"$temporary_receipt"
  mv -- "$temporary_receipt" "$STATE_RECEIPT"
}

prepare_deployment_receipt() {
  if [[ -n "$RESUME_FAILED_RUN_ID" ]]; then
    local failed_receipt="$REFRESH_ROOT_DIR/$RESUME_FAILED_RUN_ID/deployments.tsv"
    cp -- "$failed_receipt" "$DEPLOYMENT_RECEIPT"
  else
    jq -r '.items[] | [.metadata.namespace, .metadata.name, (.spec.replicas // 1)] | @tsv' \
      <<<"$PREFLIGHT_DEPLOYMENTS_JSON" | sort >"$DEPLOYMENT_RECEIPT"
  fi
  [[ -s "$DEPLOYMENT_RECEIPT" ]] || die "Deployment receipt is empty"
}

deployment_receipt_json() {
  jq -Rn '
    [inputs | select(length > 0) | split("\t") |
      {namespace: .[0], name: .[1], replicas: (.[2] | tonumber)}]
    | sort_by(.namespace, .name)
  ' <"$DEPLOYMENT_RECEIPT"
}

write_before_receipt() {
  local archive_checksum deployments_json
  archive_checksum="$(awk '{print $1}' "$ARCHIVE_CHECKSUM_PATH")"
  deployments_json="$(deployment_receipt_json)"

  jq -n \
    --arg runId "$RUN_ID" \
    --arg resumedFromRunId "$RESUME_FAILED_RUN_ID" \
    --arg createdAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg sourceHost "$PRD_DB_HOST" \
    --arg sourcePort "$PRD_DB_PORT" \
    --arg sourceDatabase "$PRD_DB_NAME" \
    --arg sourceMigrationFingerprint "$PRD_MIGRATION_FINGERPRINT" \
    --arg targetHost "$STG_DB_HOST" \
    --arg targetPort "$STG_DB_PORT" \
    --arg targetDatabase "$STG_DB_NAME" \
    --arg approvalRef "$RAW_PRD_DATA_APPROVAL_REF" \
    --arg kubeSystemUid "$EXPECTED_KUBE_SYSTEM_UID" \
    --arg workloadNamespace "$WORKLOAD_NAMESPACE" \
    --arg workloadNamespaceUid "$EXPECTED_WORKLOAD_NAMESPACE_UID" \
    --arg argocdApplicationUid "$EXPECTED_ARGOCD_APP_UID" \
    --arg argocdProject "$EXPECTED_ARGOCD_PROJECT" \
    --arg argocdProjectUid "$EXPECTED_ARGOCD_PROJECT_UID" \
    --arg argocdRevision "$PINNED_ARGOCD_REVISION" \
    --arg archiveSha256 "$archive_checksum" \
    --arg azureResourceId "$STG_AZURE_RESOURCE_ID" \
    --arg azureMetricTime "$STG_AZURE_STORAGE_METRIC_TIME" \
    --argjson sourceSizeBytes "$PRD_SIZE_BYTES" \
    --argjson sourceTableCount "$PRD_TABLE_COUNT" \
    --argjson sourceAppliedMigrations "$PRD_APPLIED_MIGRATIONS" \
    --argjson targetBeforeSizeBytes "$STG_BEFORE_SIZE_BYTES" \
    --argjson targetBeforeTableCount "$STG_BEFORE_TABLE_COUNT" \
    --argjson targetBeforeAppliedMigrations "$STG_BEFORE_APPLIED_MIGRATIONS" \
    --argjson azureStorageUsedBytes "$STG_AZURE_STORAGE_USED_BYTES" \
    --argjson azureStorageFreeBytes "$STG_AZURE_STORAGE_FREE_BYTES" \
    --argjson azureTxlogStorageBytes "$STG_AZURE_TXLOG_STORAGE_BYTES" \
    --argjson argocdAutomatedPolicy "$ORIGINAL_AUTOMATED_JSON" \
    --argjson argocdProjectOriginalSyncWindows "$ORIGINAL_SYNC_WINDOWS_JSON" \
    --argjson deployments "$deployments_json" \
    --argjson outboundIntegrationsIsolated "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" \
    '{
      runId: $runId,
      resumedFromRunId: (if $resumedFromRunId == "" then null else $resumedFromRunId end),
      createdAt: $createdAt,
      source: {
        host: $sourceHost,
        port: $sourcePort,
        database: $sourceDatabase,
        sizeBytes: $sourceSizeBytes,
        tableCount: $sourceTableCount,
        appliedMigrations: $sourceAppliedMigrations,
        migrationFingerprint: $sourceMigrationFingerprint
      },
      targetBefore: {
        host: $targetHost,
        port: $targetPort,
        database: $targetDatabase,
        sizeBytes: $targetBeforeSizeBytes,
        tableCount: $targetBeforeTableCount,
        appliedMigrations: $targetBeforeAppliedMigrations,
        azureStorage: {
          resourceId: $azureResourceId,
          measuredAt: $azureMetricTime,
          usedBytes: $azureStorageUsedBytes,
          freeBytes: $azureStorageFreeBytes,
          transactionLogBytes: $azureTxlogStorageBytes
        }
      },
      governance: {
        rawPrdDataApprovalRef: $approvalRef,
        stgOutboundIntegrationsIsolated: $outboundIntegrationsIsolated
      },
      kubernetes: {
        kubeSystemUid: $kubeSystemUid,
        workloadNamespace: $workloadNamespace,
        workloadNamespaceUid: $workloadNamespaceUid,
        argocdApplicationUid: $argocdApplicationUid,
        argocdProject: $argocdProject,
        argocdProjectUid: $argocdProjectUid
      },
      argocdRevision: $argocdRevision,
      deployments: $deployments,
      archiveSha256: $archiveSha256,
      argocdAutomatedPolicy: $argocdAutomatedPolicy,
      argocdProjectOriginalSyncWindows: $argocdProjectOriginalSyncWindows
    }' >"$BEFORE_RECEIPT"
}

write_after_receipt() {
  local database_name version_num size_bytes table_count applied_migrations
  local failed_migrations extra_schema_count large_object_count deployments_json
  IFS='|' read -r database_name version_num size_bytes table_count applied_migrations \
    failed_migrations extra_schema_count large_object_count <<<"$MIGRATED_METADATA"
  deployments_json="$(
    jq -c '[.items[] | {
      namespace: .metadata.namespace,
      name: .metadata.name,
      desiredReplicas: (.spec.replicas // 1),
      readyReplicas: (.status.readyReplicas // 0),
      observedGeneration: (.status.observedGeneration // 0)
    }] | sort_by(.namespace, .name)' <<<"$POST_SYNC_DEPLOYMENTS_JSON"
  )"

  local temporary_receipt="$AFTER_RECEIPT.tmp"
  jq -n \
    --arg runId "$RUN_ID" \
    --arg completedAt "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    --arg targetHost "$STG_DB_HOST" \
    --arg targetPort "$STG_DB_PORT" \
    --arg targetDatabase "$database_name" \
    --arg approvalRef "$RAW_PRD_DATA_APPROVAL_REF" \
    --arg migrationFingerprint "$MIGRATED_MIGRATION_FINGERPRINT" \
    --arg argocdRevision "$ARGO_OPERATION_REVISION" \
    --arg migratorImage "$OBSERVED_MIGRATOR_IMAGE" \
    --arg migratorImageId "$OBSERVED_MIGRATOR_IMAGE_ID" \
    --arg migratorJobUid "$OBSERVED_MIGRATOR_JOB_UID" \
    --arg migratorPodUid "$OBSERVED_MIGRATOR_POD_UID" \
    --argjson targetSizeBytes "$size_bytes" \
    --argjson targetTableCount "$table_count" \
    --argjson targetAppliedMigrations "$applied_migrations" \
    --argjson deployments "$deployments_json" \
    --argjson outboundIntegrationsIsolated "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" \
    '{
      runId: $runId,
      completedAt: $completedAt,
      terminalSuccess: true,
      targetAfter: {
        host: $targetHost,
        port: $targetPort,
        database: $targetDatabase,
        sizeBytes: $targetSizeBytes,
        tableCount: $targetTableCount,
        appliedMigrations: $targetAppliedMigrations,
        unresolvedMigrations: 0,
        migrationFingerprint: $migrationFingerprint
      },
      governance: {
        rawPrdDataApprovalRef: $approvalRef,
        stgOutboundIntegrationsIsolated: $outboundIntegrationsIsolated
      },
      argocd: {
        revision: $argocdRevision,
        migratorImage: $migratorImage,
        migratorImageId: $migratorImageId,
        migratorJobUid: $migratorJobUid,
        migratorPodUid: $migratorPodUid,
        sync: "Synced",
        health: "Healthy",
        originalPolicyRestored: true
      },
      deployments: $deployments
    }' >"$temporary_receipt"
  mv -- "$temporary_receipt" "$AFTER_RECEIPT"
}

validate_configuration() {
  validate_boolean DRY_RUN "$DRY_RUN"
  validate_boolean KEEP_ENCRYPTED_ARCHIVE "$KEEP_ENCRYPTED_ARCHIVE"
  validate_boolean ALLOW_RAW_PRD_DATA_IN_STG "$ALLOW_RAW_PRD_DATA_IN_STG"
  validate_boolean STG_OUTBOUND_INTEGRATIONS_ISOLATED "$STG_OUTBOUND_INTEGRATIONS_ISOLATED"
  validate_raw_data_approval_ref
  validate_positive_integer STG_STORAGE_GIB "$STG_STORAGE_GIB"
  validate_positive_integer MAX_SOURCE_STORAGE_PERCENT "$MAX_SOURCE_STORAGE_PERCENT"
  validate_positive_integer MIN_STG_FREE_SPACE_MULTIPLIER "$MIN_STG_FREE_SPACE_MULTIPLIER"
  validate_positive_integer ARGOCD_TIMEOUT_SECONDS "$ARGOCD_TIMEOUT_SECONDS"
  validate_positive_integer ARGOCD_POLL_SECONDS "$ARGOCD_POLL_SECONDS"
  validate_positive_integer WORKLOAD_DRAIN_TIMEOUT_SECONDS "$WORKLOAD_DRAIN_TIMEOUT_SECONDS"
  validate_positive_integer POST_SYNC_HEALTH_TIMEOUT_SECONDS "$POST_SYNC_HEALTH_TIMEOUT_SECONDS"
  validate_positive_integer CLEANUP_TIMEOUT_SECONDS "$CLEANUP_TIMEOUT_SECONDS"
  validate_positive_integer MIGRATOR_EVIDENCE_TIMEOUT_SECONDS "$MIGRATOR_EVIDENCE_TIMEOUT_SECONDS"
  validate_positive_integer REFRESH_LEASE_DURATION_SECONDS "$REFRESH_LEASE_DURATION_SECONDS"
  validate_positive_integer REFRESH_LEASE_RENEW_INTERVAL_SECONDS "$REFRESH_LEASE_RENEW_INTERVAL_SECONDS"
  validate_positive_integer REFRESH_LEASE_RENEW_RETRY_ATTEMPTS "$REFRESH_LEASE_RENEW_RETRY_ATTEMPTS"
  validate_positive_integer REFRESH_LEASE_RENEW_RETRY_DELAY_SECONDS "$REFRESH_LEASE_RENEW_RETRY_DELAY_SECONDS"
  validate_run_id
  validate_resume_failed_run_id
  (( STG_STORAGE_GIB > 0 )) || die "STG_STORAGE_GIB must be greater than zero"
  (( MIN_STG_FREE_SPACE_MULTIPLIER >= 2 )) \
    || die "MIN_STG_FREE_SPACE_MULTIPLIER must be at least 2"
  (( ARGOCD_TIMEOUT_SECONDS > 0 )) || die "ARGOCD_TIMEOUT_SECONDS must be greater than zero"
  (( ARGOCD_POLL_SECONDS > 0 )) || die "ARGOCD_POLL_SECONDS must be greater than zero"
  (( WORKLOAD_DRAIN_TIMEOUT_SECONDS > 0 )) \
    || die "WORKLOAD_DRAIN_TIMEOUT_SECONDS must be greater than zero"
  (( POST_SYNC_HEALTH_TIMEOUT_SECONDS > 0 )) \
    || die "POST_SYNC_HEALTH_TIMEOUT_SECONDS must be greater than zero"
  (( REFRESH_LEASE_RENEW_INTERVAL_SECONDS > 0 )) \
    || die "REFRESH_LEASE_RENEW_INTERVAL_SECONDS must be greater than zero"
  (( REFRESH_LEASE_RENEW_RETRY_ATTEMPTS > 0 )) \
    || die "REFRESH_LEASE_RENEW_RETRY_ATTEMPTS must be greater than zero"
  (( REFRESH_LEASE_DURATION_SECONDS > REFRESH_LEASE_RENEW_INTERVAL_SECONDS * 2 )) \
    || die "REFRESH_LEASE_DURATION_SECONDS must exceed twice the renewal interval"
  (( MAX_SOURCE_STORAGE_PERCENT > 0 && MAX_SOURCE_STORAGE_PERCENT <= 95 )) \
    || die "MAX_SOURCE_STORAGE_PERCENT must be between 1 and 95"
  [[ "$KUBECTL_REQUEST_TIMEOUT" =~ ^[1-9][0-9]*[smh]$ ]] \
    || die "KUBECTL_REQUEST_TIMEOUT must be a positive Kubernetes duration such as 30s"
  local kubectl_timeout_magnitude="${KUBECTL_REQUEST_TIMEOUT%?}"
  local kubectl_timeout_multiplier
  case "${KUBECTL_REQUEST_TIMEOUT: -1}" in
    s) kubectl_timeout_multiplier=1 ;;
    m) kubectl_timeout_multiplier=60 ;;
    h) kubectl_timeout_multiplier=3600 ;;
  esac
  local kubectl_timeout_seconds=$((
    kubectl_timeout_magnitude * kubectl_timeout_multiplier
  ))
  local lease_renewal_failure_budget=$((
    REFRESH_LEASE_RENEW_INTERVAL_SECONDS +
      REFRESH_LEASE_RENEW_RETRY_ATTEMPTS * kubectl_timeout_seconds * 2 +
      (REFRESH_LEASE_RENEW_RETRY_ATTEMPTS - 1) *
        REFRESH_LEASE_RENEW_RETRY_DELAY_SECONDS
  ))
  (( REFRESH_LEASE_DURATION_SECONDS > lease_renewal_failure_budget )) \
    || die "REFRESH_LEASE_DURATION_SECONDS must exceed the worst-case Lease renewal retry window ($lease_renewal_failure_budget seconds)"

  local required_value
  for required_value in \
    "$EXPECTED_PRD_DB_HOST" "$EXPECTED_STG_DB_HOST" \
    "$EXPECTED_PRD_DB_PORT" "$EXPECTED_STG_DB_PORT" \
    "$EXPECTED_PRD_DB_NAME" "$EXPECTED_STG_DB_NAME" \
    "$KUBE_CONTEXT" "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" \
    "$ARGOCD_APP" "$WORKLOAD_NAMESPACE" "$EXPECTED_KUBE_TLS_SERVER_NAME" \
    "$EXPECTED_KUBE_SYSTEM_UID" "$EXPECTED_WORKLOAD_NAMESPACE_UID" \
    "$EXPECTED_ARGOCD_APP_UID" "$MIGRATOR_SECRET_NAME" \
    "$MIGRATOR_SECRET_KEY" "$MIGRATOR_JOB_NAME" \
    "$EXPECTED_MIGRATOR_IMAGE_REPOSITORY" "$STG_AZURE_RESOURCE_GROUP" \
    "$STG_AZURE_SERVER_NAME"; do
    [[ -n "$required_value" ]] \
      || die "Pinned target configuration values must not be empty"
  done
}

validate_execution_gates() {
  [[ "$DRY_RUN" == "false" ]] || return 0

  [[ "$CONFIRM_PRD_TO_STG_REFRESH" == "ERASE_STG_AND_COPY_PRD" ]] \
    || die "Execution requires CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD"
  [[ "$ALLOW_RAW_PRD_DATA_IN_STG" == "true" ]] \
    || die "Execution requires ALLOW_RAW_PRD_DATA_IN_STG=true"
  [[ -n "$RAW_PRD_DATA_APPROVAL_REF" ]] \
    || die "Execution requires RAW_PRD_DATA_APPROVAL_REF=<approved-ticket-or-ADR>"
  [[ "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" == "true" ]] \
    || die "Execution requires STG_OUTBOUND_INTEGRATIONS_ISOLATED=true"
}

validate_tools() {
  local tools=(az awk base64 cat chmod cp gpg grep jq kubectl mkdir mv node pg_dump pg_restore psql rm sed shasum sort)
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
  load_database_identity PRD_DATABASE_IDENTITY "$PRD_DATABASE_URL" PRD
  load_database_identity STG_DATABASE_IDENTITY "$STG_DATABASE_URL" STG
  [[ "$PRD_DATABASE_IDENTITY" != "$STG_DATABASE_IDENTITY" ]] \
    || die "PRD and STG database identities unexpectedly match"
  load_migration_history PRD_MIGRATION_HISTORY PRD_MIGRATION_FINGERPRINT \
    "$PRD_DATABASE_URL" PRD
  validate_stg_reset_capabilities
  validate_client_and_capacity
  validate_azure_storage_headroom
  validate_kubernetes_target
  validate_kubernetes_permissions
  load_migrator_database_url
  validate_migrator_target
  load_argocd_state
  load_argocd_project_state

  local deployments_json
  deployments_json="$(load_workload_state)"
  PREFLIGHT_DEPLOYMENTS_JSON="$deployments_json"
  validate_resume_workload_state "$deployments_json"
  local deployment_count
  deployment_count="$(jq '.items | length' <<<"$deployments_json")"
  print_preflight_summary "$deployment_count"

  if [[ "$DRY_RUN" == "true" ]]; then
    log "DRY_RUN=true: no dump was created and no external state was changed."
    log "Re-run with the five documented execution gates after reviewing this plan."
    return 0
  fi

  prepare_run_directory
  set_run_phase prepared
  acquire_refresh_lease
  start_refresh_lease_renewal
  prepare_deployment_receipt
  encrypt_prd_dump
  write_before_receipt
  set_run_phase dump-verified

  pause_argocd_policy
  scale_stg_workloads_down
  install_argocd_maintenance_fence \
    || die "Could not install the app-scoped ArgoCD maintenance fence"

  # Re-verify the pause and persistent deny window immediately before mutation.
  assert_refresh_lease
  assert_argocd_quiescent

  reset_stg_owned_objects
  restore_stg_database
  local restored_metadata
  load_database_metadata restored_metadata "$STG_DATABASE_URL" STG
  validate_restored_snapshot "$restored_metadata"
  validate_restored_migration_history
  RESTORE_VERIFIED=true
  set_run_phase restore-verified

  remove_argocd_maintenance_fence \
    || die "Could not remove the maintenance fence before the owned sync"
  run_presync_hook
  local migrated_metadata
  load_database_metadata migrated_metadata "$STG_DATABASE_URL" STG
  validate_migrated_target "$migrated_metadata"
  restore_argocd_policy
  wait_for_post_sync_health true

  TERMINAL_SUCCESS=true
  set_run_phase completed
  write_after_receipt
  log "PRD-to-STG database refresh completed successfully"
  log "Receipts: $BEFORE_RECEIPT and $AFTER_RECEIPT"
  log "Application-level validation is still required before STG is declared usable."
  log "Verify the ArgoCD Application and migrator logs, backend behavior, outbound isolation, and one isolated synthetic STG request."
  if [[ "$KEEP_ENCRYPTED_ARCHIVE" == "true" ]]; then
    log "Encrypted archive retained at: $ARCHIVE_PATH"
  else
    log "Encrypted archive will be removed during cleanup"
  fi
}

main "$@"
