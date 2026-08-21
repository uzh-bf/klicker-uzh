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

fake_log() {
  printf '%s\n' "$*" >>"$FAKE_LOG"
}

fake_infisical() {
  [[ " $* " == *" --domain=https://inf.prd.df-app.ch/api "* ]] || return 0
  [[ " $* " == *" --projectId=d071be96-5136-4f23-a6cb-e0c7f9b9a6c8 "* ]] \
    || return 0

  local secret_name="${3:-}"
  local environment=""
  local argument
  for argument in "$@"; do
    if [[ "$argument" == --env=* ]]; then
      environment="${argument#--env=}"
    fi
  done

  fake_log "infisical get $secret_name from $environment via self-hosted project"
  case "$secret_name:$environment" in
    DIRECT_DATABASE_URL:prd)
      printf '%s\n' 'postgresql://prd-user:synthetic@db-server-prd-apps.postgres.database.azure.com/klicker?schema=public&sslmode=require'
      ;;
    DIRECT_DATABASE_URL:stg)
      printf '%s\n' 'postgresql://stg-user:synthetic@db-server-stg-apps.postgres.database.azure.com/klicker?schema=public&sslmode=require'
      ;;
    BACKUP_ENCRYPTION_KEY:prd)
      printf '%s\n' 'synthetic-test-key'
      ;;
    *) return 2 ;;
  esac
}

fake_argocd_application_json() {
  local policy="manual"
  [[ -f "$FAKE_ARGO_POLICY_FILE" ]] && policy="$(<"$FAKE_ARGO_POLICY_FILE")"

  local automated='null'
  if [[ "$policy" == "automated" ]]; then
    automated='{"prune":true,"selfHeal":true,"allowEmpty":false}'
  fi

  local initiator=""
  if [[ -f "$FAKE_ARGO_OPERATION_INITIATOR_FILE" ]]; then
    initiator="$(<"$FAKE_ARGO_OPERATION_INITIATOR_FILE")"
  fi

  if [[ -n "$initiator" ]]; then
    local phase="Succeeded"
    local message="successfully synced (all tasks run)"
    if [[ "${FAKE_ARGO_OPERATION_RUNNING:-false}" == "true" ]]; then
      phase="Running"
      message="synthetic operation still running"
    fi
    if [[ "${FAKE_ARGO_SYNC_FAIL:-false}" == "true" ]]; then
      phase="Failed"
      message="synthetic migration failure"
    fi

    jq -cn \
      --argjson automated "$automated" \
      --arg initiator "$initiator" \
      --arg phase "$phase" \
      --arg message "$message" \
      '{
        spec: {
          destination: {namespace: "stg-klicker"},
          syncPolicy: {automated: $automated}
        },
        status: {
          operationState: {
            phase: $phase,
            startedAt: "2026-08-21T09:00:00Z",
            finishedAt: "2026-08-21T09:00:01Z",
            message: $message,
            operation: {
              initiatedBy: {username: $initiator},
              sync: {syncStrategy: {hook: {}}}
            }
          }
        }
      }'
  else
    jq -cn \
      --argjson automated "$automated" \
      '{
        spec: {
          destination: {namespace: "stg-klicker"},
          syncPolicy: {automated: $automated}
        },
        status: {
          operationState: {
            phase: "Succeeded",
            startedAt: "2026-08-20T09:00:00Z"
          }
        }
      }'
  fi
}

