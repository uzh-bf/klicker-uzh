# Sourced by refresh-stg-from-prd.sh; do not execute directly.
# Contract: owns the app-scoped maintenance fence, automated-sync policy,
# atomic Argo operation lifecycle, migrator evidence, and terminal health proof.
# It reads immutable Argo/Kubernetes config and updates only Argo/migrator state
# globals plus the current run evidence file through set_run_phase.

get_argocd_application() {
  kubectl_for_argocd get application.argoproj.io "$ARGOCD_APP" -o json
}

patch_argocd_application() {
  local patch_payload="$1"
  kubectl_for_argocd patch application.argoproj.io "$ARGOCD_APP" --type merge \
    --patch "$patch_payload"
}

patch_argocd_application_json() {
  local patch_payload="$1"
  kubectl_for_argocd patch application.argoproj.io "$ARGOCD_APP" --type json \
    --patch "$patch_payload"
}

patch_argocd_application_status_json() {
  local patch_payload="$1"
  kubectl_for_argocd patch application.argoproj.io "$ARGOCD_APP" --type json \
    --subresource=status --patch "$patch_payload"
}

build_argocd_sync_patch() {
  local initiator="$1"
  local revision="$2"
  local resource_version="$3"
  jq -cn \
    --arg initiator "$initiator" \
    --arg revision "$revision" \
    --arg resourceVersion "$resource_version" \
    --arg uid "$EXPECTED_ARGOCD_APP_UID" '
      [
        {
          op: "test",
          path: "/metadata/resourceVersion",
          value: $resourceVersion
        },
        {op: "test", path: "/metadata/uid", value: $uid},
        {
          op: "add",
          path: "/operation",
          value: {
            initiatedBy: {username: $initiator},
            sync: {
              revision: $revision,
              syncStrategy: {hook: {}}
            }
          }
        }
      ]
    '
}

build_argocd_policy_patch() {
  jq -cn --argjson automated "$1" \
    '{spec: {syncPolicy: {automated: $automated}}}'
}

get_argocd_project() {
  kubectl_for_argocd get appproject.argoproj.io "$EXPECTED_ARGOCD_PROJECT" -o json
}

patch_argocd_project_json() {
  local patch_payload="$1"
  kubectl_for_argocd patch appproject.argoproj.io "$EXPECTED_ARGOCD_PROJECT" \
    --type json --patch "$patch_payload"
}

maintenance_sync_window() {
  jq -cn --arg application "$ARGOCD_APP" '{
    kind: "deny",
    schedule: "* * * * *",
    duration: "1h",
    applications: [$application],
    manualSync: false
  }'
}

json_values_equal() {
  jq -en --argjson actual "$1" --argjson expected "$2" \
    '$actual == $expected' >/dev/null
}

