# Artifact starter styling

`styles.css` is generated from Tailwind CSS 4.3.3. Run
`pnpm --filter @klicker-uzh/artifact-pilot styles` after changing the supported
classes, then check parity with `pnpm --filter @klicker-uzh/artifact-pilot
styles:check`.

The generator reads the UZH blue/grey, primary, background and foreground values
from `apps/frontend-manage/src/globals.css`. It uses Source Sans 3 when installed
locally, then the browser's accessible system sans-serif stack. The generated
stylesheet has no font download or data URL. Generated rules are scoped under
`.uzh-artifact`, so the artifact does not load a stylesheet, font or other
resource from the network.

Supported starter utilities cover surface and text colors, responsive padding,
a centered constrained card, blue headings, form typography, rounded borders,
numeric results and visible keyboard focus. The exact candidates come from
`starter-style.mjs`; add a class there before using it in the renderer.

The canonical standalone document and `frame()` both inline the same
`styles.css`. The frame policy allows only that stylesheet's SHA-256 hash while
retaining `default-src 'none'`. The standalone starter source stays below
16 KiB.

## Generating a starter before save

LibreChat calls the internal `POST /v1/author` with its publisher bearer and
exactly `subject`, `requestId` (UUID v4) and `prompt` (up to 2,048 UTF-8 bytes).
The publisher maps the lecturer, validates the generated bond exercise, and
returns `200 {"html":"…"}`. Saving that exact HTML still uses `/v1/revisions`.
Only `/a` and `/frame` belong on the public ingress.

Authoring defaults off. Before setting `PILOT_AUTHORING_ENABLED=true`, verify
all of the following against the actual STG gateway deployment and current tariff.

- `PILOT_AUTHORING_LITELLM_BASE_URL` must equal
  `http://litellm.stg-litellm.svc.cluster.local:4000/v1` and
  `PILOT_AUTHORING_MODEL` must equal `aibuddy/azure/gpt-6-luna`.
- Verify the deployment ID behind the alias and the dedicated inference-only
  virtual key's model restriction, $2 cap and expiry. Supply that key as
  `PILOT_AUTHORING_LITELLM_KEY` (at least 32 characters, without whitespace,
  distinct from both publisher caller tokens). `ARTIFACT_EXPIRES_AT` also
  closes the route. Environment changes take effect on publisher restart.
- Verify one provider attempt per dispatch, with retries, fallbacks, parallel
  completions and ancillary billed calls disabled throughout the gateway.
  Confirm byte-level tokenization and at most 1,024 additional input tokens
  for framing, templates and JSON mode. The 768-token completion limit must
  include reasoning and all other billed output tokens.
- Verify rates, including markup, at or below $25 per million input tokens and
  $100 per million output tokens, with no additional fixed charges. These are
  admission ceilings. At most 4,096 input tokens and 768 completion tokens cost
  $0.1792 at those ceilings. Each dispatch permanently reserves 18 cents in
  PostgreSQL before the HTTP request. The $2 ledger permits up to 11 such
  dispatches and one outstanding request across the pilot.

## Authoring outcomes and reconciliation

Every committed reservation counts towards the $2 cap permanently. An exact
replay of a successful UUID returns its stored HTML. Reusing a completed UUID
with different content, or replaying one closed without HTML, returns `422`.
A complete single-attempt provider stop response with valid usage and invalid
exercise JSON also returns `422`. Only a new UUID may use the remaining budget.

`409` indicates an outstanding dispatch with a live PostgreSQL session lock
inside its 35-second deadline (the HTTP timeout is at most 30 seconds).
`423` means dispatch requires operator reconciliation. Lost delivery, an
incomplete or unexpected provider envelope, or an abandoned dispatch all
retain their debit. A publisher crash releases its session lock. Expiry of
the deadline also changes a hung request to `423` even if its session persists.
Neither event admits new work. Legacy rows with neither HTML nor a deadline start
locked. An exhausted allowance returns `429`.

On `423`, stop authoring on **all** publisher replicas and drain or terminate
their in-flight dispatches. During upgrade, retire older replicas before
enabling authoring. Use a single bounded lookup of the unresolved rows
(`html IS NULL AND closed_at IS NULL`) and the dedicated key's gateway/provider
records. Confirm the exact attempt has terminated, its single charge fits the
reservation, and no retry or fallback remains queued. If delivery, billing or
identity is still uncertain, leave the row locked and end the pilot at expiry.

After confirmation and after the deadline, close only the verified UUID in a
short operator transaction. Bind the UUID as `$1`.

```sql
UPDATE artifact_author_request
   SET closed_at = clock_timestamp()
 WHERE id = $1 AND closed_at IS NULL AND html IS NULL
   AND (live_until IS NULL OR live_until <= clock_timestamp())
 RETURNING id, reserved_cents;
```

Commit only when exactly the verified row and its original debit are returned.
Preserve its UUID, digest and reserved cents for deduplication and accounting.
A separate operator decision may enable new requests within the original
expiry and remaining allowance. Reconciliation never dispatches or retries.
