# Sourced by refresh-stg-from-prd.sh; do not execute directly.
# Contract: reads validated configuration and run-state globals from the entrypoint,
# uses log/die/validation helpers, and writes only the documented database/Azure
# metadata globals plus the current run archive/catalog files.

parse_database_url_field() {
  local database_url="$1"
  local field="$2"

  KLICKER_DATABASE_URL_INPUT="$database_url" KLICKER_DATABASE_URL_FIELD="$field" \
    node - <<'NODE'
const input = process.env.KLICKER_DATABASE_URL_INPUT
const field = process.env.KLICKER_DATABASE_URL_FIELD

let parsed
try {
  parsed = new URL(input)
} catch {
  process.stderr.write('Invalid PostgreSQL connection URL\n')
  process.exit(1)
}

if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  process.stderr.write('Connection URL must use postgres:// or postgresql://\n')
  process.exit(1)
}

if (field === 'host') {
  process.stdout.write(parsed.hostname)
} else if (field === 'port') {
  process.stdout.write(parsed.port || '5432')
} else if (field === 'username') {
  process.stdout.write(decodeURIComponent(parsed.username))
} else if (field === 'password') {
  process.stdout.write(decodeURIComponent(parsed.password))
} else if (field === 'database') {
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  if (!database) {
    process.stderr.write('Connection URL does not contain a database name\n')
    process.exit(1)
  }
  process.stdout.write(database)
} else if (field === 'libpq') {
  parsed.searchParams.delete('schema')
  parsed.searchParams.delete('pgbouncer')
  process.stdout.write(parsed.toString())
} else if (field === 'sslmode') {
  process.stdout.write(parsed.searchParams.get('sslmode') || '')
} else if (field === 'sslnegotiation') {
  process.stdout.write(parsed.searchParams.get('sslnegotiation') || '')
} else if (field === 'channel_binding') {
  process.stdout.write(parsed.searchParams.get('channel_binding') || '')
} else if (field === 'target_session_attrs') {
  process.stdout.write(parsed.searchParams.get('target_session_attrs') || '')
} else {
  process.stderr.write(`Unknown URL field: ${field}\n`)
  process.exit(1)
}
NODE
}

run_database_command() (
  local database_url="$1"
  shift

  local host port username password database sslmode sslnegotiation
  local channel_binding target_session_attrs
  host="$(parse_database_url_field "$database_url" host)"
  port="$(parse_database_url_field "$database_url" port)"
  username="$(parse_database_url_field "$database_url" username)"
  password="$(parse_database_url_field "$database_url" password)"
  database="$(parse_database_url_field "$database_url" database)"
  sslmode="$(parse_database_url_field "$database_url" sslmode)"
  sslnegotiation="$(parse_database_url_field "$database_url" sslnegotiation)"
  channel_binding="$(parse_database_url_field "$database_url" channel_binding)"
  target_session_attrs="$(parse_database_url_field "$database_url" target_session_attrs)"

  export PGCONNECT_TIMEOUT=15
  export PGHOST="$host"
  export PGPORT="$port"
  export PGUSER="$username"
  export PGPASSWORD="$password"
  export PGDATABASE="$database"
  [[ -z "$sslmode" ]] || export PGSSLMODE="$sslmode"
  [[ -z "$sslnegotiation" ]] || export PGSSLNEGOTIATION="$sslnegotiation"
  [[ -z "$channel_binding" ]] || export PGCHANNELBINDING="$channel_binding"
  [[ -z "$target_session_attrs" ]] \
    || export PGTARGETSESSIONATTRS="$target_session_attrs"

  "$@"
)

load_infisical_secret() {
  local output_variable="$1"
  local secret_name="$2"
  local environment="$3"
  local project_id="$4"
  local secret_value

  if ! secret_value="$(
    infisical secrets get "$secret_name" \
      --domain="$INFISICAL_API_URL" \
      --env="$environment" \
      --path="$INFISICAL_SECRET_PATH" \
      --projectId="$project_id" \
      --plain \
      --silent
  )"; then
    die "Could not load '$secret_name' from Infisical environment '$environment' at '$INFISICAL_API_URL'"
  fi
  [[ -n "$secret_value" ]] \
    || die "Infisical returned an empty value for '$secret_name' in environment '$environment' at path '$INFISICAL_SECRET_PATH'"

  printf -v "$output_variable" '%s' "$secret_value"
}