fake_kubectl() {
  if [[ " $* " == *" auth can-i "* ]]; then
    if [[ "${FAKE_KUBE_CAN_I:-allow}" == "deny" ]]; then
      printf '%s\n' no
    else
      printf '%s\n' yes
    fi
  elif [[ " $* " == *" get namespace kube-system "* ]]; then
    printf '%s' synthetic-cluster-uid
  elif [[ " $* " == *" get secret "* ]]; then
    printf '%s' "${FAKE_MIGRATOR_URL:-postgresql://stg-user:synthetic@db-server-stg-apps.postgres.database.azure.com/klicker?schema=public&sslmode=require}" | base64
  elif [[ " $* " == *" create -f - "* ]]; then
    local lease_payload
    lease_payload="$(cat)"
    [[ ! -e "$FAKE_LEASE_FILE" ]] || return 1
    printf '%s' "$lease_payload" >"$FAKE_LEASE_FILE"
    fake_log 'kubectl lease create'
  elif [[ " $* " == *" get lease "* ]]; then
    [[ -f "$FAKE_LEASE_FILE" ]] || return 1
    if [[ " $* " == *" jsonpath={.spec.holderIdentity} "* ]]; then
      jq -r '.spec.holderIdentity' "$FAKE_LEASE_FILE"
    else
      cat "$FAKE_LEASE_FILE"
    fi
  elif [[ " $* " == *" patch lease "* ]]; then
    [[ -f "$FAKE_LEASE_FILE" ]] || return 1
    local patch_payload=""
    local expect_patch=false
    local argument
    for argument in "$@"; do
      if [[ "$expect_patch" == "true" ]]; then
        patch_payload="$argument"
        break
      elif [[ "$argument" == "--patch" ]]; then
        expect_patch=true
      fi
    done
    jq -s '.[0] * .[1]' "$FAKE_LEASE_FILE" <(printf '%s' "$patch_payload") \
      >"$FAKE_LEASE_FILE.tmp"
    mv -- "$FAKE_LEASE_FILE.tmp" "$FAKE_LEASE_FILE"
    fake_log 'kubectl lease renew'
  elif [[ " $* " == *" delete lease "* ]]; then
    rm -f -- "$FAKE_LEASE_FILE"
    fake_log 'kubectl lease delete'
  elif [[ " $* " == *" get application.argoproj.io "* ]]; then
    fake_argocd_application_json
  elif [[ " $* " == *" patch application.argoproj.io "* ]]; then
    local patch_payload=""
    local expect_patch=false
    local argument
    for argument in "$@"; do
      if [[ "$expect_patch" == "true" ]]; then
        patch_payload="$argument"
        break
      elif [[ "$argument" == "--patch" ]]; then
        expect_patch=true
      fi
    done
    [[ -n "$patch_payload" ]] || return 2

    if jq -e 'has("operation") and .operation == null' <<<"$patch_payload" >/dev/null; then
      rm -f -- "$FAKE_ARGO_OPERATION_INITIATOR_FILE"
      fake_log 'kubectl app operation terminate'
    elif jq -e '.operation.sync != null' <<<"$patch_payload" >/dev/null; then
      jq -r '.operation.initiatedBy.username' <<<"$patch_payload" \
        >"$FAKE_ARGO_OPERATION_INITIATOR_FILE"
      fake_log 'kubectl app sync hook'
    elif jq -e '.spec.syncPolicy | has("automated")' <<<"$patch_payload" \
      >/dev/null; then
      local automated
      automated="$(jq -c '.spec.syncPolicy.automated' <<<"$patch_payload")"
      if [[ "$automated" == "null" ]]; then
        printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"
        fake_log 'kubectl app policy manual'
      else
        printf '%s' automated >"$FAKE_ARGO_POLICY_FILE"
        fake_log "kubectl app policy automated $automated"
      fi
    else
      return 2
    fi
  elif [[ " $* " == *" get deployments "* ]]; then
    local replicas=1
    [[ -f "$FAKE_WORKLOADS_SCALED_FILE" ]] && replicas=0
    printf '{"items":[{"metadata":{"namespace":"stg-klicker","name":"backend"},"spec":{"replicas":%s},"status":{"replicas":%s}}]}\n' \
      "$replicas" "$replicas"
  elif [[ " $* " == *" scale deployment/"* ]]; then
    fake_log "kubectl scale $*"
    : >"$FAKE_WORKLOADS_SCALED_FILE"
  else
    return 2
  fi
}

fake_pg_dump() {
  if [[ "${1:-}" == "--version" ]]; then
    printf '%s\n' 'pg_dump (PostgreSQL) 17.4'
    return
  fi

  [[ "${PGHOST:-}" == 'db-server-prd-apps.postgres.database.azure.com' ]] \
    || return 2
  [[ "${PGDATABASE:-}" == 'klicker' ]] || return 2
  [[ "${PGPORT:-}" == '5432' ]] || return 2
  [[ "${PGUSER:-}" == 'prd-user' ]] || return 2
  [[ "${PGPASSWORD:-}" == 'synthetic' ]] || return 2
  [[ "${PGSSLMODE:-}" == 'require' ]] || return 2
  fake_log 'pg_dump source'
  printf '%s\n' 'synthetic custom archive'
}

fake_gpg() {
  if [[ " $* " == *" --decrypt "* ]]; then
    local archive="${*: -1}"
    fake_log 'gpg decrypt'
    if [[ "${FAKE_CATALOG_READS_PREFIX_ONLY:-false}" == "true" ]]; then
      local index
      for ((index = 0; index < 20000; index++)); do
        printf '%064d\n' "$index"
      done
      return
    fi
    cat "$archive"
    return
  fi

  local output=""
  local expect_output=false
  local argument
  for argument in "$@"; do
    if [[ "$expect_output" == "true" ]]; then
      output="$argument"
      expect_output=false
    elif [[ "$argument" == "--output" ]]; then
      expect_output=true
    fi
  done
  [[ -n "$output" ]] || return 2
  fake_log 'gpg encrypt'
  cat >"$output"
}

fake_pg_restore() {
  if [[ "${1:-}" == "--version" ]]; then
    printf '%s\n' 'pg_restore (PostgreSQL) 17.4'
    return
  fi

  if [[ " $* " == *" --list "* ]]; then
    fake_log 'pg_restore list'
    if [[ "${FAKE_CATALOG_READS_PREFIX_ONLY:-false}" == "true" ]]; then
      IFS= read -r _ || true
    else
      cat >/dev/null
    fi
    printf '%s\n' \
      '; synthetic archive catalog' \
      '5; 2615 2200 SCHEMA - public prd-user' \
      '100; 0 0 COMMENT - SCHEMA public prd-user' \
      '200; 1259 12345 TABLE public Example prd-user'
    return
  fi

  [[ "${PGHOST:-}" == 'db-server-stg-apps.postgres.database.azure.com' ]] \
    || return 2
  [[ "${PGDATABASE:-}" == 'klicker' ]] || return 2
  [[ "${PGPORT:-}" == '5432' ]] || return 2
  [[ "${PGUSER:-}" == 'stg-user' ]] || return 2
  [[ "${PGPASSWORD:-}" == 'synthetic' ]] || return 2
  [[ "${PGSSLMODE:-}" == 'require' ]] || return 2
  local restore_database=""
  local restore_list=""
  local expect_database=false
  local argument
  for argument in "$@"; do
    if [[ "$expect_database" == "true" ]]; then
      restore_database="$argument"
      expect_database=false
    elif [[ "$argument" == "--dbname" || "$argument" == "-d" ]]; then
      expect_database=true
    elif [[ "$argument" == --dbname=* ]]; then
      restore_database="${argument#--dbname=}"
    elif [[ "$argument" == -d* && "$argument" != "-d" ]]; then
      restore_database="${argument#-d}"
    elif [[ "$argument" == --use-list=* ]]; then
      restore_list="${argument#--use-list=}"
    fi
  done
  if [[ -z "$restore_database" ]]; then
    printf '%s\n' 'pg_restore: error: one of -d/--dbname and -f/--file must be specified' >&2
    return 1
  fi
  [[ "$restore_database" == 'klicker' ]] || return 2
  [[ -n "$restore_list" && -f "$restore_list" ]] || return 2
  ! grep -Eq '^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public|COMMENT - SCHEMA public) ' \
    "$restore_list" || return 2
  fake_log "pg_restore target database=$restore_database"
  cat >/dev/null
  [[ "${FAKE_PG_RESTORE_FAIL:-false}" != "true" ]] || return 1
  : >"$FAKE_STG_RESTORED_FILE"
}

