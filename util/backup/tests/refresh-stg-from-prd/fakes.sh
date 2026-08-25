# Sourced by refresh-stg-from-prd.test.sh and its fake-tool symlinks.
# Contract: provides deterministic URL fixtures and fake external command
# implementations. It reads only FAKE_* state paths supplied by the harness.

prd_database_url() {
  printf '%s://%s:%s@%s:%s/%s?sslmode=require&schema=public' \
    postgresql prd-user synthetic \
    db-server-prd-apps.postgres.database.azure.com 6432 klicker-prod-prd
}

stg_database_url() {
  local database="${1:-klicker-qa-stg}"
  local user="${2:-stg-user}"
  printf '%s://%s:%s@%s:%s/%s?sslmode=require&schema=public' \
    postgresql "$user" synthetic \
    db-server-stg-apps.postgres.database.azure.com 6432 "$database"
}

migration_history() {
  printf '%s\n%s' \
    '20260101000000_initial|checksum-initial' \
    '20260202000000_feature|checksum-feature'
}

fake_log() {
  printf '%s\n' "$*" >>"$FAKE_LOG"
}

fake_infisical() {
  [[ " $* " == *" --domain=https://inf.prd.df-app.ch/api "* ]] || return 2
  [[ " $* " == *" --projectId=d071be96-5136-4f23-a6cb-e0c7f9b9a6c8 "* ]] \
    || return 2

  local secret_name="${3:-}" environment="" argument
  for argument in "$@"; do
    [[ "$argument" == --env=* ]] && environment="${argument#--env=}"
  done
  fake_log "infisical get $secret_name from $environment via self-hosted project"
  case "$secret_name:$environment" in
    DIRECT_DATABASE_URL:prd) prd_database_url ;;
    DIRECT_DATABASE_URL:stg) stg_database_url ;;
    BACKUP_ENCRYPTION_KEY:prd) printf '%s' synthetic-test-key ;;
    *) return 2 ;;
  esac
}

fake_az() {
  if [[ " $* " == *" postgres flexible-server show "* ]]; then
    jq -cn '{
      id: "/subscriptions/synthetic/resourceGroups/DF_Klicker_RG/providers/Microsoft.DBforPostgreSQL/flexibleServers/db-server-stg-apps",
      name: "db-server-stg-apps",
      fullyQualifiedDomainName: "db-server-stg-apps.postgres.database.azure.com",
      storage: {storageSizeGb: 32}
    }'
  elif [[ " $* " == *" monitor metrics list "* ]]; then
    local free_bytes=21474836480
    [[ "${FAKE_STORAGE_LOW:-false}" != true ]] || free_bytes=1048576
    local measured_at
    measured_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    jq -cn \
      --arg measuredAt "$measured_at" \
      --argjson free "$free_bytes" '{value: [
        {
          name: {value: "storage_used"},
          unit: "Bytes",
          timeseries: [{data: [{maximum: 10737418240, timeStamp: $measuredAt}]}]
        },
        {
          name: {value: "storage_free"},
          unit: "Bytes",
          timeseries: [{data: [{maximum: $free, minimum: $free, timeStamp: $measuredAt}]}]
        },
        {
          name: {value: "txlogs_storage_used"},
          unit: "Bytes",
          timeseries: [{data: [{maximum: 1073741824, timeStamp: $measuredAt}]}]
        }
      ]}'
  else
    return 2
  fi
}

deployment_replicas() {
  local name="$1"
  local default_replicas="$2"
  local file="$FAKE_STATE_DIR/$name.replicas"
  if [[ -f "$file" ]]; then
    printf '%s' "$(<"$file")"
  else
    printf '%s' "$default_replicas"
  fi
}

