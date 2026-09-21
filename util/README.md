# Util Scripts

## Publish a reviewed chatbot

After completing the review, use `publish-chatbot.mjs` to approve one chatbot in
`PENDING_APPROVAL`. It calls the existing admin-only GraphQL mutation, which
rechecks the owner's AI publishing capability, preserves the first publication
time, and clears the review comment. It does not change account usage budgets.

Build `@klicker-uzh/graphql` first to generate the persisted-operation manifest.
The target backend must also be deployed with this PR's new approval operation;
production rejects operations absent from its manifest.

Set `KLICKER_API_URL` to the full GraphQL endpoint and inject
`KLICKER_ADMIN_TOKEN` (an existing admin JWT) through the approved secret operator
or the process environment. Do not put tokens in arguments or files.

```sh
node util/publish-chatbot.mjs --chatbot-id <chatbot-id>
node util/publish-chatbot.mjs --chatbot-id <chatbot-id> --apply
```

The default dry run only prints the target and intended action; it does not
contact the backend or validate eligibility. `--apply` sends one mutation. Missing
chatbots, non-admin callers, non-pending statuses, and revoked owner permissions
fail through the existing backend checks. On a timeout or failed response, check
the chatbot's current status before retrying: the write may already have succeeded.
