---
type: Decision Record
title: GraphML archive recovers the FalkorDB serving projection
description: Completed GraphML artifacts are durable; FalkorDB is reconstructible.
timestamp: '2026-08-10'
tags:
  - backend
  - knowledge-base
---

# 10. GraphML archive recovers the FalkorDB serving projection

Status: Accepted (2026-08-10)

FalkorDB is a reconstructible serving projection rather than the durable graph
record. Every completed graph build is archived as GraphML from the first
release, and operational recovery imports and validates that artifact before
Klicker repoints publication. The lecturer beta therefore does not require
FalkorDB high availability or database backup as its source of recovery.

This accepts a recovery interval after FalkorDB loss in exchange for simpler
beta operations. The GraphML archive, its retention policy, and the tested
restore path become production-critical; a non-empty restored graph is not
enough without build identity, source digest, provenance, and count checks.
