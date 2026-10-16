---
title: Local evaluation
sidebar_label: Local evaluation
---

# Try KlickerUZH locally

**Use this environment for synthetic data and evaluation, not for a public server or retained teaching data.** It includes publicly documented test accounts, local-only secrets, an optional mock identity provider, and development services. Its database bootstrap resets and seeds marked disposable databases.

The commands below are **config-derived** from the repository's [devcontainer guide](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/.devcontainer/README.md), [lifecycle configuration](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/.devrouter.yml), and [bootstrap](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/.devcontainer/post-create.sh). They were not executed as a new end-to-end deployment when this guide was written.

## Prerequisites

- Git and a working Docker environment on your host
- Host-side Node.js and pnpm on `PATH` for the repository's pre-container dependency helpers; use the pins in `package.json` (currently Node `24.21.0`, pnpm `11.5.0`)
- [devrouter](https://github.com/rschlaefli/devrouter) and its supported DevPod/Docker setup, following that project's installation instructions. This repository pins devrouter `0.3.0`; use the pin in your checked-out revision
- Permission to complete the local routing/TLS setup, and network access for container images and package downloads
- Enough disk and memory for a large pnpm monorepo and multiple services. There is no published production capacity guarantee; build-time requirements differ from steady-state runtime requirements

No UZH Infisical account, external Edu-ID account, or Azure subscription is needed for the core evaluation. Mail is captured by MailHog; media uses Azurite, a local Azure Blob emulator. AI calls still need their own upstream configuration if you choose to enable them.

## Start a fresh checkout

Run on the host:

```bash
git clone --branch v3-ai https://github.com/uzh-bf/klicker-uzh.git
cd klicker-uzh
devrouter setup --yes
devrouter ensure . --profile manage,live-quiz,email
```

Review what the one-time setup installs/configures before running it. The `manage,live-quiz,email` selection starts the applications and workers for a live-teaching trial, plus MailHog, without opting into AI or the mock Edu-ID provider. Postgres, Azurite and Hatchet are base services. Omitting `--profile` selects the broader `standard` profile; explicit `full` also selects test-only capabilities.

`ensure` installs dependencies, builds packages, provisions the disposable test database, seeds fixtures, starts the selected processes and checks their routes. Allow the first cold build to finish. Use the **exact URLs printed by `ensure`**, particularly in linked worktrees where hostnames are namespaced.

1. Open the printed Manage URL and use delegated login with the local lecturer credentials in the repository's [test credentials section](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/AGENTS.md#test-credentials-local-seeded-db-only)
2. Open the printed PWA URL in another browser session. Use a seeded participant or the temporary participation flow
3. Create a small quiz, start a block, submit a response and verify both the result and live updates
4. Upload a synthetic image through the media library and confirm it appears in the participant view
5. Exercise an email-dependent flow and inspect MailHog. It captures messages locally; it does not deliver real email

For routing, profiles and local OIDC details, continue with the [devcontainer guide](https://github.com/uzh-bf/klicker-uzh/blob/v3-ai/.devcontainer/README.md). A locally working AI interface does not prove that an external ingestion service or a paid model provider is configured.

## Inspect and stop

Config-derived commands, from the same checkout:

```bash
devrouter exec . -- tail -n 100 /tmp/dev.log
devrouter stop .
```

Stopping preserves the checkout's data volumes. Reopening a retained volume does not make it disposable again. Do not use reset/seed commands, remove volumes, or manually add disposable-database markers to recover retained data. Use a new isolated evaluation checkout when in doubt.

## Before turning a trial into a service

Start a separate production deployment with clean databases and new secrets. Do not expose this stack to the internet, reuse the fixture credentials, use the mock identity provider, or enable production features by changing `NODE_ENV` to development. Follow [Production deployment](./production.md) and plan the first lecturer account before you build a retained instance.