fake_psql() {
  if [[ "${FAKE_PSQL_CONNECT_FAIL:-false}" == "true" &&
    "${PGHOST:-}" == 'db-server-prd-apps.postgres.database.azure.com' ]]; then
    printf '%s\n' 'psql: error: synthetic connection failure' >&2
    return 2
  fi

  if [[ " $* " == *" DROP SCHEMA IF EXISTS public CASCADE; "* ]]; then
    if [[ "${FAKE_PUBLIC_SCHEMA_NOT_OWNED:-false}" == "true" ]]; then
      printf '%s\n' 'ERROR: must be owner of schema public' >&2
      return 2
    fi
    [[ "${PGHOST:-}" == 'db-server-stg-apps.postgres.database.azure.com' ]] \
      || return 2
    fake_log 'psql reset target'
    return
  fi

  if [[ " $* " == *" klicker_stg_reset_capabilities "* ]]; then
    local supported_objects=253
    if [[ "${FAKE_STG_EMPTY_BEFORE:-false}" == "true" &&
      ! -f "$FAKE_STG_RESTORED_FILE" ]]; then
      supported_objects=0
    fi
    printf 'klicker|stg-user|azure_pg_admin|t|%s|0|0|0|0\n' "$supported_objects"
    return
  fi

  if [[ " $* " == *" klicker_reset_owned_objects "* ]]; then
    [[ "${PGHOST:-}" == 'db-server-stg-apps.postgres.database.azure.com' ]] \
      || return 2
    fake_log 'psql reset target'
    return
  fi

  [[ "${PGDATABASE:-}" == 'klicker' ]] || return 2
  [[ "${PGSSLMODE:-}" == 'require' ]] || return 2
  if [[ "${PGHOST:-}" == 'db-server-prd-apps.postgres.database.azure.com' ]]; then
    [[ "${PGUSER:-}" == 'prd-user' ]] || return 2
    [[ "${PGPASSWORD:-}" == 'synthetic' ]] || return 2
    fake_log 'psql metadata source'
    if [[ " $* " == *" klicker_database_identity "* ]]; then
      printf '%s\n' 'klicker|10.0.0.5|5432'
    elif [[ " $* " == *" klicker_database_migration_history "* ]]; then
      printf '%s\n' '001_init|checksum-a'
    elif [[ " $* " == *" klicker_database_metadata_core "* ]]; then
      printf '%s\n' 'klicker|170000|1048576|200|1|0|0'
    elif [[ " $* " == *" klicker_database_metadata_migrations "* ]]; then
      printf '%s\n' '180|0'
    else
      return 2
    fi
    return
  fi

  [[ "${PGHOST:-}" == 'db-server-stg-apps.postgres.database.azure.com' ]] \
    || return 2
  [[ "${PGUSER:-}" == 'stg-user' ]] || return 2
  [[ "${PGPASSWORD:-}" == 'synthetic' ]] || return 2
  fake_log 'psql metadata target'
  local count=0
  [[ -f "$FAKE_STG_METADATA_COUNTER" ]] && count="$(<"$FAKE_STG_METADATA_COUNTER")"
  if [[ " $* " == *" klicker_database_identity "* ]]; then
    printf '%s\n' 'klicker|10.0.0.5|5432'
  elif [[ " $* " == *" klicker_database_migration_history "* ]]; then
    if [[ "${FAKE_MIGRATION_HISTORY_MODE:-prefix}" == "divergent" ]] && (( count >= 3 )); then
      printf '%s\n' '999_wrong|checksum-z'
    elif (( count >= 3 )); then
      printf '%s\n' $'001_init|checksum-a\n002_forward|checksum-b'
    else
      printf '%s\n' '001_init|checksum-a'
    fi
  elif [[ " $* " == *" klicker_database_metadata_core "* ]]; then
    count=$((count + 1))
    printf '%s' "$count" >"$FAKE_STG_METADATA_COUNTER"
    if [[ "${FAKE_STG_EMPTY_BEFORE:-false}" == "true" && "$count" == "1" ]]; then
      printf '%s\n' 'klicker|170000|8192|0|0|0|0'
    else
      case "$count" in
        1) printf '%s\n' 'klicker|170000|524288|190|1|0|0' ;;
        2) printf '%s\n' 'klicker|170000|1048576|200|1|0|0' ;;
        *) printf '%s\n' 'klicker|170000|1100000|205|1|0|0' ;;
      esac
    fi
  elif [[ " $* " == *" klicker_database_metadata_migrations "* ]]; then
    case "$count" in
      1) printf '%s\n' '175|0' ;;
      2) printf '%s\n' '180|0' ;;
      *) printf '%s\n' '185|0' ;;
    esac
  else
    return 2
  fi
}

