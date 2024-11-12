#!/bin/sh
PGPASSWORD="klicker" pg_restore --host="localhost" --port=5432 --user="klicker" --dbname="klicker-prod" --no-owner --format="t" dump_old_choices.tar
PGPASSWORD="klicker" pg_restore --host="localhost" --port=5433 --user="klicker" --dbname="klicker-prod" --no-owner --format="t" dump_old_choices.tar
