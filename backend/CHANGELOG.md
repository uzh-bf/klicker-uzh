# Changelog

## 1.1.0

- Breaking: Ensure that a redis cache is available before allowing to add responses (no longer optional)
- Integrate with in-memory redis storage for running instances
  - Hydrate redis storage with results hashes upon activation of a block
  - Increment response counts in redis on incoming responses (transaction-based)
  - Evaluate based on redis and/or mongo depending on the status of the session and question block
  - Persist results to mongo when a question block is closed
  - Persist and rehydrate the cache when pausing and continuing a session
- Upgrade express-rate-limit to 3.2.0, removing delaying options (only hard limit)
- Fix: Response deletion broken due to invalid resolving of promises
- Fix: Number of total responses not decremented upon deletion

## 1.0.2

- Fix: Redis page cache not purged correctly after activating the next block
- Disable rate limiting per default
- Upgrade dependencies

## 1.0.1

- Add a codeclimate config to make use of ESLint v4
- Upgrade dependencies

## 1.0.0

- Initial release
