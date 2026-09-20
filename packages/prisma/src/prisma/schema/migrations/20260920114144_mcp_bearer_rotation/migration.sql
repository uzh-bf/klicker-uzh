BEGIN;

-- CreateTable
CREATE TABLE "MCPBearerRotation" (
    "environment" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "writerRole" TEXT NOT NULL,
    "readerRole" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "targets" JSONB NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'idle',
    "generationId" UUID,
    "issuedAt" BIGINT,
    "expiresAt" BIGINT,
    "claimedBackendPid" INTEGER,
    "claimedBackendStart" TIMESTAMPTZ(6),
    "operationBinding" JSONB,
    "expiries" JSONB NOT NULL DEFAULT '{}',
    "lastInspectedAt" TIMESTAMPTZ(6),
    "lastVerifiedAt" TIMESTAMPTZ(6),
    "lastFailureClass" TEXT,

    CONSTRAINT "MCPBearerRotation_pkey" PRIMARY KEY ("environment","tenant")
);

-- CreateIndex
CREATE UNIQUE INDEX "MCPBearerRotation_writerRole_key" ON "MCPBearerRotation"("writerRole");

-- CreateIndex
CREATE UNIQUE INDEX "MCPBearerRotation_readerRole_key" ON "MCPBearerRotation"("readerRole");

-- Prisma cannot express row policies, CHECK constraints or SECURITY DEFINER
-- routines. Keep these custody guards beside the generated table migration.
ALTER TABLE public."MCPBearerRotation"
  ADD CONSTRAINT "MCPBearerRotation_scope_check" CHECK (
    environment IN ('stg', 'prd') AND tenant = 'klicker' AND "writerRole" <> "readerRole"
  ),
  ADD CONSTRAINT "MCPBearerRotation_stage_check" CHECK (
    stage IN ('idle', 'claimed', 'publication_intent', 'published', 'database_applied', 'verified', 'needs_reconciliation')
  ),
  ADD CONSTRAINT "MCPBearerRotation_failure_check" CHECK (
    "lastFailureClass" IS NULL OR "lastFailureClass" IN ('inspection_failed', 'copy_conflict')
  );

REVOKE ALL ON public."MCPBearerRotation" FROM PUBLIC;
ALTER TABLE public."MCPBearerRotation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_bearer_metadata_reader ON public."MCPBearerRotation"
  FOR SELECT USING ("readerRole" = session_user);

