# 6. Roll chat engine contract generations without negotiation

Status: Accepted

`chat-api` and its selected engine are separate services in one KlickerUZH
deployment, so a rolling release can temporarily run different revisions on
either side of the HTTP boundary. Exact single-version deployments would make
that interval unsafe, while automatic version negotiation or downgrade would
make the active behavior depend on startup order and hide configuration errors.

Contract generations therefore use ordinal names such as `v1`, `v2`, and
`v3`. During a rollover, an engine may temporarily serve the current and next
generation. `chat-api` is configured to one exact generation and never
negotiates or silently downgrades. The engine adds and passes conformance for
the new generation first, the deployment then switches `chat-api`, and the old
generation is removed only in a later deployment.

This requires engines to carry two bounded protocol implementations during a
rollover, but it gives each deployment an explicit, observable contract and a
safe rollback target without adopting semantic-version ranges or runtime
negotiation.
