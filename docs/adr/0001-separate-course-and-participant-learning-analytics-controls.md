---
type: Architecture Decision
title: Separate course and participant learning analytics controls
description: Keep course-level LA availability and participant-level LA choice as independent, durable controls.
timestamp: '2026-07-23'
tags:
  - analytics
  - privacy
---

# ADR 0001: Separate course and participant learning analytics controls

## Status

Accepted

## Context

Learning analytics is optional at both course and participant level. A lecturer must be able to disable and later re-enable analytics without changing normal course data, while a participant must be able to exclude their own past and future activity from subsequent analytics calculations.

## Decision

Course LA status and participant LA choice are independent, durable controls. Course LA is disabled by default; disabling it hides LA and deletes dedicated LA results without changing participant choices or operational course data. Re-enabling LA may recompute from normal data wherever the participant's saved choice permits it.

A participant choice applies prospectively when LA is first enabled or re-enabled by that participant. Opting out immediately hides and deletes participant-level LA results and excludes all of that participant's activity from future calculations. Existing aggregates remain until their normal recalculation.

Only a material disclosure change invalidates the acknowledged disclosure version. Until the participant chooses again, their activity is excluded from LA; renewed inclusion resets the effective inclusion time to the new acknowledgement, while editorial disclosure changes do not require another choice.

## Consequences

The system needs a current participant eligibility state, an effective inclusion time, a versioned disclosure acknowledgement, and enough audit history to explain the active choice. Every LA computation and read path must enforce both controls; ordinary teaching, feedback, grading, and gamification must not depend on them.
