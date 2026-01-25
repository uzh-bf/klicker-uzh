# Chat app: upgrade assistant-ui to v0.11.x

## Goal

Upgrade `@assistant-ui/*` packages in `apps/chat` to the latest `0.11.x` series (from `0.10.x`) to pick up upstream fixes/features, while keeping the current “external store runtime” architecture.

## Current state (code)

- `apps/chat/package.json`:
  - `@assistant-ui/react@0.10.43`
  - `@assistant-ui/react-ai-sdk@1.0.3` (currently not used for runtime)
  - `@assistant-ui/react-markdown@0.10.9`

- Runtime integration:
  - `apps/chat/src/app/RuntimeProvider.tsx` uses `useExternalStoreRuntime` + `AssistantRuntimeProvider`.

- UI primitives usage:
  - `apps/chat/src/components/thread.tsx` uses `ThreadPrimitive`, `MessagePrimitive`, `ComposerPrimitive`, etc.
  - `apps/chat/src/components/tool-fallback.tsx` uses `ToolCallContentPartComponent`.
  - Markdown rendering via `@assistant-ui/react-markdown` in `apps/chat/src/components/markdown-text.tsx`.

## Expected breaking changes (to confirm during upgrade)

Based on assistant-ui v0.11 migration notes:

- **ContentPart → MessagePart** rename (types/components).
  - Example: `ToolCallContentPartComponent` may become `ToolCallMessagePartComponent` (or similar).
- Potential type changes around message shapes (`ThreadMessageLike`, tool parts).
- Some styled components were moved to `@assistant-ui/react-ui` (not currently used; we use primitives).

## Proposed upgrade steps

1. **Bump dependencies** in `apps/chat/package.json`:
   - `@assistant-ui/react` → latest `0.11.x`
   - `@assistant-ui/react-markdown` → matching `0.11.x` (if required)
   - `@assistant-ui/react-ai-sdk` → latest compatible version (optional if still unused)

2. **Fix compile/type errors** by updating imports/types:
   - Replace renamed types (`ContentPart` → `MessagePart`).
   - Update `ToolFallback` typing if needed.
   - Verify `ThreadMessageLike` still matches our stored message objects.

3. **Verify message/tool rendering**
   - Ensure `MessagePrimitive.Content` still supports the same `components` API:
     - `Text: MarkdownText`
     - `tools: { Fallback: ToolFallback }`

4. **Confirm runtime behavior**
   - Ensure `useExternalStoreRuntime` signature is unchanged.
   - Validate branching/edit/reload still works (`useThreadManagement`, `chatStore`).

5. **Run validators**
   - `pnpm --filter @klicker-uzh/chat check`
   - `pnpm --filter @klicker-uzh/chat lint`

6. **Manual UI regression**
   - Send messages, edit user message, reload assistant message.
   - Verify tool call fallback UI still renders.
   - Verify markdown + KaTeX rendering.

## Testing strategy

- Typecheck + lint in chat workspace.
- Manual smoke test in browser.
- If available/added later: component tests for tool rendering + markdown.

## Rollout

- Ship as a single PR with dependency bumps + required code changes.
- Avoid any behavioral refactors during the same change.

## Open questions

1. Should we remove `@assistant-ui/react-ai-sdk` if we keep the external-store runtime? (optional cleanup)
2. Do we want to adopt `@assistant-ui/react-ui` components later for consistent theming?
