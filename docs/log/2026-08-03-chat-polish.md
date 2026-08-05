## 2026-08-03

- **Update**: [chat-platform](../chat-platform.md) records the rule that a new
  reasoning-effort id must reach `KNOWN_REASONING_EFFORTS` and both message
  files in the same change, names `xhigh` and `none` as the two that shipped
  without a label, and warns that the local default model registry and the
  deployed ones only overlap partly.

## 2026-08-02

- **Update**: [chat-platform](../chat-platform.md) records the local LiteLLM
  complexity-router simulation for the deployed Auto option, GPT-5.6 Luna
  comparison model, local secret boundary, and explicit no-key verification
  limit. [testing](../testing.md) adds the health-versus-live-model-call gate.

## 2026-07-28

- **Update**: [chat-platform](../chat-platform.md) records the final PR #5197 review
  fixes: live announcement of disclaimer failures, a focusable explanation for unavailable
  image edits, localized mode tooltips with own-key mode detection, and the rule that bare
  numeric publisher labels stay page labels while URL time parameters may use bare seconds.

## 2026-07-27

- **Update**: [chat-platform](../chat-platform.md) records the design-alignment round: thread
  rows carry a mode icon + localized subtitle (`formatModeLabel` in `lib/config/modes.ts`),
  assistant blockquotes render as amber info callouts (assistant-only `markdown-text.tsx`
  override), and a new client-state gotcha — message edits must submit through
  `messageRuntime.composer.send({ startRun: true })`, because the public
  `threadRuntime.append()` collapses a `null` parentId and turns root-message edits into new
  turns instead of sibling branches, hiding the branch pager. Replies to image-bearing turns
  now carry a localized "Image analyzed" activity chip driven by a pure store-side helper.
