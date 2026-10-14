---
type: Solution
title: Make built Node ESM package imports explicit
description: Catch package-directory imports that TypeScript and Vitest accept but the production Node ESM loader rejects.
module: mcp-student
date: 2026-08-26
problem_type: runtime_error
severity: high
symptoms:
  - 'The student MCP container exited with code 1 immediately after startup.'
  - 'Node reported ERR_UNSUPPORTED_DIR_IMPORT for @apollo/client/core.'
  - 'TypeScript compilation and the package unit tests still passed.'
root_cause: 'Apollo Client 3 directory subpaths lack package exports, while TypeScript and Vitest resolved them more permissively than the production Node ESM loader.'
tags:
  - node
  - esm
  - apollo-client
  - mcp
  - docker
  - runtime
---

# Make built Node ESM package imports explicit

## Problem

The student MCP image built successfully but crashed before serving its health
endpoint. Its compiled GraphQL client retained directory imports for Apollo
Client 3 subpaths.

## Symptoms

- Kubernetes reported a `CrashLoopBackOff` with exit code 1.
- Node raised `ERR_UNSUPPORTED_DIR_IMPORT` for `@apollo/client/core`.
- TypeScript compilation and all package unit tests passed.
- Importing the emitted `dist/graphqlClient.js` reproduced the container error
  locally without credentials or backing services.

## What didn't work

- TypeScript's `NodeNext` check accepted the source import and preserved it in
  the emitted JavaScript.
- Vitest resolved the package directory through its own transform pipeline, so
  source-level tests did not exercise Node's production ESM resolver.
- A successful image build proved compilation and assembly only; it did not
  execute the emitted service module.

## Solution

Import Apollo Client 3 through the explicit ESM files
`@apollo/client/core/index.js` and
`@apollo/client/link/persisted-queries/index.js`. The student MCP build now
imports `dist/graphqlClient.js` with Node immediately after TypeScript emits it.
This is a credential-free runtime-resolution smoke at the same module seam that
failed in the container.

## Why this works

The explicit files exist in Apollo Client 3 and export the required symbols as
ES modules. Node no longer has to resolve a directory subpath without an
`exports` mapping. Running the emitted import during every package build makes
the image workflow fail before publication if a future dependency or import
change recreates the mismatch.

## Prevention

For unbundled Node ESM services, do not treat compilation or transformed unit
tests as runtime module-resolution proof. Add a fast Node import of the emitted
entrypoint or the smallest emitted module that loads all external imports.

The correction is in
[graphqlClient.ts](../../../apps/mcp-student/src/graphqlClient.ts), and the
build-time smoke is in
[package.json](../../../apps/mcp-student/package.json).
