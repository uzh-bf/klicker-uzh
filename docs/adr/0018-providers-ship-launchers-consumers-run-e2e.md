---
type: Decision Record
title: Providers ship a launcher, consumers run the end-to-end test
description: An AI-infrastructure service exposes a supported local launcher for its own path; the consuming system's E2E runner invokes it instead of reproducing it.
timestamp: '2026-08-19'
tags:
  - backend
  - knowledge-base
---

# 18. Providers ship a launcher, consumers run the end-to-end test

Status: Accepted (2026-08-19)

ADR 0011 assigns cross-system knowledge-graph tests to Catalyst and leaves each
AI-infrastructure service responsible for its own provider contract. This record
fixes the seam those two halves meet at, because a cross-system test needs the
provider actually running and there are two ways to get there.

A provider exposes a supported, documented launcher that starts its own path
locally, with the flags and configuration knobs a caller needs and its own tests
and documentation. The consuming system's end-to-end runner invokes that
launcher. It does not assemble the provider's process set, construct the
provider's configuration, or carry a copy of either. A provider-side launcher
change lands and merges before the consumer package that depends on it, so the
consumer is written against a contract that already exists.

The alternative was tried and withdrawn. MR !119 in data-ingestion proposed
adding the Klicker graph harness to the provider repository, which put
consumer-owned behavior behind the provider's release boundary — the thing
ADR 0011 exists to prevent. The pressure that produced it is structural rather
than a one-time lapse: whoever writes the cross-system test is the party feeling
the missing setup, and the shortest path from there is always to add it where
they are standing. Naming the launcher as the provider's deliverable gives that
pressure somewhere legitimate to go.

Two consequences follow. A provider's shipped fixtures stay minimal and carry no
credential, so a consumer that needs capability a fixture deliberately withholds
supplies its own configuration directory rather than editing the provider's
fixture. And a capability the provider genuinely cannot offer locally stays
absent rather than being simulated: the consumer's runner records what its local
run does and does not prove, instead of relaxing a provider policy to make a
test pass.
