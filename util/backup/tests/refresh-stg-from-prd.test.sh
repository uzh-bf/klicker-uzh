#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
while [[ -L "$SCRIPT_SOURCE" ]]; do
  SOURCE_DIR="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)"
  SCRIPT_SOURCE="$(readlink "$SCRIPT_SOURCE")"
  [[ "$SCRIPT_SOURCE" == /* ]] || SCRIPT_SOURCE="$SOURCE_DIR/$SCRIPT_SOURCE"
done
TEST_SCRIPT="$(cd "$(dirname "$SCRIPT_SOURCE")" && pwd)/$(basename "$SCRIPT_SOURCE")"
SCRIPT_UNDER_TEST="$(cd "$(dirname "$TEST_SCRIPT")/.." && pwd)/refresh-stg-from-prd.sh"

# shellcheck source=refresh-stg-from-prd/fakes.sh
source "$(cd "$(dirname "$TEST_SCRIPT")" && pwd)/refresh-stg-from-prd/fakes.sh"

if [[ "$(basename "$0")" != "$(basename "$TEST_SCRIPT")" ]]; then
  dispatch_fake_tool "$@"
  exit
fi

TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/refresh-stg-from-prd-test.XXXXXX")"
cleanup_test_tmp() {
  if [[ "${KEEP_TEST_TMP:-false}" == true ]]; then
    printf 'retained test artifacts: %s\n' "$TEST_TMP" >&2
  else
    rm -rf -- "$TEST_TMP"
  fi
}
trap cleanup_test_tmp EXIT

PASS_COUNT=0
FAIL_COUNT=0
TEST_COUNT=0

pass() {
  TEST_COUNT=$((TEST_COUNT + 1))
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'ok %s - %s\n' "$TEST_COUNT" "$1"
}

fail() {
  TEST_COUNT=$((TEST_COUNT + 1))
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf 'not ok %s - %s\n' "$TEST_COUNT" "$1" >&2
  sed -n '1,160p' "$OUTPUT_FILE" >&2
}

assert_contains() {
  grep -Fq -- "$2" "$1"
}

assert_not_contains() {
  ! grep -Fq -- "$2" "$1"
}

assert_before() {
  local first_line second_line
  first_line="$(grep -nF -- "$2" "$1" | head -1 | cut -d: -f1)"
  second_line="$(grep -nF -- "$3" "$1" | head -1 | cut -d: -f1)"
  [[ -n "$first_line" && -n "$second_line" && "$first_line" -lt "$second_line" ]]
}

new_case() {
  CASE_DIR="$TEST_TMP/$1"
  FAKE_BIN="$CASE_DIR/bin"
  FAKE_LOG="$CASE_DIR/fake.log"
  FAKE_STATE_DIR="$CASE_DIR/state"
  FAKE_ARGO_POLICY_FILE="$FAKE_STATE_DIR/argocd-policy"
  FAKE_PROJECT_FILE="$FAKE_STATE_DIR/argocd-project.json"
  FAKE_OPERATION_FILE="$FAKE_STATE_DIR/argocd-operation"
  FAKE_SYNCED_FILE="$FAKE_STATE_DIR/synced"
  FAKE_TERMINATED_FILE="$FAKE_STATE_DIR/terminated"
  FAKE_LEASE_FILE="$FAKE_STATE_DIR/lease.json"
  FAKE_LEASE_READS_FILE="$FAKE_STATE_DIR/lease-reads"
  FAKE_RESTORED_FILE="$FAKE_STATE_DIR/restored"
  OUTPUT_FILE="$CASE_DIR/output.log"
  REFRESH_DIR="$CASE_DIR/refreshes"
  mkdir -p "$FAKE_BIN" "$FAKE_STATE_DIR"
  : >"$FAKE_LOG"
  printf '%s' automated >"$FAKE_ARGO_POLICY_FILE"
  printf '%s\n' '{"metadata":{"uid":"6faae3ef-2736-45ee-a2d5-8fd4cfd41b16","resourceVersion":"7"},"spec":{"syncWindows":[]}}' \
    >"$FAKE_PROJECT_FILE"
  local tool
  for tool in az gpg infisical kubectl pg_dump pg_restore psql; do
    ln -s "$TEST_SCRIPT" "$FAKE_BIN/$tool"
  done
}

run_refresh() {
  local prd_url stg_url
  prd_url="${PRD_DATABASE_URL_OVERRIDE-$(prd_database_url)}"
  stg_url="${STG_DATABASE_URL_OVERRIDE-$(stg_database_url)}"
  env \
    PATH="$FAKE_BIN:$PATH" \
    FAKE_LOG="$FAKE_LOG" \
    FAKE_STATE_DIR="$FAKE_STATE_DIR" \
    FAKE_ARGO_POLICY_FILE="$FAKE_ARGO_POLICY_FILE" \
    FAKE_PROJECT_FILE="$FAKE_PROJECT_FILE" \
    FAKE_OPERATION_FILE="$FAKE_OPERATION_FILE" \
    FAKE_SYNCED_FILE="$FAKE_SYNCED_FILE" \
    FAKE_TERMINATED_FILE="$FAKE_TERMINATED_FILE" \
    FAKE_LEASE_FILE="$FAKE_LEASE_FILE" \
    FAKE_RESTORED_FILE="$FAKE_RESTORED_FILE" \
    FAKE_PG_RESTORE_FAIL="${FAKE_PG_RESTORE_FAIL:-false}" \
    FAKE_PSQL_CONNECT_FAIL="${FAKE_PSQL_CONNECT_FAIL:-false}" \
    FAKE_ARGO_SYNC_FAIL="${FAKE_ARGO_SYNC_FAIL:-false}" \
    FAKE_ARGO_TIMEOUT="${FAKE_ARGO_TIMEOUT:-false}" \
    FAKE_CLUSTER_MISMATCH="${FAKE_CLUSTER_MISMATCH:-false}" \
    FAKE_RBAC_DENY="${FAKE_RBAC_DENY:-false}" \
    FAKE_MIGRATOR_MISMATCH="${FAKE_MIGRATOR_MISMATCH:-false}" \
    FAKE_PARTIAL_SCALE_FAIL="${FAKE_PARTIAL_SCALE_FAIL:-false}" \
    FAKE_POST_SYNC_METADATA_FAIL="${FAKE_POST_SYNC_METADATA_FAIL:-false}" \
    FAKE_POLICY_RESTORE_FAIL="${FAKE_POLICY_RESTORE_FAIL:-false}" \
    FAKE_MIGRATION_DIVERGENCE="${FAKE_MIGRATION_DIVERGENCE:-false}" \
    FAKE_HEALTH_FAIL="${FAKE_HEALTH_FAIL:-false}" \
    FAKE_STORAGE_LOW="${FAKE_STORAGE_LOW:-false}" \
    FAKE_LEASE_LOSS="${FAKE_LEASE_LOSS:-false}" \
    FAKE_COMPETING_SYNC="${FAKE_COMPETING_SYNC:-false}" \
    FAKE_CAS_RACE="${FAKE_CAS_RACE:-false}" \
    FAKE_CLEANUP_FENCE_FAIL="${FAKE_CLEANUP_FENCE_FAIL:-false}" \
    FAKE_CLEANUP_SCALE_FAIL="${FAKE_CLEANUP_SCALE_FAIL:-false}" \
    FAKE_POST_MUTATION_WORKLOAD_DRIFT="${FAKE_POST_MUTATION_WORKLOAD_DRIFT:-false}" \
    FAKE_STALE_MIGRATOR_EVIDENCE="${FAKE_STALE_MIGRATOR_EVIDENCE:-false}" \
    FAKE_WRONG_MIGRATOR_DIGEST="${FAKE_WRONG_MIGRATOR_DIGEST:-false}" \
    FAKE_POST_POLICY_OPERATION="${FAKE_POST_POLICY_OPERATION:-false}" \
    FAKE_LEASE_READS_FILE="$FAKE_LEASE_READS_FILE" \
    REFRESH_ROOT_DIR="$REFRESH_DIR" \
    RUN_ID="${RUN_ID_OVERRIDE:-test-run}" \
    RESUME_FAILED_RUN_ID="${RESUME_FAILED_RUN_ID_OVERRIDE:-}" \
    DRY_RUN="${DRY_RUN:-true}" \
    CONFIRM_PRD_TO_STG_REFRESH="${CONFIRM_PRD_TO_STG_REFRESH:-}" \
    ALLOW_RAW_PRD_DATA_IN_STG="${ALLOW_RAW_PRD_DATA_IN_STG:-false}" \
    RAW_PRD_DATA_APPROVAL_REF="${RAW_PRD_DATA_APPROVAL_REF-}" \
    STG_OUTBOUND_INTEGRATIONS_ISOLATED="${STG_OUTBOUND_INTEGRATIONS_ISOLATED:-false}" \
    PRD_DATABASE_URL="$prd_url" \
    STG_DATABASE_URL="$stg_url" \
    BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY_OVERRIDE-synthetic-test-key}" \
    ARGOCD_TIMEOUT_SECONDS=2 \
    ARGOCD_POLL_SECONDS=1 \
    WORKLOAD_DRAIN_TIMEOUT_SECONDS=2 \
    POST_SYNC_HEALTH_TIMEOUT_SECONDS=2 \
    CLEANUP_TIMEOUT_SECONDS=2 \
    MIGRATOR_EVIDENCE_TIMEOUT_SECONDS=1 \
    REFRESH_LEASE_DURATION_SECONDS=61 \
    REFRESH_LEASE_RENEW_INTERVAL_SECONDS=20 \
    "$SCRIPT_UNDER_TEST" "$@" >"$OUTPUT_FILE" 2>&1
}

write_failed_run_receipt() {
  local failed_run_id="$1" failed_run_dir="$REFRESH_DIR/$1"
  local fingerprint deployments
  mkdir -p "$failed_run_dir"
  fingerprint="$(migration_history | shasum -a 256 | awk '{print $1}')"
  deployments='[{"namespace":"stg-klicker","name":"backend","replicas":1},{"namespace":"stg-klicker","name":"worker","replicas":2}]'
  jq -n \
    --arg runId "$failed_run_id" \
    --arg fingerprint "$fingerprint" \
    --argjson deployments "$deployments" '
      {
        runId: $runId,
        source: {
          host: "db-server-prd-apps.postgres.database.azure.com",
          port: "6432",
          database: "klicker-prod-prd",
          migrationFingerprint: $fingerprint
        },
        targetBefore: {
          host: "db-server-stg-apps.postgres.database.azure.com",
          port: "6432",
          database: "klicker-qa-stg"
        },
        kubernetes: {
          kubeSystemUid: "207f1b0e-5ad7-4de6-94d1-2b4564a41fe7",
          workloadNamespace: "stg-klicker",
          workloadNamespaceUid: "ae9b8ae9-d3df-4078-820d-1ef69d4cf816",
          argocdApplicationUid: "9f936f7f-58ff-4a72-8c75-eb969ac3bd6f",
          argocdProject: "stg-apps-klicker",
          argocdProjectUid: "6faae3ef-2736-45ee-a2d5-8fd4cfd41b16"
        },
        argocdRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        deployments: $deployments,
        argocdAutomatedPolicy: {
          prune: true,
          selfHeal: true,
          allowEmpty: false
        },
        argocdProjectOriginalSyncWindows: []
      }
    ' >"$failed_run_dir/before.json"
  printf '%s\t%s\t%s\n' stg-klicker backend 1 >"$failed_run_dir/deployments.tsv"
  printf '%s\t%s\t%s\n' stg-klicker worker 2 >>"$failed_run_dir/deployments.tsv"
  jq '.spec.syncWindows = [{
    kind: "deny",
    schedule: "* * * * *",
    duration: "1h",
    applications: ["app-klicker"],
    manualSync: false
  }]' "$FAKE_PROJECT_FILE" >"$FAKE_PROJECT_FILE.tmp"
  mv -- "$FAKE_PROJECT_FILE.tmp" "$FAKE_PROJECT_FILE"
}

run_live() {
  DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    RAW_PRD_DATA_APPROVAL_REF=TEST-APPROVAL-REF \
    STG_OUTBOUND_INTEGRATIONS_ISOLATED=true \
    run_refresh
}

test_help() {
  new_case help
  if "$SCRIPT_UNDER_TEST" --help >"$OUTPUT_FILE" 2>&1 &&
    assert_contains "$OUTPUT_FILE" 'Execution requires all five explicit gates' &&
    assert_contains "$OUTPUT_FILE" 'checked-in target constants'; then
    pass 'help is available without external tools'
  else
    fail 'help is available without external tools'
  fi
}

test_dry_run() {
  new_case dry-run
  if BACKUP_ENCRYPTION_KEY_OVERRIDE= run_refresh &&
    assert_contains "$OUTPUT_FILE" 'DRY_RUN=true' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source' &&
    assert_not_contains "$FAKE_LOG" 'kubectl lease write' &&
    [[ ! -e "$REFRESH_DIR" ]]; then
    pass 'dry run performs only read-only preflight checks'
  else
    fail 'dry run performs only read-only preflight checks'
  fi
}

test_confirmation_gate() {
  new_case confirmation
  if ! DRY_RUN=false run_refresh &&
    assert_contains "$OUTPUT_FILE" 'CONFIRM_PRD_TO_STG_REFRESH' &&
    [[ ! -s "$FAKE_LOG" ]]; then
    pass 'execution refuses to start without destructive confirmation'
  else
    fail 'execution refuses to start without destructive confirmation'
  fi
}

test_raw_data_approval_gate() {
  new_case raw-data-approval
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    STG_OUTBOUND_INTEGRATIONS_ISOLATED=true \
    run_refresh &&
    assert_contains "$OUTPUT_FILE" 'RAW_PRD_DATA_APPROVAL_REF' &&
    [[ ! -s "$FAKE_LOG" ]]; then
    pass 'execution requires a recorded raw-data approval reference'
  else
    fail 'execution requires a recorded raw-data approval reference'
  fi
}

test_raw_data_approval_format() {
  new_case raw-data-approval-format
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    RAW_PRD_DATA_APPROVAL_REF='not approval prose' \
    STG_OUTBOUND_INTEGRATIONS_ISOLATED=true \
    run_refresh &&
    assert_contains "$OUTPUT_FILE" 'must be a 1-200 character ticket' &&
    [[ ! -s "$FAKE_LOG" ]]; then
    pass 'raw-data approval evidence is bounded and identifier-shaped'
  else
    fail 'raw-data approval evidence is bounded and identifier-shaped'
  fi
}

test_outbound_isolation_gate() {
  new_case outbound-isolation
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    RAW_PRD_DATA_APPROVAL_REF=TEST-APPROVAL-REF \
    run_refresh &&
    assert_contains "$OUTPUT_FILE" 'STG_OUTBOUND_INTEGRATIONS_ISOLATED=true' &&
    [[ ! -s "$FAKE_LOG" ]]; then
    pass 'execution requires explicit outbound-integration isolation'
  else
    fail 'execution requires explicit outbound-integration isolation'
  fi
}

test_wrong_database() {
  new_case wrong-database
  local STG_DATABASE_URL_OVERRIDE
  STG_DATABASE_URL_OVERRIDE="$(stg_database_url wrong-database)"
  if ! run_refresh && assert_contains "$OUTPUT_FILE" "does not equal expected database" &&
    assert_not_contains "$FAKE_LOG" 'psql reset target'; then
    pass 'correct STG host with a wrong database name fails closed'
  else
    fail 'correct STG host with a wrong database name fails closed'
  fi
}

test_target_contract_ignores_ambient_overrides() {
  new_case immutable-target-contract
  if EXPECTED_PRD_DB_HOST=untrusted.invalid \
    EXPECTED_STG_DB_NAME=wrong-database \
    ARGOCD_APP=wrong-application \
    WORKLOAD_NAMESPACE=wrong-namespace \
    EXPECTED_KUBE_SYSTEM_UID=wrong-cluster \
    EXPECTED_ARGOCD_REPO_URL=https://example.invalid/wrong.git \
    run_live &&
    assert_contains "$OUTPUT_FILE" \
      'Source: db-server-prd-apps.postgres.database.azure.com/klicker-prod-prd' &&
    assert_contains "$OUTPUT_FILE" \
      'Target: db-server-stg-apps.postgres.database.azure.com/klicker-qa-stg' &&
    assert_contains "$OUTPUT_FILE" 'ArgoCD Application: argo/app-klicker'; then
    pass 'ambient variables cannot redefine the checked-in target contract'
  else
    fail 'ambient variables cannot redefine the checked-in target contract'
  fi
}

test_tls_guard() {
  new_case tls-guard
  local STG_DATABASE_URL_OVERRIDE
  STG_DATABASE_URL_OVERRIDE="$(stg_database_url | sed 's/?sslmode=require&schema=public//')"
  if ! run_refresh && assert_contains "$OUTPUT_FILE" 'must set sslmode='; then
    pass 'database URLs without an approved TLS mode fail closed'
  else
    fail 'database URLs without an approved TLS mode fail closed'
  fi
}

test_cluster_guard() {
  new_case cluster-guard
  if ! FAKE_CLUSTER_MISMATCH=true run_refresh &&
    assert_contains "$OUTPUT_FILE" 'does not match expected STG cluster' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source'; then
    pass 'mutable context alias cannot bypass immutable cluster identity'
  else
    fail 'mutable context alias cannot bypass immutable cluster identity'
  fi
}

test_rbac_guard() {
  new_case rbac-guard
  if ! FAKE_RBAC_DENY=true run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Kubernetes permission denied' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source'; then
    pass 'missing write RBAC fails before the dump'
  else
    fail 'missing write RBAC fails before the dump'
  fi
}

test_migrator_guard() {
  new_case migrator-guard
  if ! FAKE_MIGRATOR_MISMATCH=true run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Migrator Secret database' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source'; then
    pass 'migrator Secret must target the exact restore database'
  else
    fail 'migrator Secret must target the exact restore database'
  fi
}

test_active_lease() {
  new_case active-lease
  jq -n --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" '
    {
      metadata: {name: "app-klicker-prd-to-stg-refresh", resourceVersion: "7"},
      spec: {
        holderIdentity: "another-refresh",
        acquireTime: $now,
        renewTime: $now,
        leaseDurationSeconds: 120
      }
    }
  ' >"$FAKE_LEASE_FILE"
  if ! run_live && assert_contains "$OUTPUT_FILE" 'held by another active run' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source'; then
    pass 'an active refresh Lease fences concurrent runs'
  else
    fail 'an active refresh Lease fences concurrent runs'
  fi
}

test_storage_headroom() {
  new_case storage-headroom
  if ! FAKE_STORAGE_LOW=true run_refresh &&
    assert_contains "$OUTPUT_FILE" 'free storage is less than' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source'; then
    pass 'fresh Azure storage metrics must provide restore and WAL headroom'
  else
    fail 'fresh Azure storage metrics must provide restore and WAL headroom'
  fi
}

test_lease_loss() {
  new_case lease-loss
  if ! FAKE_LEASE_LOSS=true run_live &&
    assert_contains "$OUTPUT_FILE" 'Lease ownership was lost' &&
    [[ "$(deployment_replicas backend 1)" == 1 ]] &&
    [[ "$(deployment_replicas worker 2)" == 2 ]] &&
    [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == automated ]] &&
    assert_not_contains "$FAKE_LOG" 'psql reset target'; then
    pass 'Lease loss stops mutation and compensates pre-mutation state'
  else
    fail 'Lease loss stops mutation and compensates pre-mutation state'
  fi
}

test_competing_sync() {
  new_case competing-sync
  if ! FAKE_COMPETING_SYNC=true run_live &&
    assert_contains "$OUTPUT_FILE" 'competing ArgoCD operation appeared' &&
    [[ "$(deployment_replicas backend 1)" == 1 ]] &&
    [[ "$(deployment_replicas worker 2)" == 2 ]] &&
    [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == automated ]] &&
    assert_not_contains "$FAKE_LOG" 'psql reset target'; then
    pass 'a competing manual sync is rejected before database mutation'
  else
    fail 'a competing manual sync is rejected before database mutation'
  fi
}

test_infisical() {
  new_case infisical
  if PRD_DATABASE_URL_OVERRIDE= STG_DATABASE_URL_OVERRIDE= \
    BACKUP_ENCRYPTION_KEY_OVERRIDE= run_live &&
    assert_contains "$FAKE_LOG" 'DIRECT_DATABASE_URL from prd' &&
    assert_contains "$FAKE_LOG" 'DIRECT_DATABASE_URL from stg' &&
    assert_contains "$FAKE_LOG" 'BACKUP_ENCRYPTION_KEY from prd'; then
    pass 'credentials load from the self-hosted Infisical project'
  else
    fail 'credentials load from the self-hosted Infisical project'
  fi
}

test_success() {
  new_case success
  if run_live && [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == automated ]] &&
    [[ -f "$REFRESH_DIR/test-run/after.json" ]] &&
    [[ ! -e "$REFRESH_DIR/test-run/prd.dump.gpg" ]] &&
    jq -e '.terminalSuccess == true and
      .argocd.originalPolicyRestored == true and
      .argocd.health == "Healthy" and
      (.argocd.migratorImageId | test("@sha256:[0-9a-f]{64}$")) and
      .argocd.migratorJobUid == "synthetic-new-job-uid" and
      .argocd.migratorPodUid == "synthetic-migrator-pod-uid" and
      (.argocd.revision | length) == 40' \
      "$REFRESH_DIR/test-run/after.json" >/dev/null &&
    jq -s -e 'all(.[];
      .governance.rawPrdDataApprovalRef == "TEST-APPROVAL-REF" and
      .governance.stgOutboundIntegrationsIsolated == true)' \
      "$REFRESH_DIR/test-run/state.json" \
      "$REFRESH_DIR/test-run/before.json" \
      "$REFRESH_DIR/test-run/after.json" >/dev/null &&
    jq -e '
      .metadata.annotations["klicker.uzh.ch/raw-data-approval-ref"] ==
        "TEST-APPROVAL-REF" and
      .metadata.annotations["klicker.uzh.ch/outbound-integrations-isolated"] ==
        "true"' "$FAKE_LEASE_FILE" >/dev/null &&
    [[ "$(jq -c '.spec.syncWindows' "$FAKE_PROJECT_FILE")" == '[]' ]] &&
    assert_before "$FAKE_LOG" 'pg_dump source' 'kubectl app policy manual' &&
    assert_before "$FAKE_LOG" 'psql reset target' 'pg_restore target' &&
    assert_before "$FAKE_LOG" 'pg_restore target' 'kubectl app sync hook' &&
    assert_contains "$OUTPUT_FILE" 'refresh completed successfully' &&
    assert_contains "$OUTPUT_FILE" \
      'Application-level validation is still required before STG is declared usable'; then
    pass 'successful refresh reaches health and writes a terminal receipt'
  else
    fail 'successful refresh reaches health and writes a terminal receipt'
  fi
}

test_atomic_sync_submission_race() {
  new_case sync-cas-race
  if ! FAKE_CAS_RACE=true run_live &&
    assert_contains "$OUTPUT_FILE" 'Could not atomically submit' &&
    [[ ! -e "$REFRESH_DIR/test-run/after.json" ]] &&
    jq -e '.maintenanceFenceActive == true and .cleanupIncomplete == false' \
      "$REFRESH_DIR/test-run/state.json" >/dev/null; then
    pass 'Argo sync submission fails closed on a resource-version race'
  else
    fail 'Argo sync submission fails closed on a resource-version race'
  fi
}

test_stale_migrator_evidence() {
  new_case stale-migrator
  if ! FAKE_STALE_MIGRATOR_EVIDENCE=true run_live &&
    assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'without evidence from a new migrator Pod'; then
    pass 'a retained migrator Job cannot satisfy this run evidence'
  else
    fail 'a retained migrator Job cannot satisfy this run evidence'
  fi
}

test_wrong_migrator_digest() {
  new_case wrong-migrator-digest
  if ! FAKE_WRONG_MIGRATOR_DIGEST=true run_live &&
    assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'immutable image digest'; then
    pass 'migrator evidence requires the executed immutable image digest'
  else
    fail 'migrator evidence requires the executed immutable image digest'
  fi
}

test_partial_scale_failure() {
  new_case partial-scale
  if ! FAKE_PARTIAL_SCALE_FAIL=true run_live &&
    [[ "$(deployment_replicas backend 1)" == 1 ]] &&
    [[ "$(deployment_replicas worker 2)" == 2 ]] &&
    [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == automated ]] &&
    assert_not_contains "$FAKE_LOG" 'psql reset target'; then
    pass 'partial pre-mutation scaling is compensated'
  else
    fail 'partial pre-mutation scaling is compensated'
  fi
}

assert_fail_safe_failure() {
  [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == manual ]] &&
    [[ "$(deployment_replicas backend 1)" == 0 ]] &&
    [[ "$(deployment_replicas worker 2)" == 0 ]] &&
    [[ ! -e "$REFRESH_DIR/test-run/after.json" ]] &&
    assert_contains "$OUTPUT_FILE" 'Verified fail-safe maintenance'
}

test_restore_failure() {
  new_case restore-failure
  if ! FAKE_PG_RESTORE_FAIL=true run_live && assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'STG pg_restore failed' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app sync hook'; then
    pass 'restore failure leaves STG in fail-safe maintenance'
  else
    fail 'restore failure leaves STG in fail-safe maintenance'
  fi
}

test_argocd_failure() {
  new_case argocd-failure
  if ! FAKE_ARGO_SYNC_FAIL=true run_live && assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'PreSync migration hook failed'; then
    pass 'migration-hook failure forces every selected workload to zero'
  else
    fail 'migration-hook failure forces every selected workload to zero'
  fi
}

test_cleanup_fence_api_failure() {
  new_case cleanup-fence-failure
  if ! FAKE_ARGO_SYNC_FAIL=true FAKE_CLEANUP_FENCE_FAIL=true run_live &&
    jq -e '.cleanupIncomplete == true and .phase == "cleanup-incomplete"' \
      "$REFRESH_DIR/test-run/state.json" >/dev/null &&
    [[ "$(jq -r '.spec.holderIdentity' "$FAKE_LEASE_FILE")" == \
      prd-to-stg-refresh-test-run ]] &&
    assert_contains "$OUTPUT_FILE" 'STG safety could not be fully proven' &&
    assert_not_contains "$OUTPUT_FILE" 'Verified fail-safe maintenance:'; then
    pass 'cleanup records incomplete state when the maintenance fence API fails'
  else
    fail 'cleanup records incomplete state when the maintenance fence API fails'
  fi
}

test_cleanup_scale_api_failure() {
  new_case cleanup-scale-failure
  if ! FAKE_ARGO_SYNC_FAIL=true FAKE_CLEANUP_SCALE_FAIL=true run_live &&
    jq -e '.cleanupIncomplete == true and .maintenanceFenceActive == true' \
      "$REFRESH_DIR/test-run/state.json" >/dev/null &&
    [[ "$(jq -r '.spec.holderIdentity' "$FAKE_LEASE_FILE")" == \
      prd-to-stg-refresh-test-run ]] &&
    assert_contains "$OUTPUT_FILE" 'STG safety could not be fully proven'; then
    pass 'cleanup records incomplete state when workload shutdown cannot be proven'
  else
    fail 'cleanup records incomplete state when workload shutdown cannot be proven'
  fi
}

test_post_mutation_workload_drift() {
  new_case cleanup-workload-drift
  if ! FAKE_ARGO_SYNC_FAIL=true FAKE_POST_MUTATION_WORKLOAD_DRIFT=true run_live &&
    jq -e '.cleanupIncomplete == true and .phase == "cleanup-incomplete"' \
      "$REFRESH_DIR/test-run/state.json" >/dev/null &&
    [[ "$(jq -r '.spec.holderIdentity' "$FAKE_LEASE_FILE")" == \
      prd-to-stg-refresh-test-run ]] &&
    assert_contains "$OUTPUT_FILE" 'backend has not reached zero desired and running replicas' &&
    assert_contains "$OUTPUT_FILE" 'STG safety could not be fully proven' &&
    assert_not_contains "$OUTPUT_FILE" 'Verified fail-safe maintenance:'; then
    pass 'cleanup verifies receipt-bound workloads after selector-label drift'
  else
    fail 'cleanup verifies receipt-bound workloads after selector-label drift'
  fi
}

test_post_sync_metadata_failure() {
  new_case metadata-failure
  if ! FAKE_POST_SYNC_METADATA_FAIL=true run_live && assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'Could not read STG database metadata'; then
    pass 'post-sync metadata failure cannot leave workloads running'
  else
    fail 'post-sync metadata failure cannot leave workloads running'
  fi
}

test_policy_restore_failure() {
  new_case policy-failure
  if ! FAKE_POLICY_RESTORE_FAIL=true run_live && assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'entering fail-safe cleanup'; then
    pass 'policy-restore failure cannot create a terminal receipt'
  else
    fail 'policy-restore failure cannot create a terminal receipt'
  fi
}

test_migration_divergence() {
  new_case migration-divergence
  if ! FAKE_MIGRATION_DIVERGENCE=true run_live && assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'does not preserve the exact PRD migration-name/checksum prefix'; then
    pass 'equal-count or extended divergent migration history is rejected'
  else
    fail 'equal-count or extended divergent migration history is rejected'
  fi
}

test_argocd_timeout() {
  new_case argocd-timeout
  if ! FAKE_ARGO_TIMEOUT=true run_live && assert_fail_safe_failure &&
    assert_contains "$FAKE_LOG" 'kubectl app operation terminated' &&
    assert_contains "$OUTPUT_FILE" 'reached terminal phase' &&
    assert_contains "$OUTPUT_FILE" 'was terminated'; then
    pass 'Argo timeout terminates and drains the owned operation before return'
  else
    fail 'Argo timeout terminates and drains the owned operation before return'
  fi
}

test_health_failure() {
  new_case health-failure
  if ! FAKE_HEALTH_FAIL=true run_live && assert_fail_safe_failure &&
    assert_contains "$OUTPUT_FILE" 'Timed out waiting for ArgoCD Synced/Healthy'; then
    pass 'post-sync health failure returns STG to fail-safe maintenance'
  else
    fail 'post-sync health failure returns STG to fail-safe maintenance'
  fi
}

test_post_policy_operation() {
  new_case post-policy-operation
  if ! FAKE_POST_POLICY_OPERATION=true run_live &&
    [[ ! -e "$REFRESH_DIR/test-run/after.json" ]] &&
    assert_contains "$OUTPUT_FILE" 'Timed out waiting for ArgoCD Synced/Healthy'; then
    pass 'terminal receipt is withheld when policy restoration starts another operation'
  else
    fail 'terminal receipt is withheld when policy restoration starts another operation'
  fi
}

test_resume() {
  new_case resume
  write_failed_run_receipt previous-failure
  printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"
  printf '%s' 0 >"$FAKE_STATE_DIR/backend.replicas"
  printf '%s' 0 >"$FAKE_STATE_DIR/worker.replicas"
  local RESUME_FAILED_RUN_ID_OVERRIDE=previous-failure
  local RUN_ID_OVERRIDE=resume-run
  if run_live && [[ -f "$REFRESH_DIR/resume-run/after.json" ]] &&
    jq -e '.resumedFromRunId == "previous-failure"' \
      "$REFRESH_DIR/resume-run/before.json" >/dev/null &&
    assert_contains "$OUTPUT_FILE" 'Resuming fail-safe maintenance'; then
    pass 'receipt-bound resume restores and verifies the target'
  else
    fail 'receipt-bound resume restores and verifies the target'
  fi
}

test_resume_rejects_running() {
  new_case resume-running
  write_failed_run_receipt previous-failure
  printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"
  local RESUME_FAILED_RUN_ID_OVERRIDE=previous-failure
  if ! run_refresh && assert_contains "$OUTPUT_FILE" 'Cannot resume while any selected' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source'; then
    pass 'resume refuses any running selected workload'
  else
    fail 'resume refuses any running selected workload'
  fi
}

test_prd_connection_failure() {
  new_case prd-connection
  if ! FAKE_PSQL_CONNECT_FAIL=true run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Could not read PRD database metadata' &&
    assert_not_contains "$OUTPUT_FILE" "unexpected database ''"; then
    pass 'PRD connection errors fail without misleading metadata'
  else
    fail 'PRD connection errors fail without misleading metadata'
  fi
}

test_help
test_dry_run
test_confirmation_gate
test_raw_data_approval_gate
test_raw_data_approval_format
test_outbound_isolation_gate
test_wrong_database
test_target_contract_ignores_ambient_overrides
test_tls_guard
test_cluster_guard
test_rbac_guard
test_migrator_guard
test_active_lease
test_storage_headroom
test_lease_loss
test_competing_sync
test_infisical
test_success
test_atomic_sync_submission_race
test_stale_migrator_evidence
test_wrong_migrator_digest
test_partial_scale_failure
test_restore_failure
test_argocd_failure
test_cleanup_fence_api_failure
test_cleanup_scale_api_failure
test_post_mutation_workload_drift
test_post_sync_metadata_failure
test_policy_restore_failure
test_migration_divergence
test_argocd_timeout
test_health_failure
test_post_policy_operation
test_resume
test_resume_rejects_running
test_prd_connection_failure

printf '1..%s\n' "$TEST_COUNT"
(( FAIL_COUNT == 0 ))
