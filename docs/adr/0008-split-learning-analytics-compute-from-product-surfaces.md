# 8. Split learning-analytics compute from product surfaces

Status: Accepted

Learning analytics is one KlickerUZH capability, but its Python computation
runtime and its product-facing data model, permissions, controls, and UI have
different repository and deployment ownership. Moving the whole feature would
make the private repository own public product state; leaving the compute
runtime public would defeat the Catalyst split. A fully read-only private role
would also be incorrect because the worker must persist derived analytics.

KlickerUZH therefore retains the Prisma schema and migrations, GraphQL
read/control surfaces, privacy choices, course validity and finalization state,
dispatch, documentation, and lecturer/student UI. The private
`apps/learning-analytics` service reads required public domain tables and
writes only analytics-owned derived tables through a least-privilege database
role. It returns structured completion data to the public host instead of
updating `Course` state directly. Its source history moves in reviewable
layers. Public `apps/analytics`, image workflows, and schema-copy tooling are
removed only after the private runtime and product surfaces pass the cutover
gates.

This keeps one database and one product contract while requiring explicit
schema pinning, drift checks, table-level privileges, and coordinated public
and private deployment changes.
