# Sourced by refresh-stg-from-prd.sh; do not execute directly.
# Contract: owns Kubernetes target validation, workload selection/scaling, and
# refresh-Lease lifecycle. It reads immutable identity/configuration globals and
# updates Lease/workload state globals and run receipts through set_run_phase.

kubectl_for_context() {
  local context="$1"
  shift
  kubectl --request-timeout="$KUBECTL_REQUEST_TIMEOUT" --context "$context" "$@"
}

kubectl_for_workloads() {
  kubectl_for_context "$KUBE_CONTEXT" -n "$WORKLOAD_NAMESPACE" "$@"
}

kubectl_for_argocd() {
  kubectl_for_context "$ARGOCD_KUBE_CONTEXT" -n "$ARGOCD_NAMESPACE" "$@"
}

validate_kubernetes_context_identity() {
  local label="$1"
  local context="$2"
  local config_json namespace_json
  config_json="$(
    kubectl_for_context "$context" config view --minify -o json
  )" || die "Could not read $label Kubernetes context '$context'"

  local tls_server_name
  tls_server_name="$(jq -r '.clusters[0].cluster["tls-server-name"] // ""' <<<"$config_json")"
  [[ "$tls_server_name" == "$EXPECTED_KUBE_TLS_SERVER_NAME" ]] \
    || die "$label context '$context' TLS server name '$tls_server_name' does not match expected STG cluster '$EXPECTED_KUBE_TLS_SERVER_NAME'"

  namespace_json="$(
    kubectl_for_context "$context" get namespace kube-system -o json
  )" || die "Could not read kube-system identity through $label context '$context'"
  local kube_system_uid
  kube_system_uid="$(jq -r '.metadata.uid // ""' <<<"$namespace_json")"
  [[ "$kube_system_uid" == "$EXPECTED_KUBE_SYSTEM_UID" ]] \
    || die "$label context '$context' points to unexpected cluster UID '$kube_system_uid'"
}

validate_kubernetes_target() {
  validate_kubernetes_context_identity Workload "$KUBE_CONTEXT"
  validate_kubernetes_context_identity ArgoCD "$ARGOCD_KUBE_CONTEXT"

  local namespace_json
  namespace_json="$(
    kubectl_for_context "$KUBE_CONTEXT" get namespace "$WORKLOAD_NAMESPACE" -o json
  )" || die "Could not read workload namespace '$WORKLOAD_NAMESPACE'"
  local namespace_uid
  namespace_uid="$(jq -r '.metadata.uid // ""' <<<"$namespace_json")"
  [[ "$namespace_uid" == "$EXPECTED_WORKLOAD_NAMESPACE_UID" ]] \
    || die "Workload namespace '$WORKLOAD_NAMESPACE' has unexpected UID '$namespace_uid'"

  local application_json
  application_json="$(get_argocd_application)" \
    || die "Could not read ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP'"
  [[ "$(jq -r '.metadata.uid // ""' <<<"$application_json")" == "$EXPECTED_ARGOCD_APP_UID" ]] \
    || die "ArgoCD Application '$ARGOCD_NAMESPACE/$ARGOCD_APP' has an unexpected UID"
  [[ "$(jq -r '.spec.project // ""' <<<"$application_json")" == "$EXPECTED_ARGOCD_PROJECT" ]] \
    || die "ArgoCD Application '$ARGOCD_APP' uses an unexpected AppProject"
  [[ "$(jq -r '.spec.destination.server // ""' <<<"$application_json")" == "$EXPECTED_ARGOCD_DESTINATION_SERVER" ]] \
    || die "ArgoCD Application '$ARGOCD_APP' targets an unexpected cluster"
  [[ "$(jq -r '.spec.destination.namespace // ""' <<<"$application_json")" == "$WORKLOAD_NAMESPACE" ]] \
    || die "ArgoCD Application '$ARGOCD_APP' targets an unexpected namespace"
  [[ "$(jq -r '.spec.source.repoURL // ""' <<<"$application_json")" == "$EXPECTED_ARGOCD_REPO_URL" ]] \
    || die "ArgoCD Application '$ARGOCD_APP' uses an unexpected repository"
  [[ "$(jq -r '.spec.source.targetRevision // ""' <<<"$application_json")" == "$EXPECTED_ARGOCD_TARGET_REVISION" ]] \
    || die "ArgoCD Application '$ARGOCD_APP' uses an unexpected target revision"
}

