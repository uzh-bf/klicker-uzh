# Production JSON Logging Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich Klicker container logs in Grafana Alloy with a stable
Kubernetes-derived service label and queryable Loki structured metadata while
preserving original JSON and non-JSON lines.

**Architecture:** Collector code belongs to the `azure-helpers` Git submodule,
so it lands in a helper MR targeting `infra-2025`. A dependent
`df-cloud-klickeruzh` MR advances the submodule pointer, targets `stg`, and runs
the authoritative VNet-local Pulumi preview. Alloy parses allowlisted JSON
fields; Loki stores them as structured metadata rather than stream labels.

**Tech Stack:** TypeScript 5.5, Pulumi, Grafana Alloy Helm chart 1.6.2, Loki
Helm chart 6.57.0, Loki TSDB schema v13, Node.js 20, pnpm 9, Node test runner,
GitLab CI.

## Global Constraints

- This plan does not change log transport: the current Alloy pipeline already
  forwards raw container stdout to Loki.
- Derive `service_name` from Kubernetes pod label
  `app.kubernetes.io/component`; do not promote untrusted JSON `service` into a
  Loki label.
- Keep namespace, pod, container, and node labels unchanged during rollout.
- Parse `time`, `level`, `event`, `requestId`, `correlationId`, `traceId`, and
  `spanId` only.
- Store level/event/request/correlation/trace/span values as structured
  metadata, not stream labels.
- Preserve the raw log line and forward malformed/non-JSON lines unchanged.
- Use application Unix-millisecond `time` when valid; retain the scrape
  timestamp when parsing fails.
- Make `allow_structured_metadata` and `discover_log_levels` explicit. Do not
  change Loki schema, storage, retention, replicas, cache capacity,
  authentication, tenant, credentials, endpoints, chart versions, or resource
  requests/limits unless staging evidence proves a separate follow-up is
  needed.
- Do not run local Pulumi for `src/infra` or `src/apps/*`; previews run only in
  GitLab CI inside the VNet.
- Do not touch the source checkout's unrelated untracked `util/storage/` path.
- The helper MR must merge before the parent MR can reference its immutable
  commit. Neither MR may be merged without explicit user approval.

## Linked MR map

| Order | Repository                         | Branch                            | Target       | Title                                                     |
| ----: | ---------------------------------- | --------------------------------- | ------------ | --------------------------------------------------------- |
|     1 | `uzh-bf/cloud/azure-helpers`       | `feat/klicker-structured-logging` | `infra-2025` | `feat(logging): process Klicker structured logs in Alloy` |
|     2 | `uzh-bf/cloud/df-cloud-klickeruzh` | `feat/klicker-structured-logging` | `stg`        | `build(monitoring): adopt structured log processing`      |

These are linked cross-repository MRs, not a native GitLab stack.

### Task 1: Create an isolated parent worktree and helper branch

**Files:**

- Verify in the external parent repository: `.gitignore`
- Verify in the external parent repository: `.gitmodules`

**Interfaces:**

- Produces parent worktree `trees/klicker-structured-logging` inside the external
  `df-cloud-klickeruzh` repository and a helper branch based on `infra-2025`.

- [ ] **Step 1: Audit the source checkout without modifying it**

```bash
task_cloud_repo=$(pwd -P)
test "$(basename "$task_cloud_repo")" = "df-cloud-klickeruzh"
git status --short
git worktree list --porcelain
rg -n '^trees/$' .gitignore
git submodule status azure-helpers
```

Run this block from the existing `df-cloud-klickeruzh` source checkout. Expected:
the directory-name assertion passes, `trees/` is ignored, and the helper commit
is visible. Record any source-checkout changes, including `util/storage/`, and
do not stage or move them.

- [ ] **Step 2: Create the parent worktree and initialize the submodule**

```bash
git worktree add -b feat/klicker-structured-logging \
  trees/klicker-structured-logging origin/stg
cd trees/klicker-structured-logging
git submodule update --init azure-helpers
git -C azure-helpers fetch origin infra-2025
git -C azure-helpers switch -c \
  feat/klicker-structured-logging origin/infra-2025
```

Expected: clean parent branch based on `origin/stg`; helper branch based on the
submodule's verified default branch `infra-2025`.

### Task 2: Add the Alloy processing pipeline in azure-helpers

**Files:**

- Modify: `azure-helpers/src/k8s/monitoring/grafanaalloy.ts`
- Create: `azure-helpers/test/grafanaalloy.test.mjs`

**Interfaces:**

- Produces exported `grafanaAlloyConfig` consumed by the Helm values and by a
  deterministic Node regression test.

- [ ] **Step 1: Extract the current embedded Alloy configuration**

Export the existing template string as `grafanaAlloyConfig` and set
`alloy.configMap.content` to that constant. Keep chart version, controller,
resources, CRDs, service account, and Loki endpoint unchanged.

- [ ] **Step 2: Write the failing config regression test**

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { grafanaAlloyConfig } from '../dist/k8s/monitoring/grafanaalloy.js'