load_credentials() {
  local needs_infisical=false
  if [[ -z "$PRD_DATABASE_URL" || -z "$STG_DATABASE_URL" ]]; then
    needs_infisical=true
  fi
  if [[ "$DRY_RUN" == "false" && -z "$BACKUP_ENCRYPTION_KEY" ]]; then
    needs_infisical=true
  fi
  if [[ "$needs_infisical" == "false" ]]; then
    return
  fi

  require_command infisical

  if [[ -z "$PRD_DATABASE_URL" ]]; then
    log "Loading the PRD direct database URL from Infisical environment '$PRD_INFISICAL_ENV'"
    load_infisical_secret PRD_DATABASE_URL DIRECT_DATABASE_URL "$PRD_INFISICAL_ENV" "$INFISICAL_PROJECT_ID"
  fi
  if [[ -z "$STG_DATABASE_URL" ]]; then
    log "Loading the STG direct database URL from Infisical environment '$STG_INFISICAL_ENV'"
    load_infisical_secret STG_DATABASE_URL DIRECT_DATABASE_URL "$STG_INFISICAL_ENV" "$INFISICAL_PROJECT_ID"
  fi
  if [[ "$DRY_RUN" == "false" && -z "$BACKUP_ENCRYPTION_KEY" ]]; then
    log "Loading the backup encryption key from Infisical environment '$PRD_INFISICAL_ENV'"
    load_infisical_secret BACKUP_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY "$PRD_INFISICAL_ENV" "$INFISICAL_PROJECT_ID"
  fi

  [[ -n "$PRD_DATABASE_URL" ]] || die "PRD database URL is empty"
  [[ -n "$STG_DATABASE_URL" ]] || die "STG database URL is empty"
  if [[ "$DRY_RUN" == "false" ]]; then
    [[ -n "$BACKUP_ENCRYPTION_KEY" ]] || die "Backup encryption key is empty"
  fi
}

validate_database_tls() {
  local label="$1"
  local database_url="$2"
  local sslmode
  sslmode="$(parse_database_url_field "$database_url" sslmode)"
  case "$sslmode" in
    require|verify-ca|verify-full) ;;
    *) die "$label database URL must set sslmode=require, verify-ca, or verify-full" ;;
  esac
}

validate_endpoints() {
  PRD_DATABASE_URL="$(parse_database_url_field "$PRD_DATABASE_URL" libpq)" \
    || die "Could not normalize the PRD database URL"
  STG_DATABASE_URL="$(parse_database_url_field "$STG_DATABASE_URL" libpq)" \
    || die "Could not normalize the STG database URL"

  PRD_DB_HOST="$(parse_database_url_field "$PRD_DATABASE_URL" host)"
  PRD_DB_PORT="$(parse_database_url_field "$PRD_DATABASE_URL" port)"
  PRD_DB_NAME="$(parse_database_url_field "$PRD_DATABASE_URL" database)"
  STG_DB_HOST="$(parse_database_url_field "$STG_DATABASE_URL" host)"
  STG_DB_PORT="$(parse_database_url_field "$STG_DATABASE_URL" port)"
  STG_DB_NAME="$(parse_database_url_field "$STG_DATABASE_URL" database)"

  [[ "$PRD_DB_HOST" == "$EXPECTED_PRD_DB_HOST" ]] \
    || die "PRD host '$PRD_DB_HOST' does not equal expected host '$EXPECTED_PRD_DB_HOST'"
  [[ "$STG_DB_HOST" == "$EXPECTED_STG_DB_HOST" ]] \
    || die "STG host '$STG_DB_HOST' does not equal expected host '$EXPECTED_STG_DB_HOST'"
  [[ "$PRD_DB_PORT" == "$EXPECTED_PRD_DB_PORT" ]] \
    || die "PRD port '$PRD_DB_PORT' does not equal expected port '$EXPECTED_PRD_DB_PORT'"
  [[ "$STG_DB_PORT" == "$EXPECTED_STG_DB_PORT" ]] \
    || die "STG port '$STG_DB_PORT' does not equal expected port '$EXPECTED_STG_DB_PORT'"
  [[ "$PRD_DB_NAME" == "$EXPECTED_PRD_DB_NAME" ]] \
    || die "PRD database '$PRD_DB_NAME' does not equal expected database '$EXPECTED_PRD_DB_NAME'"
  [[ "$STG_DB_NAME" == "$EXPECTED_STG_DB_NAME" ]] \
    || die "STG database '$STG_DB_NAME' does not equal expected database '$EXPECTED_STG_DB_NAME'"
  [[ "$PRD_DB_HOST" != "$STG_DB_HOST" ]] || die "PRD and STG resolve to the same configured host"
  validate_database_tls PRD "$PRD_DATABASE_URL"
  validate_database_tls STG "$STG_DATABASE_URL"
}

read_database_metadata() {
  local database_url="$1"
  local core_query core_metadata migration_metadata
  core_query=$(cat <<'SQL'
/* klicker_database_metadata_core */
SELECT
  current_database(),
  current_setting('server_version_num')::bigint,
  pg_database_size(current_database()),
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
  CASE WHEN to_regclass('public."_prisma_migrations"') IS NULL THEN 0 ELSE 1 END,
  (SELECT count(*) FROM pg_namespace WHERE nspname <> 'public' AND nspname <> 'information_schema' AND nspname !~ '^pg_'),
  (SELECT count(*) FROM pg_largeobject_metadata);
SQL
)

  core_metadata="$(
    run_database_command "$database_url" \
      psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$core_query"
  )" || return 1

  local database_name version_num size_bytes table_count
  local migration_table_present extra_schema_count large_object_count
  IFS='|' read -r database_name version_num size_bytes table_count \
    migration_table_present extra_schema_count large_object_count \
    <<<"$core_metadata"
  [[ "$migration_table_present" == "0" || "$migration_table_present" == "1" ]] \
    || return 1

  if [[ "$migration_table_present" == "1" ]]; then
    local migration_query
    migration_query=$(cat <<'SQL'
/* klicker_database_metadata_migrations */
SELECT
  count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)