load_argocd_state() {
  local application_json
  application_json="$(get_argocd_application)" \
    || die "Could not read ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP' using context '$ARGOCD_KUBE_CONTEXT'"

  local operation_phase
  operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
  if jq -e '.operation != null' >/dev/null <<<"$application_json"; then
    die "ArgoCD Application '$ARGOCD_APP' already has a pending operation"
  fi
  [[ "$operation_phase" != "Running" && "$operation_phase" != "Terminating" ]] \
    || die "ArgoCD application '$ARGOCD_APP' already has a running operation"
  PINNED_ARGOCD_REVISION="$(jq -r '.status.sync.revision // ""' <<<"$application_json")"
  [[ "$PINNED_ARGOCD_REVISION" =~ ^[0-9a-f]{40}$ ]] \
    || die "ArgoCD Application does not expose an immutable comparison revision"

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

expected_fenced_sync_windows() {
  local fence
  fence="$(maintenance_sync_window)"
  jq -cn --argjson original "$ORIGINAL_SYNC_WINDOWS_JSON" \
    --argjson fence "$fence" '$original + [$fence]'
}

load_argocd_project_state() {
  local project_json current_windows expected_windows
  project_json="$(get_argocd_project)" \
    || die "Could not read ArgoCD AppProject '$ARGOCD_NAMESPACE/$EXPECTED_ARGOCD_PROJECT'"
  [[ "$(jq -r '.metadata.uid // ""' <<<"$project_json")" == "$EXPECTED_ARGOCD_PROJECT_UID" ]] \
    || die "ArgoCD AppProject '$EXPECTED_ARGOCD_PROJECT' has an unexpected UID"
  current_windows="$(jq -c '.spec.syncWindows // []' <<<"$project_json")"

  if [[ -n "$RESUME_FAILED_RUN_ID" ]]; then
    expected_windows="$(expected_fenced_sync_windows)"
    json_values_equal "$current_windows" "$expected_windows" \
      || die "Resume requires the exact failed-run ArgoCD maintenance fence"
    MAINTENANCE_FENCE_ACTIVE=true
    return 0
  fi

  local fence
  fence="$(maintenance_sync_window)"
  jq -e --argjson fence "$fence" \
    'all(.[]; . != $fence)' >/dev/null <<<"$current_windows" \
    || die "ArgoCD AppProject already contains the refresh maintenance fence"
  ORIGINAL_SYNC_WINDOWS_JSON="$current_windows"
}

set_argocd_project_sync_windows() {
  local current_json="$1"
  local windows_json="$2"
  local resource_version patch_payload
  resource_version="$(jq -r '.metadata.resourceVersion // ""' <<<"$current_json")"
  [[ -n "$resource_version" ]] || return 1
  patch_payload="$(
    jq -cn \
      --arg resourceVersion "$resource_version" \
      --arg uid "$EXPECTED_ARGOCD_PROJECT_UID" \
      --argjson windows "$windows_json" '
        [
          {op: "test", path: "/metadata/resourceVersion", value: $resourceVersion},
          {op: "test", path: "/metadata/uid", value: $uid},
          {op: "add", path: "/spec/syncWindows", value: $windows}
        ]
      '
  )"
  patch_argocd_project_json "$patch_payload" >/dev/null
}

install_argocd_maintenance_fence() {
  local project_json current_windows expected_windows
  expected_windows="$(expected_fenced_sync_windows)"
  project_json="$(get_argocd_project)" || return 1
  [[ "$(jq -r '.metadata.uid // ""' <<<"$project_json")" == "$EXPECTED_ARGOCD_PROJECT_UID" ]] \
    || return 1
  current_windows="$(jq -c '.spec.syncWindows // []' <<<"$project_json")"
  if ! json_values_equal "$current_windows" "$expected_windows"; then
    json_values_equal "$current_windows" "$ORIGINAL_SYNC_WINDOWS_JSON" || return 1
    set_argocd_project_sync_windows "$project_json" "$expected_windows" || return 1
  fi
  project_json="$(get_argocd_project)" || return 1
  json_values_equal "$(jq -c '.spec.syncWindows // []' <<<"$project_json")" \
    "$expected_windows" \
    || return 1
  MAINTENANCE_FENCE_ACTIVE=true
  set_run_phase maintenance-fenced
  log "Installed app-scoped ArgoCD deny window for '$ARGOCD_APP'"
}

remove_argocd_maintenance_fence() {
  [[ "$MAINTENANCE_FENCE_ACTIVE" == "true" ]] || return 0
  local project_json current_windows expected_windows
  expected_windows="$(expected_fenced_sync_windows)"
  project_json="$(get_argocd_project)" || return 1
  [[ "$(jq -r '.metadata.uid // ""' <<<"$project_json")" == "$EXPECTED_ARGOCD_PROJECT_UID" ]] \
    || return 1
  current_windows="$(jq -c '.spec.syncWindows // []' <<<"$project_json")"
  json_values_equal "$current_windows" "$expected_windows" || return 1
  set_argocd_project_sync_windows "$project_json" "$ORIGINAL_SYNC_WINDOWS_JSON" \
    || return 1
  project_json="$(get_argocd_project)" || return 1
  json_values_equal "$(jq -c '.spec.syncWindows // []' <<<"$project_json")" \
    "$ORIGINAL_SYNC_WINDOWS_JSON" \
    || return 1
  MAINTENANCE_FENCE_ACTIVE=false
  set_run_phase maintenance-fence-removed
  log "Removed the app-scoped ArgoCD deny window"
}

