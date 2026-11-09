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
