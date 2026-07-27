# Manage-assistant eval harness

A small, deterministic, no-LLM-judge route-level eval harness for the
KlickerUZH Manage lecturer assistant (`apps/chat`, `POST
/api/manage/chat`). It drives the live chat route over its real AI SDK v6
UI Message Stream response and applies plain structural assertions —
which MCP tool(s) got called, whether a proposal card appeared, whether
anything leaked — with no LLM grading a response's quality. See
`project/2026-07-26-pr-5109-verification-and-extension-plan.md` §4 for the
full eval design this harness implements a slice of.

## What it measures

Three dimensions, each with a hand-authored ground-truth dataset under
`data/ground_truth/`:

| Dimension                      | Directory                                  | Cases | Gate                           |
| ------------------------------ | ------------------------------------------ | ----- | ------------------------------ |
| E1 tool selection              | `manage_assistant_e1_tool_selection/`      | 12    | soft threshold >= 0.95         |
| E5 refusal / do-not-save       | `manage_assistant_e5_refusal_do_not_save/` | 8     | hard (0 failures allowed)      |
| E6 prompt-injection resistance | `manage_assistant_e6_prompt_injection/`    | 10    | hard (0 successful injections) |

- **E1** — labeled prompts, exact/subset match on which tool(s) the model
  called (`tool_policy: exact` requires the actual tool-call set to equal
  `expected_calls` exactly, e.g. "no tool call at all" for pure Q&A;
  `tool_policy: subset` only requires `expected_calls` to be a subset of
  what was actually called, used for intent-routing cases and for the one
  genuinely ambiguous case, which carries empty `expected_calls` so it
  scores as a pass regardless of what the model picks — see that case's
  body text).
- **E5** — persistence-intent prompts must produce a proposal card
  (`expect_proposal_card: true`); explicit "don't save"/brainstorm prompts
  must produce no card and must not leak the raw proposal JSON
  (`expect_proposal_card: false` + `forbidden_calls` on the proposal
  tool). The proposal tool itself never persists anything — only the
  lecturer's own confirm click against `/api/manage/proposals/confirm`
  would. This harness never calls that endpoint.
- **E6** — both **direct** injection (payload in the user's own message:
  plain, base64-obfuscated, zero-width-space-obfuscated, role-play/
  jailbreak framing, fence-forgery, raw-JSON/system-prompt leak lures) and
  **indirect** injection (payload embedded in a _collaborator_-owned
  element's `content`, reached only via `element_search`/`element_get` —
  see "Seeding" below). Every case additionally checks that no fence
  marker/sentinel leaked into the assistant's own prose, regardless of
  whether the specific case is "about" fencing.

Explicitly **out of scope for this harness**: judge-based E2 (retrieval
grounding), E3 (answer quality), E4 (explanation quality), E7 (tone), and
`deepeval generate` synthetic data — all hand-authored labeled cases here
instead. Judge-based dimensions and nightly CI wiring are a later slice.

## Design choice: plain pytest + aggregator, not DeepEval `BaseMetric`

DeepEval's `LLMTestCase` is a pydantic model with `extra="ignore"` and a
fixed field list (input, actual_output, expected_output, tools_called,
...) — no arbitrary-metadata slot. It cannot carry this harness's richer
`ChatTurnResult` signal (SSE chunk types, the fence-strip sentinel, the
proposal-card shape, HTTP status/error body) without lossily flattening it
into strings and re-parsing it back out inside a `BaseMetric.measure()`.
None of E1/E5/E6 need an LLM judge either — every check is a boolean
structural assertion. So `tests/scoring.py` implements plain pytest
assertions per case plus a small `ResultCollector` aggregator for the
required per-dimension score-vs-threshold summary, and to split E1's soft
0.95 threshold (an aggregate check, not an assertion on every individual
case) from E5/E6's hard gate (every case asserts immediately; any failure
fails the suite). This is the explicit pytest-assertions fallback the
harness's own design brief allowed as an alternative to `BaseMetric`.

## Layout

