#!/bin/sh

set -eu

# shellcheck source=/dev/null
. "$(dirname "$0")/util/_app_dependencies_lib.sh"

confirm() {
	while true; do
		printf '%s [Y/n] ' "$1"
		read -r response
		case "$response" in
			[yY][eE][sS]|[yY]|'')
				return 0
				;;
			[nN][oO]|[nN])
				return 1
				;;
			*)
				printf '%s\n' 'Please answer y or n.'
				;;
		esac
	done
}

usage() {
	cat <<'EOF'
Usage: ./_run_app_dependencies.sh [local|cypress|test] [options]

Options:
  --profile <full|manage|pwa|chat|graphql|minimal>
  --apps <csv>
  --services <csv>
  --skip-build
  --skip-prisma
  --skip-schema-sync
  --no-proxy
  --dry-run
  --help
EOF
}

require_option_value() {
	option_name="$1"
	option_value="${2-}"

	case "$option_value" in
		''|--*)
			printf 'Missing value for %s\n' "$option_name" >&2
			exit 1
			;;
	esac
}

MODE='local'
PROFILE=''
APPS=''
SERVICES=''
SKIP_BUILD='false'
SKIP_PRISMA='false'
SKIP_SCHEMA_SYNC='false'
NO_PROXY='false'
DRY_RUN='false'

if [ $# -gt 0 ]; then
	case "$1" in
		local)
			MODE='local'
			shift
			;;
		test|cypress)
			MODE='cypress'
			shift
			;;
	esac
fi

while [ $# -gt 0 ]; do
	case "$1" in
		--profile)
			require_option_value "$1" "${2-}"
			PROFILE="$2"
			shift 2
			;;
		--apps)
			require_option_value "$1" "${2-}"
			APPS="$2"
			shift 2
			;;
		--services)
			require_option_value "$1" "${2-}"
			SERVICES="$2"
			shift 2
			;;
		--skip-build)
			SKIP_BUILD='true'
			shift
			;;
		--skip-prisma)
			SKIP_PRISMA='true'
			shift
			;;
		--skip-schema-sync)
			SKIP_SCHEMA_SYNC='true'
			shift
			;;
		--no-proxy)
			NO_PROXY='true'
			shift
			;;
		--dry-run)
			DRY_RUN='true'
			shift
			;;
		--help)
			usage
			exit 0
			;;
		*)
			printf 'Unknown option: %s\n' "$1" >&2
			usage >&2
			exit 1
			;;
	esac
done

if ! resolve_run_app_dependencies_plan \
	"$MODE" \
	"$PROFILE" \
	"$APPS" \
	"$SERVICES" \
	"$SKIP_BUILD" \
	"$SKIP_PRISMA" \
	"$SKIP_SCHEMA_SYNC" \
	"$NO_PROXY"; then
	printf 'Error: %s\n' "${PLAN_ERRORS:-failed to resolve startup plan}" >&2
	exit 1
fi

print_run_app_dependencies_plan

if [ "$DRY_RUN" = 'true' ]; then
	printf '%s\n' 'Dry run only. Exiting without side effects.'
	exit 0
fi

started_services=''
cleanup_called=0

cleanup() {
	if [ "$cleanup_called" -eq 0 ]; then
		cleanup_called=1
		if [ -n "$started_services" ]; then
			./_down.sh --services "$started_services"
		fi
	fi
}

trap cleanup INT TERM HUP EXIT

printf 'Platform: %s\n' "$PLAN_PLATFORM"
printf 'Using proxy service: %s\n' "$PLAN_PROXY_SERVICE"
printf 'Mode: %s\n' "$PLAN_MODE"

if [ "$PLAN_SHOULD_SYNC_SCHEMA" = 'yes' ]; then
	./util/sync-schema.sh
fi

if [ "$PLAN_SHOULD_CREATE_SSL" = 'yes' ]; then
	if ! ./util/_create_ssl_certificates.sh; then
		printf '%s\n' 'Warning: SSL certificate setup failed; continuing without generated certificates.' >&2
	fi
