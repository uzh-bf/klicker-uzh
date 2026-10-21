# 54. Students choose how answers read, never how much help they get

## Status

Accepted

## Context

Students differ in how they want the chat assistant's answers to read. Some
are new to a topic and need terms and steps spelled out; others know the
basics and find that repetition in the way. Some prefer bullet points, and
some prefer a warmer or plainer tone.

The evidence limits what such a setting may promise and change:

- Matching instruction to stated presentation preferences has almost no
  evidence of improving learning ([Pashler et al., 2008](https://doi.org/10.1111/j.1539-6053.2009.01038.x)).
  The setting is a reading preference, every option must be a sound way to
  teach, and the product must not claim it improves learning.
- Learners are not reliably the best judges of their own instruction, so full
  learner control is not supported ([Kirschner & van Merriënboer, 2013](https://doi.org/10.1080/00461520.2013.804395)).
  A few curated options with fixed guardrails fit better.
- Support that helps novices can become redundant or harmful for learners with
  more prior knowledge, the expertise reversal effect ([Kalyuga & Renkl, 2009](https://doi.org/10.1007/s11251-009-9102-0)).
  The effect was absent in a less structured legal-reasoning task
  ([Nievelstein et al., 2013](https://doi.org/10.1016/j.cedpsych.2012.12.004)),
  so worked steps stay worthwhile there. Prior knowledge is a better-grounded
  frame for length than plain short or long.
- Reduced verbosity was studied as a support for learners using imperfect
  pedagogical chatbots ([Li et al., 2026](https://doi.org/10.1145/3772318.3791940)),
  which supports a concise default.
- A polite pedagogical agent produced better learning outcomes
  ([Wang et al., 2008](https://doi.org/10.1016/j.ijhcs.2007.09.003)), so a
  plainer tone must still keep feedback on mistakes polite.
- Unguarded GPT-4 access during practice lowered later exam performance, while
  a tutor with learning safeguards largely mitigated this
  ([Bastani et al., 2025](https://doi.org/10.1073/pnas.2422633122); correction
  [10.1073/pnas.2518204122](https://doi.org/10.1073/pnas.2518204122)). No
  option may weaken the Tutor's safeguards.
- Prompts that help early lose their value once learners have internalized
  them ([Nückles et al., 2009](https://doi.org/10.1007/s11251-009-9106-9)), and
  students rarely choose retrieval practice on their own
  ([Karpicke et al., 2009](https://doi.org/10.1080/09658210802647009)). The
  existing conditional comprehension check therefore stays a mode default, not
  a student option.

[ADR 0021](./0021-templated-standard-modes-reviewed-custom-modes.md) fixes the
system-prompt authority order. Lecturer text is lower-priority data, and the
platform mode contract, course policy, output format, citation, and language
contracts cannot be removed. A student preference must fit into that order
without weakening any of these rules.

## Decision

- Students pick from two closed lists. There is no free text.
  - **Answer style** frames length and structure around prior knowledge:
    `balanced` (default), `detailed` ("New to this topic": define key terms and
    show worked steps), `brief` ("I know the basics": skip fundamentals and use
    fewer worked steps, but keep the background the answer needs), and
    `bullets` ("Bullet points": structure only).
  - **Tone** changes wording and warmth only: `neutral` (default), `friendly`
    (warm and encouraging, without empty praise or diluted corrections), and
    `direct` (plain wording; feedback on mistakes stays polite and specific).
- The compiler adds one section, `Student answer preferences`, directly after
  the mode sections (the platform mode contract, or a custom persona) and before
  the fixed input-context, course-policy, output-format, citation, and language
  contracts. Both axes share this one section. It is emitted only when the style
  is not `balanced` or the tone is not `neutral`. With both defaults, the
  compiled prompt, its prompt-cache key, and `systemPromptHash` stay
  byte-identical. The concise default is today's prompt, not new text.
- The section states its own precedence:
  - the preferences change how an answer reads, never how much help the student
    gets. They never change the teaching move or how much of a solution the
    Tutor reveals; the Tutor still asks for an attempt and gives hints before a
    full solution, and `brief` never means answer-only. More detail means fuller
    explanation, never working out a result the student is asked to find;
  - they keep any comprehension or application check the mode contract calls
    for and never add or remove it;
  - they apply to explanations and feedback, never to Quizzer question stems,
    answer options, or structured output;
  - lecturer guidance or a custom persona that sets a voice or tone wins over the
    student's tone, and a length or format named in lecturer guidance wins over
    the student's style;
  - the output-format, citation, course-policy, and language contracts always
    win, and the language contract stays last.
- The trailing per-step system message stays reserved for correctness and
  language reminders. The preferences are not repeated there.
- The client stores both values only in the browser's `settings-storage`
  localStorage entry and sends them as `answerStyle` and `answerTone` with each
  chat request. The chat route accepts only the listed values and maps a missing
  or unknown value to the default without rejecting the request. No participant
  data is stored server-side, and no database or GraphQL schema changes.
- Product copy describes the setting as changing how answers are written, not
  how much help the student gets, and makes no learning claim.

## Consequences

- Students change how answers read without any way to weaken platform or
  lecturer rules, because both inputs are enums and the template text is
  repository-owned.
- Different students on the same chatbot can hit different prompt-cache
  entries. The defaults keep the existing cache key.
- The preferences are per browser. They do not follow a student across devices,
  and in embedded iframes where the browser blocks third-party storage they can
  reset on reload, like the mode selection.
- Model compliance with the precedence rules is not proven by unit tests. A
  small live evaluation through the chat route (see `docs/chat-platform.md`)
  led to the explicit detail and closing-check rules; a larger repeated
  evaluation remains a follow-up.
- Planned follow-up: a lecturer setting that restricts the offered options per
  chatbot (shared control). Adding options, free text, or server-side storage
  would need a new decision.
