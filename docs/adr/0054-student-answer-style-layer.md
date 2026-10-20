# 54. Students choose an answer style that shapes form only

## Status

Accepted

## Context

Students differ in how they want the chat assistant to format answers. Some
want short replies, others step-by-step lists or fuller explanations. Shorter
answers can help learners spot errors, but answers that are too short leave
out needed background. Products such as ChatGPT and Claude expose style or
personality presets, and those presets mostly change voice rather than
reasoning.

[ADR 0021](./0021-templated-standard-modes-reviewed-custom-modes.md) fixes the
system-prompt authority order. Lecturer text is lower-priority data, and the
platform mode contract, course policy, output format, citation, and language
contracts cannot be removed. A student preference must fit into that order
without weakening any of these rules. In particular, Tutor withholds a full
solution until the student makes an attempt, and a style preference must not
change that.

## Decision

- Students pick one of four closed presets: `balanced` (default), `brief`,
  `bullets` (step-by-step bullet points), and `detailed`. There is no free
  text. Each preset maps to a length and a structure only. Tone and voice are
  not a student axis in this version.
- The compiler adds one section, `Student answer-style preference`, directly
  after the mode sections (the platform mode contract, or a custom persona) and
  before the fixed input-context, course-policy, output-format, citation, and
  language contracts. `balanced` emits nothing, so the default compiled prompt,
  its prompt-cache key, and `systemPromptHash` stay byte-identical. A
  non-default preset changes the prompt and therefore the cache key.
- The section states its own precedence:
  - it controls length and structure only, never the teaching move or how much
    of a solution Tutor reveals; `brief` means fewer words for the same move;
  - it applies to explanations and feedback, never to Quizzer question stems,
    answer options, or structured output;
  - lecturer guidance or a custom persona owns voice and tone, and a length or
    format named in lecturer guidance wins;
  - the output-format, citation, course-policy, and language contracts always
    win.
- The trailing per-step system message stays reserved for correctness and
  language reminders. The style is not repeated there.
- The client stores the preset only in the browser's `settings-storage`
  localStorage entry and sends it as `answerStyle` with each chat request. The
  chat route accepts only the four values and maps a missing or unknown value
  to `balanced` without rejecting the request. No participant data is stored
  server-side, and no database or GraphQL schema changes.

## Consequences

- Students change answer form without gaining any way to weaken platform or
  lecturer rules, because the preset is an enum and the template text is
  repository-owned.
- Different students on the same chatbot can hit different prompt-cache
  entries. The default keeps the existing cache key.
- The preference is per browser. It does not follow a student across devices,
  and in embedded iframes where the browser blocks third-party storage it can
  reset on reload, like the mode selection.
- Model compliance with the precedence rules is not proven by unit tests. A
  judge criterion for length or bullet ratio per preset is a follow-up.
- A tone axis, or a server-side preference, would need a new decision.
