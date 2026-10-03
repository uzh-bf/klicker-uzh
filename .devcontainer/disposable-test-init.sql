-- Create only the explicitly-owned disposable test identity and databases.
-- Refuse any pre-existing target before making a write so retained data is
-- never adopted or relabeled.

\set ON_ERROR_STOP on

SELECT current_database() AS bootstrap_database,
       current_user AS bootstrap_current_user,
       session_user AS bootstrap_session_user,
       current_database() = 'klicker-prod'
         AND current_user IN ('klicker', 'klicker-prod')
         AND session_user IN ('klicker', 'klicker-prod')
         AND current_user = session_user AS bootstrap_identity_ok
\gset

\if :bootstrap_identity_ok
\else
  \echo 'Refusing disposable bootstrap: unexpected database or session identity.'
  DO $$
  BEGIN
    RAISE EXCEPTION 'Refusing disposable bootstrap: unexpected database or session identity.';
  END
  $$;
\endif

SELECT EXISTS (
         SELECT 1
         FROM pg_catalog.pg_roles
         WHERE rolname = 'klicker_test'
       ) AS role_exists,
       EXISTS (
         SELECT 1
         FROM pg_catalog.pg_database
         WHERE datname = 'klicker_test'
       ) AS main_database_exists,
       EXISTS (
         SELECT 1
         FROM pg_catalog.pg_database
         WHERE datname = 'klicker_test_shadow'
       ) AS shadow_database_exists
\gset

\if :role_exists
  \echo 'Refusing disposable bootstrap: role klicker_test already exists.'
  DO $$
  BEGIN
    RAISE EXCEPTION 'Refusing disposable bootstrap: role klicker_test already exists.';
  END
  $$;
\endif

\if :main_database_exists
  \echo 'Refusing disposable bootstrap: database klicker_test already exists.'
  DO $$
  BEGIN
    RAISE EXCEPTION 'Refusing disposable bootstrap: database klicker_test already exists.';
  END
  $$;
\endif

\if :shadow_database_exists
  \echo 'Refusing disposable bootstrap: database klicker_test_shadow already exists.'
  DO $$
  BEGIN
    RAISE EXCEPTION 'Refusing disposable bootstrap: database klicker_test_shadow already exists.';
  END
  $$;
\endif

CREATE ROLE "klicker_test"
  WITH LOGIN PASSWORD 'klicker'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOREPLICATION
  NOBYPASSRLS;

CREATE DATABASE "klicker_test" OWNER "klicker_test";
COMMENT ON DATABASE "klicker_test" IS 'klicker-disposable-test-v1';

CREATE DATABASE "klicker_test_shadow" OWNER "klicker_test";
COMMENT ON DATABASE "klicker_test_shadow" IS 'klicker-disposable-test-v1';