dispatch_fake_tool() {
  case "$(basename "$0")" in
    gpg) fake_gpg "$@" ;;
    infisical) fake_infisical "$@" ;;
    kubectl) fake_kubectl "$@" ;;
    pg_dump) fake_pg_dump "$@" ;;
    pg_restore) fake_pg_restore "$@" ;;
    psql) fake_psql "$@" ;;
    *) return 2 ;;
  esac
}

if [[ "$(basename "$0")" != "$(basename "$TEST_SCRIPT")" ]]; then
  dispatch_fake_tool "$@"
  exit
fi

TEST_TMP="$(mktemp -d "${TMPDIR:-/tmp}/refresh-stg-from-prd-test.XXXXXX")"
cleanup_test_tmp() {
  if [[ "${KEEP_TEST_TMP:-false}" == "true" ]]; then
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
}

assert_contains() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$file"
}

assert_not_contains() {
  local file="$1"
  local text="$2"
  ! grep -Fq -- "$text" "$file"
}

assert_before() {
  local file="$1"
  local first="$2"
  local second="$3"
  local first_line second_line
  first_line="$(grep -nF -- "$first" "$file" | head -1 | cut -d: -f1)"
  second_line="$(grep -nF -- "$second" "$file" | head -1 | cut -d: -f1)"
  [[ -n "$first_line" && -n "$second_line" && "$first_line" -lt "$second_line" ]]
}

new_case() {
  local name="$1"
  CASE_DIR="$TEST_TMP/$name"
  FAKE_BIN="$CASE_DIR/bin"
  FAKE_LOG="$CASE_DIR/fake.log"
  FAKE_ARGO_POLICY_FILE="$CASE_DIR/argocd-policy"
  FAKE_ARGO_OPERATION_INITIATOR_FILE="$CASE_DIR/argocd-operation-initiator"
  FAKE_LEASE_FILE="$CASE_DIR/refresh-lease.json"
  FAKE_WORKLOADS_SCALED_FILE="$CASE_DIR/workloads-scaled"
  FAKE_STG_METADATA_COUNTER="$CASE_DIR/stg-metadata-counter"
  FAKE_STG_RESTORED_FILE="$CASE_DIR/stg-restored"
  OUTPUT_FILE="$CASE_DIR/output.log"
  REFRESH_DIR="$CASE_DIR/refreshes"
  mkdir -p "$FAKE_BIN"
  : >"$FAKE_LOG"
  printf '%s' automated >"$FAKE_ARGO_POLICY_FILE"
  local tool
  for tool in gpg infisical kubectl pg_dump pg_restore psql; do
    ln -s "$TEST_SCRIPT" "$FAKE_BIN/$tool"
  done
}

run_refresh() {
  env \
    PATH="$FAKE_BIN:$PATH" \
    FAKE_LOG="$FAKE_LOG" \
    FAKE_ARGO_POLICY_FILE="$FAKE_ARGO_POLICY_FILE" \
    FAKE_ARGO_OPERATION_INITIATOR_FILE="$FAKE_ARGO_OPERATION_INITIATOR_FILE" \
    FAKE_LEASE_FILE="$FAKE_LEASE_FILE" \
    FAKE_WORKLOADS_SCALED_FILE="$FAKE_WORKLOADS_SCALED_FILE" \
    FAKE_STG_METADATA_COUNTER="$FAKE_STG_METADATA_COUNTER" \
    FAKE_STG_RESTORED_FILE="$FAKE_STG_RESTORED_FILE" \
    FAKE_PG_RESTORE_FAIL="${FAKE_PG_RESTORE_FAIL:-false}" \
    FAKE_PSQL_CONNECT_FAIL="${FAKE_PSQL_CONNECT_FAIL:-false}" \
    FAKE_ARGO_SYNC_FAIL="${FAKE_ARGO_SYNC_FAIL:-false}" \
    FAKE_ARGO_OPERATION_RUNNING="${FAKE_ARGO_OPERATION_RUNNING:-false}" \
    FAKE_MIGRATOR_URL="${FAKE_MIGRATOR_URL:-postgresql://stg-user:synthetic@db-server-stg-apps.postgres.database.azure.com/klicker?schema=public&sslmode=require}" \
    FAKE_MIGRATION_HISTORY_MODE="${FAKE_MIGRATION_HISTORY_MODE:-prefix}" \
    FAKE_KUBE_CAN_I="${FAKE_KUBE_CAN_I:-allow}" \
    FAKE_CATALOG_READS_PREFIX_ONLY="${FAKE_CATALOG_READS_PREFIX_ONLY:-false}" \
    FAKE_PUBLIC_SCHEMA_NOT_OWNED="${FAKE_PUBLIC_SCHEMA_NOT_OWNED:-false}" \
    FAKE_STG_EMPTY_BEFORE="${FAKE_STG_EMPTY_BEFORE:-false}" \
    REFRESH_ROOT_DIR="$REFRESH_DIR" \
    RUN_ID="${RUN_ID_OVERRIDE:-test-run}" \
    RESUME_FAILED_RUN_ID="${RESUME_FAILED_RUN_ID_OVERRIDE:-}" \
    DRY_RUN="${DRY_RUN:-true}" \
    CONFIRM_PRD_TO_STG_REFRESH="${CONFIRM_PRD_TO_STG_REFRESH:-}" \
    ALLOW_RAW_PRD_DATA_IN_STG="${ALLOW_RAW_PRD_DATA_IN_STG:-false}" \
    RAW_PRD_DATA_APPROVAL_REF="${RAW_PRD_DATA_APPROVAL_REF-TEST-APPROVAL}" \
    STG_OUTBOUND_INTEGRATIONS_ISOLATED="${STG_OUTBOUND_INTEGRATIONS_ISOLATED:-true}" \
    STG_FREE_STORAGE_GIB="${STG_FREE_STORAGE_GIB:-64}" \
    EXPECTED_STG_CLUSTER_UID="${EXPECTED_STG_CLUSTER_UID:-synthetic-cluster-uid}" \
    EXPECTED_ARGOCD_CLUSTER_UID="${EXPECTED_ARGOCD_CLUSTER_UID:-synthetic-cluster-uid}" \
    WORKLOAD_NAMESPACE="${WORKLOAD_NAMESPACE:-}" \
    ARGOCD_NAMESPACE="${ARGOCD_NAMESPACE:-argocd}" \
    PRD_DATABASE_URL="${PRD_DATABASE_URL_OVERRIDE-postgresql://prd-user:synthetic@db-server-prd-apps.postgres.database.azure.com/klicker?schema=public&sslmode=require}" \
    STG_DATABASE_URL="${STG_DATABASE_URL_OVERRIDE-postgresql://stg-user:synthetic@db-server-stg-apps.postgres.database.azure.com/klicker?schema=public&sslmode=require}" \
    BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY_OVERRIDE-synthetic-test-key}" \
    "$SCRIPT_UNDER_TEST" >"$OUTPUT_FILE" 2>&1
}

