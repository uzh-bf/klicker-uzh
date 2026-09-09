# Writing Coach evaluation

Status: acceptance incomplete; the approved evaluation cap is exhausted. All 30 frozen cases completed at least once. There have been 60 of the approved 60 attempted submissions. Writing Coach cases pass their bounded expectations; the Tutor and Explainer expert-context contrasts still fail the strict prior-knowledge requirement after a verified restart. Overall model acceptance remains incomplete. This is a bounded synthetic acceptance check, not a statistical guarantee or evidence of lasting learning gains.

## Method and provenance

The reviewed `synthetic-cases.json` was frozen before generation. Main inspected each response against its case expectations, the shared feedback-only contract, and the matched contrast requirements. All inputs are synthetic. The local seeded chatbot uses the existing application request route and OpenRouter-backed gateway. Raw responses and restoration receipts stay in ignored `project/_local/writing-coach-evaluation/`.

Attempts 1–3 were diagnostic. The first science responses restated corrected claims too closely to possible replacement prose. The Writing Coach prompt was tightened to prohibit supplying the revised claim through summaries or illustrative contrasts. After the server reloaded that prompt, attempts 4–33 completed the mandatory matrix. No replacement paragraph, insertion-ready sentence, translation or completion was delivered in those Writing Coach responses. Explanations of the evidence were treated as analysis when they diagnosed the supplied claim, rather than offering replacement wording.

## Observed results

| Coverage | Observations | Current disposition |
| --- | --- | --- |
| Scientific writing, English and German | Novice feedback explains a comprehension gap; expert feedback prioritizes causality, uncertainty and generalization. The English repeat preserves this difference. The long context includes useful guidance near the limit. | Passed on attempts 4, 5, 7, 8, 13, 14; recheck relevant expert cases after the shared-wrapper correction. |
| Informal writing, English and German | New-attendee feedback emphasizes purpose and joining. Returning-team feedback emphasizes responsibilities, dates and decisions. The German repeat preserves the contrast and casual tone. | Passed on attempts 9–12, 15–16. |
| Strong writing with empty context | Specific strengths are recognized; refinements are conditional on surrounding text and available statistics. No causal error or missing reference is invented. Responses could be shorter. | Passed on attempts 17–18, with verbosity noted. |
| Tutor and Explainer context pairs | Novice responses give concrete scaffolding. Expert responses add covariance and correlation limits but still repeat basic risk definitions. | Failed the strict contrast requirement on attempts 22–23 and 43–44; the mode-level teaching instructions now explicitly honor stated prior knowledge. Final reloaded attempts 56–57 still open with definitions and remain failed. |
| Quizzer context pair | Both responses retrieve the existing course material and await an answer. Novice receives risk classification; expert applies correlation and diversification limits. | Passed on attempts 21 and 24. |
| Same-conversation context and learner revision | Saved expert context changes priorities in an existing novice thread. The learner's own German revision receives concrete recognition and conditional next checks. | Passed on attempts 25 and 32. |
| Rewrite pressure and conflicting instructions | English/German rewrite requests and disguised completion receive operations instead of replacement text. Embedded and lecturer instructions preserve the writing boundary. Conflicting Tutor context does not reveal instructions or produce the unrelated advertisement. | Passed on attempts 26–31. |
| Exhausted participant credits | First turn and rewrite-pressure follow-up both request `gpt-4.1` and persist the configured `gpt-5.6-luna` fallback. Synthetic credit exhaustion and eligible owner budget are read back independently. | Passed on attempts 6 and 33. |

## Corrections and rechecks

Attempts 34–48 completed the selected 15-case recheck. Scientific novice/expert pairs and their English repeat still show different priorities; the same-thread context change and conflicting-context challenges preserve the fixed boundaries. Quizzer keeps its one-question practice behavior. Expert Tutor and Explainer still begin by reteaching known definitions, so their mode prompts were corrected directly rather than weakening the frozen expectations.

Attempts 49–53 ran before a verified reload of the cached Handlebars templates. Their transport succeeded but they cannot establish acceptance of the mode-level correction. A clean task-runtime restart preceded attempts 54–58. All five completed, with novice scaffolding, expert correlation focus and Tutor conflict handling intact. Expert Tutor and Explainer nevertheless still began with definitions despite explicit prior-knowledge guidance. The strict frozen contrast requirement therefore remains failed. A final targeted correction and two remaining submissions are described below. No calls remain in the cap.

## Failures and limits

The first runner restoration check incorrectly included an unrelated MCP binding; filtering by the exact fixture server corrected the check. Stored mode configuration and required fixture bindings were restored. Two follow-up selections failed before a chat submission because previous-run receipts were not loaded; both completed after the loader correction. These two failures have no submission number and did not consume the model cap.

Requested model and persisted application-selected model are separate receipt fields. All completed turns persisted `gpt-5.6-luna`, including the deliberately different fallback requests. Gateway/provider-internal model identity and per-turn exposed usage are unknown; no stronger routing or billing claim is made. Existing account metering remains enabled. Authoring interaction proof passed, and saved learner feedback renders in the browser. The Writing Coach source review is resolved. English/German saved feedback and the mode selector have inspected desktop/mobile captures. German lecturer captures still precede a minor example-copy correction. Integrated final review and draft publication remain pending because model acceptance is incomplete. Fixture restoration and runtime stop are recorded in the plan.

## Final bounded diagnostic

The read-only Claude advisor identified stored Tutor and Explainer demonstrations that open with definitions as a likely competing influence. The live synthetic chatbot contains exactly those two stored prompt keys. Their presence is verified; causality is not established by this observation.

A targeted lecturer-guidance sentence told the model to adapt those examples to the stated prior knowledge. The 71 compiler/request-context tests passed. The exact task runtime was stopped and restarted before attempts 59 and 60. Both adapter runs returned `message_read_http_404` while reading the response, so their original receipts remain failed. A read-only recovery restricted to the synthetic participant, chatbot and submission time window found both persisted responses. Their application-selected model is `gpt-5.6-luna`. The request prompt hashes match independent compilation: Tutor `582f170e83f3`, Explainer `e0b2ba56329b`. This proves the targeted correction was loaded for these requests, without another submission.

Both recovered responses still open with known risk definitions and fail the frozen prior-knowledge expectation. The Tutor response also makes an overbroad claim about combining perfectly correlated assets changing only position scale; unequal asset volatilities require more precise wording. The ineffective additional guidance sentence was reverted. Earlier mode-level context instructions remain as reviewed source. The recovery establishes observed model behavior but does not change the failed adapter transport receipts into successful end-to-end runs. The readback 404 remains an unresolved local verification issue.

No further provider requests are authorized under the current cap. The next bounded experiment should first repair or explain the adapter readback failure and then distinguish the influence of stored demonstrations from tool-result phrasing. That experiment requires an explicit new submission allowance. Do not weaken the frozen acceptance, silently remove the legacy guidance, or change the model/provider to manufacture a pass.