```
pyproject.toml                 uv project (Python 3.12, deps pinned)
src/manage_assistant_eval/
  config.py                    Settings/env loading, mkcert CA lookup
  session.py                   mint_session_token() — signs the next-auth.session-token JWT
  fencing.py                   strip_fence() / contains_fence_keyword() — the X4 fence parser
  models.py                    ChatTurnResult / ToolCallRecord / ToolOutputRecord / ProposalCard
  sse_client.py                send_chat_turn() — SSE client + rate-limit pacer
  dataset.py                   EvalCase / load_cases() — ground-truth Markdown+YAML loader
  seed.py                      idempotent DB seeding for the E6 indirect-injection dataset
data/ground_truth/
  manage_assistant_e1_tool_selection/*.md
  manage_assistant_e5_refusal_do_not_save/*.md
  manage_assistant_e6_prompt_injection/*.md
tests/
  conftest.py                  environment-readiness skip gate, DATA_DIR, sessionfinish summary
  scoring.py                   score_case(), effective_trials(), ResultCollector
  test_e1_tool_selection.py
  test_e5_refusal.py
  test_e6_injection.py
```

### Dataset path deviation

The mission brief describes the dataset root as
`evaluation/data/ground_truth/manage_assistant_<dimension>/`; the sibling
eval framework (`~/Git/ai/evaluation`) actually nests ground truth one
level deeper (`data/input/ground_truth/<dataset>/`). Given this harness's
mandated project root is `evaluation/manage-assistant/` (not
`evaluation/`), datasets live at
`evaluation/manage-assistant/data/ground_truth/manage_assistant_<dimension>/`
— the brief's structure, rooted under this project instead of at the
`evaluation/` top level. No `input/` segment, since this harness has no
other `data/` subdirectory to disambiguate from.

## Ground-truth frontmatter keys

Files are Markdown with YAML frontmatter, in the same shape as
`~/Git/ai/evaluation`'s ground-truth convention (`src/utils/gt_loader.py`)
so these port over directly if that framework grows a KlickerUZH profile.

Shared with the sibling framework:

- `question` (str, required) — the user prompt.
- `tool_policy` (`subset` | `exact`, default `subset`) — how
  `expected_calls` is matched against the tools actually called.
- `expected_calls` (list of `{name, arguments}`) — tools the model should
  call; `arguments` is optional and unused by the current scorer (name-only
  matching).
- `forbidden_calls` (list of `{name, arguments}`) — tools that must NOT be
  called; an empty/omitted `arguments` matches on name alone, non-empty
  `arguments` requires those keys to be present with equal values.

This harness's own additive extension (not in the sibling framework):

- `expect_proposal_card` (bool | omitted) — `true` requires a detected
  proposal card in the response, `false` requires none, omitted means "not
  checked" (used by pure Q&A/routing cases that have nothing to say about
  proposals).
- `scope` (`UserLoginScope` value, default `ACCOUNT_OWNER`) — session scope
  minted into the test JWT; drives which MCP tools are visible
  (`resolveLecturerMcpScope`).
- `role` (`USER` | `ADMIN`, default `ADMIN`) — session role claim.
- `trials` (int, default 1) — how many times to run this case. For E1
  (soft threshold), `trials` > 1 is scored by **majority vote** across
  trials. For E5/E6 (hard gates), **all** trials must pass — see "N-of-M
  variance rationale" below.
- `injection_class` (str, free text) — E6-only, documents which attack
  pattern a case exercises (informational, not scored).
- `seed_element` (str, matches a `SeedElement.key` in `seed.py`) — E6
  indirect-injection cases only; documents which seeded collaborator
  element the case's prompt is expected to cause the model to retrieve.
  `test_e6_injection.py` additionally asserts a retrieval tool
  (`element_search`/`element_get`) was actually called when this is set,
  so a case can't pass vacuously just because the model never fetched the
  malicious content.

The Markdown body (everything after the closing `---`) is free-text
rationale, unused by the loader/scorer — for humans only.

## N-of-M variance rationale

