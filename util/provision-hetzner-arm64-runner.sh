#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

readonly ORGANIZATION='uzh-bf'
readonly ORGANIZATION_URL="https://github.com/${ORGANIZATION}"
readonly API_ROOT='https://api.github.com'
readonly RUNNER_VERSION='2.336.0'
readonly RUNNER_ARCHIVE="actions-runner-linux-arm64-${RUNNER_VERSION}.tar.gz"
readonly RUNNER_ARCHIVE_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${RUNNER_ARCHIVE}"
readonly RUNNER_ARCHIVE_SHA256='58b758e420b87093fbd4bfddd368074960053e2f1388f01848c82624b90f27d1'
readonly ADMIN_USER='runner-admin'
readonly RUNNER_USER='github-runner'
readonly RUNNER_DIR='/opt/actions-runner'
readonly STATE_DIR='/etc/actions-runner-bootstrap'
readonly STATE_FILE="${STATE_DIR}/bootstrap.env"
readonly SSH_HARDENING_FILE='/etc/ssh/sshd_config.d/00-actions-runner-hardening.conf'
readonly CLEANUP_SCRIPT='/usr/local/sbin/actions-runner-disk-cleanup'
readonly LOCK_FILE='/run/lock/actions-runner-bootstrap.lock'
readonly PUBLIC_PR_WORKFLOW='uzh-bf/klicker-uzh/.github/workflows/public-pr-playwright-shards.yml@refs/heads/v3'

MODE='plan'
PROFILE=''
RUNNER_NAME=''
RUNNER_GROUP=''
RUNNER_LABELS=''
VOLUME_MOUNT=''
CURRENT_STAGE='initial validation'
TEMP_DIR=''
GITHUB_TOKEN=''
REGISTRATION_TOKEN=''
APT_INDEX_UPDATED='false'
RUNNER_GROUP_ID=''

usage() {
  cat <<'EOF'
Provision one organization-scoped GitHub Actions runner on a fresh Hetzner VM.

Usage:
  provision-hetzner-arm64-runner.sh --profile PROFILE [--runner-name NAME]
  provision-hetzner-arm64-runner.sh --check --profile PROFILE --runner-name NAME [--volume-mount PATH]
  provision-hetzner-arm64-runner.sh --apply --profile PROFILE --runner-name NAME [--volume-mount PATH]

Modes:
  no mode             Print the selected profile plan. Makes no changes or network access.
  --check             Validate this host. Makes no changes and performs no network access.
  --apply             Interactively provision a fresh organization-scoped runner.

Options:
  --profile PROFILE   public-pr or trusted. Pool assignment is immutable.
  --runner-name NAME  public-pr-arm64-01 through -03, or
                      trusted-arm64-01 through -02 for the matching profile.
  --volume-mount PATH Use an already attached and mounted /mnt/HC_Volume_<id>.
                      Omit this option to use the VM's 80 GB local NVMe disk.
  -h, --help          Show this help.

Apply prompts for one short-lived GitHub token with organization Self-hosted
runners read/write permission on uzh-bf. The token is kept in memory only.
Apply also pauses so runner-admin SSH and sudo can be tested before root SSH
is disabled.
EOF
}

log() {
  printf '\n==> %s\n' "$*"
}

info() {
  printf '    %s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

write_file_from_stdin() {
  local mode=$1 owner=$2 group=$3 destination=$4
  local destination_dir destination_name temporary_file

  destination_dir=$(dirname -- "$destination")
  destination_name=$(basename -- "$destination")
  [[ -d "$destination_dir" && ! -L "$destination_dir" ]] ||
    die "managed file parent is missing or invalid: ${destination_dir}"

  temporary_file=$(mktemp "${destination_dir}/.${destination_name}.XXXXXX")
  if ! cat >"$temporary_file" ||
    ! chmod "$mode" "$temporary_file" ||
    ! chown "$owner:$group" "$temporary_file" ||
    ! mv -Tf -- "$temporary_file" "$destination"; then
    rm -f -- "$temporary_file"
    die "managed file could not be written: ${destination}"
  fi
}

cleanup() {
  GITHUB_TOKEN=''
  REGISTRATION_TOKEN=''
  if [[ -n "$TEMP_DIR" && -d "$TEMP_DIR" ]]; then
    case "$TEMP_DIR" in
      /tmp/actions-runner-bootstrap.*)
        rm -r -- "$TEMP_DIR"
        ;;
      *)
        printf 'Refusing to remove unexpected temporary path: %s\n' "$TEMP_DIR" >&2
        ;;
    esac
  fi
}

acquire_mutation_lock() {
  CURRENT_STAGE='exclusive provisioning lock'
  command -v flock >/dev/null 2>&1 || die 'flock is required for mutating modes'
  install -d -m 0755 -o root -g root /run/lock
  exec 9>"$LOCK_FILE"
  flock --nonblock 9 ||
    die 'another runner provisioning process is active; wait for it to finish and rerun'
}

on_error() {
  local exit_code=$?

  if ((BASH_SUBSHELL > 0)); then
    exit "$exit_code"
  fi
  printf '\nProvisioning stopped during: %s\n' "$CURRENT_STAGE" >&2
  printf 'No teardown was attempted. Correct the reported error and rerun the same command.\n' >&2
  exit "$exit_code"
}

trap cleanup EXIT
trap on_error ERR

require_tty() {
  [[ -r /dev/tty ]] || die 'interactive apply requires a terminal'
}

prompt_line() {
  local prompt=$1
  local default_value=${2-}
  local value

  require_tty

  if [[ -n "$default_value" ]]; then
    printf '%s [%s]: ' "$prompt" "$default_value" >/dev/tty
  else
    printf '%s: ' "$prompt" >/dev/tty
  fi
  IFS= read -r value </dev/tty
  printf '%s' "${value:-$default_value}"
}

prompt_secret() {
  local prompt=$1
  local value

  require_tty

  printf '%s: ' "$prompt" >/dev/tty
  IFS= read -r -s value </dev/tty
  printf '\n' >/dev/tty
  printf '%s' "$value"
}

