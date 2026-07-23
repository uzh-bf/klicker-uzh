# Keep permission revocations fail-closed

`Permission` and entity ownership remain the source of truth, while `DerivedPermission` remains the authorization read model. Permission recomputation stays synchronous until measurements show that set-based SQL is insufficient; asynchronous propagation may then be used for grants only after durable dispatch, persistent failure reporting, reconciliation, and a database fence shared by mutations and workers prevent stale writes. Revokes and downgrades remain synchronous and fail-closed.