FROM public."_prisma_migrations";
SQL
)
    migration_metadata="$(
      run_database_command "$database_url" \
        psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$migration_query"
    )" || return 1
  else
    migration_metadata='0|0'
  fi

  local applied_migrations failed_migrations
  IFS='|' read -r applied_migrations failed_migrations <<<"$migration_metadata"
  printf '%s|%s|%s|%s|%s|%s|%s|%s\n' \
    "$database_name" "$version_num" "$size_bytes" "$table_count" \
    "$applied_migrations" "$failed_migrations" "$extra_schema_count" \
    "$large_object_count"
}

load_database_metadata() {
  local output_variable="$1"
  local database_url="$2"
  local environment="$3"
  local metadata

  if ! metadata="$(read_database_metadata "$database_url")"; then
    die "Could not read $environment database metadata"
  fi
  [[ -n "$metadata" ]] || die "$environment database metadata is empty"
  printf -v "$output_variable" '%s' "$metadata"
}

read_database_identity() {
  local database_url="$1"
  local identity_query
  identity_query=$(cat <<'SQL'
/* klicker_database_identity */
SELECT
  current_database(),
  (SELECT oid FROM pg_database WHERE datname = current_database()),
  current_setting('server_version_num'),
  coalesce(inet_server_addr()::text, ''),
  coalesce(inet_server_port()::text, '');
SQL
)
  run_database_command "$database_url" \
    psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$identity_query"
}

load_database_identity() {
  local output_variable="$1"
  local database_url="$2"
  local label="$3"
  local identity
  identity="$(read_database_identity "$database_url")" \
    || die "Could not read $label database identity"
  [[ "$identity" =~ ^[^|]+\|[0-9]+\|[0-9]+\|[^|]+\|[0-9]+$ ]] \
    || die "$label database identity is incomplete or malformed"
  printf -v "$output_variable" '%s' "$identity"
}

read_migration_history() {
  local database_url="$1"
  local migration_query
  migration_query=$(cat <<'SQL'
/* klicker_migration_history */
SELECT migration_name, checksum
FROM public."_prisma_migrations"
WHERE finished_at IS NOT NULL
  AND rolled_back_at IS NULL
ORDER BY started_at, migration_name;
SQL
)
  run_database_command "$database_url" \
    psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$migration_query"
}

migration_history_fingerprint() {
  local history="$1"
  printf '%s' "$history" | shasum -a 256 | awk '{print $1}'
}

load_migration_history() {
  local history_variable="$1"
  local fingerprint_variable="$2"
  local database_url="$3"
  local label="$4"
  local history fingerprint
  history="$(read_migration_history "$database_url")" \
    || die "Could not read $label Prisma migration history"
  [[ -n "$history" ]] || die "$label Prisma migration history is empty"
  fingerprint="$(migration_history_fingerprint "$history")"
  [[ "$fingerprint" =~ ^[0-9a-fA-F]{64}$ ]] \
    || die "Could not fingerprint $label Prisma migration history"
  printf -v "$history_variable" '%s' "$history"
  printf -v "$fingerprint_variable" '%s' "$fingerprint"
}

load_migrator_database_url() {
  local encoded_url decoded_url
  encoded_url="$(
    kubectl_for_workloads get secret "$MIGRATOR_SECRET_NAME" \
      -o "jsonpath={.data.$MIGRATOR_SECRET_KEY}"
  )" || die "Could not read migrator Secret '$WORKLOAD_NAMESPACE/$MIGRATOR_SECRET_NAME' key '$MIGRATOR_SECRET_KEY'"
  [[ -n "$encoded_url" ]] \
    || die "Migrator Secret '$WORKLOAD_NAMESPACE/$MIGRATOR_SECRET_NAME' has no '$MIGRATOR_SECRET_KEY' value"
  if decoded_url="$(printf '%s' "$encoded_url" | base64 --decode 2>/dev/null)"; then
    MIGRATOR_DATABASE_URL="$decoded_url"
  elif decoded_url="$(printf '%s' "$encoded_url" | base64 -D 2>/dev/null)"; then
    MIGRATOR_DATABASE_URL="$decoded_url"
  else
    die "Could not decode migrator database URL"
  fi
  [[ -n "$MIGRATOR_DATABASE_URL" ]] || die "Migrator database URL is empty"
  MIGRATOR_DATABASE_URL="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" libpq)" \
    || die "Could not normalize migrator database URL"
  export -n MIGRATOR_DATABASE_URL
}

