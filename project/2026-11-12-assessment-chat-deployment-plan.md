# Assessment chat: a separate chat deployment for exams

## Approval summary

Exams get their own chat deployment, separate from the regular chat, in the way the student PWA has a separate assessment deployment. Exam students sign in through the assessment login (Edu-ID, `next-auth.participant-session-token`), open the chatbot full-page on the assessment chat host, and never use the embedded chat. The assessment chat runs its own pods on the reserved assessment nodes. The model gateway, database and Redis stay shared. Audit logging of chat activity is a later package.

Approval mode: executable batch. Terminal condition: a two-layer draft stack into `v3-ai` with local browser evidence of the assessment login reaching the assessment chat, or a named blocker. Infrastructure and deployment steps at the end remain separately gated.

### Decisions to approve

| Decision | Recommendation | Alternative |
| --- | --- | --- |
| Host name | `assessment-chat.klicker.uzh.ch` (staging `assessment-chat.klicker.stg.df-app.ch`), matching `assessment-api` and `assessment-response-api` | `chat-assessment.…` |
| Image | The existing `chat-arm` image with runtime configuration. The public URLs become server-read settings passed to the few client components that use them | A separate `chat-assessment-arm` image like the PWA. That needs a change to the trusted staging promoter on `v3`, a new production workflow and release wiring |
| Secret | Reuse `secret-chat` | A new `secret-chat-assessment` (separate gateway key or budget), which adds an external provisioning step |
| Which chatbots the assessment chat serves | Only chatbots of courses with `isAssessmentEnabled`; everything else returns 404 there | — |
| Exam chatbots on the regular chat | Accepted risk for 16 December: a student with a regular login can still open an exam course chatbot on `chat.klicker.uzh.ch`. Unpublishing after the exam ends access on both | Block exam courses on the regular chat in this batch |
| Model | Keep the shared, policy-valid registry (it must contain `auto` and the `gpt-6-luna` base fallback). Fix the exam chatbot to `gpt-5.6-sol` through its per-chatbot `allowedModelIds` and efforts. Students need ADVANCED credit for Sol; the exam chatbot's budget is set before the exam | A Sol-only registry, which needs a change to the shared registry policy in `packages/util` and the backend |

## Execution details

### Authority

- User instruction (2026-11-12): build a separate assessment-only chat with dedicated resources, using the assessment login, with audit logging later; follow the PWA pattern and prepare it.
- Granted on approval: local implementation, local devcontainer runtime with synthetic data, local commits, pushes to the task branches, two draft PRs into `v3-ai`.
- Withheld: merging, marking ready, DNS records, TLS certificates, secrets, release tagging, deployment to staging or production, node pool changes, live chatbot configuration, paid model calls.

### Current state (`origin/v3-ai`)

