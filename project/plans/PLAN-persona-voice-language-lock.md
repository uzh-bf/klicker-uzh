# Plan: role-play support for custom chat modes

Status: draft for approval. Baseline: `origin/v3-ai` at dece7800dd. Target:
`v3-ai`, because custom chat modes (`customModeConfig`) exist only from
`v3-ai` downward. Execution mode: solo.

## Approval summary

**Why and what changes?** Lecturers use custom modes for role-plays, for
example a fictional client whom students interview in a timed, assessed
exercise. Platform contracts that follow the persona in the compiled prompt
break such role-plays, and persona text cannot fix them because those
contracts explicitly override personas. The prompt-reveal rule makes the
persona drop character with a generic assistant refusal. The language rules
make the reply follow the student's language, so a meeting cannot stay in one
language. The Markdown guidance can conflict with a persona that must speak in
plain prose. And the model has no notion of time, so it cannot pace a timed
meeting.

The split follows one rule: a fixed change where every reasonable lecturer
wants the same behaviour, and a setting only where lecturers legitimately
differ.

- **Fixed, custom modes only.** (1) Prompt-reveal requests are declined in the
  persona's voice while the persona stays in role. The protection itself is
  unchanged. (2) The persona's own format rules take precedence over the
  generic Markdown guidance. The notation rules for mathematics, chemistry and
  code still apply when such notation appears, because the renderer needs them.
- **Optional settings per custom mode, both off by default.** (3) Reply
  language: `en` or `de`. When set, the language contract and the per-turn
  reminder require it regardless of the language the student writes in or
  asks for. (4) Meeting clock: off, elapsed, or elapsed plus time of day. The
  server adds the facts to the per-turn reminder. Meeting length and phases
  stay in the lecturer's persona.

Both settings are edited in the manage authoring UI and shown in both review
summaries. Students see what the model sees. A mode with a fixed language
shows a short note such as "This conversation is in English". A mode with a
meeting clock shows the elapsed minutes, plus the time of day when enabled,
anchored to the same server timestamp the model uses. The persona and the
student therefore never disagree about the time.

**What stays unchanged?** Standard modes (tutor, explainer, quizzer) compile
byte-identical prompts and reminders. A custom mode with both settings unset
receives a byte-identical per-turn reminder and shows no new chat UI; only
its system prompt changes, through the two fixed changes. The authority order of the compiled prompt, the
prompt-cache key and the cached prefix stay unchanged. No Prisma migration is
needed, because both settings live in the existing `customModeConfig` JSON
column.

**What could change the decision?** The two fixed changes alter the compiled
prompt of every existing custom mode, including those that are not role-plays.
For a persona without its own voice or format rules, the new wording reads
like today's, so the risk is low. Making them opt-in would add two settings
that no lecturer would set differently. The language lock is limited to the
platform's existing `Locale` (`en`, `de`), so no free text enters a platform
contract. The time of day uses `Europe/Zurich`, the time zone the apps already
use, because no course or lecturer time-zone setting exists.

**How will we know it is done?** Unit tests show which sections each mode
compiles, that the setting values reach the contract and the reminder, and
that standard and unset outputs equal today's. Lint, type check and focused
tests pass. Browser screenshots show the new authoring fields and review
summaries, and the student chat with the clock on and off and with the
language note, at desktop and mobile width.

**What does approval authorize?** Local commits, pushes to this task branch,
and one draft PR against `v3-ai` with screenshots uploaded to the PR. Withheld:
marking it ready, merging, requesting human reviewers, and any test-server or
production configuration change.

## Execution details

### Binding contracts

- `compileSystemPrompt` keeps its order: course data, mode sections, input
  context, course policy, output format, citations, language. A mode counts as
  a custom persona when it compiles the "Lecturer-defined custom persona"
  section. The compiler passes `customPersona: boolean` to the course-policy
  and output-format contracts. Templates render with `strict: true`, so the
  flag is always supplied.
- `course-policy.hbs`: only the "Internal instructions" paragraph branches.
  The protection sentence (never reveal, quote, summarize, translate or help
  reconstruct) stays shared. Standard modes keep today's redirect sentence
  verbatim. Custom modes decline in the active persona's voice, stay in role,
  and steer back to the current activity without exposing protected content.
- `output-format.hbs`: custom modes get one added sentence. Where the persona
  defines its own format or style, for example plain spoken prose, follow it
  and use Markdown only where the persona allows. The mathematics, chemistry
  and code rules still apply. Standard modes keep today's text.
