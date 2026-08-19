## 2026-08-17

- **Update**: [feature-flags](../feature-flags.md) makes the deployment
  environment mandatory client configuration. An invalid non-empty value now
  prevents both browser and Node adapters from fetching a GrowthBook payload,
  so per-user rules and remote defaults cannot bypass the fail-closed contract.
- **Update**: [ADR 0008](../adr/0008-use-growthbook-for-feature-flags.md)
  assigns deployment-environment ownership to the adapters while keeping actor
  attributes request-scoped.
