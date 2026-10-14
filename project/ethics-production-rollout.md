# Ethics chatbot production rollout

## Approval summary

The production ethics chatbot should use the prompt verified in staging and support the same optional knowledge retrieval and inline persona videos. The user authorized the production release, prompt promotion and synthetic student verification on 14 October 2026. Execution mode is standard; the main model identity is not supplied.

Prepare alpha.88 from the verified v3-ai source, then publish its tag after the release PR's exact-head checks and reviews pass. Production manifests come from v3. Its deployment PR must update the existing image pins and carry the already-reviewed shared cookie-domain setting so deploy parity holds. No new schema migration is present in the source delta.

Promote only the verified staging persona text into the named production custom mode, preserving its key, model, owner, course, KB bindings, credit policy and other draft edits. Use a rollback-validated serializable transaction, exclusive receipts, exact drift guards and independent readback. Private prompts and receipts stay uncommitted.

Completion requires ready production workloads, a successful migration hook, the intended image digests, prompt equality and a full real-browser synthetic flow with KB citations and all three videos. Pause on failed gates, missing access, material drift, mandatory human-review requirements or insufficient approved test credits. No review bypass or quota reset is authorized.

## Execution details

1. Main owns release and deployment effects, secrets, prompt promotion and live acceptance. A read-only source explorer maps existing release mechanics; planner and final reviewer verify the settled sequence.
2. Source baseline is v3-ai be6ae67368b3249dc01c2284bd6a8d66812a062d. Run the repository alpha dry-run and verify its 22 configured version targets without mutation. Generate versions and changelog through `pnpm run release:alpha -- --skip.tag`; inspect staged metadata, run applicable checks and deliver a release PR to v3-ai.
3. After required CI and reviews, merge normally, verify successful required checks on the actual merged v3-ai commit and tag that exact release commit. Await every required production image and record digests. In a v3-based deployment PR, change the existing 17 image pins to alpha.88 and add the shared cookie-domain chart setting. Require strict deploy parity, rendered chart validation, exact-head CI and applicable reviews before merge.
4. Verify strict deploy parity and required checks on the actual v3 merge commit before completion. Verify production Argo revision, health, ready replicas, image IDs and successful PreSync migration. Retain alpha.87 pins as the image rollback target; migration rollback remains forward-only. Do not change cluster resources directly.
5. Bind the prompt operation to live production and staging snapshots. Copy persona text into published custom-mode and authored system-prompt fields, plus the matching draft persona field. Preserve all other row and draft fields. Validate via the actual transaction with rollback before applying once. Prepare a guarded receipt-bound rollback; do not execute it without a concrete recovery decision.
6. Test only the existing synthetic participant. Maximum 35 assistant responses and the existing CHF 10 evaluation envelope apply. Any additive test-credit change requires the specific approval requested in the task; retain usage and reset history. Verify automatic feedback after 8-12 first-conversation role replies and at most ten second-conversation replies, consent, persistent pressure resistance, optional KB calls outside the role, cited factual answers, stop behavior, full video playback, reload and mobile layout. Report application credits separately from currency costs.

## Progress

Public source mapping completed. Exact source push CI and staging acceptance passed. Production is healthy on alpha.87. Prompt promotion, release preparation and production acceptance remain pending. Existing production draft persona and model match published values; unrelated draft fields will be preserved. User approved the additive 3 test credits, preserving history and reset count. No credit apply has occurred yet.