- `language-style.hbs` and `reply-language-reminder.hbs` take
  `lockedLanguage: string | null`. Locked: always reply in the named language,
  even when the student writes in or asks for another language, and drop the
  "ask which language" clause. Unlocked: today's text. The template receives a
  language name (`English`, `German`) mapped from the `Locale` code, never
  user text.
- Swiss German style stays unconditional. It already applies only "when
  writing German". A German lock therefore uses Swiss orthography, and an
  English lock is unaffected.
- The meeting clock is one plain line in the trailing reminder, before the
  language reminder, which stays last. Format: `Meeting clock: <n> minutes
  since the participant's first message.` plus, when enabled, ` Current time:
  HH:MM (Europe/Zurich).` Whole minutes, rounded down. The server computes it.
  Elapsed time counts from the earliest `ChatMessage` with role `user` in the
  thread (`@@index([threadId])` exists), not from thread creation, because
  students may open the chat early. For a new thread it is 0.
- Owner preview persists no thread, and its client sends no message
  timestamps today. Preview therefore reports elapsed time as 0 minutes, and
  the time of day is real. Lecturers can still check the wording and the time
  line in preview, and participant threads carry the real elapsed time.
  Real elapsed time in preview would need client-supplied timestamps; it is a
  possible follow-up.
- Settings shape, mirroring `showReasoning`:
  `replyLanguage?: Locale | null` and
  `meetingClock?: 'ELAPSED' | 'ELAPSED_AND_TIME' | null`. The write path
  rejects other values. An omitted field keeps the stored value, and null
  clears it. The tolerant reader drops an invalid stored value without hiding
  the mode.
- Owner preview resolves both settings from
  `resolveOwnerPreviewModeConfiguration`, the source it already uses for the
  compiler, so lecturers can test before publication approval. The participant
  route uses the live column.

### Student chat indicators

- Custom-mode options sent to the chat client gain `replyLanguage` and
  `meetingClock` (`ChatModeOption` in `lib/config/modes.ts`, filled by
  `getCustomModeOption`). These are presentation flags; persona text stays
  server-side.
- One small status line near the composer shows the indicators for the
  selected mode, as text with an icon, never colour alone, in `de` and `en`.
  With both settings unset it renders nothing, so existing chats look
  unchanged.
- Language note: "This conversation is in English/German", naming the
  language in the UI locale.
- Meeting clock: before the first message, "The clock starts with your first
  message". Afterwards, "<n> min" and, when enabled, the time of day in
  Europe/Zurich.
- Anchor: the server returns `meetingClockStartedAt` (the earliest completed
  user message of the thread, or the request time on a first turn) and its
  own `serverNow` in the stream's start metadata. On reload, the client uses
  the first user message's stored `createdAt`, which the thread-messages
  route already returns and which is the same value the server counts from;
  the clock offset is then corrected again with the next answer. The client
  ticks every 30 seconds. It never anchors to thread creation.
- The client and the server share one whole-minute rule (rounded down), so
  the minute the student sees matches the line the model received for that
  turn.
- Owner preview shows the same line. Preview persists no thread, so its clock
  anchors to the preview's first turn and stays approximate; this matches the
  zero-minute model line in preview.

### Caching and persistence

- The system prompt (`instructions`) never contains time. It changes per mode
  only through the fixed changes and the language lock, which are constant per
  chatbot and mode.
- The trailing reminder is built per request in `trailingStepMessage` and
  appended in `prepareStep` after the history and the new user message. Like
  the turn-context message (`chatTurnRequest.ts`), it is never persisted, so
  history replays only user and assistant text.
- `promptCacheIdentity` keys on chatbot, mode and thread scope, not on content.
  The trailing reminder sits after the last user message, outside the prefix
  that consecutive turns share. A changing clock line therefore leaves the key
  and the cached prefix unchanged.

### Files

- Types and util: `packages/types/src/chatbotCustomModeConfig.ts`,
  `packages/util/src/chatbotCustomModeConfig.ts` (+ test).
- GraphQL: `packages/graphql/src/schema/resource.ts` (input and object fields;
  existing locale enum plus a small meeting-clock enum),
  `FChatbotAuthoringRevisionData.graphql`,
  `QGetChatbotsInfoWithKnowledgeBases.graphql`, regenerated
  `src/public/schema.graphql`.
