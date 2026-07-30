---
type: Architecture Decision
title: De-identified learning analytics output
description: Restrict lecturer-facing LA to report-scoped labels, coarse metrics, and sufficiently large effective samples.
timestamp: '2026-07-23'
tags:
  - analytics
  - privacy
---

# ADR 0002: De-identified learning analytics output

## Status

Accepted

## Context

The current lecturer analytics API can return participant identifiers. Replacing them with stable pseudonyms would still permit linking across reports, while claiming anonymity would be inaccurate because a lecturer may recognize distinctive performance patterns from outside knowledge.

## Decision

Lecturer LA may expose report-scoped rows labeled "Student 1", "Student 2", and so on, but never direct identifiers, stable labels, free text, exact timestamps, item-level response sequences, rare attributes, or cross-report links. Student-level rows and filtered breakdowns require an effective sample size of at least five. Every aggregate reports its effective sample size, but lecturers do not receive opt-out counts, undecided counts, or participant choice status.

Terms must prohibit attempts to identify participants or combine LA with other data for that purpose. Product and legal text describe these rows as de-identified with safeguards against re-identification, not as guaranteed anonymous.

## Consequences

Suppression must run after every filter, including export coverage filters. Dashboards include eligible partial coverage and show the resulting sample size. LA exports default to complete coverage for the selected period and may include partial coverage only through an explicit option.

For the current whole-course performance view, the selected period starts at
`Course.startDate`. Coverage is derived from the participant's current
`learningAnalyticsIncludedFrom` boundary and is independent of activity
completion.