validate_migrator_target() {
  local migrator_host migrator_port migrator_database
  migrator_host="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" host)"
  migrator_port="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" port)"
  migrator_database="$(parse_database_url_field "$MIGRATOR_DATABASE_URL" database)"
  validate_database_tls Migrator "$MIGRATOR_DATABASE_URL"

  [[ "$migrator_host" == "$STG_DB_HOST" ]] \
    || die "Migrator Secret host '$migrator_host' does not match STG restore host '$STG_DB_HOST'"
  [[ "$migrator_port" == "$STG_DB_PORT" ]] \
    || die "Migrator Secret port '$migrator_port' does not match STG restore port '$STG_DB_PORT'"
  [[ "$migrator_database" == "$STG_DB_NAME" ]] \
    || die "Migrator Secret database '$migrator_database' does not match STG restore database '$STG_DB_NAME'"

  load_database_identity MIGRATOR_DATABASE_IDENTITY "$MIGRATOR_DATABASE_URL" Migrator
  [[ "$MIGRATOR_DATABASE_IDENTITY" == "$STG_DATABASE_IDENTITY" ]] \
    || die "Migrator Secret and STG restore URL do not reach the same database server identity"
}

parse_prd_metadata() {
  local metadata="$1"
  local database_name
  IFS='|' read -r database_name PRD_VERSION_NUM PRD_SIZE_BYTES PRD_TABLE_COUNT \
    PRD_APPLIED_MIGRATIONS PRD_FAILED_MIGRATIONS PRD_EXTRA_SCHEMA_COUNT \
    PRD_LARGE_OBJECT_COUNT <<<"$metadata"

  [[ "$database_name" == "$PRD_DB_NAME" ]] \
    || die "PRD metadata returned unexpected database '$database_name'"
  validate_positive_integer PRD_VERSION_NUM "$PRD_VERSION_NUM"
  validate_positive_integer PRD_SIZE_BYTES "$PRD_SIZE_BYTES"
  validate_positive_integer PRD_TABLE_COUNT "$PRD_TABLE_COUNT"
  validate_positive_integer PRD_APPLIED_MIGRATIONS "$PRD_APPLIED_MIGRATIONS"
  validate_positive_integer PRD_FAILED_MIGRATIONS "$PRD_FAILED_MIGRATIONS"
  validate_positive_integer PRD_EXTRA_SCHEMA_COUNT "$PRD_EXTRA_SCHEMA_COUNT"
  validate_positive_integer PRD_LARGE_OBJECT_COUNT "$PRD_LARGE_OBJECT_COUNT"
  [[ "$PRD_FAILED_MIGRATIONS" == "0" ]] \
    || die "PRD has $PRD_FAILED_MIGRATIONS unresolved Prisma migration(s); refusing to copy"
  [[ "$PRD_EXTRA_SCHEMA_COUNT" == "0" ]] \
    || die "PRD has $PRD_EXTRA_SCHEMA_COUNT non-public application schema(s); this refresh supports only the public schema"
  [[ "$PRD_LARGE_OBJECT_COUNT" == "0" ]] \
    || die "PRD has $PRD_LARGE_OBJECT_COUNT PostgreSQL large object(s); this refresh does not support large objects"
}

parse_stg_before_metadata() {
  local metadata="$1"
  local database_name
  IFS='|' read -r database_name STG_BEFORE_VERSION_NUM STG_BEFORE_SIZE_BYTES \
    STG_BEFORE_TABLE_COUNT STG_BEFORE_APPLIED_MIGRATIONS \
    STG_BEFORE_FAILED_MIGRATIONS STG_EXTRA_SCHEMA_COUNT \
    STG_LARGE_OBJECT_COUNT <<<"$metadata"

  [[ "$database_name" == "$STG_DB_NAME" ]] \
    || die "STG metadata returned unexpected database '$database_name'"
  validate_positive_integer STG_BEFORE_VERSION_NUM "$STG_BEFORE_VERSION_NUM"
  validate_positive_integer STG_BEFORE_SIZE_BYTES "$STG_BEFORE_SIZE_BYTES"
  validate_positive_integer STG_BEFORE_TABLE_COUNT "$STG_BEFORE_TABLE_COUNT"
  validate_positive_integer STG_BEFORE_APPLIED_MIGRATIONS "$STG_BEFORE_APPLIED_MIGRATIONS"
  validate_positive_integer STG_BEFORE_FAILED_MIGRATIONS "$STG_BEFORE_FAILED_MIGRATIONS"
  validate_positive_integer STG_EXTRA_SCHEMA_COUNT "$STG_EXTRA_SCHEMA_COUNT"
  validate_positive_integer STG_LARGE_OBJECT_COUNT "$STG_LARGE_OBJECT_COUNT"
  [[ "$STG_EXTRA_SCHEMA_COUNT" == "0" ]] \
    || die "STG has $STG_EXTRA_SCHEMA_COUNT non-public application schema(s); refusing an incomplete replacement"
  [[ "$STG_LARGE_OBJECT_COUNT" == "0" ]] \
    || die "STG has $STG_LARGE_OBJECT_COUNT PostgreSQL large object(s); refusing an incomplete replacement"
}

