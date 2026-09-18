# Writing Coach: feedback on the author's own writing

Status: design approved and implementation delivered to [draft PR 5867](https://github.com/uzh-bf/klicker-uzh/pull/5867). Integrated browser acceptance and review gates remain open. The [current roadmap](2026-09-09-writing-coach-plan.md#current-roadmap--12-september-2026) is authoritative for status, next steps and deferred scope; the proposal below records the design rationale.

## Recommended first version

Add **Writing Coach** to the existing chatbot modes. Learners paste an excerpt and receive specific feedback, explanations, and tips for improving it. They make the changes themselves. The mode supports scientific writing and less formal communication through generic criteria built into its prompt.

Reuse the current chat, model route, conversation history, lecturer context, and Markdown rendering. Expand the existing lecturer context field to 1,000 characters. Provide a useful example and verify that this context guides the chatbot. This remains the only free-text lecturer configuration required. No lecturer or learner rubric authoring, uploads, adjustment controls, additional tools, second model call, or feedback-processing service is needed for this version.

The settled behavior is **feedback without rewriting**. The coach can quote the submitted text to locate an issue and explain what the author should consider. It must not supply replacement sentences, paraphrases, polished passages, translations, completions, or documents. This applies throughout the conversation, including direct requests to rewrite.

Use Markdown for the feedback itself. A small **Notes** section can collect useful tips, revision priorities, and takeaways during the conversation. A separate Notes area is deferred. These notes are ordinary chat output, without a formative assessment workflow, progress tracker or learner profile.

This revision supersedes the earlier recommendation for checked structured feedback, configurable rubrics, rubric snapshots, and a second inference for output checking. Those additions are not prerequisites for this first version.

## Generic criteria with context-sensitive feedback

Use one platform-maintained rubric with five shared dimensions. Describe successful writing in the prompt, then explain how each dimension applies to the genre and the particular excerpt. The criteria guide the analysis; they do not create a compulsory five-part report or a numerical grade.

| Dimension | General expectation | Scientific application | Less formal application |
| --- | --- | --- | --- |
| Purpose and audience | The text makes its purpose understandable and gives its intended reader the context they need. | A section serves its scientific function and makes the question, result, or interpretation clear where relevant. | The reader can identify the message, intended action, or point of the reflection. |
| Substance and reasoning | Claims and conclusions follow from the information given, with enough relevant support. | Claims match the evidence and study design; observations, interpretation, and uncertainty are distinguished. | Specific details or reasons support the message; personal reflection is sufficiently developed for its purpose. |
| Organization and coherence | Ideas follow a useful order and their relationships are understandable. | Paragraphs and sections build a coherent account of the research. | The message is easy to follow and important information is easy to find. |
| Clarity and precision | Wording, references, and terminology convey the intended meaning without unnecessary difficulty. | Terms, quantities, and references to results are sufficiently precise. | The reader can understand the message without avoidable ambiguity or repetition. |
| Tone, voice, and conventions | Style fits the audience and task while preserving the author's voice. | Scientific register and relevant reporting conventions support comprehension. | Conversational, personal, or practical language is appropriate when it serves the purpose. |

Scientific and informal writing share these dimensions but need different interpretations. Do not demand citations in a casual update, formal language in a reflection, or a research question in a pasted Results paragraph. Do not confuse missing context outside an excerpt with a defect in the writing.

The lecturer's context steers the interpretation. The expanded field describes the audience, tasks, prior knowledge, and learning priorities without requiring a lecturer-defined rubric. The learner can mention a purpose, audience, section, or focus in ordinary chat. Do not require a setup form or clarification before giving feedback that the excerpt already supports.

The built-in rubric is general writing guidance, not the lecturer's official marking scheme. Do not predict a grade or imply that it represents unstated course assessment criteria. If purpose or genre is ambiguous, state the working assumption and ask a short follow-up only when the answer would materially change the advice.

## The chat experience

The learner chooses Writing Coach, pastes text, and optionally asks for a particular focus. The first response gives a substantive reading of the excerpt, identifies specific strengths, and explains the most useful improvements. Detailed analysis should be available in the response without overwhelming the learner with a compulsory checklist.

Use a consistent but flexible Markdown pattern:

- **What works:** one or two specific strengths tied to the text.
- **Focus next:** usually two or three priorities, each with a short quote or location, an explanation, and a concrete revision action.
- **Further feedback:** concise criterion-based detail when the excerpt or request warrants it. If the learner requests detailed analysis, cover all relevant dimensions and identify material limits.
- **Your next step:** one manageable revision task or self-check. Follow-up turns can concentrate on the issue under discussion rather than repeat the whole pattern.
- **Notes:** an optional short recap of useful takeaways when there is something worth keeping.

“Concrete revision action” means an operation the author can perform, such as checking the relationship between a claim and the reported comparison, explaining a missing logical link, or deciding where the reader needs context. It does not mean providing the words to paste into the document.

For a synthetic scientific excerpt containing “This proves that the treatment is effective,” the response could include:

> **Focus next: match the claim to the evidence**
>
> The phrase “This proves” makes a strong claim. The excerpt does not show enough about the study design or uncertainty to establish that strength. Check which comparison supports the conclusion and whether the design supports a causal interpretation. Decide how strongly the evidence allows you to state the finding.
>
> **Self-check:** What result supports the conclusion, and what uncertainty should the reader understand?
>
> **Notes**
> - Match the strength of a scientific claim to the evidence and study design.
> - Current revision priority: check the conclusion against the reported comparison.

For an informal update, equally useful feedback might be: “The decision you need appears only at the end. A busy reader may miss it. Check how early the message makes that decision visible.” The coach preserves the conversational tone instead of automatically making the writing more formal.

Learners revise in their own document and paste a new version when ready. The coach uses the existing conversation to discuss changes and unresolved issues. It can explain what improved without inventing new criticism. It must not claim that one successful revision proves mastery or assess a whole document from one excerpt.

## Optional Notes area

Notes are a small conversation recap. Suitable content includes a reusable writing tip, a priority the learner chose, or feedback that remains relevant to the current excerpt. Label a proposed takeaway as advice, rather than asserting that the learner has learned it. Keep a short current list, roughly three to five items, and consolidate duplicates instead of appending indefinitely.

If a separate area is added, treat it as a chat presentation feature that other modes could use later. Writing Coach does not need a separate assessment-specific notes system.

Two presentation options fit the intended scope:

| Option | Behavior and implementation impact | Recommendation |
| --- | --- | --- |
| Notes inside chat | The assistant occasionally includes a Markdown Notes section in its ordinary response. Existing rendering and message history carry it. | Start here. It demonstrates value with the smallest change. |
| Separate Notes area | A small panel displays the latest complete notes block produced within the same assistant response. Ordinary feedback remains in chat. This needs a narrow output convention and renderer support. | Add if a persistent place to glance at takeaways proves useful. It remains optional. |

For a separate area, the saved assistant message remains the source of truth. Derive the display from the latest complete notes block in the current conversation; do not create another model call, tool, notes database, or background process. Show the current notes until a complete replacement is available. When a response has no notes update, keep the previous list. If a notes block cannot be recognized, leave the ordinary chat message available and retain the previous notes rather than inventing an update.

These are proposed rendering semantics, not an existing capability. Implementation would need to verify streaming, interrupted responses, and conversation reload. The model can omit earlier items, so the area should be presented as a current recap, not a complete record or guaranteed memory. Detailed feedback and the submitted writing remain in chat history.

Do not add completion states, criterion scores, automatic progress measures, or cross-conversation memory. Editable rubrics and a fuller formative assessment workflow can be considered later if teaching needs justify them.

## Fit with existing Klicker infrastructure

Source evidence uses refreshed `origin/v3` at `cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`. These findings concern source capability, not deployed behavior. This historical integration outline informed the approved execution plan linked above.

| Existing part | Verified source | Smallest proposed change |
| --- | --- | --- |
| Standard modes and selector | `apps/chat/src/lib/config/prompts.ts`; `apps/chat/src/lib/config/modes.ts`; `apps/chat/src/lib/server/effectiveChatModes.ts` | Register Writing Coach, provide its prompt and localized label, and connect it to the existing mode availability mechanism. Preserve existing course policy. |
| Lecturer context | `apps/frontend-manage/src/components/resources/chatbots/ChatbotAuthoring.tsx:618`; `apps/chat/src/lib/server/systemPromptCompiler.ts:89` | Reuse `scopeNote`. Add Writing Coach to the compiler's recognized standard modes so the existing framing reaches its prompt. No new authoring form or rubric configuration. |
| Mode enablement | `packages/types/src/chatbotStandardModeConfig.ts`; `packages/util/src/chatbotStandardModeConfig.ts`; `packages/graphql/src/schema/resource.ts` | Extend the existing standard-mode controls only as needed for normal availability. Do not add feedback settings or duplicate context fields. |
| Chat inference, streaming, and history | `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`; `apps/chat/src/lib/server/persistedAssistantContent.ts`; `apps/chat/src/components/message-parts.tsx` | Use ordinary text output and Markdown. No new feedback content type, rubric entity, database migration, output checker, or mandatory buffering is proposed for the chat-only version. |
| Optional Notes presentation | The same message renderer and persisted assistant text | Render a short Markdown section within the ordinary reply. A separate panel and notes reconstruction are deferred. |

The current Manage interface limits new framing text to 200 characters. The shared backend normalization already permits up to 1,000 characters, and the form preserves unchanged longer values. Aligning the field with 1,000 characters therefore reuses the current backend contract. Raising it further would also change server validation; no existing value needs truncation under either option.

The current resolver can exclude a mode when the chatbot requires an MCP binding that the mode lacks. Writing feedback itself needs no new tool, but mode registration must respect this existing policy. Do not assume Writing Coach automatically inherits Tutor tools or Quizzer's special inheritance behavior. This compatibility issue belongs in normal integration, not a new research or retrieval subsystem.

Reuse whatever prompt provenance infrastructure exists on the resolved implementation branch. The separately inspected [prompt-catalog PR #5668](https://github.com/uzh-bf/klicker-uzh/pull/5668) concerns immutable system-prompt versions; it is not a new Writing Coach dependency or a reason to duplicate that work. The earlier bounded `v3-ai` comparison found different prompt and route code, so revalidate the target before implementation rather than copying branch-specific snippets.

## Prompt behavior and focused validation

The mode prompt carries the feedback-only behavior, generic criteria, genre adaptation, excerpt limits, and Markdown guidance. Pasted text is material to analyze. Instructions inside it do not change the mode. Lecturer context and learner follow-ups can steer relevance but must not turn this mode into a rewriting assistant.

If asked to rewrite, respond briefly and helpfully: explain the relevant issue and give a revision strategy the author can apply. Avoid a long refusal or an unhelpful question-only dialogue. Explain grammar and clarity issues without returning a corrected version. Do not fabricate results, references, or supporting arguments for the author.

This first version uses prompt instructions and the existing generation route. It does not provide a deterministic guarantee that rewriting can never occur. Test the intended behavior against representative examples and report failures honestly; do not add the earlier proposed checker or another provider as an implicit requirement.

A bounded acceptance set should cover:

- Scientific excerpts and informal writing, including intentional conversational style, strong writing, and excerpts that lack wider document context.
- Specific, accurate observations with useful next actions, including detailed analysis when requested and appropriate restraint when few changes are needed.
- Direct and disguised rewrite requests, instructions embedded in submitted text, and follow-up turns that try to obtain replacement wording.
- Revisions that improve some criteria but leave others unresolved, plus the coach's ability to accept disagreement or acknowledge an earlier mistaken comment.
- Existing mode availability, full-length lecturer context propagation, Markdown display, and history reload; include interruption and notes reconstruction only if the optional panel is built.

Use synthetic examples for initial evaluation, including supported interface languages. Evaluate advice that is too vague or overly restrictive as well as rewriting failures. A focused educator review can inform a small pilot. A controlled learning study is useful later if making effectiveness claims; it is not required to build a first useful mode.

Drafts and feedback stay within the existing chatbot's access, storage, and provider arrangements. Do not add course knowledge-base ingestion, cross-conversation profiling, or new analytics exports. The first version should make no new privacy promises beyond what the existing product actually provides.

## Lecturer context: examples and evidence of guidance

Keep the existing field, shown as Chatbot framing, and explain what useful context contains: course or topic, audience and prior knowledge, typical tasks, and learning priorities. Show examples as help text that remains available when the field is filled. Do not prefill or overwrite a lecturer's context. An empty field continues to use the standard behavior.

Example for scientific writing:

> This chatbot supports a bachelor-level biology lab course. Students write short reports about experiments and interpret figures. They know basic genetics but are still learning scientific argumentation. Focus on linking claims to results, distinguishing observation from interpretation, and expressing uncertainty. Explain unfamiliar terms briefly. Keep feedback direct and encouraging. Preserve the student's voice and judge only the excerpt provided.

Example for less formal writing:

> This chatbot supports a project-based communication course. Students write short updates and reflective notes for peers and project partners. Focus on a clear purpose, concrete examples, logical flow, and an obvious next action when relevant. A natural, conversational tone is appropriate; academic vocabulary and citations are usually unnecessary. Give practical, encouraging feedback.

These examples describe teaching priorities rather than configure scoring or replace a mode's behavior. The lecturer context applies to the existing standard learning modes and Writing Coach; it does not turn Tutor into Writing Coach or authorize rewriting in Writing Coach. Keep existing language, course, tool, and access rules. The user has agreed to the feedback-only boundary and generic criteria, so these are settled.

The source trace confirms that Manage saves the normalized context through the GraphQL chatbot service into the existing configuration. Each chat request reloads that configuration, compiles the system prompt, and passes it as model instructions. A completed context edit therefore applies to the next request in an existing conversation; an already-running request and previous messages retain their existing content. This follows the existing per-request configuration decision in [ADR 0019](../../docs/adr/0019-chatbot-config-postgresql-authoritative.md).

The current wrapper in `apps/chat/src/prompts/lecturer-standard-context.hbs` says that context can tailor the mode but also calls it data, never instructions. That wording may make legitimate teaching priorities less clear; source inspection cannot establish whether the model actually ignores them. The implementation should explicitly tell the model to apply relevant audience, prior-knowledge, task, and learning-priority information while retaining the fixed mode and course policies. Add Writing Coach to the compiler's standard-context selection. Do not expand the lecturer field into an unrestricted system-prompt editor.

Verification must distinguish two kinds of evidence. First, source and integration checks must show that the saved context, including a relevant instruction near the chosen character limit, reaches the compiled prompt and actual provider request without truncation. Second, synthetic model runs through the existing chat route must demonstrate appropriate changes in feedback.

Use the same excerpt and learner request with no context and with two deliberately different contexts. One can target novice readers and clarity; another can target readers familiar with the terminology and prioritize evidence and uncertainty. Hold the model and other request settings constant for each comparison. Judge whether the response changes its explanations and priorities appropriately, rather than searching for copied context wording. Repeat a small number of comparisons to expose inconsistent steering, and include a follow-up plus a conflicting rewrite request.

Include an informal-writing case and the supported interface languages. Report the actual model route and separate default-route evidence from fallback-route evidence. Reuse current test and evaluation infrastructure, without new tools or a live second-model checker. No model runs have been performed for this proposal; successful prompt construction alone must not be reported as behavioral proof.

Existing verification seams are `playwright/tests/T-chatbot-authoring.spec.ts` for save/reload, `packages/graphql/test/manageChatbots.test.ts` for persistence, and `apps/chat/test/system-prompt-compiler.test.ts` for composition and authority. The existing `apps/chat/scripts/klicker-evaluation-target.mjs` submits to the chat endpoint and reads persisted responses. Its current fixtures support Tutor/Explainer only and create a new conversation per question. A bounded extension or reuse of its request transport is needed for Writing Coach, paired contexts, and follow-up checks; its mocked tests do not prove behavioral steering. No new evaluation framework is proposed.

## Agreed design decisions

The accepted first version uses existing infrastructure, built-in writing criteria, no rewriting, Markdown feedback, and optional Notes inside chat. Lecturer rubric authoring, a separate Notes panel, and a fuller formative assessment workflow remain deferred. The lecturer context expands to 1,000 characters and includes useful examples. All three questions below were accepted with the recommended answers.

| Question | Agreed decision | Reason and reopening trigger |
| --- | --- | --- |
| Q1 — Context length | Allow 1,000 characters. | Matches the current backend and accommodates the examples. Reconsider only when real teaching briefs demonstrate a need for more space. |
| Q2 — Initial mode availability | Writing Coach starts disabled on existing and new chatbots. Lecturers enable it through the existing mode controls. | Adding writing support remains deliberate. Any later automatic enablement requires a new product decision. |
| Q3 — Writing-only chatbots | Allow Writing Coach without Tutor or Explainer. | Supports a dedicated writing chatbot while preserving existing course and tool policies. Quizzer-only behavior remains unchanged. |

Question numbers identify design choices, not implementation tasks. Questions dependent on the answers belong to the next round. This complete frontier was reviewed by the configured native planner, which returned DONE_WITH_CONCERNS. The main session accepted its recommendation to include automatic enablement for new chatbots as a separate option and retained the three independent questions. The scientific and informal examples contain 452 and 386 characters respectively. The user answered “agreed” to the complete round. The decision frontier is empty on the current evidence. No further product confirmation is required; the user subsequently approved the reviewed execution plan.

## Research and what it supports

This is a focused evidence review, not a systematic review. The proposal distinguishes findings from design recommendations. Some publisher pages were available only through their indexed abstract; no effect size or full-method claim is inferred from those abstracts.

| Evidence | Finding and limitation | Design implication |
| --- | --- | --- |
| [Carless and Boud, 2018: student feedback literacy](https://doi.org/10.1080/02602938.2018.1463354) | A conceptual framework emphasizes understanding feedback, making judgments, managing affect, and taking action. It is not a trial of an AI interface. | Give the learner a role in evaluating and acting on comments. Allow disagreement and requests for explanation. |
| [Fleckenstein, Liebenow and Meyer, 2023: automated writing feedback meta-analysis](https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2023.1162454/full) | Twenty studies with 2,828 participants yield a medium average effect on writing performance, Hedges' g = 0.55. The studies concern varied automated writing systems, not this proposed LLM coach. | Automated feedback merits a pilot. Do not advertise this average as the expected effect of Writing Coach. |
| [Steiss et al., 2024: human and ChatGPT feedback](https://doi.org/10.1016/j.learninstruc.2024.101894) | Comparison of 200 human and 200 AI feedback pieces finds trained humans stronger on four of five quality dimensions. Feedback quality is the measured outcome, not subsequent learning. | Evaluate accuracy, prioritization, actionability, rubric alignment, and tone; fluent comments are insufficient. |
| [LLM feedback for academic writing, 2026](https://doi.org/10.1016/j.cedpsych.2026.102463) | A randomized experiment with 144 university students reports better revisions of research abstracts and greater behavioral engagement with GPT-4 feedback. Evidence here is the publisher abstract. | Scientific excerpt feedback is a credible use case. This does not establish durable transfer to writing without AI. |
| [Teacher, peer, or AI?, 2025](https://doi.org/10.1016/j.caeo.2025.100300) | A randomized field experiment with 90 students reports the strongest improvement in scientific argumentation and formal quality from teacher feedback; LLM feedback yields the smallest improvement overall. The publisher abstract and UZH institutional PDF were checked. | Retain access to human feedback, particularly for substantive scientific reasoning. Satisfaction is a poor proxy for learning. |

Two newer preprints strengthen the case for examining the workflow, with important limits. [FeedbackWriter, February 2026](https://arxiv.org/abs/2602.16820) reports improved revisions in a randomized trial with 354 economics students, but teaching assistants selected and edited the AI suggestions. It is evidence for human-mediated feedback, not an autonomous coach. [Making AI-Generated Feedback Matter, August 2026](https://arxiv.org/abs/2608.11625) associates structured selection and discussion of feedback with greater uptake in a large sequential-cohort study. It is not randomized, and its student-authored resources are not equivalent to scientific reports.

[Dai, June 2026](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1829268/full) reports a six-week experiment with 120 English majors. Groups taught to evaluate and select feedback maintained stronger writing performance when AI support was withdrawn for the final task. This provides some direct evidence beyond assisted revision, but comes from one institution; baseline calibration differences and uneven collection of uptake data constrain the interpretation. It supports testing a learner-controlled revision loop, not promising lasting benefits across genres.

[Focused scientific feedback research at ACL 2024](https://aclanthology.org/2024.findings-acl.580/) evaluates specificity, comprehension, and helpfulness of comments beyond surface style. It supports evaluating those qualities, but does not justify importing its multi-agent architecture or claiming writing-skill gains.

There is a relevant product precedent: [Khan Academy Writing Coach](https://support.khanacademy.org/hc/en-us/articles/34289734608909-How-do-my-students-work-on-a-Writing-Coach-assignment-I-created) groups comments by category, links them to highlighted text, and supports revision dialogue. Its broader editor and assignment workflow is unnecessary for a first Klicker mode. This is a product reference, not independent effectiveness evidence.


For this narrowed version, the evidence supports specific observations, manageable priorities, learner-controlled revision, and feedback adapted to the task. It does not establish that a dedicated notes panel, configurable rubric system, or second model check improves learning. Those remain product choices, and none is needed to apply the useful feedback principles in ordinary chat.

## Provenance and status

The main session owns this proposal and its current revision. A read-only native exploration worker mapped the existing mode, prompt compiler, tool policy, and message contracts. The main session verified the relevant seams. During the design discussion, the same exploration worker owns the scoped context-path and verification mapping. The main session owns product choices, examples, and documentation. A configured native planner reviews the complete question round before it is presented.

At the research checkpoint, the proposal lived in `trees/proposal-writing-coach` on `docs/writing-coach-proposal`, with no upstream. After the 9 September remote refresh, it is zero commits ahead of and zero behind `origin/v3` at `cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`. The primary checkout's unrelated local changes were left untouched. No application runtime, implementation changes, commits, pushes, or deployment had been performed at that research checkpoint. See the execution plan for subsequent work.

[Saved public-literature consultation](https://chatgpt.com/c/6aa13ffd-01c8-83ed-90ed-93ced6b76040): the visible route was Chat, model Latest, effort Extra High, with Scite selected; backend identity is unknown. Only public research questions were supplied. An actual Scite search and returned records were inspected. Additional full-text and citation-graph coverage reported by the consultation was not independently recounted. Material claims above were checked against publisher, institutional, or author records; the evidence table identifies abstract-only access.

A read-only Claude CLI advisor challenged the earlier broader draft. Its suggestions informed the examples and limitations, but its review is not evidence that the current narrowed proposal or an implementation has been independently reviewed. The user's latest scope explicitly removes the extra checker, rubric-management contract, and full structured-feedback pipeline from the first version.

The approved execution plan covers the new mode, built-in prompt, expanded lecturer context with examples, evidence of context-guided behavior, mode availability and Markdown feedback. The separate Notes panel, lecturer-configurable rubrics and fuller formative assessment remain deferred.
