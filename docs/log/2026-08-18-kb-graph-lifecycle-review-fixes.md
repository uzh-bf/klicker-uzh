---
type: Log
title: KB graph lifecycle review fixes
description: Records the wiki updates that accompany the final-review fixes to KB graph retention, dispatch recovery, and chat scope tokens.
timestamp: '2026-08-18'
tags:
  - backend
  - knowledge-base
---

# 2026-08-18

- **Update**: [async-and-workers](../async-and-workers.md) now describes the KB
  graph retention split that the code actually implements. `maintain-kb-resources`
  retires the FalkorDB graph of a build that is neither active nor published after
  the 24-hour grace, keeps the GraphML export of any build that produced one, and
  purges every remaining export and graph only 30 days after the knowledge base
  was deleted, per [ADR 0015](../adr/0015-graphml-follows-kb-lifecycle.md). The
  same pass re-enqueues a `QUEUED` graph build stranded between its cost
  reservation and its task dispatch, and empty pending KBs are hard-deleted only
  when they never built a graph, so the per-build cost evidence that
  [ADR 0013](../adr/0013-klicker-reserves-and-settles-graph-cost.md) requires is
  never cascaded away.

- **Update**: [async-and-workers](../async-and-workers.md) and
  [graphql-api-layer](../graphql-api-layer.md) replace the promised "manual
  resolution" of an accepted-but-uncorrelated graph dispatch with the mechanism
  that exists: the worker asks the provider before parking the build, and the
  graph monitor retries that lookup on every tick, correlating a recovered run or
  releasing the reservation and the KB build slot once the provider definitively
  reports no run.

- **Update**: [async-and-workers](../async-and-workers.md) and
  [ci-and-deployment](../ci-and-deployment.md) record that the general worker's
  all-or-nothing `KB_GRAPH_*` startup gate is armed only by the ConfigMap-owned
  names, that the out-of-repo secret must carry
  `KB_GRAPH_HATCHET_CLIENT_TOKEN` before `hatchet.kbGraph.workflowName` is set,
  and that `hatchet.kbGraph.workflowName` and
  `backendGraphql.knowledgeGraph.host` must be set together or the chart fails to
  render.

- **Update**: [architecture-overview](../architecture-overview.md) lists the
  `knowledge-graph` and `kb-management` packages and names FalkorDB as the graph
  serving projection rather than the durable record.

- **Update**: [domain-model](../domain-model.md) states that the GraphML-to-
  FalkorDB restore path is not implemented yet (roadmap W4 step 6), so a FalkorDB
  loss currently means rebuilding from sources even though the archive is
  retained for the knowledge base's lifetime.
