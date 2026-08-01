---
module: course-qa
date: 2026-08-01
problem_type: security
severity: medium
symptoms:
  - 'A single IP could keep creating anonymous rate-limit events by rotating User-Agent values.'
  - 'The persistent DiscussionEvent table and fingerprint-scoped Redis keys grew after the IP limit was reached.'
root_cause: 'Fingerprint-specific counters and event writes ran before the coarse IP-window rejection.'
tags: [course-qa, anonymous-posting, rate-limiting, redis, discussion-events]
---

# Anonymous discussion rate limits allowed post-limit event churn

## Problem

Anonymous Course Q&A posting applies scope, course, and IP windows. The IP window is the coarse boundary for a client address, while the scope and course windows use a fingerprint that includes request metadata. When the fingerprint-specific checks ran first, one IP could rotate User-Agent values and continue reaching the IP check with fresh fingerprint counters. The result was repeated durable rejection events and unnecessary Redis keys after the IP limit had already made the request ineligible.

## Symptoms

The original IP-window test used a different User-Agent for each request and verified only the first IP-window event. That covered the first request over the limit, but not a repeated request using the same newly rotated fingerprint after the IP window had already rejected the address.

## What Didn't Work

Checking the scope and course counters before the IP counter did not provide a bounded rejection path. A fresh User-Agent reset those fingerprint-specific counters, so the second request with that User-Agent could still write another rejection event before the IP counter stopped it.

## Solution

The rate-limit enforcement now increments and checks the IP window before the fingerprint-specific scope and course windows in `packages/graphql/src/services/discussions/embeds.ts:177-204`. Once the IP limit is exceeded, the function writes at most the first IP-window event and returns before creating fingerprint-scoped counters or events. The regression in `packages/graphql/test/discussions/anonymous-rate-limits.suite.ts:362-402` repeats a post-limit request with the same User-Agent and asserts that the event count remains one. The same API-layer change also adds the upvote-order index declared in `packages/prisma/src/prisma/schema/discussion.prisma:89-91` and shipped in [PR #5263](https://github.com/uzh-bf/klicker-uzh/pull/5263).

## Why This Works

The IP counter is independent of the attacker-controlled fingerprint inputs, so it is the first durable decision point. Every request after the first over-limit request exits before touching the scope or course counters. User-Agent rotation can no longer create new post-limit event paths for the same IP and course.

## Prevention

Rate-limit regressions should cover both the first request over a coarse limit and repeated requests after that limit while changing and reusing fingerprint inputs. Integration execution requires the repository's real database, Redis, and Hatchet test configuration; local runs without those services are environment failures rather than evidence that the regression passed.
