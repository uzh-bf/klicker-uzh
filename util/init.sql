-- Create additional databases
CREATE DATABASE "shadow";
CREATE DATABASE "klicker-prod-lti";
CREATE DATABASE "klicker-qa";
CREATE DATABASE "klicker-qa-lti";
CREATE DATABASE "hatchet";

-- Create roles expected by production dumps
-- These prevent permission errors during restore
-- Note: klicker-prod role is created automatically by POSTGRES_USER, but we ensure it has proper permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'klicker-prod') THEN
        CREATE ROLE "klicker-prod" WITH LOGIN PASSWORD 'klicker' CREATEDB CREATEROLE;
    ELSE
        -- Ensure existing role has necessary permissions
        ALTER ROLE "klicker-prod" WITH CREATEDB CREATEROLE;
    END IF;
END
$$;

CREATE ROLE "klicker-prod-lti" WITH LOGIN PASSWORD 'klicker';
CREATE ROLE "klicker-qa" WITH LOGIN PASSWORD 'klicker';
CREATE ROLE "klicker-qa-lti" WITH LOGIN PASSWORD 'klicker';
CREATE ROLE "hatchet" WITH LOGIN PASSWORD 'hatchet';

-- Grant permissions
ALTER DATABASE "hatchet" OWNER TO "hatchet";
ALTER DATABASE "klicker-prod-lti" OWNER TO "klicker-prod-lti";
ALTER DATABASE "klicker-qa" OWNER TO "klicker-qa";
ALTER DATABASE "klicker-qa-lti" OWNER TO "klicker-qa-lti";

-- Grant basic permissions to LTI roles
-- These match what the production dump expects
GRANT ALL PRIVILEGES ON DATABASE "klicker-prod-lti" TO "klicker-prod-lti";
GRANT ALL PRIVILEGES ON DATABASE "klicker-qa-lti" TO "klicker-qa-lti";

-- Grant permissions on the main database as well
GRANT ALL PRIVILEGES ON DATABASE "klicker-prod" TO "klicker-prod";
GRANT ALL PRIVILEGES ON DATABASE "klicker-qa" TO "klicker-qa";
