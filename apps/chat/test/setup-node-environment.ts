// Next installs AsyncLocalStorage on globalThis for its Node runtime
// (next/dist/server/node-environment-baseline). Vitest boots plain Node, so a
// Next server module that reaches for it throws E504 ("AsyncLocalStorage
// accessed in runtime where it is not available") unless another test file
// happened to pull the baseline in first. Mirror the baseline here so suite
// order cannot decide whether those modules work.
import { AsyncLocalStorage } from 'node:async_hooks'

if (typeof globalThis.AsyncLocalStorage !== 'function') {
  globalThis.AsyncLocalStorage = AsyncLocalStorage
}
