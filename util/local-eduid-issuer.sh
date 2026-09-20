#!/usr/bin/env bash
# Sourceable decisions for the devcontainer's local Edu-ID (OIDC) mock.
#
# The mock is a Compose service that shares the app container's network
# namespace, so a single issuer URL has to work for two callers: the host
# browser and the auth server inside this container. A routed issuer therefore
# needs the container hosts entry that maps the issuer host to Traefik, so
# discovery, token and JWKS requests use exactly the browser URL and the
# `id_token` issuer can match the configured provider. Docker's host-gateway is
# not reliable under the DevPod provider, which is why this writes the hosts
# entry instead of relying on an extra_hosts alias. The plain-localhost
# fallback needs no entry because the app already shares the mock's namespace.
#
# `local_eduid_wire` writes that hosts entry and sets the LOCAL_EDUID_* outputs;
# callers own environment and process changes. Decision points never abort the
# caller: a missing route or an unresolvable Traefik has to leave the rest of
# startup intact, so every outcome is reported as a state instead.

# local_eduid_selection_selects_mock: 0 when the selection contains the mock, 1
# when it does not, 2 for a malformed selection. An unset selection means the
# devrouter config default (`full`), which selects every registered resource.
local_eduid_selection_selects_mock() {
  local remaining="${DEVROUTER_PROFILE-}" component has_more

  [ -n "$remaining" ] || return 0
  while true; do
    if [[ "$remaining" == *,* ]]; then
      component="${remaining%%,*}"
      remaining="${remaining#*,}"
      has_more=yes
    else
      component="$remaining"
      has_more=no
    fi

    component="${component#"${component%%[![:space:]]*}"}"
    component="${component%"${component##*[![:space:]]}"}"
    [ -n "$component" ] || return 2
    case "$component" in
      full|eduid) return 0 ;;
    esac

    [ "$has_more" = yes ] || break
  done
  return 1
}

# local_eduid_resolve_traefik_ip: prints the Traefik address on the shared
# devnet network. Bounded retries absorb a slow network, and an exhausted
# lookup returns 1 instead of terminating a `set -e` caller.
local_eduid_resolve_traefik_ip() {
  local attempts="${LOCAL_EDUID_LOOKUP_ATTEMPTS:-5}"
  local sleep_seconds="${LOCAL_EDUID_LOOKUP_SLEEP_SECONDS:-1}"
  # shellcheck disable=SC2086 # intentional word splitting of the lookup argv
  local lookup="${LOCAL_EDUID_HOSTS_LOOKUP:-getent hosts devrouter-traefik}"
  local attempt address

  for attempt in $(seq 1 "$attempts"); do
    address="$($lookup 2>/dev/null | awk 'NR == 1 { print $1 }')" || address=""
    if [ -n "$address" ]; then
      printf '%s\n' "$address"
      return 0
    fi
    [ "$attempt" -eq "$attempts" ] || sleep "$sleep_seconds"
  done
  return 1
}

# local_eduid_point_host_at_ip <host> <address>: maps <host> to <address> in the
# container hosts file, replacing an earlier entry for the same host and leaving
# every other line untouched. Writes in place with `cat >`, because Docker
# bind-mounts /etc/hosts and replacing the file would detach the mount.
local_eduid_point_host_at_ip() {
  local host="$1" address="$2"
  local hosts_file="${LOCAL_EDUID_HOSTS_FILE:-/etc/hosts}"
  local tmp grep_status=0

  case "$host" in
    ''|*[!a-z0-9.-]*) return 2 ;;
  esac

  tmp="$(mktemp)" || return 1
  grep -v -E "[[:space:]]${host}\$" "$hosts_file" >"$tmp" 2>/dev/null ||
    grep_status=$?
  if [ "$grep_status" -gt 1 ]; then
    rm -f "$tmp"
    return 1
  fi
  if ! printf '%s\t%s\n' "$address" "$host" >>"$tmp"; then
    rm -f "$tmp"
    return 1
  fi
  if ! cat "$tmp" >"$hosts_file" 2>/dev/null; then
    rm -f "$tmp"
    return 1
  fi
  rm -f "$tmp"
  return 0
}

# local_eduid_wire <issuer_url>: decides whether the local mock supplies the dev
# Edu-ID provider and prepares the issuer host when it does. Outputs:
#   LOCAL_EDUID_STATE   enabled | external | not-selected | disabled | invalid
#   LOCAL_EDUID_REASON  detail for every state except `enabled`
local_eduid_wire() {
  local issuer="$1" selection_status=0 host address

  LOCAL_EDUID_STATE=invalid
  LOCAL_EDUID_REASON="unsupported profile selection '${DEVROUTER_PROFILE-}'"

  # A configured provider always wins: the mock is devcontainer-only wiring.
  if [ -n "${EDUID_CLIENT_SECRET:-}" ]; then
    LOCAL_EDUID_STATE=external
    LOCAL_EDUID_REASON='EDUID_CLIENT_SECRET is set'
    return 0
  fi

  local_eduid_selection_selects_mock || selection_status=$?
  case "$selection_status" in
    0) ;;
    1)
      LOCAL_EDUID_STATE=not-selected
      LOCAL_EDUID_REASON="profile '${DEVROUTER_PROFILE:-full}' does not select the mock"
      return 0
      ;;
    *) return 0 ;;
  esac

  case "$issuer" in
    https://*)
      host="${issuer#https://}"
      host="${host%/default}"
      case "$host" in
        ''|*[!a-z0-9.-]*)
          LOCAL_EDUID_STATE=disabled
          LOCAL_EDUID_REASON="unusable issuer host in '$issuer'"
          return 0
          ;;
      esac

      address="$(local_eduid_resolve_traefik_ip)" || {
        LOCAL_EDUID_STATE=disabled
        LOCAL_EDUID_REASON="devrouter-traefik is unresolvable, so '$host' cannot reach the routed issuer"
        return 0
      }
      local_eduid_point_host_at_ip "$host" "$address" || {
        LOCAL_EDUID_STATE=disabled
        LOCAL_EDUID_REASON="the container hosts file could not be updated for '$host'"
        return 0
      }
      ;;
    http://localhost:*|http://127.0.0.1:*)
      # Plain-localhost fallback: the browser uses the published port and the
      # app reaches the mock directly, so no hosts entry is involved.
      ;;
    *)
      LOCAL_EDUID_STATE=disabled
      LOCAL_EDUID_REASON="unsupported issuer URL '$issuer'"
      return 0
      ;;
  esac

  LOCAL_EDUID_STATE=enabled
  LOCAL_EDUID_REASON=''
  return 0
}
