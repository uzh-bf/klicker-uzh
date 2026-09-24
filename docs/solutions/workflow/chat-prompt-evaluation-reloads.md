---
module: chat
date: 2026-09-09
problem_type: workflow
severity: medium
tags: [prompts, evaluation, local-runtime]
---

# Verify loaded templates when evaluating Chat prompt changes

## Context

Chat renders Handlebars templates from disk and caches the compiled template in a module-level Map. Several contracts, including DEFAULT_PROMPT, are also rendered when their modules load. Editing a template file alone therefore does not establish that a running development server uses the new instructions.

## Guidance

Reload the Chat process through the task runtime lifecycle before evaluating template changes. Restore any temporary synthetic MCP binding changes first: local startup validates the seeded bindings. Preserve the original runtime profile and use its existing secret injection when it includes the model gateway.

For synthetic evaluation, use the existing request.context log fields systemPromptHash and systemPromptLength to confirm the prompt loaded for that exact request. Recompile from the matching synthetic configuration and tool names, then compare its SHA-256 prefix with the logged hash. Missing logs leave that comparison unknown; a successful response or a changed source file does not replace it.

## Why this matters

During Writing Coach verification, five successful requests ran after template edits but before a verified reload. Those requests count toward the evaluation cap but do not prove the correction. Later restart-based evidence was stronger, while request-bound hashes make the loaded content directly checkable.

## Source

- [Template cache](../../../apps/chat/src/lib/server/promptTemplates.ts)
- [Mode contracts rendered at import](../../../apps/chat/src/lib/config/prompts.ts)
- [Request compilation and diagnostic fields](../../../apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts)

Apply this check to prompt edits and long-running development servers. It adds no product telemetry, model call, or new output checker.
