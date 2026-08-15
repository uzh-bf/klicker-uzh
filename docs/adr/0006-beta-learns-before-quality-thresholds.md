---
type: Decision Record
title: The graph beta learns before quality thresholds gate it
description: Existing tests and the canary open beta; curated evaluation gates later widening.
timestamp: '2026-08-10'
tags:
  - backend
  - knowledge-base
---

# 6. The graph beta learns before quality thresholds gate it

Status: Accepted (2026-08-10)

Existing system testing and the internal production canary are sufficient to
open the feature as an explicitly labeled beta. Catalyst then builds a versioned
quality dataset of 30–50 reviewed, non-personal goldens from approved or
synthetic source documents and records local DeepEval and CI evidence. A new
quality threshold does not retroactively block the initial beta or ordinary
change requests.

This favors real lecturer feedback and representative production evidence over
delaying beta for a speculative threshold. In return, quality evidence gates
beta widening, general availability, and explicit graph-quality claims. Hosted
reporting remains separately gated on its data boundary.
