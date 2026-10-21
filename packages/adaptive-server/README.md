# Adaptive server extension

Adaptive services, GraphQL type/field factories, operations and tests imported
from public KlickerUZH commit `493cf936c0225f9a4f3947513ea8943d9bd2863a`.
The imported AGPL-3.0 license is retained in [LICENSE](./LICENSE).

This is a source package compiled in the Klicker host. It is not a separately
running service and does not create a Prisma client or authenticate requests.
The host supplies its authenticated context and canonical Prisma client.
GraphQL factories accept the host builder and registered core type references.
The element command factory accepts the existing element service operations.
No host runtime module is imported during package initialization.

The type-only `@klicker-uzh/graphql/adaptive-*-types` exports describe these
host contracts. They must remain type-only: importing the host's GraphQL entry
point here would create a runtime initialization cycle.

Tests that exercise host lifecycle behavior use the explicit
`@klicker-uzh/adaptive-test-host` Vitest aliases supplied by Klicker's integration
configuration. Database-backed tests must run against a disposable test database,
not a demo or production database. The host codegen includes this package's
`src/graphql/ops` directory alongside its own operations.
