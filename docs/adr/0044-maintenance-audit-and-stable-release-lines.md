# 44. Separate maintenance, audit integration and accepted stable source

## Status

Accepted — 2026-09-10, explicit task-owner decision. Supersedes branch convergence and production-source clauses in ADR 0007 and ADR 0028 (qualified RC branch).

## Context

Production artifacts differ from their chart source and later maintenance HEAD. Immediate AI-history convergence into stable would obscure the accepted application boundary. Audit schema advancement makes shared staging unsuitable for maintenance upgrade proof.

## Decision

`v3-ai` owns production maintenance and stabilization. `v3-audit` owns next-release integration and qualified integration-staging candidates. `v3` remains accepted stable application and trusted CI source. No premature AI application-history merge into `v3` is authorized.

Merge accepted stable changes into maintenance through normal ancestry, then carry accepted maintenance forward into audit. Preserve trusted-control fixes and applied migration bytes. Promote an explicitly qualified application snapshot into stable later.

The existing PRD Application will source reviewed chart/values from `v3-ai` only after approved handover. Application and migrator digests remain independently approved; branch HEAD is never release authority. STG continues tracking qualified `stg-release`, selecting candidates explicitly from `v3-audit`. Production-candidate qualification requires isolated mutable state and a production-compatible schema baseline.

## Consequences

This decision fixes policy, not live state. Shared merges, PRD source changes, selector writes, promotion and sync activation require exact cutover approval. Runtime and containment discrepancies block those effects. Trusted `v3` references and the GitHub default branch remain unchanged. Receipt validation must be enforced by the actual activation path before it establishes production authority separation.