read_stg_reset_capabilities() {
  local query
  query=$(cat <<'SQL'
/* klicker_stg_reset_capabilities */
WITH public_namespace AS (
  SELECT oid, nspowner
  FROM pg_namespace
  WHERE nspname = 'public'
), supported_objects AS (
  SELECT c.relowner AS owner_oid
  FROM pg_class c
  WHERE c.relnamespace = (SELECT oid FROM public_namespace)
    AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  UNION ALL
  SELECT p.proowner
  FROM pg_proc p
  WHERE p.pronamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT t.typowner
  FROM pg_type t
  WHERE t.typnamespace = (SELECT oid FROM public_namespace)
    AND t.typrelid = 0
    AND NOT EXISTS (
      SELECT 1
      FROM pg_depend d
      WHERE d.classid = 'pg_type'::regclass
        AND d.objid = t.oid
        AND d.deptype IN ('i', 'e')
    )
), unsupported_objects AS (
  SELECT c.oid
  FROM pg_class c
  WHERE c.relnamespace = (SELECT oid FROM public_namespace)
    AND c.relkind = 'c'
  UNION ALL
  SELECT coll.oid
  FROM pg_collation coll
  WHERE coll.collnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT conv.oid
  FROM pg_conversion conv
  WHERE conv.connamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT op.oid
  FROM pg_operator op
  WHERE op.oprnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT opc.oid
  FROM pg_opclass opc
  WHERE opc.opcnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT opf.oid
  FROM pg_opfamily opf
  WHERE opf.opfnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT cfg.oid
  FROM pg_ts_config cfg
  WHERE cfg.cfgnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT dict.oid
  FROM pg_ts_dict dict
  WHERE dict.dictnamespace = (SELECT oid FROM public_namespace)
  UNION ALL
  SELECT ext.oid
  FROM pg_extension ext
  WHERE ext.extnamespace = (SELECT oid FROM public_namespace)
)
SELECT
  current_database(),
  current_user,
  pg_get_userbyid((SELECT nspowner FROM public_namespace)),
  has_schema_privilege(current_user, 'public', 'CREATE'),
  (SELECT count(*) FROM supported_objects),
  (SELECT count(*) FROM supported_objects WHERE NOT pg_has_role(current_user, owner_oid, 'USAGE')),
  (SELECT count(*) FROM unsupported_objects),
  (SELECT count(*) FROM pg_namespace WHERE nspname <> 'public' AND nspname <> 'information_schema' AND nspname !~ '^pg_'),
  (SELECT count(*) FROM pg_largeobject_metadata);
SQL
)

  run_database_command "$STG_DATABASE_URL" \
    psql -X -v ON_ERROR_STOP=1 -At -F '|' -c "$query"
}

validate_stg_reset_capabilities() {
  local metadata database_name extra_schema_count large_object_count
  if ! metadata="$(read_stg_reset_capabilities)"; then
    die "Could not validate STG object ownership for replacement"
  fi

  IFS='|' read -r database_name STG_CONNECTED_ROLE STG_PUBLIC_SCHEMA_OWNER \
    STG_CAN_CREATE_IN_PUBLIC STG_SUPPORTED_OBJECT_COUNT \
    STG_UNOWNED_OBJECT_COUNT STG_UNSUPPORTED_OBJECT_COUNT extra_schema_count \
    large_object_count <<<"$metadata"

  [[ "$database_name" == "$STG_DB_NAME" ]] \
    || die "STG ownership metadata came from unexpected database '$database_name'"
  [[ -n "$STG_CONNECTED_ROLE" && -n "$STG_PUBLIC_SCHEMA_OWNER" ]] \
    || die "STG ownership metadata is incomplete"
  [[ "$STG_CAN_CREATE_IN_PUBLIC" == "t" ]] \
    || die "STG role '$STG_CONNECTED_ROLE' cannot create objects in the public schema"
  validate_positive_integer STG_SUPPORTED_OBJECT_COUNT "$STG_SUPPORTED_OBJECT_COUNT"
  validate_positive_integer STG_UNOWNED_OBJECT_COUNT "$STG_UNOWNED_OBJECT_COUNT"
  validate_positive_integer STG_UNSUPPORTED_OBJECT_COUNT "$STG_UNSUPPORTED_OBJECT_COUNT"
  validate_positive_integer stg_reset_extra_schema_count "$extra_schema_count"
  validate_positive_integer stg_reset_large_object_count "$large_object_count"
  [[ "$STG_UNOWNED_OBJECT_COUNT" == "0" ]] \
    || die "STG contains $STG_UNOWNED_OBJECT_COUNT public object(s) that '$STG_CONNECTED_ROLE' cannot drop"
  [[ "$STG_UNSUPPORTED_OBJECT_COUNT" == "0" ]] \
    || die "STG contains $STG_UNSUPPORTED_OBJECT_COUNT unsupported public object(s); refusing an incomplete replacement"
  [[ "$extra_schema_count" == "0" && "$large_object_count" == "0" ]] \
    || die "STG replacement capability changed after metadata validation"
}

