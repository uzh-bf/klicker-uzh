#!/bin/sh
PGPASSWORD="klicker" pg_restore --host="localhost" --user="klicker" --dbname="klicker-prod" --no-owner --format="t" dump.tar
