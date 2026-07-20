#!/bin/sh

# Detect platform once and derive settings from it.
# PLATFORM values: mac | windows | linux
detect_platform() {
	case "$(uname -s 2>/dev/null)" in
		Darwin)
			PLATFORM="mac"
			;;
		Linux)
			if [ -r /proc/version ] && grep -qiE "(microsoft|wsl)" /proc/version 2>/dev/null; then
				PLATFORM="windows" # WSL treated as Windows environment
			else
				PLATFORM="linux"
			fi
			;;
		*)
			PLATFORM="linux"
			;;
	esac
}

# Map proxy service from PLATFORM
determine_proxy() {
	case "$PLATFORM" in
		mac)
			PROXY="reverse_proxy_macos"
			;;
		windows)
			PROXY="reverse_proxy_wsl"
			;;
		*)
			PROXY="reverse_proxy_docker"
			;;
	esac
}

confirm() {
	while true; do
		printf "%s [Y/n] " "$1"
		read -r response
		case "$response" in
			[yY][eE][sS]|[yY]|"")
				return 0
				;;
			[nN][oO]|[nN])
				return 1
				;;
			*)
				echo "Please answer y or n."
				;;
		esac
	done
}

# Ensure docker services are stopped when the script exits or is interrupted
cleanup_called=0
cleanup() {
	if [ "$cleanup_called" -eq 0 ]; then
		cleanup_called=1
		./_down.sh
	fi
}

# Trap common termination signals (Ctrl+C and kill/TERM), hangups, and normal exit
trap cleanup INT TERM HUP EXIT

## Determine mode from first argument
# Modes:
# - local (default): normal dev and Playwright dependencies, no forced DB reset
# - cypress: Cypress dependencies, including Cypress Hatchet token + forced DB reset
MODE="local"
case "${1:-}" in
	test|cypress)
		MODE="cypress"
		;;
	""|local|dev|playwright)
		MODE="local"
		;;
	*)
		echo "Unknown mode: $1" >&2
		echo "Usage: ./_run_app_dependencies.sh [local|dev|playwright|test|cypress]" >&2
		exit 1
		;;
esac

## Resolve platform and proxy
detect_platform
determine_proxy
echo "Platform: $PLATFORM"
echo "Using proxy service: $PROXY"
echo "Mode: $MODE"

# copy the prisma schema for it to be available to python files
./util/sync-schema.sh

# On macOS, ensure local SSL certificates exist for Traefik
if [ "$PLATFORM" = "mac" ]; then
	./util/_create_ssl_certificates.sh || true
fi

# start postgres, redis, proxy, hatchet
./util/_run_with_infisical.sh --env dev docker compose up --build -d postgres redis_exec redis_assessment redis_cache "$PROXY" hatchet litellm || {
	echo "Failed to start docker compose services" >&2
	exit 1
}

# wait for infra (postgres, redis, hatchet) before proceeding
bash .github/scripts/wait-for-infra.sh

if confirm "Run pnpm run build?"; then
	pnpm run build
else
	echo "Skipping pnpm run build"
fi

# create hatchet client token (switch script for cypress/test mode)
if [ "$MODE" = "cypress" ]; then
	echo "Using cypress hatchet token script"
	./util/_create_hatchet_token_cypress.sh

	# reset prisma database after tokens are created
	echo "Resetting Prisma database (pnpm run prisma:reset)"
	pnpm run prisma:reset -f || {
		echo "Prisma reset failed" >&2
		exit 1
	}
else
	echo "Using local hatchet token script"
	./util/_create_hatchet_token.sh

	echo "Applying Prisma schema without reset (pnpm run --filter @klicker-uzh/prisma prisma:push)"
	pnpm run --filter @klicker-uzh/prisma prisma:push || {
		echo "Prisma push failed" >&2
		exit 1
	}

	if confirm "Run full Prisma database setup (destructive reset + seed via pnpm run prisma:setup)?"; then
		# prepare prisma database after tokens are created
		echo "Preparing Prisma database (pnpm run prisma:setup)"
		# prisma:setup may prompt for a destructive reset; if the user declines,
		# it exits non-zero. Treat that as "keep existing data" and continue.
		if pnpm run prisma:setup; then
			:
		else
			SETUP_STATUS=$?
			echo "Prisma setup exited with status $SETUP_STATUS."
			echo "Assuming reset/seed were declined; preserving existing data and continuing."
		fi
	else
		echo "Skipping Prisma database setup"
	fi
fi

docker compose logs -f

# If logs -f exits normally (or after Ctrl+C), ensure cleanup runs once
cleanup