pause_argocd_policy() {
  assert_refresh_lease
  if [[ "$RESUMING_MAINTENANCE" == "true" ]]; then
    log "ArgoCD automated sync is already disabled by failed run '$RESUME_FAILED_RUN_ID'"
    ARGOCD_POLICY_PAUSED=true
    set_run_phase argocd-paused
    return 0
  fi

  set_run_phase pausing-argocd
  log "Disabling automated sync/self-heal on ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP'"
  patch_argocd_application '{"spec":{"syncPolicy":{"automated":null}}}' >/dev/null
  ARGOCD_POLICY_PAUSED=true

  local application_json
  application_json="$(get_argocd_application)"
  if jq -e '.spec.syncPolicy.automated != null and (.spec.syncPolicy.automated.enabled // true) != false' \
    >/dev/null <<<"$application_json"; then
    die "ArgoCD automated sync is still enabled after requesting manual policy"
  fi
  set_run_phase argocd-paused
}

assert_argocd_quiescent() {
  local application_json operation_phase
  application_json="$(get_argocd_application)" \
    || die "Could not read ArgoCD Application during maintenance fencing"
  [[ "$(jq -r '.metadata.uid // ""' <<<"$application_json")" == "$EXPECTED_ARGOCD_APP_UID" ]] \
    || die "ArgoCD Application identity changed during maintenance"
  operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
  if jq -e '.operation != null' >/dev/null <<<"$application_json" ||
    [[ "$operation_phase" == "Running" || "$operation_phase" == "Terminating" ]]; then
    die "A competing ArgoCD operation appeared during the refresh Lease"
  fi
  if jq -e \
    '.spec.syncPolicy.automated != null and (.spec.syncPolicy.automated.enabled // true) != false' \
    >/dev/null <<<"$application_json"; then
    die "ArgoCD automated sync was re-enabled during the refresh Lease"
  fi
}

assert_argocd_maintenance_fence() {
  local project_json expected_windows
  expected_windows="$(expected_fenced_sync_windows)"
  project_json="$(get_argocd_project)" \
    || die "Could not read the ArgoCD maintenance fence"
  [[ "$(jq -r '.metadata.uid // ""' <<<"$project_json")" == "$EXPECTED_ARGOCD_PROJECT_UID" ]] \
    || die "ArgoCD AppProject identity changed during maintenance"
  json_values_equal "$(jq -c '.spec.syncWindows // []' <<<"$project_json")" \
    "$expected_windows" \
    || die "The app-scoped ArgoCD maintenance fence changed or disappeared"
}