require_kubernetes_permission() {
  local context="$1"
  local namespace="$2"
  local verb="$3"
  local resource="$4"
  local subresource="${5:-}"
  local args=(auth can-i "$verb" "$resource" --quiet)
  [[ -z "$subresource" ]] || args+=(--subresource="$subresource")
  kubectl_for_context "$context" -n "$namespace" "${args[@]}" \
    || die "Kubernetes permission denied: $context namespace=$namespace verb=$verb resource=$resource${subresource:+/$subresource}"
}

validate_kubernetes_permissions() {
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" get applications.argoproj.io
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" patch applications.argoproj.io
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" patch applications.argoproj.io status
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" get appprojects.argoproj.io
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" patch appprojects.argoproj.io
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" get leases.coordination.k8s.io
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" create leases.coordination.k8s.io
  require_kubernetes_permission "$ARGOCD_KUBE_CONTEXT" "$ARGOCD_NAMESPACE" update leases.coordination.k8s.io
  require_kubernetes_permission "$KUBE_CONTEXT" "$WORKLOAD_NAMESPACE" get secrets
  require_kubernetes_permission "$KUBE_CONTEXT" "$WORKLOAD_NAMESPACE" list deployments.apps
  require_kubernetes_permission "$KUBE_CONTEXT" "$WORKLOAD_NAMESPACE" patch deployments.apps scale
  require_kubernetes_permission "$KUBE_CONTEXT" "$WORKLOAD_NAMESPACE" get jobs.batch
  require_kubernetes_permission "$KUBE_CONTEXT" "$WORKLOAD_NAMESPACE" list pods
  require_kubernetes_permission "$KUBE_CONTEXT" "$WORKLOAD_NAMESPACE" watch pods
}

load_workload_state() {
  local deployments_json
  deployments_json="$(
    kubectl_for_workloads get deployments -l "$WORKLOAD_SELECTOR" -o json
  )" || die "Could not list STG deployments in '$WORKLOAD_NAMESPACE' using context '$KUBE_CONTEXT'"

  local deployment_count
  deployment_count="$(jq '.items | length' <<<"$deployments_json")"
  validate_positive_integer deployment_count "$deployment_count"
  (( deployment_count > 0 )) \
    || die "No STG deployments matched selector '$WORKLOAD_SELECTOR'"
  jq -e --arg namespace "$WORKLOAD_NAMESPACE" \
    'all(.items[]; .metadata.namespace == $namespace)' \
    >/dev/null <<<"$deployments_json" \
    || die "Workload selector returned a Deployment outside '$WORKLOAD_NAMESPACE'"

  printf '%s' "$deployments_json"
}

deployment_set_json() {
  jq -c '[.items[] | {namespace: .metadata.namespace, name: .metadata.name}] | sort_by(.namespace, .name)'
}

