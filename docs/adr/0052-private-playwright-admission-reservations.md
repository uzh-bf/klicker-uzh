# Keep paid Playwright admission outside candidate execution

Cloud admission must reserve a whole validation before runner selection. Exact
repository-variable tickets protect identity but cannot serialize monetary
reservations or survive operator bookkeeping errors. A private coordinator owns
the reservation state and authenticates trusted preparation through GitHub OIDC;
candidate jobs receive only the existing bounded execution decision.

Use a local SQLite database with transactional reservation writes for the first
single-owner deployment. Deployment, durable storage, backup and endpoint
exposure require a separate operator packet. A missing coordinator or unusable
identity preserves ordinary routing. Reservations survive response loss,
process restart and ticket expiry until complete reconciliation proves their
actual exposure. This favors temporary under-utilization over duplicate paid
admission. The ledger controls its own burst allocation, not unrelated account
spending or a provider's eventual invoice.

A polling allocator cannot reliably beat preparation. A public artifact or
repository variable is not the private transactional ledger. A shared application
database would couple CI scheduling to application credentials and availability.
The coordinator introduces an operational owner; automatic queue-triggered
activation remains a later decision after bounded burst qualification.

## Bounded Actions-only alternative

For operator-controlled sequential bursts, a prospective grant can name one
workflow ID and run number, immutable PR revisions and expiry. Trusted preparation
binds that grant to the actual run ID and first attempt through read-only forge
observations. A different event taking the number misses the grant; it does not
receive cloud permission. This avoids a shared claim store or an approval wait
inside normal CI. The ordinary-runner fallback remains available.

This alternative intentionally provides a weaker accounting contract: operators
must retain exposure and reconcile complete billing before issuing another grant.
Neither a single grant nor job timeouts constitute a transactional monetary cap.
Use the coordinator only when durable automatic reservation accounting is an
explicitly selected requirement. Its deployment is deferred for bounded bursts;
the existing implementation and its stronger guarantees are retained.
