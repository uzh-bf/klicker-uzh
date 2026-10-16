# Ethics chatbot production rollout

## Approval summary

Prepare the ethics chatbot release with optional knowledge retrieval, inline persona videos, custom-mode welcome text and starter prompts, and the larger multiline prompt editor. The current approved sequence ends after staging verification and refreshing the existing source and deployment pull requests. Publishing a tag, merging the production deployment and changing production configuration remain separate delivery steps. Execution mode is standard.

Prepare alpha.88 from the verified v3-ai source, then publish its tag after the release PR's exact-head checks and reviews pass. Production manifests come from v3. Its deployment PR must update the existing image pins and carry the already-reviewed shared cookie-domain setting so deploy parity holds. The source includes one idempotent data migration: accounts on the base AI tier with a non-empty cost-center value move to the advanced tier. It changes no schema objects and does not overwrite accounts already on another tier.

Promote only the verified staging persona, welcome text and authored starter prompts into the named production custom mode, preserving its key, model, owner, course, KB bindings, credit policy and other draft edits. Use a rollback-validated serializable transaction, exclusive receipts, exact drift guards and independent readback. Private prompts and receipts stay uncommitted.

Completion requires ready production workloads, a successful migration hook, the intended image digests, prompt equality and a full real-browser synthetic flow with KB citations and all three videos. Pause on failed gates, missing access, material drift, mandatory human-review requirements or insufficient approved test credits. No review bypass or quota reset is authorized.

Preserve the historical migration file bytes when preparing the release. Its whitespace predicate is documented here without changing that file:

```sql
-- Match JavaScript String.prototype.trim(): the U& literal lists its whitespace
-- and line-terminator code points (including tabs and non-breaking spaces).
-- PostgreSQL's default btrim removes only spaces; <> '' rejects a blank result.
```

## Execution details

1. Main owns release and deployment effects, secrets, prompt promotion and live acceptance. A read-only source explorer maps existing release mechanics; planner and final reviewer verify the settled sequence.
2. Source baseline is v3-ai a12bd8260500d5b3d24b668564dab09d442afdc4. Run the repository alpha dry-run and verify its 22 configured version targets without mutation. Regenerate the same alpha.88 version and changelog through `pnpm run release --release-as 3.4.0-alpha.88 --skip.tag true --skip.commit true`; inspect staged metadata, run applicable checks and deliver a release PR to v3-ai.
3. After required CI and reviews, merge normally, verify successful required checks on the actual merged v3-ai commit and tag that exact release commit. Await every required production image and record digests. In a v3-based deployment PR, change the existing 17 image pins to alpha.88 and preserve the shared cookie-domain chart setting already present on the deployment base. Require strict deploy parity, rendered chart validation, exact-head CI and applicable reviews before merge.
4. Verify strict deploy parity and required checks on the actual v3 merge commit before completion. Verify production Argo revision, health, ready replicas, image IDs and successful PreSync migration. Retain alpha.87 pins as the image rollback target; migration rollback remains forward-only. Do not change cluster resources directly.
5. Bind the prompt operation to live production and staging snapshots. Copy persona text into published custom-mode and authored system-prompt fields, plus the matching draft persona field. Copy the welcome and starters only into the corresponding mode fields after snapshot validation. Preserve all other row and draft fields. Validate via the actual transaction with rollback before applying once. Prepare a guarded receipt-bound rollback; do not execute it without a concrete recovery decision.
6. Test only the existing synthetic participant. Maximum 35 assistant responses and the existing CHF 10 evaluation envelope apply. Any additive test-credit change requires the specific approval requested in the task; retain usage and reset history. Verify automatic feedback after 8-12 first-conversation role replies and at most ten second-conversation replies, consent, persistent pressure resistance, optional KB calls outside the role, cited factual answers, stop behavior, full video playback, reload and mobile layout. Report application credits separately from currency costs.

## Progress

The staging-sync pull request has merged. Runtime, prompt, knowledge-base, video and browser acceptance evidence is retained privately. Refresh the existing release and deployment branches with history-preserving merges, regenerate the same alpha.88 release metadata, and obtain current-head CI and review evidence. This preparation does not establish production runtime acceptance.
