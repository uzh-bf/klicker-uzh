#!/bin/sh

# copy the prisma schema for it to be available to python files
./util/sync-schema.sh

# start postgres, redis, and reverse proxy
docker compose up postgres redis_exec redis_cache reverse_proxy_wsl_jannis
