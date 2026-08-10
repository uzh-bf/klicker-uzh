---
type: Change Log
title: Biome Tier 1 Final Review Fixes
description: Correct the remaining lifecycle, nested-control, and duplicate-choice-key issues found in the exact-range final review.
timestamp: '2026-08-10'
tags:
  - frontend
  - graphql
  - accessibility
---

## 2026-08-10

**Update**

- Restored the live-quiz countdown's intentional cooldown lifecycle trigger and documented its narrow Biome suppression.
- Replaced nested `role="button"` rows with neutral containers and sibling primary/action controls in catalog, feedback, and leaderboard components.
- Exposed the existing choice index through evaluation GraphQL results and used it for stable evaluation-row keys when answer text is duplicated.
- Used the same choice index for shared evaluation chart cells and made plain-text Ellipsis line keys occurrence-aware when content repeats.
