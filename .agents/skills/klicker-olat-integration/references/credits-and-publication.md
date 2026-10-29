# Credits, model access and publication

## Decide what the allowance means

Keep the published bot's working allowance unless a change is requested or an
observed problem justifies a proposal. An OLAT integration does not require a
credit, model or funding change.

If the user asks for "tokens per student per week", first clarify the unit:

> Do you want a practical Klicker credit allowance, or an exact raw-token ceiling?
> I recommend keeping the existing credit allowance for the integration. The
> inspected controls for teaching staff do not implement an exact token ceiling.

Credits are not raw tokens, a fixed number of messages or a guaranteed amount of
money. The inspected runtime calculates consumption using model-specific input
and output rates, with additional processing where applicable. Conversation
length, model, reasoning and tools can change the cost. A displayed cost for one
short answer cannot establish a reliable question allowance. [Runtime accounting][accounting]

Ask only missing decisions, one at a time when a consequential choice needs
discussion; reuse answers already given:

- How many students and coaches will use this bot, and how many intensively?
- What learning activities, likely session lengths and course dates must it cover?
- Should teaching staff select a fixed model or allow learners to choose from an agreed
  set? Which reasoning levels are appropriate? Use the actual available models.
- How much starting credit, what refill amount and cadence, and what maximum
  balance should apply? Should unused credit carry forward within that cap?
- Is fallback behaviour acceptable when a participant exhausts the allowance?
  Does the user actually require a hard stop? Do not promise one if unavailable.
- Who is responsible for account funding, which model classes are approved, and
  is a separate owner budget in force? Do not confuse that with participant credit.
- Should the agent only propose the settings, save a revision, or also submit
  that specific revision for review? Respect existing explicit authorisation.

The course dates establish the planning period; they do not prove that a credit
policy automatically expires at the end of the course.

## Explain all four fields before a change

| Field           | Effect in the inspected implementation                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Initial credits | Starting balance when the participant's credit row for this bot is created. Changing it does not refill existing users.      |
| Reset period    | Calendar-based refill cadence: daily, weekly, biweekly, monthly or none. Read the next-refill time shown to the participant. |
| Reset amount    | Amount added at an eligible refill, rather than the target balance.                                                          |
| Max credits     | Maximum balance after a normal refill; unused credit can carry forward up to this value.                                     |

Balances are keyed by **participant and chatbot**, not by course alone and not
by a shared class pool. The normal refill calculation is
`min(current balance + reset amount, maximum)`. The inspected path applies one
normal refill when it detects an expired period; do not promise accumulated
refills for every missed week. [Balance and refill implementation][refill]

For example, the synthetic policy **3 initial / +1 weekly / maximum 3** takes a
remaining balance of 0.4 to 1.4, or 2.6 to 3. It does not reset everyone to 1.
For 20 participants, the initial allocations sum to 60 credits, but that is
neither predicted consumption nor a bill. This example is not a default policy.

The inspected form accepts whole-number policy amounts: initial and maximum are
nonnegative; initial and refill cannot exceed maximum; an enabled refill is at
least 1. `None` normalises the refill amount to 0. Actual consumption may be
fractional. Check the current form instead of silently rounding a user's desired
allowance. [Validation][validation]

Calendar boundaries are UTC in the inspected implementation: weekly starts
Monday 00:00 UTC; monthly starts on the first day. Show the actual next-refill
time, rather than hard-coding a Swiss hour that changes with daylight saving.
[Period calculation][periods]

## Existing balances when a revision is approved

In the reviewed revision-based implementation, approval does not immediately
grant credits, clamp balances, replace participant rows or reset usage history.
The next ordinary refill uses the approved refill amount and maximum. Thus a
lower maximum may not immediately lower an existing displayed balance.

`None` disables future refills while preserving remaining credit. A changed
refill period starts from approval for eligibility purposes, preventing an
immediate extra refill caused solely by the period change. Unrelated edits do
not postpone the schedule. Explain these effects in a proposed change; never
try to "fix" them with direct balance or database edits. [Approval effects][revision-effects]

Before an authorised save, present the **current live tuple**, any **saved/pending
tuple**, the **proposed tuple**, affected audience and expected effect on existing
users. A request to integrate a bot is not permission to alter these values.
Seek explicit agreement to a consequential proposal when that agreement is
missing, without asking again for the same scope already authorised.

## Exhaustion, model policy and separate funding

At participant credit exhaustion, the inspected runtime can use a configured
fallback model. That means the allowance is not necessarily a hard stop.
Fallback availability still depends on the current model policy, deployment and
account entitlement; do not promise unrestricted continued service. Explain an
unavailable-model response separately from an LTI launch failure. [Runtime gates][runtime-gates]

Model selection, reasoning effort and account funding are related but different
choices. Verify the fixed model or learner allow-list and available reasoning
levels before estimating usage. Disabling learner selection does not by itself
prove that an automatic router is selected: the inspected UI also supports a
fixed chosen model. See [chatbot setup](chatbot-setup.md).

The owner-account mechanism is separate from each learner's balance and can
track usage by owner, usage class and month. Whether its budget is enforced is
deployment-specific. In the dated UZH configuration below, account-budget
enforcement is disabled, while model-class admission remains a separate check.
This is not evidence of unlimited funding, a universal subsidy, or permission to
enable additional models. [Account usage][account-usage] [Deployment flags][deployment-flags]

