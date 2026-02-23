# Analytics

Python batch workload for computing learning analytics (participant/course aggregates, progress, performance) from Klicker data and persisting the results back into PostgreSQL.

## Code

- App: `apps/analytics/`
- Entry point: `apps/analytics/src/main.py`
- Analytics modules: `apps/analytics/src/modules/`
- Batch scripts (initial backfills): `apps/analytics/src/scripts/`
- Container build: `apps/analytics/Dockerfile`
- Prisma schema sync into analytics: `util/sync-schema.sh`

## Responsibilities

- Compute participant analytics (daily/weekly/monthly) and course-level aggregates from raw responses.
- Compute additional derived metrics (progress, performance, aggregated views) using pandas.
- Persist computed analytics tables via the Prisma Python client.

## Dependencies

- **PostgreSQL**: source of raw data and sink for computed analytics (via Prisma client).
- **Prisma schema**: copied from `packages/prisma/src/prisma/schema/` into `apps/analytics/prisma/schema/` (excluding `js.prisma`).
- **pandas**: dataframe-based aggregation and time-window computations.

## Configuration (names only)

- `DATABASE_URL` — db

## Notes

- There is no Kubernetes/Helm deployment template for this workload in `deploy/charts/klicker-uzh-v3/templates/`; it is typically executed as a batch job (see `apps/analytics/_initialize_analytics_*.sh` and `apps/analytics/src/scripts/*.py`).
- This is the only Python workload in the monorepo; it uses the Prisma Python client (`prisma==0.15.0`).
- Related docs: `[[Azure Database for PostgreSQL]]`, `[[00-Component Catalog]]`.
