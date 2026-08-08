# Vorkurs chatbot finalization

## Goal

Make the Vorkurs chatbot usable on mobile in staging and establish evidence for
production readiness. The immediate scope is the first-request stream failure,
Android keyboard/layout behavior, mobile touch targets, and recovery messaging.

## Non-goals

- No production rollout, merge, ArgoCD sync, or automatic deployment.
- No change to the Vorkurs prompt, disclaimer wording, credits policy, or
  retrieval mode unless verification shows that one is the cause of the current
  failures.
- No Langfuse dependency for the readiness decision; chat persistence and
  server-side diagnostics remain the primary evidence.

## Plan identity

- Branch: `rs/vorkurs-chatbot-finalization`
- Target: `v3`
- Worktree: `trees/vorkurs-chatbot-finalization`
- Related history: the existing Student Chat v3 production-readiness plans and
  the course chatbot entry-link plan under `project/`.

## Research and evidence

- Staging pod logs at the reported times show Next's `failed to pipe response`
  with `TypeError: Cannot read properties of undefined (reading 'hasFinished')`.
- The error follows Vorkurs MCP discovery by about five seconds and is not the
  earlier LiteLLM authentication error.
- Staging repeatedly warns that `CHAT_PRIMARY_MODEL_ID="gpt-5.5"` is not in
  the deployed registry and falls back to `auto`.
- The chat route returns an AI SDK UI message stream without an explicit
  `consumeSseStream: consumeStream` handler.
- The standalone layout uses `h-dvh` and an absolutely positioned composer;
  screenshots show Android moving the conversation viewport when the keyboard
  opens.
- Mobile icon controls use 24px, 36px, or 40px targets in places where students
  need reliable touch controls.
- Sol (native planning-stage pass) reviewed the screenshots and repository
  evidence and returned `DONE_WITH_CONCERNS`, with production `NO-GO` until the
  stream, keyboard, touch, and real-upstream checks pass.

## Decisions

- First hypothesis: make the AI SDK stream lifecycle explicit and verify it in
  staging before changing ingress timeouts or provider settings.
- Use `interactiveWidget: 'resizes-content'` so Android keyboard resizing is
  reflected in the layout viewport while the thread viewport remains the sole
  conversation scroller.
- Use at least 44px mobile hit areas for primary controls; keep desktop controls
  compact where that does not reduce accessibility.
- Keep user-facing errors generic, but offer a clear retry action through the
  existing reload path, which truncates the failed assistant branch before
  retrying and therefore avoids duplicate visible turns.
- Clean the staging automatic-model setting to the valid registry id `auto` in
  the deployment values; do not change production values in this branch.

## Slices

### 1. Stream lifecycle and mobile viewport

- Files: chat route, chat root layout, focused chat-platform documentation.
- Check: package typecheck; chat tests; route/build validation where available;
  staging smoke after an explicitly approved staging rollout.
- Commit: `fix(chat): stabilize mobile stream responses`

### 2. Touch targets and retry recovery

- Files: thread composer, sidebar/header controls, action-bar styles, error
  presentation, English/German messages, focused tests.
- Check: package typecheck and tests; browser screenshots at narrow and desktop
  viewports; verify retry does not append duplicate user messages.
- Commit: `enhance(chat): improve mobile controls and recovery`

### 3. Staging evidence and go/no-go

- Run a real-upstream first-turn smoke test, a retry test, and a mobile keyboard
  matrix against the rolled staging image.
- Capture immutable image digests, request/response timings, stream completion,
  tool completion, persisted message state, and pod errors.
- Add or update the chat-platform wiki with the verified failure mode and
  verification commands.
- Production remains `NO-GO` until the real-upstream and mobile checks are green.

## Progress

- Step 1: classified the staging stream-pipe failure; complete.
- Step 2: clean implementation worktree created from the local `origin/v3`
  ref; in progress.
- Step 3: pending implementation and verification.
- Step 4: pending staging rollout approval and real-upstream evidence.

## Review and finish gates

- Planning-stage review: Sol native subagent, completed before implementation.
- Main-session verification: inspect every diff and rerun repo-native checks.
- Final outcome: one separate read-only reviewer on the exact integrated commit
  range before presenting the package as complete.
- Publication, merge, and deployment require separate explicit authorization.
