---
module: chat
date: 2026-08-09
problem_type: runtime_error
severity: high
symptoms:
  - 'The Vorkurs chatbot failed on its first streamed response after MCP tool discovery.'
  - "The stream crashed with: TypeError: Cannot read properties of undefined (reading 'hasFinished')."
  - 'The failure occurred when the first streamed provider tool call used index 1.'
root_cause: 'The old @ai-sdk/provider-utils stream tracker stored tool calls in an index-addressed array and flushed a sparse entry as if it were a tracker object.'
tags:
  - ai-sdk
  - chatbot
  - streaming
  - tool-calls
  - provider-utils
  - sparse-index
---

# AI SDK streamed tool calls crashed on a sparse provider index

## Problem

The chat app's OpenAI-compatible stream could fail on the first Vorkurs request
after MCP tool discovery. The chat route already used the required
`consumeSseStream: consumeStream` transport option, so the failure was in the
provider conversion path rather than in the route's abort handling
([docs/chat-platform.md](../../chat-platform.md):42).

## Symptoms

The old provider-utils tracker stored streamed tool calls in an index-addressed
array. When the provider's first tool-call delta used index `1`, the array had a
hole at index `0`; stream flush then read `hasFinished` from `undefined`
([project/2026-08-09-vorkurs-chatbot-sdk-fix-plan.md](../../../project/2026-08-09-vorkurs-chatbot-sdk-fix-plan.md):40).

## What Didn't Work

The initial dependency set reproduced the failure through the public
`createOpenAI` and `streamText` APIs, so an internal tracker assertion or a
route-specific workaround would have tested the wrong boundary. The fixture was
red on provider-utils `5.0.12` before the patch train was installed
([project/2026-08-09-vorkurs-chatbot-sdk-fix-plan.md](../../../project/2026-08-09-vorkurs-chatbot-sdk-fix-plan.md):174).

## Solution

Move the chat app to the coordinated patch train: `ai@7.0.52`,
`@ai-sdk/openai@4.0.30`, and `@ai-sdk/mcp@2.0.25` are pinned directly in
`apps/chat/package.json:7` and `apps/chat/package.json:32`; the lockfile resolves
their shared provider-utils package to `5.0.21`.

The regression fixture uses the public provider and stream APIs with injected
OpenAI-compatible SSE. It sends the first tool-call delta at index `1`, splits
the JSON arguments across deltas, and asserts the public parsed `tool-call` and
terminal `finish` parts ([apps/chat/test/openai-chat-streaming.test.ts:14](../../apps/chat/test/openai-chat-streaming.test.ts#L14)).

## Why This Works

The patch train contains the provider-utils fix while keeping the dependency
relationship transitive and aligned. The fixture exercises the same public
conversion boundary that failed, without a database, MCP server, or model key
([docs/testing.md:27](../../testing.md#which-level-for-which-change)).

## Prevention

Run `apps/chat/test/openai-chat-streaming.test.ts` before the full chat suite
for OpenAI-compatible stream changes. Treat a green local fixture as evidence
for the provider conversion path only; a real-upstream first-turn staging smoke
test remains a separate release gate ([.agents/skills/klicker-testing-verification/SKILL.md:24](../../.agents/skills/klicker-testing-verification/SKILL.md#route-the-change)).
