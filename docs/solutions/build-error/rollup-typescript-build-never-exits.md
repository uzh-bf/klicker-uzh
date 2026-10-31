---
type: Solution
title: Force One-Shot Rollup Builds to Exit After the TypeScript Plugin Closes
description: Stop concurrent Turbo builds from leaving a Rollup process alive after it has written its output.
module: build-tooling
date: 2026-10-20
problem_type: build_error
severity: high
symptoms:
  - 'A rollup -c build prints "created dist" and then never exits'
  - 'devcontainer post-create stalls in the Turbo package build and the dev servers never start'
  - 'The hung rollup process holds about 1,250 fs.watch and 125 fs.watchFile handles'
root_cause: 'TypeScript watch-program close() does not cancel a pending program update, which then recreates the file watchers'
tags:
  - rollup
  - typescript
  - turbo
  - devcontainer
---

# Force One-Shot Rollup Builds to Exit After the TypeScript Plugin Closes

## Problem

Fresh devcontainers stalled in `.devcontainer/post-create.sh` during the Turbo package build. Some Rollup builds, for example Grading, Knowledge Graph and Export, printed `created dist` and then waited forever. Turbo waited on them, so post-create never finished and the dev servers never started. Which packages hung varied between runs.

## Symptoms

The leaf `rollup -c` processes sat in `epoll_pwait`; `run-s`, `cross-env` and Turbo only waited on their children. Each hung process held an `inotify` descriptor. Through the Node inspector, `process.getActiveResourcesInfo()` reported about 1,250 `FSEventWrap` and 125 `StatWatcher` handles. A healthy one-shot build holds none.

## What Didn't Work

- Redirecting Turbo output to a log file with `</dev/null` did not help; the hang is not console back-pressure.
- Serializing Turbo would only shrink the race window and slow every bootstrap. Knowledge Graph and Export include their own directory in `tsconfig.json`, so their own build output can still trigger it.

## Solution

Every one-shot `rollup -c` script passes `--forceExit`. Rollup exits once it has written all outputs, even when a plugin leaves handles open. Watch scripts (`rollup -c --watch`) stay unchanged.

## Why This Works

`@rollup/plugin-typescript` runs a TypeScript watch program even for a one-shot build and closes it in `buildEnd`. A watched file change schedules a program update 250 ms later. TypeScript's `close()` clears the failed-lookup timer but not that update timer. When a change lands shortly before `buildEnd`, the timer fires after `close()`, rebuilds the program and registers a fresh set of watchers that nothing closes. Concurrent Turbo builds write to watched directories, so the race is common during post-create.

Deterministic reproduction: build a copy of Grading while touching `src/index.ts` every 20 ms. Plain `rollup -c` then hangs after `created dist`; `rollup -c --forceExit` exits in about two seconds.

Upstream: [microsoft/TypeScript#64450](https://github.com/microsoft/TypeScript/issues/64450) and the unreleased plugin fix [rollup/plugins#2025](https://github.com/rollup/plugins/pull/2025).

## Prevention

Add `--forceExit` to any new one-shot Rollup script that uses the TypeScript plugin. Remove the flags only after a plugin or TypeScript release clears the pending update timer on close.
