# LTI construction and browser execution

Checked 14 October 2026. This procedure is for instructors and teaching assistants with authoring rights. The existing published bot and the existing OLAT course remain the targets.

## Inspect before configuration

1. Read the published bot's linked **Open Chatbot** course link in the current management UI. Confirm the course and bot identities; a direct chat thread or owner-preview link is not this participant entry.
2. Read OLAT's course identity, lifecycle, audience rules and existing nodes. Reuse a suitable node within the agreed scope.
3. Inspect the current LTI provider instructions. The reviewed UZH route uses a separate **LTI page**, with **KlickerUZH** selected inside **LTI Version**.
4. Do not require native Chatbot selection in the KlickerUZH course element or a chatbot-specific “Copy OLAT LTI link” button. Those were not available as a verified UZH route during this review. A later supported feature can be considered when actually present.

The generic **LTI 1.0 / 1.1** form asks for Key and Password. Selecting the institutional **KlickerUZH** provider uses its configured LTI 1.3 registration and displays a Deployment ID. Do not copy that ID into the old Key field. If the provider is missing, stop configuration of that route and explain the institutional prerequisite; do not register a provider or invent secrets.

## Construct and check the URL

Establish the provider's exact registered launch base, the participant origin and course-specific chatbot route, and supported embed parameter from current UI and official sources.

The observed UZH form is:

```text
https://lti.klicker.uzh.ch?redirectTo=<URL-encoded destination>
```

With destination:

```text
https://pwa.klicker.uzh.ch/en/course/<course-uuid>/chatbot/<bot-uuid>?embed=true
```

Use the locale from the actual participant course link; it is not necessarily the bot's teaching language. Encode the complete destination exactly once. Preserve the exact registered LTI path and trailing slash.

From the skill folder:

```text
python scripts/build_launch_url.py --course-id <verified-course-uuid> --bot-id <verified-bot-uuid> --locale en
```

Both omitted origins select the dated UZH defaults. For another deployment, explicitly supply both:

```text
python scripts/build_launch_url.py --course-id <verified-course-uuid> --bot-id <verified-bot-uuid> --locale en --lti-base https://lti.example.edu/launch --participant-origin https://learn.example.edu
```

The participant origin contains no path or trailing slash. The LTI base may have the verified registered path/slash. The helper rejects invalid inputs rather than repairing a registration. It prints three URLs and does not contact a service or read credentials. Review its output before entering it; valid syntax does not prove the provider allows the destination.

Without Python, apply the same pattern using an available standard URL encoder, then decode the single `redirectTo` value to check it exactly equals the intended destination. Never use a signed login redirect, session token, thread history, owner preview or credential in this URL.

### Dated UZH diagnostic evidence

On 13 October 2026, `/lti?redirectTo=...` and `/?redirectTo=...` failed during authentication, while the configured origin followed immediately by `?redirectTo=...` worked. The tutorial's example and production registration differed. This is evidence about that registration, not a general prohibition on trailing slashes in LTI.

If authentication fails, inspect the registered base and actual error before one evidence-based correction. Do not brute-force variants or change institution-wide settings.

## Execute through the supported browser

Use the current environment's browser documentation. Bind the correct authenticated tab and inspect its current state. Locate controls by their visible labels/roles and inspect fresh state after navigation or actions; refresh iframe scope if needed. Do not retain old element numbers across changed pages.

1. Open the authorised course editor and the identified existing node, or create the agreed LTI page at its intended position.
2. Open **Page content** and select **KlickerUZH** in **LTI Version**.
3. Enter the reviewed launch URL and only the approved settings below.
4. Save. Wait for the UI's success or validation result; an issued click is not a successful save.
5. Leave and reopen the node, then compare every saved value with the approved proposal.
6. Open OLAT's course preview or permitted course run. Launch the actual node and follow the supported login/consent flow.
7. When authorised, send the small synthetic test and wait for a completed new response. Apply the [verification checklist](verification-and-recovery.md).
8. Publish only if separately within scope, inspect which edits would be included, and verify the ordinary course run.

If a control is disabled, inspect permission, lifecycle and pending-review explanations. Use documented UI input when a locator fails; do not inject hidden state, invoke undisclosed endpoints or bypass security.

| Field                                | Decision and effect                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| URL                                  | Exact provider base plus once-encoded course chatbot destination.                         |
| Deployment ID                        | Provided by the existing institutional registration, not a new secret to invent.          |
| Skip launch page                     | Immediate launch versus one extra launch page.                                            |
| Data-transfer acceptance, if offered | Separate from Skip launch page and the chatbot disclaimer; do not bypass silently.        |
| Display                              | Embedded in course (iFrame) or the agreed alternative.                                    |
| Transmit name/e-mail                 | Only the verified requirement for this node, after explaining and approving the transfer. |
| Additional attributes                | Only those required by current provider guidance.                                         |
| Transfer score / grading             | Leave off for ordinary support unless separately requested and supported.                 |
| Title/menu, visibility/access        | Agreed course language, location and audience; preserve unrelated access settings.        |

## New-window fallback and account linking

When agreed, create an **External page** opening **New browser window (source visible)** with the unsigned course-specific participant URL, without `embed=true`. It is an alternative delivery route, not proof of LTI account linking. Test it if retained.

A plain embedded External page can have different sandbox restrictions. A welcome screen with failing messages is not success. Do not remove iframe restrictions, weaken cookies/authentication or keep several unverified alternatives.

Preserve an existing **Manage Account** element. The official account-linking route may require e-mail transfer there; that is a separate purpose from optional identity fields on the chatbot node. New configuration requires a clear explanation and approval. Never require a student to configure the integration or ask the instructor to share student credentials.
