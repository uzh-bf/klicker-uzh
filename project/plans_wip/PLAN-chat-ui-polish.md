# Chat UI polish

## Goal

Make streamed conversations easier to follow on desktop and mobile: use an
unambiguous stop affordance, keep the viewport following answer text without
source cards jumping ahead of it, reveal sources only after the run ends, make
source cards align consistently, replace the segmented mode switcher with a
compact dropdown, and keep the composer from covering mobile content.

## Non-goals

- No change to chat prompts, models, credits, persistence, APIs, or source
  normalization/citation semantics.
- No new mode vocabulary or chatbot configuration behavior.
- No redesign of the sidebar, feedback actions, or embedded chat surface.

## Design

- **Domain vocabulary:** participant-facing `Chatbot`, `Thread`, assistant
  `Message`, `Source`/citation, and chat `Mode`.
- **Layer footprint:** `apps/chat` React presentation, the focused Chat
  Playwright contract, and `docs/chat-platform.md` if its source-presentation
  contract changes. No Prisma, shared types, GraphQL, Hatchet, or codegen.
- **Auth:** unchanged; the existing participant chat route and guards remain in
  place.
- **Gamification:** none. Credits are displayed but not calculated or mutated by
  this change.
- **Async impact:** no worker or scheduling impact. The only async state is the
  existing client-visible assistant stream status.
- **UI surface:** standalone `apps/chat` at desktop and mobile widths. Reuse the
  existing EN/DE mode labels and descriptions, accessible labels, and
  `data-cy` hooks; no new strings are expected.
- **Test level and evidence:** extend `playwright/tests/Y-chat.spec.ts` using its
  mocked chunked stream to prove sources stay absent while text is running and
  appear after completion; verify mode selection and responsive geometry;
  run Chat tests/checks plus pre-PR checks; capture desktop and mobile browser
  screenshots.
- **Seeds/fixtures:** no new seed data. Reuse the existing seeded Benibot,
  participant, source payload factories, and mocked SSE stream.

## Slices

1. Replace the segmented mode selector with an accessible Radix select whose
   trigger stays compact in the header and whose menu shows each mode's icon,
   localized label, and description.
2. Render a filled stop glyph and make source visibility terminal-state-only
   with a reduced-motion-safe fade-in.
3. Use one uniform responsive source grid and keep the standalone composer in
   layout so its text, attachments, errors, hint, and safe area cannot cover
   the viewport.
4. Update focused Playwright coverage, browser-validate desktop/mobile states,
   and complete repository checks and review.

## Progress

- 2026-08-23: Mapped the current mode switcher, source rendering, assistant-ui
  auto-scroll behavior, mobile header, composer overlay, and existing streamed
  chat test seam. Design settled.
- 2026-08-23: Replaced the segmented mode control with a Radix dropdown,
  delayed/faded sources until terminal message state, unified source cards in a
  responsive grid, filled the stop glyph, scoped viewport auto-scroll to the
  running state, and hardened the mobile header/composer geometry.
- 2026-08-23: Extended the deterministic streamed-chat Playwright contract and
  added mobile overflow/overlap assertions. Chat's 332 unit tests, the
  Playwright TypeScript check/86-test listing, `pnpm run check:all`, and the
  full monorepo build pass.
- 2026-08-23: Independent review findings were incorporated: the standalone
  composer now participates in flex layout, terminal source insertion reveals
  only its heading, `requires-action` remains nonterminal, mode descriptions
  are programmatically associated, and keyboard stop/mode regressions were
  added.
- 2026-08-24: Reconciled the readiness fixes onto the current PR head. The
  Playwright TypeScript check passed, the Chat production build passed, and the
  focused R1/R2/R3 Playwright run passed 3/3 against that build. After review
  strengthened the R3 overlap guard to measure the composer boundary, its
  focused production-server check passed 1/1. The deliberate stream-release
  regression test also passed. The Devrouter Turbopack dev path still serves
  the loading shell without hydrating in this environment, so the browser
  evidence uses the successful production server; no product code was
  changed.