fake_deployments_json() {
  local backend worker backend_ready worker_ready
  backend="$(deployment_replicas backend 1)"
  worker="$(deployment_replicas worker 2)"
  backend_ready="$backend"
  worker_ready="$worker"
  if [[ "${FAKE_HEALTH_FAIL:-false}" == "true" && -f "$FAKE_SYNCED_FILE" ]]; then
    backend_ready=0
  fi
  local deployments_json
  deployments_json="$(jq -cn \
    --argjson backend "$backend" --argjson worker "$worker" \
    --argjson backendReady "$backend_ready" --argjson workerReady "$worker_ready" '
      {items: [
        {
          metadata: {namespace: "stg-klicker", name: "backend", generation: 1},
          spec: {replicas: $backend},
          status: {
            replicas: $backendReady,
            readyReplicas: $backendReady,
            updatedReplicas: $backendReady,
            availableReplicas: $backendReady,
            observedGeneration: 1
          }
        },
        {
          metadata: {namespace: "stg-klicker", name: "worker", generation: 1},
          spec: {replicas: $worker},
          status: {
            replicas: $workerReady,
            readyReplicas: $workerReady,
            updatedReplicas: $workerReady,
            availableReplicas: $workerReady,
            observedGeneration: 1
          }
        }
      ]}
    ')"
  if [[ "${FAKE_POST_MUTATION_WORKLOAD_DRIFT:-false}" == true &&
    -f "$FAKE_SYNCED_FILE" ]]; then
    jq -c '.items |= map(select(.metadata.name != "backend"))' \
      <<<"$deployments_json"
  else
    printf '%s\n' "$deployments_json"
  fi
}

fake_deployment_json() {
  local name="$1" default_replicas desired running
  case "$name" in
    backend) default_replicas=1 ;;
    worker) default_replicas=2 ;;
    *) return 1 ;;
  esac
  desired="$(deployment_replicas "$name" "$default_replicas")"
  running="$desired"
  if [[ "${FAKE_POST_MUTATION_WORKLOAD_DRIFT:-false}" == true &&
    -f "$FAKE_SYNCED_FILE" && "$name" == backend ]]; then
    running=1
  fi
  jq -cn \
    --arg name "$name" \
    --argjson desired "$desired" \
    --argjson running "$running" '{
      metadata: {namespace: "stg-klicker", name: $name, generation: 1},
      spec: {replicas: $desired},
      status: {
        replicas: $running,
        readyReplicas: $running,
        updatedReplicas: $running,
        availableReplicas: $running,
        observedGeneration: 1
      }
    }'
}

fake_argocd_application_json() {
  local policy automated initiator="" phase="Succeeded" message="success"
  local active_operation='null' sync_revision health_status="Healthy"
  policy="$(<"$FAKE_ARGO_POLICY_FILE")"
  automated='null'
  if [[ "$policy" == automated ]]; then
    automated='{"prune":true,"selfHeal":true,"allowEmpty":false}'
  fi
  [[ ! -f "$FAKE_OPERATION_FILE" ]] || initiator="$(<"$FAKE_OPERATION_FILE")"
  sync_revision='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

  if [[ -z "$initiator" && "${FAKE_COMPETING_SYNC:-false}" == true &&
    "$policy" == manual ]]; then
    initiator=another-operator
    phase=Running
    message="synthetic competing operation"
    active_operation="$(
      jq -cn --arg initiator "$initiator" \
        '{initiatedBy:{username:$initiator},sync:{syncStrategy:{hook:{}}}}'
    )"
  fi

  if [[ "${FAKE_POST_POLICY_OPERATION:-false}" == true &&
    "$policy" == automated && -f "$FAKE_SYNCED_FILE" ]]; then
    initiator=post-policy-operator
    phase=Running
    message="synthetic operation after policy restoration"
    active_operation="$(
      jq -cn --arg initiator "$initiator" \
        '{initiatedBy:{username:$initiator},sync:{syncStrategy:{hook:{}}}}'
    )"
  fi

  if [[ -n "$initiator" ]]; then
    if [[ "${FAKE_ARGO_TIMEOUT:-false}" == "true" && ! -f "$FAKE_TERMINATED_FILE" ]]; then
      phase="Running"
      message="synthetic long-running operation"
      active_operation="$(
        jq -cn --arg initiator "$initiator" \
          '{initiatedBy:{username:$initiator},sync:{syncStrategy:{hook:{}}}}'
      )"
    elif [[ "${FAKE_ARGO_SYNC_FAIL:-false}" == "true" || -f "$FAKE_TERMINATED_FILE" ]]; then
      phase="Failed"
      message="synthetic migration failure"
    fi
  fi
  [[ "${FAKE_HEALTH_FAIL:-false}" != "true" || -z "$initiator" ]] \
    || health_status="Degraded"

  jq -cn \
    --argjson automated "$automated" \
    --argjson operation "$active_operation" \
    --arg initiator "$initiator" \
    --arg phase "$phase" \
    --arg message "$message" \
    --arg revision "$sync_revision" \
    --arg health "$health_status" '
      {
        metadata: {
          uid: "9f936f7f-58ff-4a72-8c75-eb969ac3bd6f",
          resourceVersion: "42"
        },
        spec: {
          project: "stg-apps-klicker",
          destination: {
            server: "https://kubernetes.default.svc",
            namespace: "stg-klicker"
          },
          source: {
            repoURL: "https://github.com/uzh-bf/klicker-uzh.git",
            targetRevision: "v3"
          },
          syncPolicy: {automated: $automated}
        },
        operation: $operation,
        status: {
          sync: {status: "Synced", revision: $revision},
          health: {status: $health},
          operationState: {
            phase: $phase,
            message: $message,
            operation: {
              initiatedBy: {username: $initiator},
              sync: {syncStrategy: {hook: {}}}
            },
            syncResult: {revision: $revision}
          }
        }
      }
    '
}