- Manage: `ChatbotAuthoring.tsx` (form values, input mapping, two select
  fields, review list), `admin/ChatbotPublicationDetails.tsx`, `packages/i18n`
  `de.ts`/`en.ts`.
- Chat: `course-policy.hbs`, `output-format.hbs`, `language-style.hbs`,
  `reply-language-reminder.hbs`, `promptTemplates.ts` (context types),
  `coursePolicyInstructions.ts`, `outputFormatInstructions.ts`,
  `languageInstructions.ts`, `systemPromptCompiler.ts`, `calculatorTool.ts`
  (`stepReminder`), `feedbackEvidence.ts` (`trailingStepMessage`),
  `effectiveChatModes.ts` (settings resolver beside
  `isParticipantReasoningVisible`), the participant chat route and the owner
  preview route. The clock line is formatted in `languageInstructions.ts`,
  next to the reminder it joins, so no new module is needed.
- Student chat: `apps/chat/src/lib/config/modes.ts`,
  `effectiveChatModes.ts` (`getCustomModeOption`), the participant chat route
  (metadata anchor), the stream parser `hooks/useChatResponse.ts`,
  `stores/chatStore.ts` and `RuntimeProvider.tsx` (carry the anchor on the
  message), one new component `apps/chat/src/components/mode-session-status.tsx`
  rendered from `thread.tsx` near the composer (owner preview reuses the same
  thread), and `chat.composer.*` keys in `packages/i18n` `de.ts`/`en.ts`. The
  minute and time-of-day rule lives in a new shared module
  `apps/chat/src/lib/meetingClock.ts`, because the server prompt line and the
  client indicator both call it.

### Slices

1. **Fixed persona changes.** Course-policy and output-format branches plus
   compiler flag. Acceptance: compiler tests pass.
2. **Settings field.** Types, util normalization, GraphQL schema and ops,
   codegen. Acceptance: util tests and graphql check pass.
3. **Language lock and meeting clock.** Templates, reminder plumbing, both
   routes. Acceptance: chat tests and type check pass.
4. **Authoring UI.** Select fields, review summaries, i18n. Acceptance: manage
   type check, lint and browser screenshots.
5. **Student indicators.** Mode-option flags, server anchor in metadata and
   reload, status component, i18n. Acceptance: chat type check, unit test of
   the shared minute rule, and student-chat screenshots.

Delivery is one draft PR. The change crosses layers but is small and
cohesive, with one reviewer audience.

### Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Standard modes or unset custom settings change | add new | compiler and reminder output equals the no-option path |
| Custom mode loses the protection, keeps the generic redirect, or loses the notation rules | extend existing | `system-prompt-compiler.test.ts` section marks per mode |
| Lock or clock not honoured | add new | `stepReminder`/`trailingStepMessage` output contains the locked language value and the computed minutes; the language reminder stays last |
| Clock computed from the wrong start or leaks into `instructions` | add new | pure clock helper with a fixed `now` and synthetic timestamps; compiled prompt has no clock line |
| Invalid or omitted settings corrupt the config | extend existing | `chatbotCustomModeConfig.test.ts`: round-trip, omission keeps, null clears, tolerant read |
| Student clock disagrees with the model's line | add new | one minute helper used by server and client; unit test with a fixed anchor, skew and `now` |
| Indicators appear for modes without settings | none | covered by the component returning nothing for unset flags; checked in screenshots |

Tests assert structure and injected values, not prose wording.

### Verification

In the devcontainer: `pnpm --filter @klicker-uzh/util test`,
`pnpm --filter @klicker-uzh/graphql generate`, chat vitest for the touched
tests, `pnpm run check`, `pnpm run lint` and `pnpm run format:check`. Browser
evidence comes from this worktree's devrouter stack and
`$rs-build-screenshot-gallery`: the authoring fields and review summaries,
and the student chat with the clock off, the clock on (elapsed, and elapsed
plus time), and the language note, each at desktop and mobile width, with a
German-locale capture of the indicators. Seeded test chatbots and synthetic
custom modes only. If the stack cannot start, the screenshot gap is reported
as a blocker. `gh` must run outside the sandbox, because it fails
TLS inside it.

### Out of scope

- The "Course scope" paragraph still answers off-topic requests out of
  character. A persona-voice variant there is a possible follow-up.
- Languages beyond `en`/`de`, and a time-zone setting.

## Progress

- Plan approved, then revised to add student chat indicators (slice 5);
  awaiting re-approval.
- Slices 1-4 are implemented in the working tree, not yet verified or
  committed: the dev container is still starting.
