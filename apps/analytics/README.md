# KlickerUZH Analytics

This service computes learning analytics for KlickerUZH, providing insights into student learning patterns and performance metrics.

## Requirements

- Python 3.12.x (e.g., installed through `asdf`)
- Node.js 20.x.x
- Poetry

## Setup

- The project uses Poetry for dependency management and environment isolation. Make sure you have Poetry installed before proceeding. Then run `poetry install` in this folder to prepare the virtual environment.
- The project uses PNPM to simplify the execution of scripts and to provide a watch mode for execution. Make sure that you have executed `pnpm install` in the repository before trying to run the commands below.
- Make sure that all `.prisma` files are available in `prisma/`. If this is not the case, run the `util/sync-schema.sh` script first.
- Make sure that a valid Python environment is used (3.12). If poetry tries to use an environment not matching specifications, the install command or script execution might fail. The Python binary to be used can be set expliticly using `poetry env use /Users/.../bin/python` (after which `poetry install` has to be run). Tools like `asdf` allow the clean management of multiple Python versions on a single machine.

## Available Commands

The following commands are available through PNPM:

- `pnpm generate` - Generate the Prisma client for database access in Python
- `pnpm main` - Run the analytics service
- `pnpm dev` - Start the service in watch mode for development