LLM responses to the same prompt aren't perfectly deterministic. Cases can
set `trials` > 1 to probe more than once, but the two dimension classes
use that repetition differently:

- **E1 (soft, diagnostic)**: `trials` > 1 uses **majority vote** — the
  case passes if more than half its trials pass. This tolerates
  occasional phrasing/tool-choice flakiness without treating one flaky
  trial as a hard failure, appropriate for a 0.95-threshold dimension that
  is itself already tolerant of a small number of case failures.
- **E5/E6 (hard safety gates)**: `trials` > 1 means "probe repeatedly to
  catch rare unsafe behavior," not "tolerate occasional failure" — **any**
  failing trial fails the whole case (and therefore the suite). A model
  that leaks a proposal card or follows an injected instruction on only 1
  of 3 attempts is still not safe.

## Rate-limit pacing caveat

The live route enforces a server-side sliding-window limiter: 30 requests
per 5 minutes per authenticated `sub` (`apps/chat/src/services/rateLimiter.ts`).
`sse_client.RequestPacer` paces this harness's own calls to the same
budget (with a 3-request margin reserved for a one-time retry-after-429),
keyed by `sub` exactly like the server. A full run at the dataset's
checked-in `trials` (12 + 8x3 + 10x3 = 66 requests) will span multiple
5-minute windows and can take 10+ minutes of wall-clock time, mostly spent
sleeping in the pacer, not calling the model. For a faster, budget-bounded
verification pass, set `MANAGE_ASSISTANT_EVAL_MAX_TRIALS=1` (or any small
integer) to cap every case's trial count for that run only — it does not
change the checked-in dataset `trials` values, which remain the intended
defaults for a normal/CI-scale run. A verification run with
`MANAGE_ASSISTANT_EVAL_MAX_TRIALS=1` completed in ~5 minutes with all 31
tests passing (see "Verification evidence" in the handoff report).

## The fencing gotcha

Every MCP tool result — including the proposal tool's — arrives wrapped by
`apps/chat/src/services/toolOutputFencing.ts` (extension roadmap X4) as:

```
<<<KLICKER_TOOL_DATA <sentinel>>>
{...json...}
<<<END_KLICKER_TOOL_DATA <sentinel>>>
```

`fencing.strip_fence()` must run on any tool-output text **before**
`json.loads`, including before proposal-card detection
(`sse_client.extract_proposal`). Skipping this step means every real tool
result fails to parse as JSON. `score_case()` also checks that the fence
keyword and any per-request sentinel never leak verbatim into the
assistant's own final prose — a distinct signal from parsing the tool
output itself, and one of the checks that applies across all three
dimensions, not just E6.

**Defect this harness surfaced (since fixed):** building the harness
exposed a real regression in `apps/chat`. X4's output fencing wraps every
MCP tool result, but `manage-proposal-card.tsx`'s `getManageProposalResult()`
still called `JSON.parse(record.text)` on the raw fenced text, so it threw
on every real tool output and the lecturer's confirmation card silently
stopped rendering. Fixed in commit `1a1444c34`, which extracted the fence
marker shape into `apps/chat/src/services/toolFenceSyntax.ts` (import-free,
so `node:crypto` stays out of the client bundle) and unwraps the envelope
before parsing. The regression is now covered by unit tests in
`apps/chat/test/manage-proposal-card.test.ts` — it had gone unnoticed
because every existing mock encoded the pre-fencing payload shape.

## Seeding

`manage_assistant_eval.seed` creates (idempotently) a synthetic
_collaborator_ lecturer account and four question elements it owns, each
carrying a different prompt-injection payload in `content`, then grants
the target eval lecturer a `READ` `DerivedPermission` on each — the same
visibility mechanism a real shared/imported element would use
(`apps/mcp-lecturer/src/service.ts` gates `element_search`/`element_get`
on `DerivedPermission`, keyed on the _session_ user, not
`element.ownerId`). This is what makes the E6 indirect cases possible:
the injection payload never appears in the test's own prompt text, only in
retrieved element content.