validate_client_and_capacity() {
  local pg_dump_major pg_restore_major
  pg_dump_major="$(pg_dump --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/')"
  pg_restore_major="$(pg_restore --version | sed -E 's/^[^0-9]*([0-9]+).*/\1/')"
  validate_positive_integer pg_dump_major "$pg_dump_major"
  validate_positive_integer pg_restore_major "$pg_restore_major"

  local prd_major=$((PRD_VERSION_NUM / 10000))
  local stg_major=$((STG_BEFORE_VERSION_NUM / 10000))
  if (( pg_dump_major < prd_major )); then
    die "pg_dump major $pg_dump_major cannot dump PRD PostgreSQL major $prd_major"
  fi
  if (( pg_restore_major < prd_major )); then
    die "pg_restore major $pg_restore_major cannot restore a PRD PostgreSQL major $prd_major dump"
  fi
  if (( stg_major < prd_major )); then
    die "STG PostgreSQL major $stg_major is older than PRD PostgreSQL major $prd_major"
  fi

  local stg_capacity_bytes=$((STG_STORAGE_GIB * 1024 * 1024 * 1024))
  if (( PRD_SIZE_BYTES * 100 > stg_capacity_bytes * MAX_SOURCE_STORAGE_PERCENT )); then
    die "PRD database size exceeds ${MAX_SOURCE_STORAGE_PERCENT}% of the configured ${STG_STORAGE_GIB} GiB STG storage capacity"
  fi
}

read_azure_metric_point() {
  local metrics_json="$1"
  local metric_name="$2"
  local aggregation="$3"
  jq -r --arg metric "$metric_name" --arg aggregation "$aggregation" '
    [
      .value[] |
      select(.name.value == $metric) |
      .timeseries[].data[] |
      select(.[$aggregation] != null) |
      {value: (.[$aggregation] | floor), timeStamp}
    ] |
    last |
    if . == null then empty else [.value, .timeStamp] | @tsv end
  ' <<<"$metrics_json"
}

validate_azure_storage_headroom() {
  local server_json metrics_json actual_storage_gib expected_resource_suffix
  server_json="$(
    az postgres flexible-server show \
      --resource-group "$STG_AZURE_RESOURCE_GROUP" \
      --name "$STG_AZURE_SERVER_NAME" \
      --output json --only-show-errors
  )" || die "Could not read the STG Azure PostgreSQL resource"

  [[ "$(jq -r '.name // ""' <<<"$server_json")" == "$STG_AZURE_SERVER_NAME" ]] \
    || die "Azure returned an unexpected STG PostgreSQL server name"
  [[ "$(jq -r '.fullyQualifiedDomainName // ""' <<<"$server_json")" == "$STG_DB_HOST" ]] \
    || die "Azure PostgreSQL resource does not match the validated STG database hostname"
  STG_AZURE_RESOURCE_ID="$(jq -r '.id // ""' <<<"$server_json")"
  expected_resource_suffix="/resourceGroups/$STG_AZURE_RESOURCE_GROUP/providers/Microsoft.DBforPostgreSQL/flexibleServers/$STG_AZURE_SERVER_NAME"
  [[ "$STG_AZURE_RESOURCE_ID" == *"$expected_resource_suffix" ]] \
    || die "Azure returned an unexpected STG PostgreSQL resource ID"

  actual_storage_gib="$(jq -r '.storage.storageSizeGb // ""' <<<"$server_json")"
  [[ "$actual_storage_gib" =~ ^[0-9]+$ ]] \
    || die "Azure STG storage capacity is missing or malformed"
  [[ "$actual_storage_gib" == "$STG_STORAGE_GIB" ]] \
    || die "Azure STG storage capacity is ${actual_storage_gib} GiB, not the expected ${STG_STORAGE_GIB} GiB"

  metrics_json="$(
    az monitor metrics list \
      --resource "$STG_AZURE_RESOURCE_ID" \
      --metrics storage_used storage_free txlogs_storage_used \
      --interval PT5M --offset 2h --aggregation Maximum Minimum \
      --output json --only-show-errors
  )" || die "Could not read current STG Azure storage metrics"
  jq -e '
    . as $root |
    ["storage_used", "storage_free", "txlogs_storage_used"] |
    all(.[];
      . as $name |
      any($root.value[]; .name.value == $name and .unit == "Bytes")
    )
  ' >/dev/null <<<"$metrics_json" \
    || die "Azure STG storage metrics are missing or do not use byte units"

  local used_point free_point txlog_point used_time free_time txlog_time
  used_point="$(read_azure_metric_point "$metrics_json" storage_used maximum)"
  free_point="$(read_azure_metric_point "$metrics_json" storage_free minimum)"
  txlog_point="$(read_azure_metric_point "$metrics_json" txlogs_storage_used maximum)"
  IFS=$'\t' read -r STG_AZURE_STORAGE_USED_BYTES used_time <<<"$used_point"
  IFS=$'\t' read -r STG_AZURE_STORAGE_FREE_BYTES free_time <<<"$free_point"
  IFS=$'\t' read -r STG_AZURE_TXLOG_STORAGE_BYTES txlog_time <<<"$txlog_point"
  validate_positive_integer STG_AZURE_STORAGE_USED_BYTES "$STG_AZURE_STORAGE_USED_BYTES"
  validate_positive_integer STG_AZURE_STORAGE_FREE_BYTES "$STG_AZURE_STORAGE_FREE_BYTES"
  validate_positive_integer STG_AZURE_TXLOG_STORAGE_BYTES "$STG_AZURE_TXLOG_STORAGE_BYTES"
  [[ -n "$used_time" && "$used_time" == "$free_time" && "$used_time" == "$txlog_time" ]] \
    || die "Azure STG storage metrics are missing or not aligned to one timestamp"
  jq -en --arg timestamp "$used_time" '
    ($timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601) as $measured |
    $measured <= now and (now - $measured) <= 1800
  ' >/dev/null || die "Azure STG storage metrics are older than 30 minutes"
  STG_AZURE_STORAGE_METRIC_TIME="$used_time"

  if (( STG_AZURE_STORAGE_FREE_BYTES < PRD_SIZE_BYTES * MIN_STG_FREE_SPACE_MULTIPLIER )); then
    die "Current STG free storage is less than ${MIN_STG_FREE_SPACE_MULTIPLIER}x the PRD database size required for restore, WAL, and migration headroom"
  fi
  log "Azure storage headroom: $STG_AZURE_STORAGE_FREE_BYTES bytes free, $STG_AZURE_STORAGE_USED_BYTES bytes used, $STG_AZURE_TXLOG_STORAGE_BYTES bytes transaction logs at $STG_AZURE_STORAGE_METRIC_TIME"
}

