#!/bin/sh

detect_platform() {
	if [ -n "${KLICKER_PLATFORM_OVERRIDE:-}" ]; then
		PLATFORM="$KLICKER_PLATFORM_OVERRIDE"
		return 0
	fi

	case "$(uname -s 2>/dev/null)" in
		Darwin)
			PLATFORM='mac'
			;;
		Linux)
			if [ -r /proc/version ] && grep -qiE '(microsoft|wsl)' /proc/version 2>/dev/null; then
				PLATFORM='windows'
			else
				PLATFORM='linux'
			fi
			;;
		*)
			PLATFORM='linux'
			;;
	esac
}

determine_proxy() {
	case "$PLATFORM" in
		mac)
			PROXY='reverse_proxy_macos'
			;;
		windows)
			PROXY='reverse_proxy_wsl'
			;;
		*)
			PROXY='reverse_proxy_docker'
			;;
	esac
}

list_contains() {
	case " $1 " in
		*" $2 "*)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

append_unique() {
	current="$1"
	item="$2"

	if [ -z "$item" ]; then
		printf '%s\n' "$current"
		return 0
	fi

	if list_contains "$current" "$item"; then
		printf '%s\n' "$current"
	elif [ -n "$current" ]; then
		printf '%s %s\n' "$current" "$item"
	else
		printf '%s\n' "$item"
	fi
}

remove_item() {
	current="$1"
	item="$2"
	result=''

	for existing in $current; do
		if [ "$existing" != "$item" ]; then
			result=$(append_unique "$result" "$existing")
		fi
	done

	printf '%s\n' "$result"
}

subtract_list() {
	current="$1"
	to_remove="$2"
	result=''

	for existing in $current; do
		if ! list_contains "$to_remove" "$existing"; then
			result=$(append_unique "$result" "$existing")
		fi
	done

	printf '%s\n' "$result"
}

csv_to_words() {
	printf '%s' "$1" | tr ',' ' '
}

normalize_service_name() {
	case "$1" in
		proxy)
			printf '%s\n' "$PROXY"
			;;
		postgres|redis_exec|redis_assessment|redis_cache|hatchet|reverse_proxy_docker|reverse_proxy_macos|reverse_proxy_wsl)
			printf '%s\n' "$1"
			;;
		'')
			return 0
			;;
		*)
			return 1
			;;
	esac
}

map_profile_services() {
	case "$1" in
		full|manage|pwa)
			printf '%s\n' 'postgres redis_exec redis_assessment redis_cache proxy hatchet'
			;;
		chat)
			printf '%s\n' 'postgres redis_exec redis_cache proxy hatchet'
			;;
		graphql)
			printf '%s\n' 'postgres redis_exec redis_cache hatchet'
			;;
		minimal)
			printf '%s\n' 'postgres redis_exec'
			;;
		'')
			printf '%s\n' ''
			;;
		*)
			return 1
			;;
	esac
}

map_app_services() {
	case "$1" in
		manage|frontend-manage|frontend_manage|pwa|frontend-pwa|frontend_pwa|assessment|control|frontend-control|frontend_control)
			printf '%s\n' 'postgres redis_exec redis_assessment redis_cache proxy hatchet'
			;;
		chat)
			printf '%s\n' 'postgres redis_exec redis_cache proxy hatchet'
			;;
		graphql|backend|backend-docker|backend_docker|response-api|response_api)
			printf '%s\n' 'postgres redis_exec redis_cache hatchet'
			;;
		auth)
			printf '%s\n' 'postgres proxy'
			;;
		'')
			printf '%s\n' ''
			;;
		*)
			return 1
			;;
	esac
}

resolve_union_list() {
	base_list="$1"
	shift

	for raw in "$@"; do
		for item in $raw; do
			normalized_item=$(normalize_service_name "$item") || return 1
			base_list=$(append_unique "$base_list" "$normalized_item")
		done
	done

	printf '%s\n' "$base_list"
}