start_migrator_evidence_watch() {
  local existing_job_json
  existing_job_json="$(
    kubectl_for_workloads get job "$MIGRATOR_JOB_NAME" --ignore-not-found -o json
  )" || die "Could not inspect the pre-existing migrator Job"
  [[ -n "$existing_job_json" ]] || existing_job_json='{}'
  PRE_SYNC_MIGRATOR_JOB_UID="$(jq -r '.metadata.uid // ""' <<<"$existing_job_json")"
  rm -f -- "$MIGRATOR_EVIDENCE_FILE" "$MIGRATOR_EVIDENCE_FILE.tmp"

  (
    set +e
    kubectl_for_workloads get pods -l "job-name=$MIGRATOR_JOB_NAME" \
      --watch --output-watch-events -o json |
      jq -c --unbuffered \
        --arg jobName "$MIGRATOR_JOB_NAME" \
        --arg staleJobUid "$PRE_SYNC_MIGRATOR_JOB_UID" '
          select(.type == "ADDED" or .type == "MODIFIED") |
          .object as $pod |
          ([
            $pod.metadata.ownerReferences[]? |
            select(.kind == "Job" and .name == $jobName)
          ][0] // null) as $owner |
          select($owner != null and ($owner.uid // "") != "") |
          select($owner.uid != $staleJobUid) |
          ([
            $pod.spec.containers[]? |
            select(.name == "migrate") |
            .image
          ][0] // "") as $image |
          ([
            $pod.status.containerStatuses[]? |
            select(.name == "migrate") |
            .imageID
          ][0] // "") as $imageId |
          select($image != "" and $imageId != "") |
          {
            jobUid: $owner.uid,
            podUid: $pod.metadata.uid,
            image: $image,
            imageId: $imageId
          }
        ' |
      while IFS= read -r evidence; do
        printf '%s\n' "$evidence" >"$MIGRATOR_EVIDENCE_FILE.tmp"
        mv -- "$MIGRATOR_EVIDENCE_FILE.tmp" "$MIGRATOR_EVIDENCE_FILE"
        break
      done
  ) &
  MIGRATOR_EVIDENCE_WATCH_PID=$!
}

stop_migrator_evidence_watch() {
  [[ -n "$MIGRATOR_EVIDENCE_WATCH_PID" ]] || return 0
  kill "$MIGRATOR_EVIDENCE_WATCH_PID" 2>/dev/null || true
  wait "$MIGRATOR_EVIDENCE_WATCH_PID" 2>/dev/null || true
  MIGRATOR_EVIDENCE_WATCH_PID=""
}

load_migrator_evidence() {
  [[ -s "$MIGRATOR_EVIDENCE_FILE" ]] \
    || die "ArgoCD succeeded without evidence from a new migrator Pod"
  OBSERVED_MIGRATOR_JOB_UID="$(jq -r '.jobUid // ""' "$MIGRATOR_EVIDENCE_FILE")"
  OBSERVED_MIGRATOR_POD_UID="$(jq -r '.podUid // ""' "$MIGRATOR_EVIDENCE_FILE")"
  OBSERVED_MIGRATOR_IMAGE="$(jq -r '.image // ""' "$MIGRATOR_EVIDENCE_FILE")"
  OBSERVED_MIGRATOR_IMAGE_ID="$(jq -r '.imageId // ""' "$MIGRATOR_EVIDENCE_FILE")"
  [[ -n "$OBSERVED_MIGRATOR_JOB_UID" &&
    "$OBSERVED_MIGRATOR_JOB_UID" != "$PRE_SYNC_MIGRATOR_JOB_UID" ]] \
    || die "Migrator evidence came from the pre-existing Job"
  [[ -n "$OBSERVED_MIGRATOR_POD_UID" ]] \
    || die "Migrator evidence does not contain a Pod UID"
  [[ "$OBSERVED_MIGRATOR_IMAGE" == "$EXPECTED_MIGRATOR_IMAGE_REPOSITORY:"* ]] \
    || die "Observed unexpected migrator image '$OBSERVED_MIGRATOR_IMAGE'"
  local canonical_image_id="${OBSERVED_MIGRATOR_IMAGE_ID#docker-pullable://}"
  local image_digest="${canonical_image_id#"$EXPECTED_MIGRATOR_IMAGE_REPOSITORY@sha256:"}"
  [[ "$canonical_image_id" == "$EXPECTED_MIGRATOR_IMAGE_REPOSITORY@sha256:"* &&
    "$image_digest" =~ ^[0-9a-f]{64}$ ]] \
    || die "Migrator Pod did not expose an immutable image digest for the expected repository"
  OBSERVED_MIGRATOR_IMAGE_ID="$canonical_image_id"
  set_run_phase waiting-for-argocd
  log "Observed new PreSync migrator Job/Pod and immutable image digest"
}

finish_migrator_evidence_watch() {
  local deadline=$((SECONDS + MIGRATOR_EVIDENCE_TIMEOUT_SECONDS))
  while true; do
    [[ ! -s "$MIGRATOR_EVIDENCE_FILE" ]] || break
    (( SECONDS < deadline )) || break
    sleep 0.25
  done
  stop_migrator_evidence_watch
  load_migrator_evidence
}

terminate_owned_argocd_operation() {
  local deadline="${1:-$((SECONDS + CLEANUP_TIMEOUT_SECONDS))}"
  local application_json active_initiator observed_initiator operation_phase
  local termination_patch termination_requested=false
  set_run_phase terminating-argocd
  while true; do
    if ! application_json="$(get_argocd_application)"; then
      (( SECONDS < deadline )) || return 1
      log "Waiting for ArgoCD to become readable while operation termination is unresolved"
      sleep "$ARGOCD_POLL_SECONDS"
      continue
    fi
    active_initiator="$(jq -r '.operation.initiatedBy.username // ""' <<<"$application_json")"
    observed_initiator="$(jq -r '.status.operationState.operation.initiatedBy.username // ""' <<<"$application_json")"
    operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"

    if [[ -n "$active_initiator" && "$active_initiator" != "$ARGO_OPERATION_INITIATOR" ]]; then
      log "A different ArgoCD operation is active; refusing to terminate it"
      return 1
    fi
    if [[ "$observed_initiator" != "$ARGO_OPERATION_INITIATOR" ]]; then
      if [[ "$active_initiator" == "$ARGO_OPERATION_INITIATOR" ]]; then
        (( SECONDS < deadline )) || return 1
        sleep "$ARGOCD_POLL_SECONDS"
        continue
      fi
      log "Could not associate ArgoCD operation state with initiator '$ARGO_OPERATION_INITIATOR'"
      return 1
    fi

    if [[ "$operation_phase" == "Succeeded" || "$operation_phase" == "Failed" ||
      "$operation_phase" == "Error" ]] &&
      [[ -z "$active_initiator" ]]; then
      ARGO_OPERATION_ACCEPTED=false
      log "Owned ArgoCD operation reached terminal phase '$operation_phase'"
      return 0
    fi

    if [[ "$operation_phase" == "Running" && "$termination_requested" == "false" ]]; then
      termination_patch="$(
        jq -cn --arg initiator "$ARGO_OPERATION_INITIATOR" '
          [
            {op: "test", path: "/status/operationState/operation/initiatedBy/username", value: $initiator},
            {op: "test", path: "/status/operationState/phase", value: "Running"},
            {op: "replace", path: "/status/operationState/phase", value: "Terminating"}
          ]
        '
      )"
      patch_argocd_application_status_json "$termination_patch" >/dev/null \
        || return 1
      termination_requested=true
      log "Requested termination of the owned ArgoCD operation"
    fi
    (( SECONDS < deadline )) || return 1
    sleep "$ARGOCD_POLL_SECONDS"
  done
}

run_presync_hook() {
  local application_json operation_phase resource_version
  assert_refresh_lease
  application_json="$(get_argocd_application)" \
    || die "Could not read ArgoCD Application immediately before sync"
  operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
  if jq -e '.operation != null' >/dev/null <<<"$application_json" || \
    [[ "$operation_phase" == "Running" || "$operation_phase" == "Terminating" ]]; then
    die "ArgoCD Application '$ARGOCD_APP' acquired another operation before refresh sync"
  fi

  ARGO_OPERATION_INITIATOR="prd-to-stg-refresh-$RUN_ID"
  local sync_patch
  resource_version="$(jq -r '.metadata.resourceVersion // ""' <<<"$application_json")"
  [[ -n "$resource_version" ]] \
    || die "ArgoCD Application has no resourceVersion for atomic sync submission"
  sync_patch="$(
    build_argocd_sync_patch \
      "$ARGO_OPERATION_INITIATOR" "$PINNED_ARGOCD_REVISION" "$resource_version"
  )"

  set_run_phase submitting-argocd
  start_migrator_evidence_watch
  log "Submitting a hook-based sync to ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP'"
  if ! patch_argocd_application_json "$sync_patch" >/dev/null; then
    die "Could not atomically submit the ArgoCD sync operation through the Kubernetes API"
  fi

  ARGO_OPERATION_ACCEPTED=true
  WORKLOADS_SCALED=false
  set_run_phase waiting-for-argocd

  local deadline=$((SECONDS + ARGOCD_TIMEOUT_SECONDS))
  while true; do
    assert_refresh_lease
    if ! application_json="$(get_argocd_application)"; then
      if (( SECONDS >= deadline )); then
        die "Could not read the ArgoCD Application before the sync timeout"
      fi
      log "Waiting for the ArgoCD Application resource to become readable"
      sleep "$ARGOCD_POLL_SECONDS"
      continue
    fi

    local observed_initiator
    observed_initiator="$(jq -r '.status.operationState.operation.initiatedBy.username // ""' <<<"$application_json")"
    if [[ "$observed_initiator" != "$ARGO_OPERATION_INITIATOR" ]]; then
      if (( SECONDS >= deadline )); then
        die "Submitted ArgoCD operation was not observed before the timeout"
      fi
      sleep "$ARGOCD_POLL_SECONDS"
      continue
    fi

    operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
    case "$operation_phase" in
      Succeeded)
        ARGO_OPERATION_REVISION="$(jq -r '.status.operationState.syncResult.revision // ""' <<<"$application_json")"
        [[ "$ARGO_OPERATION_REVISION" == "$PINNED_ARGOCD_REVISION" ]] \
          || die "ArgoCD success revision does not match the preflight-pinned Git revision"
        if ! jq -e '.operation == null' >/dev/null <<<"$application_json"; then
          sleep "$ARGOCD_POLL_SECONDS"
          continue
        fi
        finish_migrator_evidence_watch
        ARGO_OPERATION_ACCEPTED=false
        set_run_phase argocd-succeeded
        log "ArgoCD sync succeeded at revision '$ARGO_OPERATION_REVISION'; the PreSync migration hook and Sync phase completed"
        return 0
        ;;
      Failed|Error)
        if ! jq -e '.operation == null' >/dev/null <<<"$application_json"; then
          sleep "$ARGOCD_POLL_SECONDS"
          continue
        fi
        ARGO_OPERATION_ACCEPTED=false
        local operation_message
        operation_message="$(jq -r '.status.operationState.message // "no operation message"' <<<"$application_json")"
        set_run_phase argocd-failed
        die "ArgoCD sync or PreSync migration hook failed in phase '$operation_phase': $operation_message"
        ;;
    esac

    if (( SECONDS >= deadline )); then
      log "ArgoCD operation exceeded $ARGOCD_TIMEOUT_SECONDS seconds; requesting termination and waiting for a terminal state"
      terminate_owned_argocd_operation \
        || die "Could not safely request termination of the owned ArgoCD operation"
      die "ArgoCD sync exceeded $ARGOCD_TIMEOUT_SECONDS seconds and was terminated"
    fi
    sleep "$ARGOCD_POLL_SECONDS"
  done
}