encrypt_prd_dump() {
  log "Creating encrypted PRD custom-format dump"
  exec 3<<<"$BACKUP_ENCRYPTION_KEY"
  if ! run_database_command "$PRD_DATABASE_URL" \
    pg_dump --format=custom --no-owner --no-privileges \
      | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
        --cipher-algo AES256 --symmetric --output "$ARCHIVE_PATH"; then
    exec 3<&-
    die "PRD dump or archive encryption failed"
  fi
  exec 3<&-

  [[ -s "$ARCHIVE_PATH" ]] || die "Encrypted PRD archive is empty"

  local checksum
  checksum="$(shasum -a 256 "$ARCHIVE_PATH" | awk '{print $1}')"
  [[ "$checksum" =~ ^[0-9a-fA-F]{64}$ ]] || die "Could not calculate archive checksum"
  printf '%s  %s\n' "$checksum" "$(basename "$ARCHIVE_PATH")" >"$ARCHIVE_CHECKSUM_PATH"

  log "Validating that the encrypted archive decrypts and has a readable pg_restore catalog"
  exec 3<<<"$BACKUP_ENCRYPTION_KEY"
  if ! gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
    --decrypt "$ARCHIVE_PATH" 2>/dev/null \
      | {
        pg_restore --list >"$ARCHIVE_CATALOG_PATH"
        catalog_status=$?
        cat >/dev/null
        drain_status=$?
        (( catalog_status == 0 && drain_status == 0 ))
      }; then
    exec 3<&-
    die "Encrypted archive validation failed"
  fi
  exec 3<&-

  local filtered_catalog="$ARCHIVE_CATALOG_PATH.filtered"
  local public_schema_entries
  public_schema_entries="$(
    grep -Ec '^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public|(COMMENT|ACL|SECURITY LABEL) - SCHEMA public) ' \
      "$ARCHIVE_CATALOG_PATH" || true
  )"
  (( public_schema_entries > 0 )) \
    || die "PRD archive catalog does not contain the expected public schema entry"

  awk '
    /^[0-9]+; [0-9]+ [0-9]+ SCHEMA - public / ||
    /^[0-9]+; [0-9]+ [0-9]+ (COMMENT|ACL|SECURITY LABEL) - SCHEMA public / {
      print ";" $0
      next
    }
    { print }
  ' "$ARCHIVE_CATALOG_PATH" >"$filtered_catalog"
  mv -- "$filtered_catalog" "$ARCHIVE_CATALOG_PATH"

  if grep -Eq '^[0-9]+; [0-9]+ [0-9]+ (SCHEMA - public|(COMMENT|ACL|SECURITY LABEL) - SCHEMA public) ' \
    "$ARCHIVE_CATALOG_PATH"; then
    die "Could not exclude public schema ownership entries from the restore catalog"
  fi
}

reset_stg_owned_objects() {
  assert_refresh_lease
  assert_argocd_maintenance_fence
  assert_argocd_quiescent
  assert_workload_set_matches_receipt
  local current_target_identity
  load_database_identity current_target_identity "$STG_DATABASE_URL" STG
  [[ "$current_target_identity" == "$STG_DATABASE_IDENTITY" ]] \
    || die "STG database identity changed immediately before destructive reset"
  [[ "${current_target_identity%%|*}" == "$EXPECTED_STG_DB_NAME" ]] \
    || die "STG current_database() changed immediately before destructive reset"
  [[ "$MIGRATOR_DATABASE_IDENTITY" == "$current_target_identity" ]] \
    || die "Migrator and restore target identities diverged before destructive reset"

  TARGET_MUTATED=true
  set_run_phase resetting-target
  log "Removing STG objects owned by '$STG_CONNECTED_ROLE' while preserving schema 'public' owned by '$STG_PUBLIC_SCHEMA_OWNER'"
  [[ -r "$SCRIPT_DIR/reset-stg-owned-objects.sql" ]] \
    || die "STG reset SQL is missing or unreadable"
  run_database_command "$STG_DATABASE_URL" \
    psql -X -v ON_ERROR_STOP=1 \
      -f "$SCRIPT_DIR/reset-stg-owned-objects.sql" >/dev/null \
    || die "STG object reset failed"
}

