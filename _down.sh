#!/bin/sh

set -eu

SERVICES=''

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

while [ $# -gt 0 ]; do
	case "$1" in
		--services)
			require_option_value "$1" "${2-}"
			SERVICES="$2"
			shift 2
			;;
		--help)
			printf '%s\n' 'Usage: ./_down.sh [--services "svc1 svc2"]'
			exit 0
			;;
		*)
			printf 'Unknown option: %s\n' "$1" >&2
			exit 1
			;;
	esac
done

if [ -n "$SERVICES" ]; then
	SERVICES=$(printf '%s' "$SERVICES" | tr ',' ' ')
	printf 'Stopping docker compose services: %s\n' "$SERVICES"
	docker compose stop $SERVICES
	docker compose rm -f $SERVICES
else
	printf '%s\n' 'Stopping docker compose stack (down)'
	docker compose down
fi