record_context_kind() {
	context_name="$1"

	if [ -z "$context_name" ]; then
		return 0
	fi

	PLAN_HAS_CONTEXT='yes'

	case "$context_name" in
		graphql|backend|backend-docker|backend_docker|response-api|response_api)
			PLAN_HAS_GRAPHQL_CONTEXT='yes'
			;;
		*)
			PLAN_HAS_NON_GRAPHQL_CONTEXT='yes'
			;;
	esac
}

resolve_run_app_dependencies_plan() {
	MODE_INPUT="$1"
	PROFILE_INPUT="$2"
	APPS_INPUT="$3"
	SERVICES_INPUT="$4"
	SKIP_BUILD_INPUT="$5"
	SKIP_PRISMA_INPUT="$6"
	SKIP_SCHEMA_SYNC_INPUT="$7"
	NO_PROXY_INPUT="$8"

	detect_platform
	determine_proxy

	PLAN_MODE="$MODE_INPUT"
	PLAN_PROFILE_INPUT="$PROFILE_INPUT"
	PLAN_APPS_INPUT="$APPS_INPUT"
	PLAN_SERVICES_INPUT="$SERVICES_INPUT"
	PLAN_SKIP_BUILD="$SKIP_BUILD_INPUT"
	PLAN_SKIP_PRISMA="$SKIP_PRISMA_INPUT"
	PLAN_SKIP_SCHEMA_SYNC="$SKIP_SCHEMA_SYNC_INPUT"
	PLAN_NO_PROXY="$NO_PROXY_INPUT"
	PLAN_PLATFORM="$PLATFORM"
	PLAN_PROXY_SERVICE="$PROXY"
	PLAN_ERRORS=''
	PLAN_WARNINGS=''
	PLAN_HAS_CONTEXT='no'
	PLAN_HAS_GRAPHQL_CONTEXT='no'
	PLAN_HAS_NON_GRAPHQL_CONTEXT='no'

	resolved_services=''
	has_selection='no'

	if [ -n "$PROFILE_INPUT" ]; then
		has_selection='yes'
		profile_services=$(map_profile_services "$PROFILE_INPUT") || {
			PLAN_ERRORS="unknown profile: $PROFILE_INPUT"
			return 1
		}
		resolved_services=$(resolve_union_list "$resolved_services" "$profile_services")
		record_context_kind "$PROFILE_INPUT"
	fi

	for app in $(csv_to_words "$APPS_INPUT"); do
		if [ -n "$app" ]; then
			has_selection='yes'
			app_services=$(map_app_services "$app") || {
				PLAN_ERRORS="unknown app: $app"
				return 1
			}
			resolved_services=$(resolve_union_list "$resolved_services" "$app_services")
			record_context_kind "$app"
		fi
	done

	for service in $(csv_to_words "$SERVICES_INPUT"); do
		if [ -n "$service" ]; then
			has_selection='yes'
			normalized_service=$(normalize_service_name "$service") || {
				PLAN_ERRORS="unknown service: $service"
				return 1
			}
			resolved_services=$(append_unique "$resolved_services" "$normalized_service")
		fi
	done

	if [ "$has_selection" = 'no' ]; then
		PLAN_SELECTION_SOURCE='default-full'
		default_services=$(map_profile_services 'full')
		resolved_services=$(resolve_union_list '' "$default_services")
		record_context_kind 'full'
	else
		PLAN_SELECTION_SOURCE='explicit'
	fi

	if [ "$NO_PROXY_INPUT" = 'true' ]; then
		resolved_services=$(remove_item "$resolved_services" "$PROXY")
		resolved_services=$(remove_item "$resolved_services" 'reverse_proxy_docker')
		resolved_services=$(remove_item "$resolved_services" 'reverse_proxy_macos')
		resolved_services=$(remove_item "$resolved_services" 'reverse_proxy_wsl')
	fi

	PLAN_COMPOSE_SERVICES="$resolved_services"
	PLAN_PROXY_SELECTED='no'
	if list_contains "$resolved_services" 'reverse_proxy_docker' || list_contains "$resolved_services" 'reverse_proxy_macos' || list_contains "$resolved_services" 'reverse_proxy_wsl'; then
		PLAN_PROXY_SELECTED='yes'
	fi

	PLAN_POSTGRES_SELECTED='no'
	PLAN_HATCHET_SELECTED='no'
	if list_contains "$resolved_services" 'postgres'; then
		PLAN_POSTGRES_SELECTED='yes'
	fi
	if list_contains "$resolved_services" 'hatchet'; then
		PLAN_HATCHET_SELECTED='yes'
	fi

	if [ "$PLAN_POSTGRES_SELECTED" = 'yes' ] && [ "$SKIP_SCHEMA_SYNC_INPUT" != 'true' ]; then
		PLAN_SHOULD_SYNC_SCHEMA='yes'
	else
		PLAN_SHOULD_SYNC_SCHEMA='no'
	fi

	if [ "$PLAN_PROXY_SELECTED" = 'yes' ] && [ "$PLATFORM" = 'mac' ]; then
		PLAN_SHOULD_CREATE_SSL='yes'
	else
		PLAN_SHOULD_CREATE_SSL='no'
	fi

	if [ "$PLAN_HATCHET_SELECTED" = 'yes' ]; then
		PLAN_SHOULD_CREATE_HATCHET_TOKEN='yes'
		if [ "$MODE_INPUT" = 'cypress' ]; then
			PLAN_HATCHET_TOKEN_KIND='cypress'
		elif [ "$PLAN_HAS_GRAPHQL_CONTEXT" = 'yes' ] && [ "$PLAN_HAS_NON_GRAPHQL_CONTEXT" = 'yes' ]; then
			PLAN_HATCHET_TOKEN_KIND='both'
		elif [ "$PLAN_HAS_GRAPHQL_CONTEXT" = 'yes' ] && [ "$PLAN_HAS_CONTEXT" = 'yes' ]; then
			PLAN_HATCHET_TOKEN_KIND='graphql'
		else
			PLAN_HATCHET_TOKEN_KIND='local'
		fi
	else
		PLAN_SHOULD_CREATE_HATCHET_TOKEN='no'
		PLAN_HATCHET_TOKEN_KIND='none'
	fi

	if [ "$PLAN_POSTGRES_SELECTED" = 'yes' ] && [ "$SKIP_PRISMA_INPUT" != 'true' ]; then
		if [ "$MODE_INPUT" = 'cypress' ]; then
			PLAN_PRISMA_ACTION='reset'
		else
			PLAN_PRISMA_ACTION='setup'
		fi
	else
		PLAN_PRISMA_ACTION='none'
	fi

	if [ "$SKIP_BUILD_INPUT" = 'true' ]; then
		PLAN_BUILD_ACTION='skipped'
	elif [ "$PLAN_HAS_CONTEXT" = 'yes' ]; then
		PLAN_BUILD_ACTION='prompt'
	else
		PLAN_BUILD_ACTION='none'
	fi

	return 0
}

