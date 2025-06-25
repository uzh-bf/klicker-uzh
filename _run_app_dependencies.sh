#!/bin/sh

# copy the prisma schema for it to be available to python files
./util/sync-schema.sh

# start postgres, redis, and reverse proxy
docker compose up --build \
    postgres \
    hatchet_postgres \
    hatchet_rabbitmq \
    hatchet_migration \
    hatchet_setup_config \
    hatchet_engine \
    hatchet_dashboard \
    redis_exec \
    redis_cache \
    reverse_proxy_docker
