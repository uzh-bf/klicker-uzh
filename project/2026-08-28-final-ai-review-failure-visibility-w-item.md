# W-Item Contract — Surface final-review failure output in job summaries

- Item ID: `fix-final-review-failure-visibility`
- Contract source commit: `0892b61dc5c35694faa4e7ed90d36cddffadb8aa` (origin/v3 tip; worktree base)
- Worktree (sole writer: delegated task): `trees/rs/fix-final-review-stderr-visibility`, branch `rs/fix-final-review-stderr-visibility`
- Base/target: base `origin/v3` @ `0892b61dc`; eventual PR target `v3` (push/PR withheld — separate authority)

## Plain-language outcome

When the final-review or cumulative stack-review CLI fails inside
`.github/workflows/check-ocr-final-review.yml`, its stderr and result JSON
must appear in the GitHub job summary instead of being discarded, so an
operator can diagnose the failure from the run page. This was requested after
runs 33201401791 and 33201392763 failed in under ten seconds with the CLI's
only evidence written to runner temp files the workflow never publishes.

## Scope

- Add one failure-capture step after the single-PR `Run final review` step.
- Add one failure-capture step after the stack `Run cumulative code review` step.
- Each step writes stderr (and result JSON when present) into
  `GITHUB_STEP_SUMMARY`; missing files render a placeholder, never fail the job.
- No review-policy, model, secret-handling, or status semantics change.

## Owned paths

- `.github/workflows/check-ocr-final-review.yml`
- This contract file only to append a **Progress** section.

## Acceptance checks

1. Workflow YAML parses (Ruby `YAML.load_file` or equivalent).
2. Capture steps reference only existing env paths and are inert on success.
3. `git diff --check` clean; diff limited to owned paths; no secrets added.
4. Local reproduction note: pinned CLI v1.9.10 starts normally when a config
   file is loadable, so a CI-side config handoff defect remains the leading
   suspect; this change makes the next failure self-diagnosing.

## Finish boundary, withheld actions

- Finish boundary: verified local commit on `rs/fix-final-review-stderr-visibility`.
- Withheld: push, PR, merge, workflow reruns, review commands, plan-file edits
  in the MVP worktree, any other work item.

## Progress

- Status: Complete at the verified local-commit boundary.
- Implementation commit: `4d65cac07` — both failure-capture steps added, no
  other workflow changes; contract file added.
- Evidence: Ruby YAML parse passed; `git diff --check` clean; Prettier check
  passed on the workflow; helper tests 33/33 passed on the exact base
  (`0892b61dc` + this commit); diff limited to the two owned paths.
- Withheld actions remain withheld: push, PR, merge, workflow reruns, and
  review commands require separate authority.