test('enriches JSON logs without dropping malformed lines', () => {
  assert.match(grafanaAlloyConfig, /target_label\s+=\s+"service_name"/)
  assert.match(grafanaAlloyConfig, /loki\.process "klicker"/)
  assert.match(grafanaAlloyConfig, /drop_malformed\s+=\s+false/)
  assert.match(grafanaAlloyConfig, /format\s+=\s+"UnixMs"/)
  assert.match(grafanaAlloyConfig, /action_on_failure\s+=\s+"skip"/)
  assert.match(grafanaAlloyConfig, /stage\.structured_metadata/)
  assert.match(
    grafanaAlloyConfig,
    /forward_to\s+=\s+\[loki\.process\.klicker\.receiver\]/
  )
})
```

Run from the cloud parent worktree:

```bash
pnpm --dir azure-helpers run build
node --test azure-helpers/test/grafanaalloy.test.mjs
```

Expected: failure because `service_name` and `loki.process` do not exist.

- [ ] **Step 3: Add the Kubernetes service label**

Append this rule to `discovery.relabel "pods"`:

```alloy
rule {
  source_labels = ["__meta_kubernetes_pod_label_app_kubernetes_io_component"]
  target_label  = "service_name"
}
```

This covers Klicker, assessment variants, and non-JSON workloads that use the
existing component label.

- [ ] **Step 4: Insert JSON processing before Loki writing**

Change the source receiver to `loki.process.klicker.receiver` and add:

```alloy
loki.process "klicker" {
  forward_to = [loki.write.loki.receiver]

  stage.json {
    expressions = {
      application_time = "time",
      level = "level",
      event = "event",
      request_id = "requestId",
      correlation_id = "correlationId",
      trace_id = "traceId",
      span_id = "spanId",
    }
    drop_malformed = false
  }

  stage.timestamp {
    source = "application_time"
    format = "UnixMs"
    action_on_failure = "skip"
  }

  stage.structured_metadata {
    values = {
      level = "",
      event = "",
      request_id = "",
      correlation_id = "",
      trace_id = "",
      span_id = "",
    }
  }
}
```

Keep the original line unchanged; do not add `stage.output`, `stage.labels`, or
a malformed-line drop stage.

- [ ] **Step 5: Build, test, format, and commit the helper**

```bash
pnpm --dir azure-helpers run build
pnpm --dir azure-helpers run test
pnpm exec prettier --check \
  azure-helpers/src/k8s/monitoring/grafanaalloy.ts \
  azure-helpers/test/grafanaalloy.test.mjs
git -C azure-helpers status --short
git -C azure-helpers add \
  src/k8s/monitoring/grafanaalloy.ts \
  test/grafanaalloy.test.mjs
git -C azure-helpers commit -m \
  "feat(logging): process structured Kubernetes logs"
```

Expected: helper build and all Node tests pass.

### Task 3: Make Loki structured-metadata behavior explicit

**Files:**

- Modify: `azure-helpers/src/k8s/monitoring/grafanaloki.ts`
- Create: `azure-helpers/test/grafanaloki.test.mjs`

**Interfaces:**

- Produces explicit Helm values for current Loki v13 behavior; no infrastructure
  sizing or storage mutation.

- [ ] **Step 1: Write the failing Loki values test**

Export a pure `grafanaLokiStaticValues` object containing the static Loki values
and compose dynamic service-account/storage fields around it in the component.
Test:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { grafanaLokiStaticValues } from '../dist/k8s/monitoring/grafanaloki.js'

test('keeps schema v13 and explicitly enables structured metadata', () => {
  assert.equal(
    grafanaLokiStaticValues.loki.schemaConfig.configs[0].schema,
    'v13'
  )
  assert.deepEqual(grafanaLokiStaticValues.loki.limits_config, {
    allow_structured_metadata: true,
    discover_log_levels: true,
  })
})
```

Run the test; expected: failure because the exported values and limits are
absent.

- [ ] **Step 2: Add explicit limits without changing existing values**

Under `values.loki`, add:

```ts
limits_config: {
  allow_structured_metadata: true,
  discover_log_levels: true,
},
```

The extraction must preserve the existing v13 schema, Azure blob configuration,
auth setting, deployment mode, canary, caches, and replica counts exactly.

- [ ] **Step 3: Verify and commit the helper MR tip**

```bash
pnpm --dir azure-helpers run build
pnpm --dir azure-helpers run test
pnpm exec prettier --check \
  azure-helpers/src/k8s/monitoring/grafanaloki.ts \
  azure-helpers/test/grafanaloki.test.mjs
git -C azure-helpers add \
  src/k8s/monitoring/grafanaloki.ts \
  test/grafanaloki.test.mjs
git -C azure-helpers commit -m \
  "feat(logging): enable Loki structured metadata"
```

### Task 4: Publish and review the azure-helpers MR

**Files:** helper branch only.

**Interfaces:**

- Produces an immutable reviewed helper commit for the parent submodule pointer.