write_failed_run_receipt() {
  local failed_run_id="$1"
  local failed_run_dir="$REFRESH_DIR/$failed_run_id"
  mkdir -p "$failed_run_dir"
  jq -n \
    --arg runId "$failed_run_id" \
    '{
      runId: $runId,
      createdAt: "2026-08-21T11:28:45Z",
      source: {
        host: "db-server-prd-apps.postgres.database.azure.com",
        database: "klicker",
        sizeBytes: 1048576,
        tableCount: 200,
        appliedMigrations: 180
      },
      targetBefore: {
        host: "db-server-stg-apps.postgres.database.azure.com",
        database: "klicker",
        sizeBytes: 524288,
        tableCount: 190,
        appliedMigrations: 175
      },
      archiveSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      argocdAutomatedPolicy: {
        prune: true,
        selfHeal: true,
        allowEmpty: false
      }
    }' >"$failed_run_dir/before.json"
  printf '%s\t%s\t%s\n' 'stg-klicker' 'backend' '1' \
    >"$failed_run_dir/deployments.tsv"
}

test_help() {
  new_case help
  if "$SCRIPT_UNDER_TEST" --help >"$OUTPUT_FILE" 2>&1 &&
    assert_contains "$OUTPUT_FILE" 'DRY_RUN=false'; then
    pass 'help is available without external tools'
  else
    fail 'help is available without external tools'
  fi
}

test_dry_run() {
  new_case dry-run
  if BACKUP_ENCRYPTION_KEY_OVERRIDE='' run_refresh &&
    assert_contains "$OUTPUT_FILE" 'DRY_RUN=true' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source' &&
    assert_not_contains "$FAKE_LOG" 'gpg encrypt' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app policy' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app sync' &&
    assert_not_contains "$FAKE_LOG" 'kubectl scale' &&
    [[ ! -e "$REFRESH_DIR" ]]; then
    pass 'dry run performs only read-only preflight checks'
  else
    fail 'dry run performs only read-only preflight checks'
  fi
}

test_confirmation_gate() {
  new_case confirmation
  if ! DRY_RUN=false run_refresh &&
    assert_contains "$OUTPUT_FILE" 'CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app policy' &&
    assert_not_contains "$FAKE_LOG" 'psql metadata'; then
    pass 'execution refuses to start without destructive confirmation'
  else
    fail 'execution refuses to start without destructive confirmation'
  fi
}

test_host_guard() {
  new_case host-guard
  if ! env \
    PATH="$FAKE_BIN:$PATH" \
    FAKE_LOG="$FAKE_LOG" \
    EXPECTED_STG_CLUSTER_UID=synthetic-cluster-uid \
    EXPECTED_ARGOCD_CLUSTER_UID=synthetic-cluster-uid \
    PRD_DATABASE_URL='postgresql://prd-user:synthetic@unexpected.example.com/klicker?sslmode=require' \
    STG_DATABASE_URL='postgresql://stg-user:synthetic@db-server-stg-apps.postgres.database.azure.com/klicker?sslmode=require' \
    BACKUP_ENCRYPTION_KEY='synthetic-test-key' \
    "$SCRIPT_UNDER_TEST" >"$OUTPUT_FILE" 2>&1 &&
    assert_contains "$OUTPUT_FILE" "does not equal expected host" &&
    [[ ! -s "$FAKE_LOG" ]]; then
    pass 'unexpected database host fails closed before connections'
  else
    fail 'unexpected database host fails closed before connections'
  fi
}

