# Guided setup decisions

Start from the user's existing decisions and current UI. Inspect facts before asking: exact targets, current status, linked course, available controls, permissions and saved values. Ask each unresolved material decision separately, with a recommendation and the practical consequence. Do not make the instructor complete an irrelevant questionnaire.

## Choose the scope first

- **Explain or inspect:** no live changes or test messages.
- **Integrate the existing published setup:** preserve bot content, modes, model, allowance and funding; decide only the entry route, access and authorised verification/publication.
- **Review chatbot setup as well:** use [chatbot setup](chatbot-setup.md) and [credits](credits-and-publication.md) to propose supported improvements, then obtain approval for the specific changes.

An instruction to improve this skill does not execute it against the live course.

## Decision sequence

| Decision            | Ask only if unresolved                                                                                                             | Consequence / starting recommendation                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Learning purpose    | What should learners practise, and what should the bot avoid completing for them?                                                  | Align hints, explanations, quizzes and source use with learning outcomes; preserve existing modes unless review is in scope.                                                                                                                           |
| Targets and rights  | Which existing published bot and OLAT course? Who may change each?                                                                 | Confirm UI identities and roles; a shared link alone does not confer edit access.                                                                                                                                                                      |
| Audience and access | Which cohort/groups, languages and access dates?                                                                                   | OLAT visibility and Klicker authentication/access must both work. Quiz anonymity and leaderboard opt-in are not chatbot access permissions.                                                                                                            |
| Course association  | Is the bot linked to the intended Klicker course?                                                                                  | The reviewed editor fixes the linked course after creation. Do not reassign or recreate it silently; report a mismatch to the owner/operator.                                                                                                          |
| Account entry       | Will new learners use OLAT account linking, existing Klicker accounts, or another supported institutional route?                   | Preserve a working Manage Account element. Its separately justified e-mail transfer is not the same as optional chatbot fields.                                                                                                                        |
| Display             | Embedded chat with a new-window fallback, or window-only?                                                                          | Embedded chat preserves course context; a new window offers space and may help with login/consent. Test every route retained.                                                                                                                          |
| Launch page         | Show the OLAT launch page or open directly?                                                                                        | Direct launch removes an extra click. It does not waive data-transfer acceptance or the Klicker disclaimer.                                                                                                                                            |
| Identity transfer   | Which names/e-mail/attributes are actually required for this node?                                                                 | Propose only what the verified institutional route requires; explain the recipient and purpose before adding data transfer.                                                                                                                            |
| Bot setup           | Keep current modes, source scope and model policy, or review them?                                                                 | More reasoning or participant model choice can change latency, credit use and source behaviour. Check supported choices, not a hard-coded model list.                                                                                                  |
| Allowance           | Keep approved credits, or plan per-person/per-bot use?                                                                             | Review purpose, cohort, intensity, teaching period, desired unit, refill and cap with the credits reference; operator funding is separate.                                                                                                             |
| Verification        | May a small synthetic message consume credits? If an authorised learner test account is already available, should it also be used? | Learner-account testing is optional and never a prerequisite. Owner preview proves only that session; record untested first-login behaviour. Do not request student credentials, create accounts or send invitations merely to complete this workflow. |
| Release             | Save/test a draft, submit a bot revision, publish specified OLAT changes, or some combination?                                     | These are separate actions with different audiences and effects. Course lifecycle/access is also separate from publishing editor changes.                                                                                                              |

Recommend a saved integration draft, unchanged approved bot settings, an embedded route plus optional fallback, and minimum necessary identity transfer when the user has not yet chosen. These are suggestions, not defaults to apply automatically.

## The concrete review before changes

Fill the proposed-change section of [the record](../assets/integration-record.md):

1. Exact target and existing node to update, or justified new node.
2. Current → proposed values, including launch URL, display, launch/consent, identity and access rules.
3. Any bot revision fields: purpose, modes, sources, model/reasoning and all four credit fields.
4. Expected effect on learners, existing balances, pending review, operator funding and publication.
5. Test route/account category, small synthetic test and evidence location.
6. Approval already granted, newly required decisions and execution boundary.

Show the proposal before changing fields. Approval of the exact settings and action is sufficient; do not repeatedly ask “may I proceed?” after it has been given. If the target, cost, identity transfer, publication scope or other material consequence changes, clarify that new point first. Host-specific action-time confirmation requirements still apply.

A pending locked revision is not a reason to bypass review or write directly to the database. If approval is needed, prepare the clear request and obtain authority to submit it; do not contact the Klicker team merely because a page suggests doing so.