-- Activation assigns this function and the metadata table to a dedicated
-- NOLOGIN owner and grants only EXECUTE to each configured writer login.
-- Reader logins receive SELECT on the seven metric columns only. No roles,
-- credentials, target rows or runtime grants are provisioned by this migration.
CREATE FUNCTION public.mcp_bearer_rotation(action text, payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  custody public."MCPBearerRotation"%ROWTYPE;
  current_copies jsonb;
  binding jsonb;
  allowed text[];
  lock_key integer;
  owns_lock boolean;
  backend_start_time timestamptz;
  target jsonb;
  server public."ChatbotMCPServer"%ROWTYPE;
  idx integer;
  changed integer;
  total_changed integer := 0;
BEGIN
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid payload';
  END IF;
  allowed := CASE action
    WHEN 'open' THEN ARRAY[]::text[]
    WHEN 'snapshot' THEN ARRAY[]::text[]
    WHEN 'inspect' THEN ARRAY['expiries']
    WHEN 'claim' THEN ARRAY['generation', 'iat', 'exp', 'config', 'snapshot']
    WHEN 'transition' THEN ARRAY['generation', 'expected', 'next']
    WHEN 'apply' THEN ARRAY['generation', 'snapshot', 'ciphertexts']
    WHEN 'conflict' THEN ARRAY[]::text[]
    WHEN 'failure' THEN ARRAY[]::text[]
  END;
  IF allowed IS NULL OR payload - allowed <> '{}'::jsonb OR NOT payload ?& allowed THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO STRICT custody FROM public."MCPBearerRotation" WHERE "writerRole" = session_user;
  lock_key := hashtext(custody.environment || ':' || custody.tenant);
  SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_locks
    WHERE locktype = 'advisory' AND pid = pg_backend_pid() AND granted
      AND database = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
      AND classid = 18271::oid AND objid = (lock_key::bigint & 4294967295)::oid AND objsubid = 2
  ) INTO owns_lock;
  IF action = 'open' AND NOT owns_lock THEN
    IF NOT pg_try_advisory_lock(18271, lock_key) THEN
      RETURN jsonb_build_object('busy', true);
    END IF;
  ELSIF NOT owns_lock THEN
    RAISE EXCEPTION 'custody lost';
  END IF;
  SELECT * INTO STRICT custody FROM public."MCPBearerRotation"
    WHERE "writerRole" = session_user FOR UPDATE;
  IF lock_key <> hashtext(custody.environment || ':' || custody.tenant) THEN
    RAISE EXCEPTION 'binding changed';
  END IF;
  IF jsonb_typeof(custody.config) IS DISTINCT FROM 'object'
    OR NOT custody.config ?& ARRAY['databaseName', 'endpoint', 'projectId', 'secretEnvironment', 'secretPath', 'secretKey']
    OR custody.config - ARRAY['databaseName', 'endpoint', 'projectId', 'secretEnvironment', 'secretPath', 'secretKey'] <> '{}'::jsonb
    OR EXISTS (SELECT 1 FROM jsonb_each(custody.config) WHERE jsonb_typeof(value) <> 'string' OR value = '""'::jsonb)
    OR custody.config->>'databaseName' <> current_database()
    OR custody.config->>'secretEnvironment' <> custody.environment
    OR custody.config->>'secretKey' <> 'DOC_QUERY_JWT_TOKEN_KLICKER'
    OR custody.config->>'secretPath' NOT LIKE '/%'
    OR custody.config->>'endpoint' !~ '^https?://[a-zA-Z0-9.:-]+/mcp/klicker$'
    OR jsonb_typeof(custody.targets) IS DISTINCT FROM 'array'
    OR jsonb_array_length(custody.targets) <> 2
    OR custody.targets->0->>'copy' IS DISTINCT FROM 'primary'
    OR custody.targets->1->>'copy' IS DISTINCT FROM 'compat'
    OR custody.targets->0->>'id' IS NOT DISTINCT FROM custody.targets->1->>'id'
  THEN
    RAISE EXCEPTION 'invalid configuration';
  END IF;
  binding := jsonb_build_object('config', custody.config, 'targets', custody.targets);
  current_copies := '[]'::jsonb;
  -- Row locks last only for this call. No database transaction spans HTTP.
  FOR idx IN 0..1 LOOP
    target := custody.targets->idx;
    SELECT * INTO STRICT server FROM public."ChatbotMCPServer" WHERE id = (target->>'id')::uuid FOR UPDATE;
    IF target IS DISTINCT FROM jsonb_build_object(
      'copy', CASE idx WHEN 0 THEN 'primary' ELSE 'compat' END,
      'id', server.id, 'name', server.name, 'url', server.url,
      'authType', server."authType", 'isActive', server."isActive"
    ) OR server.url <> custody.config->>'endpoint'
      OR server."authType" <> 'bearer' OR NOT server."isActive"
      OR server."authSecret" IS NULL
    THEN
      RAISE EXCEPTION 'invalid targets';
    END IF;
    current_copies := current_copies || jsonb_build_array(target || jsonb_build_object('authSecret', server."authSecret"));
  END LOOP;

  IF action IN ('claim', 'transition', 'apply') THEN
    IF jsonb_typeof(payload->'generation') IS DISTINCT FROM 'string'
      OR (payload->>'generation')::uuid IS NULL THEN
      RAISE EXCEPTION 'invalid generation';
    END IF;
  END IF;
  IF action IN ('transition', 'apply') THEN
    SELECT backend_start INTO STRICT backend_start_time FROM pg_catalog.pg_stat_activity WHERE pid = pg_backend_pid();
    IF custody."generationId" IS DISTINCT FROM (payload->>'generation')::uuid
      OR custody."claimedBackendPid" IS DISTINCT FROM pg_backend_pid()
      OR custody."claimedBackendStart" IS DISTINCT FROM backend_start_time
      OR custody."operationBinding" IS DISTINCT FROM binding
    THEN
      RAISE EXCEPTION 'generation custody lost';
    END IF;
  END IF;

  CASE action
    WHEN 'open', 'snapshot' THEN NULL;
    WHEN 'inspect' THEN
      IF jsonb_typeof(payload->'expiries') IS DISTINCT FROM 'object'
        OR NOT (payload->'expiries') ?& ARRAY['source', 'primary', 'compat']
        OR (payload->'expiries') - ARRAY['source', 'primary', 'compat'] <> '{}'::jsonb
        OR EXISTS (
          SELECT 1 FROM jsonb_each(payload->'expiries')
          WHERE jsonb_typeof(value) <> 'number' OR value::text !~ '^[0-9]{1,11}$'
        ) THEN RAISE EXCEPTION 'invalid expiry metadata'; END IF;
      UPDATE public."MCPBearerRotation" SET expiries = payload->'expiries',
        "lastInspectedAt" = clock_timestamp(), "lastFailureClass" = NULL
        WHERE environment = custody.environment AND tenant = custody.tenant;
    WHEN 'claim' THEN
      IF custody.stage NOT IN ('idle', 'verified')
        OR custody."generationId" IS NOT DISTINCT FROM (payload->>'generation')::uuid
        OR payload->'config' IS DISTINCT FROM custody.config
        OR payload->'snapshot' IS DISTINCT FROM current_copies
        OR jsonb_typeof(payload->'iat') IS DISTINCT FROM 'number'
        OR jsonb_typeof(payload->'exp') IS DISTINCT FROM 'number'
        OR (payload->>'iat') !~ '^[0-9]{1,11}$' OR (payload->>'exp') !~ '^[0-9]{1,11}$'
        OR abs((payload->>'iat')::bigint - extract(epoch FROM clock_timestamp())) > 60
        OR (payload->>'exp')::bigint - (payload->>'iat')::bigint <> 2592000
      THEN RAISE EXCEPTION 'invalid claim'; END IF;
      SELECT backend_start INTO STRICT backend_start_time FROM pg_catalog.pg_stat_activity WHERE pid = pg_backend_pid();
      UPDATE public."MCPBearerRotation" SET stage = 'claimed',
        "generationId" = (payload->>'generation')::uuid, "issuedAt" = (payload->>'iat')::bigint,
        "expiresAt" = (payload->>'exp')::bigint, "claimedBackendPid" = pg_backend_pid(),
        "claimedBackendStart" = backend_start_time, "operationBinding" = binding
        WHERE environment = custody.environment AND tenant = custody.tenant;
    WHEN 'transition' THEN
      IF payload->>'expected' IS DISTINCT FROM custody.stage OR NOT (
        (custody.stage = 'claimed' AND payload->>'next' = 'publication_intent') OR
        (custody.stage = 'publication_intent' AND payload->>'next' = 'published') OR
        (custody.stage = 'database_applied' AND payload->>'next' = 'verified')
      ) OR jsonb_typeof(payload->'next') IS DISTINCT FROM 'string'
      THEN RAISE EXCEPTION 'invalid transition'; END IF;
      UPDATE public."MCPBearerRotation" SET stage = payload->>'next',
        "lastVerifiedAt" = CASE WHEN payload->>'next' = 'verified' THEN clock_timestamp() ELSE "lastVerifiedAt" END
        WHERE environment = custody.environment AND tenant = custody.tenant;
    WHEN 'apply' THEN
      IF custody.stage <> 'published' OR payload->'snapshot' IS DISTINCT FROM current_copies
        OR jsonb_typeof(payload->'ciphertexts') IS DISTINCT FROM 'array'
        OR jsonb_array_length(payload->'ciphertexts') <> 2
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(payload->'ciphertexts') AS c(value)
          WHERE jsonb_typeof(value) <> 'string' OR length(value #>> '{}') > 16384
            OR (value #>> '{}') !~ '^[0-9a-f]{32}:[0-9a-f]{32}:([0-9a-f]{2})+$'
        ) THEN RAISE EXCEPTION 'copy conflict'; END IF;
      FOR idx IN 0..1 LOOP
        UPDATE public."ChatbotMCPServer" SET "authSecret" = payload->'ciphertexts'->>idx,
          "updatedAt" = clock_timestamp()
          WHERE id = (custody.targets->idx->>'id')::uuid
            AND "authSecret" = current_copies->idx->>'authSecret';
        GET DIAGNOSTICS changed = ROW_COUNT;
        total_changed := total_changed + changed;
      END LOOP;
      IF total_changed <> 2 THEN RAISE EXCEPTION 'copy count conflict'; END IF;
      UPDATE public."MCPBearerRotation" SET stage = 'database_applied'
        WHERE environment = custody.environment AND tenant = custody.tenant;
    WHEN 'conflict' THEN
      UPDATE public."MCPBearerRotation" SET stage = 'needs_reconciliation', "lastFailureClass" = 'copy_conflict'
        WHERE environment = custody.environment AND tenant = custody.tenant;
    WHEN 'failure' THEN
      UPDATE public."MCPBearerRotation" SET "lastFailureClass" = 'inspection_failed'
        WHERE environment = custody.environment AND tenant = custody.tenant;
  END CASE;
  SELECT * INTO STRICT custody FROM public."MCPBearerRotation" WHERE "writerRole" = session_user;
  RETURN jsonb_build_object('environment', custody.environment, 'tenant', custody.tenant,
    'stage', custody.stage, 'config', custody.config, 'copies', current_copies);
EXCEPTION WHEN OTHERS THEN
  -- Never surface configuration, ciphertexts, driver detail or caller payloads.
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Bearer rotation custody check failed';
END;
$$;
REVOKE ALL ON FUNCTION public.mcp_bearer_rotation(text, jsonb) FROM PUBLIC;

COMMIT;
