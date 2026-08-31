# Doc Query scoped retrieval activation source package

Date: 2026-08-31

Status: execution approved; source implementation active

## Goal and boundary

Prepare the Klicker source needed to move the approved production chatbots to
the existing multi-tenant Doc Query reader. The canonical source change targets
current `v3`; an equivalent maintenance backport targets
`maintenance/v3.4.0-alpha.73` for the production release carrier.

This plan implements and verifies source only. It does not authorize merging,
releasing, migrations, deployment, production configuration or binding writes,
secret access, cluster actions, live proof, cleanup, or deletion.

The cross-repository execution and data contract remains authoritative in
`deployment/project/2026-08-30-klicker-prd-doc-query-activation-plan.md`. This
file narrows that plan to the Klicker source package and does not redefine the
approved 15-corpus manifest.

## Approved architecture

- Reuse `ChatbotMCPConfig.parameters` to carry the external `kb_id` beside the
  existing required-tool policy. Do not add the `v3-ai` Knowledge Base schema or
  a Prisma migration.
- Keep the existing opaque transport bearer in `Authorization`. Mint the
  short-lived ES256 knowledge scope in `X-Doc-Query-Scope-Token`.
- Resolve and validate scope from the same enabled configuration snapshot used
  for MCP discovery. A scoped chatbot must have one consistent UUID across all
  enabled `KB` mode configurations.
- Fail as `REQUIRED_MCP_UNAVAILABLE` before provider or message work for missing,
  malformed, ambiguous, conflicting, or drifted scope configuration.
- Chatbots without a scoped `KB` configuration keep their current behavior.
- Preserve BF1, DF CF2, and Vorkurs2 on their existing routes.

## Work packages

### S1a - Scoped runtime and signer

Add the ES256 signer, strict scope resolver, dedicated scope header, route
integration, focused tests, and the Chat platform contract documentation.

Acceptance:

- valid claims contain only the reviewed issuer, audience, subject, token ID,
  `kb_id`, and `chatbot_id` contract;
- transport and scope credentials never replace or expose one another;
- malformed or conflicting reserved parameters fail closed;
- non-target MCP servers and ordinary chatbots remain unchanged;
- current `v3` uses the owned thread as the subject, while the maintenance
  backport uses the server request ID because it discovers tools earlier.

### S1b - Configuration-only activation operator

Port the reviewed configuration cutover contract into purpose-named scripts.
Bind the frozen external `kb_id` mapping into manifests and receipts. Keep
dry-run, per-chatbot atomic compare-and-swap, exact rollback, values-free output,
and exclusions.

Acceptance:

- no Knowledge Base tables or new schema are required;
- one chatbot switches all frozen modes atomically;
- prepared, switching, switched, rolling-back, and rolled-back receipts remain
  restart-safe and digest-bound;
- BF1, DF CF2, Vorkurs2, mapping conflicts, drift, and partial states are
  refused before unsafe writes.

### S1c - Sealed proof entry point

Prepare the production-sealed positive retrieval and cross-knowledge-base
isolation harness with values-free receipts. Reuse the reviewed marker logic
without turning it into an arbitrary-endpoint tool.

Acceptance:

- the helper cannot target an unapproved endpoint or corpus set;
- output contains identifiers and result categories only, never content or
  credentials;
- no-retry behavior and stop conditions are explicit.

## Verification and review

Each committed slice receives focused unit/type/format checks and the required
simplification and risk review. The integrated branch receives final review,
exact diff inspection, staged secret and personal-data checks, and exact-head
CI. Passing evidence is then repeated or interaction-checked for the maintenance
backport.

The delivery outcome is two ready-for-review PRs:

1. canonical current-`v3` qualification;
2. equivalent maintenance backport against `maintenance/v3.4.0-alpha.73`.

Neither PR may merge under this plan.

## Progress

- [x] Production carrier selected: deployed `v3.4.0-alpha.73.2` maintenance
  line, with the same patch qualified on current `v3`.
- [x] Current `v3` branch refreshed through `fed364a33`; the intervening Moodle
  embedding change does not overlap this package.
- [x] S1a scoped runtime and signer implemented at `dc942f9af`; focused
  verification passed (4 Vitest files, 31 tests, Chat TypeScript, Prettier,
  ESLint, staged secret scan, and diff check). The security/cross-system slice
  review passed. The simplifier removed three unused or redundant exports, and
  the same focused verification passed afterward.
- [x] S1b configuration-only activation operator implemented at `4f953f5f8`.
  Focused verification passed (23 Vitest tests, `check:scripts`, Prettier,
  staged secret scan, and diff check). The data-integrity and security review
  passed with no findings. The simplifier's two recovery reductions were
  declined because they would weaken exact outcome-unknown evidence for a
  production configuration transaction.
- [x] S1c sealed proof entry point implemented through `fb6a6166fe`.
  Focused verification passed (29 Vitest tests, ESLint, Chat TypeScript,
  Prettier, staged secret scan, and diff check). Review-confirmed corrections
  fail closed when a child claims writes and exercise the real SQLite duplicate
  guard. The shared test-support API remains compatible with active STG branches.
- [x] Integrated current-`v3` corrections completed at `cf06f1ac2`. The
  activation runner now serializes the full lifecycle and protects receipt
  transitions with fail-closed compare-and-swap checks. The sealed proof binds
  the exact cohort and activation receipt to a trusted manifest fingerprint.
  Focused verification passed (25 activation tests, 31 proof tests, both type
  checks, focused ESLint, Prettier, staged secret scans, and diff checks). The
  final security and data-integrity correction review passed, including shared
  STG test-support compatibility.
- [ ] Canonical and maintenance PRs published with terminal exact-head CI.
