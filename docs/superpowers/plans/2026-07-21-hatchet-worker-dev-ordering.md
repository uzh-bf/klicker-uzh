# Hatchet Worker Development Startup Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every local application development variant builds `@klicker-uzh/hatchet` before persistent workers and applications start.

**Architecture:** Extend the existing explicit Turborepo build prerequisites for the four application development variants. Preserve the package scripts, add a narrow shared-client logger compatibility method for Hatchet SDK 1.9.4 under `tsx --watch`, and keep Pino's development formatter in-process instead of starting a second logging worker thread. Verify both the static task graph and a real local worker registration before exercising the Build mutation.

**Tech Stack:** Turborepo 2.5.6, pnpm 11.5.0, Hatchet TypeScript SDK 1.9.4, JSON configuration

## Global Constraints

- Modify `turbo.json` for startup ordering, the shared Hatchet client for the reproduced SDK/`tsx --watch` heartbeat collision, and the general worker logger to avoid a development-only Pino transport worker.
- Apply the same prerequisite to `dev`, `dev:lti`, `dev:offline`, and `dev:assessment`.
- Do not change package scripts, dependencies, environment variables, or external service configuration.
- Keep the existing dependency order and add `@klicker-uzh/hatchet#build` immediately after `@klicker-uzh/graphql#build` in each task.
- Do not restart `run_app_dependencies` or the external port forwards.

---

### Task 1: Order Hatchet Builds Before Persistent Development Tasks

**Files:**

- Modify: `turbo.json:142-189`
- Verify: `turbo.json`

**Interfaces:**

- Consumes: Turborepo's package-specific `package#task` dependency syntax and the existing `@klicker-uzh/hatchet` package `build` script.
- Produces: Four development task graphs in which `@klicker-uzh/hatchet#build` completes before persistent development tasks start.

- [x] **Step 1: Record the failing task graph**

Run:

```bash
pnpm exec turbo run dev --dry=json > /tmp/klicker-turbo-dev-before.json
jq -e '.tasks[] | select(.package == "@klicker-uzh/hatchet-worker-general" and .task == "dev") | .dependencies | index("@klicker-uzh/hatchet#build")' /tmp/klicker-turbo-dev-before.json
```

Expected: `jq` exits non-zero because the general worker development task does not currently depend on the Hatchet build.

- [x] **Step 2: Add the explicit prerequisite**

In each of `tasks.dev.dependsOn`, `tasks["dev:lti"].dependsOn`, `tasks["dev:offline"].dependsOn`, and `tasks["dev:assessment"].dependsOn`, change:

```json
"@klicker-uzh/graphql#build",
"@klicker-uzh/markdown#build"
```

to:

```json
"@klicker-uzh/graphql#build",
"@klicker-uzh/hatchet#build",
"@klicker-uzh/markdown#build"
```

- [x] **Step 3: Validate configuration and formatting**

Run:

```bash
jq empty turbo.json
pnpm exec prettier --check turbo.json
git diff --check
```

Expected: all commands exit zero.

- [x] **Step 4: Verify all four resolved task graphs**

Run a Turbo dry-run for each task:

```bash
for task in dev dev:lti dev:offline dev:assessment; do
  pnpm exec turbo run "$task" --dry=json > "/tmp/klicker-turbo-${task//:/-}-after.json"
  jq -e --arg task "$task" '[.tasks[] | select(.task == $task)] | length > 0 and all(.dependencies | index("@klicker-uzh/hatchet#build"))' "/tmp/klicker-turbo-${task//:/-}-after.json"
done
```

Expected: every `jq` invocation exits zero and prints `true`.

- [x] **Step 5: Run a real startup verification**

Stop only the current `pnpm run dev` process, leave Docker dependencies and external port forwards running, and start:

```bash
pnpm run dev
```

Expected worker output includes:

```text
Starting Hatchet worker
Selected workflows
Starting worker to process jobs...
```

Verify local Hatchet contains all three KB workflows:

```sql
SELECT name
FROM "Workflow"
WHERE name IN (
  'build-chatbot-knowledge-graph',
  'ingest-kb-resource',
  'monitor-kb-ingestions'
)
ORDER BY name;
```

Expected: three rows.

- [x] **Step 6: Verify graph Build dispatch**

Retry Build for chatbot `8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f` in the manage UI.

Expected:

- local `build-chatbot-knowledge-graph` is accepted by a current general worker;
- graph status progresses from `QUEUED` to `PROCESSING`;
- `externalWorkflowRunId` is persisted;
- external Hatchet contains a new `course-kg-ingestion` run.

- [x] **Step 7: Record the startup-ordering invariant**

Add this entry under `project/CODEBASE_NOTES.md`'s infrastructure section:

```markdown
- **General Hatchet worker dev ordering**: Persistent application development tasks must depend on `@klicker-uzh/hatchet#build`; the worker imports the package's generated `dist` output and otherwise can fail before registering workflows on a clean startup. (`turbo.json`, `apps/hatchet-worker-general`)
```

- [x] **Step 8: Commit the implementation**

```bash
git add apps/hatchet-worker-general/src/logger.ts packages/hatchet/src/client.ts turbo.json docs/superpowers/specs/2026-07-21-hatchet-worker-dev-ordering-design.md docs/superpowers/plans/2026-07-21-hatchet-worker-dev-ordering.md project/CODEBASE_NOTES.md
git commit -m "fix(hatchet): stabilize worker startup in development"
```
