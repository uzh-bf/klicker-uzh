# Safer migration-hook cleanup and recovery docs plan

Status: approved execution plan (planner pass verdict REVISE, findings
integrated 2026-08-23). Companion packages: df-cloud
rs-argo-klicker-monitoring (alerts + runbook) and azure-helpers H1 (metrics
plumbing). Cluster sync/application stays explicitly gated.

## Goal

Remove the known deadlock trigger from the KlickerUZH v3 chart: stop asking
ArgoCD to delete succeeded PreSync migration Jobs immediately, keep failure
visibility, and document the changed cleanup contract plus recovery steps so
operators act from the wiki, not tribal memory.

## Non-goals

- No migration logic, image, or workflow change; no schema change.
- No Argo upgrade and no Gatekeeper change (mutation root cause unconfirmed).
- No cluster mutation; the fix lands only when the reviewed branch is merged
  and synced through the normal pipeline.

## Execution contract

- Authority: same approval basis as companion plans. Granted: local chart/doc
  edits and conventional commits on rs/argocd-migration-prevention from
  origin/v3 @ ee5712399. Withheld: push, PR open/merge, cluster sync.
- Execution owner: this session (main); chart semantics are the core risk.
  Boundary owner: self.
- Terminal condition: annotation changed with updated rationale comments,
  docs consistent, helm render proves exactly BeforeHookCreation, no TTL,
  deadline unchanged; committed.
- Pause: evidence that dropping HookSucceeded breaks another documented
  workflow.

## Research and review inputs

- Planner-integrated decision: hook-delete-policy becomes BeforeHookCreation
  only. Rationale: succeeded-Job deletion raced admission mutation/finalizer
  removal upstream (argo-cd issues 24187 and 27507); keeping the succeeded Job
  until the next sync preserves logs and removes the immediate-deadlock
  surface. Failed jobs were already kept.
- Before this change, the template kept failed Jobs and deleted succeeded ones
  (BeforeHookCreation,HookSucceeded), TTL unset by default,
  activeDeadlineSeconds: 600.
- Docs already state "Nothing alerts on hook failure"; update after the
  companion alert package merges, not before.

## Primitive impact

None (deployment mechanics + operator docs).

## ADR gate

ADR-0001 stays authoritative; add the deletion-policy consequence line there
instead of a new ADR (same decision, narrowed cleanup).

## Test portfolio

| Risk | Obligation | Seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- |
| Rendered hook loses debug retention or gains TTL | extend existing via render proof | helm template with stg-equivalent values | Policy typo silently deletes failed jobs or TTL deletes logs | K1 |

## Slice

### K1 - hook-delete-policy narrowing + docs

- Route: main. Acceptance: rendered Job annotation equals
  argocd.argoproj.io/hook-delete-policy: BeforeHookCreation;
  ttlSecondsAfterFinished absent by default; activeDeadlineSeconds: 600;
  comment blocks in template/values explain the deadlock rationale;
  docs/data-and-migrations.md recovery section matches the new policy and
  references the df-cloud runbook once it exists; ADR-0001 consequence
  updated.
- Files: deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml,
  deploy/charts/klicker-uzh-v3/values.yaml, docs/data-and-migrations.md,
  docs/adr/0001-automate-db-migrations-via-argocd-presync-hook.md.
- Verification: helm template assertion script (local, read-only) and an rg
  guard that no HookSucceeded delete-policy remains for the migrator.
- Commit: fix(deploy): keep successful migration jobs until next sync.

## Progress

- Status: executing K1 after plan commit; no local changes yet.
- Delivery layer: local branch ready for PR once delivery is authorized.