test_database_name_guard() {
  new_case database-name-guard
  if ! env \
    PATH="$FAKE_BIN:$PATH" \
    FAKE_LOG="$FAKE_LOG" \
    EXPECTED_STG_CLUSTER_UID=synthetic-cluster-uid \
    EXPECTED_ARGOCD_CLUSTER_UID=synthetic-cluster-uid \
    PRD_DATABASE_URL='postgresql://prd-user:synthetic@db-server-prd-apps.postgres.database.azure.com/not-klicker?sslmode=require' \
    STG_DATABASE_URL='postgresql://stg-user:synthetic@db-server-stg-apps.postgres.database.azure.com/klicker?sslmode=require' \
    BACKUP_ENCRYPTION_KEY='synthetic-test-key' \
    "$SCRIPT_UNDER_TEST" >"$OUTPUT_FILE" 2>&1 &&
    assert_contains "$OUTPUT_FILE" "does not equal expected database" &&
    [[ ! -s "$FAKE_LOG" ]]; then
    pass 'unexpected database name fails closed before connections'
  else
    fail 'unexpected database name fails closed before connections'
  fi
}

test_cluster_identity_guard() {
  new_case cluster-identity-guard
  if ! EXPECTED_STG_CLUSTER_UID=wrong-cluster run_refresh &&
    assert_contains "$OUTPUT_FILE" 'does not match expected cluster identity' &&
    assert_not_contains "$FAKE_LOG" 'kubectl lease create' &&
    assert_not_contains "$FAKE_LOG" 'kubectl scale'; then
    pass 'unexpected Kubernetes cluster identity fails closed before mutation'
  else
    fail 'unexpected Kubernetes cluster identity fails closed before mutation'
  fi
}

test_workload_namespace_guard() {
  new_case workload-namespace-guard
  if ! WORKLOAD_NAMESPACE=unexpected-namespace run_refresh &&
    assert_contains "$OUTPUT_FILE" 'does not match ArgoCD destination namespace' &&
    assert_not_contains "$FAKE_LOG" 'kubectl lease create' &&
    assert_not_contains "$FAKE_LOG" 'kubectl scale'; then
    pass 'unexpected workload namespace fails closed before mutation'
  else
    fail 'unexpected workload namespace fails closed before mutation'
  fi
}

test_migrator_target_guard() {
  new_case migrator-target-guard
  if ! FAKE_MIGRATOR_URL='postgresql://stg-user:synthetic@other-stg.postgres.database.azure.com/klicker?sslmode=require' run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Migrator Secret points to host' &&
    assert_not_contains "$FAKE_LOG" 'kubectl lease create' &&
    assert_not_contains "$FAKE_LOG" 'kubectl scale'; then
    pass 'migrator Secret target must match the validated STG target'
  else
    fail 'migrator Secret target must match the validated STG target'
  fi
}

test_existing_refresh_lease_guard() {
  new_case existing-refresh-lease
  jq -n --arg holder 'other-refresh' '{spec: {holderIdentity: $holder}}' >"$FAKE_LEASE_FILE"
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Refresh Lease' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source' &&
    assert_not_contains "$FAKE_LOG" 'kubectl scale'; then
    pass 'an existing refresh Lease blocks a competing execution'
  else
    fail 'an existing refresh Lease blocks a competing execution'
  fi
}

test_write_rbac_guard() {
  new_case write-rbac-guard
  if ! FAKE_KUBE_CAN_I=deny run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Kubernetes permission denied' &&
    assert_not_contains "$FAKE_LOG" 'kubectl lease create' &&
    assert_not_contains "$FAKE_LOG" 'kubectl scale'; then
    pass 'missing Kubernetes write permission fails during preflight'
  else
    fail 'missing Kubernetes write permission fails during preflight'
  fi
}

test_raw_data_approval_guard() {
  new_case raw-data-approval-guard
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    RAW_PRD_DATA_APPROVAL_REF='' \
    run_refresh &&
    assert_contains "$OUTPUT_FILE" 'RAW_PRD_DATA_APPROVAL_REF' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source'; then
    pass 'raw production-data execution requires an approval reference'
  else
    fail 'raw production-data execution requires an approval reference'
  fi
}

test_run_id_guard() {
  new_case run-id-guard
  if ! RUN_ID_OVERRIDE='../escape' run_refresh &&
    assert_contains "$OUTPUT_FILE" 'RUN_ID must be 1-128 characters' &&
    [[ ! -s "$FAKE_LOG" ]]; then
    pass 'run IDs cannot escape the gitignored receipt directory'
  else
    fail 'run IDs cannot escape the gitignored receipt directory'
  fi
}

test_self_hosted_infisical_credentials() {
  new_case self-hosted-infisical
  if PRD_DATABASE_URL_OVERRIDE='' \
    STG_DATABASE_URL_OVERRIDE='' \
    BACKUP_ENCRYPTION_KEY_OVERRIDE='' \
    DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    run_refresh &&
    assert_contains "$FAKE_LOG" 'infisical get DIRECT_DATABASE_URL from prd via self-hosted project' &&
    assert_contains "$FAKE_LOG" 'infisical get DIRECT_DATABASE_URL from stg via self-hosted project' &&
    assert_contains "$FAKE_LOG" 'infisical get BACKUP_ENCRYPTION_KEY from prd via self-hosted project'; then
    pass 'credentials are loaded from the self-hosted Infisical project'
  else
    fail 'credentials are loaded from the self-hosted Infisical project'
  fi
}