assert_workload_set_unchanged() {
  local current_json current_set expected_set
  current_json="$(load_workload_state)"
  current_set="$(deployment_set_json <<<"$current_json")"
  expected_set="$(deployment_set_json <<<"$PREFLIGHT_DEPLOYMENTS_JSON")"
  [[ "$current_set" == "$expected_set" ]] \
    || die "Selected STG Deployment set changed after preflight"
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

lease_is_available() {
  local lease_json="$1"
  jq -e --arg holder "$LEASE_HOLDER_ID" '
    (.spec.holderIdentity // "") == "" or
    (.spec.holderIdentity // "") == $holder or
    (
      (.spec.leaseDurationSeconds |
        select(type == "number" and . > 0)) as $duration |
      ((.spec.renewTime // .spec.acquireTime // "") |
        sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601?) as $renewedAt |
      $renewedAt != null and ($renewedAt + $duration < now)
    )
  ' >/dev/null <<<"$lease_json"
}

build_refresh_lease() {
  local existing_json="${1:-}"
  local phase="${2:-$RUN_PHASE}"
  local now
  now="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  if [[ -z "$existing_json" ]]; then
    jq -n \
      --arg name "$REFRESH_LEASE_NAME" \
      --arg namespace "$ARGOCD_NAMESPACE" \
      --arg holder "$LEASE_HOLDER_ID" \
      --arg now "$now" \
      --arg runId "$RUN_ID" \
      --arg phase "$phase" \
      --arg approvalRef "$RAW_PRD_DATA_APPROVAL_REF" \
      --arg outboundIntegrationsIsolated "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" \
      --argjson duration "$REFRESH_LEASE_DURATION_SECONDS" \
      '{
        apiVersion: "coordination.k8s.io/v1",
        kind: "Lease",
        metadata: {
          name: $name,
          namespace: $namespace,
          annotations: {
            "klicker.uzh.ch/refresh-run-id": $runId,
            "klicker.uzh.ch/refresh-phase": $phase,
            "klicker.uzh.ch/raw-data-approval-ref": $approvalRef,
            "klicker.uzh.ch/outbound-integrations-isolated": $outboundIntegrationsIsolated
          }
        },
        spec: {
          holderIdentity: $holder,
          acquireTime: $now,
          renewTime: $now,
          leaseDurationSeconds: $duration,
          leaseTransitions: 0
        }
      }'
    return
  fi

  jq \
    --arg holder "$LEASE_HOLDER_ID" \
    --arg now "$now" \
    --arg runId "$RUN_ID" \
    --arg phase "$phase" \
    --arg approvalRef "$RAW_PRD_DATA_APPROVAL_REF" \
    --arg outboundIntegrationsIsolated "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" \
    --argjson duration "$REFRESH_LEASE_DURATION_SECONDS" '
      (.spec.holderIdentity // "") as $previousHolder |
      .metadata.annotations["klicker.uzh.ch/refresh-run-id"] = $runId |
      .metadata.annotations["klicker.uzh.ch/refresh-phase"] = $phase |
      .metadata.annotations["klicker.uzh.ch/raw-data-approval-ref"] = $approvalRef |
      .metadata.annotations["klicker.uzh.ch/outbound-integrations-isolated"] = $outboundIntegrationsIsolated |
      .spec.holderIdentity = $holder |
      .spec.acquireTime = (if $previousHolder == $holder then (.spec.acquireTime // $now) else $now end) |
      .spec.renewTime = $now |
      .spec.leaseDurationSeconds = $duration |
      .spec.leaseTransitions = (
        if $previousHolder == $holder then (.spec.leaseTransitions // 0)
        else ((.spec.leaseTransitions // 0) + 1)
        end
      )
    ' <<<"$existing_json"
}

acquire_refresh_lease() {
  local existing_json lease_payload
  existing_json="$(
    kubectl_for_argocd get lease.coordination.k8s.io "$REFRESH_LEASE_NAME" \
      --ignore-not-found -o json
  )" || die "Could not inspect refresh Lease '$ARGOCD_NAMESPACE/$REFRESH_LEASE_NAME'"

  if [[ -z "$existing_json" ]]; then
    lease_payload="$(build_refresh_lease)"
    printf '%s' "$lease_payload" | kubectl_for_argocd create -f - >/dev/null \
      || die "Could not acquire refresh Lease; another run may have started"
  else
    lease_is_available "$existing_json" \
      || die "Refresh Lease '$ARGOCD_NAMESPACE/$REFRESH_LEASE_NAME' is held by another active run"
    lease_payload="$(build_refresh_lease "$existing_json")"
    printf '%s' "$lease_payload" | kubectl_for_argocd replace -f - >/dev/null \
      || die "Could not atomically acquire refresh Lease; another run may have won the lease"
  fi

  LEASE_ACQUIRED=true
  log "Acquired exclusive refresh Lease '$ARGOCD_NAMESPACE/$REFRESH_LEASE_NAME' as '$LEASE_HOLDER_ID'"
}

renew_refresh_lease_once() {
  local existing_json lease_payload holder phase
  existing_json="$(
    kubectl_for_argocd get lease.coordination.k8s.io "$REFRESH_LEASE_NAME" -o json
  )" || return 1
  holder="$(jq -r '.spec.holderIdentity // ""' <<<"$existing_json")"
  [[ "$holder" == "$LEASE_HOLDER_ID" ]] || return 1
  [[ -s "$RUN_PHASE_FILE" ]] || return 1
  phase="$(<"$RUN_PHASE_FILE")"
  [[ -n "$phase" ]] || return 1
  lease_payload="$(build_refresh_lease "$existing_json" "$phase")" || return 1
  printf '%s' "$lease_payload" | kubectl_for_argocd replace -f - >/dev/null
}

renew_refresh_lease_with_retry() {
  local attempt
  for ((attempt = 1; attempt <= REFRESH_LEASE_RENEW_RETRY_ATTEMPTS; attempt++)); do
    if renew_refresh_lease_once; then
      return 0
    fi
    if (( attempt < REFRESH_LEASE_RENEW_RETRY_ATTEMPTS )); then
      log "Refresh Lease renewal attempt $attempt failed; retrying"
      sleep "$REFRESH_LEASE_RENEW_RETRY_DELAY_SECONDS"
    fi
  done
  return 1
}

start_refresh_lease_renewal() {
  local refresh_main_pid="$$"
  (
    while sleep "$REFRESH_LEASE_RENEW_INTERVAL_SECONDS"; do
      if ! renew_refresh_lease_with_retry; then
        printf '%s\n' 'Lease renewal failed' >"$LEASE_FAILURE_FILE"
        log "Refresh Lease renewal failed after $REFRESH_LEASE_RENEW_RETRY_ATTEMPTS attempts; terminating the refresh"
        kill -TERM "$refresh_main_pid" 2>/dev/null || true
        exit 1
      fi
    done
  ) &
  LEASE_RENEWAL_PID=$!
}

assert_refresh_lease() {
  [[ "$LEASE_ACQUIRED" == "true" ]] || die "Refresh Lease is not held"
  [[ ! -e "$LEASE_FAILURE_FILE" ]] \
    || die "Refresh Lease renewal failed; refusing further state changes"
  local lease_json
  lease_json="$(
    kubectl_for_argocd get lease.coordination.k8s.io "$REFRESH_LEASE_NAME" -o json
  )" || die "Could not read refresh Lease; refusing further state changes"
  jq -e \
    --arg holder "$LEASE_HOLDER_ID" \
    --arg runId "$RUN_ID" \
    --arg approvalRef "$RAW_PRD_DATA_APPROVAL_REF" \
    --arg outboundIntegrationsIsolated "$STG_OUTBOUND_INTEGRATIONS_ISOLATED" '
    (.spec.holderIdentity // "") == $holder and
    .metadata.annotations["klicker.uzh.ch/refresh-run-id"] == $runId and
    .metadata.annotations["klicker.uzh.ch/raw-data-approval-ref"] == $approvalRef and
    .metadata.annotations["klicker.uzh.ch/outbound-integrations-isolated"] == $outboundIntegrationsIsolated and
    (
      (.spec.leaseDurationSeconds |
        select(type == "number" and . > 0)) as $duration |
      ((.spec.renewTime // .spec.acquireTime // "") |
        sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601?) as $renewedAt |
      $renewedAt != null and ($renewedAt + $duration >= now)
    )
  ' >/dev/null <<<"$lease_json" \
    || die "Refresh Lease ownership was lost or expired; refusing further state changes"
}

stop_refresh_lease_renewal() {
  [[ -n "$LEASE_RENEWAL_PID" ]] || return 0
  kill "$LEASE_RENEWAL_PID" 2>/dev/null || true
  wait "$LEASE_RENEWAL_PID" 2>/dev/null || true
  LEASE_RENEWAL_PID=""
}

release_refresh_lease() {
  stop_refresh_lease_renewal
  [[ "$LEASE_ACQUIRED" == "true" ]] || return 0

  local existing_json holder release_payload
  existing_json="$(
    kubectl_for_argocd get lease.coordination.k8s.io "$REFRESH_LEASE_NAME" -o json
  )" || {
    log "Could not read refresh Lease during cleanup; it will expire automatically"
    return 0
  }
  holder="$(jq -r '.spec.holderIdentity // ""' <<<"$existing_json")"
  if [[ "$holder" != "$LEASE_HOLDER_ID" ]]; then
    log "Refresh Lease is no longer owned by this run; not releasing it"
    LEASE_ACQUIRED=false
    return 0
  fi

  release_payload="$(
    jq \
      --arg phase "$RUN_PHASE" \
      --arg result "$(if [[ "$TERMINAL_SUCCESS" == "true" ]]; then printf success; else printf failed; fi)" \
      --arg now "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" '
        .metadata.annotations["klicker.uzh.ch/refresh-phase"] = $phase |
        .metadata.annotations["klicker.uzh.ch/refresh-result"] = $result |
        .spec.holderIdentity = "" |
        .spec.renewTime = $now |
        .spec.leaseDurationSeconds = 1
      ' <<<"$existing_json"
  )"
  if printf '%s' "$release_payload" | kubectl_for_argocd replace -f - >/dev/null; then
    LEASE_ACQUIRED=false
    log "Released refresh Lease '$ARGOCD_NAMESPACE/$REFRESH_LEASE_NAME'"
  else
    log "Could not release refresh Lease; it will expire automatically"
  fi
}

assert_workload_set_matches_receipt() {
  local deployments_json current_set receipt_set
  deployments_json="$(load_workload_state)"
  current_set="$(deployment_set_json <<<"$deployments_json")"
  receipt_set="$(
    deployment_receipt_json | jq -c 'map({namespace, name}) | sort_by(.namespace, .name)'
  )"
  [[ "$current_set" == "$receipt_set" ]] \
    || die "Selected STG Deployment set no longer matches the bound run receipt"
}

restore_partially_scaled_workloads() {
  local scaled_receipt="$1"
  log "A pre-mutation scale operation failed; restoring already changed Deployments"
  while IFS=$'\t' read -r namespace deployment replicas; do
    [[ -n "$namespace" && -n "$deployment" && -n "$replicas" ]] || continue
    if ! kubectl_for_workloads scale "deployment/$deployment" --replicas="$replicas" >/dev/null; then
      log "Could not compensate $namespace/deployment/$deployment to $replicas replicas"
    fi
  done <"$scaled_receipt"
}

ensure_argocd_policy_paused_for_cleanup() {
  local application_json
  log "Ensuring ArgoCD automated sync is disabled for fail-safe cleanup"
  if ! patch_argocd_application '{"spec":{"syncPolicy":{"automated":null}}}' \
    >/dev/null; then
    log "CRITICAL: Could not disable ArgoCD automated sync during cleanup"
    return 1
  fi
  if ! application_json="$(get_argocd_application)"; then
    log "CRITICAL: Could not verify ArgoCD policy during cleanup"
    return 1
  fi
  if jq -e \
    '.spec.syncPolicy.automated != null and (.spec.syncPolicy.automated.enabled // true) != false' \
    >/dev/null <<<"$application_json"; then
    log "CRITICAL: ArgoCD automated sync remains enabled during cleanup"
    return 1
  fi
  ARGOCD_POLICY_PAUSED=true
}

restore_original_argocd_policy_for_cleanup() {
  local policy_patch application_json
  policy_patch="$(build_argocd_policy_patch "$ORIGINAL_AUTOMATED_JSON")"
  if ! patch_argocd_application "$policy_patch" >/dev/null; then
    log "Could not restore the original ArgoCD policy after a pre-mutation failure"
    return 1
  fi
  if ! application_json="$(get_argocd_application)"; then
    log "Could not verify the restored ArgoCD policy after a pre-mutation failure"
    return 1
  fi
  if ! jq -e --argjson expected "$ORIGINAL_AUTOMATED_JSON" \
    '(.spec.syncPolicy.automated // null) == $expected' \
    >/dev/null <<<"$application_json"; then
    log "The exact original ArgoCD policy was not restored after a pre-mutation failure"
    return 1
  fi
  ARGOCD_POLICY_PAUSED=false
  log "Restored the original ArgoCD policy after a pre-mutation failure"
}

restore_original_workloads_for_cleanup() {
  [[ -n "$DEPLOYMENT_RECEIPT" && -s "$DEPLOYMENT_RECEIPT" ]] || {
    log "No deployment receipt is available for pre-mutation compensation"
    return 1
  }

  local failed=false
  while IFS=$'\t' read -r namespace deployment replicas; do
    [[ -n "$namespace" && -n "$deployment" && -n "$replicas" ]] || continue
    if [[ "$namespace" != "$WORKLOAD_NAMESPACE" ]]; then
      log "Refusing cleanup compensation for unexpected namespace '$namespace'"
      failed=true
      continue
    fi
    if ! kubectl_for_workloads scale "deployment/$deployment" \
      --replicas="$replicas" >/dev/null; then
      log "Could not restore $namespace/deployment/$deployment to $replicas replicas"
      failed=true
    fi
  done <"$DEPLOYMENT_RECEIPT"

  [[ "$failed" == "false" ]] || return 1
  WORKLOADS_SCALED=false
  log "Restored original Deployment replica targets after a pre-mutation failure"
}

force_selected_workloads_down_for_cleanup() {
  [[ -n "$RUN_DIR" ]] || {
    log "CRITICAL: No run directory is available for fail-safe workload shutdown"
    return 1
  }

  local cleanup_receipt="$RUN_DIR/cleanup-deployments.tsv"
  local deployments_json failed=false
  : >"$cleanup_receipt"
  if [[ -n "$DEPLOYMENT_RECEIPT" && -s "$DEPLOYMENT_RECEIPT" ]]; then
    awk -F '\t' '{print $1 "\t" $2}' "$DEPLOYMENT_RECEIPT" \
      >>"$cleanup_receipt"
  fi
  if deployments_json="$(
    kubectl_for_workloads get deployments -l "$WORKLOAD_SELECTOR" -o json
  )"; then
    jq -r '.items[] | [.metadata.namespace, .metadata.name] | @tsv' \
      <<<"$deployments_json" >>"$cleanup_receipt"
  else
    log "Could not enumerate current selected Deployments during cleanup"
    failed=true
  fi
  sort -u "$cleanup_receipt" -o "$cleanup_receipt"

  while IFS=$'\t' read -r namespace deployment; do
    [[ -n "$namespace" && -n "$deployment" ]] || continue
    if [[ "$namespace" != "$WORKLOAD_NAMESPACE" ]]; then
      log "Refusing cleanup shutdown for unexpected namespace '$namespace'"
      failed=true
      continue
    fi
    if ! kubectl_for_workloads scale "deployment/$deployment" \
      --replicas=0 >/dev/null; then
      log "CRITICAL: Could not scale $namespace/deployment/$deployment to zero during cleanup"
      failed=true
    fi
  done <"$cleanup_receipt"

  # Verify every name in the cleanup receipt directly. A receipt-bound
  # Deployment may have lost the selector label after preflight; selector-only
  # verification would then miss its still-running replicas.
  local deployment_json
  while IFS=$'\t' read -r namespace deployment; do
    [[ -n "$namespace" && -n "$deployment" ]] || continue
    if [[ "$namespace" != "$WORKLOAD_NAMESPACE" ]]; then
      failed=true
      continue
    fi
    if ! deployment_json="$(
      kubectl_for_workloads get "deployment/$deployment" -o json
    )"; then
      log "CRITICAL: Could not verify $namespace/deployment/$deployment during cleanup"
      failed=true
      continue
    fi
    if ! jq -e \
      --arg namespace "$namespace" \
      --arg deployment "$deployment" '
        .metadata.namespace == $namespace and
        .metadata.name == $deployment and
        (.spec.replicas // 1) == 0 and
        (.status.replicas // 0) == 0
      ' >/dev/null <<<"$deployment_json"; then
      log "CRITICAL: $namespace/deployment/$deployment has not reached zero desired and running replicas during cleanup"
      failed=true
    fi
  done <"$cleanup_receipt"

  [[ "$failed" == "false" ]] || return 1
  WORKLOADS_SCALED=true
  log "Verified all selected STG Deployments at zero replicas"
}

verify_no_active_argocd_operation_for_cleanup() {
  local application_json operation_phase
  application_json="$(get_argocd_application)" || return 1
  [[ "$(jq -r '.metadata.uid // ""' <<<"$application_json")" == "$EXPECTED_ARGOCD_APP_UID" ]] \
    || return 1
  operation_phase="$(jq -r '.status.operationState.phase // "Unknown"' <<<"$application_json")"
  jq -e '.operation == null' >/dev/null <<<"$application_json" &&
    [[ "$operation_phase" != "Running" && "$operation_phase" != "Terminating" ]]
}

establish_fail_safe_maintenance() {
  local deadline=$((SECONDS + CLEANUP_TIMEOUT_SECONDS))
  local fence_ok operation_ok policy_ok workloads_ok
  set_run_phase cleanup-securing-maintenance

  while true; do
    fence_ok=false
    operation_ok=false
    policy_ok=false
    workloads_ok=false

    install_argocd_maintenance_fence && fence_ok=true
    if [[ "$ARGO_OPERATION_ACCEPTED" == "true" ]]; then
      terminate_owned_argocd_operation "$deadline" || true
    fi
    verify_no_active_argocd_operation_for_cleanup && operation_ok=true
    ensure_argocd_policy_paused_for_cleanup && policy_ok=true
    force_selected_workloads_down_for_cleanup && workloads_ok=true

    if [[ "$fence_ok" == "true" && "$operation_ok" == "true" &&
      "$policy_ok" == "true" && "$workloads_ok" == "true" ]]; then
      return 0
    fi
    if (( SECONDS >= deadline )); then
      log "CRITICAL: Timed out proving fail-safe maintenance invariants"
      return 1
    fi
    log "Cleanup safety is not yet proven; retrying until the cleanup deadline"
    sleep "$ARGOCD_POLL_SECONDS"
  done
}

scale_stg_workloads_down() {
  local deployments_json
  local scaled_this_attempt="$RUN_DIR/scaled-this-attempt.tsv"
  WORKLOADS_SCALED=false
  : >"$scaled_this_attempt"
  assert_refresh_lease
  assert_workload_set_matches_receipt
  set_run_phase stopping-workloads

  while IFS=$'\t' read -r namespace deployment replicas; do
    [[ -n "$namespace" && -n "$deployment" ]] || continue
    [[ "$namespace" == "$WORKLOAD_NAMESPACE" ]] \
      || die "Deployment receipt contains disallowed namespace '$namespace'"
    log "Scaling $namespace/deployment/$deployment from $replicas to 0"
    if ! kubectl_for_workloads scale "deployment/$deployment" --replicas=0 >/dev/null; then
      if [[ "$TARGET_MUTATED" != "true" ]]; then
        restore_partially_scaled_workloads "$scaled_this_attempt"
      fi
      die "Could not scale $namespace/deployment/$deployment to zero"
    fi
    printf '%s\t%s\t%s\n' "$namespace" "$deployment" "$replicas" \
      >>"$scaled_this_attempt"
    printf '%s\t%s\t%s\t%s\n' \
      "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$namespace" "$deployment" zero \
      >>"$SCALE_OBSERVATION_RECEIPT"
  done <"$DEPLOYMENT_RECEIPT"

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
  set_run_phase workloads-stopped
  log "All bound STG workloads are stopped"
}
