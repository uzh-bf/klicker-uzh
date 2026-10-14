---
name: klicker-olat-integration
description: Guide instructors through supported KlickerUZH chatbot setup decisions and integrate an existing published chatbot into an existing OLAT course, with safe LTI URLs, credit-policy review, access checks and real-response verification.
metadata:
  version: '1.1.0'
---

# Klicker–OLAT Integration

Help instructors and teaching assistants make informed setup choices and provide a working learner entry to an existing published chatbot in an existing OLAT course. Preserve the working procedure: **inspect → agree settings → configure the named LTI provider → save/reopen → test → publish only when authorised**.

An explanation, skill review or preparation request remains read-only against live services. Installing or sharing this skill does not grant account permissions or authorise course, chatbot or budget changes.

## 1. Inspect the target and establish authority

Identify the exact OLAT course, published chatbot, linked Klicker course, signed-in account and permitted roles from current links and UI. Inspect existing elements before adding another. Keep unrelated nodes, materials, modes and pending work.

Use supported authenticated connectors or browser tools to execute authorised changes. The skill supplies instructions and an offline URL helper, not browser control, a login or service access. Without browser control, guide the instructor through the same manual steps; do not claim they were executed. When tools and permissions are available, carry out the agreed integration and verify the saved result rather than stopping at advice.

This is the **instructor workflow**. Institutional LTI registration, service credentials, account entitlement, funding approval and backend administration belong to authorised operators. The repository's [course-chatbot provisioning skill](https://github.com/uzh-bf/klicker-uzh/blob/v3/.agents/skills/klicker-course-chatbot-provisioning/SKILL.md) covers that separate role. Its database, credential and administrator procedures are not instructor prerequisites.

## 2. Agree the learning and integration setup

Read [setup decisions](references/setup-decisions.md). Resolve facts yourself; ask only unanswered decisions, one material question at a time with a recommendation and its consequences. Respect the user's earlier answers.

When the requested scope includes chatbot settings, use [chatbot setup](references/chatbot-setup.md) to review learning purpose, audience/language, modes, sources, model policy and disclaimer together. When it includes usage planning, use [credits and publication](references/credits-and-publication.md). Do not silently redesign a working bot as a prerequisite for integrating it.

Before consequential configuration changes, present the **specific proposed values, differences and effects** using the [integration record](assets/integration-record.md). Obtain explicit approval for unresolved changes, including any additional identity transfer, funding, review submission or publication. Prior explicit approval that covers those concrete changes remains valid; do not repeat a generic permission question. A new consequence or a host-required confirmation is a separate decision.

Record independently:

- OLAT editor changes, publication, lifecycle and audience rules;
- Klicker course association, account linking and actual participant access;
- chatbot published configuration, saved revision and pending review;
- participant allowance, available models and separate operator funding.

## 3. Execute the supported LTI procedure

Read [LTI and fallback routes](references/lti-and-fallbacks.md). On the verified UZH workflow, add or update an **LTI page** and choose **KlickerUZH** in **LTI Version**. This selects the institutional LTI 1.3 provider instead of the generic LTI 1.0/1.1 Key/Password form. Do not invent keys, passwords or deployment identifiers.

Native Chatbot selection in the OLAT Klicker element remains deployment-dependent and was still under clarification in the reviewed UZH setup. A chatbot-specific OLAT URL generator was not available there. Neither is a prerequisite. Recheck later availability without replacing a working integration merely because upstream code contains another route.

Build the launch URL from the verified registered LTI base and the **course-specific participant chatbot URL**. The offline [URL helper](scripts/build_launch_url.py) encodes the destination once. Its UZH defaults are a dated configuration reference, not discovery. For another deployment, supply both verified `--lti-base` and `--participant-origin`. Syntax validation cannot prove registration, access or server-side allowed destinations.

Preserve the exact registered launch path and trailing slash. Never use a signed authentication URL, thread-history link, preview URL or credential as the destination. Enter the agreed URL and fields through the supported editor, save, reopen and compare the persisted values. Keep an agreed new-window fallback when useful; do not weaken authentication, cookies or iframe protections.

## 4. Apply only approved chatbot changes

If setup changes are in scope, execute the approved fields through the available instructor UI, section by section, and read back each saved result. Use [chatbot setup](references/chatbot-setup.md) and [credits and publication](references/credits-and-publication.md) for the actual controls and safe stop conditions. Do not bypass a pending revision lock or switch to operator credentials.

Credits are a per-participant, per-chatbot allowance, not raw tokens, a fixed number of replies or money. A request for an exact token ceiling needs clarification; do not implement it by relabelling credits. Explain model choice, initial balance, additive refill, period, cap/carryover, depletion behaviour and separate owner funding before a proposed change.

Inspect the current UI and relevant release when instructions conflict. A repository branch, a configured deployment tag and observed production behaviour are different evidence. For an already published bot in the reviewed revision flow, saving stages changes, submission requests review, approval activates the reviewed revision, and owner preview uses the **live** configuration. An unpublished draft can update its live-labelled summary on save without gaining participant access. Do not submit a request or claim publication merely because saving succeeded.

## 5. Save, reopen and verify actual access

Use [verification and recovery](references/verification-and-recovery.md). Read back saved fields after reopening. A chat shell or old conversation is not success: with permission for a small synthetic test, require a completed new answer through each retained route and record the visible cost and source behaviour where relevant.

First-time learner access is an optional additional check only when a suitable authorised separate account is already available. It is not a prerequisite or blocker for instructor setup, skill development, installation or contribution. An owner login in OLAT participant preview does not establish a new student's access. Do not request student credentials, inspect participant conversations, accept terms for another person, sign out the owner or create test identities merely to complete this optional check.

If publishing is authorised, inspect OLAT's change selection and publish only the agreed scope. Recheck the ordinary learner-facing course. If unrelated edits cannot be separated, pause that step and explain the conflict. Otherwise deliver the saved draft and state that it is not yet published.

## 6. Report verified outcomes and limits

Keep configured, saved, submitted, approved, tested and published states separate. Record account category, route, mode/model, response, live/pending state and remaining access gaps. Use private evidence only in the user's chosen private location; public examples must be synthetic and contain no real course identifiers, credentials, signed URLs or conversations.

Recover from the observed error, not random URL changes. Do not repeat an unchanged failed attempt without new evidence. Preserve a working route and explain any operator prerequisite. Delete only authorised disposable test elements with the host's actual recovery/confirmation rules.

See [sources and version evidence](references/sources.md) for refresh points and [review scenarios](tests/scenarios.md) for behaviour checks. The offline tests verify URL construction; they do not certify a live integration.
