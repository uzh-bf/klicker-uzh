# Instructor-facing chatbot setup

Use this reference when the user requests a setup review or a supported chatbot
change alongside OLAT integration. For a link-only task, inspect what is needed
for access and retain the existing bot configuration. This skill starts with an
existing published bot; creating, provisioning or administering a service is a
separate task.

## Read the current interface before proposing changes

The inspected management workspace has Overview, Knowledge, Behavior, Disclaimer
and Usage views. A pending revision can lock controls even for an authorised
owner. A disabled control therefore does not by itself establish a missing
permission, and a published bot is not necessarily permanently read-only.
Record live values and saved/pending values separately. [Workspace][workspace]

On an unpublished DRAFT bot, the summary labelled "Live configuration" can
already reflect saved draft values. The publication status still governs
participant availability; this label does not establish activation. See the
[draft distinction](credits-and-publication.md#save-submission-and-live-configuration).

These are supported capabilities observed in the configured October 2026 release,
not promises that every deployment or account exposes all of them. Confirm the
actual controls and their consequence before using them.

| Area                 | Decision to discuss when relevant                                                                           | Consequence and boundary                                                                                                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose and audience | Which learning activity, level, course topics and response language should the existing bot support?        | State a concrete learning purpose and test it. Course locale, interface language and language of answers are distinct. Do not treat a requested language as an available UI control unless it is shown.                                                     |
| Overview             | Does the existing name and description explain the intended use? Is this the correct linked course?         | Metadata can be reviewed as a revision. The inspected course association is fixed after creation; do not invent a course-reassignment control or create a replacement bot silently.                                                                         |
| Standard modes       | Retain or revise Tutor, Explainer and Quizzer? What short framing should apply?                             | Tutor guides learning, Explainer explains, Quizzer supports practice. Available modes depend on the actual runtime capabilities; check Quizzer's retrieval requirement. Preserve platform constraints and existing enabled modes unless a change is agreed. |
| Custom modes         | Is a distinct additional learning method needed, and what should its onboarding ask?                        | A supported custom mode has a name, description and persona instructions. Specify question style, hint progression, solution boundaries and language handling. Do not present prompt instructions as guaranteed behaviour.                                  |
| Knowledge            | Which existing course materials should answers draw on? What may broader model knowledge contribute?        | Inspect the active knowledge base and resource readiness. An OLAT link does not upload course materials or connect a knowledge base. Preserve bindings unless a separate change is authorised.                                                              |
| Models and reasoning | One instructor-selected model or a learner choice from an agreed list? Which reasoning effort levels?       | The inspected UI supports a fixed model when learner selection is off; it does not always mean automatic routing. Model availability and funding are account/deployment-specific. Higher effort can affect latency and consumption.                         |
| Disclaimer           | Is the course-specific title/introduction accurate?                                                         | Preserve fixed institutional sections. Explain data handling, verification expectations and refusal consequences using current platform wording. Changed approved text can require renewed learner acceptance.                                              |
| Usage                | What starting allowance, refill, cap and planning period suit the activity?                                 | Use [credits and publication](credits-and-publication.md). Participant allowances, raw tokens, owner funding and model access are different concepts.                                                                                                       |
| Review and test      | Save only, or also submit the exact agreed revision? Which tests can be performed with authorised accounts? | Live bot access and revision approval differ. Owner preview can still exercise the old approved configuration. First-time participant access requires its own observed test.                                                                                |

## Convert teaching intent into a reviewable proposal

1. Reuse the user's existing answers. Ask only consequential unresolved questions,
   one at a time, with a recommendation and a short explanation of the trade-off.
2. Describe the current behaviour and desired learner experience in plain language.
   For example: "In the new practice mode, ask whether the learner wants course
   topics or another learning topic, then choose German or English and ask one
   diagnostic question." A conversational onboarding instruction is not a native
   platform form; do not claim such a form exists.
3. Map that intent to the controls actually available. Draft exact changed text,
   switches and model/credit settings, and identify unchanged sections. Explain
   whether each save affects a revision or a separate live resource lifecycle.
4. Present the proposed changes and consequences before configuring them. Obtain
   explicit agreement where still missing; do not ask again for the same changes
   already approved. Integration authorisation alone does not authorise a new
   persona, uploaded materials, extra paid models or a disclaimer revision.
5. Save only the agreed sections through supported instructor controls. Reopen
   them and compare saved values, live values and revision state. Preserve other
   authors' edits, custom-mode identities and pending requests.
6. Submit only the agreed revision when submission is authorised. State that a
   pending revision is not active. After actual approval, test each changed
   learning behaviour with small synthetic prompts and verify the final response
   and relevant source behaviour. Do not use private learner conversations as
   test material or silently publish sample chats.

## Modes and language

The tagged standard configuration includes Tutor, Explainer, Quizzer and course
context; the observed authoring UI provides a short framing field. It is not a
general system-prompt editor. Preserve required standard-mode combinations and
capability gates rather than bypassing them. [Standard configuration][standard-config]
[Authoring controls][authoring]

When learner model selection is disabled, the inspected form offers one fixed
model; when enabled, it offers an allowed set. Review the selected model and
per-model reasoning controls rather than assuming "selection off" means the
deployment default. Preserve the working choice unless a change is agreed.
[Model-policy controls][model-controls]

Read the actual selected model rather than relying on generic new-bot default
text. The inspected draft's selected default differed from that text; available
registry entries and deployment settings affect creation defaults.

The inspected custom-mode format supports a stable identity, display name,
description and persona text. Keep existing identities when revising a mode;
renaming a mode is different from deleting and recreating it. Limits in the
reviewed release were five custom modes, names up to 60 characters, descriptions
up to 160, and persona text up to 10,000. An account feature can allow 100,000
persona characters; do not assume this extended limit for every user. Prefer
clear instructions to filling the maximum. [Custom-mode limits][mode-limits]
[Identity and validation][custom-config]

For a bilingual or Socratic mode, draft the language choice, when to give hints,
when to explain, how to check understanding and how to handle requests for final
answers. Keep the student's declared choice consistent across turns. A course
framing instruction cannot add a missing tool or grant access to new material.

## Knowledge, source use and optional quality controls

Inspect the linked knowledge-base inventory and readiness through the available
management UI. Distinguish source upload, successful processing, active binding
and evidence actually retrieved in a response. Seeing a linked knowledge base
does not prove that all desired files are ready or that every mode uses it.

When broader topic knowledge is desired, state its role explicitly: use course
materials for course-specific requirements and identify general explanations or
uncertainty separately. Model knowledge is not live web research. Do not promise
browsing, citations to unavailable materials or access to all OLAT pages merely
because an instruction requests it.

The inspected Knowledge view separates participant knowledge-map visibility
from graph-assisted retrieval; the latter is available only with the necessary
capability. Preserve both unless an agreed teaching purpose warrants changing
them. These controls do not create a knowledge base. [Knowledge controls][knowledge-controls]

The same release exposes a response-example review area with approve, reject and
edit-and-approve actions where permitted. Treat it as a separate content approval
decision, not as a required LTI setup step or something automatically covered by
the general chatbot revision. Inspect source eligibility and the proposed answer
before an authorised approval; preserve private content and do not export learner
examples into this reusable skill. [Response-example review][response-examples]

Uploading or replacing materials, changing bindings and reviewing examples can
have their own permissions and activation rules. Do not assume that they wait
for the general bot revision merely because another section does. Use an existing
supported instructor function only within the agreed scope. Refer missing
provisioning capabilities to the responsible operator; do not obtain database
access, service credentials or administrative publication privileges.

## Evidence and remaining limits

Record what was inspected, proposed, saved, submitted, approved and tested
separately. A successful answer from the approved bot does not prove pending
changes. A successful owner session in OLAT's participant preview does not prove
first-time registration, account linking, disclaimer acceptance or access for a
separate student. Keep that gap open until the corresponding test is actually
authorised and observed.

The sources below pin the configured `v3.4.0-alpha.87` release
(`a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f`). Refresh them against the current
deployment and interface. See the version boundary in
[credits and publication](credits-and-publication.md#dated-source-boundary-14-october-2026).

[workspace]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/frontend-manage/src/components/resources/chatbots/chatbotWorkspace.ts#L3-L33
[standard-config]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/packages/types/src/chatbotStandardModeConfig.ts#L8-L26
[authoring]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/frontend-manage/src/components/resources/chatbots/ChatbotAuthoring.tsx#L1134-L1226
[model-controls]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx#L1424-L1649
[mode-limits]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/packages/util/src/chatbotCustomModeLimits.ts#L1-L11
[custom-config]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/packages/util/src/chatbotCustomModeConfig.ts#L85-L125
[knowledge-controls]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx#L872-L1083
[response-examples]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/frontend-manage/src/components/resources/chatbots/ChatbotResponseExampleReview.tsx#L514-L575
