# Catalyst Repository Split Language

## KlickerUZH application

The single user-facing product, deployment, and release operated by one UZH
team. It is composed of separately deployable services in the public
KlickerUZH repository and the private Catalyst repository. Avoid describing
the repositories or services as separate applications or products.

## Chat host

The public `chat-api` service. It owns participant authentication,
authorization, canonical conversation state, model and credit policy,
attachments, MCP authorization, persistence, and engine invocation. Avoid
calling it an engine: it does not own generation strategy.

## Public engine contract

The canonical, repository-neutral HTTP contract owned by the public
KlickerUZH repository and implemented by every chat engine. Contract
generations use ordinal names (`v1`, `v2`, `v3`) rather than semantic
versions. Avoid treating the private Catalyst runtime schema as a second
contract authority.

## Contract generation

A complete, ordinal wire-protocol target such as `v1` or `v2`. During a
rollover an engine may serve the current and next generation, while the chat
host selects exactly one configured generation. Avoid compatibility ranges,
automatic negotiation, and silent downgrade.

## Default engine

The public AGPL engine that proves KlickerUZH remains independently runnable.
It implements the public engine contract without Catalyst tutoring policy,
private retrieval, or private orchestration.

## Catalyst engine

The private, stateless Mastra-based generation service. It implements the
public engine contract and does not access KlickerUZH's database, participant
cookies, credit state, or application secret.

## Delivery stack

An ordered set of independently reviewable pull-request layers within one
repository. The public and private repositories each have their own stack;
cross-repository dependencies are coordinated through explicit contract and
deployment gates, not represented as one Git stack.

## Feature stack

The complete ordered delivery path for one capability, potentially composed of
coordinated public and private repository-local stacks plus a deployment gate.
Learning analytics, tutoring, grading and feedback, content generation, and
adaptive learning do not collapse into one repository-wide pull request or
depend on one another merely because they share Catalyst tooling.

## Adaptive host

The public persistence, authorization, grading, attempt lifecycle, and UI/API
surface for adaptive learning. It calls a private adaptive engine for
psychometric computation while keeping KlickerUZH's database canonical. Avoid
moving user-facing adaptive product workflows or database ownership into the
engine.

## Adaptive engine

A private, stateless Catalyst service with its own ordinal contract. It owns
IRT estimation, calibration mathematics, item selection, stopping,
classification, and psychometric diagnostics. It consumes bounded item
metadata and graded observations and returns decisions for the adaptive host to
persist. It is separate from the chat and tutoring engines.

## Analytics host

The public orchestration and state boundary for learning analytics. It owns
course validity and finalization state, participant choices, dispatch, and
canonical status transitions. The private worker returns completion data and
writes analytics-owned derived tables; it does not update public `Course`
state directly.

## Knowledge-base control plane

The public management UI, backend API, permissions, resource lifecycle, and
generic graph read/visualization surfaces. Knowledge-graph generation is a
private Catalyst capability, but its current source repository is not the
public control plane.

## Source archive

A private exact Git reference that preserves imported source and authorship for
adaptation. It is evidence and recovery material, not the active implementation
line.

## Cutover

The deployment-wide configuration change that selects an engine only after the
public default path and the selected private engine pass the same contract and
end-to-end gates.

## MCP execution capability

One short-lived JWT minted by the chat host for one engine request. It names
the permitted server audiences, tools, run, token identifier, issuer, and
lifetime. The engine can forward this capability but cannot mint it; each MCP
service verifies the signature and claims before execution.