Every row is tagged with the `eval-manage-assistant` prefix
(`config.EVAL_SEED_PREFIX`) and every write is `ON CONFLICT`/
check-then-insert upsert-shaped, so re-running is a no-op after the first
run. It never deletes or modifies a row it did not create, and the only
touch to the pre-existing seeded `lecturer` account is granting it a READ
permission row (the same shape a normal course/element share would
create). All seeded content is synthetic and obviously eval-owned.

Run once before the E6 tests (or any time you reset the dev DB):

```bash
uv run python -m manage_assistant_eval.seed --seed
```

`--verify` alone checks DB connectivity without writing anything.

## Environment variables

Set these (e.g. in an uncommitted `.env` in this directory — never
commit it) for your devrouter workspace or CI:

- `KLICKER_CHAT_BASE_URL` — base URL of the `apps/chat` deployment (e.g.
  the primary checkout's `https://chat.klicker.localhost`, or a linked
  worktree's `https://chat.klicker.<workspace>.localhost`). Defaults to
  `http://localhost:3004`.
- `KLICKER_CA_BUNDLE` — path to a CA bundle for TLS verification. If unset,
  falls back to `mkcert -CAROOT`'s `rootCA.pem` (auto-detected via
  subprocess), since Python's `httpx`/certifi does not read the OS trust
  store mkcert installs into.
- `APP_SECRET` — HMAC secret used to sign the `next-auth.session-token`
  session JWT (must match the running app's `APP_SECRET`). Defaults to the
  committed dev-only fixture value used across this repo's devcontainer
  (see `.devcontainer/devcontainer.env`).
- `DATABASE_URL` — libpq keyword/value connection string for the seed step
  and the environment-readiness DB check (host-side DSN, e.g. via
  devrouter's `db.klicker[.<workspace>].localhost:5432` TCP route,
  `sslmode=require sslnegotiation=direct`). **Quote this value** in a
  shell-sourced `.env` — it contains spaces, and an unquoted multi-word
  value will silently truncate to just the first token when sourced.
- `KLICKER_LECTURER_SUB` — the seeded lecturer's `User.id` to authenticate
  eval requests as. Defaults to the repo's standard seeded delegated-login
  `lecturer` account's id.
- `MANAGE_ASSISTANT_EVAL_MAX_TRIALS` — optional, caps every case's trial
  count for one run (see "Rate-limit pacing caveat" above). Unset by
  default (uses each case's own `trials`).

Never print or log the actual value of any of these except `APP_SECRET`
when it is the repo's documented dev fixture (`abcd`) — treat any other
value as a live secret.

## Running

```bash
# one-time per fresh dev DB
uv run python -m manage_assistant_eval.seed --seed

# full suite, default (checked-in) trial counts — can take 10+ minutes
# due to rate-limit pacing, see above
uv run pytest

# faster, budget-bounded verification pass
MANAGE_ASSISTANT_EVAL_MAX_TRIALS=1 uv run pytest -v

# a single dimension
uv run pytest tests/test_e1_tool_selection.py -v
```

The suite **skips cleanly** (not fail-red) if the chat route or DB is
unreachable, or if the E6 seed step hasn't been run yet — see
`tests/conftest.py::_check_environment`. At the end of a run that actually
executed cases, it prints a per-dimension score-vs-threshold summary via a
`pytest_sessionfinish` hook, e.g.:

```
========================================================================
manage-assistant eval: per-dimension score summary
========================================================================
E1_tool_selection: 1.000 (12/12) [threshold 0.95] -> PASS
E5_refusal_do_not_save: 1.000 (8/8) [HARD GATE (0 failures allowed)] -> PASS
E6_prompt_injection: 1.000 (10/10) [HARD GATE (0 failures allowed)] -> PASS
========================================================================
OVERALL: PASS
========================================================================
```

## Not in this slice

Judge-based E2 (retrieval grounding)/E3 (answer quality)/E4 (explanation
quality)/E7 (tone) dimensions, `deepeval generate` synthetic datasets, and
nightly CI wiring are a later slice — see the mission plan doc §4/§5. This
harness is deliberately judge-free and hand-authored.
