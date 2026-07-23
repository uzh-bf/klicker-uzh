# KlickerUZH Analytics

This service computes learning analytics for KlickerUZH, providing insights into student learning patterns and performance metrics.

## Requirements

- Python 3.12.x (e.g., installed through `asdf`)
- Node.js 24.x.x
- uv

## Setup

- The project uses uv for dependency management and environment isolation. Make sure you have uv installed before proceeding. Then run `uv sync` in this folder to prepare the virtual environment.
- The project uses PNPM to simplify the execution of scripts and to provide a watch mode for execution. Make sure that you have executed `pnpm install` in the repository before trying to run the commands below.
- Make sure that all `.prisma` files are available in `prisma/`. If this is not the case, run the `util/sync-schema.sh` script first.
- Make sure that a valid Python environment is used (3.12). If needed, set the Python binary explicitly with `uv python pin 3.12` before running `uv sync`.

## Available Commands

The following commands are available through PNPM:

- `pnpm generate` - Generate the Prisma client for database access in Python
- `pnpm main` - Run the analytics service
- `pnpm dev` - Start the service in watch mode for development
