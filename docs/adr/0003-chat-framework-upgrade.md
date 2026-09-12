# 3. Fold the chat framework upgrade into the v3 student-chat branch

The student-chat v3 branch already changes the assistant-ui composition, message parts, feedback
controls, and AI SDK route. Leaving the framework upgrade for a follow-up would require another
large rewrite of the same surfaces and make the current review harder to reproduce.

We therefore upgraded `@assistant-ui/react` and `@assistant-ui/react-markdown` to the 0.14 line,
and `ai`, `@ai-sdk/openai`, and `@ai-sdk/mcp` to the AI SDK 7-compatible versions in
`apps/chat/package.json`. The chat UI uses the stable grouped-parts and feedback APIs, while
`apps/chat/src/hooks/useChatResponse.ts` remains the transport boundary. The planned
`useAISDKRuntime` replacement was spike-gated: without a live model key, the full
reasoning/tool/credits matrix could not be verified safely, so U5 was recorded as a fallback
instead of destabilizing the otherwise reviewable branch.

This keeps the upgrade's API and dependency changes in the branch, but makes the custom
transport an explicit compatibility boundary. A future U5 attempt must re-run the live
multi-step credit, reasoning, tool, error, telemetry, and thread-persistence matrix before
removing it. Interactive MCP Apps remain a separate feature and are not enabled by this ADR.
