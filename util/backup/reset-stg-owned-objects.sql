/* klicker_reset_owned_objects */
SET lock_timeout = '30s';
BEGIN;
DO $reset$
DECLARE
  object_record record;
  object_kind text;
BEGIN
  FOR object_record IN
    SELECT
      p.proname AS object_name,
      p.prokind,
      pg_get_function_identity_arguments(p.oid) AS identity_arguments
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_has_role(current_user, p.proowner, 'USAGE')
  LOOP
    object_kind := CASE object_record.prokind
      WHEN 'p' THEN 'PROCEDURE'
      WHEN 'a' THEN 'AGGREGATE'
      ELSE 'FUNCTION'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I(%s) CASCADE',
      object_kind,
      'public',
      object_record.object_name,
      object_record.identity_arguments
    );
  END LOOP;

  FOR object_record IN
    SELECT c.relname AS object_name, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('v', 'm')
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    object_kind := CASE object_record.relkind
      WHEN 'm' THEN 'MATERIALIZED VIEW'
      ELSE 'VIEW'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I CASCADE',
      object_kind,
      'public',
      object_record.object_name
    );
  END LOOP;

  FOR object_record IN
    SELECT c.relname AS object_name, c.relkind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'f')
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    object_kind := CASE object_record.relkind
      WHEN 'f' THEN 'FOREIGN TABLE'
      ELSE 'TABLE'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I CASCADE',
      object_kind,
      'public',
      object_record.object_name
    );
  END LOOP;

  FOR object_record IN
    SELECT c.relname AS object_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
      AND pg_has_role(current_user, c.relowner, 'USAGE')
  LOOP
    EXECUTE format(
      'DROP SEQUENCE IF EXISTS %I.%I CASCADE',
      'public',
      object_record.object_name
    );
  END LOOP;

  FOR object_record IN
    SELECT t.typname AS object_name, t.typtype
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typrelid = 0
      AND pg_has_role(current_user, t.typowner, 'USAGE')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.classid = 'pg_type'::regclass
          AND d.objid = t.oid
          AND d.deptype IN ('i', 'e')
      )
  LOOP
    object_kind := CASE object_record.typtype
      WHEN 'd' THEN 'DOMAIN'
      ELSE 'TYPE'
    END;
    EXECUTE format(
      'DROP %s IF EXISTS %I.%I CASCADE',
      object_kind,
      'public',
      object_record.object_name
    );
  END LOOP;
END
$reset$;
COMMIT;
