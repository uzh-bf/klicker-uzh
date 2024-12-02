#!/bin/sh
PGPASSWORD="klicker" pg_restore --host="localhost" --port=5432 --user="klicker" --dbname="klicker-prod" --no-owner --format="t" dump.tar
