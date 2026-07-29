---
type: Decision Record
title: Use a Klicker-specific CodeAPI principal source
description: Klicker identifies its CodeAPI tokens explicitly instead of reusing an unrelated authentication provenance.
timestamp: '2026-07-29'
status: accepted
---

# Use a Klicker-specific CodeAPI principal source

Klicker-minted CodeAPI tokens use `principal_source: klicker_jwt`, enabled through an environment-configurable CodeAPI allow-list. Reusing `openid_reuse` would avoid a small fork change but would give Klicker executions misleading identity and audit provenance.
