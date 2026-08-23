# Catalyst access request

**Date:** 2026-08-23

## What changed

Non-Catalyst account owners can now request Catalyst access directly from the
Manage support dialog. The form collects an institution name (2–160 characters)
and intended-use description (20–2000 characters), sends one email to the fixed
support inbox `klicker@df.uzh.ch` with reply-to set to the account email, and
closes on success.

The public Catalyst page no longer links to the external MS Forms survey;
instead it directs signed-in users to Manage → support → "Request Catalyst
Access". The old link remains as a temporary fallback in the repository
constants until Layer 2 ships, then it will be removed separately.

## Authorization and privacy contract

- Only a user with `ACCOUNT_OWNER` login scope reaches
  `requestCatalystAccess`; delegated logins are rejected at the GraphQL gate.
- The recipient address is hard-coded server-side; users cannot choose or
  influence it.
- User-controlled text is trimmed and HTML-escaped before composition; the
  plain-text variant uses raw trimmed values.
- No request state, submitted text, or metadata is persisted to any database,
  Redis cache, log file, or analytics sink. Transport failures return a stable
  values-free `INTERNAL_SERVER_ERROR` without echoing content.