extract_patch_payload() {
  local expect=false argument
  for argument in "$@"; do
    if [[ "$expect" == true ]]; then
      printf '%s' "$argument"
      return
    fi
    [[ "$argument" == --patch ]] && expect=true
  done
  return 2
}

fake_kubectl() {
  if [[ " $* " == *" config view --minify -o json "* ]]; then
    local server_name=stg-apps-vhziuhfl.hcp.switzerlandnorth.azmk8s.io
    [[ "${FAKE_CLUSTER_MISMATCH:-false}" != true ]] || server_name=wrong.example.test
    jq -cn --arg name "$server_name" \
      '{clusters:[{cluster:{"tls-server-name":$name,server:"https://127.0.0.1:6443"}}]}'
  elif [[ " $* " == *" get namespace kube-system "* ]]; then
    printf '%s\n' '{"metadata":{"uid":"207f1b0e-5ad7-4de6-94d1-2b4564a41fe7"}}'
  elif [[ " $* " == *" get namespace stg-klicker "* ]]; then
    printf '%s\n' '{"metadata":{"uid":"ae9b8ae9-d3df-4078-820d-1ef69d4cf816"}}'
  elif [[ " $* " == *" auth can-i "* ]]; then
    [[ "${FAKE_RBAC_DENY:-false}" != true ]] || return 1
  elif [[ " $* " == *" get application.argoproj.io "* ]]; then
    fake_argocd_application_json
  elif [[ " $* " == *" get appproject.argoproj.io "* ]]; then
    cat "$FAKE_PROJECT_FILE"
  elif [[ " $* " == *" patch appproject.argoproj.io "* ]]; then
    local patch_payload
    patch_payload="$(extract_patch_payload "$@")"
    local expected_resource_version current_resource_version windows
    expected_resource_version="$(jq -r '.[0].value // ""' <<<"$patch_payload")"
    current_resource_version="$(jq -r '.metadata.resourceVersion // ""' "$FAKE_PROJECT_FILE")"
    [[ "$expected_resource_version" == "$current_resource_version" ]] || return 1
    windows="$(jq -c '.[2].value' <<<"$patch_payload")"
    if [[ "${FAKE_CLEANUP_FENCE_FAIL:-false}" == true &&
      -f "$FAKE_SYNCED_FILE" && "$windows" != '[]' ]]; then
      return 1
    fi
    jq --argjson windows "$windows" \
      '.metadata.resourceVersion = ((.metadata.resourceVersion | tonumber) + 1 | tostring) |
       .spec.syncWindows = $windows' \
      "$FAKE_PROJECT_FILE" >"$FAKE_PROJECT_FILE.tmp"
    mv -- "$FAKE_PROJECT_FILE.tmp" "$FAKE_PROJECT_FILE"
    fake_log "kubectl appproject sync windows $(jq -c '.spec.syncWindows' "$FAKE_PROJECT_FILE")"
  elif [[ " $* " == *" patch application.argoproj.io "* ]]; then
    local patch_payload
    patch_payload="$(extract_patch_payload "$@")"
    if jq -e 'type == "array"' >/dev/null <<<"$patch_payload"; then
      if [[ " $* " == *" --subresource=status "* ]]; then
        : >"$FAKE_TERMINATED_FILE"
        fake_log 'kubectl app operation terminated'
      else
        [[ "${FAKE_CAS_RACE:-false}" != true ]] || return 1
        [[ "$(jq -r '.[0].value // ""' <<<"$patch_payload")" == 42 ]] || return 2
        [[ "$(jq -r '.[2].value.sync.revision // ""' <<<"$patch_payload")" == \
          aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ]] || return 2
        jq -r '.[2].value.initiatedBy.username' <<<"$patch_payload" \
          >"$FAKE_OPERATION_FILE"
        : >"$FAKE_SYNCED_FILE"
        printf '%s' 1 >"$FAKE_STATE_DIR/backend.replicas"
        printf '%s' 2 >"$FAKE_STATE_DIR/worker.replicas"
        fake_log 'kubectl app sync hook atomic'
      fi
    elif jq -e '.operation.sync != null' >/dev/null <<<"$patch_payload"; then
      return 2
    elif jq -e '.spec.syncPolicy | has("automated")' >/dev/null \
      <<<"$patch_payload"; then
      local automated
      automated="$(jq -c '.spec.syncPolicy.automated' <<<"$patch_payload")"
      if [[ "$automated" == null ]]; then
        printf '%s' manual >"$FAKE_ARGO_POLICY_FILE"
        fake_log 'kubectl app policy manual'
      else
        if [[ "${FAKE_POLICY_RESTORE_FAIL:-false}" == true && -f "$FAKE_SYNCED_FILE" ]]; then
          return 1
        fi
        printf '%s' automated >"$FAKE_ARGO_POLICY_FILE"
        fake_log "kubectl app policy automated $automated"
      fi
    else
      return 2
    fi
  elif [[ " $* " == *" get secret "* ]]; then
    local database=klicker-qa-stg
    [[ "${FAKE_MIGRATOR_MISMATCH:-false}" != true ]] || database=wrong-stg
    stg_database_url "$database" migrator-user | base64 | tr -d '\n'
  elif [[ " $* " == *" get deployments "* ]]; then
    fake_deployments_json
  elif [[ " $* " == *" get deployment/"* ]]; then
    local argument deployment_name=""
    for argument in "$@"; do
      [[ "$argument" == deployment/* ]] && deployment_name="${argument#deployment/}"
    done
    [[ -n "$deployment_name" ]] || return 2
    fake_deployment_json "$deployment_name"
  elif [[ " $* " == *" scale deployment/"* ]]; then
    local argument name="" replicas=""
    for argument in "$@"; do
      [[ "$argument" == deployment/* ]] && name="${argument#deployment/}"
      [[ "$argument" == --replicas=* ]] && replicas="${argument#--replicas=}"
    done
    [[ -n "$name" && -n "$replicas" ]] || return 2
    if [[ "${FAKE_CLEANUP_SCALE_FAIL:-false}" == true &&
      -f "$FAKE_SYNCED_FILE" && "$replicas" == 0 ]]; then
      return 1
    fi
    if [[ "${FAKE_PARTIAL_SCALE_FAIL:-false}" == true && "$name" == worker && "$replicas" == 0 ]]; then
      return 1
    fi
    printf '%s' "$replicas" >"$FAKE_STATE_DIR/$name.replicas"
    fake_log "kubectl scale $name=$replicas"
  elif [[ " $* " == *" get pods "*" --watch "* ]]; then
    local attempt
    for attempt in {1..100}; do
      [[ ! -f "$FAKE_SYNCED_FILE" ]] || break
      sleep 0.02
    done
    [[ -f "$FAKE_SYNCED_FILE" ]] || return 0
    local evidence_job_uid=synthetic-new-job-uid
    local evidence_image_id=ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    [[ "${FAKE_STALE_MIGRATOR_EVIDENCE:-false}" != true ]] \
      || evidence_job_uid=synthetic-stale-job-uid
    [[ "${FAKE_WRONG_MIGRATOR_DIGEST:-false}" != true ]] \
      || evidence_image_id=ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm@sha256:not-a-digest
    jq -cn --arg jobUid "$evidence_job_uid" --arg imageId "$evidence_image_id" '{
      type: "MODIFIED",
      object: {
        metadata: {
          uid: "synthetic-migrator-pod-uid",
          ownerReferences: [{kind: "Job", name: "app-klicker-klicker-uzh-v2-migrate", uid: $jobUid}]
        },
        spec: {containers: [{name: "migrate", image: "ghcr.io/uzh-bf/klicker-uzh/backend-docker-migrator-arm:v3"}]},
        status: {containerStatuses: [{name: "migrate", imageID: $imageId}]}
      }
    }'
  elif [[ " $* " == *" get job "* ]]; then
    if [[ ! -f "$FAKE_SYNCED_FILE" ]]; then
      [[ "${FAKE_STALE_MIGRATOR_EVIDENCE:-false}" == true ]] || return 0
      printf '%s\n' '{"metadata":{"uid":"synthetic-stale-job-uid"}}'
      return 0
    fi
    printf '%s\n' '{"metadata":{"uid":"synthetic-new-job-uid"}}'
  elif [[ " $* " == *" get lease.coordination.k8s.io "* ]]; then
    if [[ -f "$FAKE_LEASE_FILE" ]]; then
      local lease_reads=0
      [[ ! -f "$FAKE_LEASE_READS_FILE" ]] \
        || lease_reads="$(<"$FAKE_LEASE_READS_FILE")"
      lease_reads=$((lease_reads + 1))
      printf '%s' "$lease_reads" >"$FAKE_LEASE_READS_FILE"
      if [[ "${FAKE_LEASE_LOSS:-false}" == true && "$lease_reads" -ge 4 ]]; then
        jq '.spec.holderIdentity = "another-refresh"' "$FAKE_LEASE_FILE"
      else
        cat "$FAKE_LEASE_FILE"
      fi
    fi
  elif [[ " $* " == *" create -f - "* || " $* " == *" replace -f - "* ]]; then
    cat >"$FAKE_LEASE_FILE"
    fake_log 'kubectl lease write'
  else
    return 2
  fi
}

fake_pg_dump() {
  if [[ "${1:-}" == --version ]]; then
    printf '%s\n' 'pg_dump (PostgreSQL) 17.4'
    return
  fi
  [[ "${PGHOST:-}" == db-server-prd-apps.postgres.database.azure.com ]] || return 2
  [[ "${PGPORT:-}" == 6432 && "${PGDATABASE:-}" == klicker-prod-prd ]] || return 2
  fake_log 'pg_dump source'
  printf '%s\n' 'synthetic custom archive'
}

fake_gpg() {
  if [[ " $* " == *" --decrypt "* ]]; then
    fake_log 'gpg decrypt'
    cat "${*: -1}"
    return
  fi
  local output="" expect=false argument
  for argument in "$@"; do
    if [[ "$expect" == true ]]; then
      output="$argument"
      expect=false
    elif [[ "$argument" == --output ]]; then
      expect=true
    fi
  done
  [[ -n "$output" ]] || return 2
  fake_log 'gpg encrypt'
  cat >"$output"
}

fake_pg_restore() {
  if [[ "${1:-}" == --version ]]; then
    printf '%s\n' 'pg_restore (PostgreSQL) 17.4'
    return
  fi
  if [[ " $* " == *" --list "* ]]; then
    cat >/dev/null
    printf '%s\n' \
      '; synthetic archive catalog' \
      '5; 2615 2200 SCHEMA - public prd-user' \
      '100; 0 0 COMMENT - SCHEMA public prd-user' \
      '200; 1259 12345 TABLE public Example prd-user'
    fake_log 'pg_restore list'
    return
  fi
  [[ "${PGHOST:-}" == db-server-stg-apps.postgres.database.azure.com ]] || return 2
  [[ "${PGPORT:-}" == 6432 && "${PGDATABASE:-}" == klicker-qa-stg ]] || return 2
  [[ " $* " == *" --dbname=klicker-qa-stg "* ]] || return 2
  cat >/dev/null
  [[ "${FAKE_PG_RESTORE_FAIL:-false}" != true ]] || return 1
  : >"$FAKE_RESTORED_FILE"
  fake_log 'pg_restore target database=klicker-qa-stg'
}

fake_psql() {
  if [[ "${FAKE_PSQL_CONNECT_FAIL:-false}" == true &&
    "${PGHOST:-}" == db-server-prd-apps.postgres.database.azure.com ]]; then
    printf '%s\n' 'psql: error: synthetic connection failure' >&2
    return 2
  fi
  [[ "${PGPORT:-}" == 6432 ]] || return 2

  if [[ " $* " == *" klicker_database_identity "* ]]; then
    if [[ "${PGDATABASE:-}" == klicker-prod-prd ]]; then
      printf '%s\n' 'klicker-prod-prd|101|170000|10.0.0.1|6432'
    elif [[ "${PGDATABASE:-}" == klicker-qa-stg ]]; then
      printf '%s\n' 'klicker-qa-stg|202|170000|10.0.0.2|6432'
    else
      printf '%s|999|170000|10.0.0.2|6432\n' "${PGDATABASE:-}"
    fi
    return
  fi

  if [[ " $* " == *" klicker_migration_history "* ]]; then
    if [[ "${PGDATABASE:-}" == klicker-prod-prd || ! -f "$FAKE_SYNCED_FILE" ]]; then
      migration_history
    elif [[ "${FAKE_MIGRATION_DIVERGENCE:-false}" == true ]]; then
      printf '%s\n%s\n%s' \
        '20260101000000_initial|checksum-initial' \
        '20260202000000_feature|different-checksum' \
        '20260303000000_new|checksum-new'
    else
      migration_history
      printf '\n%s' '20260303000000_new|checksum-new'
    fi
    return
  fi

  if [[ " $* " == *" klicker_stg_reset_capabilities "* ]]; then
    printf '%s\n' 'klicker-qa-stg|stg-user|azure_pg_admin|t|253|0|0|0|0'
    return
  fi
  if [[ " $* " == *"reset-stg-owned-objects.sql "* ]]; then
    fake_log 'psql reset target'
    return
  fi

  if [[ "${PGDATABASE:-}" == klicker-prod-prd ]]; then
    if [[ " $* " == *" klicker_database_metadata_core "* ]]; then
      printf '%s\n' 'klicker-prod-prd|170000|1048576|200|1|0|0'
    elif [[ " $* " == *" klicker_database_metadata_migrations "* ]]; then
      printf '%s\n' '2|0'
    else
      return 2
    fi
    return
  fi
  [[ "${PGDATABASE:-}" == klicker-qa-stg ]] || return 2
  if [[ " $* " == *" klicker_database_metadata_core "* ]]; then
    if [[ "${FAKE_POST_SYNC_METADATA_FAIL:-false}" == true && -f "$FAKE_SYNCED_FILE" ]]; then
      return 2
    elif [[ -f "$FAKE_SYNCED_FILE" ]]; then
      printf '%s\n' 'klicker-qa-stg|170000|1100000|205|1|0|0'
    elif [[ -f "$FAKE_RESTORED_FILE" ]]; then
      printf '%s\n' 'klicker-qa-stg|170000|1048576|200|1|0|0'
    else
      printf '%s\n' 'klicker-qa-stg|170000|524288|190|1|0|0'
    fi
  elif [[ " $* " == *" klicker_database_metadata_migrations "* ]]; then
    if [[ -f "$FAKE_SYNCED_FILE" ]]; then
      printf '%s\n' '3|0'
    elif [[ -f "$FAKE_RESTORED_FILE" ]]; then
      printf '%s\n' '2|0'
    else
      printf '%s\n' '1|0'
    fi
  else
    return 2
  fi
}

dispatch_fake_tool() {
  case "$(basename "$0")" in
    az) fake_az "$@" ;;
    gpg) fake_gpg "$@" ;;
    infisical) fake_infisical "$@" ;;
    kubectl) fake_kubectl "$@" ;;
    pg_dump) fake_pg_dump "$@" ;;
    pg_restore) fake_pg_restore "$@" ;;
    psql) fake_psql "$@" ;;
    *) return 2 ;;
  esac
}