test_prd_connection_failure() {
  new_case prd-connection-failure
  if ! FAKE_PSQL_CONNECT_FAIL=true run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Could not read PRD database metadata' &&
    assert_not_contains "$OUTPUT_FILE" "PRD metadata returned unexpected database ''"; then
    pass 'PRD connection errors fail immediately without a misleading metadata error'
  else
    fail 'PRD connection errors fail immediately without a misleading metadata error'
  fi
}

test_existing_maintenance_mode() {
  new_case existing-maintenance
  printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"
  if ! run_refresh &&
    assert_contains "$OUTPUT_FILE" 'automated sync is disabled before refresh' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source' &&
    assert_not_contains "$FAKE_LOG" 'kubectl scale'; then
    pass 'an unfinished maintenance state must be recovered before another refresh'
  else
    fail 'an unfinished maintenance state must be recovered before another refresh'
  fi
}

test_resume_failed_refresh() {
  new_case resume-failed-refresh
  write_failed_run_receipt previous-failure
  printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"
  : >"$FAKE_WORKLOADS_SCALED_FILE"

  if RESUME_FAILED_RUN_ID_OVERRIDE=previous-failure \
    RUN_ID_OVERRIDE=resume-run \
    FAKE_STG_EMPTY_BEFORE=true \
    DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    run_refresh &&
    [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == "automated" ]] &&
    [[ ! -e "$REFRESH_DIR/previous-failure/after.json" ]] &&
    [[ -f "$REFRESH_DIR/resume-run/before.json" ]] &&
    [[ -f "$REFRESH_DIR/resume-run/after.json" ]] &&
    jq -e '.resumedFromRunId == "previous-failure"' \
      "$REFRESH_DIR/resume-run/before.json" >/dev/null &&
    assert_contains "$FAKE_LOG" 'pg_restore target database=klicker' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app policy manual' &&
    assert_contains "$OUTPUT_FILE" "Resuming fail-safe maintenance from run 'previous-failure'" &&
    assert_contains "$OUTPUT_FILE" 'refresh completed successfully'; then
    pass 'a receipt-bound resume safely completes a reset-before-restore failure'
  else
    fail 'a receipt-bound resume safely completes a reset-before-restore failure'
  fi
}

test_resume_rejects_running_workload() {
  new_case resume-running-workload
  write_failed_run_receipt previous-failure
  printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"

  if ! RESUME_FAILED_RUN_ID_OVERRIDE=previous-failure run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Cannot resume while any selected STG Deployment has desired or running replicas' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source' &&
    [[ ! -e "$REFRESH_DIR/test-run" ]]; then
    pass 'resume refuses to continue until every selected workload is stopped'
  else
    fail 'resume refuses to continue until every selected workload is stopped'
  fi
}

test_resume_rejects_mismatched_receipt() {
  new_case resume-mismatched-receipt
  write_failed_run_receipt previous-failure
  local before_receipt="$REFRESH_DIR/previous-failure/before.json"
  jq '.targetBefore.database = "unexpected-target"' "$before_receipt" \
    >"$before_receipt.tmp"
  mv -- "$before_receipt.tmp" "$before_receipt"
  printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"
  : >"$FAKE_WORKLOADS_SCALED_FILE"

  if ! RESUME_FAILED_RUN_ID_OVERRIDE=previous-failure run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Resume receipt does not match the current source, target, or prior automated-sync state' &&
    assert_not_contains "$FAKE_LOG" 'pg_dump source' &&
    [[ ! -e "$REFRESH_DIR/test-run" ]]; then
    pass 'resume refuses a receipt for a different database endpoint'
  else
    fail 'resume refuses a receipt for a different database endpoint'
  fi
}

test_successful_refresh() {
  new_case success
  if DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    run_refresh &&
    [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == "automated" ]] &&
    [[ -f "$REFRESH_DIR/test-run/before.json" ]] &&
    [[ -f "$REFRESH_DIR/test-run/after.json" ]] &&
    [[ ! -e "$REFRESH_DIR/test-run/prd.dump.gpg" ]] &&
    assert_not_contains "$REFRESH_DIR/test-run/before.json" 'synthetic-test-key' &&
    assert_not_contains "$REFRESH_DIR/test-run/before.json" 'prd-user' &&
    jq -e '.argocdAutomatedPolicy == {
      "prune": true,
      "selfHeal": true,
      "allowEmpty": false
    }' "$REFRESH_DIR/test-run/before.json" >/dev/null &&
    assert_contains "$FAKE_LOG" 'pg_restore list' &&
    assert_before "$FAKE_LOG" 'pg_dump source' 'kubectl app policy manual' &&
    assert_before "$FAKE_LOG" 'kubectl app policy manual' 'kubectl scale' &&
    assert_before "$FAKE_LOG" 'kubectl scale' 'psql reset target' &&
    assert_before "$FAKE_LOG" 'psql reset target' 'pg_restore target database=klicker' &&
    assert_before "$FAKE_LOG" 'pg_restore target database=klicker' 'kubectl app sync hook' &&
    assert_before "$FAKE_LOG" 'kubectl app sync hook' 'kubectl app policy automated' &&
    assert_contains "$FAKE_LOG" 'kubectl app policy automated {"prune":true,"selfHeal":true,"allowEmpty":false}' &&
    assert_contains "$OUTPUT_FILE" 'refresh completed successfully'; then
    pass 'successful refresh follows the guarded dump, restore, hook, verify sequence'
  else
    fail 'successful refresh follows the guarded dump, restore, hook, verify sequence'
  fi
}