require_confirmation() {
  local explanation=$1
  local phrase=$2
  local response

  printf '\n%s\n' "$explanation" >/dev/tty
  response=$(prompt_line "Type exactly: ${phrase}")
  [[ "$response" == "$phrase" ]] || die 'confirmation did not match; no changes were made'
}

parse_args() {
  local volume_mount

  while (($# > 0)); do
    case "$1" in
      --apply)
        [[ "$MODE" == 'plan' ]] || die 'choose only one mode'
        MODE='apply'
        shift
        ;;
      --check)
        [[ "$MODE" == 'plan' ]] || die 'choose only one mode'
        MODE='check'
        shift
        ;;
      --runner-name)
        (($# >= 2)) || die '--runner-name requires a value'
        RUNNER_NAME=$2
        shift 2
        ;;
      --profile)
        (($# >= 2)) || die '--profile requires a value'
        PROFILE=$2
        shift 2
        ;;
      --volume-mount)
        (($# >= 2)) || die '--volume-mount requires a value'
        volume_mount=$2
        [[ -n "$volume_mount" && "$volume_mount" != '/' ]] ||
          die '--volume-mount requires an attached Volume path'
        VOLUME_MOUNT=${volume_mount%/}
        shift 2
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        die "unknown option: $1"
        ;;
    esac
  done
}

configure_profile() {
  case "$PROFILE" in
    public-pr)
      RUNNER_GROUP='public-pr-arm64'
      RUNNER_LABELS='linux,arm64,docker,public-pr-arm64,playwright'
      ;;
    trusted)
      RUNNER_GROUP='trusted-arm64'
      RUNNER_LABELS='linux,arm64,docker,trusted-arm64'
      ;;
    *)
      die 'profile must be public-pr or trusted'
      ;;
  esac
}

validate_runner_name() {
  case "$PROFILE" in
    public-pr)
      [[ "$RUNNER_NAME" =~ ^public-pr-arm64-0[1-3]$ ]] ||
        die 'public-pr runner name must be public-pr-arm64-01 through -03'
      ;;
    trusted)
      [[ "$RUNNER_NAME" =~ ^trusted-arm64-0[1-2]$ ]] ||
        die 'trusted runner name must be trusted-arm64-01 through -02'
      ;;
  esac
}

validate_platform() {
  local architecture os_id os_version

  architecture=$(uname -m)
  [[ "$architecture" == 'aarch64' || "$architecture" == 'arm64' ]] ||
    die "unsupported architecture ${architecture}; expected ARM64"

  [[ -r /etc/os-release ]] || die '/etc/os-release is missing'
  os_id=$(awk -F= '$1 == "ID" {gsub(/"/, "", $2); print $2}' /etc/os-release)
  os_version=$(awk -F= '$1 == "VERSION_ID" {gsub(/"/, "", $2); print $2}' /etc/os-release)
  [[ "$os_id" == 'ubuntu' ]] ||
    die "unsupported OS ${os_id:-unknown}; expected Ubuntu"
  [[ "$os_version" == '24.04' || "$os_version" == '26.04' ]] ||
    die "unsupported Ubuntu version ${os_version:-unknown}; expected 24.04 or 26.04"
}

validate_root_keys() {
  local root_keys='/root/.ssh/authorized_keys'

  [[ -s "$root_keys" ]] ||
    die 'root has no authorized_keys; add and test your SSH key before applying'
  [[ ! -L "$root_keys" ]] || die 'root authorized_keys must not be a symlink'
}

validate_volume_mount() {
  local mounted_target available_kb check_path='/' storage_label='local disk'

  if [[ -n "$VOLUME_MOUNT" ]]; then
    [[ "$VOLUME_MOUNT" =~ ^/mnt/HC_Volume_[0-9]+$ ]] ||
      die 'volume mount must match /mnt/HC_Volume_<id>'
    mounted_target=$(findmnt -rn --mountpoint "$VOLUME_MOUNT" -o TARGET || true)
    [[ "$mounted_target" == "$VOLUME_MOUNT" ]] || die "${VOLUME_MOUNT} is not a mount point"
    [[ -w "$VOLUME_MOUNT" ]] || die "${VOLUME_MOUNT} is not writable by root"
    check_path=$VOLUME_MOUNT
    storage_label='attached volume'
  fi

  available_kb=$(df -Pk "$check_path" | awk 'NR == 2 {print $4}')
  ((available_kb >= 20 * 1024 * 1024)) || die "${storage_label} has less than 20 GB free"
}

state_value() {
  local key=$1
  awk -F= -v key="$key" '$1 == key {sub(/^[^=]*=/, ""); print; exit}' "$STATE_FILE"
}

