# 37. Standard activity formats

- **Status:** Accepted — 2026-08-23

## Context

Practice quizzes, microlearnings, and group activities were previously gated
behind the Catalyst paid tier. The product direction is to reserve Catalyst for
advanced capabilities — AI features and learning analytics among them — while
these three activity formats become freely available to all users.

ADR 0006 defined the public capability floor for Catalyst-dependent services.
This decision supersedes only the activity-entitlement statement in that record:
the three activity formats are no longer Catalyst-gated at creation or at any
lifecycle mutation.

## Decision

Practice Quiz, Microlearning, and Group Activity are standard capabilities. Any
authenticated user with full account access can create, edit, and manage them,
regardless of Catalyst entitlement.

The `catalyst` auth scope remains in the codebase for other current and future
Catalyst-gated surfaces (e.g., the course chatbot).