Where available to the account owner, inspect account settings for chat usage:
the reviewed screen shows subscription tier and separate Base/Advanced usage
lanes with budget, used, remaining and reset date. It is a read-only view and
is restricted to account-owner scope; delegated course-team access may not show
it. An absent view is not evidence that no account budget exists. [Owner usage view][owner-usage-view]

Use the current funding agreement and responsible contact. Do not infer a
currency conversion or subsidy from an older example. Do not change cost centres,
operator budgets, account entitlements, provider credentials or paid-model
access as part of an ordinary integration by teaching staff. Report the missing
prerequisite to the responsible operator when necessary.

## Save, submission and live configuration

Record the published/live status, saved revision identifier, pending-review
state, editing lock, live values and what the owner preview actually exercises.

In the reviewed revision flow, an owner can save and submit a versioned revision;
pending content is locked. An administrator approves the exact reviewed revision.
An already published chatbot keeps serving its approved configuration while the
revision waits. Owner preview exercises **live configuration**, not the saved
draft. Saving, requesting review and activation are distinct events.
[Revision contract][revision-contract] [Credit form save][credit-form]

For an **unpublished draft**, saved revision values can also appear in the top
summary labelled "Live configuration". The reviewed implementation mirrors these
values into unpublished bots; it does not thereby make them available to
participants. Read the DRAFT/publication status alongside the summary. This
differs from an already published bot, whose approved configuration is preserved
while a revision waits. [Draft saving][draft-save]

Reopen the page after saving, verify the displayed saved values and revision
state, and distinguish them from the live summary. On a stale-revision conflict,
reload and compare the other author's changes before proceeding; do not overwrite
them by retrying blindly. Do not withdraw another pending request merely to unlock
editing. A successful test of the live bot cannot verify a pending mode or policy.

A Klicker publication request and OLAT publication are separate actions. Review
the exact scope and consequences before either. Prepare any request text first;
transmit it only with explicit authorisation for that submission. If review is
pending, retain the working approved version and report the pending change
accurately. Do not seek administrative access to approve it yourself.

## Consent and access

Retain the actual platform disclaimer and current privacy information. Do not
describe conversations as unrecorded or guaranteed anonymous. Keep learner
submissions and private conversations out of reusable examples.

Acceptance is personal. Do not accept terms for a different participant or turn
on a data-transfer-consent bypass as a side effect of direct launch. Where the
embedded view cannot revisit a disclaimer decision, offer the supported direct
route for that person. Changed approved disclaimer content can require renewed
acceptance; include that consequence in a proposed edit. [Disclaimer effects][disclaimer-effects]

Account entitlement, bot publication, Klicker course participation and OLAT
visibility are separate gates. An owner preview, an anonymous quiz or a simulated
OLAT participant role does not establish first-time student access.

## Dated source boundary: 14 October 2026

The checked default branch was `fa920c84024cc251fd5f9f99e02982180c50ba77`.
Its UZH production configuration selected `v3.4.0-alpha.87` for chat, management
and backend. That tag resolves to `a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f`.
The tagged code contains the revision flow and credit editor; some source on the
default branch and the public tutorial described an older lifecycle. This
explains the apparent contradiction; it does not prove which image is running
or what a particular account can edit. [Configured image][deployment-version]

For a new run, record the observed UI and source/deployment version separately.
If they disagree, preserve the working integration and resolve the mismatch
before providing concrete mutation instructions. Use supported UI for teaching staff;
operator provisioning APIs, direct database writes and credentials are not
prerequisites for this skill.

[accounting]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/chat/src/app/api/chatbots/%5BchatbotId%5D/chat/route.ts#L2425-L2435
[refill]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/chat/src/utils/transactions.ts#L76-L140
[validation]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/packages/graphql/src/services/chatbotCreditPolicy.ts#L19-L69
[periods]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/chat/src/utils/creditPeriods.ts#L12-L61
[revision-effects]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/docs/adr/0043-review-chatbot-revisions-before-activation.md#L38-L48
[runtime-gates]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/chat/src/app/api/chatbots/%5BchatbotId%5D/chat/route.ts#L817-L879
[account-usage]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/chat/src/services/accountUsage.ts#L116-L151
[owner-usage-view]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/frontend-manage/src/components/user/ChatAccountUsageSettings.tsx#L14-L205
[deployment-flags]: https://github.com/uzh-bf/klicker-uzh/blob/fa920c84024cc251fd5f9f99e02982180c50ba77/deploy/env-uzh-prd/values.yaml#L238-L276
[revision-contract]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/docs/adr/0043-review-chatbot-revisions-before-activation.md#L14-L34
[credit-form]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/apps/frontend-manage/src/components/resources/chatbots/ChatbotCreditPolicy.tsx#L245-L268
[draft-save]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/packages/graphql/src/services/chatbots.ts#L1001-L1025
[disclaimer-effects]: https://github.com/uzh-bf/klicker-uzh/blob/a2f97e9c7bfe5ef6f2fa134b8189dccbdbd72a1f/docs/adr/0043-review-chatbot-revisions-before-activation.md#L50-L54
[deployment-version]: https://github.com/uzh-bf/klicker-uzh/blob/fa920c84024cc251fd5f9f99e02982180c50ba77/deploy/env-uzh-prd/values.yaml#L544-L703