fi

if [ -n "$PLAN_COMPOSE_SERVICES" ]; then
	previously_running_services=$(docker compose ps --services --status running 2>/dev/null || true)
	previously_defined_services=$(docker compose ps --all --services 2>/dev/null || true)
	if ! docker compose up --build -d $PLAN_COMPOSE_SERVICES; then
		currently_running_services=$(docker compose ps --services --status running 2>/dev/null || true)
		currently_defined_services=$(docker compose ps --all --services 2>/dev/null || true)
		newly_running_services=$(subtract_list "$currently_running_services" "$previously_running_services")
		newly_defined_services=$(subtract_list "$currently_defined_services" "$previously_defined_services")
		started_services=$(resolve_union_list '' "$newly_running_services" "$newly_defined_services")
		printf '%s\n' 'Failed to start docker compose services' >&2
		exit 1
	fi
	currently_running_services=$(docker compose ps --services --status running 2>/dev/null || true)
	currently_defined_services=$(docker compose ps --all --services 2>/dev/null || true)
	newly_running_services=$(subtract_list "$currently_running_services" "$previously_running_services")
	newly_defined_services=$(subtract_list "$currently_defined_services" "$previously_defined_services")
	started_services=$(resolve_union_list '' "$newly_running_services" "$newly_defined_services")
fi

if [ -n "$PLAN_COMPOSE_SERVICES" ]; then
	bash .github/scripts/wait-for-infra.sh --services "$PLAN_COMPOSE_SERVICES"
fi

if [ "$PLAN_BUILD_ACTION" = 'prompt' ]; then
	if confirm 'Run pnpm run build?'; then
		pnpm run build
	else
		printf '%s\n' 'Skipping pnpm run build'
	fi
elif [ "$PLAN_BUILD_ACTION" = 'skipped' ]; then
	printf '%s\n' 'Skipping pnpm run build'
fi

if [ "$PLAN_SHOULD_CREATE_HATCHET_TOKEN" = 'yes' ]; then
	case "$PLAN_HATCHET_TOKEN_KIND" in
		cypress)
			printf '%s\n' 'Using cypress hatchet token script'
			./util/_create_hatchet_token_cypress.sh
			;;
		graphql)
			printf '%s\n' 'Using graphql hatchet token script'
			./util/_create_hatchet_token_graphql.sh
			;;
		both)
			printf '%s\n' 'Using local and graphql hatchet token scripts'
			./util/_create_hatchet_token.sh
			./util/_create_hatchet_token_graphql.sh
			;;
		*)
			printf '%s\n' 'Using local hatchet token script'
			./util/_create_hatchet_token.sh
			;;
		esac
fi

case "$PLAN_PRISMA_ACTION" in
	reset)
		printf '%s\n' 'Resetting Prisma database (pnpm run prisma:reset)'
		pnpm run prisma:reset -f || {
			printf '%s\n' 'Prisma reset failed' >&2
			exit 1
		}
		;;
	setup)
		if confirm 'Run Prisma database setup (pnpm run prisma:setup)?'; then
			printf '%s\n' 'Preparing Prisma database (pnpm run prisma:setup)'
			if pnpm run prisma:setup; then
				:
			else
				SETUP_STATUS=$?
				printf 'Prisma setup exited with status %s.\n' "$SETUP_STATUS"
				printf '%s\n' 'Assuming reset/seed were declined; preserving existing data and continuing.'
				printf '%s\n' 'Applying schema without reset (pnpm run --filter @klicker-uzh/prisma prisma:push)'
				pnpm run --filter @klicker-uzh/prisma prisma:push || printf '%s\n' 'Prisma push failed; you may need to run migrations manually.'
			fi
		else
			printf '%s\n' 'Skipping Prisma database setup'
		fi
		;;
esac

if [ -n "$PLAN_COMPOSE_SERVICES" ]; then
	docker compose logs -f $PLAN_COMPOSE_SERVICES
fi

cleanup
