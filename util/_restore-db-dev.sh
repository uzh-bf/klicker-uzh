#!/bin/sh

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

PGPASSWORD="klicker" pg_restore --host="localhost" --port=5432 --user="klicker" --dbname="klicker-prod" --no-owner --format="t" "${SCRIPT_DIR}/dump.tar"
