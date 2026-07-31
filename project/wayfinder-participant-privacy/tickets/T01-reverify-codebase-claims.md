# T01 — Re-verify the plan's 13 codebase claims against current v3

Label: `wayfinder:research`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: —

## Question

The plan's **Current Codebase Findings** table (line ~92) makes 13 claims about the
codebase, each with an evidence path. They were verified on 2026-07-06. Since then `v3`
has moved to Prisma 7 and Next 16, gained a devcontainer, and migrated its docs to a
wiki. Which claims are still true?

Produce a table marking each row **fresh**, **stale**, or **changed**, with a
`file:line` citation for each verdict. Where a claim is stale, state what is true now.

Known already: the LTI-launch-payloads row still says "LTI 1.1 still has a verification
TODO" — retired in PR #5260, merged as `7812fa71ce`. Treat that row as confirmed stale
and check whether its neighbours moved with it.

Pay particular attention to rows whose evidence sits in files this repo has since
reorganised, and to anything Prisma 7 changed about schema-level uniqueness or defaults.

## Resolution

<!-- filled in on close -->