- [ ] **Step 1: Review the exact helper diff**

```bash
git -C azure-helpers diff origin/infra-2025...HEAD --check
git -C azure-helpers log --oneline origin/infra-2025..HEAD
git -C azure-helpers status --short
```

Expected: two focused commits, clean status, no chart/version/capacity drift.

- [ ] **Step 2: Push and open a draft helper MR**

```bash
git -C azure-helpers push -u origin feat/klicker-structured-logging
```

Open a draft GitLab MR targeting `infra-2025` titled
`feat(logging): process Klicker structured logs in Alloy`. The description
covers the complete branch diff, non-JSON preservation, label-cardinality
decision, tests, and the dependent parent MR. Do not merge it yet.

- [ ] **Step 3: Run the required strict review**

Run the repository-required thermo-nuclear maintainability review. Resolve
findings or record a precise deferral. Obtain human approval and merge the helper
MR only when the user explicitly authorizes it; record the resulting immutable
commit SHA.

### Task 5: Advance the df-cloud parent and document rollout

**Files:**

- Modify: `azure-helpers` gitlink in the parent repository
- Create: `docs/services/GrafanaLoki.md`
- Modify: `docs/README.md`

**Interfaces:**

- Consumes: merged immutable helper commit from Task 4.
- Produces: parent MR that deploys the collector configuration through the
  normal `stg` then `prd` flow.

- [ ] **Step 1: Update only the submodule pointer**

```bash
git -C azure-helpers fetch origin infra-2025
git -C azure-helpers switch --detach origin/infra-2025
git add azure-helpers
git diff --cached --submodule=log
```

Expected: the gitlink advances to the helper merge commit and includes no other
source-checkout changes.

- [ ] **Step 2: Add the logging collector runbook**

Document:

- `service_name` comes from `app.kubernetes.io/component`;
- level/event/request/correlation/trace/span are structured metadata;
- malformed/non-JSON records keep their scrape timestamp and raw line;
- deployment/rollback checks and these exact queries:

```logql
{service_name="response-api"} | correlation_id="logging-canary-20260805"
{service_name="backend-graphql"} | level="error"
```

- fake-canary privacy validation and cardinality/volume inspection;
- rollback by reverting the parent submodule-pointer commit.

- [ ] **Step 3: Build, test, and commit the parent change**

```bash
pnpm install
pnpm run build
pnpm --dir azure-helpers run test
pnpm exec prettier --check docs/services/GrafanaLoki.md docs/README.md
git add azure-helpers docs/services/GrafanaLoki.md docs/README.md
git diff --cached --check
git commit -m "build(monitoring): adopt structured log processing"
```

### Task 6: Run the authoritative preview and staging acceptance

**Files:** parent branch and external verification evidence only.

**Interfaces:**

- Produces merge-quality GitLab preview evidence and operational staging proof.

- [ ] **Step 1: Push and trigger the fastest pre-MR preview**

```bash
git push -u origin feat/klicker-structured-logging
util/ci/trigger-preview-pipeline.sh \
  --scope infra \
  --fast \
  --ref feat/klicker-structured-logging
```

Expected: GitLab VNet runner preview succeeds. Do not run local Pulumi.

- [ ] **Step 2: Open the draft parent MR**

Target `stg` with title
`build(monitoring): adopt structured log processing`. Link the merged helper MR,
show the old/new helper SHAs, list tests, and include the fast preview result.
The normal MR pipeline must also pass its refresh-inclusive
`infra-preview-mr-stg`; that is the merge-quality evidence.

- [ ] **Step 3: Inspect the preview for unintended changes**

Expected changes are Alloy ConfigMap content and explicit Loki limits only.
Reject and fix any preview that shows Loki schema/storage/replica/cache/resource
replacement, endpoint/credential changes, or unrelated infrastructure drift.

- [ ] **Step 4: Run required deployment-pattern and strict reviews**

Run the cloud repository's `df-cloud-deployment-pattern-audit` before marking
ready, then the required thermo-nuclear maintainability review. Include both
results in the MR description. Do not mark ready or merge without user approval.

- [ ] **Step 5: Validate staging after approved deployment**

After the parent MR lands in `stg` and the normal pipeline applies it:

1. confirm Alloy DaemonSet rollout and readiness;
2. query existing non-JSON and third-party logs;
3. query every Klicker component and assessment variant by `service_name`;
4. send a fake record with diagnostic ID `logging-canary-20260805` and locate
   it via structured metadata;
5. verify level/event filtering;
6. send fake token/cookie/email/body canaries through the application test path
   and prove they do not appear anywhere in Loki;
7. inspect stream cardinality and volume, confirming request/correlation IDs are
   not labels.

- [ ] **Step 6: Promote through the normal release path**

Production follows the existing `stg` to `prd` promotion only after staging
acceptance. Roll back by reverting the parent gitlink commit; the previous Alloy
configuration will still ingest raw application NDJSON.

## References

- [Grafana Alloy `loki.process`](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.process/)
- [Grafana Loki structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/)
