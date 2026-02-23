# Hatchet Orchestrator

> **Classification note:** Hatchet is listed under External Systems because the orchestrator/server is deployed separately from the Klicker Helm chart (`deploy/charts/klicker-uzh-v3/`). Only the Hatchet _workers_ are deployed as part of the Klicker chart. In production, Hatchet is self-hosted in the same AKS cluster but managed in its own namespace/deployment. Locally, `hatchet-lite` runs via Docker Compose.

> TODO: content -- document server version, deployment method, and API URL configuration
