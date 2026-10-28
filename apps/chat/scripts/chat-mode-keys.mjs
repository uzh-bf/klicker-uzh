/**
 * Chat-mode identifiers the synthetic evaluation clients may request.
 *
 * The evaluation scripts are plain `.mjs` and cannot import the TypeScript mode
 * registry (`apps/chat/src/lib/config/prompts.ts`), so this list is duplicated
 * there by necessity; `system-prompt-compiler.test.ts` fails when the two drift apart.
 */
export const CHAT_MODE_KEYS = ['tutor', 'explainer', 'quizzer', 'writing-coach']
