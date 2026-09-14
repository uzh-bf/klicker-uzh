# 43. Sonar analysis credentials stay out of contributor-controlled execution

## Status

Accepted

## Context

SonarCloud is the repository's maintainability and duplication analysis, and it
now consumes test coverage. Two properties of that analysis are hard to change
later without invalidating historic results.

First, the analysis needs a token that can upload to a project the repository
owns. Public pull requests from forks and pull requests opened by Dependabot
cannot receive repository secrets, so the token cannot be made available to
every event that wants analysis. A workflow that runs contributor-authored code
with that token in scope would let the contributor influence the upload, the
artifacts, or the credentials of a privileged run.

Second, SonarCloud reports coverage only for reports it is given. A report
produced from a different revision, or from a merge tree that does not match the
analyzed checkout, produces a metric that looks authoritative while describing
other source.

## Decision

- The analysis credential is issued only to the trusted analysis workflow, at the
  point of upload. Contributor-controlled execution never receives it: the
  analysis job checks out the revision as data and runs no contributor build,
  test, or lifecycle script.
- Where an event cannot receive the credential, the analysis fails closed with a
  named unavailable result instead of an authorization error, and the check is
  not made a required status for that route. Making SonarCloud required for
  untrusted routes requires a trusted analysis path that is reviewed first.
- Coverage is imported only when the producing run belongs to the analyzed head
  according to GitHub's run metadata and recorded the tested source tree it
  tested. A missing, pending, or unverified report is reported and left out, so
  coverage reads as not computed rather than as a satisfied metric, and
  mismatched identity fails the step.
- One analysis per revision and context remains authoritative: pull-request
  analysis evaluates the pull-request base, branch analysis evaluates the branch,
  and obsolete runs for the same pull request are cancelled.

## Consequences

Fork and Dependabot pull requests show a clear unavailable Sonar result until a
trusted analysis route covers them, and no Sonar result is treated as proof for
their merge. Coverage enforcement is deliberately not armed while the baseline is
unknown, because a coverage condition cannot be satisfied by absent data.

The scanner, the quality-gate wait, and the coverage import are only meaningful
together with a live Sonar project configuration, so their effective settings
remain a separate, authorized activation step rather than part of this record.