print_run_app_dependencies_plan() {
	printf '%s\n' 'Resolved plan:'
	printf '%s\n' "- mode: $PLAN_MODE"
	printf '%s\n' "- platform: $PLAN_PLATFORM"
	printf '%s\n' "- proxy service: $PLAN_PROXY_SERVICE"
	printf '%s\n' "- profile: ${PLAN_PROFILE_INPUT:-none}"
	printf '%s\n' "- apps: ${PLAN_APPS_INPUT:-none}"
	printf '%s\n' "- services: ${PLAN_SERVICES_INPUT:-none}"
	printf '%s\n' "- selection source: $PLAN_SELECTION_SOURCE"
	printf '%s\n' "- docker compose services: ${PLAN_COMPOSE_SERVICES:-none}"
	printf '%s\n' "- schema sync: $PLAN_SHOULD_SYNC_SCHEMA"
	printf '%s\n' "- ssl certificates: $PLAN_SHOULD_CREATE_SSL"
	printf '%s\n' "- hatchet token: $PLAN_HATCHET_TOKEN_KIND"
	printf '%s\n' "- prisma: $PLAN_PRISMA_ACTION"
	printf '%s\n' "- build: $PLAN_BUILD_ACTION"
	printf '%s\n' "- cleanup: only newly started resolved services"
}
