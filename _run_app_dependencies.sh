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

## Resolve platform and proxy
detect_platform
determine_proxy
echo "Platform: $PLATFORM"
echo "Using proxy service: $PROXY"

# copy the prisma schema for it to be available to python files
./util/sync-schema.sh

# On macOS, ensure local SSL certificates exist for Traefik
if [ "$PLATFORM" = "mac" ]; then
	./util/_create_ssl_certificates.sh || true
fi

# start postgres, redis, proxy, hatchet
docker compose up --build -d postgres redis_exec redis_cache "$PROXY" hatchet || {
	echo "Failed to start docker compose services" >&2
	exit 1
}

sleep 15

# create hatchet client token
./util/_create_hatchet_token.sh

docker compose logs -f

# If logs -f exits normally (or after Ctrl+C), ensure cleanup runs once
cleanup
