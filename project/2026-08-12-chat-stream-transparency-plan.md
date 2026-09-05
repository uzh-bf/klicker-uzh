# Chat Stream Transparency Follow-up

## Goal and package

- Problem: source cards derived from a completed `doc_query` result render before the model begins its answer, and Auto Mode uses Chat Completions so assistant-ui receives no reasoning parts.
- Evidence: the real Browser run showed the source section at 5.1 s while the stream was active and no answer text existed; direct Luna showed `Denkprozess`, Auto did not. The current model registry uses `supportsReasoning` both for the user effort selector and for choosing Responses versus Chat Completions.
- Decision: add one separate `usesResponsesApi` capability to the model registry, keep Auto's manual reasoning-effort selector disabled, and configure local LiteLLM to turn each routed alias's fixed effort into a reasoning summary. An omitted capability inherits `supportsReasoning`, preserving the current adapter for every existing reasoning model and older registry JSON. Keep source cards derived from tool results, but reveal them only after answer text exists.
- Package: full-path follow-up layer `rs/chat-stream-transparency` above `rs/chat-local-mcp-fixture-clean`. It is one coherent student-visible stream-transparency package; no push or PR update is authorized.
- Risk: the model capability changes an OpenAI-compatible protocol seam and the LiteLLM summary behavior. It requires intermediate review and real local Auto/MCP proof.

## Planning review

- Initial attempt: blocked before repository inspection because the dispatch omitted the exact path allowlist and complete register preflight metadata.
- Correction: `DONE_WITH_CONCERNS`; all five required safeguards below are incorporated.
- Accepted: preserve omitted-capability behavior; subscribe to answer text independently from source normalization; add a deterministic post-tool/pre-text pause; prove routed Auto summaries rather than only direct aliases; use separate immutable slice commits and review ranges.

## Slice 1: Preserve answer-first source presentation

- Route: main.
- Execution-tier skip reason: critical-path coupling with assistant-ui's ordered message parts, citation normalization, and the deterministic streaming browser seam.
- Test obligation: extend existing Playwright coverage. The distinct regression is a valid source result becoming visible before any answer text; existing final-state assertions do not catch it.
- Do: select non-whitespace answer presence independently from the memoized tool-result normalization and withhold the standalone source section until that text exists. The gate updates on the first non-empty text delta without reparsing source results on every token; inline citation normalization remains available to streamed markdown.
- Check: focused chat tests, an extension to the existing stream fixture that pauses immediately after tool output and before text, and the existing live citation test proving sources remain absent during that pause and appear after the first non-whitespace text. Repeat the real Browser source/MCP journey.
- Commit: `fix(chat): defer sources until answer text`.

## Slice 2: Surface Auto reasoning without a manual effort override

- Route: main.
- Execution-tier skip reason: critical-path coupling across registry schema, API adapter choice, LiteLLM per-tier effort semantics, deployment values, and live OpenRouter proof.
- Test obligation: extend registry parity/config checks and the real upstream Browser flow. The failure to catch is Auto still selecting Chat Completions or request-level effort flattening the router's tier-specific policy.
- Do:
  - Add `usesResponsesApi` to both registry schemas. Normalize an omitted value to `supportsReasoning`, so direct reasoning models and older deployment JSON retain their current adapter; set Auto explicitly true while leaving `supportsReasoning: false` and no configurable efforts.
  - Enable it for Auto in built-in registries and staged/production values, and extend parity/config checks to compare `supportsReasoning`, `usesResponsesApi`, and rendered deployment values.
  - Make `store` follow the Responses capability.
  - Enable LiteLLM reasoning auto-summary locally so fixed Luna/Sol alias efforts become Responses reasoning parts; do not send a request-level effort for Auto.
  - Update the Chat wiki, test runbook, plan progress, and one wiki change log.
- Check: schema/parity tests and rendered staging/production registry compatibility. Locally, call `auto-router` through Responses with controlled semantic Luna and Sol routes; correlate the routed model and fixed effort in LiteLLM logs with a returned reasoning-summary part. Then run full Chat tests, root checks/build, and real Browser proof that Auto shows reasoning and still completes/reloads the MCP answer with sources. Deployed router configuration remains external: production compatibility is not claimed without an authorized staging Responses/tool-continuation/reasoning smoke test.
- Commit: `fix(chat): expose Auto reasoning summaries`.

## Completion gates

- Slice 1 receives its own simplifier and records that intermediate review is not required because it changes presentation timing without a trust, protocol, or data-integrity boundary.
- Slice 2 receives one simplifier and one intermediate reviewer in parallel on its separate immutable commit/range.
- Integrated final reviewer covers correctness, plan compliance, maintainability, security, and the changed protocol/configuration seam.
- Stop before push, PR creation/update, or merge.

## Progress

- Planning-stage review: done; all required corrections incorporated.
- Slice 1: committed as `a03162584`; Chat check, 239 Chat tests, Playwright typecheck/list, and root `check:all` passed. The focused Playwright runtime was blocked before page launch because the DevPod lacks the pinned Chromium binary; a real Browser pass remains in the package completion gate.
- Slice 1 simplifier: done — no justified net reduction. Intermediate review: not required — presentation timing and deterministic fixture only, with no trust, protocol, or data-integrity boundary change.
- Slice 2 implementation: complete. Registry compatibility tests preserve the omitted-field behavior, rendered staging/production values keep Auto on Responses without a manual effort capability, and the recreated local LiteLLM v1.96.2 service reports the new summary flag as active.
- Real Browser pass: complete. Auto remained selected; the live MCP turn showed no source section during the post-tool/pre-answer gap, then produced and persisted the marker, answer, tool result, and synthetic source. A controlled Auto reasoning turn rendered `Denkprozess`, and LiteLLM recorded the semantic REASONING route to `gpt-5.6-sol-medium`.
- Slice 2: committed as `9d0c3c200`; the simplifier's accepted test-type reduction is `c19b1ab0d`. The configured intermediate reviewer remained runtime-unavailable after bounded retries, so no substitute review is claimed.
- Final package verification: root `check:all` and production build passed. The exact branch range has 239 substantive changed lines.
- Blocked: the configured integrated-final reviewer is also runtime-unavailable (`agent type is currently not available`). The package is locally verified but cannot be presented as review-complete or published until that required gate can run.