- The assessment PWA uses the regular PWA Dockerfile with `.env.assessment.prd` swapped in, image `frontend-assessment-arm`. The backend uses the regular image plus `ASSESSMENT_MODE=true` in `cm-backend-assessment.yaml`. Assessment workloads pin to nodes labelled `klickerasm=reserved` with a matching toleration.
- The assessment session cookie is an HS256 JWT signed with `APP_SECRET`, issuer `APP_ORIGIN_AUTH`, role `PARTICIPANT`, domain `.klicker.uzh.ch`, `SameSite=Lax` (`apps/auth/src/pages/api/auth/[...nextauth].ts:166-168,241-251`, `apps/auth/src/lib/jwt.ts:37-44`). It reaches a sibling host on top-level navigation.
- The chat reads `participant_token` with issuer `APP_ORIGIN_API`: API routes through `extractChatTransportTokens` and `getParticipantIdFromToken` (`apps/chat/src/lib/server/apiGuards.ts:68-82,252`), the chatbot layout directly (`apps/chat/src/app/[chatbotId]/layout.tsx:59-74`), and the proxy by signature only (`apps/chat/src/proxy.ts:269-283`). Guest, embed and scoped fallbacks precede it (`apiGuards.ts:112-171`, `proxy.ts:210-264`).
- The chat bakes `NEXT_PUBLIC_PWA_URL` (no-login page, chatbot layout, `not-found`, `error`, `assistant.tsx`) and `NEXT_PUBLIC_CHAT_URL` (no-login page).
- `apps/frontend-pwa/.env.assessment.prd:25` uses an undefined `APP_ORIGIN_CHAT`, so the assessment chatbot page redirects to `/error`; `.env.assessment.stg` has no chat URL.
- The registry policy requires exactly one `auto` entry and `gpt-6-luna` as BASE (`packages/util/src/chatModelRegistry.ts`). High effort for `gpt-5.6-sol` is merged on `v3` (#6874) and reaches `v3-ai` through the sync.

### Test portfolio

| Risk or behavior | Obligation | Seam |
| --- | --- | --- |
| Assessment mode accepts only the assessment session (name, issuer, role, expiry) and refuses regular, guest, embed and scoped tokens | add new | shared token resolver unit test; proxy test |
| Assessment mode refuses `/auth/lti`, `/auth/elearning`, `/auth/pwa-embed` and the lecturer surfaces | add new | route/proxy test |
| Regular mode is unchanged | extend existing | existing `apiGuards` and proxy tests |
| Assessment chat serves only `isAssessmentEnabled` courses | add new | `getChatbotOr404` unit test |
| Chart renders the new workload on reserved nodes with the overlay config | extend existing | `helm template`, topology-spread and replica-ownership checks |

### Slices

**Layer 1 (PR 1) — Assessment mode in the chat app.**

- Slice 1. One server-only runtime flag, `CHAT_ASSESSMENT_MODE=true`. A single mode-aware resolver supplies the account cookie name and issuer to the API guard, the chatbot layout and the proxy. In assessment mode it reads `next-auth.participant-session-token` with issuer `APP_ORIGIN_AUTH` and skips the guest, embed and scoped branches. `getChatbotOr404` additionally requires `course.isAssessmentEnabled`. `/auth/lti`, `/auth/elearning`, `/auth/pwa-embed`, `/manage`, `/preview` and `/api/manage/*` return 404 in assessment mode (handler guard where the proxy matcher excludes the path). Add the flag to `turbo.json` `globalEnv`. Grep gate: no participant path calls the regular API with the participant token; if one does, disable that tool for exam chatbots and report.
- Slice 2. Replace the baked public URLs with server-read settings (`CHAT_PUBLIC_PWA_URL`, `CHAT_PUBLIC_URL`, defaulting to the current `NEXT_PUBLIC_*` values) passed as props to the client components. In assessment mode the no-login page links to the assessment PWA, which already handles login and re-entry through the course chatbot page. No `apps/auth` change.

**Layer 2 (PR 2, stacked on PR 1) — Deployment and entry.**

- Slice 3. Chart: a `chatAssessment` values block plus Deployment, Service, Ingress and PodDisruptionBudget following `deployment-chat.yaml` and `deployment-assessment.yaml`. `envFrom`: `config-global`, `config-chat`, then a small `config-chat-assessment` overlay (`CHAT_ASSESSMENT_MODE`, public URLs); checksum both ConfigMaps. Reuse `secret-chat`, the probes, grace period, course-image env and optional GrowthBook secret. Pin to `klickerasm=reserved`. Production 3 replicas, staging 1. Same `chat-arm` image and tag as the regular chat. Update `deploy/scripts/verify-topology-spread.mjs`, `util/check-klicker-replica-ownership.mjs`, `apps/chat/test/modelRegistryParity.test.ts` if affected, and `docs/ci-and-deployment.md`. Add `appOrigins.assessmentChat` to `cm-global.yaml` and both values files.
- Slice 4. Entry: set a literal `APP_ORIGIN_ASSESSMENT_CHAT` in `apps/frontend-pwa/.env.assessment.prd` and `.env.assessment.stg`, and point the assessment chatbot page at it. Hide the embedded course chat drawer in the assessment build. This replaces the `APP_ORIGIN_CHAT` line in #6878, which is trimmed to the export.
- Slice 5. Local route and browser proof: add `assessment` and `assessment-chat` routes to `.devrouter.yml` if absent, sharing the local cookie domain. With synthetic data: the assessment login opens an assessment-course chatbot full-page on the assessment chat, sends one turn against a local mock model, reloads; a non-assessment chatbot returns 404 there; a regular login and an embed token are refused there; the regular chat still works. Use an untouched participant who completes the data-use step through the assessment PWA, and a chatbot with a disclaimer, so no gate is bypassed by hand. Screenshots in PR 2.

### Topology

A two-layer stack into `v3-ai` under the repository's stacked-PR rule: PR 1 is the app seam with its tests, PR 2 the chart, staging values, PWA entry and local route. Neither touches the staging promoter.

Delivery paths differ by environment. Staging builds from `v3-adaptive-learning`, which receives `v3-ai` through the maintained sync. Production Argo (`app-klicker`) deploys the chart and `deploy/env-uzh-prd/values.yaml` from `v3`, with image tags cut from `v3-ai` releases. The production chart and values therefore need a separate PR into `v3` after the staging rehearsal (gated, listed below). The production values pin a `chat-arm` tag that contains the assessment mode; an older tag would serve a regular chat on the exam host.

### Recovery

- If the assessment session cannot be verified in the chat without an `apps/auth` change, stop Slice 1 and report: an auth-app change needs its own approval.
- If `isActiveAccountParticipant` rejects Edu-ID exam participants, record the exact rule and stop for a decision.
- If the reserved node pool lacks room for 3 more pods, keep the values and report the capacity for the deployment decision.
- A review finding that changes the auth surface stops that slice for a decision.

### Separately gated after the stack (not in this batch)

1. DNS and TLS for `assessment-chat.klicker.uzh.ch` and the staging host. Longest lead time; request it early.
2. Merge, sync to the staging source, staging rollout and a load rehearsal; then a release tag containing the assessment mode, a PR into `v3` with the chart and production values pinned to that tag, and the production rollout. After rollout, check on the exam host that a regular `participant_token` is refused and an assessment session is accepted.
3. Model qualification on GPT-5.6 Sol: one high-effort request through the production gateway, confirmation that the gateway route uses the dedicated deployment, the exam prompts re-checked on GPT-5.6 Sol (they were evaluated on GPT-6.1 Sol), time to first visible text with hidden reasoning, and an ADVANCED credit budget for about 100 students × 40 turns.
4. Exam chatbot configuration: fixed to `gpt-5.6-sol` at the chosen effort, exam mode settings, budget.
5. Audit logging of assessment chat activity (separate package, builds on the `v3-audit` audit facility).

## Progress

- 2026-11-12: plan drafted from the assessment PWA inventory. Independent critique returned CHANGES (12 items). Accepted and folded in: policy-valid registry with per-chatbot restriction, one image with runtime URLs, a shared token resolver that also closes the guest, embed, LTI, e-learning and lecturer entry points, no `apps/auth` change, an overlay ConfigMap reusing `secret-chat`, a literal assessment chat origin in both PWA env files, the regular-chat exposure recorded as a decision, registry parity and chart check updates, a two-layer stack, and early DNS/TLS. Next: user approval.
- 2026-11-12: Layer 1 committed (`dc12b95c80`, `8416539b29`); 1,953 chat tests pass. Advisor review added: production deploys from `v3` (separate gated PR with a pinned tag and a post-rollout refusal check), an untouched participant and a disclaimer in Slice 5, and GPT-5.6 Sol qualification as a gated pre-exam step. Independent auth review of Layer 1 is running; push waits for it.
