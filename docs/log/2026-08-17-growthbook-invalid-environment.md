## 2026-08-17

- **Update**: [feature-flags](../feature-flags.md) requires adapters to
  normalize the deployment environment before initialization. An unset raw
  environment still uses the documented `development` or `NODE_ENV` fallback;
  an invalid non-empty value prevents both browser and Node adapters from
  fetching a GrowthBook payload, so per-user rules and remote defaults cannot
  bypass the fail-closed contract.
- **Update**: [ADR 0008](../adr/0008-use-growthbook-for-feature-flags.md)
  assigns deployment-environment ownership to the adapters while keeping actor
  attributes request-scoped.
