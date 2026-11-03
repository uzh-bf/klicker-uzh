# Verification and recovery

The configuring user is a member of the teaching staff. A separate student account is **optional**, not a prerequisite for executing this skill, improving it or contributing its source. Record which access path was actually tested.

## Functional verification after authorised changes

1. Reopen the OLAT node and compare its saved provider, exact unsigned URL, display, launch/consent and access settings with the approved proposal.
2. Launch the intended node from the course preview or ordinary course run, using the authorised signed-in teaching staff account. Confirm the correct published bot and usable input.
3. Send one small authorised synthetic message. Wait for a new completed response; a welcome screen, spinner, old conversation or copied screenshot is insufficient.
4. Check expected mode/language/model behaviour and course-source use if relevant. A Tutor may ask a question instead of explaining; do not rewrite the persona to satisfy the wrong test expectation.
5. Record displayed credit consumption without treating it as a guaranteed cost for future exchanges. Reopen the test conversation and check the answer persists.
6. Test each retained fallback. A direct-window success does not by itself prove embedded LTI works.
7. If publishing was authorised, inspect OLAT's selection, publish only the agreed edits and verify the normal course route. Otherwise state that the saved draft is unpublished.

Synthetic prompt: “Integration test by the course team. In [language], give one brief explanation of [non-sensitive concept], and cite a course source if available.” Keep the test small. Do not open participant conversation records or use personal/student data.

For approved chatbot-setting changes, also read back each saved section and record the revision state. Owner preview may still use the previous approved configuration. A live behaviour test of a newly saved revision remains pending until it is approved; this does not mean the save failed.

## Optional additional learner-access check

If a suitable separate account is already available and authorised, an additional check can cover:

1. ordinary OLAT visibility for the intended group;
2. first LTI launch and the institution's account-linking route;
3. access to the correct linked Klicker course and published bot;
4. the person's own disclaimer decision;
5. a completed synthetic answer and reopening.

Do not request student credentials, create identities or sign the owner out merely to complete this optional check. A learner declining the disclaimer must not be coerced into accepting it. Guest or fallback behaviour in source code does not establish access for this cohort.

With only an owner login and an OLAT participant-preview role, report exactly that. Complete the authorised setup by teaching staff and record first-time learner access as untested; it is not a blocker for the skill, its installation or a code/documentation contribution.

## Recovery from observed evidence

| Symptom                                              | Action                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generic Key/Password form                            | Inspect LTI Version for the institution's named KlickerUZH preset. Do not invent credentials.                                                                |
| Missing native Chatbot choice or OLAT-link generator | Continue the documented LTI-page URL construction; these future/deployment-dependent options are not prerequisites.                                          |
| Authentication/redirect failure                      | Compare exact registered base, decoded destination and current provider instructions. Use the dated no-slash observation only when the registration matches. |
| Shell loads but sending fails                        | Inspect the displayed authentication/consent/error state and supported iframe/window route; do not weaken protections.                                       |
| Direct bot works, course route fails                 | Check linked course, actual participant identity/access, published status and launch path. Leaderboard opt-in is not enrollment.                             |
| Metadata/course mismatch                             | The reviewed editor fixes course association at creation; do not silently move/recreate the bot. Resolve with its owner.                                     |
| Pending revision locks settings                      | Preserve the published configuration and pending work. Wait for authorised review rather than bypassing it.                                                  |
| Saved settings absent in preview                     | Read the live/pending notice; owner preview can use the old approved revision.                                                                               |
| Credits unchanged after policy approval              | Existing balances are not immediately topped up or clamped; inspect the current balance and next ordinary refill.                                            |
| No participant credits                               | Verify the permitted model/fallback and account entitlement; do not claim either a guaranteed hard stop or unlimited use.                                    |
| Source, tutorial and UI disagree                     | Record inspected commit, configured tag and observed interface separately; use the matching release before prescribing changes.                              |
| Browser action fails                                 | Refresh the tab/frame state and use the tool's documented input path. Do not confuse automation failure with application failure.                            |
| Publication includes unrelated edits                 | Publish only a separable authorised selection. Otherwise stop that step and ask about the specific conflict.                                                 |
| No browser control/edit rights                       | Provide the prepared values and manual procedure; say what was not executed.                                                                                 |

Retry only after new evidence supports a changed approach. If supported authorised routes still fail, report the concrete missing prerequisite and preserve the prepared configuration. Do not repeatedly alter global settings.

## Evidence and recovery record

Use [the integration record](../assets/integration-record.md). Distinguish constructed, configured, saved, submitted, approved, tested and published. Capture private screenshots only when useful and permitted; omit secrets, signed URLs and conversations from public evidence.

Preserve a working primary route and any agreed fallback. Record a rollback path. Remove only authorised disposable test nodes and follow the host's actual recovery/confirmation rules; do not delete another person's work.
