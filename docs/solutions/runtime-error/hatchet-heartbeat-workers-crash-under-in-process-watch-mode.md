---
type: Solution
title: Hatchet heartbeat workers crash under in-process watch mode
description: Keep watch protocols outside Hatchet worker threads by compiling with Rollup and supervising plain Node with nodemon.
module: hatchet-workers
date: 2026-07-19
problem_type: runtime_error
severity: high
symptoms:
  - 'Workers connect to Hatchet, then exit before processing jobs.'
  - 'TypeError: this.logger[message.type] is not a function'
  - "Failed running 'src/index.ts'. Waiting for file changes before restarting..."
root_cause: In-process TypeScript and Node watch protocols send non-Hatchet messages through the SDK heartbeat worker-thread channel.
tags:
  - hatchet
  - worker-threads
  - tsx
  - nodemon
  - devcontainer
---

# Hatchet heartbeat workers crash under in-process watch mode

## Problem

Both local Hatchet workers appeared to start and connect, then crashed before they could process LiveQuiz responses or scheduled work. This made the routed stack look healthy while its asynchronous behavior was unavailable.

## Symptoms

The workers logged `Connection established using LISTEN_STRATEGY_V2`, followed by `TypeError: this.logger[message.type] is not a function` in the SDK heartbeat controller and `Failed running 'src/index.ts'. Waiting for file changes before restarting...`.

## What Didn't Work

Clearing `process.execArgv` inside the application did not help because the watch runner overrides worker-thread startup and still injects its protocol. Replacing `tsx --watch` with Node's built-in `--watch` also failed because Node watch messages reached the same heartbeat listener.

## Solution

<<<<<<< HEAD
Compile each worker before startup, keep Rollup watching the TypeScript sources, and let nodemon supervise a plain `node` process for the emitted JavaScript. The general-worker scripts implement this split at `apps/hatchet-worker-general/package.json:36`; the response processor mirrors it at `apps/hatchet-worker-response-processor/package.json:33`.
||||||| parent of 9cd73014c (fix(hatchet): keep development workers alive)
=======
Compile each worker before startup, keep Rollup watching the TypeScript sources, and let nodemon supervise a plain `node` process for the emitted JavaScript. The general-worker scripts implement this split at `apps/hatchet-worker-general/package.json:36`; the response processor mirrors it at `apps/hatchet-worker-response-processor/package.json:34`.
>>>>>>> 9cd73014c (fix(hatchet): keep development workers alive)

## Why This Works

Hatchet may create its heartbeat thread inside an ordinary Node process, so that thread receives only the SDK's own `debug`, `warn`, and `error` messages. Rollup and nodemon watch from separate processes and never inject their watch protocol into Hatchet's worker-thread channel.

## Prevention

Keep the loader-free worker scripts documented in `docs/async-and-workers.md`. Runtime verification must observe both worker PIDs beyond the SDK's four-second heartbeat interval; a successful initial connection is not proof that the worker remains usable.
