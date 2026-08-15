---
type: Decision Record
title: GraphML archive follows the knowledge-base lifecycle
description: Retain successful graph versions with the KB and purge after deletion grace.
timestamp: '2026-08-10'
tags:
  - backend
  - knowledge-base
---

# 7. GraphML archive follows the knowledge-base lifecycle

Status: Accepted (2026-08-10)

Every successful GraphML version remains in the recovery archive while its
knowledge base exists. Deleting the KB starts a 30-day recovery grace period;
after that deadline, maintenance purges every archived graph for that KB.
Failed or incomplete builds do not become durable archive versions.

This retains simple, complete beta recovery history without keeping lecturer
content indefinitely after deletion. Long-term institutional archiving or a
different retention period requires a new decision before general availability.