test_catalog_validation_drains_decrypted_archive() {
  new_case catalog-validation-drain
  if DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    FAKE_CATALOG_READS_PREFIX_ONLY=true \
    run_refresh &&
    assert_contains "$FAKE_LOG" 'pg_restore list' &&
    assert_contains "$OUTPUT_FILE" 'refresh completed successfully'; then
    pass 'catalog validation drains decrypted data after pg_restore stops reading'
  else
    fail 'catalog validation drains decrypted data after pg_restore stops reading'
  fi
}

test_public_schema_owner_is_not_required() {
  new_case public-schema-owner
  if DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    FAKE_PUBLIC_SCHEMA_NOT_OWNED=true \
    run_refresh &&
    assert_contains "$FAKE_LOG" 'psql reset target' &&
    assert_contains "$OUTPUT_FILE" 'refresh completed successfully' &&
    assert_not_contains "$OUTPUT_FILE" 'must be owner of schema public'; then
    pass 'refresh preserves public when the STG role does not own the schema'
  else
    fail 'refresh preserves public when the STG role does not own the schema'
  fi
}

test_restore_failure() {
  new_case restore-failure
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    FAKE_PG_RESTORE_FAIL=true \
    run_refresh &&
    [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == "manual" ]] &&
    [[ -f "$FAKE_WORKLOADS_SCALED_FILE" ]] &&
    assert_contains "$OUTPUT_FILE" 'STG pg_restore failed' &&
    assert_contains "$OUTPUT_FILE" 'fail-safe maintenance mode' &&
    assert_contains "$OUTPUT_FILE" 'Do not submit an ArgoCD sync' &&
    assert_contains "$OUTPUT_FILE" 'RESUME_FAILED_RUN_ID=test-run' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app sync hook'; then
    pass 'restore failure keeps STG stopped and automated sync disabled'
  else
    fail 'restore failure keeps STG stopped and automated sync disabled'
  fi
}

test_migration_failure() {
  new_case migration-failure
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    FAKE_ARGO_SYNC_FAIL=true \
    run_refresh &&
    [[ "$(<"$FAKE_ARGO_POLICY_FILE")" == "manual" ]] &&
    [[ -f "$FAKE_WORKLOADS_SCALED_FILE" ]] &&
    assert_contains "$OUTPUT_FILE" 'ArgoCD sync or PreSync migration hook failed' &&
    assert_contains "$OUTPUT_FILE" 'fail-safe maintenance mode' &&
    assert_contains "$OUTPUT_FILE" 'After confirming the restored snapshot is intact, retry the hook sync' &&
    [[ "$(grep -Fc 'kubectl scale' "$FAKE_LOG")" -ge 2 ]]; then
    pass 'migration-hook failure forces STG back to maintenance mode'
  else
    fail 'migration-hook failure forces STG back to maintenance mode'
  fi
}

test_timeout_terminates_operation() {
  new_case timeout-terminates-operation
  if ! DRY_RUN=false \
    ARGOCD_TIMEOUT_SECONDS=1 \
    ARGOCD_POLL_SECONDS=1 \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    FAKE_ARGO_OPERATION_RUNNING=true \
    run_refresh &&
    assert_contains "$OUTPUT_FILE" 'did not complete within 1 seconds' &&
    assert_contains "$FAKE_LOG" 'kubectl app operation terminate' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app policy automated'; then
    pass 'a timed-out ArgoCD operation is terminated before recovery'
  else
    fail 'a timed-out ArgoCD operation is terminated before recovery'
  fi
}

test_migration_history_guard() {
  new_case migration-history-guard
  if ! DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    FAKE_MIGRATION_HISTORY_MODE=divergent \
    run_refresh &&
    assert_contains "$OUTPUT_FILE" 'do not extend the PRD history' &&
    assert_not_contains "$FAKE_LOG" 'kubectl app policy automated'; then
    pass 'divergent migration history fails closed after the hook'
  else
    fail 'divergent migration history fails closed after the hook'
  fi
}

test_replay_lock() {
  new_case replay-lock
  if DRY_RUN=false \
    CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
    ALLOW_RAW_PRD_DATA_IN_STG=true \
    run_refresh &&
    ! DRY_RUN=false \
      CONFIRM_PRD_TO_STG_REFRESH=ERASE_STG_AND_COPY_PRD \
      ALLOW_RAW_PRD_DATA_IN_STG=true \
      run_refresh &&
    assert_contains "$OUTPUT_FILE" 'Run directory already exists'; then
    pass 'a completed run ID cannot be replayed'
  else
    fail 'a completed run ID cannot be replayed'
  fi
}

test_help
test_dry_run
test_confirmation_gate
test_host_guard
test_database_name_guard
test_cluster_identity_guard
test_workload_namespace_guard
test_migrator_target_guard
test_existing_refresh_lease_guard
test_write_rbac_guard
test_raw_data_approval_guard
test_run_id_guard
test_self_hosted_infisical_credentials
test_prd_connection_failure
test_existing_maintenance_mode
test_resume_failed_refresh
test_resume_rejects_running_workload
test_resume_rejects_mismatched_receipt
test_successful_refresh
test_catalog_validation_drains_decrypted_archive
test_public_schema_owner_is_not_required
test_restore_failure
test_migration_failure
test_timeout_terminates_operation
test_migration_history_guard
test_replay_lock

printf '1..%s\n' "$TEST_COUNT"
(( FAIL_COUNT == 0 ))