validate_existing_state() {
  local stored_name stored_organization stored_profile stored_scope stored_group stored_storage stored_mount stored_service
  local expected_storage

  if [[ ! -e "$STATE_FILE" ]]; then
    if id "$ADMIN_USER" >/dev/null 2>&1 ||
      id "$RUNNER_USER" >/dev/null 2>&1 ||
      [[ -e "/etc/sudoers.d/${ADMIN_USER}" || -e "$SSH_HARDENING_FILE" ]] ||
      compgen -G '/etc/systemd/system/actions.runner.uzh-bf.*.service' >/dev/null; then
      die 'an unmanaged user, runner directory, or hardening file already exists; refusing adoption'
    fi
    if [[ -d "$RUNNER_DIR" ]] &&
      [[ -n "$(find "$RUNNER_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
      die 'an unmanaged runner directory already exists; refusing adoption'
    fi
    if command -v docker >/dev/null 2>&1 || [[ -e /etc/docker/daemon.json ]]; then
      die 'an unmanaged Docker installation or data directory already exists; use a fresh VM'
    fi
    if [[ -d /var/lib/docker ]] &&
      [[ -n "$(find /var/lib/docker -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
      die 'an unmanaged Docker data directory already exists; use a fresh VM'
    fi
    if [[ -n "$VOLUME_MOUNT" ]] &&
      [[ -e "${VOLUME_MOUNT}/docker" || -e "${VOLUME_MOUNT}/runner-work" ]]; then
      die 'the attached Volume already contains runner-managed paths; refusing adoption'
    fi
    return
  fi

  [[ -f "$STATE_FILE" && ! -L "$STATE_FILE" ]] || die 'managed state file is invalid'
  stored_name=$(state_value RUNNER_NAME)
  stored_organization=$(state_value ORGANIZATION)
  stored_profile=$(state_value PROFILE)
  stored_scope=$(state_value REGISTRATION_SCOPE)
  stored_group=$(state_value RUNNER_GROUP)
  stored_storage=$(state_value STORAGE_MODE)
  stored_mount=$(state_value VOLUME_MOUNT)
  stored_service=$(state_value SERVICE_INSTALLED)
  expected_storage='local'
  [[ -n "$VOLUME_MOUNT" ]] && expected_storage='volume'

  [[ "$stored_name" == "$RUNNER_NAME" ]] || die 'existing managed runner name differs'
  [[ "$stored_organization" == "$ORGANIZATION" ]] || die 'existing managed organization differs'
  [[ "$stored_profile" == "$PROFILE" ]] ||
    die 'runner profile is immutable; rebuild the VM to change pools'
  stored_scope=${stored_scope:-repository}
  [[ "$stored_scope" == 'organization' ]] ||
    die 'this VM contains a repository-scoped runner; rebuild the VM before organization registration'
  [[ "$stored_group" == "$RUNNER_GROUP" ]] || die 'existing managed runner group differs'
  [[ "$stored_storage" == "$expected_storage" ]] || die 'storage mode is immutable'
  [[ "$stored_mount" == "$VOLUME_MOUNT" ]] || die 'volume mount is immutable'
  [[ -z "$stored_service" || "$stored_service" == 'true' || "$stored_service" == 'false' ]] ||
    die 'managed service phase is invalid'
}

local_check() {
  validate_platform
  validate_root_keys
  validate_runner_name
  validate_volume_mount
  validate_existing_state
}

print_plan() {
  local storage_description='local NVMe (/var/lib/docker and runner _work)'
  local workflow_description='selected workflows from the selected private repositories'
  [[ -n "$VOLUME_MOUNT" ]] && storage_description="attached volume ${VOLUME_MOUNT} (Docker data and runner work only)"
  [[ "$PROFILE" == 'public-pr' ]] && workflow_description="only ${PUBLIC_PR_WORKFLOW}"

  cat <<EOF
Planned runner bootstrap (read-only):
  Registration: organization ${ORGANIZATION}
  Profile: ${PROFILE}
  Runner group: ${RUNNER_GROUP}
  Workflow policy: ${workflow_description}
  Runner name: ${RUNNER_NAME:-<prompt during --apply>}
  Labels: ${RUNNER_LABELS}
  Storage: ${storage_description}
  Admin user: ${ADMIN_USER}
  Service user: ${RUNNER_USER}

No changes were made. Run with --check for offline validation or --apply to
provision interactively. Keep the initial root SSH session open until the script
confirms that ${ADMIN_USER} works from a second terminal.
EOF
}

github_api() {
  local method=$1
  local path=$2

  {
    printf 'header = "Authorization: Bearer %s"\n' "$GITHUB_TOKEN"
    printf 'header = "Accept: application/vnd.github+json"\n'
    printf 'header = "X-GitHub-Api-Version: 2026-03-10"\n'
    printf 'user-agent = "hetzner-arm64-runner-bootstrap"\n'
    printf 'silent\nshow-error\nfail-with-body\n'
  } | curl --disable --config - --request "$method" "${API_ROOT}${path}"
}

preflight_github_api_access() {
  CURRENT_STAGE='GitHub API access preflight'
  github_api GET "/orgs/${ORGANIZATION}/actions/runner-groups?per_page=1&page=1" >/dev/null ||
    die 'runner-group listing failed; the token needs organization Self-hosted runners read permission'
  github_api GET "/orgs/${ORGANIZATION}/actions/runners?per_page=1&page=1" >/dev/null ||
    die 'organization runner listing failed; the token needs organization Self-hosted runners read permission'
}

update_apt_index() {
  if [[ "$APT_INDEX_UPDATED" == 'false' ]]; then
    apt-get update
    APT_INDEX_UPDATED='true'
  fi
}

install_github_validation_dependencies() {
  if command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    return
  fi

  CURRENT_STAGE='GitHub validation dependency installation'
  export DEBIAN_FRONTEND=noninteractive
  update_apt_index
  apt-get install -y ca-certificates curl jq
}

list_runners() {
  local endpoint=$1
  local page=1 page_json page_count
  local runners='[]'

  while ((page <= 100)); do
    page_json=$(github_api GET "${endpoint}?per_page=100&page=${page}") ||
      return 1
    jq -e '.runners | type == "array"' <<<"$page_json" >/dev/null || return 1
    page_count=$(jq '.runners | length' <<<"$page_json")
    runners=$(jq -c --argjson accumulated "$runners" \
      '$accumulated + .runners' <<<"$page_json")
    ((page_count < 100)) && break
    page=$((page + 1))
  done

  ((page <= 100)) || die 'runner listing exceeded 10,000 records; refusing an incomplete result'
  jq -n --argjson runners "$runners" '{runners: $runners}'
}

validate_runner_group_policy() {
  local groups_json group_json group_count repositories_json workflows
  local repository_count unexpected_repository_count allows_public workflow_repository_count

  CURRENT_STAGE='restricted runner-group validation'
  groups_json=$(github_api GET "/orgs/${ORGANIZATION}/actions/runner-groups?per_page=100&page=1") ||
    die 'runner-group listing failed; verify organization Self-hosted runners permission'
  jq -e '.runner_groups | type == "array"' <<<"$groups_json" >/dev/null ||
    die 'GitHub returned an invalid runner-group listing'
  [[ "$(jq '.total_count // 0' <<<"$groups_json")" -le 100 ]] ||
    die 'more than 100 runner groups exist; refusing an incomplete policy check'
  group_count=$(jq --arg name "$RUNNER_GROUP" \
    '[.runner_groups[] | select(.name == $name)] | length' <<<"$groups_json")
  ((group_count == 1)) || die 'the exact restricted runner group must exist once'
  group_json=$(jq -c --arg name "$RUNNER_GROUP" \
    '.runner_groups[] | select(.name == $name)' <<<"$groups_json")

  [[ "$(jq -r '.visibility // empty' <<<"$group_json")" == 'selected' ]] ||
    die 'runner group must use selected-repository visibility'
  jq -e '.default == false' <<<"$group_json" >/dev/null ||
    die 'runner group must not be the default group'
  jq -e '.inherited == false' <<<"$group_json" >/dev/null ||
    die 'runner group must be owned by this organization, not inherited'
  allows_public=$(jq -r '.allows_public_repositories // false' <<<"$group_json")
  if [[ "$PROFILE" == 'public-pr' ]]; then
    [[ "$allows_public" == 'true' ]] ||
      die 'public-pr group must allow selected public repositories'
  else
    [[ "$allows_public" == 'false' ]] ||
      die 'trusted group must not allow public repositories'
  fi
  [[ "$(jq -r '.restricted_to_workflows // false' <<<"$group_json")" == 'true' ]] ||
    die 'runner group must restrict access to selected workflows'
  workflows=$(jq -c '.selected_workflows // [] | sort' <<<"$group_json")
  [[ "$(jq 'length' <<<"$workflows")" -gt 0 ]] ||
    die 'runner group must allow at least one selected reusable workflow'

  RUNNER_GROUP_ID=$(jq -r '.id // empty' <<<"$group_json")
  [[ "$RUNNER_GROUP_ID" =~ ^[0-9]+$ ]] || die 'runner group has no valid numeric id'
  repositories_json=$(github_api GET \
    "/orgs/${ORGANIZATION}/actions/runner-groups/${RUNNER_GROUP_ID}/repositories?per_page=100&page=1") ||
    die 'selected repository listing failed for the runner group'
  repository_count=$(jq '.total_count // 0' <<<"$repositories_json")
  ((repository_count > 0 && repository_count <= 100)) ||
    die 'runner group must select between 1 and 100 repositories'
  if [[ "$PROFILE" == 'public-pr' ]]; then
    [[ "$workflows" == "$(jq -cn --arg workflow "$PUBLIC_PR_WORKFLOW" '[$workflow]')" ]] ||
      die "public-pr group must allow only ${PUBLIC_PR_WORKFLOW}"
    unexpected_repository_count=$(jq '[.repositories[] | select(.private != false)] | length' \
      <<<"$repositories_json")
    ((unexpected_repository_count == 0)) ||
      die 'public-pr group must contain only public repositories'
  else
    unexpected_repository_count=$(jq '[.repositories[] | select(.private != true)] | length' \
      <<<"$repositories_json")
    ((unexpected_repository_count == 0)) ||
      die 'trusted group must contain only private repositories'
    workflow_repository_count=$(jq --argjson workflows "$workflows" '
      [.repositories[].full_name] as $repositories
      | [$workflows[] | split("/.github/workflows/")[0] | select(. as $repository | $repositories | index($repository) == null)]
      | length' <<<"$repositories_json")
    ((workflow_repository_count == 0)) ||
      die 'trusted group workflows must belong to its selected private repositories'
  fi
}

inspect_local_registration() {
  local path present=0 registration_file

  LOCAL_REGISTRATION_STATUS='absent'
  for registration_file in .runner .credentials .credentials_rsaparams; do
    path="${RUNNER_DIR}/${registration_file}"
    if [[ -e "$path" || -L "$path" ]]; then
      ((present += 1))
      [[ -f "$path" && ! -L "$path" ]] ||
        die "local runner registration file ${registration_file} is not a regular file"
      [[ "$(stat -c '%U' "$path")" == "$RUNNER_USER" ]] ||
        die "local runner registration file ${registration_file} has unexpected ownership"
    fi
  done

  if ((present == 0)); then
    return
  elif ((present == 3)); then
    LOCAL_REGISTRATION_STATUS='complete'
  else
    die 'local runner registration files are incomplete; refusing automatic repair'
  fi
}

validate_github_access() {
  local organization_runners group_runners
  local organization_count organization_busy group_count
  local local_registered='false'

  CURRENT_STAGE='GitHub access validation'
  validate_runner_group_policy
  organization_runners=$(list_runners "/orgs/${ORGANIZATION}/actions/runners") ||
    die 'organization runner listing failed; verify Self-hosted runners permission'
  group_runners=$(list_runners \
    "/orgs/${ORGANIZATION}/actions/runner-groups/${RUNNER_GROUP_ID}/runners") ||
    die 'runner-group membership listing failed'
  organization_count=$(jq --arg name "$RUNNER_NAME" \
    '[.runners[] | select(.name == $name)] | length' <<<"$organization_runners")
  organization_busy=$(jq -r --arg name "$RUNNER_NAME" \
    '.runners[] | select(.name == $name) | .busy' <<<"$organization_runners")
  group_count=$(jq --arg name "$RUNNER_NAME" \
    '[.runners[] | select(.name == $name)] | length' <<<"$group_runners")
  inspect_local_registration
  [[ "$LOCAL_REGISTRATION_STATUS" == 'complete' ]] && local_registered='true'

  ((organization_count <= 1 && group_count <= 1)) ||
    die 'multiple GitHub runner records use this exact name'

  if ((organization_count == 0)) && [[ "$local_registered" == 'false' ]]; then
    :
  elif ((organization_count == 1 && group_count == 1)) &&
    [[ "$local_registered" == 'true' ]]; then
    [[ "$organization_busy" != 'true' ]] || die 'the existing organization runner is busy'
  else
    die 'the organization runner exists outside the exact group or only on one side'
  fi
}

mint_registration_token() {
  local registration_json

  inspect_local_registration
  [[ "$LOCAL_REGISTRATION_STATUS" == 'complete' ]] && return
  CURRENT_STAGE='GitHub registration-token preflight'
  registration_json=$(github_api POST "/orgs/${ORGANIZATION}/actions/runners/registration-token") ||
    die 'registration-token creation failed; the token needs organization Self-hosted runners write permission'
  REGISTRATION_TOKEN=$(jq -r '.token // empty' <<<"$registration_json")
  [[ -n "$REGISTRATION_TOKEN" ]] || die 'GitHub returned no registration token'
}

install_packages() {
  CURRENT_STAGE='Ubuntu package installation'
  export DEBIAN_FRONTEND=noninteractive
  update_apt_index
  apt-get install -y \
    ca-certificates \
    curl \
    docker.io \
    git \
    jq \
    openssh-server \
    sudo \
    unattended-upgrades \
    ufw
  systemctl enable --now unattended-upgrades.service
}

configure_host_firewall() {
  CURRENT_STAGE='host firewall configuration'
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow OpenSSH >/dev/null
  ufw --force enable >/dev/null
  ufw status | grep -Fxq 'Status: active' || die 'UFW did not become active'
  ufw status | grep -Eq '^(OpenSSH|22/tcp)[[:space:]]+ALLOW' ||
    die 'UFW does not allow SSH'
}

configure_users() {
  local root_keys='/root/.ssh/authorized_keys'

  CURRENT_STAGE='administration and runner user setup'
  if ! id "$ADMIN_USER" >/dev/null 2>&1; then
    useradd --create-home --shell /bin/bash "$ADMIN_USER"
  fi
  usermod --append --groups sudo "$ADMIN_USER"
  passwd --lock "$ADMIN_USER" >/dev/null
  install -d -m 0700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/${ADMIN_USER}/.ssh"
  install -m 0600 -o "$ADMIN_USER" -g "$ADMIN_USER" \
    "$root_keys" "/home/${ADMIN_USER}/.ssh/authorized_keys"
  install -d -m 0755 -o root -g root /etc/sudoers.d
  write_file_from_stdin 0440 root root "/etc/sudoers.d/${ADMIN_USER}" <<EOF
${ADMIN_USER} ALL=(ALL:ALL) NOPASSWD: ALL
EOF
  visudo -cf "/etc/sudoers.d/${ADMIN_USER}" >/dev/null

  if ! id "$RUNNER_USER" >/dev/null 2>&1; then
    useradd --system --create-home --home-dir "$RUNNER_DIR" --shell /bin/bash "$RUNNER_USER"
  fi
  passwd --lock "$RUNNER_USER" >/dev/null
  usermod --append --groups docker "$RUNNER_USER"
  install -d -m 0700 -o "$RUNNER_USER" -g "$RUNNER_USER" "$RUNNER_DIR"
}

verify_effective_ssh_hardening() {
  local effective_config

  /usr/sbin/sshd -t
  effective_config=$(/usr/sbin/sshd -T)
  grep -Fxq 'passwordauthentication no' <<<"$effective_config" ||
    die 'effective SSH configuration still permits password authentication'
  grep -Fxq 'kbdinteractiveauthentication no' <<<"$effective_config" ||
    die 'effective SSH configuration still permits keyboard-interactive authentication'
  grep -Fxq 'permitrootlogin no' <<<"$effective_config" ||
    die 'effective SSH configuration still permits root login'
  grep -Fxq 'allowtcpforwarding no' <<<"$effective_config" ||
    die 'effective SSH configuration still permits TCP forwarding'
  grep -Fxq 'x11forwarding no' <<<"$effective_config" ||
    die 'effective SSH configuration still permits X11 forwarding'
}

confirm_admin_login_and_harden_ssh() {
  local response addresses

  if [[ -e "$SSH_HARDENING_FILE" ]]; then
    if [[ "$(wc -l <"$SSH_HARDENING_FILE" | tr -d ' ')" != '5' ]] ||
      ! grep -Fxq 'PasswordAuthentication no' "$SSH_HARDENING_FILE" ||
      ! grep -Fxq 'KbdInteractiveAuthentication no' "$SSH_HARDENING_FILE" ||
      ! grep -Fxq 'PermitRootLogin no' "$SSH_HARDENING_FILE" ||
      ! grep -Fxq 'AllowTcpForwarding no' "$SSH_HARDENING_FILE" ||
      ! grep -Fxq 'X11Forwarding no' "$SSH_HARDENING_FILE"; then
      die 'managed SSH hardening file differs from the expected content'
    fi
    /usr/sbin/sshd -t
    systemctl reload ssh.service
    verify_effective_ssh_hardening
    return
  fi

  addresses=$(hostname -I 2>/dev/null || true)
  cat >/dev/tty <<EOF

Before root SSH is disabled, keep this session open and use a SECOND terminal:

  ssh ${ADMIN_USER}@<server-ip>
  sudo -n true

Candidate server addresses: ${addresses:-inspect the Hetzner console}
Only continue when both commands succeed in the second terminal.
EOF
  response=$(prompt_line 'Type exactly after the test succeeds: ADMIN LOGIN VERIFIED')
  [[ "$response" == 'ADMIN LOGIN VERIFIED' ]] ||
    die 'admin login was not confirmed; root SSH remains enabled'

  CURRENT_STAGE='SSH hardening'
  install -d -m 0755 -o root -g root /etc/ssh/sshd_config.d
  write_file_from_stdin 0644 root root "$SSH_HARDENING_FILE" <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
AllowTcpForwarding no
X11Forwarding no
EOF
  verify_effective_ssh_hardening
  systemctl reload ssh.service
  verify_effective_ssh_hardening
}

configure_docker() {
  local docker_data='/var/lib/docker'
  local cleanup_target='/'
  local existing_data_root=''
  local merged_config existing_config_normalized='' merged_config_normalized docker_root

  if [[ -n "$VOLUME_MOUNT" ]]; then
    docker_data="${VOLUME_MOUNT}/docker"
    cleanup_target="$VOLUME_MOUNT"
  fi

  CURRENT_STAGE='Docker configuration'
  install -d -m 0710 -o root -g docker "$docker_data"
  install -d -m 0755 -o root -g root /etc/docker
  if [[ -n "$VOLUME_MOUNT" ]]; then
    install -d -m 0755 -o root -g root /etc/systemd/system/docker.service.d
    write_file_from_stdin 0644 root root \
      /etc/systemd/system/docker.service.d/10-actions-runner-volume.conf <<EOF
[Unit]
RequiresMountsFor=${VOLUME_MOUNT}
EOF
  fi

  if [[ -s /etc/docker/daemon.json ]]; then
    jq empty /etc/docker/daemon.json || die 'existing Docker daemon.json is invalid JSON'
    existing_data_root=$(jq -r '."data-root" // empty' /etc/docker/daemon.json)
    if [[ -n "$existing_data_root" && "$existing_data_root" != "$docker_data" ]]; then
      die "existing Docker data-root ${existing_data_root} conflicts with ${docker_data}"
    fi
    merged_config=$(jq \
      --arg data_root "$docker_data" \
      '. + {"data-root": $data_root, "log-driver": "json-file", "log-opts": {"max-size": "50m", "max-file": "3"}}' \
      /etc/docker/daemon.json)
    existing_config_normalized=$(jq -Sc . /etc/docker/daemon.json)
  else
    merged_config=$(jq -n \
      --arg data_root "$docker_data" \
      '{"data-root": $data_root, "log-driver": "json-file", "log-opts": {"max-size": "50m", "max-file": "3"}}')
  fi

  merged_config_normalized=$(jq -Sc . <<<"$merged_config")
  systemctl daemon-reload
  if [[ "$existing_config_normalized" != "$merged_config_normalized" ]]; then
    systemctl stop docker.service docker.socket
    printf '%s\n' "$merged_config" |
      write_file_from_stdin 0644 root root /etc/docker/daemon.json
    systemctl daemon-reload
    systemctl enable docker.service
    systemctl restart docker.service
  else
    systemctl enable --now docker.service
  fi
  docker_root=$(docker info --format '{{.DockerRootDir}}')
  [[ "$docker_root" == "$docker_data" ]] ||
    die "Docker reports data root ${docker_root:-unknown}, expected ${docker_data}"
  if [[ -n "$VOLUME_MOUNT" ]]; then
    [[ "$(findmnt -rn --target "$docker_root" -o TARGET)" == "$VOLUME_MOUNT" ]] ||
      die 'Docker data root is not backed by the selected mounted Volume'
  fi

  write_file_from_stdin 0755 root root "$CLEANUP_SCRIPT" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail

readonly CHECK_PATH='${cleanup_target}'
usage_percent=\$(df -P "\$CHECK_PATH" | awk 'NR == 2 {gsub(/%/, "", \$5); print \$5}')
if ((usage_percent <= 80)); then
  exit 0
fi

/usr/bin/docker container prune --force --filter 'until=168h'
/usr/bin/docker image prune --force --filter 'until=168h'
/usr/bin/docker volume prune --all --force
/usr/bin/docker builder prune --force --filter 'until=168h' --keep-storage '10GB'
EOF

  write_file_from_stdin 0644 root root /etc/systemd/system/actions-runner-disk-cleanup.service <<'EOF'
[Unit]
Description=Threshold-based cleanup for a GitHub Actions runner
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/actions-runner-disk-cleanup
EOF

  write_file_from_stdin 0644 root root /etc/systemd/system/actions-runner-disk-cleanup.timer <<'EOF'
[Unit]
Description=Check GitHub Actions runner disk usage hourly

[Timer]
OnBootSec=30min
OnUnitActiveSec=1h
RandomizedDelaySec=10min
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now actions-runner-disk-cleanup.timer
}

write_managed_state() {
  local service_installed=${1-}
  local state_temp
  local storage_mode='local'
  [[ -n "$VOLUME_MOUNT" ]] && storage_mode='volume'
  if [[ -z "$service_installed" && -e "$STATE_FILE" ]]; then
    service_installed=$(state_value SERVICE_INSTALLED)
  fi
  service_installed=${service_installed:-false}
  [[ "$service_installed" == 'true' || "$service_installed" == 'false' ]] ||
    die 'managed service phase is invalid'

  CURRENT_STAGE='managed state recording'
  install -d -m 0700 -o root -g root "$STATE_DIR"
  state_temp=$(mktemp "${STATE_DIR}/bootstrap.env.XXXXXX")
  chmod 0600 "$state_temp"
  if ! {
    printf 'RUNNER_NAME=%s\n' "$RUNNER_NAME"
    printf 'ORGANIZATION=%s\n' "$ORGANIZATION"
    printf 'PROFILE=%s\n' "$PROFILE"
    printf 'REGISTRATION_SCOPE=organization\n'
    printf 'RUNNER_GROUP=%s\n' "$RUNNER_GROUP"
    printf 'STORAGE_MODE=%s\n' "$storage_mode"
    printf 'VOLUME_MOUNT=%s\n' "$VOLUME_MOUNT"
    printf 'RUNNER_VERSION=%s\n' "$RUNNER_VERSION"
    printf 'SERVICE_INSTALLED=%s\n' "$service_installed"
  } >"$state_temp"; then
    rm -f -- "$state_temp"
    die 'managed state could not be written'
  fi
  mv -Tf -- "$state_temp" "$STATE_FILE"
}

install_runner_archive() {
  local archive_path="${TEMP_DIR}/${RUNNER_ARCHIVE}"
  local runner_owner=''

  if [[ -x "$RUNNER_DIR/run.sh" ]]; then
    runner_owner=$(stat -c '%U' "$RUNNER_DIR/run.sh")
  fi

  if [[ -z "$runner_owner" || "$runner_owner" == 'root' ]]; then
    CURRENT_STAGE='verified GitHub runner download'
    curl --disable --fail --location --proto '=https' --tlsv1.2 --retry 3 \
      --output "$archive_path" "$RUNNER_ARCHIVE_URL"
    printf '%s  %s\n' "$RUNNER_ARCHIVE_SHA256" "$archive_path" | sha256sum --check --status

    tar --extract --gzip --no-same-owner --no-overwrite-dir \
      --file "$archive_path" --directory "$RUNNER_DIR"
    chmod 0700 "$RUNNER_DIR"
    [[ -x "$RUNNER_DIR/config.sh" && -x "$RUNNER_DIR/bin/installdependencies.sh" ]] ||
      die 'downloaded runner archive is incomplete'
    "$RUNNER_DIR/bin/installdependencies.sh"
    chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"
  elif [[ "$runner_owner" == "$RUNNER_USER" ]]; then
    [[ -x "$RUNNER_DIR/config.sh" ]] ||
      die 'runner installation is incomplete; refusing an automatic replacement'
  else
    die 'runner installation has unexpected ownership'
  fi
}

render_runner_service() {
  local mount_requirement=$1
  local runner_service=$2

  cat <<EOF
[Unit]
Description=GitHub Actions Runner (${runner_service%.service})
After=network-online.target docker.service
Requires=docker.service
${mount_requirement}

[Service]
ExecStart=${RUNNER_DIR}/runsvc.sh
User=${RUNNER_USER}
WorkingDirectory=${RUNNER_DIR}
KillMode=process
KillSignal=SIGTERM
TimeoutStopSec=5min

[Install]
WantedBy=multi-user.target
EOF
}

validate_runner_service_assets() {
  local expected_unit=$1
  local runner_service=$2
  local unit_path="/etc/systemd/system/${runner_service}"

  [[ -f "$unit_path" && ! -L "$unit_path" ]] ||
    die 'managed runner service unit is missing or invalid'
  [[ "$(stat -c '%U:%G:%a' "$unit_path")" == 'root:root:644' ]] ||
    die 'managed runner service unit has unsafe ownership or mode'
  cmp --silent "$expected_unit" "$unit_path" ||
    die 'managed runner service unit differs from the expected content'
  [[ -f "$RUNNER_DIR/runsvc.sh" && ! -L "$RUNNER_DIR/runsvc.sh" ]] ||
    die 'runner service entrypoint is missing or invalid'
  [[ "$(stat -c '%U:%G:%a' "$RUNNER_DIR/runsvc.sh")" == "${RUNNER_USER}:${RUNNER_USER}:755" ]] ||
    die 'runner service entrypoint has unsafe ownership or mode'
  [[ -f "$RUNNER_DIR/.service" && ! -L "$RUNNER_DIR/.service" ]] ||
    die 'runner service marker is missing or invalid'
  [[ "$(stat -c '%U:%G:%a' "$RUNNER_DIR/.service")" == "${RUNNER_USER}:${RUNNER_USER}:644" ]] ||
    die 'runner service marker has unsafe ownership or mode'
  [[ "$(cat "$RUNNER_DIR/.service")" == "$runner_service" ]] ||
    die 'runner service marker differs from the expected service'
}

validate_effective_runner_service() {
  local drop_in_paths fragment_path
  local runner_service=$1
  local unit_path="/etc/systemd/system/${runner_service}"

  fragment_path=$(systemctl show "$runner_service" --property=FragmentPath --value)
  drop_in_paths=$(systemctl show "$runner_service" --property=DropInPaths --value)
  [[ "$fragment_path" == "$unit_path" ]] ||
    die 'systemd loaded the runner service from an unexpected path'
  [[ -z "$drop_in_paths" ]] ||
    die 'runner service has unmanaged systemd drop-ins'
}

register_and_start_runner() {
  local expected_unit mount_requirement='' runner_work runner_service
  local service_installed unit_path

  runner_work="$RUNNER_DIR/_work"
  runner_service="actions.runner.uzh-bf.${RUNNER_NAME}.service"
  unit_path="/etc/systemd/system/${runner_service}"
  if [[ -n "$VOLUME_MOUNT" ]]; then
    runner_work="${VOLUME_MOUNT}/runner-work"
    mount_requirement="RequiresMountsFor=${VOLUME_MOUNT}"
  fi
  install -d -m 0700 -o "$RUNNER_USER" -g "$RUNNER_USER" "$runner_work"

  inspect_local_registration
  if [[ "$LOCAL_REGISTRATION_STATUS" == 'absent' ]]; then
    CURRENT_STAGE='GitHub runner registration'
    [[ -n "$REGISTRATION_TOKEN" ]] || die 'registration token preflight was not completed'

    # The single-quoted child script intentionally expands only inside runuser.
    # shellcheck disable=SC2016
    printf '%s\n' "$REGISTRATION_TOKEN" | runuser -u "$RUNNER_USER" -- \
      bash -c '
        set -Eeuo pipefail
        IFS= read -r registration_token
        cd "$1"
        ./config.sh \
          --unattended \
          --no-default-labels \
          --url "$2" \
          --token "$registration_token" \
          --name "$3" \
          --labels "$4" \
          --work "$5" \
          --runnergroup "$6"
        registration_token=""
      ' bash "$RUNNER_DIR" "$ORGANIZATION_URL" "$RUNNER_NAME" "$RUNNER_LABELS" "$runner_work" "$RUNNER_GROUP"
    inspect_local_registration
    [[ "$LOCAL_REGISTRATION_STATUS" == 'complete' ]] ||
      die 'runner registration completed without all required local files'
    REGISTRATION_TOKEN=''
  fi

  CURRENT_STAGE='GitHub runner service installation'
  expected_unit="${TEMP_DIR}/${runner_service}"
  render_runner_service "$mount_requirement" "$runner_service" |
    write_file_from_stdin 0600 root root "$expected_unit"
  install -d -m 0755 -o root -g root /etc/needrestart/conf.d
  write_file_from_stdin 0644 root root /etc/needrestart/conf.d/actions_runner_services.conf <<'EOF'
$nrconf{override_rc}{qr(^actions\.runner\..+\.service$)} = 0;
EOF

  service_installed=$(state_value SERVICE_INSTALLED)
  service_installed=${service_installed:-false}
  if [[ "$service_installed" == 'true' ]]; then
    validate_runner_service_assets "$expected_unit" "$runner_service"
  elif [[ "$service_installed" == 'false' ]]; then
    [[ ! -e "$unit_path" || ( -f "$unit_path" && ! -L "$unit_path" ) ]] ||
      die 'incomplete runner service unit is not a regular file'
    if systemctl is-active --quiet "$runner_service"; then
      systemctl stop "$runner_service"
    fi
    write_file_from_stdin 0644 root root "$unit_path" <"$expected_unit"
    # The child intentionally expands positional parameters as the runner user.
    # shellcheck disable=SC2016
    runuser -u "$RUNNER_USER" -- bash -c '
      set -Eeuo pipefail
      cd "$1"
      [[ -f bin/runsvc.sh && ! -L bin/runsvc.sh ]]
      install -m 0755 bin/runsvc.sh .runsvc.sh.tmp
      mv -Tf -- .runsvc.sh.tmp runsvc.sh
      printf "%s\n" "$2" >.service.tmp
      chmod 0644 .service.tmp
      mv -Tf -- .service.tmp .service
    ' bash "$RUNNER_DIR" "$runner_service"
    validate_runner_service_assets "$expected_unit" "$runner_service"
  else
    die 'managed service phase is invalid'
  fi

  systemctl daemon-reload
  validate_effective_runner_service "$runner_service"
  systemctl enable --now "$runner_service"
  systemctl is-active --quiet "$runner_service" ||
    die 'runner service did not become active'
  if [[ "$service_installed" == 'false' ]]; then
    write_managed_state true
  fi
}

verify_runner_online() {
  local remaining=30 runners_json status labels expected_labels

  expected_labels=$(jq -cn --arg labels "$RUNNER_LABELS" '$labels | split(",") | sort')

  CURRENT_STAGE='GitHub online verification'
  while ((remaining > 0)); do
    if ! runners_json=$(list_runners "/orgs/${ORGANIZATION}/actions/runner-groups/${RUNNER_GROUP_ID}/runners"); then
      sleep 5
      remaining=$((remaining - 1))
      continue
    fi
    status=$(jq -r --arg name "$RUNNER_NAME" \
      '.runners[]? | select(.name == $name) | .status' <<<"$runners_json")
    labels=$(jq -c --arg name "$RUNNER_NAME" \
      '[.runners[]? | select(.name == $name) | .labels[].name] | sort' <<<"$runners_json")

    if [[ "$status" == 'online' ]] &&
      [[ "$labels" == "$expected_labels" ]]; then
      return
    fi
    sleep 5
    remaining=$((remaining - 1))
  done

  die 'runner did not become online with all required labels within 150 seconds'
}

apply_bootstrap() {
  local default_name provider_ack policy_ack github_access_validated='false'

  [[ $EUID -eq 0 ]] || die '--apply must run as root'
  acquire_mutation_lock
  default_name=$(hostname -s)
  if [[ -z "$RUNNER_NAME" ]]; then
    RUNNER_NAME=$(prompt_line 'Unique runner name' "$default_name")
  fi
  validate_runner_name

  if [[ -z "$VOLUME_MOUNT" ]]; then
    info 'Storage default: local 80 GB NVMe. Pass --volume-mount only for an attached Volume.'
  fi
  local_check

  provider_ack=$(prompt_line \
    'Confirm CAX21/Ubuntu ARM64, spread group, SSH-only firewall, and protected optional Volume (yes/no)')
  [[ "$provider_ack" == 'yes' ]] || die 'provider prerequisites were not acknowledged'

  if [[ "$PROFILE" == 'public-pr' ]]; then
    policy_ack=$(prompt_line \
      'Confirm this persistent host is disposable, public-PR-only, and isolated from secrets and private repositories (yes/no)')
  else
    policy_ack=$(prompt_line \
      'Confirm this trusted group selects private repositories only and cannot run public PR workflows (yes/no)')
  fi
  [[ "$policy_ack" == 'yes' ]] || die 'runner profile policy was not acknowledged'

  GITHUB_TOKEN=$(prompt_secret \
    'Short-lived GitHub token with organization Self-hosted runners read/write permission')
  [[ -n "$GITHUB_TOKEN" ]] || die 'GitHub token is required'
  [[ "$GITHUB_TOKEN" =~ ^[A-Za-z0-9_-]+$ ]] || die 'GitHub token has an unexpected format'

  if command -v curl >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
    validate_github_access
    github_access_validated='true'
  elif command -v curl >/dev/null 2>&1; then
    preflight_github_api_access
  fi

  require_confirmation \
    "About to modify this VM for runner ${RUNNER_NAME} using ${VOLUME_MOUNT:-local NVMe}." \
    'APPLY RUNNER BOOTSTRAP'

  install_github_validation_dependencies
  if [[ "$github_access_validated" == 'false' ]]; then
    validate_github_access
  fi
  TEMP_DIR=$(TMPDIR=/tmp mktemp -d -t actions-runner-bootstrap.XXXXXX)
  write_managed_state
  install_packages
  configure_users
  configure_host_firewall
  confirm_admin_login_and_harden_ssh
  configure_docker
  install_runner_archive
  mint_registration_token
  register_and_start_runner
  verify_runner_online
  GITHUB_TOKEN=''

  log 'Runner bootstrap completed'
  info "${RUNNER_NAME} is online with labels: ${RUNNER_LABELS}"
  info "Verify the timer with: systemctl status actions-runner-disk-cleanup.timer"
  info 'Revoke the short-lived GitHub token after all five VMs are provisioned.'
  info 'Do not close the original root session until runner-admin reconnection remains confirmed.'
}

main() {
  parse_args "$@"
  configure_profile

  case "$MODE" in
    plan)
      if [[ -n "$RUNNER_NAME" ]]; then
        validate_runner_name
      fi
      print_plan
      ;;
    check)
      if [[ -z "$RUNNER_NAME" ]]; then
        RUNNER_NAME=$(hostname -s)
      fi
      local_check
      log 'Offline checks passed; no changes were made'
      print_plan
      ;;
    apply)
      apply_bootstrap
      ;;
  esac
}

main "$@"