restore_stg_database() {
  assert_refresh_lease
  assert_argocd_maintenance_fence
  assert_argocd_quiescent
  set_run_phase restoring-target
  log "Restoring the encrypted PRD archive into STG"
  exec 3<<<"$BACKUP_ENCRYPTION_KEY"
  if ! gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
    --decrypt "$ARCHIVE_PATH" 2>/dev/null \
      | run_database_command "$STG_DATABASE_URL" \
        pg_restore --format=custom --exit-on-error --single-transaction \
          --dbname="$STG_DB_NAME" --use-list="$ARCHIVE_CATALOG_PATH" \
          --no-owner --no-privileges; then
    exec 3<&-
    die "STG pg_restore failed"
  fi
  exec 3<&-
}

validate_restored_snapshot() {
  local metadata="$1"
  local database_name version_num size_bytes table_count applied_migrations
  local failed_migrations extra_schema_count large_object_count
  IFS='|' read -r database_name version_num size_bytes table_count applied_migrations \
    failed_migrations extra_schema_count large_object_count <<<"$metadata"

  [[ "$database_name" == "$STG_DB_NAME" ]] || die "Restored metadata came from an unexpected database"
  validate_positive_integer restored_version_num "$version_num"
  validate_positive_integer restored_size_bytes "$size_bytes"
  validate_positive_integer restored_table_count "$table_count"
  validate_positive_integer restored_applied_migrations "$applied_migrations"
  validate_positive_integer restored_failed_migrations "$failed_migrations"
  validate_positive_integer restored_extra_schema_count "$extra_schema_count"
  validate_positive_integer restored_large_object_count "$large_object_count"
  [[ "$table_count" == "$PRD_TABLE_COUNT" ]] \
    || die "Restored table count $table_count does not match PRD snapshot count $PRD_TABLE_COUNT"
  [[ "$applied_migrations" == "$PRD_APPLIED_MIGRATIONS" ]] \
    || die "Restored migration count $applied_migrations does not match PRD snapshot count $PRD_APPLIED_MIGRATIONS"
  [[ "$failed_migrations" == "0" ]] \
    || die "Restored snapshot contains $failed_migrations unresolved Prisma migration(s)"
  [[ "$extra_schema_count" == "0" && "$large_object_count" == "0" ]] \
    || die "Restored snapshot contains unsupported schemas or large objects"

  log "Logical restore matches the PRD table and migration metadata"
}

validate_restored_migration_history() {
  local restored_history restored_fingerprint
  load_migration_history restored_history restored_fingerprint \
    "$STG_DATABASE_URL" restored-STG
  [[ "$restored_history" == "$PRD_MIGRATION_HISTORY" ]] \
    || die "Restored Prisma migration names or checksums do not exactly match the PRD snapshot"
  [[ "$restored_fingerprint" == "$PRD_MIGRATION_FINGERPRINT" ]] \
    || die "Restored Prisma migration fingerprint does not match the PRD snapshot"
}

validate_migrated_target() {
  local metadata="$1"
  local database_name version_num size_bytes table_count applied_migrations
  local failed_migrations extra_schema_count large_object_count
  IFS='|' read -r database_name version_num size_bytes table_count applied_migrations \
    failed_migrations extra_schema_count large_object_count <<<"$metadata"

  local error=""
  if [[ "$database_name" != "$STG_DB_NAME" ]]; then
    error="Post-migration metadata came from unexpected database '$database_name'"
  elif [[ ! "$version_num" =~ ^[0-9]+$ ||
    ! "$size_bytes" =~ ^[0-9]+$ ||
    ! "$table_count" =~ ^[0-9]+$ ||
    ! "$applied_migrations" =~ ^[0-9]+$ ||
    ! "$failed_migrations" =~ ^[0-9]+$ ||
    ! "$extra_schema_count" =~ ^[0-9]+$ ||
    ! "$large_object_count" =~ ^[0-9]+$ ]]; then
    error="Post-migration database metadata is incomplete or malformed"
  elif (( table_count == 0 )); then
    error="Post-migration database contains no public tables"
  elif (( applied_migrations < PRD_APPLIED_MIGRATIONS )); then
    error="Post-migration applied count $applied_migrations is lower than PRD snapshot count $PRD_APPLIED_MIGRATIONS"
  elif [[ "$failed_migrations" != "0" ]]; then
    error="Post-migration database contains $failed_migrations unresolved Prisma migration(s)"
  elif [[ "$extra_schema_count" != "0" || "$large_object_count" != "0" ]]; then
    error="Post-migration database contains unsupported schemas or large objects"
  fi

  [[ -z "$error" ]] || die "$error"

  local migrated_history
  load_migration_history migrated_history MIGRATED_MIGRATION_FINGERPRINT \
    "$STG_DATABASE_URL" migrated-STG
  if [[ "$migrated_history" != "$PRD_MIGRATION_HISTORY" &&
    "$migrated_history" != "$PRD_MIGRATION_HISTORY"$'\n'* ]]; then
    die "Post-migration Prisma history does not preserve the exact PRD migration-name/checksum prefix"
  fi

  MIGRATED_METADATA="$metadata"
  set_run_phase database-verified

  log "Post-sync verification passed: $table_count tables, $applied_migrations applied migrations"
}