wait_for_post_sync_health() {
  local require_restored_policy="${1:-false}"
  local deadline=$((SECONDS + POST_SYNC_HEALTH_TIMEOUT_SECONDS))
  local application_json deployments_json sync_status health_status sync_revision
  local healthy_observations=0
  set_run_phase waiting-for-health

  while true; do
    assert_refresh_lease
    application_json="$(get_argocd_application)" \
      || die "Could not read ArgoCD Application during post-sync health verification"
    deployments_json="$(load_workload_state)"
    assert_workload_set_matches_receipt

    sync_status="$(jq -r '.status.sync.status // "Unknown"' <<<"$application_json")"
    health_status="$(jq -r '.status.health.status // "Unknown"' <<<"$application_json")"
    sync_revision="$(jq -r '.status.sync.revision // ""' <<<"$application_json")"

    local policy_matches=true
    if [[ "$require_restored_policy" == "true" ]] &&
      ! jq -e --argjson expected "$ORIGINAL_AUTOMATED_JSON" \
        '(.spec.syncPolicy.automated // null) == $expected' \
        >/dev/null <<<"$application_json"; then
      policy_matches=false
    fi

    if [[ "$policy_matches" == "true" &&
      "$sync_status" == "Synced" && "$health_status" == "Healthy" &&
      "$sync_revision" == "$ARGO_OPERATION_REVISION" ]] &&
      jq -e '.operation == null' >/dev/null <<<"$application_json" &&
      jq -e '
        all(.items[];
          (.status.observedGeneration // 0) >= (.metadata.generation // 0) and
          (.status.readyReplicas // 0) == (.spec.replicas // 1) and
          (.status.updatedReplicas // 0) == (.spec.replicas // 1) and
          (.status.availableReplicas // 0) == (.spec.replicas // 1)
        )
      ' >/dev/null <<<"$deployments_json"; then
      healthy_observations=$((healthy_observations + 1))
      if (( healthy_observations >= 2 )); then
        POST_SYNC_DEPLOYMENTS_JSON="$deployments_json"
        set_run_phase healthy
        log "ArgoCD is stably Synced/Healthy, the expected policy is active, and all bound Deployments are ready"
        return 0
      fi
    else
      healthy_observations=0
    fi

    if (( SECONDS >= deadline )); then
      die "Timed out waiting for ArgoCD Synced/Healthy and ready bound Deployments"
    fi
    sleep "$ARGOCD_POLL_SECONDS"
  done
}

restore_argocd_policy() {
  assert_refresh_lease
  set_run_phase restoring-argocd-policy
  local policy_patch
  policy_patch="$(build_argocd_policy_patch "$ORIGINAL_AUTOMATED_JSON")"
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
  set_run_phase argocd-policy-restored
  log "Restored the original ArgoCD sync policy"
}
